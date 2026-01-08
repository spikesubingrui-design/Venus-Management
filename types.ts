
export enum AppView {
  DASHBOARD = 'DASHBOARD',
  STUDENTS = 'STUDENTS',
  STAFF = 'STAFF',
  COMMUNICATION = 'COMMUNICATION',
  CURRICULUM = 'CURRICULUM',
  AI_ASSISTANT = 'AI_ASSISTANT',
  KITCHEN = 'KITCHEN',
  SAFETY = 'SAFETY',
  DOCUMENTS = 'DOCUMENTS',
  SYSTEM_MGMT = 'SYSTEM_MGMT',
  CALENDAR = 'CALENDAR',
  FINANCE = 'FINANCE',           // 财务管理（退费）
  OBSERVATION = 'OBSERVATION',   // 观察记录
  GROWTH_ARCHIVE = 'GROWTH_ARCHIVE', // 成长档案
  MAINTENANCE = 'MAINTENANCE',   // 维修报修
  DATA_COCKPIT = 'DATA_COCKPIT', // 数据驾驶舱
  ANOMALY_MONITOR = 'ANOMALY_MONITOR' // 异常监控
}

// 园区类型：普惠园、高端园、九幼、十七幼
export type CampusGrade = 'PHUI' | 'HIGH_END' | 'JIU_YOU' | 'SHIQI_YOU';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'TEACHER' | 'KITCHEN' | 'PARENT';

// 园区配置
export const CAMPUS_CONFIG: Record<CampusGrade, { name: string; features: string[] }> = {
  'PHUI': { 
    name: '普惠园', 
    features: ['基础营养配餐', '标准午点', '牛奶加餐'] 
  },
  'HIGH_END': { 
    name: '高端园', 
    features: ['丰富水果加餐', '精致午点甜品', '益智豆浆', '银耳雪梨汤'] 
  },
  'JIU_YOU': { 
    name: '九幼', 
    features: ['周五西式自助餐', '蛋挞点心', '西式牛排意面', '精选水果'] 
  },
  'SHIQI_YOU': { 
    name: '十七幼', 
    features: ['周五西式自助餐', '蛋挞点心', '西式牛排意面', '精选水果'] 
  }
};

export interface User {
  id: string;
  name: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  classId?: string;
  campus?: string;
  campusGrade?: CampusGrade;
}

export interface Teacher {
  id: string;
  name: string;
  role: string;
  phone: string;
  avatar: string;
  assignedClass: string;
  performanceScore: number;
  campus?: string;
  hireDate?: string;
  education?: string;
  certificates?: string[];
  status?: 'active' | 'leave' | 'resigned';
}

// 排班记录
export interface ScheduleRecord {
  id: string;
  teacherId: string;
  date: string;           // YYYY-MM-DD
  shift: 'morning' | 'afternoon' | 'full' | 'rest';
  notes?: string;
}

// 接送记录
export interface PickupRecord {
  id: string;
  studentId: string;
  date: string;
  type: 'pickup' | 'dropoff';
  time: string;
  pickerName: string;
  pickerRelation: string;
  pickerPhone: string;
  pickerIdLast4?: string;  // 身份证后四位
  verifiedBy: string;       // 确认老师
  notes?: string;
  isPreBooked?: boolean;    // 是否预约接送
}

// 成长记录
export interface GrowthRecord {
  id: string;
  studentId: string;
  date: string;
  type: 'milestone' | 'observation' | 'assessment' | 'artwork' | 'photo';
  title: string;
  content: string;
  mediaUrls?: string[];
  category?: string;        // 五大领域：健康/语言/社会/科学/艺术
  recordedBy: string;
  sharedToParent?: boolean;
}

// 幼儿发展评估
export interface DevelopmentAssessment {
  id: string;
  studentId: string;
  assessDate: string;
  period: string;           // 如：2024年秋季学期
  assessor: string;
  domains: {
    health: { score: number; notes: string };      // 健康领域
    language: { score: number; notes: string };    // 语言领域
    social: { score: number; notes: string };      // 社会领域
    science: { score: number; notes: string };     // 科学领域
    art: { score: number; notes: string };         // 艺术领域
  };
  overallNotes?: string;
  parentFeedback?: string;
}

