export interface BackgroundTuning {
  edgeShiftPx: number
  edgeHardness: number
  featherPx: number
  decontaminate: number
}

export const DEFAULT_BACKGROUND_TUNING: Readonly<BackgroundTuning> = Object.freeze({
  edgeShiftPx: 0,
  edgeHardness: 0,
  featherPx: 0,
  decontaminate: 0,
})

/** 将数值限制到专业模式允许的安全范围内，喵~ */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, Number.isFinite(value) ? value : 0))
}

/** 规范化专业换底参数，避免异常输入造成蒙版计算过载，喵~ */
export function normalizeBackgroundTuning(tuning?: Partial<BackgroundTuning>): BackgroundTuning {
  return {
    edgeShiftPx: Math.round(clamp(tuning?.edgeShiftPx ?? 0, -8, 8)),
    edgeHardness: Math.round(clamp(tuning?.edgeHardness ?? 0, 0, 100)),
    featherPx: Math.round(clamp(tuning?.featherPx ?? 0, 0, 8) * 2) / 2,
    decontaminate: Math.round(clamp(tuning?.decontaminate ?? 0, 0, 100)),
  }
}

/** 判断参数是否保持模型原始透明蒙版，喵~ */
export function isDefaultBackgroundTuning(tuning?: Partial<BackgroundTuning>): boolean {
  const normalized = normalizeBackgroundTuning(tuning)
  return normalized.edgeShiftPx === 0
    && normalized.edgeHardness === 0
    && normalized.featherPx === 0
    && normalized.decontaminate === 0
}
