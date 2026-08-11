export type BackgroundMode = 'keep' | 'white' | 'blue' | 'red' | 'gray'

export type LayoutMode = 'single-auto' | 'single-count' | 'mixed'

export type PaperOrientation = 'portrait' | 'landscape'

export interface SizeMm {
  width: number
  height: number
}

export interface NormalizedCrop {
  x: number
  y: number
  width: number
  height: number
}

export interface PhotoSpec extends SizeMm {
  id: string
  name: string
  category: 'photo'
}

export interface PaperSpec extends SizeMm {
  id: string
  name: string
  category: 'paper'
}

export interface PhotoLayoutInput extends SizeMm {
  id: string
  sourceWidthPx: number
  sourceHeightPx: number
  copies: number
  background: BackgroundMode
}

export interface LayoutRequest {
  mode: LayoutMode
  paper: PaperSpec
  photos: PhotoLayoutInput[]
  gapMm: number
  dpi: number
  targetCount?: number
}

export interface LayoutItem extends SizeMm {
  instanceId: string
  photoId: string
  x: number
  y: number
  crop: NormalizedCrop
  background: BackgroundMode
}

export interface RejectedPhoto {
  photoId: string
  count: number
  reason: 'overflow' | 'invalid-size'
}

export interface LayoutPlan {
  version: 1
  mode: LayoutMode
  dpi: number
  orientation: PaperOrientation
  paper: SizeMm
  pixelSize: SizeMm
  gapMm: number
  items: LayoutItem[]
  rejected: RejectedPhoto[]
  placedCount: number
  requestedCount: number
  utilization: number
}

