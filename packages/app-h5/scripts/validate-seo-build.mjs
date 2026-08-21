import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const appDirectory = fileURLToPath(new URL('../', import.meta.url))
const pages = [
  ['one-inch-photo', '/one-inch-photo/'],
  ['id-photo-print-layout', '/id-photo-print-layout/'],
  ['id-photo-background', '/id-photo-background/'],
]

const titles = new Set()
const entryFiles = new Set()
for (const [directory, path] of pages) {
  const html = await readFile(`${appDirectory}dist/${directory}/index.html`, 'utf8')
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1]
  if (!title) throw new Error(`${path} 缺少页面标题`)
  if (titles.has(title)) throw new Error(`${path} 的页面标题不唯一`)
  titles.add(title)
  if (!html.includes(`rel="canonical" href="https://idprint.rainnear.com${path}"`)) throw new Error(`${path} 的 canonical 不正确`)
  if ((html.match(/<h1/g) ?? []).length !== 1) throw new Error(`${path} 必须且只能包含一个 H1`)
  if (!html.includes('data-quick-file-input="true"')) throw new Error(`${path} 缺少静态上传入口`)
  if (/src="\/assets\/app-[^"]+\.js"/.test(html)) throw new Error(`${path} 首屏错误引用完整编辑器`)
  const entryFile = html.match(/src="\/(assets\/seo-[^"]+\.js)"/)?.[1]
  if (!entryFile) throw new Error(`${path} 缺少轻量启动脚本`)
  entryFiles.add(entryFile)
  for (const forbiddenLabel of ['导出精度', '抠图模型', '纸张尺寸', '高级抠图设置']) {
    if (html.includes(forbiddenLabel)) throw new Error(`${path} 暴露了极速模式控件：${forbiddenLabel}`)
  }
}

for (const entryFile of entryFiles) {
  const entryCode = await readFile(`${appDirectory}dist/${entryFile}`, 'utf8')
  const staticImports = [...entryCode.matchAll(/\bimport(?!\()[^;]+?from"([^"]+)"/g)].map((match) => match[1])
  if (staticImports.some((source) => /SeoQuickEditor|photo-output-settings|ort|app-/.test(source))) {
    throw new Error('SEO 轻量入口静态加载了编辑器或模型依赖')
  }
}

const sitemap = await readFile(`${appDirectory}dist/sitemap.xml`, 'utf8')
for (const [, path] of pages) {
  if (!sitemap.includes(`<loc>https://idprint.rainnear.com${path}</loc>`)) throw new Error(`sitemap 缺少 ${path}`)
}

process.stdout.write('SEO 构建产物校验通过\n')
