import type { PaperSpec, PhotoSpec } from './types'

const EXIT_ENTRY_PHOTO_REFERENCE = Object.freeze({
  name: '国家移民管理局《出入境证件相片照相指引》',
  url: 'https://www.nia.gov.cn/n741445/n741619/n894511/c896346/content.html',
  verifiedAt: '2026-08-12',
})

const RESIDENT_ID_REFERENCE = Object.freeze({
  name: 'GA/T 461—2019《居民身份证制证用数字相片技术要求》',
  url: 'https://std.samr.gov.cn/hb/search/stdHBDetailedCNF?id=92D0FC9FDA76A030E05397BE0A0A408C',
  verifiedAt: '2026-08-12',
})

export const PHOTO_SPECS: readonly PhotoSpec[] = [
  { id: 'one-inch', name: '一寸', width: 25, height: 35, category: 'photo', group: 'common-size', recommendedDpi: 300 },
  { id: 'small-one-inch', name: '小一寸', width: 22, height: 32, category: 'photo', group: 'common-size', recommendedDpi: 300 },
  { id: 'large-one-inch', name: '大一寸', width: 33, height: 48, category: 'photo', group: 'common-size', recommendedDpi: 300 },
  { id: 'two-inch', name: '二寸', width: 35, height: 49, category: 'photo', group: 'common-size', recommendedDpi: 300 },
  { id: 'large-two-inch', name: '大二寸', width: 35, height: 53, category: 'photo', group: 'common-size', recommendedDpi: 300 },
  {
    id: 'china-passport',
    name: '中国护照',
    width: 33,
    height: 48,
    category: 'photo',
    group: 'china-document',
    recommendedDpi: 300,
    references: [EXIT_ENTRY_PHOTO_REFERENCE],
  },
  {
    id: 'hong-kong-macao-permit',
    name: '往来港澳通行证',
    width: 33,
    height: 48,
    category: 'photo',
    group: 'china-document',
    recommendedDpi: 300,
    references: [EXIT_ENTRY_PHOTO_REFERENCE, {
      name: '汕尾市公安局《申请往来港澳通行证的照片有什么规格要求？》',
      url: 'https://www.shanwei.gov.cn/gdsw110/hdhd/ywzsk/crj/content/post_1223620.html',
      verifiedAt: '2026-08-12',
    }],
  },
  {
    id: 'resident-id-card',
    name: '第二代居民身份证',
    width: 26,
    height: 32,
    category: 'photo',
    group: 'china-document',
    recommendedDpi: 350,
    references: [RESIDENT_ID_REFERENCE],
  },
  {
    id: 'driver-license',
    name: '机动车驾驶证',
    width: 22,
    height: 32,
    category: 'photo',
    group: 'china-document',
    recommendedDpi: 300,
    references: [{
      name: 'DB33/T 2489—2022《证件照片一窗通拍、全域应用服务规范》',
      url: 'https://zlzx.zjamr.zj.gov.cn/bzzx/rest/redirect/files/localFile/2024-01-31/4f1605fb9742a468c7f6cf09bfe10cc9.pdf',
      verifiedAt: '2026-08-12',
    }],
  },
  {
    id: 'social-security',
    name: '社会保障卡（常用规格）',
    width: 26,
    height: 32,
    category: 'photo',
    group: 'china-document',
    recommendedDpi: 350,
    notice: '各地社会保障卡照片要求可能不同，请以当地人社部门要求为准。',
    references: [{
      name: '广州市人力资源和社会保障局《办理社会保障卡时怎么提供相片？》',
      url: 'https://rsj.gz.gov.cn/zzzq/shbz/gzsshbzk/fwzy/bmwd/content/post_8730123.html',
      verifiedAt: '2026-08-12',
    }],
  },
  {
    id: 'us-visa',
    name: '美国签证',
    width: 51,
    height: 51,
    category: 'photo',
    group: 'visa',
    recommendedDpi: 300,
    references: [{
      name: '美国国务院 Digital Image Requirements',
      url: 'https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/photos/digital-image-requirements.html',
      verifiedAt: '2026-08-12',
    }],
  },
  {
    id: 'japan-visa',
    name: '日本签证',
    width: 35,
    height: 45,
    category: 'photo',
    group: 'visa',
    recommendedDpi: 300,
    references: [{
      name: '日本国驻华大使馆《赴日签证Q&A》',
      url: 'https://www.cn.emb-japan.go.jp/itpr_zh/visa_qa.html',
      verifiedAt: '2026-08-12',
    }],
  },
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
