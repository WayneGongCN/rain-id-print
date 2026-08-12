type AnalyticsStorageConsent = 'granted' | 'denied'

interface AnalyticsEventMap {
  photo_import: {
    input_method: 'picker' | 'drop'
    photo_count: number
  }
  photo_import_error: {
    input_method: 'picker' | 'drop'
  }
  layout_mode_change: {
    layout_mode: 'single' | 'mixed'
  }
  background_change: {
    background_mode: 'keep' | 'white' | 'blue' | 'red' | 'gray'
  }
  background_change_error: {
    background_mode: 'keep' | 'white' | 'blue' | 'red' | 'gray'
  }
  background_model_change: {
    from_model_id: string
    to_model_id: string
    processed_photo_count: number
  }
  background_model_change_error: {
    from_model_id: string
    to_model_id: string
    processed_photo_count: number
  }
  photo_export: {
    layout_mode: 'single' | 'mixed'
    paper_spec_id: string
    placed_count: number
    export_dpi: number
  }
  photo_export_error: {
    layout_mode: 'single' | 'mixed'
    paper_spec_id: string
    placed_count: number
    export_dpi: number
  }
  reward_dialog_open: Record<string, never>
}

interface AnalyticsInitializationOptions {
  measurementId?: string
  isProduction?: boolean
  hostname?: string
  telemetryEnabled?: boolean
}

interface ConsentSettings {
  analytics_storage: AnalyticsStorageConsent
  ad_storage: AnalyticsStorageConsent
  ad_user_data: AnalyticsStorageConsent
  ad_personalization: AnalyticsStorageConsent
}

interface GoogleTagConfig {
  allow_google_signals: boolean
  allow_ad_personalization_signals: boolean
  send_page_view: boolean
}

type GoogleTagArguments =
  | ['consent', 'default', ConsentSettings]
  | ['js', Date]
  | ['config', string, GoogleTagConfig]
  | ['event', string, Record<string, string | number>]

type GoogleTagFunction = (...args: GoogleTagArguments) => void

interface AnalyticsWindow extends Window {
  dataLayer?: IArguments[]
  gtag?: GoogleTagFunction
  __rainnearGoogleAnalyticsInitialized__?: boolean
}

const PRODUCTION_HOSTNAME = 'idprint.rainnear.com'
const GOOGLE_TAG_SCRIPT_ID = 'rainnear-google-tag'
const MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]{6,}$/i

/** 返回当前浏览器窗口的分析扩展类型，服务端或测试无窗口时返回空，喵~ */
function getAnalyticsWindow(): AnalyticsWindow | undefined {
  if (typeof window === 'undefined') return undefined
  return window as AnalyticsWindow
}

/** 创建与 Google 官方片段一致的队列函数，使脚本异步加载前的事件不会丢失，喵~ */
function createGoogleTag(analyticsWindow: AnalyticsWindow): GoogleTagFunction {
  return function googleTag(..._args: GoogleTagArguments): void {
    analyticsWindow.dataLayer?.push(arguments)
  }
}

/** 仅在正式域名和合法 Measurement ID 下异步初始化 GA4，重复调用保持幂等，喵~ */
export function initializeAnalytics(options: AnalyticsInitializationOptions = {}): boolean {
  const analyticsWindow = getAnalyticsWindow()
  if (!analyticsWindow || typeof document === 'undefined') return false

  const measurementId = options.measurementId ?? import.meta.env.VITE_GA_MEASUREMENT_ID
  const isProduction = options.isProduction ?? import.meta.env.PROD
  const hostname = options.hostname ?? analyticsWindow.location.hostname
  const telemetryEnabled = options.telemetryEnabled ?? import.meta.env.VITE_TELEMETRY_ENABLED === 'true'
  if (
    !telemetryEnabled
    || !isProduction
    || hostname !== PRODUCTION_HOSTNAME
    || !measurementId
    || !MEASUREMENT_ID_PATTERN.test(measurementId)
  ) {
    return false
  }
  if (analyticsWindow.__rainnearGoogleAnalyticsInitialized__) return true

  try {
    analyticsWindow.dataLayer ??= []
    analyticsWindow.gtag ??= createGoogleTag(analyticsWindow)
    analyticsWindow.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    })
    analyticsWindow.gtag('js', new Date())
    analyticsWindow.gtag('config', measurementId, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      send_page_view: true,
    })

    if (!document.getElementById(GOOGLE_TAG_SCRIPT_ID)) {
      const script = document.createElement('script')
      script.id = GOOGLE_TAG_SCRIPT_ID
      script.async = true
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
      document.head.append(script)
    }
    analyticsWindow.__rainnearGoogleAnalyticsInitialized__ = true
    return true
  } catch {
    return false
  }
}

/** 发送经过类型约束的产品事件，未启用或被浏览器拦截时静默跳过，喵~ */
export function trackAnalyticsEvent<EventName extends keyof AnalyticsEventMap>(
  eventName: EventName,
  parameters: AnalyticsEventMap[EventName],
): void {
  const analyticsWindow = getAnalyticsWindow()
  if (!analyticsWindow?.__rainnearGoogleAnalyticsInitialized__ || !analyticsWindow.gtag) return
  analyticsWindow.gtag('event', eventName, parameters)
}
