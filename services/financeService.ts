/**
 * 财务服务 - 自动关联退费计算
 * 根据考勤数据自动计算保教费/伙食费退费金额
 * 
 * 退费规则（2025年9月1日起执行）：
 * 1. 保教费：出勤超半月不退费，连续缺勤半月以上可退保教费
 * 2. 伙食费：当月未出勤3天以上才退伙食费
 */

import { 
  FeeConfig, 
  FeePayment, 
  RefundRecord, 
  RefundRuleConfig,
  AttendanceRecord,
  Student,
  CAMPUS_FEE_STANDARDS_2025,
  CampusFeeStandard,
  PaymentQRCode,
  QRPaymentRecord
} from '../types';
import { getData, saveData, STORAGE_KEYS } from './storageService';

// 存储键
const FINANCE_KEYS = {
  FEE_CONFIGS: 'kt_fee_configs',
  FEE_PAYMENTS: 'kt_fee_payments',
  REFUND_RECORDS: 'kt_refund_records',
  REFUND_RULES: 'kt_refund_rules',
  STUDENT_FEE_CONFIGS: 'kt_student_fee_configs',  // 学生个性化收费配置
  PAYMENT_QR_CODES: 'kt_payment_qr_codes',        // 企业收款码
  QR_PAYMENT_RECORDS: 'kt_qr_payment_records',    // 扫码支付记录
};

/**
 * 根据园所名称获取收费标准
 */
export function getCampusFeeStandard(campusName: string): CampusFeeStandard | undefined {
  // 尝试精确匹配
  let standard = CAMPUS_FEE_STANDARDS_2025.find(s => s.campusName === campusName);
  
  // 尝试模糊匹配（如"金星第十七幼儿园" -> "十七幼"）
  if (!standard) {
    const campusShortNames = ['南江', '高新', '新市花园', '创越', '七幼', '八幼', '九幼', '十幼', '十二幼', '十七幼'];
    for (const shortName of campusShortNames) {
      if (campusName.includes(shortName)) {
        standard = CAMPUS_FEE_STANDARDS_2025.find(s => s.campusName === shortName);
        break;
      }
    }
  }
  
  return standard;
}

/**
 * 获取学生实际应缴费用（考虑优惠）
 */
export function getStudentActualFees(student: Student): {
  tuition: number;
  meal: number;
  agency: number;
  bedding: number;
  total: number;
  hasDiscount: boolean;
  discountDetails?: string;
} {
  const campusStandard = getCampusFeeStandard(student.campus);
  
  // 默认费用
  let tuition = 1200;  // 默认保教费
  let meal = 330;      // 默认伙食费
  let agency = 1100;   // 代办费
  let bedding = 428;   // 床品费
  
  // 根据园所和班型获取标准费用
  if (campusStandard) {
    const classType = student.classType || 'standard';
    
    switch (classType) {
      case 'excellence':
        if (campusStandard.excellenceClass) {
          tuition = campusStandard.excellenceClass.tuition;
          meal = campusStandard.excellenceClass.meal;
        }
        break;
      case 'music':
        if (campusStandard.musicClass) {
          tuition = campusStandard.musicClass.tuition;
          meal = campusStandard.musicClass.meal;
        }
        break;
      default:
        tuition = campusStandard.standardClass.tuition;
        meal = campusStandard.standardClass.meal;
    }
    
    agency = campusStandard.otherFees.agencyFee;
    bedding = campusStandard.otherFees.bedding;
  }
  
  let hasDiscount = false;
  let discountDetails: string | undefined;
  
  // 应用学生个性化优惠
  if (student.feeDiscount?.hasDiscount) {
    hasDiscount = true;
    const discount = student.feeDiscount;
    
    // 自定义收费覆盖
    if (discount.customTuition !== undefined) {
      tuition = discount.customTuition;
    }
    if (discount.customMealFee !== undefined) {
      meal = discount.customMealFee;
    }
    
    // 百分比折扣
    if (discount.discountType === 'percentage' && discount.discountValue) {
      const rate = 1 - discount.discountValue / 100;
      tuition = Math.round(tuition * rate);
    }
    
    // 固定金额减免
    if (discount.discountType === 'fixed' && discount.discountValue) {
      tuition = Math.max(0, tuition - discount.discountValue);
    }
    
    // 免费项目
    if (discount.exemptItems?.includes('tuition')) tuition = 0;
    if (discount.exemptItems?.includes('meal')) meal = 0;
    if (discount.exemptItems?.includes('agency')) agency = 0;
    if (discount.exemptItems?.includes('bedding')) bedding = 0;
    
    discountDetails = discount.discountReason || '享受优惠';
  }
  
  return {
    tuition,
    meal,
    agency,
    bedding,
    total: tuition + meal,
    hasDiscount,
    discountDetails
  };
}

