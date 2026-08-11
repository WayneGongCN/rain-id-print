import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type MouseEvent } from 'react'
import {
  DEFAULT_BACKGROUND_TUNING,
  PAPER_SPECS,
  PHOTO_SPECS,
  createLayout,
  getPaperSpec,
  getPhotoSpec,
  normalizeBackgroundTuning,
  type BackgroundMode,
  type BackgroundTuning,
  type LayoutPlan,
  type PhotoLayoutInput,
} from '@rainnear/core'
import { createH5Platform, type BackgroundProgress, type H5ImageAsset } from '@rainnear/plateform-h5'
import alipayRewardCode from './assets/alipay-reward-code.jpg'
import wechatRewardCode from './assets/wechat-reward-code.jpg'
import { SeoDetails, SeoIntro } from './SeoContent'
import { trackAnalyticsEvent } from './analytics'

interface AppPhoto extends H5ImageAsset {
  sizeSpecId: string
  copies: number
  background: BackgroundMode
  tuning: BackgroundTuning
  professionalOpen: boolean
  processingText?: string
}

type UploadMode = 'single' | 'mixed'

const BACKGROUND_OPTIONS: Array<{ value: BackgroundMode; label: string; color?: string }> = [
  { value: 'keep', label: '原图' },
  { value: 'white', label: '白', color: '#ffffff' },
  { value: 'blue', label: '蓝', color: '#438edb' },
  { value: 'red', label: '红', color: '#d6453d' },
  { value: 'gray', label: '灰', color: '#c8c8c8' },
]

/** 将平台图片和用户规格选择转换为核心布局输入，喵~ */
function toLayoutInput(photo: AppPhoto): PhotoLayoutInput {
  const spec = getPhotoSpec(photo.sizeSpecId) ?? PHOTO_SPECS[0]
  if (!spec) throw new Error('缺少默认照片规格')
  return {
    id: photo.id,
    sourceWidthPx: photo.width,
    sourceHeightPx: photo.height,
    width: spec.width,
    height: spec.height,
    copies: photo.copies,
    background: photo.background,
  }
}

/** 根据底层模型进度生成适合用户阅读的状态文案，喵~ */
function formatProgress(progress: BackgroundProgress): string {
  if (progress.phase === 'processing') return '正在智能抠图…'
  if (progress.current && progress.total) return `首次加载模型 ${Math.round((progress.current / progress.total) * 100)}%`
  return '正在加载本地模型…'
}

