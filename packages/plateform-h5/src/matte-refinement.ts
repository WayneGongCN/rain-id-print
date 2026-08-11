import {
  normalizeBackgroundTuning,
  type BackgroundTuning,
} from '@rainnear/core'

export type RgbColor = readonly [number, number, number]

/** 在横向或纵向邻域执行透明度膨胀或腐蚀，喵~ */
function filterAlphaNeighborhood(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  horizontal: boolean,
  useMaximum: boolean,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(source.length)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let selected = useMaximum ? 0 : 255
      for (let offset = -radius; offset <= radius; offset += 1) {
        const sampleX = horizontal ? Math.min(width - 1, Math.max(0, x + offset)) : x
        const sampleY = horizontal ? y : Math.min(height - 1, Math.max(0, y + offset))
        const value = source[sampleY * width + sampleX] ?? 0
        selected = useMaximum ? Math.max(selected, value) : Math.min(selected, value)
      }
      result[y * width + x] = selected
    }
  }
  return result
}

/** 使用分离盒式滤波对透明通道做实时羽化，喵~ */
function blurAlpha(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return new Uint8ClampedArray(source)
  const horizontal = new Uint8ClampedArray(source.length)
  const result = new Uint8ClampedArray(source.length)
  const diameter = radius * 2 + 1

  for (let y = 0; y < height; y += 1) {
    let sum = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += source[y * width + Math.min(width - 1, Math.max(0, offset))] ?? 0
    }
    for (let x = 0; x < width; x += 1) {
      horizontal[y * width + x] = Math.round(sum / diameter)
      const leavingX = Math.min(width - 1, Math.max(0, x - radius))
      const enteringX = Math.min(width - 1, Math.max(0, x + radius + 1))
      sum += (source[y * width + enteringX] ?? 0) - (source[y * width + leavingX] ?? 0)
    }
  }

  for (let x = 0; x < width; x += 1) {
    let sum = 0
    for (let offset = -radius; offset <= radius; offset += 1) {
      sum += horizontal[Math.min(height - 1, Math.max(0, offset)) * width + x] ?? 0
    }
    for (let y = 0; y < height; y += 1) {
      result[y * width + x] = Math.round(sum / diameter)
      const leavingY = Math.min(height - 1, Math.max(0, y - radius))
      const enteringY = Math.min(height - 1, Math.max(0, y + radius + 1))
      sum += (horizontal[enteringY * width + x] ?? 0) - (horizontal[leavingY * width + x] ?? 0)
    }
  }
  return result
}

/** 增强半透明边缘的对比度并保持纯透明和纯不透明区域，喵~ */
function hardenAlpha(value: number, amount: number): number {
  if (amount <= 0 || value <= 0 || value >= 255) return value
  const normalized = value / 255
  const exponent = 1 + amount / 25
  const hardened = normalized < 0.5
    ? 0.5 * Math.pow(normalized * 2, exponent)
    : 1 - 0.5 * Math.pow((1 - normalized) * 2, exponent)
  return Math.round(hardened * 255)
}

/** 根据专业参数生成新的透明蒙版，喵~ */
export function refineAlphaChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  tuning?: Partial<BackgroundTuning>,
): Uint8ClampedArray {
  if (source.length !== width * height) throw new RangeError('透明蒙版尺寸与像素数量不一致')
  const normalized = normalizeBackgroundTuning(tuning)
  let refined: Uint8ClampedArray<ArrayBufferLike> = new Uint8ClampedArray(source)

  const edgeRadius = Math.abs(normalized.edgeShiftPx)
  if (edgeRadius > 0) {
    const useMaximum = normalized.edgeShiftPx > 0
    refined = filterAlphaNeighborhood(refined, width, height, edgeRadius, true, useMaximum)
    refined = filterAlphaNeighborhood(refined, width, height, edgeRadius, false, useMaximum)
  }

  refined = blurAlpha(refined, width, height, Math.round(normalized.featherPx))
  if (normalized.edgeHardness > 0) {
    refined.forEach((value, index) => {
      refined[index] = hardenAlpha(value, normalized.edgeHardness)
    })
  }
  return refined
}

/** 为扩展或羽化产生的新边缘复制最近的前景颜色，避免出现黑边，喵~ */
function propagateEdgeColor(
  pixels: Uint8ClampedArray,
  originalAlpha: Uint8ClampedArray,
  refinedAlpha: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): void {
  if (radius <= 0) return
  const originalPixels = new Uint8ClampedArray(pixels)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x
      if ((refinedAlpha[pixelIndex] ?? 0) <= (originalAlpha[pixelIndex] ?? 0) || (originalAlpha[pixelIndex] ?? 0) > 16) continue
      let selectedIndex = pixelIndex
      let selectedAlpha = originalAlpha[pixelIndex] ?? 0
      for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
        const sampleY = Math.min(height - 1, Math.max(0, y + offsetY))
        for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
          const sampleX = Math.min(width - 1, Math.max(0, x + offsetX))
          const sampleIndex = sampleY * width + sampleX
          const sampleAlpha = originalAlpha[sampleIndex] ?? 0
          if (sampleAlpha > selectedAlpha) {
            selectedAlpha = sampleAlpha
            selectedIndex = sampleIndex
          }
        }
      }
      const target = pixelIndex * 4
      const source = selectedIndex * 4
      pixels[target] = originalPixels[source] ?? 0
      pixels[target + 1] = originalPixels[source + 1] ?? 0
      pixels[target + 2] = originalPixels[source + 2] ?? 0
    }
  }
}

/** 使用估算的原背景颜色减少头发和衣物边缘的背景色溢出，喵~ */
function decontaminateEdges(
  pixels: Uint8ClampedArray,
  originalAlpha: Uint8ClampedArray,
  background: RgbColor,
  amount: number,
): void {
  if (amount <= 0) return
  const strength = amount / 100
  for (let index = 0; index < originalAlpha.length; index += 1) {
    const alpha = (originalAlpha[index] ?? 0) / 255
    if (alpha <= 0.04 || alpha >= 0.98) continue
    const weight = strength * (1 - alpha)
    const pixelIndex = index * 4
    for (let channel = 0; channel < 3; channel += 1) {
      const current = pixels[pixelIndex + channel] ?? 0
      const corrected = Math.min(255, Math.max(0, (current - (background[channel] ?? 0) * (1 - alpha)) / alpha))
      pixels[pixelIndex + channel] = Math.round(current + (corrected - current) * weight)
    }
  }
}

/** 将透明蒙版微调和边缘去色应用到 RGBA 像素，喵~ */
export function refineRgbaPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  background: RgbColor,
  tuning?: Partial<BackgroundTuning>,
): Uint8ClampedArray {
  if (pixels.length !== width * height * 4) throw new RangeError('RGBA 尺寸与像素数量不一致')
  const normalized = normalizeBackgroundTuning(tuning)
  const result = new Uint8ClampedArray(pixels)
  const originalAlpha = new Uint8ClampedArray(width * height)
  for (let index = 0; index < originalAlpha.length; index += 1) originalAlpha[index] = result[index * 4 + 3] ?? 0
  const refinedAlpha = refineAlphaChannel(originalAlpha, width, height, normalized)
  const propagationRadius = Math.max(Math.abs(normalized.edgeShiftPx), Math.ceil(normalized.featherPx))
  propagateEdgeColor(result, originalAlpha, refinedAlpha, width, height, propagationRadius)
  decontaminateEdges(result, originalAlpha, background, normalized.decontaminate)
  for (let index = 0; index < refinedAlpha.length; index += 1) result[index * 4 + 3] = refinedAlpha[index] ?? 0
  return result
}
