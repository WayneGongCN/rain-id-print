import { describe, expect, it } from 'vitest'
import type { H5ImageAsset } from '@rainnear/plateform-h5'
import { SEO_QUICK_FLOW_DEFINITIONS } from './seo-config'
import {
  createSeoQuickLayout,
  createSeoQuickPhoto,
  createSeoQuickPhotoPlan,
  retargetSeoQuickPhoto,
} from './seo-quick-domain'

const asset: H5ImageAsset = {
  id: 'asset-1',
  name: 'portrait.jpg',
  objectUrl: 'blob:portrait',
  width: 1200,
  height: 1600,
  size: 1024,
}

/** 读取测试所需的固定排版流程，喵~ */
function getPrintFlow() {
  const flow = SEO_QUICK_FLOW_DEFINITIONS.find((definition) => definition.id === 'print-layout')
  if (!flow) throw new Error('测试缺少 6 寸排版流程')
  return flow
}

describe('SEO 极速业务计划', () => {
  it('固定生成 25×35mm、591×827px、600 DPI 的一寸照片', () => {
    const photo = { ...createSeoQuickPhoto(asset, 'one-inch'), background: 'white' as const }
    const plan = createSeoQuickPhotoPlan(photo)

    expect(plan.dpi).toBe(600)
    expect(plan.physicalSize).toEqual({ width: 25, height: 35 })
    expect(plan.pixelSize).toEqual({ width: 591, height: 827 })
    expect(plan.item.background).toBe('white')
  })

  it('6 寸相纸默认排入 12 张一寸照并固定 2mm 间距', () => {
    const photo = createSeoQuickPhoto(asset, 'one-inch')
    const layout = createSeoQuickLayout(photo, getPrintFlow())

    expect(layout.dpi).toBe(600)
    expect(layout.gapMm).toBe(2)
    expect(layout.pixelSize).toEqual({ width: 2409, height: 3591 })
    expect(layout.placedCount).toBe(12)
    expect(layout.items.every((item) => item.background === 'keep')).toBe(true)
  })

  it('切换二寸后复用同一排版算法并自动排入 8 张', () => {
    const oneInch = createSeoQuickPhoto(asset, 'one-inch')
    const twoInch = retargetSeoQuickPhoto(oneInch, 'two-inch')
    const layout = createSeoQuickLayout(twoInch, getPrintFlow())

    expect(twoInch.outputDpi).toBe(600)
    expect(twoInch.spec.id).toBe('two-inch')
    expect(layout.placedCount).toBe(8)
  })
})
