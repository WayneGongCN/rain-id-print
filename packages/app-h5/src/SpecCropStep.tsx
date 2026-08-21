import { useEffect, useState } from 'react'
import { PHOTO_SPECS, type PhotoOutputPlan, type PhotoSpec, type PhotoSpecGroup } from '@rainnear/core'
import {
  MAX_CUSTOM_PHOTO_SIZE_MM,
  MIN_CUSTOM_PHOTO_SIZE_MM,
  formatPhotoSpecLabel,
  parseCustomPhotoDimension,
} from './custom-photo-spec'
import type { AppPhoto, UploadMode } from './editor-types'

interface SpecCropStepProps {
  photos: AppPhoto[]
  customPhotoSpecs: readonly PhotoSpec[]
  activePhoto: AppPhoto | null
  mode: UploadMode
  zoom: number
  outputPlan: PhotoOutputPlan | null
  outputWarning?: string
  outputDpiInput: string
  isOutputDpiValid: boolean
  isExporting: boolean
  isModelSwitching: boolean
  onPhotoSelect: (photoId: string) => void
  onSpecChange: (photoId: string, specId: string) => void
  onCustomSizeApply: (photoId: string, width: number, height: number) => void
  onOutputDpiChange: (photoId: string, value: string) => void
  onZoomChange: (photoId: string, zoom: number) => void
  onResetCrop: (photoId: string) => void
  onExport: () => void
  onBack: () => void
  onNext: () => void
}

const PHOTO_SPEC_GROUPS: readonly { id: PhotoSpecGroup; label: string }[] = [
  { id: 'common-size', label: '常用尺寸' },
  { id: 'china-document', label: '中国证件' },
  { id: 'visa', label: '签证' },
]

const CREATE_CUSTOM_SPEC_VALUE = '__create-custom-spec__'

