/** 展示首页核心搜索主题与产品价值，供构建期和客户端共同渲染，喵~ */
export function SeoIntro() {
  return (
    <section className="intro-panel" aria-labelledby="page-title">
      <div className="eyebrow">FREE · PRIVATE · PRINT-READY · 300 DPI</div>
      <h1 id="page-title">免费在线证件照排版，<br /><em>排得刚刚好。</em></h1>
      <div className="intro-copy">
        <p>一键换底、多尺寸混排、6 寸相纸与 A4 冲印级导出。无需注册，照片不上传服务器，隐私留在你的设备。</p>
        <a className="intro-action" href="#editor">开始排版</a>
      </div>
      <div className="feature-row" aria-label="核心能力">
        <span>本地智能抠图</span><span>毫米级排版</span><span>多照片混排</span>
      </div>
    </section>
  )
}

/** 展示搜索引擎和用户都可直接阅读的产品说明与常见问题，喵~ */
export function SeoDetails() {
  return (
    <section className="seo-details" aria-labelledby="seo-details-title">
      <div className="seo-heading">
        <span>HOW IT WORKS</span>
        <h2 id="seo-details-title">三步生成 300 DPI 证件照冲印图</h2>
        <p>从本地照片到可打印排版图，全程在当前浏览器中完成。</p>
      </div>

      <ol id="how-it-works" className="steps-grid">
        <li><b>01</b><h3>添加本地照片</h3><p>支持 JPEG、PNG 和 WebP，可一次添加多个人或多种尺寸。</p></li>
        <li><b>02</b><h3>选择尺寸与纸张</h3><p>选择一寸、二寸等常用证件照规格，再选择 6 寸（4R）、A4 等输出纸张。</p></li>
        <li><b>03</b><h3>预览并导出</h3><p>调整底色、数量、间距和分隔线，导出带 300 DPI 元数据的 JPEG。</p></li>
      </ol>

      <div className="seo-info-grid">
        <article>
          <span className="seo-card-kicker">LAYOUT</span>
          <h3>支持单照片与多照片混合排版</h3>
          <p>单张照片可以自动铺满纸张，也可以指定数量；多张照片能够分别设置尺寸和份数后混合排版，减少相纸浪费。</p>
          <a href="#editor">使用在线排版工具</a>
        </article>
        <article id="privacy">
          <span className="seo-card-kicker">PRIVACY</span>
          <h3>照片不上传，只在设备本地处理</h3>
          <p>照片读取、人物抠图、背景替换、画布渲染与 JPEG 导出都在浏览器内完成。首次智能换底只会联网下载模型资源。</p>
          <a href="#editor">本地添加照片</a>
        </article>
      </div>

      <section className="faq-section" aria-labelledby="faq-title">
        <div>
          <span className="seo-card-kicker">FAQ</span>
          <h2 id="faq-title">证件照排版常见问题</h2>
        </div>
        <div className="faq-list">
          <details>
            <summary>雨邻证照是否免费，需要注册吗？</summary>
            <p>当前工具可以免费使用，无需注册账号。添加照片后即可排版、换底并导出冲印图。</p>
          </details>
          <details>
            <summary>在线处理证件照会上传照片吗？</summary>
            <p>不会。照片内容和导出结果只保留在当前设备的浏览器中，服务器不会接收用户照片。</p>
          </details>
          <details>
            <summary>为什么导出图片标注为 300 DPI？</summary>
            <p>300 DPI 是常见照片冲印精度。工具会根据纸张毫米尺寸生成对应像素，并把 300 DPI 信息写入 JPEG。</p>
          </details>
          <details>
            <summary>能把不同尺寸的照片排在同一张纸上吗？</summary>
            <p>可以。选择“混合排版”后，每张照片都能独立选择规格和份数，再统一排列到所选纸张中。</p>
          </details>
        </div>
      </section>
    </section>
  )
}

/** 输出无需 JavaScript 也能读取的构建期首页主体，喵~ */
export function StaticSeoPage() {
  return (
    <main id="top" className="workspace static-seo-page">
      <SeoIntro />
      <SeoDetails />
    </main>
  )
}
