import {
  DEFAULT_BACKGROUND_TUNING,
  PHOTO_SPECS,
  computeCoverCrop,
  getPhotoSpec,
  retargetCrop,
  type PhotoSpec,
} from '@rainnear/core'
import type { H5ImageAsset } from '@rainnear/plateform-h5'
import { DEFAULT_EXPORT_DPI, raiseExportDpi } from './export-settings'
import type { AppPhoto } from './editor-types'

/** 将平台图片初始化为带默认规格和居中裁切的应用照片，喵~ */
export function createInitialAppPhoto(asset: H5ImageAsset): AppPhoto {
  const defaultSpec = getPhotoSpec('one-inch') ?? PHOTO_SPECS[0]
  if (!defaultSpec) throw new Error('缺少默认照片规格')
  return {
    ...asset,
    presetId: defaultSpec.id,
    crop: computeCoverCrop({ width: asset.width, height: asset.height }, defaultSpec),
    outputDpi: DEFAULT_EXPORT_DPI,
    copies: 1,
    background: 'keep',
    tuning: { ...DEFAULT_BACKGROUND_TUNING },
    professionalOpen: false,
  }
}

/** 切换业务规格并保留照片焦点、相对缩放和更高的既有 DPI，喵~ */
export function retargetAppPhoto(photo: AppPhoto, presetId: string): AppPhoto {
  const oldSpec = getPhotoSpec(photo.presetId)
  const spec = getPhotoSpec(presetId)
  if (!oldSpec || !spec || oldSpec.id === spec?.id) return photo
  return {
    ...photo,
    presetId,
    crop: retargetCrop({ width: photo.width, height: photo.height }, oldSpec, spec, photo.crop),
    outputDpi: raiseExportDpi(photo.outputDpi, spec.recommendedDpi),
  }
}

/** 将文件名转换为适合浏览器下载的安全片段，喵~ */
function sanitizeFilename(name: string): string {
  const withoutExtension = name.replace(/\.[^.]+$/, '')
  return withoutExtension.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'photo'
}

/** 生成包含规格、物理尺寸和 DPI 的单张成片文件名，喵~ */
export function createPhotoDownloadFilename(photo: AppPhoto, spec: PhotoSpec): string {
  return `rainnear_${sanitizeFilename(photo.name)}_${spec.name}_${spec.width}x${spec.height}mm_${photo.outputDpi}dpi.jpg`
}
