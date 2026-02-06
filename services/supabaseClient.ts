import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';

// ⚠️ 已切换到阿里云OSS存储，禁用Supabase同步
// 设置为 false 以避免 Supabase 同步错误
export const isSupabaseConfigured = false;

// 保留 client 以兼容代码，但不会实际使用
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder-key'
);