// 公告通知
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'all' | 'class' | 'individual';
  targetClass?: string;
  targetStudentIds?: string[];
  campus?: string;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
  attachments?: string[];
  readBy?: string[];        // 已读家长ID列表
  isPinned?: boolean;
}

// 食材营养数据 (每100g)
export interface NutritionPer100g {
  energy: number;      // 能量 kcal
  protein: number;     // 蛋白质 g
  fat: number;         // 脂肪 g
  carbs: number;       // 碳水化合物 g
  fiber: number;       // 膳食纤维 g
  calcium: number;     // 钙 mg
  iron: number;        // 铁 mg
  vitaminA: number;    // 维生素A μg
  vitaminC: number;    // 维生素C mg
}

// 细化食材接口
export interface DishIngredient {
  name: string;
  perPersonGrams: number;
  nutrition?: NutritionPer100g;  // 营养数据（可选）
}

// 细化菜品接口
export interface MealDish {
  dishName: string;
  ingredients: DishIngredient[];
}

export interface DailyRecipe {
  day: string;
  meals: {
    breakfast: MealDish;
    morningFruitSnack?: MealDish;  // 早餐后水果加餐（高端园/九幼/十七幼）
    morningSnack: MealDish;
    lunch: {
      mainDish: MealDish;
      sideDish: MealDish;
      soup: MealDish;
      staple: MealDish;
    };
    milkSnack: MealDish;           // 牛奶加餐
    afternoonSnack: MealDish;
    dinner: MealDish;
  };
  // 每日营养汇总
  dailyNutrition?: {
    totalEnergy: number;      // 总能量 kcal
    totalProtein: number;     // 总蛋白质 g
    totalFat: number;         // 总脂肪 g
    totalCarbs: number;       // 总碳水 g
    totalCalcium: number;     // 总钙 mg
    totalIron: number;        // 总铁 mg
  };
}

export interface WeeklyRecipeRecord {
  id: string;
  weekRange: string;
  grade: CampusGrade;
  headcount: number;
  days: DailyRecipe[];
  createdAt: string;
  status: 'DRAFT' | 'CONFIRMED';
  nutritionSummary: {
    avgEnergy: number;
    avgProtein: number;
    varietyCount: number;
  };
}

// 每日健康记录
export interface DailyHealthRecord {
  id: string;
  studentId: string;
  date: string;                 // YYYY-MM-DD
  
  // 体温记录
  morningTemp?: number;         // 晨检体温
  noonTemp?: number;            // 午检体温
  afternoonTemp?: number;       // 晚检体温
  
  // 健康状态
  healthStatus: 'normal' | 'sick' | 'recovering'; // 正常/生病/恢复中
  symptoms?: string[];          // 症状：咳嗽、流涕、腹泻等
  medication?: string;          // 服药情况
  
  // 饮食情况
  breakfastStatus?: 'all' | 'half' | 'little' | 'none'; // 全吃/一半/少量/未吃
  lunchStatus?: 'all' | 'half' | 'little' | 'none';
  snackStatus?: 'all' | 'half' | 'little' | 'none';
  
  // 午睡情况
  napStatus?: 'good' | 'normal' | 'poor' | 'none'; // 好/一般/差/未睡
  napDuration?: number;         // 午睡时长（分钟）
  
  // 情绪状态
  moodStatus?: 'happy' | 'normal' | 'upset' | 'crying'; // 开心/一般/不高兴/哭闹
  
  // 大小便
  toiletNormal?: boolean;       // 大小便是否正常
  
  // 备注
  notes?: string;
  
  // 记录信息
  recordedBy: string;           // 记录人
  recordedAt: string;           // 记录时间
  
  // 是否已同步给家长
  syncedToParent: boolean;
  syncedAt?: string;
}

// 考勤记录
export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string;                 // YYYY-MM-DD
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'sick_leave' | 'personal_leave';
  checkInTime?: string;         // 签到时间
  checkOutTime?: string;        // 签退时间
  leaveReason?: string;         // 请假原因
  recordedBy: string;
  recordedAt: string;
}

