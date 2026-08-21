import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import {
  DEFAULT_BACKGROUND_TUNING,
  PHOTO_SPECS,
  computeCoverCrop,
  createLayout,
  createPhotoOutputPlan,
  getCropZoom,
  getPaperSpec,
  getPhotoSpec,
  isValidCrop,
  normalizeBackgroundTuning,
  zoomCropAtPoint,
  type BackgroundMode,
  type BackgroundTuning,
  type LayoutPlan,
  type PhotoLayoutInput,
  type PhotoOutputPlan,
} from '@rainnear/core'
import { createH5Platform, type BackgroundProgress, type BackgroundRemovalModelId } from '@rainnear/plateform-h5'
import alipayRewardCode from './assets/alipay-reward-code.jpg'
import buyMeACoffeeRewardCode from './assets/buy-me-a-coffee-reward-code.png'
import wechatRewardCode from './assets/wechat-reward-code.jpg'
import { readBackgroundModelPreference, writeBackgroundModelPreference } from './background-model-preference'
import { prepareBackgroundModelForAssets } from './background-model-switch'
import {
  DEFAULT_EXPORT_DPI,
  MAX_H5_EXPORT_PIXELS,
  getDpiRecommendationWarning,
  getExportPixelWarning,
  getRecommendedExportDpi,
  parseExportDpi,
  raiseExportDpi,
} from './export-settings'
import { SeoDetails, SeoIntro } from './SeoContent'
import { trackAnalyticsEvent } from './analytics'
import { CropCanvas } from './CropCanvas'
import { EditorStepper } from './EditorStepper'
import { LayoutStep } from './LayoutStep'
import { PhotoProcessStep } from './PhotoProcessStep'
import { SpecCropStep } from './SpecCropStep'
import type { AppPhoto, EditorStep, ModelSwitchProgress, UploadMode } from './editor-types'
import { createInitialAppPhoto, createPhotoDownloadFilename, retargetAppPhoto } from './photo-output-settings'

/** 将平台图片和照片级裁切状态转换为核心布局输入，喵~ */
function toLayoutInput(photo: AppPhoto): PhotoLayoutInput {
  const spec = getPhotoSpec(photo.presetId) ?? PHOTO_SPECS[0]
  if (!spec) throw new Error('缺少默认照片规格')
  return {
    id: photo.id,
    sourceWidthPx: photo.width,
    sourceHeightPx: photo.height,
    width: spec.width,
    height: spec.height,
    copies: photo.copies,
    background: photo.background,
    crop: photo.crop,
  }
}

/** 根据底层模型进度生成适合用户阅读的状态文案，喵~ */
function formatProgress(progress: BackgroundProgress): string {
  if (progress.phase === 'processing') return '正在智能抠图…'
  if (progress.current && progress.total) return `首次加载模型 ${Math.round((progress.current / progress.total) * 100)}%`
  return '正在加载本地模型…'
}

/** 返回向导步骤的稳定序号，喵~ */
function getStepIndex(step: EditorStep): number {
  if (step === 'process') return 1
  if (step === 'crop') return 2
  return 3
}

