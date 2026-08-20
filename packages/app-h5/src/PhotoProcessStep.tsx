import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import type { BackgroundMode, BackgroundTuning } from '@rainnear/core'
import type { BackgroundRemovalModelDescriptor, BackgroundRemovalModelId } from '@rainnear/plateform-h5'
import type { AppPhoto, ModelSwitchProgress, UploadMode } from './editor-types'

interface PhotoProcessStepProps {
  photos: AppPhoto[]
  activePhotoId: string | null
  mode: UploadMode
  isImporting: boolean
  isModelSettingsOpen: boolean
  isModelSwitching: boolean
  currentModelName?: string
  backgroundRemovalModelId: BackgroundRemovalModelId
  models: readonly BackgroundRemovalModelDescriptor[]
  modelSwitchProgress: ModelSwitchProgress | null
  onImportFiles: (files: Iterable<File>, inputMethod: 'picker' | 'drop') => void
  onModeChange: (mode: UploadMode) => void
  onModelSettingsToggle: () => void
  onModelChange: (modelId: BackgroundRemovalModelId) => void
  onPhotoSelect: (photoId: string) => void
  onRemovePhoto: (photoId: string) => void
  onBackgroundChange: (photoId: string, background: BackgroundMode) => void
  onUpdatePhoto: (photoId: string, patch: Partial<AppPhoto>) => void
  onUpdateTuning: (photoId: string, patch: Partial<BackgroundTuning>) => void
  onResetTuning: (photoId: string) => void
  onNext: () => void
}

const BACKGROUND_OPTIONS: Array<{ value: BackgroundMode; label: string; color?: string }> = [
  { value: 'keep', label: '原图' },
  { value: 'white', label: '白', color: '#ffffff' },
  { value: 'blue', label: '蓝', color: '#438edb' },
  { value: 'red', label: '红', color: '#d6453d' },
  { value: 'gray', label: '灰', color: '#c8c8c8' },
]

/** 将模型资源大小转换为适合设置面板展示的近似值，喵~ */
function formatDownloadSize(bytes?: number): string {
  if (!bytes) return '按需加载'
  return `首次约 ${Math.round(bytes / 1024 / 1024)} MB`
}

