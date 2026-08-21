import { forwardRef, useEffect, useRef, type KeyboardEvent } from 'react'
import { useGesture } from '@use-gesture/react'
import {
  MAX_CROP_ZOOM,
  getCropZoom,
  translateCrop,
  zoomCropAtPoint,
  type NormalizedCrop,
  type NormalizedPoint,
  type SizeMm,
} from '@rainnear/core'

interface CropCanvasProps {
  crop: NormalizedCrop
  sourceSize: SizeMm
  targetSize: SizeMm
  disabled?: boolean
  onCropChange: (crop: NormalizedCrop) => void
}

interface PinchMemo {
  crop: NormalizedCrop
  anchor: NormalizedPoint
}

const WHEEL_ZOOM_SPEED = 0.002
const KEYBOARD_ZOOM_STEP = 0.05
const KEYBOARD_MOVE_STEP = 0.01
const KEYBOARD_FAST_MOVE_STEP = 0.05

/** 将数值限制在指定闭区间内，喵~ */
function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

/** 将客户区坐标换算为裁切视口中的归一化锚点，喵~ */
function getViewportPoint(element: HTMLElement, clientX: number, clientY: number): NormalizedPoint | null {
  const bounds = element.getBoundingClientRect()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  return {
    x: clamp((clientX - bounds.left) / bounds.width, 0, 1),
    y: clamp((clientY - bounds.top) / bounds.height, 0, 1),
  }
}

/** 判断两个裁切框是否已经相同，避免边界处重复刷新预览，喵~ */
function isSameCrop(left: NormalizedCrop, right: NormalizedCrop): boolean {
  return left.x === right.x && left.y === right.y && left.width === right.width && left.height === right.height
}

