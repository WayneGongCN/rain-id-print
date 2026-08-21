import type { NormalizedCrop, SizeMm } from './types'

export interface NormalizedPoint {
  x: number
  y: number
}

export const MAX_CROP_ZOOM = 4

const CROP_EPSILON = 1e-6

/** 将数值限制在指定闭区间内，喵~ */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** 校验尺寸包含有效正数，喵~ */
function assertPositiveSize(size: SizeMm, label: string): void {
  if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) {
    throw new RangeError(`${label}尺寸必须是有效正数`)
  }
}

/** 将毫米尺寸稳定换算为输出像素，避免累计截断误差，喵~ */
export function mmToPixels(mm: number, dpi: number): number {
  if (!Number.isFinite(mm) || mm < 0 || !Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('毫米和 DPI 必须是有效正数')
  }

  return Math.round((mm * dpi) / 25.4)
}

/** 计算等价于 object-fit cover 的归一化居中裁切框，喵~ */
export function computeCoverCrop(source: SizeMm, target: SizeMm): NormalizedCrop {
  assertPositiveSize(source, '源图')
  assertPositiveSize(target, '目标')

  const sourceRatio = source.width / source.height
  const targetRatio = target.width / target.height

  if (sourceRatio > targetRatio) {
    const width = targetRatio / sourceRatio
    return { x: (1 - width) / 2, y: 0, width, height: 1 }
  }

  const height = sourceRatio / targetRatio
  return { x: 0, y: (1 - height) / 2, width: 1, height }
}

/** 将裁切框限制在归一化图片边界内，喵~ */
export function normalizeCrop(crop: NormalizedCrop): NormalizedCrop {
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) {
    throw new RangeError('裁切参数必须是有限数值')
  }
  if (crop.width <= 0 || crop.height <= 0) {
    throw new RangeError('裁切宽高必须大于零')
  }

  const width = Math.min(1, crop.width)
  const height = Math.min(1, crop.height)
  return {
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
    width,
    height,
  }
}

/** 判断裁切框是否位于图片内部且与目标规格比例一致，喵~ */
export function isValidCrop(crop: NormalizedCrop, source: SizeMm, target: SizeMm): boolean {
  try {
    assertPositiveSize(source, '源图')
    assertPositiveSize(target, '目标')
    if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) return false
    if (crop.x < -CROP_EPSILON || crop.y < -CROP_EPSILON || crop.width <= 0 || crop.height <= 0) return false
    if (crop.x + crop.width > 1 + CROP_EPSILON || crop.y + crop.height > 1 + CROP_EPSILON) return false
    const cropRatio = (crop.width * source.width) / (crop.height * source.height)
    const targetRatio = target.width / target.height
    return Math.abs(cropRatio - targetRatio) / targetRatio <= CROP_EPSILON
  } catch {
    return false
  }
}

/** 归一化裁切框并验证它能准确输出目标比例，喵~ */
export function normalizeAndValidateCrop(crop: NormalizedCrop, source: SizeMm, target: SizeMm): NormalizedCrop {
  const normalized = normalizeCrop(crop)
  if (!isValidCrop(normalized, source, target)) {
    throw new RangeError('裁切框与目标规格比例不一致')
  }
  return normalized
}

/** 根据焦点和缩放倍数创建目标比例裁切框，喵~ */
export function createZoomedCrop(
  source: SizeMm,
  target: SizeMm,
  focus: NormalizedPoint,
  zoom: number,
): NormalizedCrop {
  assertPositiveSize(source, '源图')
  assertPositiveSize(target, '目标')
  if (!Number.isFinite(focus.x) || !Number.isFinite(focus.y)) {
    throw new RangeError('裁切焦点必须是有限数值')
  }
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > MAX_CROP_ZOOM) {
    throw new RangeError(`裁切缩放必须在 1–${MAX_CROP_ZOOM} 之间`)
  }

  const base = computeCoverCrop(source, target)
  const width = base.width / zoom
  const height = base.height / zoom
  return normalizeCrop({
    x: clamp(focus.x, 0, 1) - width / 2,
    y: clamp(focus.y, 0, 1) - height / 2,
    width,
    height,
  })
}

/** 围绕裁切视口中的指定锚点修改缩放，并保持锚点对应的源图位置稳定，喵~ */
export function zoomCropAtPoint(
  source: SizeMm,
  target: SizeMm,
  crop: NormalizedCrop,
  zoom: number,
  anchor: NormalizedPoint,
): NormalizedCrop {
  assertPositiveSize(source, '源图')
  assertPositiveSize(target, '目标')
  if (!Number.isFinite(zoom) || zoom < 1 || zoom > MAX_CROP_ZOOM) {
    throw new RangeError(`裁切缩放必须在 1–${MAX_CROP_ZOOM} 之间`)
  }
  if (
    !Number.isFinite(anchor.x)
    || !Number.isFinite(anchor.y)
    || anchor.x < 0
    || anchor.x > 1
    || anchor.y < 0
    || anchor.y > 1
  ) {
    throw new RangeError('缩放锚点必须位于裁切视口内')
  }

  const normalized = normalizeAndValidateCrop(crop, source, target)
  const base = computeCoverCrop(source, target)
  const width = base.width / zoom
  const height = base.height / zoom
  const sourceAnchorX = normalized.x + normalized.width * anchor.x
  const sourceAnchorY = normalized.y + normalized.height * anchor.y
  return normalizeCrop({
    x: sourceAnchorX - width * anchor.x,
    y: sourceAnchorY - height * anchor.y,
    width,
    height,
  })
}

/** 从裁切框反推出相对于居中 cover 的缩放倍数，喵~ */
export function getCropZoom(source: SizeMm, target: SizeMm, crop: NormalizedCrop): number {
  const normalized = normalizeAndValidateCrop(crop, source, target)
  const base = computeCoverCrop(source, target)
  return clamp((base.width / normalized.width + base.height / normalized.height) / 2, 1, MAX_CROP_ZOOM)
}

/** 平移裁切框并确保它不会越过图片边界，喵~ */
export function translateCrop(crop: NormalizedCrop, deltaX: number, deltaY: number): NormalizedCrop {
  if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) {
    throw new RangeError('裁切位移必须是有限数值')
  }
  return normalizeCrop({ ...crop, x: crop.x + deltaX, y: crop.y + deltaY })
}

/** 切换目标规格时保留原裁切焦点和相对缩放，喵~ */
export function retargetCrop(
  source: SizeMm,
  oldTarget: SizeMm,
  newTarget: SizeMm,
  crop: NormalizedCrop,
): NormalizedCrop {
  const normalized = normalizeAndValidateCrop(crop, source, oldTarget)
  const zoom = getCropZoom(source, oldTarget, normalized)
  return createZoomedCrop(source, newTarget, {
    x: normalized.x + normalized.width / 2,
    y: normalized.y + normalized.height / 2,
  }, zoom)
}

/** 校验纸张、照片与间距是否可用于布局计算，喵~ */
export function assertLayoutDimensions(paper: SizeMm, photos: SizeMm[], gapMm: number): void {
  if (paper.width <= 0 || paper.height <= 0) {
    throw new RangeError('纸张尺寸必须大于零')
  }

  if (!Number.isFinite(gapMm) || gapMm < 0) {
    throw new RangeError('照片间距不能小于零')
  }

  if (photos.some((photo) => photo.width <= 0 || photo.height <= 0)) {
    throw new RangeError('照片尺寸必须大于零')
  }
}
