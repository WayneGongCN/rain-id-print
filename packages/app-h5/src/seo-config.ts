import type { BackgroundMode } from '@rainnear/core'

export type SeoQuickFlowId = 'one-inch' | 'print-layout' | 'background'
export type SeoQuickOutputType = 'single-photo' | 'print-layout'
export type SeoQuickPhotoSpecId = 'one-inch' | 'two-inch'

export interface SeoQuickFlowDefinition {
  id: SeoQuickFlowId
  path: `/${string}/`
  title: string
  description: string
  updatedAt: string
  heading: string
  eyebrow: string
  summary: string
  uploadLabel: string
  outputType: SeoQuickOutputType
  allowedPhotoSpecIds: readonly SeoQuickPhotoSpecId[]
  defaultPhotoSpecId: 'one-inch'
  defaultBackground: Extract<BackgroundMode, 'white'>
  backgroundRemovalModelId: 'quality'
  dpi: 600
  paperSpecId?: '6r'
  gapMm?: 2
}

export const SEO_QUICK_FLOW_DEFINITIONS: readonly SeoQuickFlowDefinition[] = [
  {
    id: 'one-inch',
    path: '/one-inch-photo/',
    title: '一寸照片尺寸与制作｜25×35mm、600 DPI｜雨邻证照',
    description: '在线制作一寸证件照，默认白底、25×35mm、600 DPI，上传后自动使用高清模型本地抠图，照片不上传服务器。',
    updatedAt: '2026-08-21',
    heading: '一寸照片在线制作，上传后直接下载',
    eyebrow: '25 × 35 MM · 600 DPI · LOCAL PROCESSING',
    summary: '选择一张照片后自动完成高清抠图、白底替换和一寸裁切，无需选择模型或填写 DPI。',
    uploadLabel: '选择照片，自动制作一寸照',
    outputType: 'single-photo',
    allowedPhotoSpecIds: ['one-inch'],
    defaultPhotoSpecId: 'one-inch',
    defaultBackground: 'white',
    backgroundRemovalModelId: 'quality',
    dpi: 600,
  },
  {
    id: 'print-layout',
    path: '/id-photo-print-layout/',
    title: '证件照6寸排版｜一寸12张、二寸8张、600 DPI｜雨邻证照',
    description: '证件照在线排版到6寸相纸，默认一寸12张、二寸8张、2mm间距和600 DPI，照片在浏览器本地处理。',
    updatedAt: '2026-08-21',
    heading: '证件照自动排成 6 寸冲印图',
    eyebrow: '6R PAPER · AUTO LAYOUT · 600 DPI',
    summary: '上传后默认生成一寸 12 张的 6 寸排版图，也可一键切换为二寸 8 张，无需设置纸张、数量或间距。',
    uploadLabel: '选择照片，自动生成6寸排版',
    outputType: 'print-layout',
    allowedPhotoSpecIds: ['one-inch', 'two-inch'],
    defaultPhotoSpecId: 'one-inch',
    defaultBackground: 'white',
    backgroundRemovalModelId: 'quality',
    dpi: 600,
    paperSpecId: '6r',
    gapMm: 2,
  },
  {
    id: 'background',
    path: '/id-photo-background/',
    title: '证件照在线换底色｜白底、蓝底、红底，本地处理｜雨邻证照',
    description: '在线为证件照更换白、蓝、红、灰底色，上传后自动使用高清模型本地抠图，默认白底和600 DPI，照片不上传。',
    updatedAt: '2026-08-21',
    heading: '证件照换底色，照片只在本地处理',
    eyebrow: 'WHITE · BLUE · RED · GRAY · PRIVATE',
    summary: '上传后立即使用高清模型抠图并生成白底结果，之后切换蓝、红、灰底色无需再次处理。',
    uploadLabel: '选择照片，自动生成白底证件照',
    outputType: 'single-photo',
    allowedPhotoSpecIds: ['one-inch', 'two-inch'],
    defaultPhotoSpecId: 'one-inch',
    defaultBackground: 'white',
    backgroundRemovalModelId: 'quality',
    dpi: 600,
  },
]

/** 按稳定标识读取 SEO 极速流程，未知标识返回空，喵~ */
export function getSeoQuickFlowDefinition(id: string): SeoQuickFlowDefinition | undefined {
  return SEO_QUICK_FLOW_DEFINITIONS.find((definition) => definition.id === id)
}
