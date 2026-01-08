-- =====================================================
-- 更新数据库结构 - 添加缺失的列
-- 在 Supabase SQL Editor 中执行
-- =====================================================

-- 1. 更新 students 表，添加 age 列
ALTER TABLE students ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_activity TIMESTAMP WITH TIME ZONE;

-- 2. 更新 staff 表，允许 id 为任意字符串（修改为 TEXT 类型）
-- 先删除旧表重建
DROP TABLE IF EXISTS staff CASCADE;
CREATE TABLE staff (
  id TEXT PRIMARY KEY,
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
  gender VARCHAR(10),
  department VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 更新 students 表，允许 id 为任意字符串
DROP TABLE IF EXISTS students CASCADE;
CREATE TABLE students (
  id TEXT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  gender VARCHAR(10),
  birth_date DATE,
  age INTEGER,
  class VARCHAR(50),
  campus VARCHAR(100),
  avatar TEXT,
  status VARCHAR(20) DEFAULT 'present',
  last_activity TIMESTAMP WITH TIME ZONE,
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

-- 4. 更新 operation_logs 表，添加 timestamp 列
DROP TABLE IF EXISTS operation_logs CASCADE;
CREATE TABLE operation_logs (
  id TEXT PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id TEXT,
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

-- 5. 更新 documents 表，添加缺失的列
DROP TABLE IF EXISTS documents CASCADE;
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50),
  content TEXT,
  folder_id TEXT,
  parent_id TEXT,
  file_url TEXT,
  file_size INTEGER,
  mime_type VARCHAR(100),
  campus VARCHAR(100),
  tags TEXT[],
  access_roles TEXT[],
  uploaded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. 更新其他表的 id 类型为 TEXT
DROP TABLE IF EXISTS attendance_records CASCADE;
CREATE TABLE attendance_records (
  id TEXT PRIMARY KEY,
  student_id TEXT,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL,
  check_in_time TIME,
  check_out_time TIME,
  leave_reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS health_records CASCADE;
CREATE TABLE health_records (
  id TEXT PRIMARY KEY,
  student_id TEXT,
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
  recorded_by TEXT,
  synced_to_parent BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS meal_plans CASCADE;
CREATE TABLE meal_plans (
  id TEXT PRIMARY KEY,
  week_range VARCHAR(100),
  grade VARCHAR(20),
  campus VARCHAR(100),
  headcount INTEGER,
  days JSONB,
  nutrition_summary JSONB,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_by TEXT,
  confirmed_by TEXT,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS announcements CASCADE;
CREATE TABLE announcements (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type VARCHAR(20) DEFAULT 'all',
  target_class VARCHAR(50),
  target_student_ids TEXT[],
  campus VARCHAR(100),
  attachments TEXT[],
  is_pinned BOOLEAN DEFAULT FALSE,
  read_by TEXT[],
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS visitors CASCADE;
CREATE TABLE visitors (
  id TEXT PRIMARY KEY,
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
  approved_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS disinfection_records CASCADE;
CREATE TABLE disinfection_records (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  area VARCHAR(100) NOT NULL,
  method VARCHAR(100),
  disinfectant VARCHAR(100),
  concentration VARCHAR(50),
  duration INTEGER,
  operator VARCHAR(100),
  campus VARCHAR(100),
  verified_by TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DROP TABLE IF EXISTS calendar_events CASCADE;
CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  start VARCHAR(50),
  "end" VARCHAR(50),
  type VARCHAR(50),
  description TEXT,
  location VARCHAR(200),
  all_day BOOLEAN DEFAULT FALSE,
  class_ids TEXT[],
  campus VARCHAR(100),
  is_holiday BOOLEAN DEFAULT FALSE,
  is_working_day BOOLEAN DEFAULT FALSE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 完成！
SELECT 'Schema updated successfully!' as message;