/** 展示照片上传、排版模式、换底和专业蒙版微调控件，喵~ */
export function PhotoProcessStep(props: PhotoProcessStepProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  /** 响应文件选择并允许稍后再次选择同名文件，喵~ */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    if (event.target.files) props.onImportFiles(event.target.files, 'picker')
    event.target.value = ''
  }

  /** 接收拖入上传区域的本地图片，喵~ */
  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setIsDragging(false)
    props.onImportFiles(event.dataTransfer.files, 'drop')
  }

  return (
    <section className="step-panel" aria-labelledby="process-step-title">
      <div className="panel-heading"><span>01</span><div><h2 id="process-step-title">照片处理</h2><p>添加照片并完成换底与边缘微调</p></div></div>

      <button
        className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
        type="button"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <span className="upload-icon">＋</span>
        <strong>{props.isImporting ? '正在读取照片…' : '添加本地照片'}</strong>
        <small>点击选择或拖拽到这里 · 单张不超过 8MB</small>
      </button>
      <input ref={fileInputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />

      {props.photos.length > 0 && (
        <div className="mode-tabs" role="tablist" aria-label="排版模式">
          <button type="button" role="tab" aria-selected={props.mode === 'single'} className={props.mode === 'single' ? 'active' : ''} onClick={() => props.onModeChange('single')}>单照片</button>
          <button type="button" role="tab" aria-selected={props.mode === 'mixed'} className={props.mode === 'mixed' ? 'active' : ''} onClick={() => props.onModeChange('mixed')}>混合排版</button>
        </div>
      )}

      {props.photos.length > 0 && (
        <div className={`model-settings ${props.isModelSettingsOpen ? 'is-open' : ''}`}>
          <button className="model-settings-toggle" type="button" aria-expanded={props.isModelSettingsOpen} onClick={props.onModelSettingsToggle}>
            <span><b>AI</b> 高级抠图设置</span>
            <small>{props.modelSwitchProgress ? `${props.modelSwitchProgress.modelName} ${props.modelSwitchProgress.current}/${props.modelSwitchProgress.total}` : props.currentModelName}</small>
          </button>
          {props.isModelSettingsOpen && (
            <fieldset className="model-options" disabled={props.isModelSwitching}>
              <legend>选择全局抠图模型</legend>
              {props.models.map((model) => (
                <label className={props.backgroundRemovalModelId === model.id ? 'selected' : ''} key={model.id}>
                  <input
                    type="radio"
                    name="background-removal-model"
                    value={model.id}
                    checked={props.backgroundRemovalModelId === model.id}
                    onChange={() => props.onModelChange(model.id)}
                  />
                  <span><strong>{model.name}</strong><small>{model.description}</small></span>
                  <em>{formatDownloadSize(model.estimatedDownloadBytes)}</em>
                </label>
              ))}
              {props.modelSwitchProgress && (
                <div className="model-switch-progress"><i />正在准备{props.modelSwitchProgress.modelName} {props.modelSwitchProgress.current}/{props.modelSwitchProgress.total} · {props.modelSwitchProgress.detail}</div>
              )}
            </fieldset>
          )}
        </div>
      )}

      <div className="photo-list">
        {props.photos.map((photo, index) => (
          <article className={`photo-card ${photo.id === props.activePhotoId ? 'is-active' : ''} ${props.mode === 'single' && index > 0 ? 'is-muted' : ''}`} key={photo.id}>
            <button className="photo-thumbnail-button" type="button" aria-label={`选择并预览 ${photo.name}`} aria-pressed={photo.id === props.activePhotoId} onClick={() => props.onPhotoSelect(photo.id)}>
              <img src={photo.objectUrl} alt="" />
            </button>
            <div className="photo-fields">
              <div className="photo-title"><button className="photo-name-button" type="button" aria-pressed={photo.id === props.activePhotoId} onClick={() => props.onPhotoSelect(photo.id)}>{photo.name}</button><button type="button" onClick={() => props.onRemovePhoto(photo.id)} aria-label={`删除 ${photo.name}`}>×</button></div>
              <div className="background-row">
                <span>底色</span>
                {BACKGROUND_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={photo.background === option.value ? 'selected' : ''}
                    onClick={() => { props.onPhotoSelect(photo.id); props.onBackgroundChange(photo.id, option.value) }}
                    aria-label={`设置${option.label}底色`}
                    aria-pressed={photo.background === option.value}
                    disabled={Boolean(photo.processingText) || props.isModelSwitching}
                  >
                    {option.color ? <i style={{ background: option.color }} /> : '原'}
                  </button>
                ))}
              </div>
              {photo.processingText && <div className="processing"><i />{photo.processingText}</div>}
              {photo.background !== 'keep' && !photo.processingText && (
                <div className={`professional-tools ${photo.professionalOpen ? 'is-open' : ''}`}>
                  <button
                    className="professional-toggle"
                    type="button"
                    aria-expanded={photo.professionalOpen}
                    onClick={() => { props.onPhotoSelect(photo.id); props.onUpdatePhoto(photo.id, { professionalOpen: !photo.professionalOpen }) }}
                  >
                    <span><b>PRO</b> 专业微调</span>
                    <small>{photo.professionalOpen ? '收起' : '调整边缘'}</small>
                  </button>
                  {photo.professionalOpen && (
                    <div className="professional-panel">
                      <label><span>边缘收缩 / 扩张 <b>{photo.tuning.edgeShiftPx > 0 ? '+' : ''}{photo.tuning.edgeShiftPx} px</b></span><input type="range" min="-8" max="8" step="1" value={photo.tuning.edgeShiftPx} onChange={(event) => { props.onPhotoSelect(photo.id); props.onUpdateTuning(photo.id, { edgeShiftPx: Number(event.target.value) }) }} /></label>
                      <label><span>边缘硬度 <b>{photo.tuning.edgeHardness}%</b></span><input type="range" min="0" max="100" step="5" value={photo.tuning.edgeHardness} onChange={(event) => { props.onPhotoSelect(photo.id); props.onUpdateTuning(photo.id, { edgeHardness: Number(event.target.value) }) }} /></label>
                      <label><span>羽化 <b>{photo.tuning.featherPx.toFixed(1)} px</b></span><input type="range" min="0" max="8" step="0.5" value={photo.tuning.featherPx} onChange={(event) => { props.onPhotoSelect(photo.id); props.onUpdateTuning(photo.id, { featherPx: Number(event.target.value) }) }} /></label>
                      <label><span>去色溢出 <b>{photo.tuning.decontaminate}%</b></span><input type="range" min="0" max="100" step="5" value={photo.tuning.decontaminate} onChange={(event) => { props.onPhotoSelect(photo.id); props.onUpdateTuning(photo.id, { decontaminate: Number(event.target.value) }) }} /></label>
                      <div className="professional-hint"><span>拖动即实时预览，导出会保留相同效果</span><button type="button" onClick={() => { props.onPhotoSelect(photo.id); props.onResetTuning(photo.id) }}>重置参数</button></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>

      <button className="step-next-button" type="button" disabled={props.photos.length === 0} onClick={props.onNext}>下一步：规格与裁切 <b>→</b></button>
    </section>
  )
}
