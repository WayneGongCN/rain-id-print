import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BACKGROUND_TUNING,
  isDefaultBackgroundTuning,
  normalizeBackgroundTuning,
} from '../src'

describe('background tuning', () => {
  it('默认值保持模型原始蒙版', () => {
    expect(normalizeBackgroundTuning()).toEqual(DEFAULT_BACKGROUND_TUNING)
    expect(isDefaultBackgroundTuning()).toBe(true)
  })

  it('将越界和非有限参数限制到安全范围', () => {
    expect(normalizeBackgroundTuning({
      edgeShiftPx: 30,
      edgeHardness: -5,
      featherPx: Number.POSITIVE_INFINITY,
      decontaminate: 140,
    })).toEqual({
      edgeShiftPx: 8,
      edgeHardness: 0,
      featherPx: 0,
      decontaminate: 100,
    })
  })

  it('将羽化精度规范为半像素并识别非默认值', () => {
    expect(normalizeBackgroundTuning({ featherPx: 2.24 }).featherPx).toBe(2)
    expect(normalizeBackgroundTuning({ featherPx: 2.26 }).featherPx).toBe(2.5)
    expect(isDefaultBackgroundTuning({ edgeHardness: 1 })).toBe(false)
  })
})
