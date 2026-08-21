import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPhotoSpec, type PhotoSpec } from '@rainnear/core'
import { createCustomPhotoSpec } from './custom-photo-spec'
import { createInitialAppPhoto } from './photo-output-settings'
import { SpecCropStep } from './SpecCropStep'

const ASSET = {
  id: 'photo-1',
  name: 'photo.jpg',
  objectUrl: 'blob:photo-1',
  width: 1200,
  height: 1600,
  size: 1024,
}

afterEach(() => {
  cleanup()
})

/** 渲染规格步骤并暴露关键交互回调，喵~ */
function renderSpecCropStep(options: { spec?: PhotoSpec; customPhotoSpecs?: PhotoSpec[] } = {}) {
  const photo = createInitialAppPhoto(ASSET)
  if (options.spec) photo.spec = options.spec
  const onSpecChange = vi.fn()
  const onCustomSizeApply = vi.fn()
  render(
    <SpecCropStep
      photos={[photo]}
      customPhotoSpecs={options.customPhotoSpecs ?? []}
      activePhoto={photo}
      mode="single"
      zoom={1}
      outputPlan={null}
      outputDpiInput="300"
      isOutputDpiValid
      isExporting={false}
      isModelSwitching={false}
      onPhotoSelect={vi.fn()}
      onSpecChange={onSpecChange}
      onCustomSizeApply={onCustomSizeApply}
      onOutputDpiChange={vi.fn()}
      onZoomChange={vi.fn()}
      onResetCrop={vi.fn()}
      onExport={vi.fn()}
      onBack={vi.fn()}
      onNext={vi.fn()}
    />,
  )
  return { onCustomSizeApply, onSpecChange }
}

describe('SpecCropStep custom size', () => {
  it('确认前保留当前规格并只提交合法整数宽高', () => {
    const { onCustomSizeApply, onSpecChange } = renderSpecCropStep()
    const selector = screen.getByLabelText('业务规格')

    fireEvent.change(selector, { target: { value: '__create-custom-spec__' } })
    expect(selector).toHaveProperty('value', 'one-inch')
    expect(screen.getByRole('spinbutton', { name: /宽度/ })).toHaveProperty('value', '25')
    expect(screen.getByRole('spinbutton', { name: /高度/ })).toHaveProperty('value', '35')

    fireEvent.change(screen.getByRole('spinbutton', { name: /宽度/ }), { target: { value: '30.5' } })
    expect(screen.getByRole('button', { name: '应用尺寸' })).toHaveProperty('disabled', true)
    expect(screen.getByText('请输入 1–500 的整数毫米值。')).toBeTruthy()
    expect(onCustomSizeApply).not.toHaveBeenCalled()
    expect(onSpecChange).not.toHaveBeenCalled()

    fireEvent.change(screen.getByRole('spinbutton', { name: /宽度/ }), { target: { value: '30' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: /高度/ }), { target: { value: '40' } })
    fireEvent.click(screen.getByRole('button', { name: '应用尺寸' }))

    expect(onCustomSizeApply).toHaveBeenCalledWith('photo-1', 30, 40)
    expect(screen.queryByText('自定义照片尺寸')).toBeNull()
  })

  it('展示并选择本次会话复用的自定义规格', () => {
    const customSpec = createCustomPhotoSpec(30, 40)
    const oneInch = getPhotoSpec('one-inch')
    if (!oneInch) throw new Error('测试缺少一寸规格')
    const { onSpecChange } = renderSpecCropStep({ spec: oneInch, customPhotoSpecs: [customSpec] })

    expect(screen.getByRole('option', { name: '自定义 · 30×40mm' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText('业务规格'), { target: { value: customSpec.id } })

    expect(onSpecChange).toHaveBeenCalledWith('photo-1', customSpec.id)
  })
})
