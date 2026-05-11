// cloudfunctions/identifyGarbage/index.js
const config = require('cloudfunctions\identifyGarbage\config.json')
const cloud = require('wx-server-sdk')
const axios = require('axios')
const qs = require('qs')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// api密钥
const BAIDU_API_KEY = 'config.BAIDU_API_KEY'
const BAIDU_SECRET_KEY = 'config.BAIDU_SECRET_KEY'
const TIAN_API_KEY = 'config.TIAN_API_KEY'

// 百度 Token 缓存
let cachedToken = null
let tokenExpireTime = 0

// 天行垃圾分类类型映射：0可回收、1有害、2厨余、3其他
const TYPE_MAP = ['可回收物', '有害垃圾', '厨余垃圾', '其他垃圾']

// 获取百度 Token（带缓存）
async function getBaiduToken() {
  const now = Date.now()
  if (cachedToken && now < tokenExpireTime) {
    console.log('【Token】使用缓存 Token')
    return cachedToken
  }

  const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token'
  const res = await axios.get(tokenUrl, {
    params: {
      grant_type: 'client_credentials',
      client_id: BAIDU_API_KEY,
      client_secret: BAIDU_SECRET_KEY,
    },
    timeout: 8000,
  })

  if (!res.data.access_token) {
    throw new Error('百度 Token 获取失败：' + JSON.stringify(res.data))
  }

  cachedToken = res.data.access_token
  // 提前 5 分钟过期，百度 Token 默认有效期 30 天
  tokenExpireTime = now + (res.data.expires_in - 300) * 1000
  console.log('【Token】获取新 Token 成功')
  return cachedToken
}

// 调用百度通用物体识别 
async function baiduIdentify(imageBase64, token) {
  // 百度 API 限制 Base64 图片不超过 4MB
  const base64SizeKB = Buffer.byteLength(imageBase64, 'utf8') / 1024
  if (base64SizeKB > 4096) {
    throw new Error(`图片 Base64 过大（${Math.round(base64SizeKB)}KB），请压缩后上传`)
  }

  // 使用高级通用物体识别
  const url = `https://aip.baidubce.com/rest/2.0/image-classify/v2/advanced_general?access_token=${token}`
  const res = await axios.post(
    url,
    qs.stringify({ image: imageBase64, baike_num: 1 }), // baike_num=1 可附带百科信息
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 10000,
    }
  )

  console.log('【百度】返回数据：', JSON.stringify(res.data))

  // 百度 API 报错时会返回 error_code 字段
  if (res.data.error_code) {
    throw new Error(`百度识别报错 ${res.data.error_code}：${res.data.error_msg}`)
  }

  const result = res.data.result
  if (!result || result.length === 0) {
    return null
  }

  // 过滤置信度低于 0.1 的结果，取最高分
  const filtered = result.filter(item => item.score >= 0.1)
  return filtered.length > 0 ? filtered[0].keyword : null
}

