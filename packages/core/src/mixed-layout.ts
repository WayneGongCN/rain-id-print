import { assertLayoutDimensions, computeCoverCrop, mmToPixels, normalizeAndValidateCrop } from './geometry'
import type { LayoutItem, LayoutPlan, LayoutRequest, PaperOrientation, PhotoLayoutInput, SizeMm } from './types'

interface PackInput extends SizeMm {
  instanceId: string
  photo: PhotoLayoutInput
}

interface Rect extends SizeMm {
  x: number
  y: number
}

interface PackedItem extends PackInput {
  x: number
  y: number
}

interface PackResult {
  orientation: PaperOrientation
  paper: SizeMm
  placed: PackedItem[]
  rejected: PackInput[]
  usedArea: number
}

/** 根据最终纸张宽高返回用户可理解的横纵方向，喵~ */
function getOrientation(paper: SizeMm): PaperOrientation {
  return paper.width >= paper.height ? 'landscape' : 'portrait'
}

/** 判断两个矩形是否存在有效面积交集，喵~ */
function intersects(left: Rect, right: Rect): boolean {
  return !(right.x >= left.x + left.width || right.x + right.width <= left.x || right.y >= left.y + left.height || right.y + right.height <= left.y)
}

/** 判断外层矩形是否完整包含内层矩形，喵~ */
function contains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height
}

/** 按已放矩形切割一个相交的空闲区域，喵~ */
function splitFreeRect(free: Rect, used: Rect): Rect[] {
  if (!intersects(free, used)) return [free]

  const result: Rect[] = []
  if (used.x > free.x) result.push({ x: free.x, y: free.y, width: used.x - free.x, height: free.height })
  if (used.x + used.width < free.x + free.width) {
    result.push({ x: used.x + used.width, y: free.y, width: free.x + free.width - used.x - used.width, height: free.height })
  }
  if (used.y > free.y) result.push({ x: free.x, y: free.y, width: free.width, height: used.y - free.y })
  if (used.y + used.height < free.y + free.height) {
    result.push({ x: free.x, y: used.y + used.height, width: free.width, height: free.y + free.height - used.y - used.height })
  }
  return result.filter((rect) => rect.width > 0 && rect.height > 0)
}

/** 移除被其他空闲矩形完整包含的冗余区域，喵~ */
function pruneFreeRects(rects: Rect[]): Rect[] {
  return rects.filter((rect, index) => !rects.some((other, otherIndex) => index !== otherIndex && contains(other, rect)))
}

/** 在一个纸张方向上执行不旋转照片的 MaxRects BSSF 排版，喵~ */
function packForOrientation(inputs: PackInput[], paper: SizeMm, orientation: PaperOrientation, gapMm: number): PackResult {
  let freeRects: Rect[] = [{ x: 0, y: 0, width: paper.width + gapMm, height: paper.height + gapMm }]
  const placed: PackedItem[] = []
  const rejected: PackInput[] = []

  for (const input of inputs) {
    const packedWidth = input.width + gapMm
    const packedHeight = input.height + gapMm
    let bestIndex = -1
    let bestShortSide = Number.POSITIVE_INFINITY
    let bestLongSide = Number.POSITIVE_INFINITY

    freeRects.forEach((free, index) => {
      if (packedWidth > free.width || packedHeight > free.height) return
      const leftoverWidth = free.width - packedWidth
      const leftoverHeight = free.height - packedHeight
      const shortSide = Math.min(leftoverWidth, leftoverHeight)
      const longSide = Math.max(leftoverWidth, leftoverHeight)
      if (shortSide < bestShortSide || (shortSide === bestShortSide && longSide < bestLongSide)) {
        bestIndex = index
        bestShortSide = shortSide
        bestLongSide = longSide
      }
    })

    const bestRect = bestIndex >= 0 ? freeRects[bestIndex] : undefined
    if (!bestRect) {
      rejected.push(input)
      continue
    }

    const used: Rect = { x: bestRect.x, y: bestRect.y, width: packedWidth, height: packedHeight }
    placed.push({ ...input, x: used.x, y: used.y })
    freeRects = pruneFreeRects(freeRects.flatMap((free) => splitFreeRect(free, used)))
  }

  const usedWidth = placed.reduce((maximum, item) => Math.max(maximum, item.x + item.width), 0)
  const usedHeight = placed.reduce((maximum, item) => Math.max(maximum, item.y + item.height), 0)
  const offsetX = Math.max(0, (paper.width - usedWidth) / 2)
  const offsetY = Math.max(0, (paper.height - usedHeight) / 2)
  placed.forEach((item) => {
    item.x += offsetX
    item.y += offsetY
  })

  return {
    orientation,
    paper,
    placed,
    rejected,
    usedArea: placed.reduce((sum, item) => sum + item.width * item.height, 0),
  }
}

