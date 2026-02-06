/**
 * 阿里云短信发送云函数 - Web函数版本
 * 适用于阿里云函数计算 FC Web函数
 */

const http = require('http');
const https = require('https');

// 阿里云短信配置（从环境变量读取）
const CONFIG = {
  accessKeyId: process.env.AK_ID || '',
  accessKeySecret: process.env.AK_SECRET || '',
  signName: process.env.SMS_SIGN_NAME || '海南苏百客贸易有限公司',
  templateCode: process.env.SMS_TEMPLATE_CODE || 'SMS_500650339',
};

// 微信小程序配置
const WX_CONFIG = {
  appId: process.env.WX_APP_ID || 'wxa9a22865dfe6d498',
  appSecret: process.env.WX_APP_SECRET || '2f5f1f842c7f3c27572809c1ca352c14',
};

// access_token 缓存
let wxTokenCache = { token: '', expiresAt: 0 };

// 验证码存储
const codeStore = new Map();

// 发送短信函数
async function sendSms(phone, code) {
  const crypto = require('crypto');
  
  // 构建请求参数
  const params = {
    AccessKeyId: CONFIG.accessKeyId,
    Action: 'SendSms',
    Format: 'JSON',
    PhoneNumbers: phone,
    SignName: CONFIG.signName,
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: Math.random().toString(36).substring(2),
    SignatureVersion: '1.0',
    TemplateCode: CONFIG.templateCode,
    TemplateParam: JSON.stringify({ code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}/, ''),
    Version: '2017-05-25',
  };

  // 按字母排序
  const sortedKeys = Object.keys(params).sort();
  const canonicalizedQueryString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // 构建签名字符串
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`;

  // 计算签名
  const signature = crypto
    .createHmac('sha1', CONFIG.accessKeySecret + '&')
    .update(stringToSign)
    .digest('base64');

  // 发送请求
  const https = require('https');
  const postData = `${canonicalizedQueryString}&Signature=${encodeURIComponent(signature)}`;

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'dysmsapi.aliyuncs.com',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log('[SMS] 阿里云响应:', result);
          if (result.Code === 'OK') {
            resolve({ success: true, message: '发送成功' });
          } else {
            resolve({ success: false, message: result.Message || '发送失败' });
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// ========== 微信手机号换取 ==========

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function httpsPost(url, postData) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const body = JSON.stringify(postData);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function getWxAccessToken() {
  if (wxTokenCache.token && Date.now() < wxTokenCache.expiresAt) {
    return wxTokenCache.token;
  }
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_CONFIG.appId}&secret=${WX_CONFIG.appSecret}`;
  const json = await httpsGet(url);
  if (json.access_token) {
    wxTokenCache = { token: json.access_token, expiresAt: Date.now() + (json.expires_in - 300) * 1000 };
    return json.access_token;
  }
  throw new Error(`获取token失败: ${json.errmsg || JSON.stringify(json)}`);
}

async function getWxPhoneNumber(code) {
  const accessToken = await getWxAccessToken();
  const url = `https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`;
  const result = await httpsPost(url, { code });
  if (result.errcode === 0 && result.phone_info) {
    return { success: true, phone: result.phone_info.purePhoneNumber || result.phone_info.phoneNumber };
  }
  return { success: false, error: result.errmsg || '获取手机号失败', errcode: result.errcode };
}

// ========== 创建HTTP服务器 ==========
const server = http.createServer(async (req, res) => {
  // CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 只接受POST请求
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ success: false, message: '仅支持POST请求' }));
    return;
  }

  // 解析请求体
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body || '{}');
      const { action, phone, code } = data;

      console.log('[SMS] 收到请求:', { action, phone });

      // 发送验证码
      if (action === 'send') {
        // 验证手机号
        if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: '手机号格式错误' }));
          return;
        }

        // 检查发送频率
        const existing = codeStore.get(phone);
        if (existing && Date.now() - existing.sentAt < 60000) {
          res.writeHead(429);
          res.end(JSON.stringify({ success: false, message: '发送太频繁，请稍后再试' }));
          return;
        }

        // 生成验证码
        const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 发送短信
        try {
          const result = await sendSms(phone, verifyCode);
          
          if (result.success) {
            codeStore.set(phone, {
              code: verifyCode,
              sentAt: Date.now(),
              expiresAt: Date.now() + 5 * 60 * 1000,
            });
            res.writeHead(200);
            res.end(JSON.stringify({ success: true, message: '验证码已发送' }));
          } else {
            res.writeHead(500);
            res.end(JSON.stringify(result));
          }
        } catch (err) {
          console.error('[SMS] 发送异常:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, message: '短信服务异常' }));
        }
        return;
      }

      // 验证验证码
      if (action === 'verify') {
        if (!phone || !code) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: '参数不完整' }));
          return;
        }

        const stored = codeStore.get(phone);
        
        if (!stored) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: '请先获取验证码' }));
          return;
        }

        if (Date.now() > stored.expiresAt) {
          codeStore.delete(phone);
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: '验证码已过期' }));
          return;
        }

        if (stored.code !== code) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, message: '验证码错误' }));
          return;
        }

        codeStore.delete(phone);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: '验证成功' }));
        return;
      }

      // 微信手机号换取
      if (action === 'getPhoneNumber') {
        if (!data.code) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, error: '缺少code参数' }));
          return;
        }
        if (!WX_CONFIG.appSecret) {
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: '服务端未配置WX_APP_SECRET' }));
          return;
        }
        try {
          const wxResult = await getWxPhoneNumber(data.code);
          res.writeHead(200);
          res.end(JSON.stringify(wxResult));
        } catch (err) {
          console.error('[WxPhone] 异常:', err);
          res.writeHead(500);
          res.end(JSON.stringify({ success: false, error: '获取手机号服务异常' }));
        }
        return;
      }

      // 健康检查
      if (action === 'health' || req.url === '/health') {
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'OK', time: new Date().toISOString() }));
        return;
      }

      res.writeHead(400);
      res.end(JSON.stringify({ success: false, message: '未知操作' }));

    } catch (err) {
      console.error('[SMS] 处理错误:', err);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, message: '服务器错误' }));
    }
  });
});

// 监听端口（阿里云函数计算默认65535）
const PORT = process.env.FC_SERVER_PORT || 65535;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[SMS] 服务启动，监听端口: ${PORT}`);
});
