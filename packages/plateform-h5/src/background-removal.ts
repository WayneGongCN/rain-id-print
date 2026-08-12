import { removeBackground } from '@imgly/background-removal'
import type {
  BackgroundRemovalBackend,
  BackgroundRemovalModelDescriptor,
  BackgroundRemovalModelId,
  BackgroundRemovalRunOptions,
} from './types'

type ImglyModel = 'isnet_quint8' | 'isnet_fp16'

export const DEFAULT_BACKGROUND_REMOVAL_MODEL_ID = 'fast'

/** 创建标准的任务取消错误，供平台和界面统一识别，喵~ */
export function createBackgroundRemovalAbortError(): Error {
  const error = new Error('抠图任务已取消')
  error.name = 'AbortError'
  return error
}

/** 在推理边界检查取消信号，避免过期结果写回资源缓存，喵~ */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createBackgroundRemovalAbortError()
}

/** 创建一个由 IMG.LY 模型驱动的浏览器本地抠图适配器，喵~ */
export function createImglyBackgroundRemovalBackend(
  descriptor: BackgroundRemovalModelDescriptor,
  model: ImglyModel,
): BackgroundRemovalBackend {
  let activeOptions: BackgroundRemovalRunOptions | undefined
  let inferenceQueue: Promise<void> = Promise.resolve()

  /** 将 IMG.LY 复用的固定回调转发给当前串行任务，喵~ */
  function reportProgress(key: string, current: number, total: number): void {
    if (activeOptions?.signal?.aborted) return
    const phase = key.startsWith('fetch:') ? 'loading-model' : 'processing'
    activeOptions?.onProgress?.({ phase, current, total })
  }

  return {
    descriptor: Object.freeze({ ...descriptor }),
    removeBackground(source: Blob, options: BackgroundRemovalRunOptions = {}) {
      const task = inferenceQueue.then(async () => {
        throwIfAborted(options.signal)
        activeOptions = options
        options.onProgress?.({ phase: 'loading-model' })
        try {
          const result = await removeBackground(source, { model, progress: reportProgress })
          throwIfAborted(options.signal)
          return result
        } finally {
          if (activeOptions === options) activeOptions = undefined
        }
      })
      inferenceQueue = task.then(() => undefined, () => undefined)
      return task
    },
  }
}

export const BUILTIN_BACKGROUND_REMOVAL_BACKENDS: readonly BackgroundRemovalBackend[] = Object.freeze([
  createImglyBackgroundRemovalBackend({
    id: 'fast',
    name: '快速模型',
    description: '加载更快，适合背景简单的普通证件照',
    estimatedDownloadBytes: 40 * 1024 * 1024,
  }, 'isnet_quint8'),
  createImglyBackgroundRemovalBackend({
    id: 'quality',
    name: '高清模型',
    description: '发丝和复杂边缘更细致，首次加载时间较长',
    estimatedDownloadBytes: 80 * 1024 * 1024,
  }, 'isnet_fp16'),
])

export interface BackgroundRemovalRegistry {
  readonly descriptors: readonly BackgroundRemovalModelDescriptor[]
  readonly defaultModelId: BackgroundRemovalModelId
  get(modelId: BackgroundRemovalModelId): BackgroundRemovalBackend
}

/** 校验并创建不可变模型注册表，避免错误配置延迟到推理阶段才暴露，喵~ */
export function createBackgroundRemovalRegistry(
  backends: readonly BackgroundRemovalBackend[],
  defaultModelId: BackgroundRemovalModelId,
): BackgroundRemovalRegistry {
  if (backends.length === 0) throw new Error('至少需要注册一个抠图模型')
  const backendMap = new Map<BackgroundRemovalModelId, BackgroundRemovalBackend>()
  const descriptors = backends.map((backend) => {
    const descriptor = backend.descriptor
    if (!descriptor.id.trim()) throw new Error('抠图模型 ID 不能为空')
    if (!descriptor.name.trim()) throw new Error(`抠图模型 ${descriptor.id} 的名称不能为空`)
    if (backendMap.has(descriptor.id)) throw new Error(`抠图模型 ID ${descriptor.id} 重复注册`)
    backendMap.set(descriptor.id, backend)
    return Object.freeze({ ...descriptor })
  })
  if (!backendMap.has(defaultModelId)) throw new Error(`默认抠图模型 ${defaultModelId} 未注册`)

  return Object.freeze({
    descriptors: Object.freeze(descriptors),
    defaultModelId,
    get(modelId: BackgroundRemovalModelId) {
      const backend = backendMap.get(modelId)
      if (!backend) throw new Error(`抠图模型 ${modelId} 未注册`)
      return backend
    },
  })
}
