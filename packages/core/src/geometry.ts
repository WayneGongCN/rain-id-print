import type { NormalizedCrop, SizeMm } from './types'

/** 将毫米尺寸稳定换算为输出像素，避免累计截断误差，喵~ */
export function mmToPixels(mm: number, dpi: number): number {
  if (!Number.isFinite(mm) || mm < 0 || !Number.isFinite(dpi) || dpi <= 0) {
    throw new RangeError('毫米和 DPI 必须是有效正数')
  }

  return Math.round((mm * dpi) / 25.4)
}

/** 计算等价于 object-fit cover 的归一化居中裁切框，喵~ */
export function computeCoverCrop(source: SizeMm, target: SizeMm): NormalizedCrop {
  if (source.width <= 0 || source.height <= 0 || target.width <= 0 || target.height <= 0) {
    throw new RangeError('源图和目标尺寸必须大于零')
  }

  const sourceRatio = source.width / source.height
  const targetRatio = target.width / target.height

  if (sourceRatio > targetRatio) {
    const width = targetRatio / sourceRatio
    return { x: (1 - width) / 2, y: 0, width, height: 1 }
  }

  const height = sourceRatio / targetRatio
  return { x: 0, y: (1 - height) / 2, width: 1, height }
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