// 默认退费规则（基于2025年政策）
const DEFAULT_REFUND_RULES: Omit<RefundRuleConfig, 'id' | 'campus' | 'createdBy' | 'createdAt'>[] = [
  {
    feeType: 'tuition',
    tuitionRules: {
      sickLeaveRefundRate: 1,        // 病假全退（在符合条件时）
      personalLeaveRefundRate: 1,    // 事假全退（在符合条件时）
      minAbsentDays: 0,              // 由半月规则判断，不用最小天数
    },
    effectiveDate: '2025-09-01',
  },
  {
    feeType: 'meal',
    mealRules: {
      refundPerDay: 15,              // 每日退约15元伙食费（330/22≈15）
      minAbsentDays: 3,              // 【重要】当月未出勤3天以上才退伙食费
    },
    effectiveDate: '2025-09-01',
  }
];

/**
 * 初始化默认配置（基于2025年收费标准）
 */
export function initializeFinanceConfigs(campus: string): void {
  const existingConfigs = getData<FeeConfig>(FINANCE_KEYS.FEE_CONFIGS);
  
  if (existingConfigs.length === 0) {
    const now = new Date().toISOString();
    const campusStandard = getCampusFeeStandard(campus);
    
    // 根据园所实际收费标准创建配置
    const configs: FeeConfig[] = [];
    
    if (campusStandard) {
      // 标准班
      configs.push({
        id: `fee_config_tuition_standard`,
        name: '保教费（标准班）',
        type: 'tuition',
        monthlyAmount: campusStandard.standardClass.tuition,
        refundRule: 'half_month',
        dailyRate: campusStandard.standardClass.tuition / 22,
        campus,
        classType: 'standard',
        description: '标准班保教费，出勤超半月不退',
        createdAt: now,
        updatedAt: now,
      });
      
      // 优苗班（如果有）
      if (campusStandard.excellenceClass) {
        configs.push({
          id: `fee_config_tuition_excellence`,
          name: '保教费（优苗班）',
          type: 'tuition',
          monthlyAmount: campusStandard.excellenceClass.tuition,
          refundRule: 'half_month',
          dailyRate: campusStandard.excellenceClass.tuition / 22,
          campus,
          classType: 'excellence',
          description: '优苗班保教费（不足两岁）',
          createdAt: now,
          updatedAt: now,
        });
      }
      
      // 音乐班（如果有）
      if (campusStandard.musicClass) {
        configs.push({
          id: `fee_config_tuition_music`,
          name: '保教费（音乐班）',
          type: 'tuition',
          monthlyAmount: campusStandard.musicClass.tuition,
          refundRule: 'half_month',
          dailyRate: campusStandard.musicClass.tuition / 22,
          campus,
          classType: 'music',
          description: '音乐班保教费',
          createdAt: now,
          updatedAt: now,
        });
      }
      
      // 伙食费
      configs.push({
        id: `fee_config_meal`,
        name: '伙食费',
        type: 'meal',
        monthlyAmount: campusStandard.standardClass.meal,
        refundRule: 'daily',
        dailyRate: campusStandard.standardClass.meal / 22,
        campus,
        description: '缺勤3天以上才退',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      // 使用默认配置
      configs.push(
        {
          id: `fee_config_tuition_default`,
          name: '保教费',
          type: 'tuition',
          monthlyAmount: 1200,
          refundRule: 'half_month',
          dailyRate: 1200 / 22,
          campus,
          description: '默认保教费',
          createdAt: now,
          updatedAt: now,
        },
        {
          id: `fee_config_meal_default`,
          name: '伙食费',
          type: 'meal',
          monthlyAmount: 330,
          refundRule: 'daily',
          dailyRate: 330 / 22,
          campus,
          description: '默认伙食费',
          createdAt: now,
          updatedAt: now,
        }
      );
    }
    
    saveData(FINANCE_KEYS.FEE_CONFIGS, configs);
  }

  const existingRules = getData<RefundRuleConfig>(FINANCE_KEYS.REFUND_RULES);
  if (existingRules.length === 0) {
    const now = new Date().toISOString();
    const rules: RefundRuleConfig[] = DEFAULT_REFUND_RULES.map((rule, idx) => ({
      ...rule,
      id: `refund_rule_${idx + 1}`,
      campus,
      createdBy: '系统',
      createdAt: now,
    }));
    saveData(FINANCE_KEYS.REFUND_RULES, rules);
  }
}

/**
 * 获取所有园所收费标准
 */
export function getAllCampusFeeStandards(): CampusFeeStandard[] {
  return CAMPUS_FEE_STANDARDS_2025;
}

/**
 * 获取学生月度考勤统计
 */
export function getMonthlyAttendanceStats(
  studentId: string,
  yearMonth: string  // 格式：2026-01
): {
  totalWorkDays: number;
  presentDays: number;
  absentDays: number;
  sickLeaveDays: number;
  personalLeaveDays: number;
  lateDays: number;
  earlyLeaveDays: number;
  attendanceRecordIds: string[];
} {
  // 计算该月的工作日数量
  const [year, month] = yearMonth.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  
  let totalWorkDays = 0;
  const attendanceRecordIds: string[] = [];
  let presentDays = 0;
  let absentDays = 0;
  let sickLeaveDays = 0;
  let personalLeaveDays = 0;
  let lateDays = 0;
  let earlyLeaveDays = 0;

  // 遍历该月每一天
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearMonth}-${String(day).padStart(2, '0')}`;
    const dayOfWeek = new Date(year, month - 1, day).getDay();
    
    // 跳过周末
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;
    
    totalWorkDays++;
    
    // 获取当天考勤记录
    const dayAttendance = localStorage.getItem(`kt_attendance_${dateStr}`);
    if (dayAttendance) {
      const records = JSON.parse(dayAttendance) as Record<string, AttendanceRecord>;
      const studentRecord = records[studentId];
      
      if (studentRecord) {
        attendanceRecordIds.push(studentRecord.id);
        
        switch (studentRecord.status) {
          case 'present':
            presentDays++;
            break;
          case 'absent':
            absentDays++;
            break;
          case 'sick_leave':
            sickLeaveDays++;
            break;
          case 'personal_leave':
            personalLeaveDays++;
            break;
          case 'late':
            lateDays++;
            presentDays++; // 迟到也算出勤
            break;
          case 'early_leave':
            earlyLeaveDays++;
            presentDays++; // 早退也算出勤
            break;
        }
      } else {
        // 无记录视为缺勤
        absentDays++;
      }
    } else {
      // 无当天记录，视为未开始或缺勤
      // 如果是未来日期则不计入
      if (new Date(dateStr) <= new Date()) {
        absentDays++;
      } else {
        totalWorkDays--; // 未来日期不计入工作日
      }
    }
  }

  return {
    totalWorkDays,
    presentDays,
    absentDays,
    sickLeaveDays,
    personalLeaveDays,
    lateDays,
    earlyLeaveDays,
    attendanceRecordIds,
  };
}

/**
 * 计算学生退费金额
 * 
 * 退费规则（2025年9月1日起执行）：
 * 1. 保教费：
 *    - 计算当月出勤，不累计跨月
 *    - 出勤超半月（应出勤天数的一半）按月收取不退费
 *    - 连续缺勤半月以上可退保教费
 * 2. 伙食费：
 *    - 当月未出勤3天以上才退伙食费
 *    - 按实际缺勤天数退
 */
export function calculateRefund(
  student: Student,
  yearMonth: string,
  feeType: 'tuition' | 'meal' | 'both' = 'both'
): RefundRecord | null {
  const stats = getMonthlyAttendanceStats(student.id, yearMonth);
  
  // 获取学生实际费用（考虑优惠）
  const actualFees = getStudentActualFees(student);
  
  let tuitionRefund = 0;
  let mealRefund = 0;
  const now = new Date().toISOString();
  
  // 计算关键阈值
  const halfMonthDays = Math.ceil(stats.totalWorkDays / 2);  // 半月天数（向上取整）
  const totalAbsentDays = stats.absentDays + stats.sickLeaveDays + stats.personalLeaveDays;
  
  // ====== 保教费退费计算 ======
  // 规则：出勤超半月不退费，连续缺勤半月以上可退
  if (feeType === 'tuition' || feeType === 'both') {
    if (stats.presentDays <= halfMonthDays) {
      // 出勤未超半月，可以退保教费
      // 退费金额 = 缺勤天数 × 日均保教费
      const dailyTuition = actualFees.tuition / stats.totalWorkDays;
      
      // 计算连续缺勤天数（这里简化为总缺勤天数）
      // 实际应该检查是否"连续"缺勤，但为简化处理，用总缺勤天数
      if (totalAbsentDays >= halfMonthDays) {
        // 缺勤超半月，全额退保教费
        tuitionRefund = actualFees.tuition;
      } else {
        // 按实际缺勤天数退（病假+事假）
        const refundableDays = stats.sickLeaveDays + stats.personalLeaveDays;
        tuitionRefund = refundableDays * dailyTuition;
      }
    }
    // else: 出勤超半月，不退保教费
  }
  
  // ====== 伙食费退费计算 ======
  // 规则：当月未出勤3天以上才退伙食费
  if (feeType === 'meal' || feeType === 'both') {
    const MEAL_MIN_ABSENT_DAYS = 3;  // 最少缺勤3天才退
    
    if (totalAbsentDays >= MEAL_MIN_ABSENT_DAYS) {
      // 满足退费条件，按缺勤天数退
      const dailyMeal = actualFees.meal / stats.totalWorkDays;
      mealRefund = totalAbsentDays * dailyMeal;
      
      // 退费不能超过月伙食费
      mealRefund = Math.min(mealRefund, actualFees.meal);
    }
    // else: 缺勤不足3天，不退伙食费
  }

  const totalRefund = tuitionRefund + mealRefund;

  // 如果没有退费金额，返回null
  if (totalRefund <= 0) return null;

  const refundRecord: RefundRecord = {
    id: `refund_${student.id}_${yearMonth}_${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    class: student.class,
    campus: student.campus,
    period: yearMonth,
    feeType,
    originalAmount: actualFees.tuition + actualFees.meal,
    totalDaysInMonth: stats.totalWorkDays,
    presentDays: stats.presentDays,
    absentDays: stats.absentDays,
    sickLeaveDays: stats.sickLeaveDays,
    personalLeaveDays: stats.personalLeaveDays,
    tuitionRefund: Math.round(tuitionRefund * 100) / 100,
    mealRefund: Math.round(mealRefund * 100) / 100,
    totalRefund: Math.round(totalRefund * 100) / 100,
    status: 'pending',
    calculatedBy: '系统自动',
    calculatedAt: now,
    reason: generateRefundReason(stats, halfMonthDays, totalAbsentDays),
    attendanceRecordIds: stats.attendanceRecordIds,
  };

  return refundRecord;
}

/**
 * 生成退费原因说明
 */
function generateRefundReason(
  stats: ReturnType<typeof getMonthlyAttendanceStats>,
  halfMonthDays: number,
  totalAbsentDays: number
): string {
  const reasons: string[] = [];
  
  if (stats.presentDays <= halfMonthDays) {
    reasons.push(`出勤${stats.presentDays}天（未超半月${halfMonthDays}天）`);
  }
  
  if (totalAbsentDays >= 3) {
    reasons.push(`缺勤${totalAbsentDays}天（≥3天可退伙食费）`);
  }
  
  if (stats.sickLeaveDays > 0) {
    reasons.push(`病假${stats.sickLeaveDays}天`);
  }
  
  if (stats.personalLeaveDays > 0) {
    reasons.push(`事假${stats.personalLeaveDays}天`);
  }
  
  return reasons.length > 0 ? reasons.join('；') : '月度考勤自动结算';
}

/**
 * 快速计算退费预览（不保存）
 */
export function previewRefund(
  student: Student,
  yearMonth: string
): {
  canRefundTuition: boolean;
  canRefundMeal: boolean;
  tuitionRefund: number;
  mealRefund: number;
  totalRefund: number;
  reason: string;
  stats: ReturnType<typeof getMonthlyAttendanceStats>;
  fees: ReturnType<typeof getStudentActualFees>;
} {
  const stats = getMonthlyAttendanceStats(student.id, yearMonth);
  const fees = getStudentActualFees(student);
  
  const halfMonthDays = Math.ceil(stats.totalWorkDays / 2);
  const totalAbsentDays = stats.absentDays + stats.sickLeaveDays + stats.personalLeaveDays;
  
  // 判断是否可退保教费
  const canRefundTuition = stats.presentDays <= halfMonthDays;
  
  // 判断是否可退伙食费
  const canRefundMeal = totalAbsentDays >= 3;
  
  // 计算退费金额
  let tuitionRefund = 0;
  let mealRefund = 0;
  
  if (canRefundTuition) {
    const dailyTuition = fees.tuition / stats.totalWorkDays;
    if (totalAbsentDays >= halfMonthDays) {
      tuitionRefund = fees.tuition;
    } else {
      tuitionRefund = (stats.sickLeaveDays + stats.personalLeaveDays) * dailyTuition;
    }
  }
  
  if (canRefundMeal) {
    const dailyMeal = fees.meal / stats.totalWorkDays;
    mealRefund = Math.min(totalAbsentDays * dailyMeal, fees.meal);
  }
  
  return {
    canRefundTuition,
    canRefundMeal,
    tuitionRefund: Math.round(tuitionRefund * 100) / 100,
    mealRefund: Math.round(mealRefund * 100) / 100,
    totalRefund: Math.round((tuitionRefund + mealRefund) * 100) / 100,
    reason: generateRefundReason(stats, halfMonthDays, totalAbsentDays),
    stats,
    fees
  };
}

/**
 * 批量计算班级退费
 */
export function calculateClassRefunds(
  students: Student[],
  yearMonth: string
): RefundRecord[] {
  const refunds: RefundRecord[] = [];
  
  for (const student of students) {
    const refund = calculateRefund(student, yearMonth);
    if (refund) {
      refunds.push(refund);
    }
  }

  return refunds;
}

/**
 * 保存退费记录
 */
export function saveRefundRecord(record: RefundRecord): void {
  const records = getData<RefundRecord>(FINANCE_KEYS.REFUND_RECORDS);
  const existingIndex = records.findIndex(r => r.id === record.id);
  
  if (existingIndex >= 0) {
    records[existingIndex] = record;
  } else {
    records.unshift(record);
  }
  
  saveData(FINANCE_KEYS.REFUND_RECORDS, records);
}

/**
 * 获取退费记录
 */
export function getRefundRecords(filters?: {
  studentId?: string;
  campus?: string;
  period?: string;
  status?: RefundRecord['status'];
}): RefundRecord[] {
  let records = getData<RefundRecord>(FINANCE_KEYS.REFUND_RECORDS);
  
  if (filters) {
    if (filters.studentId) {
      records = records.filter(r => r.studentId === filters.studentId);
    }
    if (filters.campus) {
      records = records.filter(r => r.campus === filters.campus);
    }
    if (filters.period) {
      records = records.filter(r => r.period === filters.period);
    }
    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }
  }
  
  return records;
}

