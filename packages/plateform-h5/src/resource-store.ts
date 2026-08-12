import type { H5ImageAsset } from './types'
import type { BackgroundRemovalModelId } from './types'
import { createBackgroundRemovalAbortError } from './background-removal'
import { createResourceId } from './resource-id'

interface StoredCutout {
  image: HTMLImageElement
  objectUrl: string
  refinedCutouts: Map<string, HTMLCanvasElement>
  lastAccess: number
}

interface StoredImage extends H5ImageAsset {
  image: HTMLImageElement
  originalFile: File
  cutouts: Map<BackgroundRemovalModelId, StoredCutout>
  cutoutPromises: Map<BackgroundRemovalModelId, Promise<void>>
  sampledBackground?: readonly [number, number, number]
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_SOURCE_PIXELS = 40_000_000
const MAX_CUTOUT_MODELS_PER_RESOURCE = 2

/** 等待浏览器完整解码一个图片地址，喵~ */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.decoding = 'async'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解码失败'))
    image.src = url
  })
}

/** 管理浏览器图片对象和 Object URL 的完整生命周期，喵~ */
export class H5ResourceStore {
  private readonly resources = new Map<string, StoredImage>()
  private cutoutAccessCounter = 0

  /** 导入一个浏览器文件并生成稳定资源标识，喵~ */
  async importFile(file: File): Promise<H5ImageAsset> {
    if (!ALLOWED_TYPES.has(file.type)) throw new TypeError(`不支持 ${file.type || '未知'} 图片格式`)
    if (file.size > MAX_FILE_BYTES) throw new RangeError('单张图片不能超过 8MB')

    const objectUrl = URL.createObjectURL(file)
    try {
      const image = await loadImage(objectUrl)
      const pixels = image.naturalWidth * image.naturalHeight
      if (pixels > MAX_SOURCE_PIXELS) throw new RangeError('图片解码尺寸不能超过 4000 万像素')

      const id = createResourceId()
      const stored: StoredImage = {
        id,
        name: file.name,
        objectUrl,
        width: image.naturalWidth,
        height: image.naturalHeight,
        size: file.size,
        image,
        originalFile: file,
        cutouts: new Map(),
        cutoutPromises: new Map(),
      }
      this.resources.set(id, stored)
      return this.toPublicAsset(stored)
    } catch (error) {
      URL.revokeObjectURL(objectUrl)
      throw error
    }
  }

  /** 根据资源标识读取内部可绘制图片，喵~ */
  get(assetId: string): StoredImage {
    const resource = this.resources.get(assetId)
    if (!resource) throw new Error(`图片资源 ${assetId} 不存在`)
    return resource
  }

  /** 读取并触碰指定模型的透明前景，供 LRU 缓存判断最近使用顺序，喵~ */
  getCutout(assetId: string, modelId: BackgroundRemovalModelId): StoredCutout {
    const resource = this.get(assetId)
    const cutout = resource.cutouts.get(modelId)
    if (!cutout) throw new Error(`照片 ${assetId} 尚未使用${modelId}模型完成抠图`)
    cutout.lastAccess = ++this.cutoutAccessCounter
    return cutout
  }

  /** 缓存指定资源和模型的透明前景并合并同模型并发请求，喵~ */
  async ensureCutout(
    assetId: string,
    modelId: BackgroundRemovalModelId,
    task: (resource: StoredImage) => Promise<Blob>,
  ): Promise<void> {
    const resource = this.get(assetId)
    const existing = resource.cutouts.get(modelId)
    if (existing) {
      existing.lastAccess = ++this.cutoutAccessCounter
      return
    }
    const existingPromise = resource.cutoutPromises.get(modelId)
    if (existingPromise) return existingPromise

    const promise = (async () => {
      const blob = await task(resource)
      if (this.resources.get(assetId) !== resource) throw createBackgroundRemovalAbortError()
      const cutoutUrl = URL.createObjectURL(blob)
      try {
        const image = await loadImage(cutoutUrl)
        if (this.resources.get(assetId) !== resource) {
          throw createBackgroundRemovalAbortError()
        }
        resource.cutouts.set(modelId, {
          image,
          objectUrl: cutoutUrl,
          refinedCutouts: new Map(),
          lastAccess: ++this.cutoutAccessCounter,
        })
        this.evictCutouts(resource, modelId)
      } catch (error) {
        if (![...resource.cutouts.values()].some((cutout) => cutout.objectUrl === cutoutUrl)) {
          URL.revokeObjectURL(cutoutUrl)
        }
        throw error
      }
    })().finally(() => {
      if (resource.cutoutPromises.get(modelId) === promise) resource.cutoutPromises.delete(modelId)
    })

    resource.cutoutPromises.set(modelId, promise)
    return promise
  }

  /** 移除一个图片资源并撤销其全部 Object URL，喵~ */
  remove(assetId: string): void {
    const resource = this.resources.get(assetId)
    if (!resource) return
    this.resources.delete(assetId)
    URL.revokeObjectURL(resource.objectUrl)
    resource.cutouts.forEach((cutout) => this.releaseCutout(cutout))
    resource.cutouts.clear()
    resource.cutoutPromises.clear()
  }

  /** 释放资源仓库持有的全部图片对象，喵~ */
  dispose(): void {
    ;[...this.resources.keys()].forEach((assetId) => this.remove(assetId))
  }

  /** 隔离内部图片对象，只向应用暴露可序列化元数据，喵~ */
  private toPublicAsset(resource: StoredImage): H5ImageAsset {
    const { id, name, objectUrl, width, height, size } = resource
    return { id, name, objectUrl, width, height, size }
  }

  /** 淘汰最久未使用的模型结果，同时保护刚写入的结果，喵~ */
  private evictCutouts(resource: StoredImage, protectedModelId: BackgroundRemovalModelId): void {
    while (resource.cutouts.size > MAX_CUTOUT_MODELS_PER_RESOURCE) {
      const candidate = [...resource.cutouts.entries()]
        .filter(([modelId]) => modelId !== protectedModelId)
        .sort((left, right) => left[1].lastAccess - right[1].lastAccess)[0]
      if (!candidate) return
      this.releaseCutout(candidate[1])
      resource.cutouts.delete(candidate[0])
    }
  }

  /** 释放单个模型结果关联的链接和专业微调画布，喵~ */
  private releaseCutout(cutout: StoredCutout): void {
    URL.revokeObjectURL(cutout.objectUrl)
    cutout.refinedCutouts.forEach((canvas) => {
      canvas.width = 1
      canvas.height = 1
    })
    cutout.refinedCutouts.clear()
  }
}

export type { StoredCutout, StoredImage }
