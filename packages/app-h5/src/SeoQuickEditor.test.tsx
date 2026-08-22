import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { H5ImageAsset } from '@rainnear/plateform-h5'
import { SeoQuickEditor } from './SeoQuickEditor'

const platformModule = vi.hoisted(() => ({ createH5Platform: vi.fn() }))

vi.mock('@rainnear/plateform-h5', async (importOriginal) => {
  const original = await importOriginal<typeof import('@rainnear/plateform-h5')>()
  return { ...original, createH5Platform: platformModule.createH5Platform }
})

vi.mock('./CropCanvas', async () => {
  const React = await import('react')
  return {
    CropCanvas: React.forwardRef<HTMLCanvasElement>((_props, ref) => <canvas ref={ref} />),
  }
})

/** 按文件名生成可区分的新平台资源，喵~ */
function createAsset(file: File): H5ImageAsset {
  return {
    id: file.name,
    name: file.name,
    objectUrl: `blob:${file.name}`,
    width: 1200,
    height: 1600,
    size: file.size,
  }
}

/** 创建覆盖极速编辑器完整生命周期的平台替身，喵~ */
function createPlatformMock() {
  return {
    backgroundRemovalModels: [],
    defaultBackgroundRemovalModelId: 'fast',
    importFiles: vi.fn(async (files: Iterable<File>) => [...files].map(createAsset)),
    prepareCutout: vi.fn<(assetId: string, options: { signal?: AbortSignal }) => Promise<void>>(async () => undefined),
    renderPhotoPreview: vi.fn(async () => undefined),
    renderPreview: vi.fn(async () => undefined),
    exportJpeg: vi.fn(async () => new Blob()),
    exportPhotoJpeg: vi.fn(async () => new Blob()),
    download: vi.fn(),
    removeAsset: vi.fn(),
    dispose: vi.fn(),
  }
}

beforeEach(() => {
  platformModule.createH5Platform.mockReset()
})

afterEach(() => {
  cleanup()
})

describe('SeoQuickEditor', () => {
  it('6 寸排版上传后直接使用原图，不加载抠图模型', async () => {
    const platform = createPlatformMock()
    platformModule.createH5Platform.mockReturnValue(platform)
    render(<SeoQuickEditor flowId="print-layout" initialFile={new File(['a'], 'layout.jpg', { type: 'image/jpeg' })} />)

    await screen.findByText('排版已生成，可以直接下载')
    expect(platform.prepareCutout).not.toHaveBeenCalled()
    expect(screen.queryByLabelText('照片底色')).toBeNull()
    expect(platform.renderPreview).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      new Map([['layout.jpg', 'keep']]),
      expect.anything(),
    )

    fireEvent.click(screen.getByRole('button', { name: /下载 12 张一寸照排版图/ }))
    await waitFor(() => expect(platform.exportJpeg).toHaveBeenCalledWith(
      expect.anything(),
      new Map([['layout.jpg', 'keep']]),
      expect.anything(),
    ))
    expect(platform.prepareCutout).not.toHaveBeenCalled()
  })

  it('上传后立即调用 quality，切换底色不重复抠图', async () => {
    const platform = createPlatformMock()
    platformModule.createH5Platform.mockReturnValue(platform)
    render(<SeoQuickEditor flowId="background" initialFile={new File(['a'], 'first.jpg', { type: 'image/jpeg' })} />)

    await screen.findByText('高清处理完成，可以直接下载')
    expect(platform.prepareCutout).toHaveBeenCalledTimes(1)
    expect(platform.prepareCutout).toHaveBeenCalledWith('first.jpg', expect.objectContaining({ modelId: 'quality' }))

    fireEvent.click(screen.getByRole('button', { name: '蓝底' }))
    expect(screen.getByRole('button', { name: '蓝底' }).getAttribute('aria-pressed')).toBe('true')
    expect(platform.prepareCutout).toHaveBeenCalledTimes(1)
  })

  it('模型失败后允许重试高清处理并保留已导入照片', async () => {
    const platform = createPlatformMock()
    platform.prepareCutout.mockRejectedValueOnce(new Error('模型加载失败')).mockResolvedValueOnce(undefined)
    platformModule.createH5Platform.mockReturnValue(platform)
    render(<SeoQuickEditor flowId="one-inch" initialFile={new File(['a'], 'retry.jpg', { type: 'image/jpeg' })} />)

    expect((await screen.findByRole('alert')).textContent).toContain('模型加载失败')
    fireEvent.click(screen.getByRole('button', { name: '重试高清处理' }))

    await screen.findByText('高清处理完成，可以直接下载')
    expect(platform.importFiles).toHaveBeenCalledTimes(1)
    expect(platform.prepareCutout).toHaveBeenCalledTimes(2)
  })

  it('重新选择照片会取消旧任务，旧结果不能覆盖新照片', async () => {
    const platform = createPlatformMock()
    let resolveFirstTask: (() => void) | undefined
    let firstSignal: AbortSignal | undefined
    platform.prepareCutout
      .mockImplementationOnce(async (_assetId, options) => {
        firstSignal = options.signal
        await new Promise<void>((resolve) => { resolveFirstTask = resolve })
      })
      .mockResolvedValueOnce(undefined)
    platformModule.createH5Platform.mockReturnValue(platform)
    const { container } = render(<SeoQuickEditor flowId="one-inch" initialFile={new File(['a'], 'old.jpg', { type: 'image/jpeg' })} />)

    await waitFor(() => expect(platform.prepareCutout).toHaveBeenCalledTimes(1))
    const replaceInput = container.querySelector<HTMLInputElement>('.quick-editor-head input[type="file"]')
    if (!replaceInput) throw new Error('测试缺少替换照片输入框')
    fireEvent.change(replaceInput, { target: { files: [new File(['b'], 'new.jpg', { type: 'image/jpeg' })] } })

    await screen.findByText('高清处理完成，可以直接下载')
    expect(firstSignal?.aborted).toBe(true)
    expect(platform.removeAsset).toHaveBeenCalledWith('old.jpg')
    await act(async () => resolveFirstTask?.())
    expect(screen.getByText('高清处理完成，可以直接下载')).toBeTruthy()
    expect(platform.prepareCutout).toHaveBeenCalledTimes(2)
  })
})