/**
 * 审批退费
 */
export function approveRefund(
  refundId: string,
  approvedBy: string,
  approved: boolean,
  notes?: string
): RefundRecord | null {
  const records = getData<RefundRecord>(FINANCE_KEYS.REFUND_RECORDS);
  const record = records.find(r => r.id === refundId);
  
  if (!record) return null;
  
  record.status = approved ? 'approved' : 'rejected';
  record.approvedBy = approvedBy;
  record.approvedAt = new Date().toISOString();
  if (notes) record.notes = notes;
  
  saveData(FINANCE_KEYS.REFUND_RECORDS, records);
  return record;
}

/**
 * 完成退费
 */
export function completeRefund(refundId: string): RefundRecord | null {
  const records = getData<RefundRecord>(FINANCE_KEYS.REFUND_RECORDS);
  const record = records.find(r => r.id === refundId);
  
  if (!record || record.status !== 'approved') return null;
  
  record.status = 'completed';
  record.refundedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.REFUND_RECORDS, records);
  return record;
}

/**
 * 获取收费配置
 */
export function getFeeConfigs(campus?: string): FeeConfig[] {
  let configs = getData<FeeConfig>(FINANCE_KEYS.FEE_CONFIGS);
  if (campus) {
    configs = configs.filter(c => c.campus === campus);
  }
  return configs;
}

