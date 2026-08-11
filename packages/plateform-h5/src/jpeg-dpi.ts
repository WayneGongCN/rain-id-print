/** 将 DPI 数值限制在 JFIF 双字节密度字段范围内，喵~ */
function normalizeDpi(dpi: number): number {
  if (!Number.isFinite(dpi) || dpi <= 0 || dpi > 65_535) throw new RangeError('DPI 必须位于 1 到 65535 之间')
  return Math.round(dpi)
}

/** 在 JPEG 中更新现有 JFIF 密度，缺失时插入标准 APP0 段，喵~ */
export function patchJpegDpiBytes(source: Uint8Array, dpi: number): Uint8Array {
  const density = normalizeDpi(dpi)
  if (source[0] !== 0xff || source[1] !== 0xd8) throw new TypeError('输入内容不是有效 JPEG')

  const output = new Uint8Array(source)
  let offset = 2
  while (offset + 4 < output.length && output[offset] === 0xff) {
    const marker = output[offset + 1]
    if (marker === 0xda || marker === 0xd9 || marker === undefined) break
    const length = ((output[offset + 2] ?? 0) << 8) | (output[offset + 3] ?? 0)
    if (length < 2 || offset + 2 + length > output.length) break

    const isJfif = marker === 0xe0
      && output[offset + 4] === 0x4a
      && output[offset + 5] === 0x46
      && output[offset + 6] === 0x49
      && output[offset + 7] === 0x46
      && output[offset + 8] === 0

    if (isJfif && length >= 16) {
      output[offset + 11] = 1
      output[offset + 12] = density >> 8
      output[offset + 13] = density & 0xff
      output[offset + 14] = density >> 8
      output[offset + 15] = density & 0xff
      return output
    }
    offset += 2 + length
  }

  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00,
    0x01, 0x01, 0x01,
    density >> 8, density & 0xff,
    density >> 8, density & 0xff,
    0x00, 0x00,
  ])
  const withJfif = new Uint8Array(source.length + app0.length)
  withJfif.set(source.subarray(0, 2), 0)
  withJfif.set(app0, 2)
  withJfif.set(source.subarray(2), 2 + app0.length)
  return withJfif
}

/** 将浏览器编码的 JPEG Blob 修正为明确的目标 DPI，喵~ */
export async function patchJpegDpi(blob: Blob, dpi: number): Promise<Blob> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const patched = patchJpegDpiBytes(bytes, dpi)
  const copied = Uint8Array.from(patched)
  return new Blob([copied.buffer], { type: 'image/jpeg' })
}
