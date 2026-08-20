import { forwardRef, useEffect, useRef, type PointerEvent } from 'react'
import { translateCrop, type NormalizedCrop } from '@rainnear/core'

interface CropCanvasProps {
  crop: NormalizedCrop
  disabled?: boolean
  onCropChange: (crop: NormalizedCrop) => void
}

interface DragState {
  pointerId: number
  x: number
  y: number
  crop: NormalizedCrop
}

/** 提供鼠标和触屏统一的照片位置拖动视口，喵~ */
export const CropCanvas = forwardRef<HTMLCanvasElement, CropCanvasProps>(function CropCanvas(
  { crop, disabled = false, onCropChange },
  forwardedRef,
) {
  const dragRef = useRef<DragState | null>(null)
  const frameRef = useRef<number | null>(null)

  // 组件卸载时取消尚未提交的拖动帧，喵~
  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
  }, [])

  /** 记录当前指针和裁切起点并捕获后续移动，喵~ */
  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, crop }
  }

  /** 将视口内的拖动距离换算为源图归一化裁切位移，喵~ */
  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId || disabled) return
    const bounds = event.currentTarget.getBoundingClientRect()
    if (bounds.width <= 0 || bounds.height <= 0) return
    const next = translateCrop(
      drag.crop,
      -((event.clientX - drag.x) / bounds.width) * drag.crop.width,
      -((event.clientY - drag.y) / bounds.height) * drag.crop.height,
    )
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      onCropChange(next)
    })
  }

  /** 释放当前拖动指针，喵~ */
  function handlePointerEnd(event: PointerEvent<HTMLDivElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      className={`crop-viewport ${disabled ? 'is-disabled' : ''}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      aria-label="拖动照片调整裁切位置"
    >
      <canvas ref={forwardedRef} />
      <div className="crop-grid" aria-hidden="true"><i /><i /><i /><i /></div>
      <span className="crop-drag-hint" aria-hidden="true">拖动调整位置</span>
    </div>
  )
})
