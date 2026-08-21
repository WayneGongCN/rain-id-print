import { describe, expect, it } from 'vitest'
import { PHOTO_SPECS, getPhotoSpec } from '../src'

describe('photo specs', () => {
  it('所有预设标识唯一且尺寸与建议精度有效', () => {
    expect(new Set(PHOTO_SPECS.map((spec) => spec.id)).size).toBe(PHOTO_SPECS.length)
    expect(PHOTO_SPECS.every((spec) => spec.width > 0 && spec.height > 0)).toBe(true)
    expect(PHOTO_SPECS.every((spec) => Number.isInteger(spec.recommendedDpi) && spec.recommendedDpi > 0)).toBe(true)
  })

  it('按业务分组提供身份证和港澳通行证规格', () => {
    expect(getPhotoSpec('resident-id-card')).toMatchObject({
      group: 'china-document',
      width: 26,
      height: 32,
      recommendedDpi: 350,
    })
    expect(getPhotoSpec('hong-kong-macao-permit')).toMatchObject({
      group: 'china-document',
      width: 33,
      height: 48,
      recommendedDpi: 300,
    })
  })

  it('使用当前日本签证纸质照片尺寸', () => {
    expect(getPhotoSpec('japan-visa')).toMatchObject({ width: 35, height: 45, recommendedDpi: 300 })
  })

  it('为存在地区差异的社会保障卡规格提供提示和来源', () => {
    const spec = getPhotoSpec('social-security')
    expect(spec?.notice).toContain('当地人社部门')
    expect(spec?.references?.length).toBeGreaterThan(0)
  })

  it('内置规格查询不包含应用会话创建的自定义规格', () => {
    expect(getPhotoSpec('custom-30x40-mm')).toBeUndefined()
    expect(PHOTO_SPECS.some((spec) => spec.group === 'custom')).toBe(false)
  })
})
