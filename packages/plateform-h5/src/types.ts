import type { BackgroundMode, BackgroundTuning, LayoutPlan } from '@rainnear/core'

export interface H5ImageAsset {
  id: string
  name: string
  objectUrl: string
  width: number
  height: number
  size: number
}

export interface RenderOptions {
  separatorColor: string
  previewMaxEdge?: number
  maxExportPixels?: number
  backgroundTunings?: ReadonlyMap<string, BackgroundTuning>
}

export interface BackgroundProgress {
  phase: 'loading-model' | 'processing'
  current?: number
  total?: number
}

export interface H5Platform {
  /**
   * 导入并解码浏览器本地图片，Promise 在全部有效图片可绘制时完成，喵~
   * @param files 用户选择或拖入的文件列表，喵~
   */
  importFiles(files: Iterable<File>): Promise<H5ImageAsset[]>

  /**
   * 为指定照片准备透明前景，Promise 在本地模型处理完成时返回，喵~
   * @param assetId 平台资源标识，喵~
   * @param onProgress 模型下载和处理进度回调，喵~
   */
  prepareCutout(assetId: string, onProgress?: (progress: BackgroundProgress) => void): Promise<void>

  /**
   * 将布局计划绘制到页面预览画布，Promise 在绘制完成后兑现，喵~
   * @param canvas 页面持有的预览画布，喵~
   * @param plan 平台无关的布局计划，喵~
   * @param backgrounds 每张资源当前选择的背景模式，喵~
   * @param options 预览渲染配置，喵~
   */
  renderPreview(
    canvas: HTMLCanvasElement,
    plan: LayoutPlan,
    backgrounds: ReadonlyMap<string, BackgroundMode>,
    options: RenderOptions,
  ): Promise<void>

  /**
   * 生成带正确 DPI 元数据的 JPEG，Promise 在浏览器编码完成后返回 Blob，喵~
   * @param plan 平台无关的布局计划，喵~
   * @param backgrounds 每张资源当前选择的背景模式，喵~
   * @param options 高分辨率渲染配置，喵~
   */
  exportJpeg(
    plan: LayoutPlan,
    backgrounds: ReadonlyMap<string, BackgroundMode>,
    options: RenderOptions,
  ): Promise<Blob>

  /**
   * 触发浏览器保存文件并在完成同步触发后返回，喵~
   * @param blob 待下载的文件内容，喵~
   * @param filename 用户看到的文件名，喵~
   */
  download(blob: Blob, filename: string): void

  /**
   * 释放单张照片关联的 Object URL 和图像对象，喵~
   * @param assetId 平台资源标识，喵~
   */
  removeAsset(assetId: string): void

  /** 释放平台层当前持有的全部浏览器资源，喵~ */
  dispose(): void
}
