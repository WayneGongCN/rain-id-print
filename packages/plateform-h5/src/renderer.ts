import {
  isDefaultBackgroundTuning,
  mmToPixels,
  normalizeBackgroundTuning,
  type BackgroundMode,
  type BackgroundTuning,
  type LayoutPlan,
} from '@rainnear/core'
import { patchJpegDpi } from './jpeg-dpi'
import { refineRgbaPixels, type RgbColor } from './matte-refinement'
import type { StoredImage } from './resource-store'
import { H5ResourceStore } from './resource-store'
import type { RenderOptions } from './types'

const BACKGROUND_COLORS: Record<Exclude<BackgroundMode, 'keep'>, string> = {
  white: '#ffffff',
  blue: '#438edb',
  red: '#d6453d',
  gray: '#c8c8c8',
}

type DrawableSource = HTMLImageElement | HTMLCanvasElement

/** 将 Canvas 异步编码为高质量 JPEG，喵~ */
function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('浏览器无法编码 JPEG'))
    }, 'image/jpeg', 0.95)
  })
}

/** 读取图片或画布的真实像素尺寸，喵~ */
function getSourceSize(source: DrawableSource): { width: number; height: number } {
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

/** 从原图边缘估算背景颜色，为去除发丝色溢出提供参考，喵~ */
function sampleBackgroundColor(resource: StoredImage): RgbColor {
  if (resource.sampledBackground) return resource.sampledBackground
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return [255, 255, 255]
  context.drawImage(resource.image, 0, 0, canvas.width, canvas.height)
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
  const sums: [number, number, number] = [0, 0, 0]
  let count = 0
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      if (x > 2 && x < canvas.width - 3 && y > 2 && y < canvas.height - 3) continue
      const index = (y * canvas.width + x) * 4
      sums[0] += pixels[index] ?? 0
      sums[1] += pixels[index + 1] ?? 0
      sums[2] += pixels[index + 2] ?? 0
      count += 1
    }
  }
  resource.sampledBackground = [
    Math.round((sums[0] ?? 0) / count),
    Math.round((sums[1] ?? 0) / count),
    Math.round((sums[2] ?? 0) / count),
  ]
  return resource.sampledBackground
}

/** 将目标绘制尺寸归入稳定分辨率档位，减少实时拖动时的重复计算，喵~ */
function getRefinementBucket(requiredMaxDimension: number): number {
  let bucket = 256
  while (bucket < requiredMaxDimension && bucket < 2048) bucket *= 2
  return bucket
}

/** 将最近的专业预览结果写入有上限的资源缓存，避免连续拖动耗尽内存，喵~ */
function cacheRefinedCutout(resource: StoredImage, cacheKey: string, canvas: HTMLCanvasElement): void {
  resource.refinedCutouts ??= new Map()
  while (resource.refinedCutouts.size >= 12) {
    const oldestKey = resource.refinedCutouts.keys().next().value as string | undefined
    if (!oldestKey) break
    const oldestCanvas = resource.refinedCutouts.get(oldestKey)
    if (oldestCanvas) {
      oldestCanvas.width = 1
      oldestCanvas.height = 1
    }
    resource.refinedCutouts.delete(oldestKey)
  }
  resource.refinedCutouts.set(cacheKey, canvas)
}