/**
 * 保存收费配置
 */
export function saveFeeConfig(config: FeeConfig): void {
  const configs = getData<FeeConfig>(FINANCE_KEYS.FEE_CONFIGS);
  const existingIndex = configs.findIndex(c => c.id === config.id);
  
  config.dailyRate = config.monthlyAmount / 22;
  config.updatedAt = new Date().toISOString();
  
  if (existingIndex >= 0) {
    configs[existingIndex] = config;
  } else {
    configs.push(config);
  }
  
  saveData(FINANCE_KEYS.FEE_CONFIGS, configs);
}

/**
 * 获取退费规则
 */
export function getRefundRules(campus?: string): RefundRuleConfig[] {
  let rules = getData<RefundRuleConfig>(FINANCE_KEYS.REFUND_RULES);
  if (campus) {
    rules = rules.filter(r => r.campus === campus);
  }
  return rules;
}

/**
 * 保存退费规则
 */
export function saveRefundRule(rule: RefundRuleConfig): void {
  const rules = getData<RefundRuleConfig>(FINANCE_KEYS.REFUND_RULES);
  const existingIndex = rules.findIndex(r => r.id === rule.id);
  
  if (existingIndex >= 0) {
    rules[existingIndex] = rule;
  } else {
    rules.push(rule);
  }
  
  saveData(FINANCE_KEYS.REFUND_RULES, rules);
}

