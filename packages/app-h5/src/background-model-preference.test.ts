import { describe, expect, it, vi } from 'vitest'
import {
  BACKGROUND_MODEL_PREFERENCE_KEY,
  readBackgroundModelPreference,
  writeBackgroundModelPreference,
} from './background-model-preference'

const MODELS = [
  { id: 'fast', name: '快速模型', description: '快速' },
  { id: 'quality', name: '高清模型', description: '高清' },
]

describe('background model preference', () => {
  it('首次访问和无效偏好回退快速模型', () => {
    expect(readBackgroundModelPreference(MODELS, 'fast', { getItem: () => null, setItem: vi.fn() })).toBe('fast')
    expect(readBackgroundModelPreference(MODELS, 'fast', { getItem: () => 'removed', setItem: vi.fn() })).toBe('fast')
  })

  it('恢复合法偏好并使用版本化键保存', () => {
    const storage = { getItem: vi.fn(() => 'quality'), setItem: vi.fn() }
    expect(readBackgroundModelPreference(MODELS, 'fast', storage)).toBe('quality')

    writeBackgroundModelPreference('quality', storage)
    expect(storage.setItem).toHaveBeenCalledWith(BACKGROUND_MODEL_PREFERENCE_KEY, 'quality')
  })

  it('浏览器拒绝读写存储时不阻断应用', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('denied') }),
      setItem: vi.fn(() => { throw new Error('denied') }),
    }
    expect(readBackgroundModelPreference(MODELS, 'fast', storage)).toBe('fast')
    expect(() => writeBackgroundModelPreference('quality', storage)).not.toThrow()
  })
})
