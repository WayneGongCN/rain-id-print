import type { BackgroundMode, BackgroundTuning, NormalizedCrop, PhotoSpec } from '@rainnear/core'
import type { H5ImageAsset } from '@rainnear/plateform-h5'

export interface AppPhoto extends H5ImageAsset {
  spec: PhotoSpec
  crop: NormalizedCrop
  outputDpi: number
  copies: number
  background: BackgroundMode
  tuning: BackgroundTuning
  professionalOpen: boolean
  processingText?: string
}

export type UploadMode = 'single' | 'mixed'

export type EditorStep = 'process' | 'crop' | 'layout'

export interface ModelSwitchProgress {
  modelName: string
  current: number
  total: number
  detail: string
}