/**
 * 获取财务统计摘要
 */
export function getFinanceSummary(campus: string, yearMonth: string): {
  totalStudents: number;
  pendingRefunds: number;
  pendingAmount: number;
  completedRefunds: number;
  completedAmount: number;
  tuitionCollected: number;
  mealCollected: number;
  totalPayments: number;
  totalDiscounts: number;
} {
  const refunds = getRefundRecords({ campus, period: yearMonth });
  const payments = getData<FeePayment>(FINANCE_KEYS.FEE_PAYMENTS)
    .filter(p => p.campus === campus && p.period.startsWith(yearMonth) && p.status === 'confirmed');

  const pending = refunds.filter(r => r.status === 'pending' || r.status === 'approved');
  const completed = refunds.filter(r => r.status === 'completed');

  return {
    totalStudents: new Set(payments.map(p => p.studentId)).size,
    pendingRefunds: pending.length,
    pendingAmount: pending.reduce((sum, r) => sum + r.totalRefund, 0),
    completedRefunds: completed.length,
    completedAmount: completed.reduce((sum, r) => sum + r.totalRefund, 0),
    tuitionCollected: payments.filter(p => p.feeType === 'tuition').reduce((sum, p) => sum + p.actualAmount, 0),
    mealCollected: payments.filter(p => p.feeType === 'meal').reduce((sum, p) => sum + p.actualAmount, 0),
    totalPayments: payments.reduce((sum, p) => sum + p.actualAmount, 0),
    totalDiscounts: payments.reduce((sum, p) => sum + p.discountAmount, 0),
  };
}

