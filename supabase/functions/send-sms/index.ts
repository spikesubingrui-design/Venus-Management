// Supabase Edge Function: 发送短信验证码
// 部署: supabase functions deploy send-sms
// 设置密钥: supabase secrets set ALIYUN_ACCESS_KEY=xxx ALIYUN_SECRET_KEY=xxx

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 阿里云短信签名
async function signAliyunRequest(params: Record<string, string>, accessSecret: string): Promise<string> {
  const sortedKeys = Object.keys(params).sort()
  const canonicalizedQueryString = sortedKeys
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  const stringToSign = `POST&${encodeURIComponent('/')}&${encodeURIComponent(canonicalizedQueryString)}`
  
  const encoder = new TextEncoder()
  const keyData = encoder.encode(accessSecret + '&')
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  )
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(stringToSign))
  return btoa(String.fromCharCode(...new Uint8Array(signature)))
}

// 生成6位随机验证码
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

serve(async (req) => {
  // 处理 CORS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, action } = await req.json()

    // 验证手机号格式
    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return new Response(
        JSON.stringify({ success: false, error: '无效的手机号码' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 初始化 Supabase 客户端
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 检查发送频率（60秒内只能发送一次）
    const { data: recentCodes } = await supabase
      .from('verification_codes')
      .select('created_at')
      .eq('phone', phone)
      .gt('created_at', new Date(Date.now() - 60000).toISOString())
      .limit(1)

    if (recentCodes && recentCodes.length > 0) {
      return new Response(
        JSON.stringify({ success: false, error: '发送过于频繁，请稍后再试' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 生成验证码
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5分钟后过期

    // 获取阿里云配置
    const accessKeyId = Deno.env.get('ALIYUN_ACCESS_KEY')
    const accessSecret = Deno.env.get('ALIYUN_SECRET_KEY')
    const signName = Deno.env.get('SMS_SIGN_NAME') || '金星教育'
    const templateCode = Deno.env.get('SMS_TEMPLATE_CODE') || 'SMS_123456789'

    let smsSent = false

    // 如果配置了阿里云，发送真实短信
    if (accessKeyId && accessSecret && templateCode !== 'SMS_123456789') {
      const params: Record<string, string> = {
        AccessKeyId: accessKeyId,
        Action: 'SendSms',
        Format: 'JSON',
        PhoneNumbers: phone,
        RegionId: 'cn-hangzhou',
        SignName: signName,
        SignatureMethod: 'HMAC-SHA1',
        SignatureNonce: crypto.randomUUID(),
        SignatureVersion: '1.0',
        TemplateCode: templateCode,
        TemplateParam: JSON.stringify({ code }),
        Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        Version: '2017-05-25',
      }

      params.Signature = await signAliyunRequest(params, accessSecret)

      const response = await fetch('https://dysmsapi.aliyuncs.com/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(params),
      })

      const result = await response.json()
      smsSent = result.Code === 'OK'

      if (!smsSent) {
        console.error('阿里云短信发送失败:', result)
      }
    }

    // 保存验证码到数据库（无论短信是否发送成功都保存，用于开发测试）
    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        phone,
        code,
        expires_at: expiresAt.toISOString(),
        used: false,
      })

    if (insertError) {
      console.error('保存验证码失败:', insertError)
      return new Response(
        JSON.stringify({ success: false, error: '系统错误，请稍后再试' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 返回结果
    return new Response(
      JSON.stringify({
        success: true,
        message: smsSent ? '验证码已发送' : '验证码已生成（开发模式）',
        // 开发模式下返回验证码（生产环境应移除此行）
        ...(smsSent ? {} : { code }),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('处理请求失败:', error)
    return new Response(
      JSON.stringify({ success: false, error: '服务器错误' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})




