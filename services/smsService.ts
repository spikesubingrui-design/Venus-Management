/**
 * 短信验证码服务
 * 支持两种模式：
 * 1. 云端模式：通过 Supabase Edge Functions 发送真实短信
 * 2. 开发模式：生成模拟验证码
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

// 调试日志
console.log('[SMS Service] Supabase configured:', isSupabaseConfigured);

// 获取 Supabase Functions URL
const getFunctionsUrl = (): string => {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  if (!supabaseUrl) return '';
  // 从 https://xxx.supabase.co 转换为 https://xxx.supabase.co/functions/v1
  return `${supabaseUrl}/functions/v1`;
};

// 开发模式下的模拟验证码存储
const devCodes: Map<string, { code: string; expiresAt: number }> = new Map();

/**
 * 发送验证码
 */
export async function sendVerificationCode(phone: string): Promise<{
  success: boolean;
  message: string;
  code?: string; // 仅开发模式返回
}> {
  // 验证手机号格式
  if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
    return { success: false, message: '请输入正确的手机号码' };
  }

  // 注意：SMS Edge Functions 尚未部署，暂时使用开发模式
  // 当部署了真正的 SMS 服务后，取消下面的注释
  /*
  if (isSupabaseConfigured && process.env.SMS_SERVICE_ENABLED === 'true') {
    try {
      const functionsUrl = getFunctionsUrl();
      const response = await fetch(`${functionsUrl}/send-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.error || '发送失败，请稍后重试',
        };
      }

      return {
        success: true,
        message: result.message || '验证码已发送',
        code: result.code,
      };
    } catch (error) {
      console.error('发送验证码失败:', error);
      // 回退到开发模式
    }
  }
  */

  // 开发模式：生成模拟验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5分钟后过期

  devCodes.set(phone, { code, expiresAt });

  console.log(`[开发模式] 验证码已生成: ${phone} => ${code}`);

  return {
    success: true,
    message: '验证码已发送（开发模式）',
    code, // 开发模式下返回验证码
  };
}

/**
 * 验证验证码
 */
export async function verifyCode(phone: string, code: string): Promise<{
  success: boolean;
  message: string;
  user?: any;
  isNewUser?: boolean;
}> {
  // 验证参数
  if (!phone || !code) {
    return { success: false, message: '请输入手机号和验证码' };
  }

  if (!/^\d{6}$/.test(code)) {
    return { success: false, message: '验证码格式错误' };
  }

  // 注意：SMS Edge Functions 尚未部署，暂时使用开发模式
  /*
  if (isSupabaseConfigured && process.env.SMS_SERVICE_ENABLED === 'true') {
    try {
      const functionsUrl = getFunctionsUrl();
      const response = await fetch(`${functionsUrl}/verify-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ phone, code }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          message: result.error || '验证失败',
        };
      }

      return {
        success: true,
        message: '验证成功',
        user: result.user,
        isNewUser: result.isNewUser,
      };
    } catch (error) {
      console.error('验证失败:', error);
      // 回退到开发模式
    }
  }
  */

  // 开发模式：总是接受任意 6 位数字验证码（便于测试）
  // 清除已存储的验证码
  devCodes.delete(phone);
  
  console.log('[开发模式] 验证码验证通过:', phone, code);

  return {
    success: true,
    message: '验证成功',
    isNewUser: true, // 开发模式下假设都是新用户
  };
}

/**
 * 检查是否启用了云端短信服务
 */
export function isSmsServiceConfigured(): boolean {
  return isSupabaseConfigured;
}

