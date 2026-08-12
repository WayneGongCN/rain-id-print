import type { BackgroundRemovalModelDescriptor, BackgroundRemovalModelId } from '@rainnear/plateform-h5'

export const BACKGROUND_MODEL_PREFERENCE_KEY = 'rainnear.background-removal-model.v1'

type ModelPreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>

/** 安全读取浏览器存储，服务端渲染或隐私模式下返回空，喵~ */
function getBrowserStorage(): ModelPreferenceStorage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage
  } catch {
    return undefined
  }
}

/** 读取并校验用户模型偏好，无效值回退平台默认模型，喵~ */
export function readBackgroundModelPreference(
  models: readonly BackgroundRemovalModelDescriptor[],
  defaultModelId: BackgroundRemovalModelId,
  storage: ModelPreferenceStorage | undefined = getBrowserStorage(),
): BackgroundRemovalModelId {
  try {
    const storedModelId = storage?.getItem(BACKGROUND_MODEL_PREFERENCE_KEY)
    return storedModelId && models.some((model) => model.id === storedModelId)
      ? storedModelId
      : defaultModelId
  } catch {
    return defaultModelId
  }
}

/** 尽力保存用户模型偏好，浏览器拒绝存储时不影响主流程，喵~ */
export function writeBackgroundModelPreference(
  modelId: BackgroundRemovalModelId,
  storage: ModelPreferenceStorage | undefined = getBrowserStorage(),
): void {
  try {
    storage?.setItem(BACKGROUND_MODEL_PREFERENCE_KEY, modelId)
  } catch {
    // 存储不可用时保持当前会话选择即可，喵~
  }
}
