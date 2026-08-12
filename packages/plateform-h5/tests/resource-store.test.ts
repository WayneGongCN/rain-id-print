import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { H5ResourceStore } from '../src/resource-store'

class FakeImage {
  decoding = 'auto'
  naturalWidth = 1200
  naturalHeight = 1600
  onload: (() => void) | null = null
  onerror: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

let objectUrlIndex = 0

beforeEach(() => {
  objectUrlIndex = 0
  vi.stubGlobal('Image', FakeImage)
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:test-${++objectUrlIndex}`)
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** 导入一张测试照片并返回资源标识，喵~ */
async function importAsset(store: H5ResourceStore): Promise<string> {
  const asset = await store.importFile(new File(['photo'], 'photo.jpg', { type: 'image/jpeg' }))
  return asset.id
}

describe('H5ResourceStore model cutouts', () => {
  it('合并同模型并发请求并隔离不同模型缓存', async () => {
    const store = new H5ResourceStore()
    const assetId = await importAsset(store)
    let resolveFast: ((blob: Blob) => void) | undefined
    const fastTask = vi.fn(() => new Promise<Blob>((resolve) => { resolveFast = resolve }))

    const first = store.ensureCutout(assetId, 'fast', fastTask)
    const second = store.ensureCutout(assetId, 'fast', fastTask)
    expect(fastTask).toHaveBeenCalledTimes(1)
    resolveFast?.(new Blob(['fast']))
    await Promise.all([first, second])

    const qualityTask = vi.fn(async () => new Blob(['quality']))
    await store.ensureCutout(assetId, 'quality', qualityTask)
    expect(store.getCutout(assetId, 'fast').image).toBeInstanceOf(FakeImage)
    expect(store.getCutout(assetId, 'quality').image).toBeInstanceOf(FakeImage)
    expect(qualityTask).toHaveBeenCalledTimes(1)
  })

  it('第三个模型写入时淘汰最久未使用结果并释放链接与画布', async () => {
    const store = new H5ResourceStore()
    const assetId = await importAsset(store)
    const task = async () => new Blob(['cutout'])
    await store.ensureCutout(assetId, 'fast', task)
    await store.ensureCutout(assetId, 'quality', task)
    store.getCutout(assetId, 'fast')
    const quality = store.getCutout(assetId, 'quality')
    const canvas = { width: 100, height: 100 } as HTMLCanvasElement
    quality.refinedCutouts.set('preview', canvas)
    store.getCutout(assetId, 'fast')

    await store.ensureCutout(assetId, 'third', task)

    expect(() => store.getCutout(assetId, 'quality')).toThrow('尚未使用quality模型完成抠图')
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-3')
  })

  it('资源删除后丢弃仍在执行的任务结果', async () => {
    const store = new H5ResourceStore()
    const assetId = await importAsset(store)
    let resolveTask: ((blob: Blob) => void) | undefined
    const task = new Promise<Blob>((resolve) => { resolveTask = resolve })
    const pending = store.ensureCutout(assetId, 'fast', async () => task)

    store.remove(assetId)
    resolveTask?.(new Blob(['late']))

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(() => store.get(assetId)).toThrow('不存在')
  })
})
