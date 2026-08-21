import type { SeoQuickFlowDefinition } from './seo-config'

interface SeoLandingPageProps {
  definition: SeoQuickFlowDefinition
}

/** 渲染可被搜索引擎直接读取的页面正文和极速上传入口，喵~ */
export function SeoLandingPage({ definition }: SeoLandingPageProps) {
  const oneInchPixels = '591 × 827 px'
  const oneInchCapacity = 12
  const twoInchCapacity = 8

  return (
    <div className="seo-page-shell">
      <header className="seo-site-header">
        <a className="seo-brand" href="/"><span>R</span><strong>雨邻证照</strong></a>
        <a className="seo-full-tool-link" href="/#editor">完整工具</a>
      </header>

      <main>
        <section className="seo-hero">
          <div className="seo-hero-copy">
            <p className="seo-eyebrow">{definition.eyebrow}</p>
            <h1>{definition.heading}</h1>
            <p>{definition.summary}</p>
            <div className="seo-trust-row"><span>无需注册</span><span>照片不上传</span><span>默认高清模型</span></div>
          </div>

          <section className="seo-quick-card" aria-labelledby="seo-quick-title">
            <div id="seo-quick-editor" data-flow-id={definition.id}>
              <div className="seo-quick-launch" data-quick-launch>
                <span className="seo-quick-badge">两步完成</span>
                <h2 id="seo-quick-title">上传照片，自动生成结果</h2>
                <p>选择照片后立即在浏览器内加载高清模型，首次约需下载 80 MB 资源。</p>
                <label className="seo-upload-button">
                  <input data-quick-file-input type="file" accept="image/jpeg,image/png,image/webp" />
                  <span>{definition.uploadLabel}</span>
                </label>
                <small>支持 JPEG、PNG、WebP · 单张不超过 8 MB</small>
              </div>
            </div>
            <noscript><p className="seo-noscript">当前浏览器未启用 JavaScript，请使用<a href="/#editor">完整工具</a>制作照片。</p></noscript>
          </section>
        </section>

        {definition.id === 'one-inch' && (
          <section className="seo-content-section">
            <div><p className="seo-section-kicker">SIZE GUIDE</p><h2>一寸照片尺寸和像素</h2></div>
            <div className="seo-answer-card">
              <strong>25 × 35 mm</strong><span>{oneInchPixels} · 600 DPI</span>
              <p>雨邻证照按常用一寸物理尺寸输出 JPEG。不同考试、证件和办事系统还可能要求特定人像比例、文件体积或背景色，提交前请以受理机构要求为准。</p>
            </div>
            <ol className="seo-simple-steps"><li><b>1</b><span>选择正面、光线均匀的照片</span></li><li><b>2</b><span>等待高清抠图和白底结果</span></li><li><b>3</b><span>需要时拖动人物，随后下载</span></li></ol>
          </section>
        )}

        {definition.id === 'print-layout' && (
          <section className="seo-content-section">
            <div><p className="seo-section-kicker">PRINT LAYOUT</p><h2>6 寸相纸能排多少张证件照？</h2></div>
            <div className="seo-capacity-grid"><article><strong>{oneInchCapacity}<small> 张</small></strong><span>一寸 · 25×35mm</span></article><article><strong>{twoInchCapacity}<small> 张</small></strong><span>二寸 · 35×49mm</span></article><article><strong>600<small> DPI</small></strong><span>6 寸 · 152×102mm</span></article></div>
            <p className="seo-section-copy">以上结果由本站排版算法按 2 mm 照片间距实时计算。下载后交给冲印店时请选择 6 寸相纸并关闭自动缩放，以实际尺寸输出。</p>
          </section>
        )}

        {definition.id === 'background' && (
          <section className="seo-content-section">
            <div><p className="seo-section-kicker">LOCAL BACKGROUND</p><h2>一次抠图，随时切换四种底色</h2></div>
            <div className="seo-color-guide"><span style={{ background: '#ffffff' }}>白底</span><span style={{ background: '#438edb', color: '#fff' }}>蓝底</span><span style={{ background: '#d6453d', color: '#fff' }}>红底</span><span style={{ background: '#c8c8c8' }}>灰底</span></div>
            <p className="seo-section-copy">人物抠图、背景替换、裁切和 JPEG 导出都在当前浏览器完成。网络只用于加载页面与本地推理模型，服务器不会接收你的照片。</p>
          </section>
        )}

        <section className="seo-faq" aria-labelledby="seo-faq-title">
          <div><p className="seo-section-kicker">FAQ</p><h2 id="seo-faq-title">常见问题</h2></div>
          <div>
            <details><summary>为什么没有 DPI、模型和纸张选项？</summary><p>极速页面已固定使用 600 DPI 和高清模型；排版页固定为最常用的 6 寸相纸，减少不必要的选择。</p></details>
            <details><summary>上传照片后会保存到服务器吗？</summary><p>不会。照片读取、高清抠图、换底、裁切、排版和导出都在当前设备的浏览器内完成。</p></details>
            <details><summary>第一次处理为什么需要等待？</summary><p>首次上传后需要下载约 80 MB 的高清本地模型，之后浏览器缓存可减少重复加载时间。</p></details>
            <details><summary>需要其他证件规格或自定义参数怎么办？</summary><p>请使用<a href="/#editor">完整工具</a>，其中保留多照片混排、自定义毫米尺寸、纸张、DPI 和专业边缘微调。</p></details>
          </div>
        </section>

        <nav className="seo-related" aria-label="相关证件照工具">
          <h2>相关工具</h2>
          <div>{SEO_RELATED_LINKS.filter((link) => link.path !== definition.path).map((link) => <a key={link.path} href={link.path}>{link.label}<span>→</span></a>)}</div>
        </nav>
      </main>

      <footer className="seo-site-footer"><span>雨邻证照 · Rainnear Photo</span><span>照片只在浏览器本地处理</span><a href="mailto:idprint@rainnear.com">idprint@rainnear.com</a></footer>
    </div>
  )
}

const SEO_RELATED_LINKS = [
  { path: '/one-inch-photo/', label: '一寸照片在线制作' },
  { path: '/id-photo-print-layout/', label: '证件照 6 寸排版' },
  { path: '/id-photo-background/', label: '证件照在线换底色' },
] as const
