import { describe, expect, it } from 'vitest'
import { getSeoHtmlFileName, renderSeoDocument, renderSeoSitemap } from './seo-build'
import { SEO_QUICK_FLOW_DEFINITIONS } from './seo-config'

describe('SEO 静态页面构建', () => {
  it('为每个落地页生成唯一元信息、规范地址和可用上传入口', () => {
    const documents = SEO_QUICK_FLOW_DEFINITIONS.map((definition) => ({
      definition,
      html: renderSeoDocument(definition, 'assets/seo-test.js'),
    }))

    expect(new Set(documents.map(({ definition }) => definition.title)).size).toBe(3)
    for (const { definition, html } of documents) {
      expect(html).toContain(`<link rel="canonical" href="https://idprint.rainnear.com${definition.path}"`)
      expect(html).toContain(`<title>${definition.title}</title>`)
      expect(html.match(/<h1/g)).toHaveLength(1)
      expect(html).toContain('data-quick-file-input="true"')
      expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
      expect(html).toContain('src="/assets/seo-test.js"')
      expect(html).not.toContain('src="/assets/app-')
      expect(html).not.toContain('导出精度')
      expect(html).not.toContain('抠图模型')
      expect(html).not.toContain('纸张尺寸')
    }
  })

  it('页面间保留普通链接并按目录输出 HTML', () => {
    const html = renderSeoDocument(SEO_QUICK_FLOW_DEFINITIONS[0]!, 'assets/seo-test.js')

    for (const definition of SEO_QUICK_FLOW_DEFINITIONS) {
      if (definition.id !== 'one-inch') expect(html).toContain(`href="${definition.path}"`)
      expect(getSeoHtmlFileName(definition.path)).toBe(`${definition.path.slice(1)}index.html`)
    }
    expect(html).toContain('href="/#editor"')
  })

  it('站点地图只写入首页与三个规范落地页', () => {
    const sitemap = renderSeoSitemap()

    expect(sitemap.match(/<url>/g)).toHaveLength(4)
    expect(sitemap).toContain('<loc>https://idprint.rainnear.com/</loc>')
    for (const definition of SEO_QUICK_FLOW_DEFINITIONS) {
      expect(sitemap).toContain(`<loc>https://idprint.rainnear.com${definition.path}</loc>`)
      expect(sitemap).toContain(`<lastmod>${definition.updatedAt}</lastmod>`)
    }
  })
})
