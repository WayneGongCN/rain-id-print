import { renderToStaticMarkup } from 'react-dom/server'
import { SeoLandingPage } from './SeoLandingPage'
import { SEO_QUICK_FLOW_DEFINITIONS, type SeoQuickFlowDefinition } from './seo-config'

const SITE_ORIGIN = 'https://idprint.rainnear.com'

/** 转义写入 HTML 属性和文本节点的开发者配置，喵~ */
function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

/** 生成一个无需客户端渲染即可阅读的完整 SEO 页面文档，喵~ */
export function renderSeoDocument(definition: SeoQuickFlowDefinition, seoEntryPath: string): string {
  const canonical = `${SITE_ORIGIN}${definition.path}`
  const ogImage = `${SITE_ORIGIN}/seo-og/${definition.id}.jpg`
  const structuredData = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: definition.heading,
    url: canonical,
    description: definition.description,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Web',
    inLanguage: 'zh-CN',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
  }).replaceAll('<', '\\u003c')
  const body = renderToStaticMarkup(<SeoLandingPage definition={definition} />)

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#6d5dfc" />
    <meta name="description" content="${escapeHtml(definition.description)}" />
    <meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="stylesheet" href="/seo-pages.css" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="zh_CN" />
    <meta property="og:site_name" content="雨邻证照" />
    <meta property="og:title" content="${escapeHtml(definition.title)}" />
    <meta property="og:description" content="${escapeHtml(definition.description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(definition.title)}" />
    <meta name="twitter:description" content="${escapeHtml(definition.description)}" />
    <meta name="twitter:image" content="${ogImage}" />
    <script type="application/ld+json">${structuredData}</script>
    <title>${escapeHtml(definition.title)}</title>
    <script type="module" crossorigin src="/${seoEntryPath}"></script>
  </head>
  <body>${body}</body>
</html>
`
}

/** 从唯一页面清单生成只包含规范 URL 的站点地图，喵~ */
export function renderSeoSitemap(): string {
  const pages = [{ path: '/', updatedAt: '2026-08-21' }, ...SEO_QUICK_FLOW_DEFINITIONS]
  const urls = pages.map((page) => `  <url>\n    <loc>${SITE_ORIGIN}${page.path}</loc>\n    <lastmod>${page.updatedAt}</lastmod>\n  </url>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

/** 将带首尾斜杠的页面路径转换为静态目录入口，喵~ */
export function getSeoHtmlFileName(path: `/${string}/`): string {
  return `${path.slice(1)}index.html`
}
