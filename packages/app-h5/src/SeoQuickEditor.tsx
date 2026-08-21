import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  DEFAULT_BACKGROUND_TUNING,
  getCropZoom,
  type BackgroundMode,
} from '@rainnear/core'
import { createH5Platform, type BackgroundProgress } from '@rainnear/plateform-h5'
import { CropCanvas } from './CropCanvas'
import type { AppPhoto } from './editor-types'
import { MAX_H5_EXPORT_PIXELS } from './export-settings'
import {
  createSeoQuickLayout,
  createSeoQuickPhoto,
  createSeoQuickPhotoPlan,
  retargetSeoQuickPhoto,
  SEO_QUICK_SEPARATOR_COLOR,
} from './seo-quick-domain'
import { getSeoQuickFlowDefinition, type SeoQuickFlowDefinition, type SeoQuickFlowId, type SeoQuickPhotoSpecId } from './seo-config'
import { trackAnalyticsEvent } from './analytics'

interface SeoQuickEditorProps {
  flowId: SeoQuickFlowId
  initialFile: File
}

type QuickStatus = 'importing' | 'processing' | 'ready' | 'model-error'

const BACKGROUND_OPTIONS: readonly { value: Exclude<BackgroundMode, 'keep'>; label: string; color: string }[] = [
  { value: 'white', label: '白底', color: '#ffffff' },
  { value: 'blue', label: '蓝底', color: '#438edb' },
  { value: 'red', label: '红底', color: '#d6453d' },
  { value: 'gray', label: '灰底', color: '#c8c8c8' },
]

/** 将高清模型进度转换为简短且稳定的用户提示，喵~ */
function formatQuickProgress(progress: BackgroundProgress): string {
  if (progress.phase === 'processing') return '正在精细抠图…'
  if (progress.current && progress.total) return `正在加载高清模型 ${Math.round((progress.current / progress.total) * 100)}%`
  return '正在加载高清模型，首次约 80 MB…'
}

