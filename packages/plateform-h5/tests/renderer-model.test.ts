import { afterEach, describe, expect, it, vi } from 'vitest'
import type { LayoutPlan, PhotoOutputPlan } from '@rainnear/core'
import { H5CanvasRenderer } from '../src/renderer'

class FakeHtmlImageElement {
  naturalWidth = 600
  naturalHeight = 800
}

const PLAN: LayoutPlan = {
  version: 1,
  mode: 'single-count',
  dpi: 300,
  orientation: 'portrait',
  paper: { width: 25, height: 35 },
  pixelSize: { width: 295, height: 413 },
  gapMm: 0,
  items: [{
    instanceId: 'photo-1:0',
    photoId: 'photo-1',
    x: 0,
    y: 0,
    width: 25,
    height: 35,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    background: 'white',
  }],
  rejected: [],
  placedCount: 1,
  requestedCount: 1,
  utilization: 1,
}

const PHOTO_PLAN: PhotoOutputPlan = {
  version: 1,
  dpi: 300,
  physicalSize: { width: 25, height: 35 },
  pixelSize: { width: 295, height: 413 },
  item: {
    photoId: 'photo-1',
    crop: { x: 0.1, y: 0.2, width: 0.8, height: 0.7 },
    background: 'keep',
  },
}

/** 创建满足渲染器绘制需求的轻量 Canvas 替身，喵~ */
function createCanvas(): HTMLCanvasElement {
  const context = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    strokeRect: vi.fn(),
  }
  return {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
  } as unknown as HTMLCanvasElement
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('H5CanvasRenderer background model selection', () => {
  it('按 RenderOptions 中的模型 ID 读取抠图并完成预览', async () => {
    vi.stubGlobal('HTMLImageElement', FakeHtmlImageElement)
    const original = new FakeHtmlImageElement()
    const qualityCutout = new FakeHtmlImageElement()
    const getCutout = vi.fn(() => ({
      image: qualityCutout,
      objectUrl: 'blob:quality',
      refinedCutouts: new Map(),
      lastAccess: 1,
    }))
    const store = {
      get: vi.fn(() => ({ id: 'photo-1', image: original })),
      getCutout,
    }
    const renderer = new H5CanvasRenderer(store as never)

    await renderer.renderPreview(createCanvas(), PLAN, new Map([['photo-1', 'white']]), {
      separatorColor: '#000000',
      backgroundRemovalModelId: 'quality',
    })

    expect(getCutout).toHaveBeenCalledWith('photo-1', 'quality')
  })

  it('目标模型尚未准备时向调用方返回明确错误', async () => {
    vi.stubGlobal('HTMLImageElement', FakeHtmlImageElement)
    const store = {
      get: vi.fn(() => ({ id: 'photo-1', image: new FakeHtmlImageElement() })),
      getCutout: vi.fn(() => { throw new Error('照片 photo-1 尚未使用quality模型完成抠图') }),
    }
    const renderer = new H5CanvasRenderer(store as never)

    await expect(renderer.renderPreview(createCanvas(), PLAN, new Map([['photo-1', 'white']]), {
      separatorColor: '#000000',
      backgroundRemovalModelId: 'quality',
    })).rejects.toThrow('尚未使用quality模型完成抠图')
  })

  it('按单张输出计划裁切预览且不绘制分隔线', async () => {
    vi.stubGlobal('HTMLImageElement', FakeHtmlImageElement)
    const store = {
      get: vi.fn(() => ({ id: 'photo-1', image: new FakeHtmlImageElement() })),
      getCutout: vi.fn(),
    }
    const renderer = new H5CanvasRenderer(store as never)
    const canvas = createCanvas()
    const context = canvas.getContext('2d') as unknown as {
      drawImage: ReturnType<typeof vi.fn>
      strokeRect: ReturnType<typeof vi.fn>
    }

    await renderer.renderPhotoPreview(canvas, PHOTO_PLAN, {
      backgroundRemovalModelId: 'fast',
      previewMaxEdge: 300,
    })

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.any(FakeHtmlImageElement),
      60,
      160,
      480,
      560,
      0,
      0,
      214,
      300,
    )
    expect(context.strokeRect).not.toHaveBeenCalled()
  })

  it('在创建单张高分辨率画布前阻止超限导出', async () => {
    vi.stubGlobal('HTMLImageElement', FakeHtmlImageElement)
    const renderer = new H5CanvasRenderer({} as never)

    await expect(renderer.exportPhotoJpeg({
      ...PHOTO_PLAN,
      pixelSize: { width: 6000, height: 6000 },
    }, {
      backgroundRemovalModelId: 'fast',
      maxExportPixels: 25_000_000,
    })).rejects.toThrow('25MP')
  })

  it('按规格像素导出单张 JPEG 并写入目标 DPI', async () => {
    vi.stubGlobal('HTMLImageElement', FakeHtmlImageElement)
    const store = {
      get: vi.fn(() => ({ id: 'photo-1', image: new FakeHtmlImageElement() })),
      getCutout: vi.fn(),
    }
    const canvas = createCanvas()
    Object.assign(canvas, {
      toBlob: (callback: (blob: Blob | null) => void) => callback(new Blob([
        new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      ], { type: 'image/jpeg' })),
    })
    vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
    const renderer = new H5CanvasRenderer(store as never)

    const jpeg = await renderer.exportPhotoJpeg(PHOTO_PLAN, {
      backgroundRemovalModelId: 'fast',
    })
    const bytes = new Uint8Array(await jpeg.arrayBuffer())

    expect(bytes[13]).toBe(1)
    expect(((bytes[14] ?? 0) << 8) | (bytes[15] ?? 0)).toBe(300)
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
  })
})
