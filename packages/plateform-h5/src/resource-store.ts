import type { H5ImageAsset } from './types'
import { createResourceId } from './resource-id'

interface StoredImage extends H5ImageAsset {
  image: HTMLImageElement
  originalFile: File
  cutout?: HTMLImageElement
  cutoutUrl?: string
  cutoutPromise?: Promise<void>
  refinedCutouts?: Map<string, HTMLCanvasElement>
  sampledBackground?: readonly [number, number, number]
}

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_FILE_BYTES = 8 * 1024 * 1024
const MAX_SOURCE_PIXELS = 40_000_000

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

  /** 缓存指定资源的透明前景并合并同时发起的请求，喵~ */
  async ensureCutout(assetId: string, task: (resource: StoredImage) => Promise<Blob>): Promise<void> {
    const resource = this.get(assetId)
    if (resource.cutout) return
    if (resource.cutoutPromise) return resource.cutoutPromise

    resource.cutoutPromise = (async () => {
      const blob = await task(resource)
      const cutoutUrl = URL.createObjectURL(blob)
      try {
        resource.cutout = await loadImage(cutoutUrl)
        resource.cutoutUrl = cutoutUrl
        resource.refinedCutouts = new Map()
      } catch (error) {
        URL.revokeObjectURL(cutoutUrl)
        throw error
      }
    })().finally(() => {
      resource.cutoutPromise = undefined
    })

    return resource.cutoutPromise
  }

  /** 移除一个图片资源并撤销其全部 Object URL，喵~ */
  remove(assetId: string): void {
    const resource = this.resources.get(assetId)
    if (!resource) return
    URL.revokeObjectURL(resource.objectUrl)
    if (resource.cutoutUrl) URL.revokeObjectURL(resource.cutoutUrl)
    resource.refinedCutouts?.forEach((canvas) => {
      canvas.width = 1
      canvas.height = 1
    })
    resource.refinedCutouts?.clear()
    this.resources.delete(assetId)
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
}

export type { StoredImage }