/** 提供照片处理、规格裁切和纸张排版三步本地工作流，喵~ */
export function App() {
  const platform = useMemo(() => createH5Platform(), [])
  const layoutCanvasRef = useRef<HTMLCanvasElement>(null)
  const photoCanvasRef = useRef<HTMLCanvasElement>(null)
  const controlPanelRef = useRef<HTMLElement>(null)
  const rewardButtonRef = useRef<HTMLButtonElement>(null)
  const rewardCloseButtonRef = useRef<HTMLButtonElement>(null)
  const modelSwitchAbortRef = useRef<AbortController | null>(null)
  const modelSwitchVersionRef = useRef(0)
  const [photos, setPhotos] = useState<AppPhoto[]>([])
  const [mode, setMode] = useState<UploadMode>('single')
  const [currentStep, setCurrentStep] = useState<EditorStep>('process')
  const [maxUnlockedStep, setMaxUnlockedStep] = useState(1)
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null)
  const [photoDpiInputs, setPhotoDpiInputs] = useState<Record<string, string>>({})
  const [paperSpecId, setPaperSpecId] = useState('6r')
  const [gapMm, setGapMm] = useState(2)
  const [exportDpi, setExportDpi] = useState(DEFAULT_EXPORT_DPI)
  const [exportDpiInput, setExportDpiInput] = useState(String(DEFAULT_EXPORT_DPI))
  const [countMode, setCountMode] = useState<'auto' | 'custom'>('auto')
  const [customCount, setCustomCount] = useState(8)
  const [separatorColor, setSeparatorColor] = useState('#334155')
  const [isImporting, setIsImporting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [exportingPhotoId, setExportingPhotoId] = useState<string | null>(null)
  const [isRewardOpen, setIsRewardOpen] = useState(false)
  const [isModelSettingsOpen, setIsModelSettingsOpen] = useState(false)
  const [backgroundRemovalModelId, setBackgroundRemovalModelId] = useState<BackgroundRemovalModelId>(() => (
    readBackgroundModelPreference(platform.backgroundRemovalModels, platform.defaultBackgroundRemovalModelId)
  ))
  const [pendingBackgroundRemovalModelId, setPendingBackgroundRemovalModelId] = useState<BackgroundRemovalModelId | null>(null)
  const [modelSwitchProgress, setModelSwitchProgress] = useState<ModelSwitchProgress | null>(null)
  const [message, setMessage] = useState('')

  const isModelSwitching = pendingBackgroundRemovalModelId !== null
  const currentModel = platform.backgroundRemovalModels.find((model) => model.id === backgroundRemovalModelId)
  const activePhoto = photos.find((photo) => photo.id === activePhotoId) ?? photos[0] ?? null
  const activePhotoSpec = activePhoto ? getPhotoSpec(activePhoto.presetId) : undefined
  const recommendedExportDpi = useMemo(() => getRecommendedExportDpi(photos, mode), [mode, photos])

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
      dpi: exportDpi,
      targetCount: countMode === 'custom' ? customCount : undefined,
    })
  }, [countMode, customCount, exportDpi, gapMm, mode, paperSpecId, photos])

  const photoOutputPlan = useMemo<PhotoOutputPlan | null>(() => {
    if (!activePhoto || !activePhotoSpec) return null
    if (!isValidCrop(activePhoto.crop, { width: activePhoto.width, height: activePhoto.height }, activePhotoSpec)) return null
    try {
      return createPhotoOutputPlan({
        photoId: activePhoto.id,
        sourceWidthPx: activePhoto.width,
        sourceHeightPx: activePhoto.height,
        spec: activePhotoSpec,
        dpi: activePhoto.outputDpi,
        crop: activePhoto.crop,
        background: activePhoto.background,
      })
    } catch {
      return null
    }
  }, [activePhoto, activePhotoSpec])

  const activePhotoZoom = useMemo(() => {
    if (!activePhoto || !activePhotoSpec) return 1
    try {
      return getCropZoom({ width: activePhoto.width, height: activePhoto.height }, activePhotoSpec, activePhoto.crop)
    } catch {
      return 1
    }
  }, [activePhoto, activePhotoSpec])

  const isExportDpiInputValid = parseExportDpi(exportDpiInput) !== undefined
  const dpiRecommendationWarning = getDpiRecommendationWarning(exportDpi, recommendedExportDpi)
  const exportPixelWarning = getExportPixelWarning(layout?.pixelSize)
  const photoExportPixelWarning = getExportPixelWarning(photoOutputPlan?.pixelSize)
  const activePhotoDpiInput = activePhoto ? photoDpiInputs[activePhoto.id] ?? String(activePhoto.outputDpi) : ''
  const isActivePhotoDpiValid = parseExportDpi(activePhotoDpiInput) !== undefined
  const backgrounds = useMemo(() => new Map(photos.map((photo) => [photo.id, photo.background])), [photos])
  const backgroundTunings = useMemo(() => new Map(photos.map((photo) => [photo.id, photo.tuning])), [photos])

  // 只在纸张排版步骤刷新整纸预览，避免创建最终 DPI 的大画布，喵~
  useEffect(() => {
    const canvas = layoutCanvasRef.current
    if (!canvas || !layout || currentStep !== 'layout') return
    const timer = window.setTimeout(() => {
      platform.renderPreview(canvas, layout, backgrounds, {
        separatorColor,
        backgroundRemovalModelId,
        previewMaxEdge: 1400,
        backgroundTunings,
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '预览生成失败'))
    }, 80)
    return () => window.clearTimeout(timer)
  }, [backgroundRemovalModelId, backgrounds, backgroundTunings, currentStep, layout, platform, separatorColor])

  // 照片处理和规格裁切阶段复用单张输出计划刷新预览，喵~
  useEffect(() => {
    const canvas = photoCanvasRef.current
    if (!canvas || !photoOutputPlan || currentStep === 'layout' || !activePhoto) return
    const render = () => {
      platform.renderPhotoPreview(canvas, photoOutputPlan, {
        backgroundRemovalModelId,
        previewMaxEdge: 1200,
        backgroundTuning: activePhoto.tuning,
      }).catch((error: unknown) => setMessage(error instanceof Error ? error.message : '规格照片预览失败'))
    }
    if (currentStep === 'crop') {
      const frame = window.requestAnimationFrame(render)
      return () => window.cancelAnimationFrame(frame)
    }
    const timer = window.setTimeout(render, 80)
    return () => window.clearTimeout(timer)
  }, [activePhoto, backgroundRemovalModelId, currentStep, photoOutputPlan, platform])

  // 页面卸载时释放所有 Object URL 和模型结果，避免长时间占用内存，喵~
  useEffect(() => () => {
    modelSwitchVersionRef.current += 1
    modelSwitchAbortRef.current?.abort()
    platform.dispose()
  }, [platform])

  // 自动建议值改变时同步排版 DPI 输入框，喵~
  useEffect(() => {
    setExportDpiInput(String(exportDpi))
  }, [exportDpi])

  // 切换步骤时将独立滚动的控制面板恢复到顶部，喵~
  useEffect(() => {
    controlPanelRef.current?.scrollTo({ top: 0 })
  }, [currentStep])

  // 赞赏浮层打开时锁定页面滚动并约束键盘焦点，喵~
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

  /** 仅在点击遮罩本身时关闭赞赏浮层，喵~ */
  function handleRewardBackdropClick(event: MouseEvent<HTMLDivElement>): void {
    if (event.target === event.currentTarget) closeRewardDialog()
  }

  /** 导入用户选择的图片并初始化规格、裁切和独立 DPI，喵~ */
  async function importFiles(files: Iterable<File>, inputMethod: 'picker' | 'drop'): Promise<void> {
    setMessage('')
    setIsImporting(true)
    try {
      const assets = await platform.importFiles(files)
      if (assets.length === 0) return
      const importedPhotos = assets.map(createInitialAppPhoto)
      const nextPhotos = [...photos, ...importedPhotos]
      setPhotos(nextPhotos)
      setPhotoDpiInputs((current) => ({
        ...current,
        ...Object.fromEntries(importedPhotos.map((photo) => [photo.id, String(photo.outputDpi)])),
      }))
      setActivePhotoId((current) => current ?? importedPhotos[0]?.id ?? null)
      setMaxUnlockedStep((current) => Math.max(current, 2))
      trackAnalyticsEvent('photo_import', { input_method: inputMethod, photo_count: assets.length })
      if ((assets.length > 1 || photos.length > 0) && mode !== 'mixed') {
        setExportDpi((current) => raiseExportDpi(current, getRecommendedExportDpi(nextPhotos, 'mixed')))
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

  /** 仅在排版模式实际变化时更新状态并发送分析事件，喵~ */
  function changeLayoutMode(layoutMode: UploadMode): void {
    if (layoutMode === mode) return
    if (layoutMode === 'mixed') setExportDpi((current) => raiseExportDpi(current, getRecommendedExportDpi(photos, layoutMode)))
    setMode(layoutMode)
    trackAnalyticsEvent('layout_mode_change', { layout_mode: layoutMode })
  }

  /** 在全部已换底照片准备成功后原子提交新的全局抠图模型，喵~ */
  async function changeBackgroundRemovalModel(modelId: BackgroundRemovalModelId): Promise<void> {
    if (modelId === backgroundRemovalModelId || isModelSwitching) return
    const targetModel = platform.backgroundRemovalModels.find((model) => model.id === modelId)
    if (!targetModel) {
      setMessage(`抠图模型 ${modelId} 不可用`)
      return
    }
    const affectedAssetIds = photos.filter((photo) => photo.background !== 'keep').map((photo) => photo.id)
    const previousModelId = backgroundRemovalModelId
    setMessage('')
    if (affectedAssetIds.length === 0) {
      setBackgroundRemovalModelId(modelId)
      writeBackgroundModelPreference(modelId)
      trackAnalyticsEvent('background_model_change', { from_model_id: previousModelId, to_model_id: modelId, processed_photo_count: 0 })
      return
    }
    const controller = new AbortController()
    const taskVersion = ++modelSwitchVersionRef.current
    modelSwitchAbortRef.current = controller
    setPendingBackgroundRemovalModelId(modelId)
    setModelSwitchProgress({ modelName: targetModel.name, current: 1, total: affectedAssetIds.length, detail: '正在准备本地模型…' })
    try {
      await prepareBackgroundModelForAssets(platform, affectedAssetIds, modelId, {
        signal: controller.signal,
        onProgress: (progress) => {
          if (modelSwitchVersionRef.current !== taskVersion) return
          setModelSwitchProgress({ modelName: targetModel.name, current: progress.current, total: progress.total, detail: progress.modelProgress ? formatProgress(progress.modelProgress) : '正在准备照片…' })
        },
      })
      if (modelSwitchVersionRef.current !== taskVersion || controller.signal.aborted) return
      setBackgroundRemovalModelId(modelId)
      writeBackgroundModelPreference(modelId)
      trackAnalyticsEvent('background_model_change', { from_model_id: previousModelId, to_model_id: modelId, processed_photo_count: affectedAssetIds.length })
    } catch (error) {
      if (modelSwitchVersionRef.current !== taskVersion || controller.signal.aborted) return
      trackAnalyticsEvent('background_model_change_error', { from_model_id: previousModelId, to_model_id: modelId, processed_photo_count: affectedAssetIds.length })
      setMessage(error instanceof Error ? `切换抠图模型失败：${error.message}` : '切换抠图模型失败')
    } finally {
      if (modelSwitchVersionRef.current === taskVersion) {
        modelSwitchAbortRef.current = null
        setPendingBackgroundRemovalModelId(null)
        setModelSwitchProgress(null)
      }
    }
  }

  /** 更新一张照片的可编辑字段，喵~ */
  function updatePhoto(photoId: string, patch: Partial<AppPhoto>): void {
    setPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, ...patch } : photo))
  }

  /** 在允许范围内切换向导步骤并记录漏斗事件，喵~ */
  function changeEditorStep(step: EditorStep): void {
    if (getStepIndex(step) > maxUnlockedStep || step === currentStep) return
    const previousStep = currentStep
    setCurrentStep(step)
    trackAnalyticsEvent('editor_step_change', { from_step: previousStep, to_step: step })
  }

  /** 解锁并进入规格裁切步骤，喵~ */
  function enterCropStep(): void {
    if (photos.length === 0) return
    setMaxUnlockedStep((current) => Math.max(current, 2))
    const previousStep = currentStep
    setCurrentStep('crop')
    trackAnalyticsEvent('editor_step_change', { from_step: previousStep, to_step: 'crop' })
  }

  /** 解锁并进入纸张排版步骤，喵~ */
  function enterLayoutStep(): void {
    if (photos.length === 0) return
    setMaxUnlockedStep(3)
    const previousStep = currentStep
    setCurrentStep('layout')
    trackAnalyticsEvent('editor_step_change', { from_step: previousStep, to_step: 'layout' })
  }

  /** 更新业务预设并保留视觉焦点和相对缩放，喵~ */
  function changePhotoPreset(photoId: string, presetId: string): void {
    const photo = photos.find((item) => item.id === photoId)
    const spec = getPhotoSpec(presetId)
    if (!photo || !spec || photo.presetId === spec.id) return
    const updated = retargetAppPhoto(photo, presetId)
    setPhotos((current) => current.map((item) => item.id === photoId ? updated : item))
    setPhotoDpiInputs((current) => ({ ...current, [photoId]: String(updated.outputDpi) }))
    if (mode === 'mixed' || photos[0]?.id === photoId) setExportDpi((current) => raiseExportDpi(current, spec.recommendedDpi))
    trackAnalyticsEvent('photo_spec_change', { spec_id: presetId })
  }

  /** 更新照片规格成片 DPI，非法输入保留最后有效值，喵~ */
  function changePhotoOutputDpi(photoId: string, value: string): void {
    setPhotoDpiInputs((current) => ({ ...current, [photoId]: value }))
    const parsed = parseExportDpi(value)
    if (parsed !== undefined) updatePhoto(photoId, { outputDpi: parsed })
  }

  /** 围绕当前裁切焦点修改照片缩放倍数，喵~ */
  function changePhotoZoom(photoId: string, zoom: number): void {
    const photo = photos.find((item) => item.id === photoId)
    const spec = photo ? getPhotoSpec(photo.presetId) : undefined
    if (!photo || !spec) return
    updatePhoto(photoId, {
      crop: zoomCropAtPoint(
        { width: photo.width, height: photo.height },
        spec,
        photo.crop,
        zoom,
        { x: 0.5, y: 0.5 },
      ),
    })
  }

  /** 将照片恢复为当前规格的居中裁切，喵~ */
  function resetPhotoCrop(photoId: string): void {
    const photo = photos.find((item) => item.id === photoId)
    const spec = photo ? getPhotoSpec(photo.presetId) : undefined
    if (!photo || !spec) return
    updatePhoto(photoId, { crop: computeCoverCrop({ width: photo.width, height: photo.height }, spec) })
    trackAnalyticsEvent('photo_crop_reset', { spec_id: spec.id })
  }

  /** 在用户输入有效整数时实时更新排版，喵~ */
  function changeExportDpi(value: string): void {
    setExportDpiInput(value)
    const parsed = parseExportDpi(value)
    if (parsed !== undefined) setExportDpi(parsed)
  }

  /** 更新照片的专业蒙版参数并立即触发预览，喵~ */
  function updatePhotoTuning(photoId: string, patch: Partial<BackgroundTuning>): void {
    setPhotos((current) => current.map((photo) => photo.id === photoId ? { ...photo, tuning: normalizeBackgroundTuning({ ...photo.tuning, ...patch }) } : photo))
  }

  /** 将照片专业蒙版参数恢复为模型原始输出，喵~ */
  function resetPhotoTuning(photoId: string): void {
    updatePhotoTuning(photoId, DEFAULT_BACKGROUND_TUNING)
  }

  /** 删除照片并同步释放平台资源和向导状态，喵~ */
  function removePhoto(photoId: string): void {
    if (isModelSwitching) {
      modelSwitchVersionRef.current += 1
      modelSwitchAbortRef.current?.abort()
      modelSwitchAbortRef.current = null
      setPendingBackgroundRemovalModelId(null)
      setModelSwitchProgress(null)
    }
    platform.removeAsset(photoId)
    const remaining = photos.filter((photo) => photo.id !== photoId)
    setPhotos(remaining)
    setPhotoDpiInputs((current) => Object.fromEntries(Object.entries(current).filter(([id]) => id !== photoId)))
    if (activePhotoId === photoId) setActivePhotoId(remaining[0]?.id ?? null)
    if (remaining.length === 0) {
      setCurrentStep('process')
      setMaxUnlockedStep(1)
    }
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
      await platform.prepareCutout(photoId, { modelId: backgroundRemovalModelId, onProgress: (progress) => updatePhoto(photoId, { processingText: formatProgress(progress) }) })
      updatePhoto(photoId, { background, processingText: undefined })
      trackAnalyticsEvent('background_change', { background_mode: background })
    } catch (error) {
      updatePhoto(photoId, { processingText: undefined })
      trackAnalyticsEvent('background_change_error', { background_mode: background })
      setMessage(error instanceof Error ? `智能换底失败：${error.message}` : '智能换底失败')
    }
  }

  /** 将完整纸张布局按用户选择的 DPI 导出为本地 JPEG，喵~ */
  async function exportImage(): Promise<void> {
    if (!layout || layout.rejected.length > 0 || exportPixelWarning || !isExportDpiInputValid) return
    setMessage('')
    setIsExporting(true)
    try {
      const blob = await platform.exportJpeg(layout, backgrounds, { separatorColor, backgroundRemovalModelId, maxExportPixels: MAX_H5_EXPORT_PIXELS, backgroundTunings })
      const paper = getPaperSpec(paperSpecId)
      platform.download(blob, `rainnear_${layout.placedCount}张_${paper?.name ?? '照片纸'}_${exportDpi}dpi.jpg`)
      trackAnalyticsEvent('photo_export', { layout_mode: mode, paper_spec_id: paperSpecId, placed_count: layout.placedCount, export_dpi: exportDpi })
    } catch (error) {
      trackAnalyticsEvent('photo_export_error', { layout_mode: mode, paper_spec_id: paperSpecId, placed_count: layout.placedCount, export_dpi: exportDpi })
      setMessage(error instanceof Error ? error.message : '照片导出失败')
    } finally {
      setIsExporting(false)
    }
  }

  /** 将当前照片按业务规格、裁切和独立 DPI 导出为本地 JPEG，喵~ */
  async function exportCurrentPhoto(): Promise<void> {
    if (!activePhoto || !activePhotoSpec || !photoOutputPlan || !isActivePhotoDpiValid || photoExportPixelWarning || exportingPhotoId) return
    setMessage('')
    setExportingPhotoId(activePhoto.id)
    try {
      const blob = await platform.exportPhotoJpeg(photoOutputPlan, { backgroundRemovalModelId, backgroundTuning: activePhoto.tuning, maxExportPixels: MAX_H5_EXPORT_PIXELS })
      platform.download(blob, createPhotoDownloadFilename(activePhoto, activePhotoSpec))
      trackAnalyticsEvent('photo_spec_export', { spec_id: activePhotoSpec.id, export_dpi: activePhoto.outputDpi, pixel_width: photoOutputPlan.pixelSize.width, pixel_height: photoOutputPlan.pixelSize.height, background_mode: activePhoto.background })
    } catch (error) {
      trackAnalyticsEvent('photo_spec_export_error', { spec_id: activePhotoSpec.id, export_dpi: activePhoto.outputDpi, failure_stage: 'render' })
      setMessage(error instanceof Error ? error.message : '规格照片导出失败')
    } finally {
      setExportingPhotoId(null)
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark">R</span><span><strong>雨邻证照</strong><small>RAINNEAR PHOTO</small></span></a>
        <div className="topbar-actions">
          <a className="privacy-pill" href="#privacy"><span aria-hidden="true">●</span><span className="privacy-text">照片仅在本地处理</span></a>
          <button ref={rewardButtonRef} className="reward-trigger" type="button" aria-haspopup="dialog" aria-expanded={isRewardOpen} onClick={() => { setIsRewardOpen(true); trackAnalyticsEvent('reward_dialog_open', {}) }}>赞赏</button>
        </div>
      </header>

      {isRewardOpen && (
        <div className="reward-backdrop" onMouseDown={handleRewardBackdropClick}>
          <section className="reward-dialog" role="dialog" aria-modal="true" aria-labelledby="reward-dialog-title" aria-describedby="reward-dialog-description">
            <button ref={rewardCloseButtonRef} className="reward-close" type="button" aria-label="关闭赞赏浮层" onClick={closeRewardDialog}>×</button>
            <div className="reward-heading"><span>THANK YOU</span><h2 id="reward-dialog-title">感谢支持</h2><p id="reward-dialog-description">选择微信、支付宝或 Buy Me a Coffee 扫码赞赏</p></div>
            <div className="reward-code-grid">
              <figure className="reward-code-card"><figcaption><i className="wechat-dot" />微信赞赏码</figcaption><div className="reward-code-frame wechat-code-frame"><img src={wechatRewardCode} alt="微信赞赏码" /></div></figure>
              <figure className="reward-code-card"><figcaption><i className="alipay-dot" />支付宝收款码</figcaption><div className="reward-code-frame alipay-code-frame"><img src={alipayRewardCode} alt="支付宝收款码" /></div></figure>
              <figure className="reward-code-card"><figcaption><i className="buy-me-a-coffee-dot" />Buy Me a Coffee</figcaption><div className="reward-code-frame buy-me-a-coffee-code-frame"><img src={buyMeACoffeeRewardCode} alt="Buy Me a Coffee 赞赏码" /></div></figure>
            </div>
          </section>
        </div>
      )}

      <main id="top" className="workspace">
        <SeoIntro />
        <EditorStepper currentStep={currentStep} maxUnlockedStep={maxUnlockedStep} onChange={changeEditorStep} />
        <section id="editor" className="editor-grid" aria-label="证件照制作与排版编辑器">
          <aside ref={controlPanelRef} className="control-panel">
            {currentStep === 'process' && (
              <PhotoProcessStep photos={photos} activePhotoId={activePhoto?.id ?? null} mode={mode} isImporting={isImporting} isModelSettingsOpen={isModelSettingsOpen} isModelSwitching={isModelSwitching} currentModelName={currentModel?.name} backgroundRemovalModelId={backgroundRemovalModelId} models={platform.backgroundRemovalModels} modelSwitchProgress={modelSwitchProgress} onImportFiles={(files, inputMethod) => void importFiles(files, inputMethod)} onModeChange={changeLayoutMode} onModelSettingsToggle={() => setIsModelSettingsOpen((current) => !current)} onModelChange={(modelId) => void changeBackgroundRemovalModel(modelId)} onPhotoSelect={setActivePhotoId} onRemovePhoto={removePhoto} onBackgroundChange={(photoId, background) => void changeBackground(photoId, background)} onUpdatePhoto={updatePhoto} onUpdateTuning={updatePhotoTuning} onResetTuning={resetPhotoTuning} onNext={enterCropStep} />
            )}
            {currentStep === 'crop' && (
              <SpecCropStep photos={photos} activePhoto={activePhoto} mode={mode} zoom={activePhotoZoom} outputPlan={isActivePhotoDpiValid ? photoOutputPlan : null} outputWarning={isActivePhotoDpiValid ? photoExportPixelWarning : '请输入 72–600 的整数 DPI'} outputDpiInput={activePhotoDpiInput} isOutputDpiValid={isActivePhotoDpiValid} isExporting={exportingPhotoId === activePhoto?.id} isModelSwitching={isModelSwitching} onPhotoSelect={setActivePhotoId} onPresetChange={changePhotoPreset} onOutputDpiChange={changePhotoOutputDpi} onZoomChange={changePhotoZoom} onResetCrop={resetPhotoCrop} onExport={() => void exportCurrentPhoto()} onBack={() => changeEditorStep('process')} onNext={enterLayoutStep} />
            )}
            {currentStep === 'layout' && (
              <LayoutStep photos={photos} mode={mode} paperSpecId={paperSpecId} separatorColor={separatorColor} exportDpiInput={exportDpiInput} exportDpi={exportDpi} recommendedExportDpi={recommendedExportDpi} isExportDpiInputValid={isExportDpiInputValid} gapMm={gapMm} countMode={countMode} customCount={customCount} onPaperSpecChange={setPaperSpecId} onSeparatorColorChange={setSeparatorColor} onExportDpiChange={changeExportDpi} onExportDpiBlur={() => setExportDpiInput(String(exportDpi))} onGapChange={setGapMm} onCountModeChange={setCountMode} onCustomCountChange={setCustomCount} onCopiesChange={(photoId, copies) => updatePhoto(photoId, { copies })} onBack={() => changeEditorStep('crop')} />
            )}
          </aside>

          <section className="preview-panel">
            <div className="preview-head">
              <div><span className="status-dot" />{currentStep === 'layout' ? '排版实时预览' : currentStep === 'crop' ? '规格裁切预览' : '照片效果预览'}</div>
              {currentStep === 'layout' && layout && <small>{layout.orientation === 'landscape' ? '横向' : '纵向'} · {layout.pixelSize.width} × {layout.pixelSize.height}px</small>}
              {currentStep !== 'layout' && photoOutputPlan && <small>{photoOutputPlan.pixelSize.width} × {photoOutputPlan.pixelSize.height}px</small>}
            </div>
            <div className={`canvas-stage ${currentStep === 'crop' ? 'crop-stage' : ''} ${(layout || photoOutputPlan) ? 'has-layout' : ''}`}>
              {photos.length === 0 ? (
                <div className="empty-state"><div className="empty-paper"><span>＋</span></div><h3>从一张照片开始</h3><p>添加照片后即可进行处理、裁切和排版</p></div>
              ) : currentStep === 'layout' ? (
                layout ? <canvas ref={layoutCanvasRef} /> : null
              ) : currentStep === 'crop' && activePhoto ? (
                <CropCanvas key={`${activePhoto.id}:${activePhoto.presetId}`} ref={photoCanvasRef} crop={activePhoto.crop} sourceSize={{ width: activePhoto.width, height: activePhoto.height }} targetSize={activePhotoSpec!} disabled={Boolean(activePhoto.processingText) || isModelSwitching} onCropChange={(crop) => updatePhoto(activePhoto.id, { crop })} />
              ) : photoOutputPlan ? <canvas ref={photoCanvasRef} /> : null}
            </div>

            {currentStep === 'layout' ? (
              <>
                <div className="preview-summary"><div><span>已排入</span><strong>{layout?.placedCount ?? 0}<small> 张</small></strong></div><div><span>纸张利用率</span><strong>{layout ? Math.round(layout.utilization * 100) : 0}<small> %</small></strong></div><div><span>输出精度</span><strong>{exportDpi}<small> DPI</small></strong></div></div>
                {layout && layout.rejected.length > 0 && <div className="warning">当前纸张放不下全部照片，还有 {layout.rejected.reduce((sum, item) => sum + item.count, 0)} 张未排入，请减少数量或更换纸张。</div>}
                {dpiRecommendationWarning && <div className="warning">{dpiRecommendationWarning}</div>}
                {exportPixelWarning && <div className="error-message">{exportPixelWarning}</div>}
                <button className="export-button" type="button" disabled={!layout || layout.rejected.length > 0 || Boolean(exportPixelWarning) || !isExportDpiInputValid || isExporting || isModelSwitching} onClick={() => void exportImage()}><span>{isModelSwitching ? '正在切换抠图模型…' : isExporting ? '正在生成冲印图…' : `导出 ${exportDpi} DPI 冲印图`}</span><b>↓</b></button>
                <p className="export-note">导出时才生成高分辨率图片，预览不会消耗大量内存</p>
              </>
            ) : activePhoto && activePhotoSpec ? (
              <div className="preview-summary photo-preview-summary"><div><span>当前照片</span><strong>{photos.findIndex((photo) => photo.id === activePhoto.id) + 1}<small> / {photos.length}</small></strong></div><div><span>业务规格</span><strong>{activePhotoSpec.name}</strong></div><div><span>当前缩放</span><strong>{Math.round(activePhotoZoom * 100)}<small> %</small></strong></div></div>
            ) : null}
            {message && <div className="error-message">{message}</div>}
          </section>
        </section>
        <SeoDetails />
      </main>

      <footer><span>雨邻证照 · Rainnear Photo</span><span>照片始终仅在浏览器本地处理；页面访问与功能使用数据会发送至 <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Analytics</a></span></footer>
    </div>
  )
}
