import { describe, expect, it } from 'vitest'
import {
  computeCoverCrop,
  createLayout,
  createPhotoOutputPlan,
  createZoomedCrop,
  getCropZoom,
  isValidCrop,
  mmToPixels,
  retargetCrop,
  translateCrop,
  zoomCropAtPoint,
  type LayoutRequest,
} from '../src'

const basePhoto = {
  id: 'alice',
  sourceWidthPx: 1200,
  sourceHeightPx: 1600,
  width: 25,
  height: 35,
  copies: 8,
  background: 'keep' as const,
}

const paper = { id: '6r', name: '6 寸', width: 152, height: 102, category: 'paper' as const }

/** 创建单图测试所需的标准布局请求，喵~ */
function createSingleRequest(overrides: Partial<LayoutRequest> = {}): LayoutRequest {
  return {
    mode: 'single-count',
    paper,
    photos: [basePhoto],
    gapMm: 2,
    dpi: 300,
    targetCount: 8,
    ...overrides,
  }
}

describe('geometry', () => {
  it('使用四舍五入将毫米换算为像素', () => {
    expect(mmToPixels(25.4, 300)).toBe(300)
  })

  it('为横向源图创建水平居中裁切框', () => {
    expect(computeCoverCrop({ width: 200, height: 100 }, { width: 1, height: 1 })).toEqual({
      x: 0.25,
      y: 0,
      width: 0.5,
      height: 1,
    })
  })

  it('按焦点缩放和平移裁切框且不允许越界', () => {
    const source = { width: 1200, height: 1600 }
    const target = { width: 25, height: 35 }
    const crop = createZoomedCrop(source, target, { x: 0.4, y: 0.6 }, 2)

    expect(getCropZoom(source, target, crop)).toBeCloseTo(2)
    expect(translateCrop(crop, -10, 10)).toMatchObject({ x: 0, y: 1 - crop.height })
  })

  it('使用视口锚点缩放时保持对应的源图位置', () => {
    const source = { width: 1200, height: 1600 }
    const target = { width: 25, height: 35 }
    const crop = createZoomedCrop(source, target, { x: 0.45, y: 0.55 }, 1.5)
    const anchors = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 0.3, y: 0.7 }]

    anchors.forEach((anchor) => {
      const expectedSourcePoint = {
        x: crop.x + crop.width * anchor.x,
        y: crop.y + crop.height * anchor.y,
      }
      const zoomed = zoomCropAtPoint(source, target, crop, 2.5, anchor)

      expect(zoomed.x + zoomed.width * anchor.x).toBeCloseTo(expectedSourcePoint.x)
      expect(zoomed.y + zoomed.height * anchor.y).toBeCloseTo(expectedSourcePoint.y)
      expect(getCropZoom(source, target, zoomed)).toBeCloseTo(2.5)
    })
  })

  it('使用视口中心缩放时与现有焦点缩放结果一致', () => {
    const source = { width: 1200, height: 1600 }
    const target = { width: 25, height: 35 }
    const crop = createZoomedCrop(source, target, { x: 0.45, y: 0.55 }, 1.5)
    const focus = { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 }

    expect(zoomCropAtPoint(source, target, crop, 3, { x: 0.5, y: 0.5 })).toEqual(
      createZoomedCrop(source, target, focus, 3),
    )
  })

  it('锚点缩放时遵守图片边界和缩放边界', () => {
    const source = { width: 1200, height: 1600 }
    const target = { width: 25, height: 35 }
    const edgeCrop = createZoomedCrop(source, target, { x: 0, y: 0 }, 2)

    const zoomedOut = zoomCropAtPoint(source, target, edgeCrop, 1, { x: 1, y: 1 })
    expect(getCropZoom(source, target, zoomedOut)).toBeCloseTo(1)
    expect(isValidCrop(zoomedOut, source, target)).toBe(true)
    expect(zoomedOut.x).toBe(0)
    expect(getCropZoom(source, target, zoomCropAtPoint(source, target, edgeCrop, 4, { x: 0, y: 0 }))).toBeCloseTo(4)
  })

  it('拒绝非法的锚点缩放参数', () => {
    const source = { width: 1200, height: 1600 }
    const target = { width: 25, height: 35 }
    const crop = computeCoverCrop(source, target)

    expect(() => zoomCropAtPoint(source, target, crop, 0.9, { x: 0.5, y: 0.5 })).toThrow('1–4')
    expect(() => zoomCropAtPoint(source, target, crop, 2, { x: -0.1, y: 0.5 })).toThrow('锚点')
    expect(() => zoomCropAtPoint({ width: 0, height: 1 }, target, crop, 2, { x: 0.5, y: 0.5 })).toThrow('源图')
  })

  it('切换目标规格时保留焦点和相对缩放', () => {
    const source = { width: 1200, height: 1600 }
    const oldTarget = { width: 25, height: 35 }
    const newTarget = { width: 51, height: 51 }
    const crop = createZoomedCrop(source, oldTarget, { x: 0.45, y: 0.55 }, 1.8)
    const retargeted = retargetCrop(source, oldTarget, newTarget, crop)

    expect(getCropZoom(source, newTarget, retargeted)).toBeCloseTo(1.8)
    expect(retargeted.x + retargeted.width / 2).toBeCloseTo(0.45)
    expect(retargeted.y + retargeted.height / 2).toBeCloseTo(0.55)
  })

  it('拒绝非法缩放和比例不一致的裁切框', () => {
    expect(() => createZoomedCrop(
      { width: 1200, height: 1600 },
      { width: 25, height: 35 },
      { x: 0.5, y: 0.5 },
      5,
    )).toThrow('1–4')

    expect(() => createLayout(createSingleRequest({
      photos: [{ ...basePhoto, crop: { x: 0, y: 0, width: 1, height: 1 } }],
    }))).toThrow('比例不一致')
  })
})

