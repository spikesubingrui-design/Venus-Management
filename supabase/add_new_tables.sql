-- =====================================================
-- 金星教育系统 - 新增数据表
-- 在 Supabase SQL Editor 中执行此脚本
-- =====================================================

-- =====================================================
-- 1. 接送记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS pickup_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  date DATE NOT NULL,
  campus VARCHAR(100),
  
  -- 送入信息
  dropoff_time TIMESTAMP WITH TIME ZONE,
  dropoff_person VARCHAR(100),
  dropoff_relation VARCHAR(20),
  dropoff_phone VARCHAR(11),
  
  -- 接走信息
  pickup_time TIMESTAMP WITH TIME ZONE,
  pickup_person VARCHAR(100),
  pickup_relation VARCHAR(20),
  pickup_phone VARCHAR(11),
  
  -- 其他
  notes TEXT,
  qr_verified BOOLEAN DEFAULT FALSE,
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_pickup_student_date ON pickup_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_pickup_campus ON pickup_records(campus);

-- =====================================================
-- 2. 疾病记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS disease_records (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  student_name VARCHAR(100),
  student_class VARCHAR(50),
  campus VARCHAR(100),
  
  -- 疾病信息
  disease_name VARCHAR(100) NOT NULL,
  symptoms TEXT[],
  onset_date DATE,
  diagnosis_date DATE,
  
  -- 状态跟踪
  status VARCHAR(20) DEFAULT 'treating' CHECK (status IN ('treating', 'isolated', 'recovered')),
  recovery_date DATE,
  isolation_end_date DATE,
  
  -- 医疗信息
  hospital VARCHAR(200),
  doctor VARCHAR(100),
  treatment TEXT,
  medication TEXT,
  
  -- 其他
  is_infectious BOOLEAN DEFAULT FALSE,
  report_to_cdc BOOLEAN DEFAULT FALSE,
  notes TEXT,
  
  recorded_by UUID REFERENCES users(id),
  recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 触发器
CREATE TRIGGER update_disease_records_updated_at
  BEFORE UPDATE ON disease_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 索引
CREATE INDEX IF NOT EXISTS idx_disease_student ON disease_records(student_id);
CREATE INDEX IF NOT EXISTS idx_disease_status ON disease_records(status);
CREATE INDEX IF NOT EXISTS idx_disease_campus ON disease_records(campus);

-- =====================================================
-- 3. 消毒记录表（扩展现有表）
-- =====================================================
-- 添加缺失字段
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'daily';
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS areas TEXT[];
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS ventilation BOOLEAN DEFAULT FALSE;
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS ventilation_duration INTEGER;
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES users(id);
ALTER TABLE disinfection_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- 4. 学生评价记录表
-- =====================================================
CREATE TABLE IF NOT EXISTS student_evaluations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID REFERENCES students(id),
  student_name VARCHAR(100),
  student_class VARCHAR(50),
  campus VARCHAR(100),
  
  -- 评价信息
  template_id VARCHAR(100),
  template_name VARCHAR(200),
  grade VARCHAR(20),  -- 托班、小班、中班、大班
  domain VARCHAR(50), -- 评价领域
  
  -- 评价数据
  boolean_values JSONB,  -- 是/否项
  rating_values JSONB,   -- 评级项
  text_values JSONB,     -- 文字项
  
  -- 综合评语
  overall_comment TEXT,
  
  -- 进度
  progress INTEGER DEFAULT 0,  -- 完成百分比
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'archived')),
  
  -- 评价周期
  period_type VARCHAR(20),  -- monthly, quarterly, semester, yearly
  period_start DATE,
  period_end DATE,
  
  -- 元数据
  evaluated_by UUID REFERENCES users(id),
  evaluated_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 触发器
CREATE TRIGGER update_student_evaluations_updated_at
  BEFORE UPDATE ON student_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 索引
CREATE INDEX IF NOT EXISTS idx_eval_student ON student_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_eval_template ON student_evaluations(template_id);
CREATE INDEX IF NOT EXISTS idx_eval_campus ON student_evaluations(campus);
CREATE INDEX IF NOT EXISTS idx_eval_status ON student_evaluations(status);

-- =====================================================
-- 5. 健康记录表扩展
-- =====================================================
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS campus VARCHAR(100);
ALTER TABLE health_records ADD COLUMN IF NOT EXISTS recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- =====================================================
-- RLS 策略
-- =====================================================

-- 接送记录
ALTER TABLE pickup_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view pickup records" ON pickup_records FOR SELECT USING (true);
CREATE POLICY "Staff can manage pickup records" ON pickup_records FOR ALL USING (true);

-- 疾病记录
ALTER TABLE disease_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view disease records" ON disease_records FOR SELECT USING (true);
CREATE POLICY "Staff can manage disease records" ON disease_records FOR ALL USING (true);

-- 学生评价
ALTER TABLE student_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view evaluations" ON student_evaluations FOR SELECT USING (true);
CREATE POLICY "Staff can manage evaluations" ON student_evaluations FOR ALL USING (true);

-- =====================================================
-- 完成提示
-- =====================================================
-- 新表创建完成！
-- 已添加：
-- 1. pickup_records - 接送记录
-- 2. disease_records - 疾病记录  
-- 3. student_evaluations - 学生评价记录
-- 4. 扩展了 disinfection_records 和 health_records
