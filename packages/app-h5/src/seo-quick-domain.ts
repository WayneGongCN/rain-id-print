import {
  createLayout,
  createPhotoOutputPlan,
  getPaperSpec,
  getPhotoSpec,
  type LayoutPlan,
  type PhotoOutputPlan,
} from '@rainnear/core'
import type { H5ImageAsset } from '@rainnear/plateform-h5'
import type { AppPhoto } from './editor-types'
import { createInitialAppPhoto, retargetAppPhoto } from './photo-output-settings'
import type { SeoQuickFlowDefinition, SeoQuickPhotoSpecId } from './seo-config'

export const SEO_QUICK_SEPARATOR_COLOR = '#334155'

/** 按极速流程的固定规格和 600 DPI 初始化一张本地照片，喵~ */
export function createSeoQuickPhoto(asset: H5ImageAsset, specId: SeoQuickPhotoSpecId): AppPhoto {
  const spec = getPhotoSpec(specId)
  if (!spec) throw new Error(`缺少极速照片规格 ${specId}`)
  const retargeted = retargetAppPhoto(createInitialAppPhoto(asset), spec)
  return { ...retargeted, outputDpi: 600, background: 'keep' }
}

/** 切换极速流程允许的一寸或二寸规格，并保持 600 DPI，喵~ */
export function retargetSeoQuickPhoto(photo: AppPhoto, specId: SeoQuickPhotoSpecId): AppPhoto {
  const spec = getPhotoSpec(specId)
  if (!spec) throw new Error(`缺少极速照片规格 ${specId}`)
  return { ...retargetAppPhoto(photo, spec), outputDpi: 600 }
}

/** 创建极速单张照片输出计划，喵~ */
export function createSeoQuickPhotoPlan(photo: AppPhoto): PhotoOutputPlan {
  return createPhotoOutputPlan({
    photoId: photo.id,
    sourceWidthPx: photo.width,
    sourceHeightPx: photo.height,
    spec: photo.spec,
    dpi: 600,
    crop: photo.crop,
    background: photo.background,
  })
}

/** 使用固定 6 寸、2mm 间距和自动铺满创建极速排版计划，喵~ */
export function createSeoQuickLayout(photo: AppPhoto, flow: SeoQuickFlowDefinition): LayoutPlan {
  const paper = getPaperSpec(flow.paperSpecId ?? '6r')
  if (!paper) throw new Error('缺少极速排版纸张规格')
  return createLayout({
    mode: 'single-auto',
    paper,
    photos: [{
      id: photo.id,
      sourceWidthPx: photo.width,
      sourceHeightPx: photo.height,
      width: photo.spec.width,
      height: photo.spec.height,
      copies: 1,
      background: photo.background,
      crop: photo.crop,
    }],
    gapMm: flow.gapMm ?? 2,
    dpi: flow.dpi,
  })
}
