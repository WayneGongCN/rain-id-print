import { describe, expect, it } from 'vitest'
import { computeCoverCrop, createLayout, mmToPixels, type LayoutRequest } from '../src'

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
})
