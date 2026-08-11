import { describe, expect, it } from 'vitest'
import { refineAlphaChannel, refineRgbaPixels } from '../src'

describe('matte refinement', () => {
  it('默认参数保持模型透明通道不变', () => {
    const alpha = new Uint8ClampedArray([0, 32, 128, 224, 255])
    expect(refineAlphaChannel(alpha, 5, 1)).toEqual(alpha)
  })

  it('扩张和收缩参数改变真实蒙版边界', () => {
    const isolated = new Uint8ClampedArray([
      0, 0, 0,
      0, 255, 0,
      0, 0, 0,
    ])
    expect([...refineAlphaChannel(isolated, 3, 3, { edgeShiftPx: 1 })]).toEqual(new Array(9).fill(255))

    const block = new Uint8ClampedArray([
      0, 0, 0, 0, 0,
      0, 255, 255, 255, 0,
      0, 255, 255, 255, 0,
      0, 255, 255, 255, 0,
      0, 0, 0, 0, 0,
    ])
    expect([...refineAlphaChannel(block, 5, 5, { edgeShiftPx: -1 })].filter((value) => value > 0)).toEqual([255])
  })

  it('羽化产生渐变边缘且硬度增强透明度对比', () => {
    const feathered = refineAlphaChannel(new Uint8ClampedArray([0, 0, 255, 0, 0]), 5, 1, { featherPx: 1 })
    expect(feathered[1]).toBeGreaterThan(0)
    expect(feathered[3]).toBeGreaterThan(0)

    const hardened = refineAlphaChannel(new Uint8ClampedArray([64, 128, 192]), 3, 1, { edgeHardness: 100 })
    expect(hardened[0]).toBeLessThan(64)
    expect(hardened[2]).toBeGreaterThan(192)
  })

  it('为扩张出的透明像素传播前景颜色以避免黑边', () => {
    const pixels = new Uint8ClampedArray([
      0, 0, 0, 0,
      220, 40, 30, 255,
      0, 0, 0, 0,
    ])
    const result = refineRgbaPixels(pixels, 3, 1, [120, 120, 120], { edgeShiftPx: 1 })
    expect([...result]).toEqual([
      220, 40, 30, 255,
      220, 40, 30, 255,
      220, 40, 30, 255,
    ])
  })
})
