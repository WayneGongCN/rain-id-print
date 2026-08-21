import type { PhotoSpec } from '@rainnear/core'
import { DEFAULT_EXPORT_DPI } from './export-settings'

export const MIN_CUSTOM_PHOTO_SIZE_MM = 1
export const MAX_CUSTOM_PHOTO_SIZE_MM = 500

/** 将自定义尺寸输入解析为允许范围内的整数毫米值，喵~ */
export function parseCustomPhotoDimension(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < MIN_CUSTOM_PHOTO_SIZE_MM || parsed > MAX_CUSTOM_PHOTO_SIZE_MM) {
    return undefined
  }
  return parsed
}

/** 根据规范化宽高生成可在本次会话稳定复用的自定义规格标识，喵~ */
export function createCustomPhotoSpecId(width: number, height: number): string {
  return `custom-${width}x${height}-mm`
}

/** 创建符合应用规则的会话级自定义照片规格，喵~ */
export function createCustomPhotoSpec(width: number, height: number): PhotoSpec {
  const validWidth = parseCustomPhotoDimension(String(width))
  const validHeight = parseCustomPhotoDimension(String(height))
  if (validWidth === undefined || validHeight === undefined) {
    throw new RangeError(`自定义照片宽高必须是 ${MIN_CUSTOM_PHOTO_SIZE_MM}–${MAX_CUSTOM_PHOTO_SIZE_MM} 的整数毫米值`)
  }
  return {
    id: createCustomPhotoSpecId(validWidth, validHeight),
    name: '自定义',
    width: validWidth,
    height: validHeight,
    category: 'photo',
    group: 'custom',
    recommendedDpi: DEFAULT_EXPORT_DPI,
  }
}

/** 从会话规格中读取相同宽高的自定义规格，不存在时创建新规格，喵~ */
export function resolveCustomPhotoSpec(
  specs: readonly PhotoSpec[],
  width: number,
  height: number,
): { spec: PhotoSpec; isNew: boolean } {
  const created = createCustomPhotoSpec(width, height)
  const existing = specs.find((spec) => spec.id === created.id && spec.group === 'custom')
  return existing ? { spec: existing, isNew: false } : { spec: created, isNew: true }
}

/** 生成规格选择器和预览摘要统一使用的可读标签，喵~ */
export function formatPhotoSpecLabel(spec: PhotoSpec): string {
  return `${spec.name} · ${spec.width}×${spec.height}mm`
}

/** 将自定义规格映射为固定分析值，避免发送会话尺寸标识，喵~ */
export function getAnalyticsPhotoSpecId(spec: PhotoSpec): string {
  return spec.group === 'custom' ? 'custom' : spec.id
}
