import { describe, expect, it } from 'vitest'
import { patchJpegDpiBytes } from '../src'

/** 创建一个带标准 JFIF APP0 段的最小 JPEG 测试数据，喵~ */
function createJfifJpeg(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x00,
    0x00, 0x60, 0x00, 0x60,
    0x00, 0x00,
    0xff, 0xd9,
  ])
}

describe('patchJpegDpiBytes', () => {
  it('更新现有 JFIF 段的单位和双向密度', () => {
    const result = patchJpegDpiBytes(createJfifJpeg(), 300)
    expect(result[13]).toBe(1)
    expect(((result[14] ?? 0) << 8) | (result[15] ?? 0)).toBe(300)
    expect(((result[16] ?? 0) << 8) | (result[17] ?? 0)).toBe(300)
  })

  it('在缺失 JFIF 段时插入标准 APP0 数据', () => {
    const result = patchJpegDpiBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 300)
    expect(result.slice(2, 4)).toEqual(new Uint8Array([0xff, 0xe0]))
    expect(result.length).toBe(22)
  })

  it('拒绝非 JPEG 输入', () => {
    expect(() => patchJpegDpiBytes(new Uint8Array([1, 2, 3]), 300)).toThrow('JPEG')
  })
})

