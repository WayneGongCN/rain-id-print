import { describe, expect, it } from 'vitest'
import {
  createCustomPhotoSpec,
  createCustomPhotoSpecId,
  formatPhotoSpecLabel,
  getAnalyticsPhotoSpecId,
  parseCustomPhotoDimension,
  resolveCustomPhotoSpec,
} from './custom-photo-spec'

describe('custom photo spec', () => {
  it('只接受 1 到 500 的整数毫米值', () => {
    expect(parseCustomPhotoDimension('1')).toBe(1)
    expect(parseCustomPhotoDimension('500')).toBe(500)
    expect(parseCustomPhotoDimension('0')).toBeUndefined()
    expect(parseCustomPhotoDimension('501')).toBeUndefined()
    expect(parseCustomPhotoDimension('30.5')).toBeUndefined()
    expect(parseCustomPhotoDimension('')).toBeUndefined()
    expect(parseCustomPhotoDimension('abc')).toBeUndefined()
    expect(() => createCustomPhotoSpec(30.5, 40)).toThrow('整数毫米值')
  })

  it('使用宽高生成确定性规格标识和可读标签', () => {
    const spec = createCustomPhotoSpec(30, 40)

    expect(createCustomPhotoSpecId(30, 40)).toBe('custom-30x40-mm')
    expect(spec).toMatchObject({ id: 'custom-30x40-mm', group: 'custom', recommendedDpi: 300 })
    expect(formatPhotoSpecLabel(spec)).toBe('自定义 · 30×40mm')
    expect(getAnalyticsPhotoSpecId(spec)).toBe('custom')
  })

  it('相同宽高复用会话规格且不同宽高创建新规格', () => {
    const existing = createCustomPhotoSpec(30, 40)

    expect(resolveCustomPhotoSpec([existing], 30, 40)).toEqual({ spec: existing, isNew: false })
    expect(resolveCustomPhotoSpec([existing], 31, 40)).toMatchObject({
      isNew: true,
      spec: { id: 'custom-31x40-mm' },
    })
  })
})