describe('single layout', () => {
  it('严格放置指定数量并保留照片间距', () => {
    const plan = createLayout(createSingleRequest())
    expect(plan.placedCount).toBe(8)
    expect(plan.rejected).toEqual([])
    expect(plan.items.every((item) => item.x >= 0 && item.y >= 0)).toBe(true)
  })

  it('正确处理刚好能放下两张照片的间距边界', () => {
    const plan = createLayout(createSingleRequest({
      paper: { id: 'edge', name: '边界纸张', width: 102, height: 50, category: 'paper' },
      photos: [{ ...basePhoto, width: 50, height: 50 }],
      gapMm: 2,
      targetCount: 2,
    }))
    expect(plan.placedCount).toBe(2)
    expect(plan.rejected).toEqual([])
  })

  it('容量不足时显式返回拒绝份数', () => {
    const plan = createLayout(createSingleRequest({ targetCount: 100 }))
    expect(plan.placedCount).toBeLessThan(100)
    expect(plan.rejected[0]?.count).toBe(100 - plan.placedCount)
  })

  it('将照片自定义裁切框复用到全部排版副本', () => {
    const crop = createZoomedCrop(
      { width: basePhoto.sourceWidthPx, height: basePhoto.sourceHeightPx },
      { width: basePhoto.width, height: basePhoto.height },
      { x: 0.4, y: 0.6 },
      2,
    )
    const plan = createLayout(createSingleRequest({ photos: [{ ...basePhoto, crop }] }))

    expect(plan.items.every((item) => JSON.stringify(item.crop) === JSON.stringify(crop))).toBe(true)
  })
})

describe('mixed layout', () => {
  it('在同一张纸上排列不同尺寸和份数', () => {
    const plan = createLayout({
      mode: 'mixed',
      paper,
      photos: [
        { ...basePhoto, copies: 3 },
        { ...basePhoto, id: 'bob', width: 35, height: 49, copies: 2 },
      ],
      gapMm: 2,
      dpi: 300,
    })
    expect(plan.requestedCount).toBe(5)
    expect(plan.placedCount + plan.rejected.reduce((sum, item) => sum + item.count, 0)).toBe(5)
    expect(new Set(plan.items.map((item) => item.photoId))).toEqual(new Set(['alice', 'bob']))
  })

  it('相同输入得到稳定布局结果', () => {
    const request: LayoutRequest = {
      mode: 'mixed',
      paper,
      photos: [{ ...basePhoto, copies: 4 }],
      gapMm: 1,
      dpi: 300,
    }
    expect(createLayout(request)).toEqual(createLayout(request))
  })

  it('为不同照片保留各自的裁切框', () => {
    const firstCrop = createZoomedCrop(
      { width: 1200, height: 1600 },
      { width: 25, height: 35 },
      { x: 0.4, y: 0.5 },
      2,
    )
    const secondCrop = createZoomedCrop(
      { width: 1200, height: 1600 },
      { width: 35, height: 49 },
      { x: 0.6, y: 0.5 },
      1.5,
    )
    const plan = createLayout({
      mode: 'mixed',
      paper,
      photos: [
        { ...basePhoto, copies: 1, crop: firstCrop },
        { ...basePhoto, id: 'bob', width: 35, height: 49, copies: 1, crop: secondCrop },
      ],
      gapMm: 2,
      dpi: 300,
    })

    expect(plan.items.find((item) => item.photoId === 'alice')?.crop).toEqual(firstCrop)
    expect(plan.items.find((item) => item.photoId === 'bob')?.crop).toEqual(secondCrop)
  })
})

describe('photo output', () => {
  it('按业务规格毫米尺寸和 DPI 创建单张输出计划', () => {
    const crop = computeCoverCrop({ width: 1200, height: 1600 }, { width: 25, height: 35 })
    const plan = createPhotoOutputPlan({
      photoId: 'alice',
      sourceWidthPx: 1200,
      sourceHeightPx: 1600,
      spec: {
        id: 'one-inch',
        name: '一寸',
        width: 25,
        height: 35,
        category: 'photo',
        group: 'common-size',
        recommendedDpi: 300,
      },
      dpi: 300,
      crop,
      background: 'white',
    })

    expect(plan.pixelSize).toEqual({ width: 295, height: 413 })
    expect(plan.item).toEqual({ photoId: 'alice', crop, background: 'white' })
  })

  it('拒绝非法 DPI 和比例错误的裁切', () => {
    const request = {
      photoId: 'alice',
      sourceWidthPx: 1200,
      sourceHeightPx: 1600,
      spec: {
        id: 'one-inch',
        name: '一寸',
        width: 25,
        height: 35,
        category: 'photo' as const,
        group: 'common-size' as const,
        recommendedDpi: 300,
      },
      dpi: 0,
      crop: computeCoverCrop({ width: 1200, height: 1600 }, { width: 25, height: 35 }),
      background: 'keep' as const,
    }

    expect(() => createPhotoOutputPlan(request)).toThrow('DPI')
    expect(() => createPhotoOutputPlan({
      ...request,
      dpi: 300,
      crop: { ...request.crop, width: request.crop.width / 2 },
    })).toThrow('比例不一致')
  })
})