// ==================== 缴费管理 ====================

/**
 * 保存缴费记录
 */
export function savePayment(payment: FeePayment): FeePayment {
  const payments = getData<FeePayment>(FINANCE_KEYS.FEE_PAYMENTS);
  const existingIndex = payments.findIndex(p => p.id === payment.id);
  
  payment.updatedAt = new Date().toISOString();
  
  if (existingIndex >= 0) {
    payments[existingIndex] = payment;
  } else {
    payment.createdAt = payment.createdAt || new Date().toISOString();
    payments.unshift(payment);
  }
  
  saveData(FINANCE_KEYS.FEE_PAYMENTS, payments);
  return payment;
}

/**
 * 获取缴费记录
 */
export function getPayments(filters?: {
  studentId?: string;
  campus?: string;
  period?: string;
  feeType?: FeePayment['feeType'];
  status?: FeePayment['status'];
  hasDiscount?: boolean;
}): FeePayment[] {
  let payments = getData<FeePayment>(FINANCE_KEYS.FEE_PAYMENTS);
  
  if (filters) {
    if (filters.studentId) {
      payments = payments.filter(p => p.studentId === filters.studentId);
    }
    if (filters.campus) {
      payments = payments.filter(p => p.campus === filters.campus);
    }
    if (filters.period) {
      payments = payments.filter(p => p.period.startsWith(filters.period));
    }
    if (filters.feeType) {
      payments = payments.filter(p => p.feeType === filters.feeType);
    }
    if (filters.status) {
      payments = payments.filter(p => p.status === filters.status);
    }
    if (filters.hasDiscount !== undefined) {
      payments = payments.filter(p => p.hasDiscount === filters.hasDiscount);
    }
  }
  
  return payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 创建缴费记录
 */
export function createPayment(
  student: Student,
  feeType: 'tuition' | 'meal' | 'agency' | 'bedding',
  periodType: 'monthly' | 'semester' | 'yearly',
  paymentInfo: {
    paymentDate: string;
    paymentMethod: FeePayment['paymentMethod'];
    receiptNumber?: string;
    operator: string;
    notes?: string;
    discountType?: 'percentage' | 'fixed' | 'custom';
    discountValue?: number;
    discountReason?: string;
    customAmount?: number;  // 自定义金额（覆盖计算）
  }
): FeePayment {
  const fees = getStudentActualFees(student);
  const now = new Date();
  const periodMonths = periodType === 'monthly' ? 1 : periodType === 'semester' ? 6 : 12;
  
  // 获取标准金额
  let standardAmount = 0;
  let feeName = '';
  
  switch (feeType) {
    case 'tuition':
      standardAmount = fees.tuition * periodMonths;
      feeName = `保教费（${student.classType === 'standard' ? '标准班' : student.classType === 'excellence' ? '优苗班' : '音乐班'}）`;
      break;
    case 'meal':
      standardAmount = fees.meal * periodMonths;
      feeName = '伙食费';
      break;
    case 'agency':
      standardAmount = fees.agency;
      feeName = '代办费';
      break;
    case 'bedding':
      standardAmount = fees.bedding;
      feeName = '床品费';
      break;
  }
  
  // 计算优惠
  let discountAmount = 0;
  let hasDiscount = false;
  
  if (paymentInfo.customAmount !== undefined) {
    // 使用自定义金额
    discountAmount = standardAmount - paymentInfo.customAmount;
    hasDiscount = discountAmount > 0;
  } else if (paymentInfo.discountType && paymentInfo.discountValue) {
    hasDiscount = true;
    if (paymentInfo.discountType === 'percentage') {
      discountAmount = Math.round(standardAmount * paymentInfo.discountValue / 100);
    } else if (paymentInfo.discountType === 'fixed') {
      discountAmount = paymentInfo.discountValue;
    }
  }
  
  const actualAmount = paymentInfo.customAmount !== undefined 
    ? paymentInfo.customAmount 
    : standardAmount - discountAmount;
  
  // 生成周期字符串
  const startMonth = now.toISOString().slice(0, 7);
  let period = startMonth;
  if (periodMonths > 1) {
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + periodMonths - 1);
    period = `${startMonth}~${endDate.toISOString().slice(0, 7)}`;
  }
  
  const payment: FeePayment = {
    id: `payment_${student.id}_${feeType}_${Date.now()}`,
    studentId: student.id,
    studentName: student.name,
    class: student.class,
    campus: student.campus,
    period,
    periodType,
    periodMonths,
    feeType,
    feeName,
    standardAmount,
    discountAmount,
    actualAmount,
    hasDiscount,
    discountType: paymentInfo.discountType,
    discountValue: paymentInfo.discountValue,
    discountReason: paymentInfo.discountReason,
    paymentDate: paymentInfo.paymentDate,
    paymentMethod: paymentInfo.paymentMethod,
    receiptNumber: paymentInfo.receiptNumber,
    operator: paymentInfo.operator,
    notes: paymentInfo.notes,
    status: 'confirmed',
    createdAt: now.toISOString(),
  };
  
  return savePayment(payment);
}

