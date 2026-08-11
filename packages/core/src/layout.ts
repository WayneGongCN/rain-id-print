import { createMixedPhotoLayout } from './mixed-layout'
import { createSinglePhotoLayout } from './single-layout'
import type { LayoutPlan, LayoutRequest } from './types'

/** 根据布局模式分发到单图或混排求解器，喵~ */
export function createLayout(request: LayoutRequest): LayoutPlan {
  if (request.mode === 'mixed') return createMixedPhotoLayout(request)
  return createSinglePhotoLayout(request)
}

