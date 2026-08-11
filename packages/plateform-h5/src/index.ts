import { removeBackground } from '@imgly/background-removal'
import type { BackgroundMode } from '@rainnear/core'
import { H5CanvasRenderer } from './renderer'
import { H5ResourceStore, type StoredImage } from './resource-store'
import type { BackgroundProgress, H5Platform } from './types'

export * from './jpeg-dpi'
export * from './matte-refinement'
export * from './resource-id'
export * from './types'

/** 使用 IMG.LY 浏览器模型生成带透明通道的人像前景，喵~ */
async function removeImageBackground(
  resource: StoredImage,
  onProgress?: (progress: BackgroundProgress) => void,
): Promise<Blob> {
  onProgress?.({ phase: 'loading-model' })
  return removeBackground(resource.originalFile, {
    model: 'isnet_quint8',
    progress: (key, current, total) => {
      const phase = key.startsWith('fetch:') ? 'loading-model' : 'processing'
      onProgress?.({ phase, current, total })
    },
  })
}

/** 创建 H5 平台能力集合并集中管理其浏览器资源生命周期，喵~ */
export function createH5Platform(): H5Platform {
  const store = new H5ResourceStore()
  const renderer = new H5CanvasRenderer(store)

  return {
    /** 批量导入本地照片并等待解码完成，喵~ */
    async importFiles(files) {
      return Promise.all([...files].map((file) => store.importFile(file)))
    },
    /** 缓存指定照片的透明前景，喵~ */
    async prepareCutout(assetId, onProgress) {
      return store.ensureCutout(assetId, (resource) => removeImageBackground(resource, onProgress))
    },
    /** 将布局计划绘制为低分辨率预览，喵~ */
    async renderPreview(canvas, plan, backgrounds, options) {
      return renderer.renderPreview(canvas, plan, backgrounds, options)
    },
    /** 将布局计划导出为带目标 DPI 的 JPEG，喵~ */
    async exportJpeg(plan, backgrounds, options) {
      return renderer.exportJpeg(plan, backgrounds, options)
    },
    /** 通过临时链接触发浏览器下载，喵~ */
    download(blob, filename) {
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000)
    },
    /** 移除单张浏览器图片资源，喵~ */
    removeAsset(assetId) {
      store.remove(assetId)
    },
    /** 释放平台实例持有的全部浏览器资源，喵~ */
    dispose() {
      store.dispose()
    },
  }
}

export type { BackgroundMode }