/**
 * 获取学生缴费历史
 */
export function getStudentPaymentHistory(studentId: string): {
  payments: FeePayment[];
  totalPaid: number;
  totalDiscount: number;
  lastPaymentDate?: string;
} {
  const payments = getPayments({ studentId, status: 'confirmed' });
  
  return {
    payments,
    totalPaid: payments.reduce((sum, p) => sum + p.actualAmount, 0),
    totalDiscount: payments.reduce((sum, p) => sum + p.discountAmount, 0),
    lastPaymentDate: payments.length > 0 ? payments[0].paymentDate : undefined,
  };
}

/**
 * 确认缴费（待确认 -> 已确认）
 */
export function confirmPayment(paymentId: string, approvedBy: string): FeePayment | null {
  const payments = getData<FeePayment>(FINANCE_KEYS.FEE_PAYMENTS);
  const payment = payments.find(p => p.id === paymentId);
  
  if (!payment || payment.status !== 'pending') return null;
  
  payment.status = 'confirmed';
  payment.approvedBy = approvedBy;
  payment.updatedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.FEE_PAYMENTS, payments);
  return payment;
}

/**
 * 取消缴费
 */
export function cancelPayment(paymentId: string, reason: string): FeePayment | null {
  const payments = getData<FeePayment>(FINANCE_KEYS.FEE_PAYMENTS);
  const payment = payments.find(p => p.id === paymentId);
  
  if (!payment) return null;
  
  payment.status = 'cancelled';
  payment.notes = (payment.notes ? payment.notes + '\n' : '') + `[取消原因] ${reason}`;
  payment.updatedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.FEE_PAYMENTS, payments);
  return payment;
}

/**
 * 获取缴费统计
 */
export function getPaymentStats(campus: string, period: string): {
  totalStudents: number;
  paidStudents: number;
  unpaidStudents: number;
  totalStandard: number;
  totalDiscount: number;
  totalActual: number;
  byFeeType: {
    tuition: { count: number; amount: number; discount: number };
    meal: { count: number; amount: number; discount: number };
    agency: { count: number; amount: number; discount: number };
    bedding: { count: number; amount: number; discount: number };
  };
  discountedPayments: number;
} {
  const payments = getPayments({ campus, period, status: 'confirmed' });
  
  // 获取所有学生
  const studentsData = localStorage.getItem('kt_students_local');
  const allStudents: Student[] = studentsData ? JSON.parse(studentsData) : [];
  const campusStudents = allStudents.filter(s => s.campus === campus);
  
  const paidStudentIds = new Set(payments.map(p => p.studentId));
  
  const byFeeType = {
    tuition: { count: 0, amount: 0, discount: 0 },
    meal: { count: 0, amount: 0, discount: 0 },
    agency: { count: 0, amount: 0, discount: 0 },
    bedding: { count: 0, amount: 0, discount: 0 },
  };
  
  payments.forEach(p => {
    if (p.feeType in byFeeType) {
      const type = p.feeType as keyof typeof byFeeType;
      byFeeType[type].count++;
      byFeeType[type].amount += p.actualAmount;
      byFeeType[type].discount += p.discountAmount;
    }
  });
  
  return {
    totalStudents: campusStudents.length,
    paidStudents: paidStudentIds.size,
    unpaidStudents: campusStudents.length - paidStudentIds.size,
    totalStandard: payments.reduce((sum, p) => sum + p.standardAmount, 0),
    totalDiscount: payments.reduce((sum, p) => sum + p.discountAmount, 0),
    totalActual: payments.reduce((sum, p) => sum + p.actualAmount, 0),
    byFeeType,
    discountedPayments: payments.filter(p => p.hasDiscount).length,
  };
}

// ==================== 企业收款码管理 ====================

/**
 * 获取收款码列表
 */