/** 生成并缓存应用专业参数后的透明前景画布，喵~ */
function getRefinedCutout(
  resource: StoredImage,
  tuning: BackgroundTuning | undefined,
  requiredMaxDimension: number,
): DrawableSource {
  if (!resource.cutout) throw new Error('换底色前必须先完成本地抠图')
  if (isDefaultBackgroundTuning(tuning)) return resource.cutout

  const normalized = normalizeBackgroundTuning(tuning)
  const bucket = getRefinementBucket(requiredMaxDimension)
  const cacheKey = `${bucket}:${normalized.edgeShiftPx}:${normalized.edgeHardness}:${normalized.featherPx}:${normalized.decontaminate}`
  const cached = resource.refinedCutouts?.get(cacheKey)
  if (cached) return cached

  const sourceMaxDimension = Math.max(resource.cutout.naturalWidth, resource.cutout.naturalHeight)
  const scale = Math.min(1, bucket / sourceMaxDimension)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(resource.cutout.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(resource.cutout.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('当前浏览器不支持透明蒙版微调')
  context.drawImage(resource.cutout, 0, 0, canvas.width, canvas.height)
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
  const refined = refineRgbaPixels(
    imageData.data,
    canvas.width,
    canvas.height,
    sampleBackgroundColor(resource),
    normalized,
  )
  imageData.data.set(refined)
  context.putImageData(imageData, 0, 0)
  cacheRefinedCutout(resource, cacheKey, canvas)
  return canvas
}

/** 将一张照片按归一化裁切框绘制到目标区域，喵~ */
function drawPhoto(
  context: CanvasRenderingContext2D,
  source: DrawableSource,
  background: BackgroundMode,
  crop: LayoutPlan['items'][number]['crop'],
  destination: { x: number; y: number; width: number; height: number },
): void {
  const sourceSize = getSourceSize(source)

  if (background !== 'keep') {
    context.fillStyle = BACKGROUND_COLORS[background]
    context.fillRect(destination.x, destination.y, destination.width, destination.height)
  }

  context.drawImage(
    source,
    crop.x * sourceSize.width,
    crop.y * sourceSize.height,
    crop.width * sourceSize.width,
    crop.height * sourceSize.height,
    destination.x,
    destination.y,
    destination.width,
    destination.height,
  )
}

/** 负责把平台无关布局计划渲染为 H5 Canvas 和 JPEG，喵~ */
export class H5CanvasRenderer {
  constructor(private readonly store: H5ResourceStore) {}

  /** 按最大边限制绘制轻量预览，避免实时创建高分辨率画布，喵~ */
  async renderPreview(
    canvas: HTMLCanvasElement,
    plan: LayoutPlan,
    backgrounds: ReadonlyMap<string, BackgroundMode>,
    options: RenderOptions,
  ): Promise<void> {
    const maxEdge = options.previewMaxEdge ?? 1400
    const scale = Math.min(maxEdge / Math.max(plan.pixelSize.width, plan.pixelSize.height), 1)
    const width = Math.max(1, Math.round(plan.pixelSize.width * scale))
    const height = Math.max(1, Math.round(plan.pixelSize.height * scale))
    this.draw(canvas, plan, backgrounds, options, width, height)
  }

  /** 按布局 DPI 创建最终画布并写入正确 JPEG 密度元数据，喵~ */
  async exportJpeg(
    plan: LayoutPlan,
    backgrounds: ReadonlyMap<string, BackgroundMode>,
    options: RenderOptions,
  ): Promise<Blob> {
    const pixels = plan.pixelSize.width * plan.pixelSize.height
    const limit = options.maxExportPixels ?? 25_000_000
    if (pixels > limit) throw new RangeError(`输出尺寸 ${(pixels / 1_000_000).toFixed(1)}MP 超过 H5 ${Math.round(limit / 1_000_000)}MP 上限`)

    const canvas = document.createElement('canvas')
    this.draw(canvas, plan, backgrounds, options, plan.pixelSize.width, plan.pixelSize.height)
    const jpeg = await canvasToJpeg(canvas)
    canvas.width = 1
    canvas.height = 1
    return patchJpegDpi(jpeg, plan.dpi)
  }

  /** 使用统一毫米坐标在任意输出分辨率下绘制纸张和照片，喵~ */
  private draw(
    canvas: HTMLCanvasElement,
    plan: LayoutPlan,
    backgrounds: ReadonlyMap<string, BackgroundMode>,
    options: RenderOptions,
    width: number,
    height: number,
  ): void {
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('当前浏览器不支持 Canvas 2D')

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, width, height)
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    const scaleX = width / plan.paper.width
    const scaleY = height / plan.paper.height

    plan.items.forEach((item) => {
      const resource = this.store.get(item.photoId)
      const destination = {
        x: Math.round(item.x * scaleX),
        y: Math.round(item.y * scaleY),
        width: Math.max(1, Math.round(item.width * scaleX)),
        height: Math.max(1, Math.round(item.height * scaleY)),
      }
      const background = backgrounds.get(item.photoId) ?? item.background
      const requiredMaxDimension = Math.ceil(Math.max(
        destination.width / item.crop.width,
        destination.height / item.crop.height,
      ))
      const source = background === 'keep'
        ? resource.image
        : getRefinedCutout(resource, options.backgroundTunings?.get(item.photoId), requiredMaxDimension)
      drawPhoto(context, source, background, item.crop, destination)
      context.strokeStyle = options.separatorColor
      context.lineWidth = Math.max(1, mmToPixels(0.1, plan.dpi) * (width / plan.pixelSize.width))
      context.strokeRect(destination.x + 0.5, destination.y + 0.5, destination.width - 1, destination.height - 1)
    })
  }
}
