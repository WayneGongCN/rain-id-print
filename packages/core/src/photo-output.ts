import { mmToPixels, normalizeAndValidateCrop } from './geometry'
import type { PhotoOutputPlan, PhotoOutputRequest } from './types'

/** 创建可供任意平台渲染的单张业务规格照片输出计划，喵~ */
export function createPhotoOutputPlan(request: PhotoOutputRequest): PhotoOutputPlan {
  if (!request.photoId) throw new RangeError('照片标识不能为空')
  if (!Number.isFinite(request.dpi) || request.dpi <= 0) throw new RangeError('输出 DPI 必须是有效正数')
  if (!Number.isFinite(request.sourceWidthPx) || !Number.isFinite(request.sourceHeightPx)
    || request.sourceWidthPx <= 0 || request.sourceHeightPx <= 0) {
    throw new RangeError('源图尺寸必须是有效正数')
  }

  const physicalSize = { width: request.spec.width, height: request.spec.height }
  const crop = normalizeAndValidateCrop(
    request.crop,
    { width: request.sourceWidthPx, height: request.sourceHeightPx },
    physicalSize,
  )
  return {
    version: 1,
    dpi: request.dpi,
    physicalSize,
    pixelSize: {
      width: mmToPixels(physicalSize.width, request.dpi),
      height: mmToPixels(physicalSize.height, request.dpi),
    },
    item: {
      photoId: request.photoId,
      crop,
      background: request.background,
    },
  }
}