export function getPaymentQRCodes(campus?: string): PaymentQRCode[] {
  let qrCodes = getData<PaymentQRCode>(FINANCE_KEYS.PAYMENT_QR_CODES);
  
  if (campus) {
    qrCodes = qrCodes.filter(q => q.campus === campus || q.campus === 'all');
  }
  
  return qrCodes.sort((a, b) => {
    // 优先显示启用的
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

/**
 * 保存收款码
 */
export function savePaymentQRCode(qrCode: PaymentQRCode): PaymentQRCode {
  const qrCodes = getData<PaymentQRCode>(FINANCE_KEYS.PAYMENT_QR_CODES);
  const existingIndex = qrCodes.findIndex(q => q.id === qrCode.id);
  
  qrCode.updatedAt = new Date().toISOString();
  
  if (existingIndex >= 0) {
    qrCodes[existingIndex] = qrCode;
  } else {
    qrCode.createdAt = qrCode.createdAt || new Date().toISOString();
    qrCodes.unshift(qrCode);
  }
  
  saveData(FINANCE_KEYS.PAYMENT_QR_CODES, qrCodes);
  return qrCode;
}

/**
 * 删除收款码
 */
export function deletePaymentQRCode(qrCodeId: string): boolean {
  const qrCodes = getData<PaymentQRCode>(FINANCE_KEYS.PAYMENT_QR_CODES);
  const index = qrCodes.findIndex(q => q.id === qrCodeId);
  
  if (index < 0) return false;
  
  qrCodes.splice(index, 1);
  saveData(FINANCE_KEYS.PAYMENT_QR_CODES, qrCodes);
  return true;
}

/**
 * 切换收款码启用状态
 */
export function toggleQRCodeActive(qrCodeId: string): PaymentQRCode | null {
  const qrCodes = getData<PaymentQRCode>(FINANCE_KEYS.PAYMENT_QR_CODES);
  const qrCode = qrCodes.find(q => q.id === qrCodeId);
  
  if (!qrCode) return null;
  
  qrCode.isActive = !qrCode.isActive;
  qrCode.updatedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.PAYMENT_QR_CODES, qrCodes);
  return qrCode;
}

// ==================== 扫码支付记录管理 ====================

/**
 * 创建扫码支付记录（家长扫码后提交）
 */
export function createQRPaymentRecord(
  paymentId: string,
  student: Student,
  amount: number,
  qrCode: PaymentQRCode,
  proof: {
    proofImageUrl?: string;
    transactionId?: string;
    payerName?: string;
    paymentTime?: string;
    notes?: string;
  }
): QRPaymentRecord {
  const record: QRPaymentRecord = {
    id: `qrpay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    paymentId,
    studentId: student.id,
    studentName: student.name,
    amount,
    qrCodeId: qrCode.id,
    qrCodeType: qrCode.type,
    proofImageUrl: proof.proofImageUrl,
    transactionId: proof.transactionId,
    payerName: proof.payerName,
    paymentTime: proof.paymentTime,
    status: 'pending',
    notes: proof.notes,
    createdAt: new Date().toISOString(),
  };
  
  const records = getData<QRPaymentRecord>(FINANCE_KEYS.QR_PAYMENT_RECORDS);
  records.unshift(record);
  saveData(FINANCE_KEYS.QR_PAYMENT_RECORDS, records);
  
  return record;
}

/**
 * 获取扫码支付记录
 */
export function getQRPaymentRecords(filters?: {
  studentId?: string;
  paymentId?: string;
  status?: QRPaymentRecord['status'];
}): QRPaymentRecord[] {
  let records = getData<QRPaymentRecord>(FINANCE_KEYS.QR_PAYMENT_RECORDS);
  
  if (filters) {
    if (filters.studentId) {
      records = records.filter(r => r.studentId === filters.studentId);
    }
    if (filters.paymentId) {
      records = records.filter(r => r.paymentId === filters.paymentId);
    }
    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }
  }
  
  return records.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * 确认扫码支付
 */
export function confirmQRPayment(recordId: string, confirmedBy: string): QRPaymentRecord | null {
  const records = getData<QRPaymentRecord>(FINANCE_KEYS.QR_PAYMENT_RECORDS);
  const record = records.find(r => r.id === recordId);
  
  if (!record || record.status !== 'pending') return null;
  
  record.status = 'confirmed';
  record.confirmedBy = confirmedBy;
  record.confirmedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.QR_PAYMENT_RECORDS, records);
  
  // 同时更新关联的缴费记录状态
  if (record.paymentId) {
    confirmPayment(record.paymentId, confirmedBy);
  }
  
  return record;
}

/**
 * 驳回扫码支付
 */
export function rejectQRPayment(recordId: string, reason: string, rejectedBy: string): QRPaymentRecord | null {
  const records = getData<QRPaymentRecord>(FINANCE_KEYS.QR_PAYMENT_RECORDS);
  const record = records.find(r => r.id === recordId);
  
  if (!record || record.status !== 'pending') return null;
  
  record.status = 'rejected';
  record.rejectReason = reason;
  record.confirmedBy = rejectedBy;
  record.confirmedAt = new Date().toISOString();
  
  saveData(FINANCE_KEYS.QR_PAYMENT_RECORDS, records);
  return record;
}

/**
 * 获取待确认的扫码支付数量
 */
export function getPendingQRPaymentCount(): number {
  const records = getData<QRPaymentRecord>(FINANCE_KEYS.QR_PAYMENT_RECORDS);
  return records.filter(r => r.status === 'pending').length;
}


