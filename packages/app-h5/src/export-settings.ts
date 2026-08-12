import { getPhotoSpec, type LayoutPlan } from '@rainnear/core'

export const DEFAULT_EXPORT_DPI = 300
export const MIN_EXPORT_DPI = 72
export const MAX_EXPORT_DPI = 600
export const MAX_H5_EXPORT_PIXELS = 25_000_000

export interface PhotoPresetSelection {
  presetId: string
}

/** 返回当前排版模式实际参与输出的照片，喵~ */
export function getActivePhotoSelections<T>(photos: readonly T[], mode: 'single' | 'mixed'): readonly T[] {
  return mode === 'single' ? photos.slice(0, 1) : photos
}

/** 读取有效照片预设中的最高建议 DPI，无照片时返回默认值，喵~ */
export function getRecommendedExportDpi(
  photos: readonly PhotoPresetSelection[],
  mode: 'single' | 'mixed',
): number {
  return getActivePhotoSelections(photos, mode).reduce((maximum, photo) => {
    const recommendedDpi = getPhotoSpec(photo.presetId)?.recommendedDpi ?? DEFAULT_EXPORT_DPI
    return Math.max(maximum, recommendedDpi)
  }, DEFAULT_EXPORT_DPI)
}

/** 只在建议值更高时提高 DPI，避免移除高精度预设后意外降低用户设置，喵~ */
export function raiseExportDpi(currentDpi: number, recommendedDpi: number): number {
  return Math.max(currentDpi, recommendedDpi)
}

/** 将用户输入解析为允许范围内的整数 DPI，输入未完成时返回空，喵~ */
export function parseExportDpi(value: string): number | undefined {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < MIN_EXPORT_DPI || parsed > MAX_EXPORT_DPI) return undefined
  return parsed
}

/** 当输出精度低于当前照片建议值时生成非阻断提示，喵~ */
export function getDpiRecommendationWarning(exportDpi: number, recommendedDpi: number): string | undefined {
  if (exportDpi >= recommendedDpi) return undefined
  return `当前 ${exportDpi} DPI 低于所选证件建议的 ${recommendedDpi} DPI，可能影响冲印清晰度或材料受理。`
}

/** 返回布局是否超过 H5 高分辨率 Canvas 的安全像素限制，喵~ */
export function getExportPixelWarning(
  pixelSize: LayoutPlan['pixelSize'] | undefined,
  limit = MAX_H5_EXPORT_PIXELS,
): string | undefined {
  if (!pixelSize) return undefined
  const pixels = pixelSize.width * pixelSize.height
  if (pixels <= limit) return undefined
  return `当前纸张与 DPI 将生成 ${(pixels / 1_000_000).toFixed(1)}MP 图片，超过 H5 ${Math.round(limit / 1_000_000)}MP 安全上限，请降低 DPI 或更换纸张。`
}