// 家长通知记录
export interface ParentNotification {
  id: string;
  studentId: string;
  type: 'health_alert' | 'daily_report' | 'attendance' | 'announcement';
  title: string;
  content: string;
  createdAt: string;
  readAt?: string;
  isRead: boolean;
}

export interface Student {
  id: string;
  name: string;
  gender: '男' | '女';
  birthDate: string;           // 出生日期
  age: number;
  class: string;
  campus: string;
  avatar: string;
  status: 'present' | 'absent' | 'late' | 'early_leave' | 'sick_leave' | 'personal_leave';
  last_activity: string;
  
  // 健康信息
  height?: number;              // 身高 cm
  weight?: number;              // 体重 kg
  bloodType?: 'A' | 'B' | 'AB' | 'O' | '未知';
  allergies?: string[];         // 过敏史
  healthNotes?: string;         // 健康备注（如：哮喘、近视等）
  
  // 家长信息
  parent_name: string;          // 主要监护人姓名
  parent_phone: string;         // 主要联系电话
  parent_relation: '父亲' | '母亲' | '爷爷' | '奶奶' | '外公' | '外婆' | '其他';
  
  // 紧急联系人
  emergency_contact?: string;   // 紧急联系人
  emergency_phone?: string;     // 紧急联系电话
  emergency_relation?: string;  // 与幼儿关系
  
  // 家庭信息
  address?: string;             // 家庭住址
  idNumber?: string;            // 身份证号（可选）
  
  // 入园信息
  enrollDate: string;           // 入园日期
  studentNumber?: string;       // 学号
  previousSchool?: string;      // 之前就读学校（可选）
  
  // 特殊需求
  dietaryRestrictions?: string; // 饮食禁忌
  specialNeeds?: string;        // 特殊需求说明
  
  // ===== 收费相关 =====
  classType?: 'standard' | 'excellence' | 'music';  // 班型：标准班/优苗班/音乐班
  feeDiscount?: StudentFeeDiscount;                  // 优惠配置
  feeNotes?: string;                                 // 收费备注（特殊情况说明）
  
  // 今日记录（运行时数据）
  todayHealth?: DailyHealthRecord;
  todayAttendance?: AttendanceRecord;
}

// ===== 学生收费优惠配置 =====
export interface StudentFeeDiscount {
  hasDiscount: boolean;                // 是否有优惠
  discountType?: 'percentage' | 'fixed' | 'custom';  // 优惠类型
  discountValue?: number;              // 优惠值（百分比或固定金额）
  discountReason?: string;             // 优惠原因（如：老生、员工子女、双胞胎等）
  
  // 自定义收费（覆盖标准收费）
  customTuition?: number;              // 自定义保教费
  customMealFee?: number;              // 自定义伙食费
  
  // 免费项目
  exemptItems?: ('tuition' | 'meal' | 'agency' | 'bedding')[];  // 免费项目
  
  effectiveFrom?: string;              // 生效日期
  effectiveTo?: string;                // 截止日期
  approvedBy?: string;                 // 审批人
  approvedAt?: string;                 // 审批时间
}

// ==================== 财务管理 ====================

// 园所收费标准（来自2025年秋季收费标准表）
export interface CampusFeeStandard {
  campusId: string;               // 园所标识
  campusName: string;             // 园所名称：南江、高新、新市花园等
  
  // 标准班收费
  standardClass: {
    tuition: number;              // 保教费（月）
    tuitionHalfYear: number;      // 保教费（半年）
    meal: number;                 // 伙食费（月）
    mealHalfYear: number;         // 伙食费（半年）
    total: number;                // 合计
  };
  
  // 优苗班收费（不足两岁）
  excellenceClass?: {
    tuition: number;
    tuitionHalfYear: number;
    meal: number;
    mealHalfYear: number;
    total: number;
  };
  
  // 音乐班收费
  musicClass?: {
    tuition: number;
    tuitionHalfYear: number;
    meal: number;
    mealHalfYear: number;
    total: number;
  };
  
  // 其他费用（所有园所统一）
  otherFees: {
    agencyFee: number;            // 代办费（1100）
    bedding: number;              // 床品费（428）
  };
  
  // 备注
  notes?: string;
  effectiveDate: string;          // 生效日期
}