/** 展示逐张业务规格选择、缩放参数和单张成片导出入口，喵~ */
export function SpecCropStep(props: SpecCropStepProps) {
  const [isCustomSizeOpen, setIsCustomSizeOpen] = useState(false)
  const [customWidthInput, setCustomWidthInput] = useState('')
  const [customHeightInput, setCustomHeightInput] = useState('')
  const spec = props.activePhoto?.spec
  const activeIndex = props.activePhoto ? props.photos.findIndex((photo) => photo.id === props.activePhoto?.id) : -1
  const isInactiveInSingleMode = props.mode === 'single' && activeIndex > 0
  const customWidth = parseCustomPhotoDimension(customWidthInput)
  const customHeight = parseCustomPhotoDimension(customHeightInput)
  const isCustomSizeValid = customWidth !== undefined && customHeight !== undefined

  // 切换照片时关闭未提交的草稿，避免把上一张照片的尺寸误用到当前照片，喵~
  useEffect(() => {
    setIsCustomSizeOpen(false)
  }, [props.activePhoto?.id])

  /** 使用当前生效规格初始化自定义尺寸草稿，喵~ */
  function openCustomSizeEditor(): void {
    if (!spec) return
    setCustomWidthInput(String(spec.width))
    setCustomHeightInput(String(spec.height))
    setIsCustomSizeOpen(true)
  }

  /** 处理内置、会话自定义和新建自定义三类规格选项，喵~ */
  function handleSpecChange(value: string): void {
    if (!props.activePhoto) return
    if (value === CREATE_CUSTOM_SPEC_VALUE) {
      openCustomSizeEditor()
      return
    }
    setIsCustomSizeOpen(false)
    props.onSpecChange(props.activePhoto.id, value)
  }

  /** 在宽高均合法时提交自定义规格并关闭编辑区，喵~ */
  function applyCustomSize(): void {
    if (!props.activePhoto || customWidth === undefined || customHeight === undefined) return
    props.onCustomSizeApply(props.activePhoto.id, customWidth, customHeight)
    setIsCustomSizeOpen(false)
  }

  return (
    <section className="step-panel" aria-labelledby="crop-step-title">
      <div className="panel-heading"><span>02</span><div><h2 id="crop-step-title">规格与裁切</h2><p>逐张调整尺寸、缩放和人物位置</p></div></div>

      <div className="crop-photo-strip" aria-label="待裁切照片">
        {props.photos.map((photo, index) => (
          <button
            key={photo.id}
            type="button"
            className={`${photo.id === props.activePhoto?.id ? 'selected' : ''} ${props.mode === 'single' && index > 0 ? 'is-inactive' : ''}`}
            onClick={() => props.onPhotoSelect(photo.id)}
          >
            <img src={photo.objectUrl} alt="" />
            <span>{photo.name}</span>
          </button>
        ))}
      </div>

      {props.activePhoto && spec ? (
        <>
          {isInactiveInSingleMode && <div className="warning">这张照片当前不参与单照片排版；切换到混合排版后会使用这里保存的规格和裁切。</div>}
          <div className="crop-settings-grid">
            <label>业务规格<select value={props.activePhoto.spec.id} onChange={(event) => handleSpecChange(event.target.value)}>
              {PHOTO_SPEC_GROUPS.map((group) => (
                <optgroup key={group.id} label={group.label}>
                  {PHOTO_SPECS.filter((item) => item.group === group.id).map((item) => (
                    <option key={item.id} value={item.id}>{formatPhotoSpecLabel(item)}</option>
                  ))}
                </optgroup>
              ))}
              {props.customPhotoSpecs.length > 0 && (
                <optgroup label="本次自定义">
                  {props.customPhotoSpecs.map((item) => <option key={item.id} value={item.id}>{formatPhotoSpecLabel(item)}</option>)}
                </optgroup>
              )}
              <option value={CREATE_CUSTOM_SPEC_VALUE}>＋ 新建自定义尺寸…</option>
            </select></label>
            <label>成片精度<div className="dpi-input-wrap"><input type="number" min="72" max="600" step="1" value={props.outputDpiInput} aria-invalid={!props.isOutputDpiValid} onChange={(event) => props.onOutputDpiChange(props.activePhoto!.id, event.target.value)} /><span>DPI</span></div></label>
          </div>

          {spec.group === 'custom' && !isCustomSizeOpen && <button className="custom-size-edit-button" type="button" onClick={openCustomSizeEditor}>修改当前自定义尺寸</button>}
          {isCustomSizeOpen && (
            <fieldset className="custom-size-editor">
              <legend>自定义照片尺寸</legend>
              <div className="custom-size-input-grid">
                <label htmlFor="custom-photo-width">宽度<div className="custom-size-input-wrap"><input id="custom-photo-width" type="number" min={MIN_CUSTOM_PHOTO_SIZE_MM} max={MAX_CUSTOM_PHOTO_SIZE_MM} step="1" inputMode="numeric" value={customWidthInput} aria-invalid={customWidth === undefined} aria-describedby="custom-photo-size-hint" onChange={(event) => setCustomWidthInput(event.target.value)} /><span>mm</span></div></label>
                <label htmlFor="custom-photo-height">高度<div className="custom-size-input-wrap"><input id="custom-photo-height" type="number" min={MIN_CUSTOM_PHOTO_SIZE_MM} max={MAX_CUSTOM_PHOTO_SIZE_MM} step="1" inputMode="numeric" value={customHeightInput} aria-invalid={customHeight === undefined} aria-describedby="custom-photo-size-hint" onChange={(event) => setCustomHeightInput(event.target.value)} /><span>mm</span></div></label>
              </div>
              <p id="custom-photo-size-hint" className={isCustomSizeValid ? 'custom-size-hint' : 'custom-size-hint is-error'}>{isCustomSizeValid ? '应用后仅修改当前照片，其他照片不受影响。' : `请输入 ${MIN_CUSTOM_PHOTO_SIZE_MM}–${MAX_CUSTOM_PHOTO_SIZE_MM} 的整数毫米值。`}</p>
              <div className="custom-size-actions"><button type="button" onClick={() => setIsCustomSizeOpen(false)}>取消</button><button type="button" className="primary" disabled={!isCustomSizeValid} onClick={applyCustomSize}>应用尺寸</button></div>
            </fieldset>
          )}

          <div className="spec-output-summary">
            <div><span>物理尺寸</span><strong>{spec.width} × {spec.height} mm</strong></div>
            <div><span>输出像素</span><strong>{props.outputPlan ? `${props.outputPlan.pixelSize.width} × ${props.outputPlan.pixelSize.height} px` : '参数无效'}</strong></div>
          </div>

          {spec.notice && <p className="spec-notice">{spec.notice}</p>}
          {spec.references && spec.references.length > 0 && (
            <details className="spec-references"><summary>查看规格依据</summary>{spec.references.map((reference) => <a key={reference.url} href={reference.url} target="_blank" rel="noreferrer">{reference.name} · 核验于 {reference.verifiedAt}</a>)}</details>
          )}

          <label className="range-field crop-zoom-field"><span>缩放 <b>{Math.round(props.zoom * 100)}%</b></span><input type="range" min="100" max="400" step="1" value={Math.round(props.zoom * 100)} onChange={(event) => props.onZoomChange(props.activePhoto!.id, Number(event.target.value) / 100)} /></label>
          <div className="crop-actions">
            <button type="button" onClick={() => props.onResetCrop(props.activePhoto!.id)}>恢复居中</button>
            <small>可在右侧预览中拖动移动，滚轮或双指缩放</small>
          </div>

          {props.outputWarning && <div className="error-message">{props.outputWarning}</div>}
          <button className="secondary-export-button" type="button" disabled={!props.outputPlan || !props.isOutputDpiValid || Boolean(props.outputWarning) || Boolean(props.activePhoto.processingText) || props.isExporting || props.isModelSwitching} onClick={props.onExport}>
            {props.isExporting ? '正在生成规格照片…' : `下载当前${spec.name}照片`} <b>↓</b>
          </button>
          <p className="export-note">输出保证物理尺寸与 DPI，不检测人像比例或办证审核规则</p>
        </>
      ) : <p className="empty-step-copy">请先添加一张照片。</p>}

      <div className="step-navigation"><button type="button" onClick={props.onBack}>← 返回照片处理</button><button type="button" className="primary" disabled={!props.activePhoto} onClick={props.onNext}>下一步：纸张排版 →</button></div>
    </section>
  )
}