/** 比较两个混排结果，优先放入数量、利用面积和原纸张方向，喵~ */
function comparePackResults(left: PackResult, right: PackResult): number {
  if (left.placed.length !== right.placed.length) return right.placed.length - left.placed.length
  if (left.usedArea !== right.usedArea) return right.usedArea - left.usedArea
  return left.orientation === 'portrait' ? -1 : 1
}

/** 汇总无法放入纸张的照片份数，喵~ */
function aggregateRejected(inputs: PackInput[]): LayoutPlan['rejected'] {
  const counts = new Map<string, number>()
  inputs.forEach((input) => counts.set(input.photo.id, (counts.get(input.photo.id) ?? 0) + 1))
  return [...counts.entries()].map(([photoId, count]) => ({ photoId, count, reason: 'overflow' as const }))
}

/** 创建多照片、不同尺寸和不同份数的 MaxRects 混排计划，喵~ */
export function createMixedPhotoLayout(request: LayoutRequest): LayoutPlan {
  assertLayoutDimensions(request.paper, request.photos, request.gapMm)
  const expanded = request.photos
    .flatMap((photo) => Array.from({ length: Math.max(0, Math.floor(photo.copies)) }, (_, index) => ({
      instanceId: `${photo.id}-${index + 1}`,
      photo,
      width: photo.width,
      height: photo.height,
    })))
    .sort((left, right) => right.height - left.height || right.width - left.width || left.instanceId.localeCompare(right.instanceId))

  const portraitPaper = { width: request.paper.width, height: request.paper.height }
  const landscapePaper = { width: request.paper.height, height: request.paper.width }
  const result = [
    packForOrientation(expanded, portraitPaper, getOrientation(portraitPaper), request.gapMm),
    packForOrientation(expanded, landscapePaper, getOrientation(landscapePaper), request.gapMm),
  ].sort(comparePackResults)[0]

  if (!result) throw new Error('无法生成混排布局')

  const items: LayoutItem[] = result.placed.map((item) => ({
    instanceId: item.instanceId,
    photoId: item.photo.id,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    crop: item.photo.crop
      ? normalizeAndValidateCrop(
          item.photo.crop,
          { width: item.photo.sourceWidthPx, height: item.photo.sourceHeightPx },
          { width: item.width, height: item.height },
        )
      : computeCoverCrop(
          { width: item.photo.sourceWidthPx, height: item.photo.sourceHeightPx },
          { width: item.width, height: item.height },
        ),
    background: item.photo.background,
  }))

  return {
    version: 1,
    mode: request.mode,
    dpi: request.dpi,
    orientation: result.orientation,
    paper: result.paper,
    pixelSize: {
      width: mmToPixels(result.paper.width, request.dpi),
      height: mmToPixels(result.paper.height, request.dpi),
    },
    gapMm: request.gapMm,
    items,
    rejected: aggregateRejected(result.rejected),
    placedCount: items.length,
    requestedCount: expanded.length,
    utilization: result.usedArea / (result.paper.width * result.paper.height),
  }
}
