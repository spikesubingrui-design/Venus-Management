-- =====================================================
-- 金星教育系统 - 用户认证模块数据库更新
-- 在 Supabase SQL Editor 中执行此脚本
-- 项目地址: https://supabase.com/dashboard/project/oqoqrdcaenwucncqinin
-- =====================================================

-- 1. 为用户表添加密码字段（如果不存在）
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

-- 2. 为授权手机号表添加新字段（如果不存在）
ALTER TABLE authorized_phones ADD COLUMN IF NOT EXISTS campus VARCHAR(100);
ALTER TABLE authorized_phones ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'TEACHER';
ALTER TABLE authorized_phones ADD COLUMN IF NOT EXISTS is_used BOOLEAN DEFAULT FALSE;

-- 3. 创建初始超级管理员（如果不存在）
INSERT INTO users (phone, name, password_hash, role, campus, avatar)
VALUES (
  '18513001100',
  '系统管理员',
  'hash_5a3d1c79',  -- su123789 的哈希值
  'SUPER_ADMIN',
  '总园',
  'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin'
)
ON CONFLICT (phone) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = 'SUPER_ADMIN',
  campus = '总园';

-- 4. 初始化默认园区（如果表为空）
INSERT INTO campuses (name, grade, is_active) VALUES 
  ('总园', 'HIGH_END', true),
  ('南江', 'PHUI', true),
  ('高新', 'HIGH_END', true),
  ('新市花园', 'PHUI', true),
  ('创越', 'PHUI', true),
  ('七幼', 'JIU_YOU', true),
  ('八幼', 'JIU_YOU', true),
  ('九幼', 'JIU_YOU', true),
  ('十幼', 'JIU_YOU', true),
  ('十二幼', 'JIU_YOU', true),
  ('十七幼', 'SHIQI_YOU', true)
ON CONFLICT (name) DO NOTHING;

-- 5. 禁用 RLS（开发阶段，方便测试）
-- 注意：生产环境应该启用 RLS 并配置适当的策略
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_phones DISABLE ROW LEVEL SECURITY;
ALTER TABLE campuses DISABLE ROW LEVEL SECURITY;

-- 6. 授予公开访问权限（开发阶段）
GRANT ALL ON users TO anon;
GRANT ALL ON authorized_phones TO anon;
GRANT ALL ON campuses TO anon;

-- 完成提示
SELECT '✅ 数据库更新完成！' as message;
SELECT '超级管理员账号: 18513001100 / su123789' as admin_info;
