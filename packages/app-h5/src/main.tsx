import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { initializeAnalytics } from './analytics'
import './styles.css'

initializeAnalytics()

const root = document.getElementById('root')
if (!root) throw new Error('缺少应用根节点')

// 移除构建期静态内容后挂载完整编辑器，页面可见正文会由同一组组件重新渲染，喵~
root.replaceChildren()
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
