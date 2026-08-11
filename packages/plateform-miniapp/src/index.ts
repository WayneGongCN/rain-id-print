export interface MiniappPlatformOptions {
  apiBaseUrl: string
}

/** 为后续微信小程序实现保留稳定入口，当前 H5 MVP 不初始化该平台，喵~ */
export function createMiniappPlatform(_options: MiniappPlatformOptions): never {
  throw new Error('微信小程序平台将在 H5 MVP 验证后实现')
}
