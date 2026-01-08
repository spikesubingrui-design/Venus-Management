-- =====================================================
-- 金星教育系统 - 创建数据库（简化版）
-- =====================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 删除所有表（如果存在）
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS disinfection_records CASCADE;
DROP TABLE IF EXISTS visitors CASCADE;
DROP TABLE IF EXISTS operation_logs CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS procurement_records CASCADE;
DROP TABLE IF EXISTS meal_plans CASCADE;
DROP TABLE IF EXISTS health_records CASCADE;
DROP TABLE IF EXISTS attendance_records CASCADE;
DROP TABLE IF EXISTS calendar_events CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS campuses CASCADE;
DROP TABLE IF EXISTS authorized_phones CASCADE;
DROP TABLE IF EXISTS verification_codes CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 删除函数（如果存在）
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- =====================================================
-- 创建更新时间触发器函数
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- =====================================================
-- 1. 用户表
-- =====================================================
CREATE TABLE users (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL,
  campus VARCHAR(100),
  campus_grade VARCHAR(20),
  avatar TEXT,
  class_id VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. 验证码表
-- =====================================================
CREATE TABLE verification_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 3. 授权手机号表
-- =====================================================
CREATE TABLE authorized_phones (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  phone VARCHAR(20) UNIQUE NOT NULL,
  added_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 4. 园区配置表
-- =====================================================
CREATE TABLE campuses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  grade VARCHAR(20),
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
CREATE TABLE students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10),
  birth_date DATE,
  class VARCHAR(50),
  campus VARCHAR(100),
  avatar TEXT,
  status VARCHAR(20) DEFAULT 'present',
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  blood_type VARCHAR(10),
  allergies TEXT[],
  health_notes TEXT,
  parent_name VARCHAR(100),
  parent_phone VARCHAR(20),
  parent_relation VARCHAR(20),
  emergency_contact VARCHAR(100),
  emergency_phone VARCHAR(20),
  emergency_relation VARCHAR(20),
  address TEXT,
  enroll_date DATE,
  student_number VARCHAR(50),
  dietary_restrictions TEXT,
  special_needs TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. 教职工表
-- =====================================================
CREATE TABLE staff (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  role VARCHAR(50) NOT NULL,
  phone VARCHAR(20),
  avatar TEXT,
  assigned_class VARCHAR(50),
  campus VARCHAR(100),
  hire_date DATE,
  education VARCHAR(100),
  certificates TEXT[],
  status VARCHAR(20) DEFAULT 'active',
  performance_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 7. 考勤记录表
-- =====================================================
CREATE TABLE attendance_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  leave_reason TEXT,
  recorded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 8. 健康记录表
-- =====================================================
CREATE TABLE health_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID,
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
  recorded_by UUID,
  synced_to_parent BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 9. 食谱表
-- =====================================================
CREATE TABLE meal_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  week_range VARCHAR(100),
  grade VARCHAR(20),
  campus VARCHAR(100),
  headcount INTEGER,
  days JSONB,
  nutrition_summary JSONB,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_by UUID,
  confirmed_by UUID,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 10. 采购记录表
-- =====================================================
CREATE TABLE procurement_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  meal_plan_id UUID,
  date DATE NOT NULL,
  items JSONB,
  total_cost DECIMAL(10,2),
  supplier VARCHAR(200),
  status VARCHAR(20) DEFAULT 'PENDING',
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 11. 公告通知表
-- =====================================================
CREATE TABLE announcements (
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
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 12. 操作日志表
-- =====================================================
CREATE TABLE operation_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID,
  user_name VARCHAR(100),
  user_role VARCHAR(20),
  action VARCHAR(50) NOT NULL,
  module VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(100),
  target_name VARCHAR(200),
  summary TEXT,
  before_data JSONB,
  after_data JSONB,
  field_changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 13. 访客记录表
-- =====================================================
CREATE TABLE visitors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  id_card VARCHAR(18),
  company VARCHAR(200),
  purpose TEXT,
  visit_date DATE,
  check_in_time TIME,
  check_out_time TIME,
  campus VARCHAR(100),
  host_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  approved_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 14. 消毒记录表
-- =====================================================
CREATE TABLE disinfection_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  date DATE NOT NULL,
  area VARCHAR(100) NOT NULL,
  method VARCHAR(100),
  disinfectant VARCHAR(100),
  concentration VARCHAR(50),
  duration INTEGER,
  operator VARCHAR(100),
  campus VARCHAR(100),
  verified_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 15. 资料文档表
-- =====================================================
CREATE TABLE documents (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  folder_id UUID,
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  campus VARCHAR(100),
  tags TEXT[],
  uploaded_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 16. 日历事件表
-- =====================================================
CREATE TABLE calendar_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  type VARCHAR(50),
  description TEXT,
  location VARCHAR(200),
  all_day BOOLEAN DEFAULT FALSE,
  class_ids TEXT[],
  campus VARCHAR(100),
  is_holiday BOOLEAN DEFAULT FALSE,
  is_working_day BOOLEAN DEFAULT FALSE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 插入默认园区
-- =====================================================
INSERT INTO campuses (name, grade, is_active) VALUES 
  ('金星第十七幼儿园', 'SHIQI_YOU', true),
  ('总园', 'HIGH_END', true);

-- =====================================================
-- 完成！数据库创建成功
-- =====================================================
