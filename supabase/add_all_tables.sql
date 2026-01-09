-- =====================================================
-- 金星教育系统 - 补充数据表
-- 在 Supabase SQL Editor 中执行此脚本
-- 添加所有功能模块需要的表
-- =====================================================

-- =====================================================
-- 1. 成长记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS growth_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  date DATE NOT NULL,
  type VARCHAR(50),
  title VARCHAR(200),
  content TEXT,
  photos TEXT[],
  videos TEXT[],
  height DECIMAL(5,2),
  weight DECIMAL(5,2),
  tags TEXT[],
  recorded_by TEXT,
  campus VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_growth_student ON growth_records(student_id);
CREATE INDEX IF NOT EXISTS idx_growth_date ON growth_records(date);

-- =====================================================
-- 2. 接送记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS pickup_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name VARCHAR(100),
  date DATE NOT NULL,
  type VARCHAR(20), -- dropoff/pickup
  time TIME,
  picker_name VARCHAR(100),
  picker_relation VARCHAR(50),
  picker_phone VARCHAR(20),
  picker_id_last4 VARCHAR(4),
  photo TEXT,
  notes TEXT,
  campus VARCHAR(100),
  recorded_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pickup_student ON pickup_records(student_id);
CREATE INDEX IF NOT EXISTS idx_pickup_date ON pickup_records(date);

-- =====================================================
-- 3. 课程计划表
-- =====================================================
CREATE TABLE IF NOT EXISTS curriculum (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  class VARCHAR(100),
  campus VARCHAR(100),
  week_range VARCHAR(100),
  theme VARCHAR(200),
  goals TEXT[],
  activities JSONB,
  materials TEXT[],
  evaluation TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT',
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_class ON curriculum(class);
CREATE INDEX IF NOT EXISTS idx_curriculum_campus ON curriculum(campus);

-- =====================================================
-- 4. 教职工排班表
-- =====================================================
CREATE TABLE IF NOT EXISTS staff_schedules (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL,
  staff_name VARCHAR(100),
  date DATE NOT NULL,
  shift_type VARCHAR(50), -- morning/afternoon/full
  start_time TIME,
  end_time TIME,
  status VARCHAR(20) DEFAULT 'SCHEDULED',
  notes TEXT,
  campus VARCHAR(100),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_staff ON staff_schedules(staff_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON staff_schedules(date);

-- =====================================================
-- 5. 消防检查表
-- =====================================================
CREATE TABLE IF NOT EXISTS fire_checks (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  inspector VARCHAR(100),
  location VARCHAR(200),
  items JSONB,
  issues TEXT[],
  status VARCHAR(20) DEFAULT 'PASSED',
  photos TEXT[],
  notes TEXT,
  campus VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fire_date ON fire_checks(date);

-- =====================================================
-- 6. 巡查记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS patrols (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  time TIME,
  patrol_type VARCHAR(50),
  route VARCHAR(200),
  points JSONB,
  issues TEXT[],
  status VARCHAR(20) DEFAULT 'COMPLETED',
  patroller VARCHAR(100),
  photos TEXT[],
  notes TEXT,
  campus VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patrol_date ON patrols(date);

-- =====================================================
-- 7. 财务记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS finance_records (
  id TEXT PRIMARY KEY,
  type VARCHAR(50), -- income/expense/refund
  category VARCHAR(100),
  amount DECIMAL(12,2),
  student_id TEXT,
  student_name VARCHAR(100),
  description TEXT,
  payment_method VARCHAR(50),
  receipt_number VARCHAR(100),
  date DATE,
  status VARCHAR(20) DEFAULT 'PENDING',
  approved_by TEXT,
  campus VARCHAR(100),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_records(date);
CREATE INDEX IF NOT EXISTS idx_finance_student ON finance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance_records(type);

-- =====================================================
-- 8. 退费记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS refund_records (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name VARCHAR(100),
  original_amount DECIMAL(12,2),
  refund_amount DECIMAL(12,2),
  reason TEXT,
  refund_type VARCHAR(50),
  bank_account VARCHAR(50),
  bank_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'PENDING',
  applied_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  campus VARCHAR(100),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refund_student ON refund_records(student_id);
CREATE INDEX IF NOT EXISTS idx_refund_status ON refund_records(status);

-- =====================================================
-- 9. 维修报修表
-- =====================================================
CREATE TABLE IF NOT EXISTS maintenance_records (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  location VARCHAR(200),
  category VARCHAR(100),
  priority VARCHAR(20) DEFAULT 'NORMAL',
  photos TEXT[],
  status VARCHAR(20) DEFAULT 'PENDING',
  reported_by TEXT,
  assigned_to TEXT,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  campus VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_campus ON maintenance_records(campus);

-- =====================================================
-- 10. 校历事件表
-- =====================================================
CREATE TABLE IF NOT EXISTS calendar_events (
  id TEXT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  event_type VARCHAR(50),
  start_date DATE NOT NULL,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  all_day BOOLEAN DEFAULT FALSE,
  location VARCHAR(200),
  participants TEXT[],
  reminders JSONB,
  color VARCHAR(20),
  campus VARCHAR(100),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_date ON calendar_events(start_date);
CREATE INDEX IF NOT EXISTS idx_calendar_campus ON calendar_events(campus);

-- =====================================================
-- 11. 聊天消息表
-- =====================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name VARCHAR(100),
  sender_type VARCHAR(20), -- teacher/parent/admin
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text', -- text/image/file
  attachments JSONB,
  read_by TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id);

-- =====================================================
-- 12. AI 观察记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS ai_observations (
  id TEXT PRIMARY KEY,
  student_id TEXT NOT NULL,
  student_name VARCHAR(100),
  observation_date DATE,
  raw_content TEXT,
  ai_analysis JSONB,
  domain VARCHAR(50), -- cognitive/social/physical/language/creative
  indicators TEXT[],
  suggestions TEXT[],
  photos TEXT[],
  status VARCHAR(20) DEFAULT 'DRAFT',
  recorded_by TEXT,
  campus VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_obs_student ON ai_observations(student_id);
CREATE INDEX IF NOT EXISTS idx_ai_obs_date ON ai_observations(observation_date);

-- =====================================================
-- 禁用 RLS（开发阶段）
-- =====================================================
ALTER TABLE growth_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE pickup_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE curriculum DISABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules DISABLE ROW LEVEL SECURITY;
ALTER TABLE fire_checks DISABLE ROW LEVEL SECURITY;
ALTER TABLE patrols DISABLE ROW LEVEL SECURITY;
ALTER TABLE finance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE refund_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE ai_observations DISABLE ROW LEVEL SECURITY;

-- =====================================================
-- 授予访问权限
-- =====================================================
GRANT ALL ON growth_records TO anon;
GRANT ALL ON pickup_records TO anon;
GRANT ALL ON curriculum TO anon;
GRANT ALL ON staff_schedules TO anon;
GRANT ALL ON fire_checks TO anon;
GRANT ALL ON patrols TO anon;
GRANT ALL ON finance_records TO anon;
GRANT ALL ON refund_records TO anon;
GRANT ALL ON maintenance_records TO anon;
GRANT ALL ON calendar_events TO anon;
GRANT ALL ON chat_messages TO anon;
GRANT ALL ON ai_observations TO anon;

-- =====================================================
-- 完成提示
-- =====================================================
SELECT '✅ 所有补充数据表创建完成！' as message;
SELECT '现在所有功能模块都支持云端存储了。' as info;
