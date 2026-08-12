import type {
  BackgroundProgress,
  BackgroundRemovalModelId,
  H5Platform,
} from '@rainnear/plateform-h5'

export interface BackgroundModelSwitchProgress {
  readonly assetId: string
  readonly current: number
  readonly total: number
  readonly modelProgress?: BackgroundProgress
}

export interface PrepareBackgroundModelOptions {
  readonly signal?: AbortSignal
  readonly onProgress?: (progress: BackgroundModelSwitchProgress) => void
}

/** 串行准备多张照片的新模型结果，限制浏览器推理峰值内存，喵~ */
export async function prepareBackgroundModelForAssets(
  platform: Pick<H5Platform, 'prepareCutout'>,
  assetIds: readonly string[],
  modelId: BackgroundRemovalModelId,
  options: PrepareBackgroundModelOptions = {},
): Promise<void> {
  for (let index = 0; index < assetIds.length; index += 1) {
    if (options.signal?.aborted) {
      const error = new Error('抠图任务已取消')
      error.name = 'AbortError'
      throw error
    }
    const assetId = assetIds[index]
    if (!assetId) continue
    const current = index + 1
    options.onProgress?.({ assetId, current, total: assetIds.length })
    await platform.prepareCutout(assetId, {
      modelId,
      signal: options.signal,
      onProgress: (modelProgress) => options.onProgress?.({
        assetId,
        current,
        total: assetIds.length,
        modelProgress,
      }),
    })
  }
}
