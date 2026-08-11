import type { PaperSpec, PhotoSpec } from './types'

export const PHOTO_SPECS: readonly PhotoSpec[] = [
  { id: 'one-inch', name: '一寸', width: 25, height: 35, category: 'photo' },
  { id: 'small-one-inch', name: '小一寸', width: 22, height: 32, category: 'photo' },
  { id: 'large-one-inch', name: '大一寸', width: 33, height: 48, category: 'photo' },
  { id: 'two-inch', name: '二寸', width: 35, height: 49, category: 'photo' },
  { id: 'large-two-inch', name: '大二寸', width: 35, height: 53, category: 'photo' },
  { id: 'china-passport', name: '中国护照', width: 33, height: 48, category: 'photo' },
  { id: 'us-visa', name: '美国签证', width: 51, height: 51, category: 'photo' },
  { id: 'japan-visa', name: '日本签证', width: 45, height: 45, category: 'photo' },
  { id: 'driver-license', name: '驾驶证', width: 22, height: 32, category: 'photo' },
  { id: 'social-security', name: '社保照片', width: 26, height: 32, category: 'photo' },
]

export const PAPER_SPECS: readonly PaperSpec[] = [
  { id: '5r', name: '5 寸（3R）', width: 127, height: 89, category: 'paper' },
  { id: '6r', name: '6 寸（4R）', width: 152, height: 102, category: 'paper' },
  { id: '7r', name: '7 寸（5R）', width: 178, height: 127, category: 'paper' },
  { id: '8r', name: '8 寸（6R）', width: 203, height: 152, category: 'paper' },
  { id: '10r', name: '10 寸（8R）', width: 254, height: 203, category: 'paper' },
  { id: 'a5', name: 'A5', width: 148, height: 210, category: 'paper' },
  { id: 'a4', name: 'A4', width: 210, height: 297, category: 'paper' },
  { id: 'a3', name: 'A3', width: 297, height: 420, category: 'paper' },
]

/** 根据规格标识读取证件照尺寸，喵~ */
export function getPhotoSpec(id: string): PhotoSpec | undefined {
  return PHOTO_SPECS.find((spec) => spec.id === id)
}

/** 根据规格标识读取输出纸张尺寸，喵~ */
export function getPaperSpec(id: string): PaperSpec | undefined {
  return PAPER_SPECS.find((spec) => spec.id === id)
}

