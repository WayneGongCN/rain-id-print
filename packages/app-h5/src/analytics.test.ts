import { afterEach, describe, expect, it, vi } from 'vitest'
import { initializeAnalytics, trackAnalyticsEvent } from './analytics'

interface FakeScript {
  async: boolean
  id: string
  src: string
}

interface FakeAnalyticsWindow {
  dataLayer?: IArguments[]
  gtag?: (...args: unknown[]) => void
  __rainnearGoogleAnalyticsInitialized__?: boolean
  location: {
    hostname: string
  }
}

/** 创建足以验证脚本注入和 dataLayer 队列的浏览器替身，喵~ */
function installBrowser(hostname = 'idprint.rainnear.com') {
  const scripts: FakeScript[] = []
  const fakeWindow: FakeAnalyticsWindow = { location: { hostname } }
  const fakeDocument = {
    createElement: vi.fn((): FakeScript => ({ async: false, id: '', src: '' })),
    getElementById: vi.fn((id: string) => scripts.find((script) => script.id === id) ?? null),
    head: {
      append: vi.fn((script: FakeScript) => {
        scripts.push(script)
      }),
    },
  }
  vi.stubGlobal('window', fakeWindow)
  vi.stubGlobal('document', fakeDocument)
  return { fakeDocument, fakeWindow, scripts }
}

/** 将 gtag 标准 arguments 队列转换为便于断言的普通数组，喵~ */
function readDataLayer(fakeWindow: FakeAnalyticsWindow): unknown[][] {
  return (fakeWindow.dataLayer ?? []).map((item) => Array.from(item))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('initializeAnalytics', () => {
  it('在正式域名和合法 ID 下初始化隐私配置、页面访问与异步脚本', () => {
    const { fakeWindow, scripts } = installBrowser()

    const initialized = initializeAnalytics({
      measurementId: 'G-ABC12345',
      isProduction: true,
      telemetryEnabled: true,
    })

    expect(initialized).toBe(true)
    expect(scripts).toEqual([{
      async: true,
      id: 'rainnear-google-tag',
      src: 'https://www.googletagmanager.com/gtag/js?id=G-ABC12345',
    }])
    expect(readDataLayer(fakeWindow)).toEqual([
      ['consent', 'default', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      }],
      ['js', expect.any(Date)],
      ['config', 'G-ABC12345', {
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        send_page_view: true,
      }],
    ])
  })

  it.each([
    ['缺少 ID', { measurementId: undefined, isProduction: true, telemetryEnabled: true }],
    ['非法 ID', { measurementId: 'UA-123456', isProduction: true, telemetryEnabled: true }],
    ['非生产构建', { measurementId: 'G-ABC12345', isProduction: false, telemetryEnabled: true }],
    ['遥测开关关闭', { measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: false }],
  ] as const)('%s 时不加载 GA', (_scenario, options) => {
    const { fakeWindow, scripts } = installBrowser()

    expect(initializeAnalytics(options)).toBe(false)
    expect(scripts).toHaveLength(0)
    expect(fakeWindow.dataLayer).toBeUndefined()
  })

  it('在非正式域名下不加载 GA', () => {
    const { scripts } = installBrowser('sandphoto-preview.vercel.app')

    expect(initializeAnalytics({
      measurementId: 'G-ABC12345',
      isProduction: true,
      telemetryEnabled: true,
    })).toBe(false)
    expect(scripts).toHaveLength(0)
  })

  it('重复初始化时只注入一次脚本和配置', () => {
    const { fakeWindow, scripts } = installBrowser()
    const options = { measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: true }

    expect(initializeAnalytics(options)).toBe(true)
    expect(initializeAnalytics(options)).toBe(true)

    expect(scripts).toHaveLength(1)
    expect(readDataLayer(fakeWindow)).toHaveLength(3)
  })

  it('脚本无法注入时静默失败且不启用事件发送', () => {
    const { fakeDocument, fakeWindow } = installBrowser()
    fakeDocument.head.append.mockImplementation(() => {
      throw new Error('脚本被内容安全策略拦截')
    })

    expect(initializeAnalytics({
      measurementId: 'G-ABC12345',
      isProduction: true,
      telemetryEnabled: true,
    })).toBe(false)
    expect(() => trackAnalyticsEvent('reward_dialog_open', {})).not.toThrow()
    expect(fakeWindow.__rainnearGoogleAnalyticsInitialized__).not.toBe(true)
  })
})

describe('trackAnalyticsEvent', () => {
  it('将类型约束的事件加入现有 dataLayer', () => {
    const { fakeWindow } = installBrowser()
    initializeAnalytics({ measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: true })

    trackAnalyticsEvent('photo_export', {
      layout_mode: 'mixed',
      paper_spec_id: '6r',
      placed_count: 8,
      export_dpi: 350,
    })

    expect(readDataLayer(fakeWindow).at(-1)).toEqual([
      'event',
      'photo_export',
      { layout_mode: 'mixed', paper_spec_id: '6r', placed_count: 8, export_dpi: 350 },
    ])
  })

  it('记录抠图模型切换但不包含照片内容', () => {
    const { fakeWindow } = installBrowser()
    initializeAnalytics({ measurementId: 'G-ABC12345', isProduction: true, telemetryEnabled: true })

    trackAnalyticsEvent('background_model_change', {
      from_model_id: 'fast',
      to_model_id: 'quality',
      processed_photo_count: 3,
    })

    expect(readDataLayer(fakeWindow).at(-1)).toEqual([
      'event',
      'background_model_change',
      { from_model_id: 'fast', to_model_id: 'quality', processed_photo_count: 3 },
    ])
  })

  it('GA 未初始化时发送事件不会抛错或创建队列', () => {
    const { fakeWindow } = installBrowser('localhost')

    expect(() => trackAnalyticsEvent('photo_import', {
      input_method: 'picker',
      photo_count: 1,
    })).not.toThrow()
    expect(fakeWindow.dataLayer).toBeUndefined()
  })
})
