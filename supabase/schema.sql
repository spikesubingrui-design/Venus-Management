-- =====================================================
-- 金星教育系统 - Supabase 数据库结构
-- 在 Supabase SQL Editor 中执行此脚本来创建所有表
-- =====================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- 1. 用户表
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(11) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER', 'KITCHEN', 'PARENT')),
  campus VARCHAR(100),
  campus_grade VARCHAR(20) CHECK (campus_grade IN ('PHUI', 'HIGH_END', 'JIU_YOU', 'SHIQI_YOU')),
  avatar TEXT,
  class_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 2. 验证码表
-- =====================================================
CREATE TABLE IF NOT EXISTS verification_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(11) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 验证码索引
CREATE INDEX idx_verification_codes_phone ON verification_codes(phone);
CREATE INDEX idx_verification_codes_expires ON verification_codes(expires_at);

-- =====================================================
-- 3. 授权手机号表
-- =====================================================
CREATE TABLE IF NOT EXISTS authorized_phones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(11) UNIQUE NOT NULL,
  added_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. 园区配置表
-- =====================================================
CREATE TABLE IF NOT EXISTS campuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  grade VARCHAR(20) CHECK (grade IN ('PHUI', 'HIGH_END', 'JIU_YOU', 'SHIQI_YOU')),
  address TEXT,
  phone VARCHAR(20),
  principal_name VARCHAR(100),
  headcount INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 5. 学生表
-- =====================================================
CREATE TABLE IF NOT EXISTS students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(2) CHECK (gender IN ('男', '女')),
  birth_date DATE,
  class VARCHAR(50),
  campus VARCHAR(100),
  avatar TEXT,
  status VARCHAR(20) DEFAULT 'present',
  
  -- 健康信息
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  blood_type VARCHAR(10),
  allergies TEXT[],
  health_notes TEXT,
  
  -- 家长信息
  parent_name VARCHAR(100),
  parent_phone VARCHAR(11),
  parent_relation VARCHAR(20),
  
  -- 紧急联系人
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(11),
  emergency_relation VARCHAR(20),
  
  -- 其他信息
  address TEXT,
  enroll_date DATE,
  student_number VARCHAR(50),
  dietary_restrictions TEXT,
  special_needs TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. 教职工表
-- =====================================================
CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone VARCHAR(11),
  avatar TEXT,
  assigned_class VARCHAR(50),
  campus VARCHAR(100),
  hire_date DATE,
  education VARCHAR(100),
  certificates TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  performance_score DECIMAL(3,1) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. 考勤记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  leave_reason TEXT,
  recorded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_attendance_student_date ON attendance_records(student_id, date);

-- =====================================================
-- 8. 健康记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS health_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL,
  
  morning_temp DECIMAL(3,1),
  noon_temp DECIMAL(3,1),
  afternoon_temp DECIMAL(3,1),
  
  health_status VARCHAR(20) DEFAULT 'normal',
  symptoms TEXT[],
  medication TEXT,
  
  breakfast_status VARCHAR(10),
  lunch_status VARCHAR(10),
  snack_status VARCHAR(10),
  
  nap_status VARCHAR(10),
  nap_duration INTEGER,
  
  mood_status VARCHAR(20),
  toilet_normal BOOLEAN DEFAULT TRUE,
  notes TEXT,
  
  recorded_by UUID REFERENCES users(id),
  synced_to_parent BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_health_student_date ON health_records(student_id, date);

-- =====================================================
-- 9. 食谱表
-- =====================================================
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  week_range VARCHAR(100),
  grade VARCHAR(20),
  campus VARCHAR(100),
  headcount INTEGER,
  days JSONB NOT NULL,
  nutrition_summary JSONB,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_by UUID REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. 采购记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS procurement_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meal_plan_id UUID REFERENCES meal_plans(id),
  date DATE NOT NULL,
  items JSONB NOT NULL,
  total_cost DECIMAL(10,2),
  supplier VARCHAR(200),
  status VARCHAR(20) DEFAULT 'PENDING',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. 公告通知表
-- =====================================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'all',
  target_class VARCHAR(50),
  target_student_ids UUID[],
  campus VARCHAR(100),
  attachments TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  read_by UUID[],
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. 操作日志表
-- =====================================================
CREATE TABLE IF NOT EXISTS operation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  user_name VARCHAR(100),
  user_role VARCHAR(20),
  action VARCHAR(20) NOT NULL,
  module VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  target_name VARCHAR(200),
  summary TEXT,
  before_data JSONB,
  after_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_operation_logs_user ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_module ON operation_logs(module);
CREATE INDEX idx_operation_logs_created ON operation_logs(created_at DESC);

-- =====================================================
-- 13. 访客记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS visitors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(11),
  id_card VARCHAR(18),
  company VARCHAR(200),
  purpose TEXT,
  visit_date DATE,
  check_in_time TIME,
  check_out_time TIME,
  campus VARCHAR(100),
  host_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  approved_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 14. 消毒记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS disinfection_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  area VARCHAR(100) NOT NULL,
  method VARCHAR(100),
  disinfectant VARCHAR(100),
  concentration VARCHAR(50),
  duration INTEGER,
  operator VARCHAR(100),
  campus VARCHAR(100),
  verified_by UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 15. 资料文档表
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  folder_id UUID,
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  campus VARCHAR(100),
  tags TEXT[],
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- Row Level Security (RLS) 策略
-- =====================================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 用户表策略：所有认证用户可读，只有自己可改
CREATE POLICY "Users can view all users" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- 学生表策略：教师和管理员可读写
CREATE POLICY "Staff can view students" ON students FOR SELECT USING (true);
CREATE POLICY "Staff can manage students" ON students FOR ALL USING (true);

-- 公告策略：所有人可读，管理员可写
CREATE POLICY "All can view announcements" ON announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON announcements FOR ALL USING (true);

-- =====================================================
-- 初始数据
-- =====================================================

-- 插入默认园区
INSERT INTO campuses (name, grade, is_active) VALUES 
  ('总园', 'HIGH_END', true),
  ('分园一', 'PHUI', true)
ON CONFLICT (name) DO NOTHING;

-- =====================================================
-- 完成提示
-- =====================================================
-- 数据库结构创建完成！
-- 请在 Supabase Dashboard -> Settings -> API 获取：
-- 1. Project URL (SUPABASE_URL)
-- 2. anon public key (SUPABASE_ANON_KEY)