// 2025年秋季各园所收费标准
export const CAMPUS_FEE_STANDARDS_2025: CampusFeeStandard[] = [
  {
    campusId: 'nanjiang',
    campusName: '南江',
    standardClass: { tuition: 1180, tuitionHalfYear: 1180, meal: 330, mealHalfYear: 330, total: 1510 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'gaoxin',
    campusName: '高新',
    standardClass: { tuition: 1080, tuitionHalfYear: 1080, meal: 330, mealHalfYear: 330, total: 1410 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'xinshihuayuan',
    campusName: '新市花园',
    standardClass: { tuition: 1250, tuitionHalfYear: 1250, meal: 330, mealHalfYear: 330, total: 1680 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'chuangyue',
    campusName: '创越',
    standardClass: { tuition: 1080, tuitionHalfYear: 1080, meal: 330, mealHalfYear: 330, total: 1410 },
    musicClass: { tuition: 1760, tuitionHalfYear: 1760, meal: 330, mealHalfYear: 330, total: 2090 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'qiyou',
    campusName: '七幼',
    standardClass: { tuition: 1280, tuitionHalfYear: 1280, meal: 330, mealHalfYear: 330, total: 1610 },
    musicClass: { tuition: 1530, tuitionHalfYear: 1530, meal: 330, mealHalfYear: 330, total: 1860 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'bayou',
    campusName: '八幼',
    standardClass: { tuition: 1430, tuitionHalfYear: 1430, meal: 330, mealHalfYear: 330, total: 1760 },
    musicClass: { tuition: 1430, tuitionHalfYear: 1430, meal: 330, mealHalfYear: 330, total: 1910 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'jiuyou',
    campusName: '九幼',
    standardClass: { tuition: 1280, tuitionHalfYear: 1280, meal: 330, mealHalfYear: 330, total: 1610 },
    excellenceClass: { tuition: 1580, tuitionHalfYear: 1580, meal: 330, mealHalfYear: 330, total: 1760 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'shiyou',
    campusName: '十幼',
    standardClass: { tuition: 1280, tuitionHalfYear: 1280, meal: 330, mealHalfYear: 330, total: 1610 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'shieryou',
    campusName: '十二幼',
    standardClass: { tuition: 1360, tuitionHalfYear: 1360, meal: 330, mealHalfYear: 330, total: 1690 },
    excellenceClass: { tuition: 3580, tuitionHalfYear: 3580, meal: 480, mealHalfYear: 480, total: 4060 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    effectiveDate: '2025-09-01'
  },
  {
    campusId: 'shiqiyou',
    campusName: '十七幼',
    standardClass: { tuition: 2100, tuitionHalfYear: 2100, meal: 330, mealHalfYear: 330, total: 2580 },
    excellenceClass: { tuition: 2500, tuitionHalfYear: 2500, meal: 480, mealHalfYear: 480, total: 2980 },
    musicClass: { tuition: 3080, tuitionHalfYear: 3080, meal: 480, mealHalfYear: 480, total: 3560 },
    otherFees: { agencyFee: 1100, bedding: 428 },
    notes: '代办费包含项项费700（大班400）、书包120、校服280、床品428',
    effectiveDate: '2025-09-01'
  }
];

// 退费政策规定（来自政策文件）
export const REFUND_POLICY = {
  // 保教费退费规则（2025年9月1日起执行）
  tuition: {
    description: '幼儿保教费，计算当月出勤，不累计跨月',
    rules: [
      { condition: '出勤超半月', action: '按月收取不退费', refundRate: 0 },
      { condition: '连续缺勤半月以上', action: '可退保教费', refundRate: 1 }
    ],
    halfMonthDefinition: '以当月应出勤天数的一半为准',
    effectiveDate: '2025-09-01'
  },
  
  // 伙食费退费规则
  meal: {
    description: '后勤保障部根据带量食谱采购食材，因幼儿未出勤造成食物浪费',
    rules: [
      { condition: '当月未出勤3天以上', action: '可退伙食费', minAbsentDays: 3 },
      { condition: '当月未出勤不足3天', action: '不退伙食费', minAbsentDays: 0 }
    ],
    effectiveDate: '2025-09-01'
  }
};

// 收费项目配置
export interface FeeConfig {
  id: string;
  name: string;                   // 保教费、伙食费、代收费等
  type: 'tuition' | 'meal' | 'other';
  monthlyAmount: number;          // 月标准金额
  refundRule: 'daily' | 'half_month' | 'full_month'; // 退费规则
  dailyRate?: number;             // 日均费用（自动计算）
  campus: string;
  classType?: 'standard' | 'excellence' | 'music';  // 班型
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// 学生缴费记录（增强版 - 支持优惠记录）
export interface FeePayment {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  campus: string;
  
  // 缴费周期
  period: string;                 // 缴费周期：2026-01 或 2026-01~2026-06
  periodType: 'monthly' | 'semester' | 'yearly';  // 月缴/学期缴/年缴
  periodMonths: number;           // 缴费月数（1/6/12）
  
  // 费用类型
  feeType: 'tuition' | 'meal' | 'agency' | 'bedding' | 'other';
  feeName: string;
  
  // 金额明细
  standardAmount: number;         // 标准金额（收费表金额）
  discountAmount: number;         // 优惠金额
  actualAmount: number;           // 实付金额（标准 - 优惠）
  
  // 优惠信息
  hasDiscount: boolean;
  discountType?: 'percentage' | 'fixed' | 'custom';  // 优惠类型
  discountValue?: number;         // 优惠值（百分比或固定金额）
  discountReason?: string;        // 优惠原因（老生、员工子女、双胞胎等）
  
  // 支付信息
  paymentDate: string;
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'bank' | 'transfer' | 'other';
  receiptNumber?: string;         // 收据号
  invoiceNumber?: string;         // 发票号
  
  // 操作信息
  operator: string;               // 经办人
  approvedBy?: string;            // 审批人（优惠需审批）
  notes?: string;                 // 备注
  
  // 状态
  status: 'pending' | 'confirmed' | 'cancelled';  // 待确认/已确认/已取消
  
  createdAt: string;
  updatedAt?: string;
}

// 批量缴费记录（一个学生一次缴多项费用）
export interface BatchPayment {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  campus: string;
  
  // 缴费明细
  items: {
    feeType: 'tuition' | 'meal' | 'agency' | 'bedding';
    feeName: string;
    standardAmount: number;
    discountAmount: number;
    actualAmount: number;
    discountReason?: string;
  }[];
  
  // 汇总
  totalStandard: number;          // 标准总额
  totalDiscount: number;          // 优惠总额
  totalActual: number;            // 实付总额
  
  // 缴费周期
  period: string;
  periodType: 'monthly' | 'semester' | 'yearly';
  periodMonths: number;
  
  // 支付信息
  paymentDate: string;
  paymentMethod: 'cash' | 'wechat' | 'alipay' | 'bank' | 'transfer' | 'other';
  receiptNumber?: string;
  
  // 优惠汇总
  hasDiscount: boolean;
  discountNotes?: string;         // 优惠说明汇总
  
  operator: string;
  approvedBy?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'cancelled';
  
  createdAt: string;
}

// 企业收款码配置
export interface PaymentQRCode {
  id: string;
  name: string;                       // 收款码名称：如"微信收款码"、"支付宝收款码"
  type: 'wechat' | 'alipay' | 'bank'; // 收款类型
  qrCodeUrl: string;                  // 二维码图片URL（Base64或网络地址）
  accountName?: string;               // 收款账户名称
  accountNumber?: string;             // 收款账号（银行卡号等）
  campus: string;                     // 所属园所
  isActive: boolean;                  // 是否启用
  description?: string;               // 说明
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

// 扫码支付记录（家长扫码后的凭证）
export interface QRPaymentRecord {
  id: string;
  paymentId: string;                  // 关联的缴费记录ID
  studentId: string;
  studentName: string;
  amount: number;                     // 支付金额
  qrCodeId: string;                   // 使用的收款码ID
  qrCodeType: 'wechat' | 'alipay' | 'bank';
  
  // 支付凭证
  proofImageUrl?: string;             // 支付截图（Base64）
  transactionId?: string;             // 交易单号（家长填写）
  payerName?: string;                 // 付款人姓名
  paymentTime?: string;               // 付款时间
  
  // 状态
  status: 'pending' | 'confirmed' | 'rejected';  // 待确认/已确认/已驳回
  confirmedBy?: string;               // 确认人
  confirmedAt?: string;               // 确认时间
  rejectReason?: string;              // 驳回原因
  
  notes?: string;
  createdAt: string;
}

// 退费记录
export interface RefundRecord {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  campus: string;
  period: string;                 // 退费周期
  
  // 退费计算基础
  feeType: 'tuition' | 'meal' | 'both';
  originalAmount: number;         // 原缴费金额
  
  // 考勤关联
  totalDaysInMonth: number;       // 当月总天数（工作日）
  presentDays: number;            // 实际出勤天数
  absentDays: number;             // 缺勤天数
  sickLeaveDays: number;          // 病假天数
  personalLeaveDays: number;      // 事假天数
  
  // 退费计算结果
  tuitionRefund: number;          // 保教费退费
  mealRefund: number;             // 伙食费退费
  totalRefund: number;            // 总退费金额
  
  // 退费状态
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  calculatedBy: string;           // 计算人
  calculatedAt: string;
  approvedBy?: string;            // 审批人
  approvedAt?: string;
  refundedAt?: string;            // 实际退费时间
  
  // 备注
  reason: string;                 // 退费原因
  notes?: string;
  
  // 关联考勤记录ID列表
  attendanceRecordIds: string[];
}

// 退费规则配置
export interface RefundRuleConfig {
  id: string;
  campus: string;
  feeType: 'tuition' | 'meal';
  
  // 保教费退费规则
  tuitionRules?: {
    sickLeaveRefundRate: number;     // 病假退费比例（如0.5表示50%）
    personalLeaveRefundRate: number; // 事假退费比例
    minAbsentDays: number;           // 最少缺勤天数才能退费
  };
  
  // 伙食费退费规则
  mealRules?: {
    refundPerDay: number;            // 每日退费金额
    minAbsentDays: number;           // 最少缺勤天数才能退费
  };
  
  effectiveDate: string;
  createdBy: string;
  createdAt: string;
}

// ==================== 观察记录 ====================

// 教师流水账记录
export interface ObservationDraft {
  id: string;
  studentId: string;
  studentName: string;
  class: string;
  
  // 原始记录
  rawContent: string;             // 教师原始流水账
  photos?: string[];              // 照片URL
  videoUrl?: string;              // 视频URL
  recordType: 'text' | 'photo' | 'video' | 'mixed';
  
  // 记录信息
  observedAt: string;             // 观察时间
  domain?: '健康' | '语言' | '社会' | '科学' | '艺术'; // 五大领域
  activity?: string;              // 活动场景
  
  recordedBy: string;
  recordedAt: string;
  
  // AI处理状态
  aiProcessed: boolean;
  aiProcessedAt?: string;
}

// AI润色后的专业观察记录
export interface ProfessionalObservation {
  id: string;
  draftId: string;                // 关联原始记录
  studentId: string;
  studentName: string;
  class: string;
  
  // AI生成内容
  title: string;                  // 观察标题
  background: string;             // 观察背景
  behavior: string;               // 行为描述
  analysis: string;               // 行为分析（基于3-6岁指南）
  developmentLevel: string;       // 发展水平评估
  suggestions: string[];          // 教育建议
  parentTips?: string;            // 家长沟通建议
  
  // 关联指南
  guidelineRefs?: {
    domain: string;               // 领域
    goal: string;                 // 目标
    indicator: string;            // 典型表现
  }[];
  
  // 状态
  status: 'draft' | 'reviewed' | 'shared';
  reviewedBy?: string;
  reviewedAt?: string;
  sharedToParent: boolean;
  sharedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

// ==================== 维修报修 ====================

// 资产类别
export type AssetCategory = 'furniture' | 'appliance' | 'toy' | 'facility' | 'it_equipment' | 'other';

// 资产记录
export interface Asset {
  id: string;
  name: string;
  category: AssetCategory;
  brand?: string;
  model?: string;
  purchaseDate: string;
  purchasePrice: number;
  supplier?: string;
  warranty?: string;              // 保修期
  location: string;               // 位置：班级/区域
  campus: string;
  status: 'in_use' | 'repairing' | 'scrapped';
  
  // 统计数据
  totalRepairCount: number;       // 总报修次数
  totalRepairCost: number;        // 总维修费用
  
  createdAt: string;
  updatedAt: string;
}

// 报修记录
export interface MaintenanceRecord {
  id: string;
  assetId?: string;               // 关联资产（可选）
  assetName: string;
  category: AssetCategory;
  
  // 报修信息
  issue: string;                  // 问题描述
  photos?: string[];
  urgency: 'low' | 'medium' | 'high' | 'urgent';
  location: string;
  campus: string;
  reportedBy: string;
  reportedAt: string;
  
  // 维修信息
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;            // 指派给
  repairStartAt?: string;
  repairEndAt?: string;
  repairCost?: number;
  repairNotes?: string;
  
  // 评估
  isWarranty?: boolean;           // 是否保修
  rootCause?: 'quality' | 'usage' | 'wear' | 'accident' | 'unknown'; // 原因
}

// 采购质量分析
export interface PurchaseQualityAnalysis {
  id: string;
  category: AssetCategory;
  period: string;                 // 分析周期：2026-Q1
  campus: string;
  
  // 统计数据
  totalAssets: number;            // 该类资产总数
  totalPurchaseCost: number;      // 总采购成本
  totalRepairCount: number;       // 总报修次数
  totalRepairCost: number;        // 总维修费用
  avgRepairFrequency: number;     // 平均报修频率（次/件/月）
  
  // 分析结论
  qualityScore: number;           // 质量评分 1-100
  costEfficiency: 'excellent' | 'good' | 'average' | 'poor'; // 性价比
  recommendation: string;         // 建议
  
  // 品牌对比
  brandAnalysis?: {
    brand: string;
    count: number;
    repairRate: number;
    avgCost: number;
  }[];
  
  generatedAt: string;
}

// ==================== 异常监控 ====================

// 物资消耗记录
export interface ConsumptionRecord {
  id: string;
  itemName: string;               // 物资名称
  category: 'paper' | 'cleaning' | 'food' | 'office' | 'teaching' | 'other';
  quantity: number;
  unit: string;
  cost: number;
  period: string;                 // 月份：2026-01
  campus: string;
  department?: string;            // 部门/班级
  recordedBy: string;
  recordedAt: string;
}

// 异常警报
export interface AnomalyAlert {
  id: string;
  type: 'consumption_spike' | 'cost_spike' | 'frequency_spike' | 'pattern_change';
  severity: 'info' | 'warning' | 'critical';
  
  // 异常详情
  itemName: string;
  category: string;
  currentValue: number;
  historicalAvg: number;
  deviation: number;              // 偏差百分比
  period: string;
  campus: string;
  
  // 分析
  possibleReasons: string[];
  suggestedActions: string[];
  
  // 状态
  status: 'new' | 'acknowledged' | 'investigating' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolution?: string;
  resolvedAt?: string;
  
  createdAt: string;
}

// ==================== 数据驾驶舱 ====================

// 实时数据快照
export interface DashboardSnapshot {
  timestamp: string;
  campus: string;                 // 'all' 表示全集团
  
  // 人员数据
  people: {
    totalStudents: number;
    presentStudents: number;
    absentStudents: number;
    attendanceRate: number;
    
    totalStaff: number;
    presentStaff: number;
    onLeaveStaff: number;
    
    teacherStudentRatio: number;
  };
  
  // 财务数据
  finance: {
    monthlyIncome: number;
    monthlyExpense: number;
    pendingRefunds: number;
    refundAmount: number;
    
    tuitionCollection: number;    // 保教费收缴率
    mealCollection: number;       // 伙食费收缴率
  };
  
  // 资产数据
  assets: {
    totalAssets: number;
    totalValue: number;
    pendingRepairs: number;
    monthlyRepairCost: number;
    
    // 能耗（可扩展）
    monthlyUtility?: number;
  };
  
  // 预警
  alerts: {
    total: number;
    critical: number;
    warning: number;
  };
}
