interface RandomSource {
  randomUUID?: () => string
  getRandomValues?: (values: Uint8Array) => Uint8Array
}

/** 将 16 字节随机数格式化为 RFC 4122 v4 UUID，喵~ */
function formatUuid(bytes: Uint8Array): string {
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'))
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`
}

/** 在 HTTPS、新旧 WebView 和普通局域网 HTTP 中生成本地资源标识，喵~ */
export function createResourceId(source: RandomSource | undefined = globalThis.crypto): string {
  if (typeof source?.randomUUID === 'function') return source.randomUUID()
  if (typeof source?.getRandomValues === 'function') {
    const bytes = source.getRandomValues(new Uint8Array(16))
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
    return formatUuid(bytes)
  }
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}
