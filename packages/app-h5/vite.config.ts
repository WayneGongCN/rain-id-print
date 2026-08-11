import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { StaticSeoPage } from './src/SeoContent'

/** 在构建和开发服务器返回的 HTML 中写入可直接抓取的首页正文，喵~ */
function prerenderSeoContent() {
  return {
    name: 'rainnear-prerender-seo-content',
    transformIndexHtml(html: string): string {
      return html.replace('<!--seo-prerender-->', renderToStaticMarkup(createElement(StaticSeoPage)))
    },
  }
}

/** 创建 H5 MVP 的 Vite 构建配置，喵~ */
export default defineConfig({
  plugins: [react(), prerenderSeoContent()],
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
  },
})
