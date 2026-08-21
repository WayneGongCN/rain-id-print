import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { StaticSeoPage } from './src/SeoContent'
import { getSeoHtmlFileName, renderSeoDocument, renderSeoSitemap } from './src/seo-build'
import { SEO_QUICK_FLOW_DEFINITIONS } from './src/seo-config'

/** 在构建和开发服务器返回的 HTML 中写入可直接抓取的首页正文，喵~ */
function prerenderSeoContent() {
  return {
    name: 'rainnear-prerender-seo-content',
    transformIndexHtml(html: string): string {
      return html.replace('<!--seo-prerender-->', renderToStaticMarkup(createElement(StaticSeoPage)))
    },
  }
}

/** 将共享页面清单输出为独立 HTML、轻量入口和站点地图，喵~ */
function generateSeoLandingPages(): Plugin {
  return {
    name: 'rainnear-generate-seo-landing-pages',
    generateBundle(_options, bundle) {
      const seoEntry = Object.values(bundle).find((output) => output.type === 'chunk' && output.facadeModuleId?.endsWith('/src/seo-entry.ts'))
      if (!seoEntry) throw new Error('SEO 极速页面缺少轻量客户端入口')
      const paths = new Set<string>()
      for (const definition of SEO_QUICK_FLOW_DEFINITIONS) {
        if (paths.has(definition.path)) throw new Error(`SEO 页面路径重复：${definition.path}`)
        paths.add(definition.path)
        this.emitFile({
          type: 'asset',
          fileName: getSeoHtmlFileName(definition.path),
          source: renderSeoDocument(definition, seoEntry.fileName),
        })
      }
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: renderSeoSitemap() })
    },
  }
}

const appDirectory = fileURLToPath(new URL('.', import.meta.url))

/** 创建 H5 MVP 的 Vite 构建配置，喵~ */
export default defineConfig({
  plugins: [react(), prerenderSeoContent(), generateSeoLandingPages()],
  server: {
    port: 5173,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  preview: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        app: `${appDirectory}index.html`,
        seo: `${appDirectory}src/seo-entry.ts`,
      },
    },
  },
})
