import { describe, expect, it } from 'vitest'
import {
  getDpiRecommendationWarning,
  getExportPixelWarning,
  getRecommendedExportDpi,
  parseExportDpi,
  raiseExportDpi,
} from './export-settings'

describe('export settings', () => {
  const photos = [
    { presetId: 'one-inch' },
    { presetId: 'resident-id-card' },
  ]

  it('单照片模式只读取首张照片，混排模式使用最高建议 DPI', () => {
    expect(getRecommendedExportDpi(photos, 'single')).toBe(300)
    expect(getRecommendedExportDpi(photos, 'mixed')).toBe(350)
  })

  it('自动提高建议精度但不会自动降低已有设置', () => {
    expect(raiseExportDpi(300, 350)).toBe(350)
    expect(raiseExportDpi(600, 300)).toBe(600)
  })

  it('只接受 72 到 600 之间的整数 DPI', () => {
    expect(parseExportDpi('350')).toBe(350)
    expect(parseExportDpi('72.5')).toBeUndefined()
    expect(parseExportDpi('71')).toBeUndefined()
    expect(parseExportDpi('601')).toBeUndefined()
    expect(parseExportDpi('')).toBeUndefined()
  })

  it('用户主动调低精度时给出非阻断风险提示', () => {
    expect(getDpiRecommendationWarning(300, 350)).toContain('低于所选证件建议')
    expect(getDpiRecommendationWarning(350, 350)).toBeUndefined()
  })

  it('在导出前识别超过 2500 万像素的布局', () => {
    expect(getExportPixelWarning({ width: 5000, height: 5001 })).toContain('超过 H5 25MP')
    expect(getExportPixelWarning({ width: 5000, height: 5000 })).toBeUndefined()
  })
})
