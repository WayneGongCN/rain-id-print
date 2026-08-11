import { assertLayoutDimensions, computeCoverCrop, mmToPixels } from './geometry'
import type { LayoutItem, LayoutPlan, LayoutRequest, PaperOrientation, PhotoLayoutInput, SizeMm } from './types'

interface GridCandidate {
  orientation: PaperOrientation
  paper: SizeMm
  cols: number
  rows: number
  capacity: number
  count: number
  emptySlots: number
  aspectPenalty: number
  gapMm: number
}

/** 根据最终纸张宽高返回用户可理解的横纵方向，喵~ */
function getOrientation(paper: SizeMm): PaperOrientation {
  return paper.width >= paper.height ? 'landscape' : 'portrait'
}

/** 计算一个方向上可放置的最大行列数，间距只计入照片之间，喵~ */
function calculateCapacity(paper: SizeMm, photo: SizeMm, gapMm: number): { cols: number; rows: number; capacity: number } {
  const cols = Math.max(0, Math.floor((paper.width + gapMm) / (photo.width + gapMm)))
  const rows = Math.max(0, Math.floor((paper.height + gapMm) / (photo.height + gapMm)))
  return { cols, rows, capacity: cols * rows }
}

/** 为自动数量或指定数量创建一个方向的最佳网格候选，喵~ */
function createCandidate(
  orientation: PaperOrientation,
  paper: SizeMm,
  photo: SizeMm,
  gapMm: number,
  requestedCount: number | 'auto',
): GridCandidate {
  const maximum = calculateCapacity(paper, photo, gapMm)

  if (requestedCount === 'auto') {
    return {
      orientation,
      paper,
      ...maximum,
      count: maximum.capacity,
      emptySlots: 0,
      aspectPenalty: 0,
      gapMm,
    }
  }

  const count = Math.min(requestedCount, maximum.capacity)
  let bestCols = Math.min(maximum.cols, Math.max(1, count))
  let bestRows = count === 0 ? 0 : Math.ceil(count / bestCols)
  let bestScore = Number.POSITIVE_INFINITY

  for (let cols = 1; cols <= Math.min(maximum.cols, Math.max(1, count)); cols += 1) {
    const rows = count === 0 ? 0 : Math.ceil(count / cols)
    if (rows > maximum.rows) {
      continue
    }

    const gridWidth = cols * photo.width + Math.max(0, cols - 1) * gapMm
    const gridHeight = rows * photo.height + Math.max(0, rows - 1) * gapMm
    const emptySlots = cols * rows - count
    const aspectPenalty = Math.abs(gridWidth / Math.max(gridHeight, 1) - paper.width / paper.height)
    const score = emptySlots * 1000 + aspectPenalty

    if (score < bestScore) {
      bestScore = score
      bestCols = cols
      bestRows = rows
    }
  }

  return {
    orientation,
    paper,
    cols: bestCols,
    rows: bestRows,
    capacity: maximum.capacity,
    count,
    emptySlots: bestCols * bestRows - count,
    aspectPenalty: bestScore % 1000,
    gapMm,
  }
}

/** 比较两个网格候选，优先数量、空位、纸张适配度和原方向，喵~ */
function compareCandidates(left: GridCandidate, right: GridCandidate): number {
  if (left.count !== right.count) return right.count - left.count
  if (left.capacity !== right.capacity) return right.capacity - left.capacity
  if (left.emptySlots !== right.emptySlots) return left.emptySlots - right.emptySlots
  if (left.aspectPenalty !== right.aspectPenalty) return left.aspectPenalty - right.aspectPenalty
  return left.orientation === 'portrait' ? -1 : 1
}

/** 根据候选网格生成逐行居中的照片坐标，喵~ */
function createGridItems(candidate: GridCandidate, photo: PhotoLayoutInput): LayoutItem[] {
  const crop = computeCoverCrop(
    { width: photo.sourceWidthPx, height: photo.sourceHeightPx },
    { width: photo.width, height: photo.height },
  )
  const totalRows = Math.ceil(candidate.count / candidate.cols)
  const blockHeight = totalRows * photo.height + Math.max(0, totalRows - 1) * candidate.gapMm
  const yStart = (candidate.paper.height - blockHeight) / 2
  const items: LayoutItem[] = []

  for (let row = 0; row < totalRows; row += 1) {
    const rowCount = Math.min(candidate.cols, candidate.count - row * candidate.cols)
    const rowWidth = rowCount * photo.width + Math.max(0, rowCount - 1) * candidate.gapMm
    const xStart = (candidate.paper.width - rowWidth) / 2

    for (let col = 0; col < rowCount; col += 1) {
      const index = row * candidate.cols + col
      items.push({
        instanceId: `${photo.id}-${index + 1}`,
        photoId: photo.id,
        x: xStart + col * (photo.width + candidate.gapMm),
        y: yStart + row * (photo.height + candidate.gapMm),
        width: photo.width,
        height: photo.height,
        crop,
        background: photo.background,
      })
    }
  }

  return items
}

/** 创建单照片自动铺满或指定数量的布局计划，喵~ */
export function createSinglePhotoLayout(request: LayoutRequest): LayoutPlan {
  const photo = request.photos[0]
  if (!photo) {
    throw new RangeError('单照片布局至少需要一张照片')
  }

  assertLayoutDimensions(request.paper, [photo], request.gapMm)
  const requestedCount = request.mode === 'single-auto' ? 'auto' : Math.max(1, Math.floor(request.targetCount ?? photo.copies))
  const portraitPaper = { width: request.paper.width, height: request.paper.height }
  const landscapePaper = { width: request.paper.height, height: request.paper.width }
  const candidates = [
    createCandidate(getOrientation(portraitPaper), portraitPaper, photo, request.gapMm, requestedCount),
    createCandidate(getOrientation(landscapePaper), landscapePaper, photo, request.gapMm, requestedCount),
  ].sort(compareCandidates)
  const selected = candidates[0]

  if (!selected) {
    throw new Error('无法生成照片布局')
  }

  const items = createGridItems(selected, photo)
  const actualRequestedCount = requestedCount === 'auto' ? selected.count : requestedCount
  const rejectedCount = Math.max(0, actualRequestedCount - selected.count)
  const photoArea = items.reduce((sum, item) => sum + item.width * item.height, 0)

  return {
    version: 1,
    mode: request.mode,
    dpi: request.dpi,
    orientation: selected.orientation,
    paper: selected.paper,
    pixelSize: {
      width: mmToPixels(selected.paper.width, request.dpi),
      height: mmToPixels(selected.paper.height, request.dpi),
    },
    gapMm: request.gapMm,
    items,
    rejected: rejectedCount > 0 ? [{ photoId: photo.id, count: rejectedCount, reason: 'overflow' }] : [],
    placedCount: items.length,
    requestedCount: actualRequestedCount,
    utilization: photoArea / (selected.paper.width * selected.paper.height),
  }
}
