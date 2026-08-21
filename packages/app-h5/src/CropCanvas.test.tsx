import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computeCoverCrop, createZoomedCrop, getCropZoom, type NormalizedCrop } from '@rainnear/core'
import { CropCanvas } from './CropCanvas'

const SOURCE_SIZE = { width: 1200, height: 1600 }
const TARGET_SIZE = { width: 25, height: 35 }

interface AnimationFrameHarness {
  flush: () => void
}

/** 安装可控动画帧队列，使高频裁切提交能够稳定断言，喵~ */
function installAnimationFrameHarness(): AnimationFrameHarness {
  let nextFrameId = 1
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const frameId = nextFrameId
    nextFrameId += 1
    frames.set(frameId, callback)
    return frameId
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((frameId) => {
    frames.delete(frameId)
  })
  return {
    flush() {
      const pending = [...frames.values()]
      frames.clear()
      pending.forEach((callback) => callback(0))
    },
  }
}

/** 渲染具有稳定客户区尺寸的裁切视口，喵~ */
function renderCropCanvas(options: {
  crop?: NormalizedCrop
  disabled?: boolean
  onCropChange?: (crop: NormalizedCrop) => void
} = {}) {
  const onCropChange = options.onCropChange ?? vi.fn()
  render(
    <CropCanvas
      crop={options.crop ?? computeCoverCrop(SOURCE_SIZE, TARGET_SIZE)}
      sourceSize={SOURCE_SIZE}
      targetSize={TARGET_SIZE}
      disabled={options.disabled}
      onCropChange={onCropChange}
    />,
  )
  const viewport = screen.getByLabelText('拖动移动照片，滚轮或双指缩放，也可使用方向键和加减键精调')
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 300,
    width: 200,
    height: 300,
    toJSON: () => ({}),
  })
  return { onCropChange, viewport }
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('CropCanvas', () => {
  it('围绕鼠标位置处理滚轮缩放并按动画帧合并提交', () => {
    const frames = installAnimationFrameHarness()
    const { onCropChange, viewport } = renderCropCanvas()

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 50, clientY: 75 })
    fireEvent.wheel(viewport, { deltaY: -100, clientX: 50, clientY: 75 })
    expect(onCropChange).not.toHaveBeenCalled()
    act(() => frames.flush())

    expect(onCropChange).toHaveBeenCalledTimes(1)
    const next = vi.mocked(onCropChange).mock.calls[0]?.[0]
    expect(next).toBeDefined()
    expect(getCropZoom(SOURCE_SIZE, TARGET_SIZE, next!)).toBeGreaterThan(1)
  })

  it('使用方向键移动并使用加号围绕中心缩放', () => {
    const frames = installAnimationFrameHarness()
    const initial = createZoomedCrop(SOURCE_SIZE, TARGET_SIZE, { x: 0.5, y: 0.5 }, 2)
    const { onCropChange, viewport } = renderCropCanvas({ crop: initial })

    fireEvent.keyDown(viewport, { key: 'ArrowLeft' })
    act(() => frames.flush())
    const moved = vi.mocked(onCropChange).mock.calls[0]?.[0]
    expect(moved?.x).toBeGreaterThan(initial.x)

    fireEvent.keyDown(viewport, { key: '+' })
    act(() => frames.flush())
    const zoomed = vi.mocked(onCropChange).mock.calls[1]?.[0]
    expect(getCropZoom(SOURCE_SIZE, TARGET_SIZE, zoomed!)).toBeCloseTo(2.05)
  })

  it('禁用时不响应滚轮和键盘输入', () => {
    const frames = installAnimationFrameHarness()
    const { onCropChange, viewport } = renderCropCanvas({ disabled: true })

    fireEvent.wheel(viewport, { deltaY: -100, clientX: 100, clientY: 150 })
    fireEvent.keyDown(viewport, { key: '+' })
    act(() => frames.flush())

    expect(onCropChange).not.toHaveBeenCalled()
    expect(viewport.getAttribute('aria-disabled')).toBe('true')
    expect(viewport.getAttribute('tabindex')).toBe('-1')
  })
})
