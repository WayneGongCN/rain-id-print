import type { BackgroundMode } from '@rainnear/core'
import {
  BUILTIN_BACKGROUND_REMOVAL_BACKENDS,
  DEFAULT_BACKGROUND_REMOVAL_MODEL_ID,
  createBackgroundRemovalRegistry,
} from './background-removal'
import { H5CanvasRenderer } from './renderer'
import { H5ResourceStore } from './resource-store'
import type { H5Platform, H5PlatformOptions } from './types'

export * from './background-removal'
export * from './jpeg-dpi'
export * from './matte-refinement'
export * from './resource-id'
export * from './types'

/** 创建 H5 平台能力集合并集中管理其浏览器资源生命周期，喵~ */
export function createH5Platform(options: H5PlatformOptions = {}): H5Platform {
  const backends = options.backgroundRemovalBackends ?? BUILTIN_BACKGROUND_REMOVAL_BACKENDS
  const defaultModelId = options.defaultBackgroundRemovalModelId ?? DEFAULT_BACKGROUND_REMOVAL_MODEL_ID
  const registry = createBackgroundRemovalRegistry(backends, defaultModelId)
  const store = new H5ResourceStore()
  const renderer = new H5CanvasRenderer(store)

  return {
    backgroundRemovalModels: registry.descriptors,
    defaultBackgroundRemovalModelId: registry.defaultModelId,
    /** 批量导入本地照片并等待解码完成，喵~ */
    async importFiles(files) {
      return Promise.all([...files].map((file) => store.importFile(file)))
    },
    /** 缓存指定照片的透明前景，喵~ */
    async prepareCutout(assetId, prepareOptions) {
      const backend = registry.get(prepareOptions.modelId)
      return store.ensureCutout(assetId, prepareOptions.modelId, (resource) => backend.removeBackground(
        resource.originalFile,
        prepareOptions,
      ))
    },
    /** 将布局计划绘制为低分辨率预览，喵~ */
    async renderPreview(canvas, plan, backgrounds, options) {
      return renderer.renderPreview(canvas, plan, backgrounds, options)
    },
    /** 将单张业务规格照片绘制为低分辨率预览，喵~ */
    async renderPhotoPreview(canvas, plan, options) {
      return renderer.renderPhotoPreview(canvas, plan, options)
    },
    /** 将布局计划导出为带目标 DPI 的 JPEG，喵~ */
    async exportJpeg(plan, backgrounds, options) {
      return renderer.exportJpeg(plan, backgrounds, options)
    },
    /** 将单张业务规格照片导出为带目标 DPI 的 JPEG，喵~ */
    async exportPhotoJpeg(plan, options) {
      return renderer.exportPhotoJpeg(plan, options)
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
      backends.forEach((backend) => backend.dispose?.())
    },
  }
}

export type { BackgroundMode }