/** 提供鼠标、触屏、滚轮和键盘统一控制的照片裁切视口，喵~ */
export const CropCanvas = forwardRef<HTMLCanvasElement, CropCanvasProps>(function CropCanvas(
  { crop, sourceSize, targetSize, disabled = false, onCropChange },
  forwardedRef,
) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const cropRef = useRef(crop)
  const onCropChangeRef = useRef(onCropChange)
  const frameRef = useRef<number | null>(null)
  const pendingCropRef = useRef<NormalizedCrop | null>(null)

  useEffect(() => {
    cropRef.current = crop
  }, [crop])

  useEffect(() => {
    onCropChangeRef.current = onCropChange
  }, [onCropChange])

  /** 合并同一动画帧内的手势结果并立即更新下一事件使用的裁切基线，喵~ */
  function scheduleCropChange(next: NormalizedCrop): void {
    if (disabled || isSameCrop(cropRef.current, next)) return
    cropRef.current = next
    pendingCropRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      const pending = pendingCropRef.current
      pendingCropRef.current = null
      if (pending) onCropChangeRef.current(pending)
    })
  }

  /** 读取当前裁切倍率，非法外部状态按最小倍率回退，喵~ */
  function readZoom(currentCrop = cropRef.current): number {
    try {
      return getCropZoom(sourceSize, targetSize, currentCrop)
    } catch {
      return 1
    }
  }

  useGesture({
    onDrag: ({ first, movement: [movementX, movementY], memo, pinching, touches, cancel }) => {
      const element = viewportRef.current
      const startCrop = (first || !memo ? cropRef.current : memo) as NormalizedCrop
      if (!element || disabled) return startCrop
      if (pinching || touches > 1) {
        cancel()
        return startCrop
      }
      const bounds = element.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) return startCrop
      scheduleCropChange(translateCrop(
        startCrop,
        -(movementX / bounds.width) * startCrop.width,
        -(movementY / bounds.height) * startCrop.height,
      ))
      return startCrop
    },
    onWheel: ({ delta: [, deltaY], event }) => {
      const element = viewportRef.current
      if (!element || disabled || !(event instanceof WheelEvent)) return
      const anchor = getViewportPoint(element, event.clientX, event.clientY)
      if (!anchor) return
      const currentCrop = cropRef.current
      const nextZoom = clamp(readZoom(currentCrop) * Math.exp(-deltaY * WHEEL_ZOOM_SPEED), 1, MAX_CROP_ZOOM)
      scheduleCropChange(zoomCropAtPoint(sourceSize, targetSize, currentCrop, nextZoom, anchor))
    },
    onPinch: ({ first, origin: [originX, originY], offset: [zoom], memo }) => {
      const element = viewportRef.current
      if (!element || disabled) return memo
      let initial = memo as PinchMemo | undefined
      if (first || !initial) {
        const anchor = getViewportPoint(element, originX, originY)
        if (!anchor) return memo
        initial = { crop: cropRef.current, anchor }
      }
      const currentAnchor = getViewportPoint(element, originX, originY)
      if (!currentAnchor) return initial
      const zoomed = zoomCropAtPoint(sourceSize, targetSize, initial.crop, zoom, initial.anchor)
      scheduleCropChange(translateCrop(
        zoomed,
        -(currentAnchor.x - initial.anchor.x) * zoomed.width,
        -(currentAnchor.y - initial.anchor.y) * zoomed.height,
      ))
      return initial
    },
  }, {
    target: viewportRef,
    enabled: !disabled,
    eventOptions: { passive: false },
    drag: { pointer: { keys: false }, preventDefault: true },
    wheel: { preventDefault: true },
    pinch: {
      from: () => [readZoom(), 0],
      scaleBounds: { min: 1, max: MAX_CROP_ZOOM },
      pinchOnWheel: false,
      preventDefault: true,
    },
  })

  // 组件进入禁用状态时取消尚未提交的手势帧，喵~
  useEffect(() => {
    if (!disabled) return
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    pendingCropRef.current = null
    cropRef.current = crop
  }, [crop, disabled])

  // 组件卸载时取消尚未提交的手势帧，喵~
  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  /** 使用键盘对照片位置和倍率进行可访问的精细调整，喵~ */
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (disabled) return
    const currentCrop = cropRef.current
    const moveStep = event.shiftKey ? KEYBOARD_FAST_MOVE_STEP : KEYBOARD_MOVE_STEP
    let next: NormalizedCrop | null = null
    if (event.key === 'ArrowLeft') next = translateCrop(currentCrop, currentCrop.width * moveStep, 0)
    if (event.key === 'ArrowRight') next = translateCrop(currentCrop, -currentCrop.width * moveStep, 0)
    if (event.key === 'ArrowUp') next = translateCrop(currentCrop, 0, currentCrop.height * moveStep)
    if (event.key === 'ArrowDown') next = translateCrop(currentCrop, 0, -currentCrop.height * moveStep)
    if (event.key === '+' || event.key === '=') {
      next = zoomCropAtPoint(
        sourceSize,
        targetSize,
        currentCrop,
        clamp(readZoom(currentCrop) + KEYBOARD_ZOOM_STEP, 1, MAX_CROP_ZOOM),
        { x: 0.5, y: 0.5 },
      )
    }
    if (event.key === '-' || event.key === '_') {
      next = zoomCropAtPoint(
        sourceSize,
        targetSize,
        currentCrop,
        clamp(readZoom(currentCrop) - KEYBOARD_ZOOM_STEP, 1, MAX_CROP_ZOOM),
        { x: 0.5, y: 0.5 },
      )
    }
    if (!next) return
    event.preventDefault()
    scheduleCropChange(next)
  }

  return (
    <div
      ref={viewportRef}
      className={`crop-viewport ${disabled ? 'is-disabled' : ''}`}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      aria-disabled={disabled}
      aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown + -"
      aria-label="拖动移动照片，滚轮或双指缩放，也可使用方向键和加减键精调"
    >
      <canvas ref={forwardedRef} />
      <div className="crop-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      <span className="crop-drag-hint" aria-hidden="true">拖动移动 · 滚轮或双指缩放</span>
    </div>
  )
})
