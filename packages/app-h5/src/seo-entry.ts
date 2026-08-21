import { initializeAnalytics, trackAnalyticsEvent } from './analytics'
import { getSeoQuickFlowDefinition, type SeoQuickFlowId } from './seo-config'

initializeAnalytics()

const container = document.getElementById('seo-quick-editor')
const flowId = container?.dataset.flowId
const flow = flowId ? getSeoQuickFlowDefinition(flowId) : undefined
const fileInput = container?.querySelector<HTMLInputElement>('[data-quick-file-input]')

if (container && flow && fileInput) {
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    fileInput.value = ''
    if (!file) return
    try {
      const { mountSeoQuickEditor } = await import('./SeoQuickEditor')
      mountSeoQuickEditor(container, flow.id as SeoQuickFlowId, file)
    } catch {
      container.innerHTML = '<div class="quick-bootstrap-error" role="alert">极速工具加载失败，请刷新页面后重试，或使用<a href="/#editor">完整工具</a>。</div>'
      trackAnalyticsEvent('seo_quick_error', { landing_page: flow.id, failure_stage: 'bootstrap' })
    }
  })
}

document.querySelectorAll<HTMLAnchorElement>('[data-full-editor-link], .seo-full-tool-link').forEach((link) => {
  link.addEventListener('click', () => {
    if (flow) trackAnalyticsEvent('seo_full_editor_open', { landing_page: flow.id })
  })
})
