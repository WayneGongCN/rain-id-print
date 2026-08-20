import { PAPER_SPECS } from '@rainnear/core'
import type { AppPhoto, UploadMode } from './editor-types'

interface LayoutStepProps {
  photos: AppPhoto[]
  mode: UploadMode
  paperSpecId: string
  separatorColor: string
  exportDpiInput: string
  exportDpi: number
  recommendedExportDpi: number
  isExportDpiInputValid: boolean
  gapMm: number
  countMode: 'auto' | 'custom'
  customCount: number
  onPaperSpecChange: (value: string) => void
  onSeparatorColorChange: (value: string) => void
  onExportDpiChange: (value: string) => void
  onExportDpiBlur: () => void
  onGapChange: (value: number) => void
  onCountModeChange: (value: 'auto' | 'custom') => void
  onCustomCountChange: (value: number) => void
  onCopiesChange: (photoId: string, copies: number) => void
  onBack: () => void
}

/** 展示冲印纸张、份数、间距和整纸导出参数，喵~ */
export function LayoutStep(props: LayoutStepProps) {
  return (
    <section className="step-panel" aria-labelledby="layout-step-title">
      <div className="panel-heading"><span>03</span><div><h2 id="layout-step-title">纸张与排版</h2><p>设置冲印纸、照片数量和裁切间距</p></div></div>
      <div className="settings-grid">
        <label>冲印纸张<select value={props.paperSpecId} onChange={(event) => props.onPaperSpecChange(event.target.value)}>{PAPER_SPECS.map((spec) => <option key={spec.id} value={spec.id}>{spec.name} · {spec.width}×{spec.height}mm</option>)}</select></label>
        <label>分隔线<select value={props.separatorColor} onChange={(event) => props.onSeparatorColorChange(event.target.value)}><option value="#334155">深灰</option><option value="#356bd8">蓝色</option><option value="#ffffff">白色</option></select></label>
      </div>
      <div className="dpi-setting">
        <label htmlFor="export-dpi">导出精度</label>
        <div className="dpi-input-wrap"><input id="export-dpi" type="number" min="72" max="600" step="1" inputMode="numeric" value={props.exportDpiInput} aria-invalid={!props.isExportDpiInputValid} aria-describedby="export-dpi-hint" onChange={(event) => props.onExportDpiChange(event.target.value)} onBlur={props.onExportDpiBlur} /><span>DPI</span></div>
        <small id="export-dpi-hint">{props.isExportDpiInputValid ? `所选照片建议至少 ${props.recommendedExportDpi} DPI` : '请输入 72–600 的整数'}</small>
      </div>
      <label className="range-field"><span>裁切间距 <b>{props.gapMm.toFixed(1)} mm</b></span><input type="range" min="0" max="10" step="0.5" value={props.gapMm} onChange={(event) => props.onGapChange(Number(event.target.value))} /></label>

      {props.mode === 'single' ? (
        <div className="count-setting">
          <span>照片数量</span>
          <div className="segmented"><button type="button" className={props.countMode === 'auto' ? 'active' : ''} onClick={() => props.onCountModeChange('auto')}>自动铺满</button><button type="button" className={props.countMode === 'custom' ? 'active' : ''} onClick={() => props.onCountModeChange('custom')}>指定数量</button></div>
          {props.countMode === 'custom' && <input type="number" min="1" max="100" value={props.customCount} onChange={(event) => props.onCustomCountChange(Math.min(100, Math.max(1, Number(event.target.value))))} />}
        </div>
      ) : (
        <div className="copy-list">
          <span>各照片份数</span>
          {props.photos.map((photo) => <label key={photo.id}><span><img src={photo.objectUrl} alt="" />{photo.name}</span><input type="number" min="1" max="50" value={photo.copies} onChange={(event) => props.onCopiesChange(photo.id, Math.min(50, Math.max(1, Number(event.target.value))))} /></label>)}
        </div>
      )}
      <div className="step-navigation single"><button type="button" onClick={props.onBack}>← 返回规格与裁切</button></div>
    </section>
  )
}
