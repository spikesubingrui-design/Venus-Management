import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// 只有当两个变量都真实存在且不是占位符时，才视为已配置
export const isSupabaseConfigured = 
  supabaseUrl !== '' && 
  supabaseAnonKey !== '' && 
  !supabaseUrl.includes('placeholder');

// 无论是否配置，都导出 client，但逻辑层会根据 isConfigured 判断是否发起请求
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);