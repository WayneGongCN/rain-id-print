import { describe, expect, it } from 'vitest'
import { getCropZoom, getPhotoSpec } from '@rainnear/core'
import { createInitialAppPhoto, createPhotoDownloadFilename, retargetAppPhoto } from './photo-output-settings'

const ASSET = {
  id: 'photo-1',
  name: '证件/照片?.png',
  objectUrl: 'blob:photo-1',
  width: 1200,
  height: 1600,
  size: 1024,
}

describe('photo output settings', () => {
  it('为新照片初始化一寸居中裁切和默认 DPI', () => {
    const photo = createInitialAppPhoto(ASSET)

    expect(photo.presetId).toBe('one-inch')
    expect(photo.outputDpi).toBe(300)
    expect(photo.background).toBe('keep')
    expect(photo.crop.x + photo.crop.width / 2).toBeCloseTo(0.5)
    expect(photo.crop.y + photo.crop.height / 2).toBeCloseTo(0.5)
  })

  it('切换规格时保留焦点并提高但不降低成片 DPI', () => {
    const photo = createInitialAppPhoto(ASSET)
    const resident = retargetAppPhoto(photo, 'resident-id-card')
    const oneInchAgain = retargetAppPhoto(resident, 'one-inch')
    const residentSpec = getPhotoSpec('resident-id-card')
    if (!residentSpec) throw new Error('测试缺少身份证规格')

    expect(resident.outputDpi).toBe(350)
    expect(oneInchAgain.outputDpi).toBe(350)
    expect(getCropZoom({ width: resident.width, height: resident.height }, residentSpec, resident.crop)).toBeCloseTo(1)
  })

  it('多张照片的规格、裁切和 DPI 状态互不影响', () => {
    const first = createInitialAppPhoto(ASSET)
    const second = createInitialAppPhoto({ ...ASSET, id: 'photo-2', name: 'second.jpg' })
    const updatedFirst = retargetAppPhoto(first, 'resident-id-card')

    expect(updatedFirst.presetId).toBe('resident-id-card')
    expect(updatedFirst.outputDpi).toBe(350)
    expect(second.presetId).toBe('one-inch')
    expect(second.outputDpi).toBe(300)
    expect(second.crop).toEqual(createInitialAppPhoto({ ...ASSET, id: 'photo-2' }).crop)
  })

  it('生成不包含路径分隔符和原扩展名的安全文件名', () => {
    const photo = createInitialAppPhoto(ASSET)
    const spec = getPhotoSpec(photo.presetId)
    if (!spec) throw new Error('测试缺少默认规格')

    expect(createPhotoDownloadFilename(photo, spec)).toBe('rainnear_证件_照片__一寸_25x35mm_300dpi.jpg')
  })
})
