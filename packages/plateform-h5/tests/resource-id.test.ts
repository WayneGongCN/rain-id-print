import { describe, expect, it } from 'vitest'
import { createResourceId } from '../src'

describe('createResourceId', () => {
  it('优先使用安全上下文提供的 randomUUID', () => {
    expect(createResourceId({ randomUUID: () => 'native-uuid' })).toBe('native-uuid')
  })

  it('在局域网 HTTP 环境使用 getRandomValues 生成 v4 UUID', () => {
    const id = createResourceId({
      getRandomValues(values) {
        values.fill(0)
        return values
      },
    })
    expect(id).toBe('00000000-0000-4000-8000-000000000000')
  })

  it('在旧 WebView 缺失 Crypto 时仍生成本地资源标识', () => {
    expect(createResourceId({})).toMatch(/^local-/)
  })
})