/** 提供 H5 MVP 的照片编辑、实时预览和本地导出流程，喵~ */
export function App() {
  const platform = useMemo(() => createH5Platform(), [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rewardButtonRef = useRef<HTMLButtonElement>(null)
  const rewardCloseButtonRef = useRef<HTMLButtonElement>(null)
  const [photos, setPhotos] = useState<AppPhoto[]>([])
  const [mode, setMode] = useState<UploadMode>('single')
  const [paperSpecId, setPaperSpecId] = useState('6r')
  const [gapMm, setGapMm] = useState(2)
  const [countMode, setCountMode] = useState<'auto' | 'custom'>('auto')
  const [customCount, setCustomCount] = useState(8)
  const [separatorColor, setSeparatorColor] = useState('#334155')
  const [isDragging, setIsDragging] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isRewardOpen, setIsRewardOpen] = useState(false)
  const [message, setMessage] = useState('')

  const layout = useMemo<LayoutPlan | null>(() => {
    if (photos.length === 0) return null
    const paper = getPaperSpec(paperSpecId)
    if (!paper) return null
    const selectedPhotos = mode === 'single' ? photos.slice(0, 1) : photos
    return createLayout({
      mode: mode === 'mixed' ? 'mixed' : countMode === 'auto' ? 'single-auto' : 'single-count',
      paper,
      photos: selectedPhotos.map(toLayoutInput),
      gapMm,
      dpi: 300,
      targetCount: countMode === 'custom' ? customCount : undefined,
    })
  }, [countMode, customCount, gapMm, mode, paperSpecId, photos])

  const backgrounds = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo.background])),
    [photos],
  )

  const backgroundTunings = useMemo(
    () => new Map(photos.map((photo) => [photo.id, photo.tuning])),
    [photos],
  )

  // 当布局或底色变化时刷新低清预览，不创建 300 DPI 大画布，喵~
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !layout) return
    const timer = window.setTimeout(() => {
      platform.renderPreview(canvas, layout, backgrounds, {
        separatorColor,
        previewMaxEdge: 1400,
        backgroundTunings,
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '预览生成失败'))
    }, 80)
    return () => window.clearTimeout(timer)
  }, [backgrounds, backgroundTunings, layout, platform, separatorColor])

  // 页面卸载时释放所有 Object URL 和模型结果，避免长时间占用内存，喵~
  useEffect(() => () => platform.dispose(), [platform])

  // 赞赏浮层打开时锁定页面滚动，并将键盘焦点限制在关闭按钮上，喵~
  useEffect(() => {
    if (!isRewardOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    rewardCloseButtonRef.current?.focus()

    function handleDialogKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsRewardOpen(false)
        window.requestAnimationFrame(() => rewardButtonRef.current?.focus())
      }
      if (event.key === 'Tab') {
        event.preventDefault()
        rewardCloseButtonRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleDialogKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleDialogKeyDown)
    }
  }, [isRewardOpen])

  /** 关闭赞赏浮层并将焦点还给导航栏入口，喵~ */
  function closeRewardDialog(): void {
    setIsRewardOpen(false)
    window.requestAnimationFrame(() => rewardButtonRef.current?.focus())
  }

  /** 仅当用户点击遮罩本身时关闭赞赏浮层，喵~ */
  function handleRewardBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) closeRewardDialog()
  }

  /** 打开赞赏浮层并记录入口使用情况，喵~ */
  function openRewardDialog(): void {
    setIsRewardOpen(true)
    trackAnalyticsEvent('reward_dialog_open', {})
  }

  /** 导入用户选择的图片并初始化照片配置，喵~ */
  async function importFiles(files: Iterable<File>, inputMethod: 'picker' | 'drop'): Promise<void> {
    setMessage('')
    setIsImporting(true)
    try {
      const assets = await platform.importFiles(files)
      if (assets.length === 0) return
      setPhotos((current) => [
        ...current,
        ...assets.map((asset) => ({
          ...asset,
          sizeSpecId: 'one-inch',
          copies: 1,
          background: 'keep' as const,
          tuning: { ...DEFAULT_BACKGROUND_TUNING },
          professionalOpen: false,
        })),
      ])
      trackAnalyticsEvent('photo_import', {
        input_method: inputMethod,
        photo_count: assets.length,
      })
      if ((assets.length > 1 || photos.length > 0) && mode !== 'mixed') {
        setMode('mixed')
        trackAnalyticsEvent('layout_mode_change', { layout_mode: 'mixed' })
      }
    } catch (error) {
      trackAnalyticsEvent('photo_import_error', { input_method: inputMethod })
      setMessage(error instanceof Error ? error.message : '图片导入失败')
    } finally {
      setIsImporting(false)
    }
  }

  /** 响应文件选择框变化并清空其值以允许重复选择同名文件，喵~ */
  function handleFileChange(event: ChangeEvent<HTMLInputElement>): void {
    const files = event.target.files
    if (files) void importFiles(files, 'picker')
    event.target.value = ''
  }

  /** 接收拖入上传区域的图片文件，喵~ */
  function handleDrop(event: DragEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setIsDragging(false)
    void importFiles(event.dataTransfer.files, 'drop')
  }

  /** 仅在排版模式实际变化时更新状态并发送分析事件，喵~ */
  function changeLayoutMode(layoutMode: UploadMode): void {
    if (layoutMode === mode) return
    setMode(layoutMode)
    trackAnalyticsEvent('layout_mode_change', { layout_mode: layoutMode })
  }

  /** 更新一张照片的尺寸或份数等可编辑字段，喵~ */
  function updatePhoto(photoId: string, patch: Partial<AppPhoto>): void {
    setPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, ...patch } : photo))
  }

  /** 更新一张照片的专业蒙版参数并立即触发预览重绘，喵~ */
  function updatePhotoTuning(photoId: string, patch: Partial<BackgroundTuning>): void {
    setPhotos((current) => current.map((photo) => photo.id === photoId
      ? { ...photo, tuning: normalizeBackgroundTuning({ ...photo.tuning, ...patch }) }
      : photo))
  }

  /** 将一张照片的专业蒙版参数恢复为模型原始输出，喵~ */
  function resetPhotoTuning(photoId: string): void {
    updatePhotoTuning(photoId, DEFAULT_BACKGROUND_TUNING)
  }

  /** 删除照片并同步释放平台层图像资源，喵~ */
  function removePhoto(photoId: string): void {
    platform.removeAsset(photoId)
    setPhotos((current) => current.filter((photo) => photo.id !== photoId))
  }

  /** 切换照片底色，非原图模式会先完成一次本地智能抠图，喵~ */
  async function changeBackground(photoId: string, background: BackgroundMode): Promise<void> {
    const photo = photos.find((item) => item.id === photoId)
    if (!photo || photo.background === background) return
    setMessage('')
    if (background === 'keep') {
      updatePhoto(photoId, { background, processingText: undefined })
      trackAnalyticsEvent('background_change', { background_mode: background })
      return
    }

    updatePhoto(photoId, { processingText: '正在加载本地模型…' })
    try {
      await platform.prepareCutout(photoId, (progress) => {
        updatePhoto(photoId, { processingText: formatProgress(progress) })
      })
      updatePhoto(photoId, { background, processingText: undefined })
      trackAnalyticsEvent('background_change', { background_mode: background })
    } catch (error) {
      updatePhoto(photoId, { processingText: undefined })
      trackAnalyticsEvent('background_change_error', { background_mode: background })
      setMessage(error instanceof Error ? `智能换底失败：${error.message}` : '智能换底失败')
    }
  }

  /** 将当前完整布局导出为本地 300 DPI JPEG，喵~ */
  async function exportImage(): Promise<void> {
    if (!layout || layout.rejected.length > 0) return
    setMessage('')
    setIsExporting(true)
    try {
      const blob = await platform.exportJpeg(layout, backgrounds, {
        separatorColor,
        maxExportPixels: 25_000_000,
        backgroundTunings,
      })
      const paper = getPaperSpec(paperSpecId)
      platform.download(blob, `rainnear_${layout.placedCount}张_${paper?.name ?? '照片纸'}_300dpi.jpg`)
      trackAnalyticsEvent('photo_export', {
        layout_mode: mode,
        paper_spec_id: paperSpecId,
        placed_count: layout.placedCount,
      })
    } catch (error) {
      trackAnalyticsEvent('photo_export_error', {
        layout_mode: mode,
        paper_spec_id: paperSpecId,
        placed_count: layout.placedCount,
      })
      setMessage(error instanceof Error ? error.message : '照片导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">R</span>
          <span><strong>雨邻证照</strong><small>RAINNEAR PHOTO</small></span>
        </a>
        <div className="topbar-actions">
          <a className="privacy-pill" href="#privacy"><span aria-hidden="true">●</span><span className="privacy-text">照片仅在本地处理</span></a>
          <button
            ref={rewardButtonRef}
            className="reward-trigger"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={isRewardOpen}
            onClick={openRewardDialog}
          >
            赞赏
          </button>
        </div>
      </header>

      {isRewardOpen && (
        <div className="reward-backdrop" onMouseDown={handleRewardBackdropClick}>
          <section
            className="reward-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reward-dialog-title"
            aria-describedby="reward-dialog-description"
          >
            <button
              ref={rewardCloseButtonRef}
              className="reward-close"
              type="button"
              aria-label="关闭赞赏浮层"
              onClick={closeRewardDialog}
            >
              ×
            </button>
            <div className="reward-heading">
              <span>THANK YOU</span>
              <h2 id="reward-dialog-title">感谢支持</h2>
              <p id="reward-dialog-description">选择微信或支付宝扫码赞赏</p>
            </div>
            <div className="reward-code-grid">
              <figure className="reward-code-card">
                <figcaption><i className="wechat-dot" />微信赞赏码</figcaption>
                <div className="reward-code-frame wechat-code-frame">
                  <img src={wechatRewardCode} alt="微信赞赏码" />
                </div>
              </figure>
              <figure className="reward-code-card">
                <figcaption><i className="alipay-dot" />支付宝收款码</figcaption>
                <div className="reward-code-frame alipay-code-frame">
                  <img src={alipayRewardCode} alt="支付宝收款码" />
                </div>
              </figure>
            </div>
          </section>
        </div>
      )}

      <main id="top" className="workspace">
        <SeoIntro />

        <section id="editor" className="editor-grid" aria-label="证件照排版编辑器">
          <aside className="control-panel">
            <div className="panel-heading"><span>01</span><div><h2>照片与规格</h2><p>添加照片并设置冲印尺寸</p></div></div>

            <button
              className={`upload-zone ${isDragging ? 'is-dragging' : ''}`}
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <span className="upload-icon">＋</span>
              <strong>{isImporting ? '正在读取照片…' : '添加本地照片'}</strong>
              <small>点击选择或拖拽到这里 · 单张不超过 8MB</small>
            </button>
            <input ref={fileInputRef} hidden type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} />

            {photos.length > 0 && (
              <div className="mode-tabs" role="tablist" aria-label="排版模式">
                <button type="button" role="tab" aria-selected={mode === 'single'} className={mode === 'single' ? 'active' : ''} onClick={() => changeLayoutMode('single')}>单照片</button>
                <button type="button" role="tab" aria-selected={mode === 'mixed'} className={mode === 'mixed' ? 'active' : ''} onClick={() => changeLayoutMode('mixed')}>混合排版</button>
              </div>
            )}

            <div className="photo-list">
              {photos.map((photo, index) => (
                <article className={`photo-card ${mode === 'single' && index > 0 ? 'is-muted' : ''}`} key={photo.id}>
                  <img src={photo.objectUrl} alt={photo.name} />
                  <div className="photo-fields">
                    <div className="photo-title"><strong>{photo.name}</strong><button onClick={() => removePhoto(photo.id)} aria-label={`删除 ${photo.name}`}>×</button></div>
                    <div className="field-row">
                      <label>尺寸<select value={photo.sizeSpecId} onChange={(event) => updatePhoto(photo.id, { sizeSpecId: event.target.value })}>
                        {PHOTO_SPECS.map((spec) => <option key={spec.id} value={spec.id}>{spec.name} · {spec.width}×{spec.height}mm</option>)}
                      </select></label>
                      {mode === 'mixed' && <label>份数<input type="number" min="1" max="50" value={photo.copies} onChange={(event) => updatePhoto(photo.id, { copies: Math.min(50, Math.max(1, Number(event.target.value))) })} /></label>}
                    </div>
                    <div className="background-row">
                      <span>底色</span>
                      {BACKGROUND_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          className={photo.background === option.value ? 'selected' : ''}
                          onClick={() => void changeBackground(photo.id, option.value)}
                          aria-label={`设置${option.label}底色`}
                          aria-pressed={photo.background === option.value}
                          disabled={Boolean(photo.processingText)}
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
                          onClick={() => updatePhoto(photo.id, { professionalOpen: !photo.professionalOpen })}
                        >
                          <span><b>PRO</b> 专业微调</span>
                          <small>{photo.professionalOpen ? '收起' : '调整边缘'}</small>
                        </button>
                        {photo.professionalOpen && (
                          <div className="professional-panel">
                            <label>
                              <span>边缘收缩 / 扩张 <b>{photo.tuning.edgeShiftPx > 0 ? '+' : ''}{photo.tuning.edgeShiftPx} px</b></span>
                              <input
                                type="range"
                                min="-8"
                                max="8"
                                step="1"
                                value={photo.tuning.edgeShiftPx}
                                onChange={(event) => updatePhotoTuning(photo.id, { edgeShiftPx: Number(event.target.value) })}
                              />
                            </label>
                            <label>
                              <span>边缘硬度 <b>{photo.tuning.edgeHardness}%</b></span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={photo.tuning.edgeHardness}
                                onChange={(event) => updatePhotoTuning(photo.id, { edgeHardness: Number(event.target.value) })}
                              />
                            </label>
                            <label>
                              <span>羽化 <b>{photo.tuning.featherPx.toFixed(1)} px</b></span>
                              <input
                                type="range"
                                min="0"
                                max="8"
                                step="0.5"
                                value={photo.tuning.featherPx}
                                onChange={(event) => updatePhotoTuning(photo.id, { featherPx: Number(event.target.value) })}
                              />
                            </label>
                            <label>
                              <span>去色溢出 <b>{photo.tuning.decontaminate}%</b></span>
                              <input
                                type="range"
                                min="0"
                                max="100"
                                step="5"
                                value={photo.tuning.decontaminate}
                                onChange={(event) => updatePhotoTuning(photo.id, { decontaminate: Number(event.target.value) })}
                              />
                            </label>
                            <div className="professional-hint">
                              <span>拖动即实时预览，导出会保留相同效果</span>
                              <button type="button" onClick={() => resetPhotoTuning(photo.id)}>重置参数</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <div className="divider" />
            <div className="panel-heading compact"><span>02</span><div><h2>纸张与排版</h2><p>选择冲印纸和裁切间距</p></div></div>
            <div className="settings-grid">
              <label>冲印纸张<select value={paperSpecId} onChange={(event) => setPaperSpecId(event.target.value)}>
                {PAPER_SPECS.map((spec) => <option key={spec.id} value={spec.id}>{spec.name} · {spec.width}×{spec.height}mm</option>)}
              </select></label>
              <label>分隔线<select value={separatorColor} onChange={(event) => setSeparatorColor(event.target.value)}>
                <option value="#334155">深灰</option><option value="#356bd8">蓝色</option><option value="#ffffff">白色</option>
              </select></label>
            </div>
            <label className="range-field"><span>裁切间距 <b>{gapMm.toFixed(1)} mm</b></span><input type="range" min="0" max="10" step="0.5" value={gapMm} onChange={(event) => setGapMm(Number(event.target.value))} /></label>

            {mode === 'single' && (
              <div className="count-setting">
                <span>照片数量</span>
                <div className="segmented"><button className={countMode === 'auto' ? 'active' : ''} onClick={() => setCountMode('auto')}>自动铺满</button><button className={countMode === 'custom' ? 'active' : ''} onClick={() => setCountMode('custom')}>指定数量</button></div>
                {countMode === 'custom' && <input type="number" min="1" max="100" value={customCount} onChange={(event) => setCustomCount(Math.min(100, Math.max(1, Number(event.target.value))))} />}
              </div>
            )}
          </aside>

          <section className="preview-panel">
            <div className="preview-head">
              <div><span className="status-dot" />实时预览</div>
              {layout && <small>{layout.orientation === 'landscape' ? '横向' : '纵向'} · {layout.pixelSize.width} × {layout.pixelSize.height}px</small>}
            </div>
            <div className={`canvas-stage ${layout ? 'has-layout' : ''}`}>
              {layout ? <canvas ref={canvasRef} /> : <div className="empty-state"><div className="empty-paper"><span>＋</span></div><h3>从一张照片开始</h3><p>添加照片后，这里会实时呈现冲印排版</p></div>}
            </div>
            <div className="preview-summary">
              <div><span>已排入</span><strong>{layout?.placedCount ?? 0}<small> 张</small></strong></div>
              <div><span>纸张利用率</span><strong>{layout ? Math.round(layout.utilization * 100) : 0}<small> %</small></strong></div>
              <div><span>输出精度</span><strong>300<small> DPI</small></strong></div>
            </div>
            {layout && layout.rejected.length > 0 && <div className="warning">当前纸张放不下全部照片，还有 {layout.rejected.reduce((sum, item) => sum + item.count, 0)} 张未排入，请减少数量或更换纸张。</div>}
            {message && <div className="error-message">{message}</div>}
            <button className="export-button" type="button" disabled={!layout || layout.rejected.length > 0 || isExporting} onClick={() => void exportImage()}>
              <span>{isExporting ? '正在生成冲印图…' : '导出 300 DPI 冲印图'}</span><b>↓</b>
            </button>
            <p className="export-note">导出时才生成高分辨率图片，预览不会消耗大量内存</p>
          </section>
        </section>
        <SeoDetails />
      </main>

      <footer>
        <span>雨邻证照 · Rainnear Photo</span>
        <span>照片始终仅在浏览器本地处理；页面访问与功能使用数据会发送至 <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Analytics</a></span>
      </footer>
    </div>
  )
}