/** 在同一落地页内编排上传、高清换底、裁切和导出，喵~ */
export function SeoQuickEditor({ flowId, initialFile }: SeoQuickEditorProps) {
  const flow = requireSeoQuickFlow(flowId)
  const platform = useMemo(() => createH5Platform(), [])
  const photoCanvasRef = useRef<HTMLCanvasElement>(null)
  const layoutCanvasRef = useRef<HTMLCanvasElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const taskVersionRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const activeAssetIdRef = useRef<string | null>(null)
  const initialFileRef = useRef(initialFile)
  const processingStartedAtRef = useRef(0)
  const [photo, setPhoto] = useState<AppPhoto | null>(null)
  const [status, setStatus] = useState<QuickStatus>('importing')
  const [progressText, setProgressText] = useState('正在读取照片…')
  const [errorMessage, setErrorMessage] = useState('')
  const [isExporting, setIsExporting] = useState(false)

  const photoPlan = useMemo(() => photo ? createSeoQuickPhotoPlan(photo) : null, [photo])
  const layout = useMemo(() => photo && flow.outputType === 'print-layout' ? createSeoQuickLayout(photo, flow) : null, [flow, photo])
  const zoom = useMemo(() => {
    if (!photo) return 1
    try {
      return getCropZoom({ width: photo.width, height: photo.height }, photo.spec, photo.crop)
    } catch {
      return 1
    }
  }, [photo])

  /** 为已经导入的平台资源启动固定高清模型，喵~ */
  async function prepareQualityCutout(assetId: string, taskVersion: number): Promise<void> {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    processingStartedAtRef.current = performance.now()
    setStatus('processing')
    setErrorMessage('')
    setProgressText('正在加载高清模型，首次约 80 MB…')
    try {
      await platform.prepareCutout(assetId, {
        modelId: flow.backgroundRemovalModelId,
        signal: controller.signal,
        onProgress: (progress) => {
          if (taskVersionRef.current === taskVersion) setProgressText(formatQuickProgress(progress))
        },
      })
      if (taskVersionRef.current !== taskVersion || controller.signal.aborted) return
      setPhoto((current) => current?.id === assetId ? { ...current, background: flow.defaultBackground, processingText: undefined } : current)
      setProgressText('正在生成结果…')
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
      if (taskVersionRef.current !== taskVersion || controller.signal.aborted) return
      setStatus('ready')
      setProgressText('高清处理完成，可以直接下载')
      trackAnalyticsEvent('seo_quick_ready', {
        landing_page: flow.id,
        photo_spec_id: flow.defaultPhotoSpecId,
        output_type: flow.outputType,
        duration_ms: Math.max(0, Math.round(performance.now() - processingStartedAtRef.current)),
      })
    } catch (error) {
      if (taskVersionRef.current !== taskVersion || controller.signal.aborted) return
      setStatus('model-error')
      setProgressText('高清处理未完成')
      setErrorMessage(error instanceof Error ? error.message : '高清模型处理失败')
      trackAnalyticsEvent('seo_quick_error', { landing_page: flow.id, failure_stage: 'model' })
    }
  }

  /** 读取一张新照片并替换当前任务和资源，喵~ */
  async function importAndProcess(file: File): Promise<void> {
    const taskVersion = ++taskVersionRef.current
    abortRef.current?.abort()
    abortRef.current = null
    const previousAssetId = activeAssetIdRef.current
    activeAssetIdRef.current = null
    if (previousAssetId) platform.removeAsset(previousAssetId)
    setPhoto(null)
    setStatus('importing')
    setProgressText('正在读取照片…')
    setErrorMessage('')
    try {
      const [asset] = await platform.importFiles([file])
      if (!asset) throw new Error('没有读取到有效照片')
      if (taskVersionRef.current !== taskVersion) {
        platform.removeAsset(asset.id)
        return
      }
      activeAssetIdRef.current = asset.id
      const nextPhoto = createSeoQuickPhoto(asset, flow.defaultPhotoSpecId)
      setPhoto(nextPhoto)
      trackAnalyticsEvent('seo_quick_upload', { landing_page: flow.id })
      await prepareQualityCutout(asset.id, taskVersion)
    } catch (error) {
      if (taskVersionRef.current !== taskVersion) return
      setStatus('model-error')
      setProgressText('照片读取失败')
      setErrorMessage(error instanceof Error ? error.message : '照片读取失败')
      trackAnalyticsEvent('seo_quick_error', { landing_page: flow.id, failure_stage: 'import' })
    }
  }

  // 首次挂载后立即处理用户已经明确选择的照片，喵~
  useEffect(() => {
    void importAndProcess(initialFileRef.current)
    return () => {
      taskVersionRef.current += 1
      abortRef.current?.abort()
      platform.dispose()
    }
  }, [platform])

  // 将当前裁切和底色渲染为单张轻量预览，喵~
  useEffect(() => {
    const canvas = photoCanvasRef.current
    if (!canvas || !photoPlan) return
    platform.renderPhotoPreview(canvas, photoPlan, {
      backgroundRemovalModelId: flow.backgroundRemovalModelId,
      previewMaxEdge: 1000,
      backgroundTuning: DEFAULT_BACKGROUND_TUNING,
    }).catch((error: unknown) => {
      if (status === 'ready') setErrorMessage(error instanceof Error ? error.message : '预览生成失败')
    })
  }, [flow.backgroundRemovalModelId, photoPlan, platform, status])

  // 排版页在同屏同步展示固定 6 寸结果，喵~
  useEffect(() => {
    const canvas = layoutCanvasRef.current
    if (!canvas || !layout || !photo) return
    platform.renderPreview(canvas, layout, new Map([[photo.id, photo.background]]), {
      separatorColor: SEO_QUICK_SEPARATOR_COLOR,
      backgroundRemovalModelId: flow.backgroundRemovalModelId,
      previewMaxEdge: 1200,
      backgroundTunings: new Map([[photo.id, DEFAULT_BACKGROUND_TUNING]]),
    }).catch((error: unknown) => {
      if (status === 'ready') setErrorMessage(error instanceof Error ? error.message : '排版预览失败')
    })
  }, [flow.backgroundRemovalModelId, layout, photo, platform, status])

  /** 替换照片时允许用户再次选择同名文件，喵~ */
  function handleReplaceFile(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) void importAndProcess(file)
  }

  /** 只在流程白名单内切换一寸或二寸规格，喵~ */
  function changePhotoSpec(specId: SeoQuickPhotoSpecId): void {
    if (!photo || !flow.allowedPhotoSpecIds.includes(specId) || photo.spec.id === specId) return
    setPhoto(retargetSeoQuickPhoto(photo, specId))
  }

  /** 使用已经缓存的透明前景切换底色，不重复运行模型，喵~ */
  function changeBackground(background: Exclude<BackgroundMode, 'keep'>): void {
    if (!photo || status !== 'ready' || photo.background === background) return
    setPhoto({ ...photo, background })
  }

  /** 根据页面目标导出单张规格照或固定 6 寸排版图，喵~ */
  async function exportResult(): Promise<void> {
    if (!photo || !photoPlan || status !== 'ready' || isExporting) return
    setIsExporting(true)
    setErrorMessage('')
    try {
      if (flow.outputType === 'print-layout') {
        if (!layout) throw new Error('排版结果尚未准备完成')
        const blob = await platform.exportJpeg(layout, new Map([[photo.id, photo.background]]), {
          separatorColor: SEO_QUICK_SEPARATOR_COLOR,
          backgroundRemovalModelId: flow.backgroundRemovalModelId,
          backgroundTunings: new Map([[photo.id, DEFAULT_BACKGROUND_TUNING]]),
          maxExportPixels: MAX_H5_EXPORT_PIXELS,
        })
        platform.download(blob, `rainnear_6寸_${layout.placedCount}张${photo.spec.name}_${flow.dpi}dpi.jpg`)
      } else {
        const blob = await platform.exportPhotoJpeg(photoPlan, {
          backgroundRemovalModelId: flow.backgroundRemovalModelId,
          backgroundTuning: DEFAULT_BACKGROUND_TUNING,
          maxExportPixels: MAX_H5_EXPORT_PIXELS,
        })
        platform.download(blob, `rainnear_${photo.spec.name}_${photo.spec.width}x${photo.spec.height}mm_${flow.dpi}dpi.jpg`)
      }
      trackAnalyticsEvent('seo_quick_export', {
        landing_page: flow.id,
        photo_spec_id: photo.spec.id === 'two-inch' ? 'two-inch' : 'one-inch',
        output_type: flow.outputType,
        background_mode: photo.background === 'keep' ? 'white' : photo.background,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '导出失败，请重试')
      trackAnalyticsEvent('seo_quick_error', { landing_page: flow.id, failure_stage: 'export' })
    } finally {
      setIsExporting(false)
    }
  }

  const downloadLabel = flow.outputType === 'print-layout'
    ? `下载 ${layout?.placedCount ?? 0} 张${photo?.spec.name ?? '一寸'}照排版图`
    : `下载 600 DPI ${photo?.spec.name ?? '证件'}照片`

  return (
    <div className="quick-editor">
      <div className="quick-editor-head">
        <div><span className={`quick-status-dot ${status}`} /><strong>{progressText}</strong></div>
        <button type="button" onClick={() => replaceInputRef.current?.click()}>重新选择照片</button>
        <input ref={replaceInputRef} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handleReplaceFile} />
      </div>

      {photo ? (
        <div className={`quick-workspace ${flow.outputType === 'print-layout' ? 'has-layout' : ''}`}>
          <div className="quick-photo-preview">
            <CropCanvas
              key={`${photo.id}:${photo.spec.id}`}
              ref={photoCanvasRef}
              crop={photo.crop}
              sourceSize={{ width: photo.width, height: photo.height }}
              targetSize={photo.spec}
              disabled={status !== 'ready'}
              onCropChange={(crop) => setPhoto((current) => current ? { ...current, crop } : current)}
            />
            {status !== 'ready' && <div className="quick-processing-overlay"><i /><span>{progressText}</span></div>}
          </div>
          {flow.outputType === 'print-layout' && <div className="quick-layout-preview"><canvas ref={layoutCanvasRef} /><span>6 寸排版实时预览</span></div>}
        </div>
      ) : <div className="quick-loading-placeholder"><i /><strong>{progressText}</strong></div>}

      {photo && status === 'ready' && (
        <div className="quick-controls">
          {flow.allowedPhotoSpecIds.length > 1 && (
            <div className="quick-spec-tabs" aria-label="照片规格">{flow.allowedPhotoSpecIds.map((specId) => <button key={specId} type="button" className={photo.spec.id === specId ? 'selected' : ''} onClick={() => changePhotoSpec(specId)}>{specId === 'one-inch' ? '一寸' : '二寸'}</button>)}</div>
          )}
          <div className="quick-backgrounds" aria-label="照片底色">{BACKGROUND_OPTIONS.map((option) => <button key={option.value} type="button" className={photo.background === option.value ? 'selected' : ''} aria-label={option.label} aria-pressed={photo.background === option.value} onClick={() => changeBackground(option.value)}><i style={{ background: option.color }} /><span>{option.label}</span></button>)}</div>
          <div className="quick-readonly-summary"><span>{photo.spec.width}×{photo.spec.height} mm</span><span>{flow.outputType === 'print-layout' ? '6 寸相纸' : `${photoPlan?.pixelSize.width}×${photoPlan?.pixelSize.height} px`}</span><span>{flow.dpi} DPI</span><span>缩放 {Math.round(zoom * 100)}%</span></div>
        </div>
      )}

      {errorMessage && <div className="quick-error" role="alert"><strong>{errorMessage}</strong>{status === 'model-error' && photo && <button type="button" onClick={() => void prepareQualityCutout(photo.id, ++taskVersionRef.current)}>重试高清处理</button>}<button type="button" onClick={() => replaceInputRef.current?.click()}>重新选择照片</button><a data-full-editor-link href="/#editor">进入完整工具</a></div>}

      <button className="quick-download" type="button" disabled={!photo || status !== 'ready' || isExporting} onClick={() => void exportResult()}>{isExporting ? '正在生成高清图片…' : downloadLabel}<b>↓</b></button>
      <p className="quick-footer-note">照片和处理结果不会上传服务器 · 需要更多设置？<a data-full-editor-link href="/#editor">进入完整工具</a></p>
    </div>
  )
}

/** 将外部页面标识收窄为必定存在的内部流程配置，喵~ */
function requireSeoQuickFlow(flowId: SeoQuickFlowId): SeoQuickFlowDefinition {
  const flow = getSeoQuickFlowDefinition(flowId)
  if (!flow) throw new Error(`未知 SEO 极速流程 ${flowId}`)
  return flow
}

let quickEditorRoot: Root | undefined

/** 将共享极速编辑器挂载到静态页面并接管用户已选择的文件，喵~ */
export function mountSeoQuickEditor(container: HTMLElement, flowId: SeoQuickFlowId, initialFile: File): void {
  quickEditorRoot ??= createRoot(container)
  quickEditorRoot.render(<SeoQuickEditor flowId={flowId} initialFile={initialFile} />)
}
