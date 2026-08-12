import { describe, expect, it, vi } from 'vitest'
import { removeBackground as imglyRemoveBackground } from '@imgly/background-removal'
import {
  createBackgroundRemovalRegistry,
  createH5Platform,
  createImglyBackgroundRemovalBackend,
  type BackgroundRemovalBackend,
} from '../src'

vi.mock('@imgly/background-removal', () => ({
  removeBackground: vi.fn(async () => new Blob()),
}))

/** 创建无需真实推理的模型适配器替身，喵~ */
function createBackend(id: string, name = id): BackgroundRemovalBackend {
  return {
    descriptor: { id, name, description: `${name}描述` },
    removeBackground: vi.fn(async () => new Blob()),
  }
}

describe('background removal registry', () => {
  it('公开注册模型和指定默认模型', () => {
    const fast = createBackend('fast', '快速模型')
    const quality = createBackend('quality', '高清模型')
    const registry = createBackgroundRemovalRegistry([fast, quality], 'quality')

    expect(registry.defaultModelId).toBe('quality')
    expect(registry.descriptors.map((model) => model.id)).toEqual(['fast', 'quality'])
    expect(registry.get('fast')).toBe(fast)
  })

  it('拒绝空注册表、重复 ID、空 ID 和不存在的默认模型', () => {
    expect(() => createBackgroundRemovalRegistry([], 'fast')).toThrow('至少需要注册一个抠图模型')
    expect(() => createBackgroundRemovalRegistry([createBackend('fast'), createBackend('fast')], 'fast')).toThrow('重复注册')
    expect(() => createBackgroundRemovalRegistry([createBackend('')], '')).toThrow('ID 不能为空')
    expect(() => createBackgroundRemovalRegistry([createBackend('fast')], 'quality')).toThrow('默认抠图模型 quality 未注册')
  })

  it('未知模型查询立即失败', () => {
    const registry = createBackgroundRemovalRegistry([createBackend('fast')], 'fast')
    expect(() => registry.get('missing')).toThrow('抠图模型 missing 未注册')
  })

  it('平台支持注入模型并公开不可变描述', () => {
    const platform = createH5Platform({
      backgroundRemovalBackends: [createBackend('custom', '自定义模型')],
      defaultBackgroundRemovalModelId: 'custom',
    })

    expect(platform.defaultBackgroundRemovalModelId).toBe('custom')
    expect(platform.backgroundRemovalModels).toEqual([{
      id: 'custom',
      name: '自定义模型',
      description: '自定义模型描述',
    }])
    expect(Object.isFrozen(platform.backgroundRemovalModels)).toBe(true)
    platform.dispose()
  })
})

describe('IMG.LY background removal backend', () => {
  it('串行执行同模型推理并把进度发送给各自任务', async () => {
    let releaseFirst: ((blob: Blob) => void) | undefined
    const firstProgress = vi.fn()
    const secondProgress = vi.fn()
    vi.mocked(imglyRemoveBackground)
      .mockImplementationOnce((_source, config) => {
        config?.progress?.('compute:inference', 1, 4)
        return new Promise<Blob>((resolve) => { releaseFirst = resolve })
      })
      .mockImplementationOnce(async (_source, config) => {
        config?.progress?.('compute:inference', 2, 4)
        return new Blob(['second'])
      })
    const backend = createImglyBackgroundRemovalBackend({
      id: 'quality',
      name: '高清模型',
      description: '高清',
    }, 'isnet_fp16')

    const first = backend.removeBackground(new Blob(['first']), { onProgress: firstProgress })
    const second = backend.removeBackground(new Blob(['second']), { onProgress: secondProgress })
    await Promise.resolve()
    expect(imglyRemoveBackground).toHaveBeenCalledTimes(1)
    expect(firstProgress).toHaveBeenCalledWith({ phase: 'processing', current: 1, total: 4 })
    expect(secondProgress).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'processing' }))

    releaseFirst?.(new Blob(['first']))
    await first
    await second
    expect(imglyRemoveBackground).toHaveBeenCalledTimes(2)
    expect(secondProgress).toHaveBeenCalledWith({ phase: 'processing', current: 2, total: 4 })
  })
})
