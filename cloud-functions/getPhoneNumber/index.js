/**
 * 云函数：通过微信 code 换取用户手机号
 * 
 * 部署方式：
 * 1. 阿里云函数计算(FC)：创建 HTTP 函数，上传此文件
 * 2. 腾讯云函数(SCF)：创建云函数，上传此文件
 * 3. 任意 Node.js 服务器：直接运行
 * 
 * 环境变量（必须配置）：
 *   WX_APP_ID     - 小程序 AppID
 *   WX_APP_SECRET - 小程序 AppSecret（在微信公众平台 → 开发管理 → 开发设置 中获取）
 * 
 * 注意：AppSecret 绝不能暴露在前端代码中！
 */

const https = require('https')

// 从环境变量读取配置
const APP_ID = process.env.WX_APP_ID || 'wxa9a22865dfe6d498'
const APP_SECRET = process.env.WX_APP_SECRET || '' // 必须在环境变量中配置

// access_token 缓存（有效期2小时，提前5分钟刷新）
let tokenCache = { token: '', expiresAt: 0 }

/**
 * 获取小程序 access_token
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    // 使用缓存
    if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
      return resolve(tokenCache.token)
    }

    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APP_ID}&secret=${APP_SECRET}`
    
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.access_token) {
            tokenCache = {
              token: json.access_token,
              expiresAt: Date.now() + (json.expires_in - 300) * 1000 // 提前5分钟过期
            }
            resolve(json.access_token)
          } else {
            reject(new Error(`获取token失败: ${json.errmsg || data}`))
          }
        } catch (e) {
          reject(e)
        }
      })
    }).on('error', reject)
  })
}

/**
 * 通过 code 换取手机号
 */
function getPhoneNumber(code, accessToken) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ code })
    const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`
    
    const urlObj = new URL(url)
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json)
        } catch (e) {
          reject(e)
        }
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

/**
 * HTTP 请求处理（适用于阿里云FC / 腾讯云SCF / Express 等）
 */
async function handler(event, context) {
  // 解析请求体
  let body
  if (typeof event === 'string') {
    body = JSON.parse(event)
  } else if (event.body) {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body
  } else {
    body = event
  }

  const { code } = body

  // CORS 头
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  }

  // OPTIONS 预检请求
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' }
  }

  if (!code) {
    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: '缺少 code 参数' })
    }
  }

  if (!APP_SECRET) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务端未配置 APP_SECRET' })
    }
  }

  try {
    // 1. 获取 access_token
    const accessToken = await getAccessToken()

    // 2. 用 code 换取手机号
    const result = await getPhoneNumber(code, accessToken)

    if (result.errcode === 0 && result.phone_info) {
      const phone = result.phone_info.purePhoneNumber || result.phone_info.phoneNumber
      console.log(`[WxPhone] 手机号获取成功: ${phone.slice(0, 3)}****${phone.slice(-4)}`)
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          phone,
          countryCode: result.phone_info.countryCode 
        })
      }
    } else {
      console.error('[WxPhone] 微信API错误:', result)
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          error: result.errmsg || '获取手机号失败',
          errcode: result.errcode 
        })
      }
    }
  } catch (err) {
    console.error('[WxPhone] 服务异常:', err)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: '服务内部错误' })
    }
  }
}

// 导出（兼容多种云函数平台）
module.exports = { handler }

// 如果直接运行（本地测试用Express）
if (require.main === module) {
  const http = require('http')
  const PORT = process.env.PORT || 3000
  
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      })
      return res.end()
    }

    if (req.method === 'POST') {
      let body = ''
      req.on('data', chunk => body += chunk)
      req.on('end', async () => {
        const result = await handler({ body, httpMethod: 'POST' })
        res.writeHead(result.statusCode, result.headers)
        res.end(result.body)
      })
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', message: '金星幼儿园 - 微信手机号服务' }))
    }
  })

  server.listen(PORT, () => {
    console.log(`[WxPhone] 服务启动: http://localhost:${PORT}`)
    console.log(`[WxPhone] APP_ID: ${APP_ID}`)
    console.log(`[WxPhone] APP_SECRET: ${APP_SECRET ? '已配置' : '❌ 未配置！'}`)
  })
}