// 调用天行垃圾分类
async function tianClassify(keyword) {
  const url = 'https://apis.tianapi.com/lajifenlei/index'
  const res = await axios.post(
    url,
    qs.stringify({ key: TIAN_API_KEY, word: keyword }),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 8000,
    }
  )

  console.log('【天行】返回数据：', JSON.stringify(res.data))

  const code = res.data && res.data.code
  const list = res.data && res.data.result && res.data.result.list

  if (code === 200 && Array.isArray(list) && list.length > 0) {
    const info = list[0]
    return {
      found: true,
      name: info.name || keyword,
      type: TYPE_MAP[info.type] !== undefined ? TYPE_MAP[info.type] : '其他垃圾',
      tip: info.tip ||'请按当地垃圾分类标准投放',
    }
  }

  return { found: false }
}
//兜底：正则关键词匹配 
function fallbackClassify(keyword) {
  const rules = [
    {
      type: '有害垃圾',
      tip: '有害垃圾需投入红色有害垃圾桶，请勿随意丢弃',
      // 优先匹配有害，避免"电池纸盒"被误判为可回收
      pattern: /药|电池|灯泡|荧光|汞|镉|铅|杀虫|农药|油漆|指甲油|染发|废液|注射器|体温计/,
    },
    {
      type: '厨余垃圾',
      tip: '厨余垃圾请投入绿色厨余垃圾桶',
      pattern: /肉|鱼|虾|蟹|菜|果|瓜|骨|蛋|壳|皮|食|餐|余|剩|腐|茶叶|咖啡渣|面|饭|粥|汤/,
    },
    {
      type: '可回收物',
      tip: '可回收物请投入蓝色可回收垃圾桶，有利于资源再利用',
      pattern: /纸|瓶|罐|盒|杯|镜|铁|铜|铝|金|银|布|衣|报|书|杂志|玻璃|塑料|橡胶|皮革|木板|家具|电器|手机|电脑|充电器/,
    },
  ]

  for (const rule of rules) {
    if (rule.pattern.test(keyword)) {
      return {
        type: rule.type,
        tip: rule.tip,
      }
    }
  }

  // 都匹配不上就是其他垃圾
  return {
    type: '其他垃圾',
    tip: '该垃圾暂时无法精确分类，建议投入灰色其他垃圾桶',
  }
}

//云函数入口
exports.main = async (event, context) => {
  const { fileID } = event

  if (!fileID) {
    return { success: false, msg: '缺少 fileID 参数' }
  }

  try {
    // 从云存储下载图片并转 Base64 
    console.log('开始下载云存储文件：', fileID)
    let fileRes
    try {
      fileRes = await cloud.downloadFile({ fileID })
    } catch (downloadErr) {
      console.error('下载失败：', downloadErr)
      return { success: false, msg: '图片下载失败，请检查 fileID 是否有效' }
    }
    const imageBase64 = fileRes.fileContent.toString('base64')
    console.log('Base64 转换完成，大小约：', Math.round(Buffer.byteLength(imageBase64, 'utf8') / 1024), 'KB')

    // 获取百度 Token
    console.log('获取百度 Token')
    let baiduToken
    try {
      baiduToken = await getBaiduToken()
    } catch (tokenErr) {
      console.error('Token 获取失败：', tokenErr.message)
      return { success: false, msg: '连接识别服务失败，请稍后重试' }
    }

    // 百度图像识别
    console.log('【步骤3】调用百度识图')
    let keyword
    try {
      keyword = await baiduIdentify(imageBase64, baiduToken)
    } catch (baiduErr) {
      console.error('百度识别失败：', baiduErr.message)
      return { success: false, msg: baiduErr.message || '图片识别失败，请换个角度重新拍摄' }
    }

    if (!keyword) {
      return { success: false, msg: '未能识别图片内容，请确保画面清晰且主体明显' }
    }
    console.log('识别关键词：', keyword)

    // --- 第四步：天行垃圾分类 ---
    console.log('调用天行分类，词：', keyword)
    let tianResult
    try {
      tianResult = await tianClassify(keyword)
    } catch (tianErr) {
      // 天行失败不影响兜底，降级处理
      console.warn('天行接口异常，降级到兜底：', tianErr.message)
      tianResult = { found: false }
    }

    // 情况 A：天行成功匹配
    if (tianResult.found) {
      console.log('天行匹配成功：', tianResult.type)
      return {
        success: true,
        source: 'tianapi',  // 标注数据来源，方便前端调试
        data: {
          name: tianResult.name,
          type: tianResult.type,
          tip: tianResult.tip,
        },
      }
    }

    // 天行未匹配，启动正则兜底
    console.log('启动兜底正则匹配，词：', keyword)
    const fallback = fallbackClassify(keyword)
    console.log('兜底匹配结果：', fallback.type)

    return {
      success: true,
      source: 'fallback',
      data: {
        name: keyword,
        type: fallback.type,
        tip: fallback.tip,
      },
    }
  } catch (e) {
    // 兜住所有意外异常
    console.error('未预期异常：', e.message, e.stack)
    return { success: false, msg: '系统发生未知错误，请稍后再试' }
  }
}