/**
 * 小程序配置文件
 * 请将下面的占位符替换为您的实际值
 */

// ===== Supabase 云端数据库配置 =====
// 获取方式：
// 1. 访问 https://supabase.com 并登录
// 2. 进入您的项目 -> Settings -> API
// 3. 复制 Project URL 和 anon public key

export const SUPABASE_CONFIG = {
  // Supabase 项目 URL
  url: 'https://oqoqrdcaenwucncqinin.supabase.co',
  
  // Supabase 匿名公钥 (anon key)
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9xb3FyZGNhZW53dWNuY3FpbmluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNTI2MDAsImV4cCI6MjA4MjkyODYwMH0.NsDQSUD9RrczMhfZJYaU8hSfD0F2IWJZmQeRwTOdXAA'
}

// ===== 园所配置 =====
export const CAMPUS_CONFIG = {
  // 默认园所名称
  defaultCampus: '金星幼儿园',
  
  // 支持的班级列表
  classes: ['托班', '小一班', '小二班', '中一班', '中二班', '大一班', '大二班']
}

// ===== 检查配置是否有效 =====
export const isConfigured = () => {
  return (
    SUPABASE_CONFIG.url !== '' &&
    SUPABASE_CONFIG.anonKey !== '' &&
    !SUPABASE_CONFIG.url.includes('your-project-id')
  )
}
