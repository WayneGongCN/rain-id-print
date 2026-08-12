import { describe, expect, it, vi } from 'vitest'
import { prepareBackgroundModelForAssets } from './background-model-switch'

describe('prepareBackgroundModelForAssets', () => {
  it('按照片顺序串行准备目标模型并透传进度', async () => {
    const order: string[] = []
    let running = 0
    let maxRunning = 0
    const prepareCutout = vi.fn(async (assetId: string, options: { modelId: string; onProgress?: (progress: { phase: 'processing' }) => void }) => {
      running += 1
      maxRunning = Math.max(maxRunning, running)
      order.push(assetId)
      options.onProgress?.({ phase: 'processing' })
      await Promise.resolve()
      running -= 1
    })
    const progress = vi.fn()

    await prepareBackgroundModelForAssets({ prepareCutout } as never, ['one', 'two', 'three'], 'quality', { onProgress: progress })

    expect(order).toEqual(['one', 'two', 'three'])
    expect(maxRunning).toBe(1)
    expect(prepareCutout).toHaveBeenCalledTimes(3)
    expect(progress).toHaveBeenLastCalledWith(expect.objectContaining({ assetId: 'three', current: 3, total: 3 }))
  })

  it('单张失败后停止后续处理并向调用方抛错', async () => {
    const prepareCutout = vi.fn(async (assetId: string) => {
      if (assetId === 'two') throw new Error('模型失败')
    })

    await expect(prepareBackgroundModelForAssets(
      { prepareCutout } as never,
      ['one', 'two', 'three'],
      'quality',
    )).rejects.toThrow('模型失败')
    expect(prepareCutout.mock.calls.map((call) => call[0])).toEqual(['one', 'two'])
  })

  it('已取消任务不会开始处理照片', async () => {
    const controller = new AbortController()
    controller.abort()
    const prepareCutout = vi.fn()

    await expect(prepareBackgroundModelForAssets(
      { prepareCutout } as never,
      ['one'],
      'quality',
      { signal: controller.signal },
    )).rejects.toMatchObject({ name: 'AbortError' })
    expect(prepareCutout).not.toHaveBeenCalled()
  })
})
