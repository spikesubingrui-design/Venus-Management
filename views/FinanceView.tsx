/**
 * 财务管理视图 - 自动关联退费
 * 考勤数据直接关联财务系统，根据规则自动计算保教费/伙食费退费金额
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calculator, DollarSign, Users, Calendar, CheckCircle2, Clock,
  AlertCircle, FileText, Settings, RefreshCw, Download, Filter,
  ChevronDown, ChevronRight, Search, Eye, Check, X, TrendingUp,
  Wallet, Receipt, PiggyBank, ArrowRight, Loader2, Info, Building,
  Tag, Percent, GraduationCap, CreditCard, Plus, UserPlus, QrCode,
  Upload, Image, Trash2, ToggleLeft, ToggleRight, Smartphone
} from 'lucide-react';
import { User, Student, RefundRecord, FeeConfig, RefundRuleConfig, CAMPUS_FEE_STANDARDS_2025, FeePayment, PaymentQRCode, QRPaymentRecord } from '../types';
import {
  initializeFinanceConfigs,
  calculateClassRefunds,
  getRefundRecords,
  saveRefundRecord,
  approveRefund,
  completeRefund,
  getFeeConfigs,
  getRefundRules,
  saveFeeConfig,
  saveRefundRule,
  getFinanceSummary,
  getMonthlyAttendanceStats,
  previewRefund,
  getStudentActualFees,
  getAllCampusFeeStandards,
  createPayment,
  getPayments,
  getPaymentStats,
  cancelPayment,
  getPaymentQRCodes,
  savePaymentQRCode,
  deletePaymentQRCode,
  toggleQRCodeActive,
  getQRPaymentRecords,
  confirmQRPayment,
  rejectQRPayment,
  getPendingQRPaymentCount,
  getStudentsNeedingPayment,
  getOverdueStudents,
  StudentPaymentStatus
} from '../services/financeService';

interface FinanceViewProps {
  currentUser: User;
}

const FinanceView: React.FC<FinanceViewProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<'payments' | 'qrcode' | 'refunds' | 'calculate' | 'standards' | 'settings'>('payments');
  const [students, setStudents] = useState<Student[]>([]);
  const [refundRecords, setRefundRecords] = useState<RefundRecord[]>([]);
  const [feeConfigs, setFeeConfigs] = useState<FeeConfig[]>([]);
  const [refundRules, setRefundRules] = useState<RefundRuleConfig[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [isCalculating, setIsCalculating] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 缴费相关状态
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedStudentForPayment, setSelectedStudentForPayment] = useState<Student | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    // 多选费用类型
    selectedFees: {
      tuition: true,   // 保教费（默认选中）
      meal: true,      // 伙食费（默认选中）
      agency: false,   // 代办费（一次性，新生默认选中）
      bedding: false,  // 床品费（一次性，新生默认选中）
    },
    periodType: 'monthly' as 'monthly' | 'semester' | 'yearly',
    paymentMethod: 'wechat' as FeePayment['paymentMethod'],
    hasDiscount: false,
    discountType: '' as '' | 'percentage' | 'fixed' | 'custom',
    discountValue: 0,
    discountReason: '',
    customAmount: undefined as number | undefined,
    notes: '',
    isNewStudent: false,  // 是否新生（新生自动选中一次性费用）
  });
  
  // 收款码相关状态
  const [qrCodes, setQrCodes] = useState<PaymentQRCode[]>([]);
  const [qrPaymentRecords, setQrPaymentRecords] = useState<QRPaymentRecord[]>([]);
  const [isQRCodeModalOpen, setIsQRCodeModalOpen] = useState(false);
  const [editingQRCode, setEditingQRCode] = useState<PaymentQRCode | null>(null);
  const [qrCodeForm, setQrCodeForm] = useState({
    name: '',
    type: 'wechat' as 'wechat' | 'alipay' | 'bank',
    qrCodeUrl: '',
    accountName: '',
    accountNumber: '',
    description: '',
  });
  const qrCodeInputRef = useRef<HTMLInputElement>(null);
  
  // 需缴费学生状态
  const [paymentStatuses, setPaymentStatuses] = useState<StudentPaymentStatus[]>([]);
  const [overdueStudents, setOverdueStudents] = useState<StudentPaymentStatus[]>([]);
  const [showDueFilter, setShowDueFilter] = useState<'all' | 'due' | 'overdue'>('all');

  const campus = currentUser.campus || '金星第十七幼儿园';

  useEffect(() => {
    loadData();
  }, [selectedMonth]);

  const loadData = () => {
    // 初始化配置
    initializeFinanceConfigs(campus);

    // 超级管理员可以看到所有园区数据
    const isSuperAdmin = currentUser.role === 'SUPER_ADMIN';
    const filterCampus = isSuperAdmin ? undefined : campus;

    // 加载学生
    const savedStudents = localStorage.getItem('kt_students_local');
    if (savedStudents) setStudents(JSON.parse(savedStudents));

    // 加载退费记录
    const records = getRefundRecords({ campus: filterCampus, period: selectedMonth });
    setRefundRecords(records);

    // 加载缴费记录（超级管理员看所有园区）
    const paymentRecords = getPayments({ campus: filterCampus, period: selectedMonth });
    setPayments(paymentRecords);

    // 加载配置
    setFeeConfigs(getFeeConfigs(campus));
    setRefundRules(getRefundRules(campus));
    
    // 加载收款码
    setQrCodes(getPaymentQRCodes(campus));
    setQrPaymentRecords(getQRPaymentRecords());
    
    // 加载需缴费学生状态（超级管理员看所有园区）
    const dueStudents = getStudentsNeedingPayment(filterCampus, selectedMonth);
    setPaymentStatuses(dueStudents);
    const overdue = getOverdueStudents(filterCampus, selectedMonth);
    setOverdueStudents(overdue);
  };

  // 获取班级列表
  const classes = useMemo(() => {
    const classSet = new Set(students.map(s => s.class));
    return Array.from(classSet).sort();
  }, [students]);

  // 过滤后的学生
  const filteredStudents = useMemo(() => {
    let filtered = students;
    if (selectedClass !== 'all') {
      filtered = filtered.filter(s => s.class === selectedClass);
    }
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.includes(searchTerm) || s.class.includes(searchTerm)
      );
    }
    return filtered;
  }, [students, selectedClass, searchTerm]);

  // 财务摘要
  const summary = useMemo(() => {
    return getFinanceSummary(campus, selectedMonth);
  }, [campus, selectedMonth, refundRecords]);

  // 批量计算退费
  const handleBatchCalculate = async () => {
    setIsCalculating(true);
    
    setTimeout(() => {
      const newRefunds = calculateClassRefunds(filteredStudents, selectedMonth);
      
      // 保存新计算的退费记录
      newRefunds.forEach(refund => {
        // 检查是否已存在
        const existing = refundRecords.find(r => 
          r.studentId === refund.studentId && r.period === refund.period
        );
        if (!existing) {
          saveRefundRecord(refund);
        }
      });

      // 重新加载
      const records = getRefundRecords({ campus, period: selectedMonth });
      setRefundRecords(records);
      setIsCalculating(false);
    }, 1000);
  };

  // 审批退费
  const handleApprove = (refundId: string, approved: boolean) => {
    const result = approveRefund(refundId, currentUser.name, approved);
    if (result) {
      setRefundRecords(prev => prev.map(r => r.id === refundId ? result : r));
    }
  };

  // 完成退费
  const handleComplete = (refundId: string) => {
    const result = completeRefund(refundId);
    if (result) {
      setRefundRecords(prev => prev.map(r => r.id === refundId ? result : r));
    }
  };

  // 状态标签样式
  const getStatusStyle = (status: RefundRecord['status']) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700';
      case 'approved': return 'bg-blue-100 text-blue-700';
      case 'rejected': return 'bg-rose-100 text-rose-700';
      case 'completed': return 'bg-emerald-100 text-emerald-700';
    }
  };

  const getStatusText = (status: RefundRecord['status']) => {
    switch (status) {
      case 'pending': return '待审批';
      case 'approved': return '已审批';
      case 'rejected': return '已拒绝';
      case 'completed': return '已退费';
    }
  };

  return (
    <div className="p-6 space-y-6 page-transition">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg">
              <Calculator className="w-6 h-6 text-white" />
            </div>
            收费管理
          </h1>
          <p className="text-slate-500 mt-1 text-sm">综合收费登记，支持一次性缴纳多种费用</p>
        </div>
        
        {/* 月份选择 */}
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">待处理</span>
          </div>
          <p className="text-3xl font-black">{summary.pendingRefunds}</p>
          <p className="text-sm opacity-80 mt-1">¥{summary.pendingAmount.toFixed(2)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle2 className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">已完成</span>
          </div>
          <p className="text-3xl font-black">{summary.completedRefunds}</p>
          <p className="text-sm opacity-80 mt-1">¥{summary.completedAmount.toFixed(2)}</p>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">保教费收入</span>
          </div>
          <p className="text-3xl font-black">¥{(summary.tuitionCollected / 1000).toFixed(1)}k</p>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-5 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-2">
            <PiggyBank className="w-5 h-5 opacity-80" />
            <span className="text-sm font-bold opacity-80">伙食费收入</span>
          </div>
          <p className="text-3xl font-black">¥{(summary.mealCollected / 1000).toFixed(1)}k</p>
        </div>
      </div>

      {/* 标签页 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex border-b border-slate-200 overflow-x-auto">
          {[
            { id: 'payments', label: '收费登记', icon: CreditCard },
            { id: 'qrcode', label: '收款码', icon: QrCode, badge: qrPaymentRecords.filter(r => r.status === 'pending').length },
            { id: 'refunds', label: '退费记录', icon: Receipt },
            { id: 'calculate', label: '批量计算', icon: Calculator },
            { id: 'standards', label: '收费标准', icon: Building },
            { id: 'settings', label: '退费规则', icon: Settings },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {(tab as any).badge > 0 && (
                <span className="px-2 py-0.5 bg-rose-500 text-white rounded-full text-xs animate-pulse">
                  {(tab as any).badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* 收费登记 */}
          {activeTab === 'payments' && (
            <div className="space-y-6">
              {/* 操作栏 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="搜索学生姓名..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm w-64"
                    />
                  </div>
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                  >
                    <option value="all">全部班级</option>
                    {classes.map(cls => (
                      <option key={cls} value={cls}>{cls}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  新建收费
                </button>
              </div>

              {/* 缴费统计卡片 */}
              <div className="grid grid-cols-5 gap-4">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white">
                  <p className="text-sm opacity-80">本月收费</p>
                  <p className="text-2xl font-black">¥{payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.actualAmount, 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white">
                  <p className="text-sm opacity-80">优惠总额</p>
                  <p className="text-2xl font-black">¥{payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + p.discountAmount, 0).toLocaleString()}</p>
                </div>
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl p-4 text-white">
                  <p className="text-sm opacity-80">缴费人次</p>
                  <p className="text-2xl font-black">{payments.filter(p => p.status === 'confirmed').length}</p>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl p-4 text-white">
                  <p className="text-sm opacity-80">享优惠人次</p>
                  <p className="text-2xl font-black">{payments.filter(p => p.hasDiscount && p.status === 'confirmed').length}</p>
                </div>
                {/* 新增：需缴费/逾期提醒 */}
                <div 
                  className={`rounded-xl p-4 text-white cursor-pointer transition-all hover:scale-105 ${
                    overdueStudents.length > 0 
                      ? 'bg-gradient-to-br from-rose-500 to-red-600 animate-pulse' 
                      : paymentStatuses.length > 0 
                        ? 'bg-gradient-to-br from-yellow-500 to-amber-600' 
                        : 'bg-gradient-to-br from-slate-400 to-slate-500'
                  }`}
                  onClick={() => setShowDueFilter(overdueStudents.length > 0 ? 'overdue' : 'due')}
                >
                  <p className="text-sm opacity-80">
                    {overdueStudents.length > 0 ? '逾期未缴' : '待缴费'}
                  </p>
                  <p className="text-2xl font-black">
                    {overdueStudents.length > 0 ? overdueStudents.length : paymentStatuses.length} 人
                  </p>
                </div>
              </div>

              {/* 需缴费学生提示面板 */}
              {(showDueFilter === 'due' || showDueFilter === 'overdue') && paymentStatuses.length > 0 && (
                <div className={`rounded-2xl border-2 p-4 ${
                  showDueFilter === 'overdue' ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className={`w-5 h-5 ${showDueFilter === 'overdue' ? 'text-rose-600' : 'text-amber-600'}`} />
                      <span className={`font-bold ${showDueFilter === 'overdue' ? 'text-rose-800' : 'text-amber-800'}`}>
                        {showDueFilter === 'overdue' ? '逾期未缴费学生' : '本月需缴费学生'} ({selectedMonth})
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDueFilter('due')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          showDueFilter === 'due' ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        待缴费 ({paymentStatuses.length})
                      </button>
                      <button
                        onClick={() => setShowDueFilter('overdue')}
                        className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                          showDueFilter === 'overdue' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600'
                        }`}
                      >
                        逾期 ({overdueStudents.length})
                      </button>
                      <button
                        onClick={() => setShowDueFilter('all')}
                        className="px-3 py-1 rounded-lg text-xs font-bold bg-white text-slate-600 hover:bg-slate-100"
                      >
                        收起
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {(showDueFilter === 'overdue' ? overdueStudents : paymentStatuses)
                      .filter(s => selectedClass === 'all' || s.class === selectedClass)
                      .map(status => (
                      <div 
                        key={status.studentId}
                        className={`bg-white rounded-xl p-3 border cursor-pointer hover:shadow-md transition-all ${
                          status.overdueItems.length > 0 ? 'border-rose-200' : 'border-amber-200'
                        }`}
                        onClick={() => {
                          const student = students.find(s => s.id === status.studentId);
                          if (student) {
                            setSelectedStudentForPayment(student);
                            setIsPaymentModalOpen(true);
                          }
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-800">{status.studentName}</p>
                            <p className="text-xs text-slate-500">{status.class}</p>
                          </div>
                          <div className="text-right">
                            {status.overdueItems.length > 0 ? (
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-xs font-bold">
                                逾期 {status.overdueItems.join('/')}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-bold">
                                待缴
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-slate-500 space-y-1">
                          {status.tuitionStatus !== 'paid' && (
                            <p>
                              <span className="font-medium">保教费：</span>
                              {status.tuitionPaidUntil ? `已缴至${status.tuitionPaidUntil}` : '未缴费'}
                              {status.tuitionDaysOverdue && status.tuitionDaysOverdue > 0 && (
                                <span className="text-rose-600 ml-1">（逾期{status.tuitionDaysOverdue}天）</span>
                              )}
                            </p>
                          )}
                          {status.mealStatus !== 'paid' && (
                            <p>
                              <span className="font-medium">伙食费：</span>
                              {status.mealPaidUntil ? `已缴至${status.mealPaidUntil}` : '未缴费'}
                              {status.mealDaysOverdue && status.mealDaysOverdue > 0 && (
                                <span className="text-rose-600 ml-1">（逾期{status.mealDaysOverdue}天）</span>
                              )}
                            </p>
                          )}
                          {status.lastPeriodType && (
                            <p className="text-slate-400">
                              缴费周期：{status.lastPeriodType === 'monthly' ? '按月' : status.lastPeriodType === 'semester' ? '半年' : '一年'}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 缴费记录列表 */}
              {payments.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-bold">暂无缴费记录</p>
                  <p className="text-sm mt-1">点击"新建收费"开始登记</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payments
                    .filter(p => !searchTerm || p.studentName.includes(searchTerm))
                    .filter(p => selectedClass === 'all' || p.class === selectedClass)
                    .map(payment => (
                    <div 
                      key={payment.id}
                      className={`bg-slate-50 rounded-xl border p-4 ${
                        payment.status === 'cancelled' ? 'border-rose-200 opacity-60' : 'border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            payment.feeType === 'tuition' ? 'bg-blue-100 text-blue-600' :
                            payment.feeType === 'meal' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            <CreditCard className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-800">{payment.studentName}</p>
                            <p className="text-xs text-slate-500">{payment.class} · {payment.feeName}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          {/* 金额详情 */}
                          <div className="text-right">
                            {payment.hasDiscount && (
                              <p className="text-xs text-slate-400 line-through">¥{payment.standardAmount}</p>
                            )}
                            <p className="text-lg font-black text-emerald-600">¥{payment.actualAmount}</p>
                          </div>
                          
                          {/* 优惠标签 */}
                          {payment.hasDiscount && (
                            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                              优惠 ¥{payment.discountAmount}
                            </span>
                          )}
                          
                          {/* 状态 */}
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                            payment.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' :
                            payment.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                          }`}>
                            {payment.status === 'confirmed' ? '已确认' : payment.status === 'pending' ? '待确认' : '已取消'}
                          </span>
                        </div>
                      </div>
                      
                      {/* 详情行 */}
                      <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                        <div className="flex items-center gap-4">
                          <span>周期：{payment.period}</span>
                          <span>支付：{
                            payment.paymentMethod === 'wechat' ? '微信' :
                            payment.paymentMethod === 'alipay' ? '支付宝' :
                            payment.paymentMethod === 'cash' ? '现金' :
                            payment.paymentMethod === 'bank' ? '银行转账' : '其他'
                          }</span>
                          {payment.receiptNumber && <span>收据：{payment.receiptNumber}</span>}
                          <span>经办：{payment.operator}</span>
                        </div>
                        {payment.discountReason && (
                          <span className="text-amber-600">优惠原因：{payment.discountReason}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 收款码管理 */}
          {activeTab === 'qrcode' && (
            <div className="space-y-6">
              {/* 操作栏 */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-800">企业收款码管理</h3>
                  <p className="text-xs text-slate-500">上传微信/支付宝收款二维码，家长扫码支付</p>
                </div>
                <button
                  onClick={() => {
                    setEditingQRCode(null);
                    setQrCodeForm({ name: '', type: 'wechat', qrCodeUrl: '', accountName: '', accountNumber: '', description: '' });
                    setIsQRCodeModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加收款码
                </button>
              </div>

              {/* 收款码列表 */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {qrCodes.length === 0 ? (
                  <div className="col-span-full text-center py-16 text-slate-400">
                    <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="font-bold">暂无收款码</p>
                    <p className="text-sm mt-1">点击"添加收款码"上传企业收款二维码</p>
                  </div>
                ) : (
                  qrCodes.map(qr => (
                    <div 
                      key={qr.id}
                      className={`bg-white rounded-2xl border-2 p-4 transition-all ${
                        qr.isActive ? 'border-emerald-200 shadow-lg shadow-emerald-100' : 'border-slate-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            qr.type === 'wechat' ? 'bg-green-100 text-green-600' :
                            qr.type === 'alipay' ? 'bg-blue-100 text-blue-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {qr.type === 'wechat' ? '微' : qr.type === 'alipay' ? '支' : '银'}
                          </span>
                          <div>
                            <p className="font-bold text-slate-800">{qr.name}</p>
                            <p className="text-xs text-slate-500">
                              {qr.type === 'wechat' ? '微信支付' : qr.type === 'alipay' ? '支付宝' : '银行转账'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const updated = toggleQRCodeActive(qr.id);
                            if (updated) {
                              setQrCodes(prev => prev.map(q => q.id === qr.id ? updated : q));
                            }
                          }}
                          className={`p-1 rounded-lg transition-colors ${
                            qr.isActive ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {qr.isActive ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                        </button>
                      </div>
                      
                      {/* 二维码预览 */}
                      <div className="bg-slate-50 rounded-xl p-4 mb-3 text-center">
                        {qr.qrCodeUrl ? (
                          <img src={qr.qrCodeUrl} alt={qr.name} className="w-32 h-32 mx-auto rounded-lg" />
                        ) : (
                          <div className="w-32 h-32 mx-auto bg-slate-200 rounded-lg flex items-center justify-center">
                            <QrCode className="w-12 h-12 text-slate-400" />
                          </div>
                        )}
                      </div>
                      
                      {qr.accountName && (
                        <p className="text-xs text-slate-500 mb-1">户名：{qr.accountName}</p>
                      )}
                      {qr.description && (
                        <p className="text-xs text-slate-400">{qr.description}</p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setEditingQRCode(qr);
                            setQrCodeForm({
                              name: qr.name,
                              type: qr.type,
                              qrCodeUrl: qr.qrCodeUrl,
                              accountName: qr.accountName || '',
                              accountNumber: qr.accountNumber || '',
                              description: qr.description || '',
                            });
                            setIsQRCodeModalOpen(true);
                          }}
                          className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          编辑
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('确定删除此收款码？')) {
                              deletePaymentQRCode(qr.id);
                              setQrCodes(prev => prev.filter(q => q.id !== qr.id));
                            }
                          }}
                          className="py-2 px-3 text-xs font-bold text-rose-600 bg-rose-50 rounded-lg hover:bg-rose-100 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* 待确认的支付凭证 */}
              {qrPaymentRecords.filter(r => r.status === 'pending').length > 0 && (
                <div className="mt-8">
                  <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-600" />
                    待确认支付凭证
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs">
                      {qrPaymentRecords.filter(r => r.status === 'pending').length}
                    </span>
                  </h4>
                  <div className="space-y-3">
                    {qrPaymentRecords.filter(r => r.status === 'pending').map(record => (
                      <div key={record.id} className="bg-amber-50 rounded-xl border border-amber-200 p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                              <Smartphone className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-800">{record.studentName}</p>
                              <p className="text-xs text-slate-500">
                                {record.qrCodeType === 'wechat' ? '微信支付' : record.qrCodeType === 'alipay' ? '支付宝' : '银行转账'}
                                · ¥{record.amount}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const confirmed = confirmQRPayment(record.id, currentUser.name);
                                if (confirmed) {
                                  setQrPaymentRecords(prev => prev.map(r => r.id === record.id ? confirmed : r));
                                }
                              }}
                              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                            >
                              确认
                            </button>
                            <button
                              onClick={() => {
                                const reason = prompt('请输入驳回原因：');
                                if (reason) {
                                  const rejected = rejectQRPayment(record.id, reason, currentUser.name);
                                  if (rejected) {
                                    setQrPaymentRecords(prev => prev.map(r => r.id === record.id ? rejected : r));
                                  }
                                }
                              }}
                              className="px-3 py-1.5 bg-rose-100 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-200"
                            >
                              驳回
                            </button>
                          </div>
                        </div>
                        {record.proofImageUrl && (
                          <div className="mt-3">
                            <img src={record.proofImageUrl} alt="支付凭证" className="max-w-xs rounded-lg border border-slate-200" />
                          </div>
                        )}
                        {record.transactionId && (
                          <p className="text-xs text-slate-500 mt-2">交易单号：{record.transactionId}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 退费记录 */}
          {activeTab === 'refunds' && (
            <div className="space-y-4">
              {/* 筛选 */}
              <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="搜索学生姓名..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                  />
                </div>
                <select
                  value={selectedClass}
                  onChange={e => setSelectedClass(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-bold"
                >
                  <option value="all">全部班级</option>
                  {classes.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>

              {/* 退费列表 */}
              {refundRecords.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Calculator className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p className="font-bold">暂无退费记录</p>
                  <p className="text-sm mt-1">请先在"批量计算"中计算退费</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {refundRecords
                    .filter(r => !searchTerm || r.studentName.includes(searchTerm))
                    .filter(r => selectedClass === 'all' || r.class === selectedClass)
                    .map(record => (
                    <div 
                      key={record.id}
                      className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden"
                    >
                      {/* 主信息 */}
                      <div 
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors"
                        onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                      >
                        <div className="flex items-center gap-4">
                          {expandedRecord === record.id ? (
                            <ChevronDown className="w-5 h-5 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          )}
                          <div>
                            <p className="font-bold text-slate-800">{record.studentName}</p>
                            <p className="text-xs text-slate-500">{record.class} · {record.period}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-lg font-black text-emerald-600">¥{record.totalRefund.toFixed(2)}</p>
                            <p className="text-xs text-slate-500">
                              保教费 ¥{record.tuitionRefund.toFixed(2)} + 伙食费 ¥{record.mealRefund.toFixed(2)}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusStyle(record.status)}`}>
                            {getStatusText(record.status)}
                          </span>
                        </div>
                      </div>

                      {/* 展开详情 */}
                      {expandedRecord === record.id && (
                        <div className="px-4 pb-4 pt-2 border-t border-slate-200 bg-white">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="text-center p-3 bg-slate-50 rounded-lg">
                              <p className="text-2xl font-black text-slate-700">{record.totalDaysInMonth}</p>
                              <p className="text-xs text-slate-500">当月工作日</p>
                            </div>
                            <div className="text-center p-3 bg-emerald-50 rounded-lg">
                              <p className="text-2xl font-black text-emerald-600">{record.presentDays}</p>
                              <p className="text-xs text-slate-500">出勤天数</p>
                            </div>
                            <div className="text-center p-3 bg-amber-50 rounded-lg">
                              <p className="text-2xl font-black text-amber-600">{record.sickLeaveDays}</p>
                              <p className="text-xs text-slate-500">病假天数</p>
                            </div>
                            <div className="text-center p-3 bg-rose-50 rounded-lg">
                              <p className="text-2xl font-black text-rose-600">{record.personalLeaveDays + record.absentDays}</p>
                              <p className="text-xs text-slate-500">事假/缺勤</p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                            <span>计算人：{record.calculatedBy}</span>
                            <span>计算时间：{new Date(record.calculatedAt).toLocaleString()}</span>
                          </div>

                          {/* 操作按钮 */}
                          {record.status === 'pending' && currentUser.role === 'SUPER_ADMIN' && (
                            <div className="flex gap-3">
                              <button
                                onClick={() => handleApprove(record.id, true)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
                              >
                                <Check className="w-4 h-4" />
                                批准退费
                              </button>
                              <button
                                onClick={() => handleApprove(record.id, false)}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors"
                              >
                                <X className="w-4 h-4" />
                                拒绝
                              </button>
                            </div>
                          )}

                          {record.status === 'approved' && (
                            <button
                              onClick={() => handleComplete(record.id)}
                              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
                            >
                              <DollarSign className="w-4 h-4" />
                              确认已退费
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 批量计算 */}
          {activeTab === 'calculate' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-8 text-white">
                <div className="flex items-start gap-4 mb-6">
                  <div className="p-3 bg-white/10 rounded-xl">
                    <Calculator className="w-8 h-8 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black mb-2">自动退费计算</h3>
                    <p className="text-white/60 text-sm">
                      系统将根据考勤记录自动计算每位学生的退费金额，包括保教费和伙食费
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-3xl font-black text-emerald-400">{filteredStudents.length}</p>
                    <p className="text-white/60 text-sm">待计算学生</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-3xl font-black text-amber-400">{selectedMonth}</p>
                    <p className="text-white/60 text-sm">计算月份</p>
                  </div>
                  <div className="bg-white/5 rounded-xl p-4">
                    <p className="text-3xl font-black text-blue-400">
                      {selectedClass === 'all' ? '全园' : selectedClass}
                    </p>
                    <p className="text-white/60 text-sm">计算范围</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <select
                    value={selectedClass}
                    onChange={e => setSelectedClass(e.target.value)}
                    className="px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white font-bold outline-none"
                  >
                    <option value="all" className="text-slate-800">全部班级</option>
                    {classes.map(cls => (
                      <option key={cls} value={cls} className="text-slate-800">{cls}</option>
                    ))}
                  </select>

                  <button
                    onClick={handleBatchCalculate}
                    disabled={isCalculating}
                    className="flex-1 flex items-center justify-center gap-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-black transition-colors disabled:opacity-50"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        正在计算...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-5 h-5" />
                        开始批量计算
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 计算规则说明（基于2025年9月1日政策） */}
              <div className="bg-amber-50 rounded-2xl p-6 border border-amber-200">
                <h4 className="font-black text-amber-800 mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5" />
                  退费计算规则（2025年9月1日起执行）
                </h4>
                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <p className="font-bold text-amber-700 mb-2">🎓 保教费退费：</p>
                    <ul className="space-y-1 text-amber-600">
                      <li>• 计算当月出勤，<strong>不累计跨月</strong></li>
                      <li>• 出勤超半月（应出勤天数的一半）<strong>不退费</strong></li>
                      <li>• 连续缺勤半月以上可退保教费</li>
                      <li className="text-xs text-amber-500 mt-1">* 半月以当月应出勤天数的一半为准</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-bold text-amber-700 mb-2">🍽️ 伙食费退费：</p>
                    <ul className="space-y-1 text-amber-600">
                      <li>• 当月未出勤 <strong>3天以上</strong> 才退伙食费</li>
                      <li>• 缺勤不足3天<strong>不退</strong></li>
                      <li>• 按实际缺勤天数×日均伙食费计算</li>
                      <li className="text-xs text-amber-500 mt-1">* 杜绝浪费，控制成本，保证伙食质量</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 收费标准（来自2025年秋季收费表） */}
          {activeTab === 'standards' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-emerald-600" />
                  奇德金星教育集团（幼儿园）2025年秋季收费标准
                </h3>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                  2025年7月15日起执行
                </span>
              </div>

              {/* 收费表格 */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="px-4 py-3 text-left font-bold" rowSpan={2}>园所</th>
                      <th className="px-4 py-3 text-center font-bold border-l border-slate-600" colSpan={3}>标准班（一年月额）</th>
                      <th className="px-4 py-3 text-center font-bold border-l border-slate-600" colSpan={3}>优苗班（不足两岁）</th>
                      <th className="px-4 py-3 text-center font-bold border-l border-slate-600" colSpan={3}>音乐班</th>
                      <th className="px-4 py-3 text-center font-bold border-l border-slate-600" rowSpan={2}>代办费</th>
                      <th className="px-4 py-3 text-center font-bold border-l border-slate-600" rowSpan={2}>床品</th>
                    </tr>
                    <tr className="bg-slate-700 text-white text-xs">
                      <th className="px-2 py-2 border-l border-slate-600">保教费</th>
                      <th className="px-2 py-2">伙食费</th>
                      <th className="px-2 py-2">合计</th>
                      <th className="px-2 py-2 border-l border-slate-600">保教费</th>
                      <th className="px-2 py-2">伙食费</th>
                      <th className="px-2 py-2">合计</th>
                      <th className="px-2 py-2 border-l border-slate-600">保教费</th>
                      <th className="px-2 py-2">伙食费</th>
                      <th className="px-2 py-2">合计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CAMPUS_FEE_STANDARDS_2025.map((campus, idx) => (
                      <tr key={campus.campusId} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="px-4 py-3 font-bold text-slate-800">{campus.campusName}</td>
                        {/* 标准班 */}
                        <td className="px-2 py-3 text-center">{campus.standardClass.tuition}</td>
                        <td className="px-2 py-3 text-center">{campus.standardClass.meal}</td>
                        <td className="px-2 py-3 text-center font-bold text-emerald-600">{campus.standardClass.total}</td>
                        {/* 优苗班 */}
                        <td className="px-2 py-3 text-center border-l border-slate-200">
                          {campus.excellenceClass?.tuition || '-'}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {campus.excellenceClass?.meal || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-blue-600">
                          {campus.excellenceClass?.total || '-'}
                        </td>
                        {/* 音乐班 */}
                        <td className="px-2 py-3 text-center border-l border-slate-200">
                          {campus.musicClass?.tuition || '-'}
                        </td>
                        <td className="px-2 py-3 text-center">
                          {campus.musicClass?.meal || '-'}
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-purple-600">
                          {campus.musicClass?.total || '-'}
                        </td>
                        {/* 其他费用 */}
                        <td className="px-2 py-3 text-center border-l border-slate-200">{campus.otherFees.agencyFee}</td>
                        <td className="px-2 py-3 text-center border-l border-slate-200">{campus.otherFees.bedding}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 备注说明 */}
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  收费说明
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>1. <strong>代办费包含：</strong>项项费700（大班400）、书包120、校服280、床品428（外投170+被芯43+行李袋55=268，内芯三件160）</li>
                  <li>2. 本列出的收费项均为此收费区间的收费标准</li>
                  <li>3. 优苗班针对不足两岁的幼儿</li>
                  <li>4. 如有特殊优惠（老生、员工子女等），请在学生管理中设置</li>
                </ul>
              </div>

              {/* 学生优惠类型说明 */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-200">
                <h4 className="font-bold text-amber-800 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  常见优惠类型
                </h4>
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-white rounded-lg p-3">
                    <p className="font-bold text-amber-700">老生优惠</p>
                    <p className="text-amber-600 text-xs">续读学生可享优惠</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="font-bold text-amber-700">员工子女</p>
                    <p className="text-amber-600 text-xs">本园教职工子女优惠</p>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    <p className="font-bold text-amber-700">双胞胎/多胎</p>
                    <p className="text-amber-600 text-xs">多子女同时就读优惠</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 退费规则设置 */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              {/* 政策文件来源 */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
                <h3 className="text-lg font-black mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  退费政策依据
                </h3>
                <p className="text-white/70 text-sm mb-4">
                  以下规则来自《奇德金星幼儿园关于幼儿退费相关规定》及《关于金星各幼儿园调整托费收、退费规定的补充通知》
                </p>
                <span className="px-3 py-1 bg-emerald-600 rounded-full text-xs font-bold">
                  2025年9月1日起执行
                </span>
              </div>

              {/* 保教费退费规则 */}
              <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
                <h4 className="font-bold text-blue-800 mb-4 flex items-center gap-2">
                  <GraduationCap className="w-5 h-5" />
                  保教费退费规则
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-bold text-blue-700 mb-2">核心规则：</p>
                    <ul className="space-y-2 text-blue-600">
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400">①</span>
                        <span>计算当月出勤，<strong>不累计跨月</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400">②</span>
                        <span>幼儿出勤超半月，按月收取<strong>不退费</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-blue-400">③</span>
                        <span>幼儿当月连续缺勤半月以上，<strong>可退保教费</strong></span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-blue-100 rounded-lg p-3">
                    <p className="text-xs text-blue-700">
                      <strong>💡 半月定义：</strong>以当月应出勤天数的一半为准（例如：当月22个工作日，半月=11天）
                    </p>
                  </div>
                </div>
              </div>

              {/* 伙食费退费规则 */}
              <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-200">
                <h4 className="font-bold text-emerald-800 mb-4 flex items-center gap-2">
                  <PiggyBank className="w-5 h-5" />
                  伙食费退费规则
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="bg-white rounded-lg p-4">
                    <p className="font-bold text-emerald-700 mb-2">核心规则：</p>
                    <ul className="space-y-2 text-emerald-600">
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">①</span>
                        <span>当月未出勤 <strong>3天以上</strong>，才退伙食费</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">②</span>
                        <span>缺勤不足3天，<strong>不退伙食费</strong></span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-emerald-400">③</span>
                        <span>退费金额 = 缺勤天数 × 日均伙食费</span>
                      </li>
                    </ul>
                  </div>
                  <div className="bg-emerald-100 rounded-lg p-3">
                    <p className="text-xs text-emerald-700">
                      <strong>💡 政策说明：</strong>后勤保障部根据带量食谱采购食材，因幼儿未出勤造成食物浪费、成本提高。
                      为了杜绝浪费，控制成本，保证伙食质量，故设置3天门槛。
                    </p>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>

      {/* 新建收费弹窗 */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <CreditCard className="w-6 h-6 text-emerald-600" />
                新建收费登记
              </h3>
            </div>
            
            <div className="p-6 space-y-5">
              {/* 选择学生 */}
              {!selectedStudentForPayment ? (
                <div className="space-y-4">
                  <p className="font-bold text-slate-700">选择学生</p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="搜索学生姓名..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="max-h-80 overflow-y-auto space-y-4">
                    {/* 按班级分组显示学生 */}
                    {classes.map(className => {
                      const classStudents = students
                        .filter(s => s.class === className)
                        .filter(s => !searchTerm || s.name.includes(searchTerm));
                      
                      if (classStudents.length === 0) return null;
                      
                      return (
                        <div key={className} className="space-y-2">
                          <div className="sticky top-0 bg-white py-1 z-10">
                            <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                              <Users className="w-3 h-3" />
                              {className}
                              <span className="text-slate-400">({classStudents.length}人)</span>
                            </p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {classStudents.map(student => (
                              <div
                                key={student.id}
                                onClick={() => setSelectedStudentForPayment(student)}
                                className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg cursor-pointer hover:bg-emerald-50 hover:border-emerald-200 border border-transparent transition-colors"
                              >
                                <img src={student.avatar} className="w-8 h-8 rounded-full" />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-800 text-sm truncate">{student.name}</p>
                                  <p className="text-[10px] text-slate-400">{student.gender === '男' ? '男' : '女'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <>
                  {/* 已选学生 */}
                  <div className="flex items-center justify-between bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                    <div className="flex items-center gap-3">
                      <img src={selectedStudentForPayment.avatar} className="w-12 h-12 rounded-full" />
                      <div>
                        <p className="font-bold text-slate-800">{selectedStudentForPayment.name}</p>
                        <p className="text-sm text-slate-500">{selectedStudentForPayment.class} · {selectedStudentForPayment.campus}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedStudentForPayment(null)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* 是否新生 */}
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                    <input
                      type="checkbox"
                      id="isNewStudent"
                      checked={paymentForm.isNewStudent}
                      onChange={e => setPaymentForm(prev => ({
                        ...prev,
                        isNewStudent: e.target.checked,
                        selectedFees: {
                          ...prev.selectedFees,
                          agency: e.target.checked,  // 新生自动选中代办费
                          bedding: e.target.checked, // 新生自动选中床品费
                        }
                      }))}
                      className="w-4 h-4 rounded text-amber-600"
                    />
                    <label htmlFor="isNewStudent" className="text-sm font-bold text-amber-800 cursor-pointer">
                      新生入园（自动包含代办费+床品费）
                    </label>
                  </div>

                  {/* 费用类型 - 多选 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      选择缴费项目
                      <span className="text-xs text-slate-400 font-normal ml-2">可多选</span>
                    </label>
                    
                    {/* 周期性费用 */}
                    <p className="text-xs text-slate-500 mb-2">📅 周期性费用（按月/学期/年缴纳）</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      {[
                        { value: 'tuition', label: '保教费', desc: '每月必缴', icon: GraduationCap, color: 'blue' },
                        { value: 'meal', label: '伙食费', desc: '每月必缴', icon: Receipt, color: 'emerald' },
                      ].map(type => (
                        <label
                          key={type.value}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                            paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]
                              ? type.color === 'blue' ? 'border-blue-500 bg-blue-50' : 'border-emerald-500 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]}
                            onChange={e => setPaymentForm(prev => ({
                              ...prev,
                              selectedFees: { ...prev.selectedFees, [type.value]: e.target.checked }
                            }))}
                            className={`w-4 h-4 rounded ${type.color === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <type.icon className={`w-4 h-4 ${
                                paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees] 
                                  ? type.color === 'blue' ? 'text-blue-600' : 'text-emerald-600'
                                  : 'text-slate-400'
                              }`} />
                              <span className={`text-sm font-bold ${
                                paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]
                                  ? type.color === 'blue' ? 'text-blue-700' : 'text-emerald-700'
                                  : 'text-slate-600'
                              }`}>{type.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{type.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>

                    {/* 一次性费用 */}
                    <p className="text-xs text-slate-500 mb-2">🎁 一次性费用（新生入园时缴纳）</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'agency', label: '代办费', desc: '书本/学习用品', icon: Tag, color: 'purple' },
                        { value: 'bedding', label: '床品费', desc: '床上用品一套', icon: FileText, color: 'amber' },
                      ].map(type => (
                        <label
                          key={type.value}
                          className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-3 ${
                            paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]
                              ? type.color === 'purple' ? 'border-purple-500 bg-purple-50' : 'border-amber-500 bg-amber-50'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]}
                            onChange={e => setPaymentForm(prev => ({
                              ...prev,
                              selectedFees: { ...prev.selectedFees, [type.value]: e.target.checked }
                            }))}
                            className={`w-4 h-4 rounded ${type.color === 'purple' ? 'text-purple-600' : 'text-amber-600'}`}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <type.icon className={`w-4 h-4 ${
                                paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]
                                  ? type.color === 'purple' ? 'text-purple-600' : 'text-amber-600'
                                  : 'text-slate-400'
                              }`} />
                              <span className={`text-sm font-bold ${
                                paymentForm.selectedFees[type.value as keyof typeof paymentForm.selectedFees]
                                  ? type.color === 'purple' ? 'text-purple-700' : 'text-amber-700'
                                  : 'text-slate-600'
                              }`}>{type.label}</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{type.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* 缴费周期 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      缴费周期
                      <span className="text-xs text-slate-400 font-normal ml-2">选择缴费时长</span>
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'monthly', label: '按月缴', months: 1, desc: '每月缴费', icon: '📅', color: 'blue' },
                        { value: 'semester', label: '半年缴', months: 6, desc: '一次缴6个月', icon: '📆', color: 'emerald' },
                        { value: 'yearly', label: '一年缴', months: 12, desc: '一次缴12个月', icon: '🗓️', color: 'purple' },
                      ].map(period => (
                        <button
                          key={period.value}
                          onClick={() => setPaymentForm(prev => ({ ...prev, periodType: period.value as any }))}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            paymentForm.periodType === period.value
                              ? period.color === 'blue' 
                                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100' 
                                : period.color === 'emerald' 
                                  ? 'border-emerald-500 bg-emerald-50 shadow-lg shadow-emerald-100'
                                  : 'border-purple-500 bg-purple-50 shadow-lg shadow-purple-100'
                              : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                          }`}
                        >
                          <span className="text-2xl mb-1 block">{period.icon}</span>
                          <span className={`font-black text-base block ${
                            paymentForm.periodType === period.value 
                              ? period.color === 'blue' ? 'text-blue-700' 
                                : period.color === 'emerald' ? 'text-emerald-700' 
                                : 'text-purple-700'
                              : 'text-slate-700'
                          }`}>
                            {period.label}
                          </span>
                          <p className={`text-xs mt-1 ${
                            paymentForm.periodType === period.value 
                              ? period.color === 'blue' ? 'text-blue-600' 
                                : period.color === 'emerald' ? 'text-emerald-600' 
                                : 'text-purple-600'
                              : 'text-slate-500'
                          }`}>{period.desc}</p>
                          <p className={`text-[10px] mt-0.5 font-bold ${
                            paymentForm.periodType === period.value 
                              ? 'text-slate-500' : 'text-slate-400'
                          }`}>{period.months}个月</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 费用明细与合计 */}
                  {(() => {
                    const fees = getStudentActualFees(selectedStudentForPayment);
                    const months = paymentForm.periodType === 'monthly' ? 1 : paymentForm.periodType === 'semester' ? 6 : 12;
                    
                    // 计算各项费用
                    const feeDetails = {
                      tuition: paymentForm.selectedFees.tuition ? fees.tuition * months : 0,
                      meal: paymentForm.selectedFees.meal ? fees.meal * months : 0,
                      agency: paymentForm.selectedFees.agency ? fees.agency : 0,  // 一次性费用不乘月份
                      bedding: paymentForm.selectedFees.bedding ? fees.bedding : 0, // 一次性费用不乘月份
                    };
                    
                    const standardAmount = feeDetails.tuition + feeDetails.meal + feeDetails.agency + feeDetails.bedding;
                    
                    let discountAmount = 0;
                    if (paymentForm.customAmount !== undefined && paymentForm.customAmount > 0) {
                      discountAmount = standardAmount - paymentForm.customAmount;
                    } else if (paymentForm.discountType === 'percentage' && paymentForm.discountValue > 0) {
                      discountAmount = Math.round(standardAmount * paymentForm.discountValue / 100);
                    } else if (paymentForm.discountType === 'fixed' && paymentForm.discountValue > 0) {
                      discountAmount = paymentForm.discountValue;
                    }
                    const actualAmount = paymentForm.customAmount !== undefined && paymentForm.customAmount > 0
                      ? paymentForm.customAmount
                      : standardAmount - discountAmount;

                    const hasAnyFee = Object.values(paymentForm.selectedFees).some(v => v);

                    return (
                      <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4 border border-slate-200">
                        {/* 费用明细 */}
                        {hasAnyFee ? (
                          <>
                            <p className="text-xs font-bold text-slate-500 mb-3">📋 费用明细</p>
                            <div className="space-y-2 mb-4">
                              {paymentForm.selectedFees.tuition && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-600">保教费 × {months}个月</span>
                                  <span className="font-bold text-blue-600">¥{feeDetails.tuition.toLocaleString()}</span>
                                </div>
                              )}
                              {paymentForm.selectedFees.meal && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-600">伙食费 × {months}个月</span>
                                  <span className="font-bold text-emerald-600">¥{feeDetails.meal.toLocaleString()}</span>
                                </div>
                              )}
                              {paymentForm.selectedFees.agency && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-600">代办费（一次性）</span>
                                  <span className="font-bold text-purple-600">¥{feeDetails.agency.toLocaleString()}</span>
                                </div>
                              )}
                              {paymentForm.selectedFees.bedding && (
                                <div className="flex justify-between items-center text-sm">
                                  <span className="text-slate-600">床品费（一次性）</span>
                                  <span className="font-bold text-amber-600">¥{feeDetails.bedding.toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* 合计与优惠 */}
                            <div className="border-t border-slate-200 pt-3 space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-slate-500">费用合计</span>
                                <span className="font-bold text-slate-700">¥{standardAmount.toLocaleString()}</span>
                              </div>
                              {discountAmount > 0 && (
                                <div className="flex justify-between items-center">
                                  <span className="text-amber-600">优惠金额</span>
                                  <span className="font-bold text-amber-600">-¥{discountAmount.toLocaleString()}</span>
                                </div>
                              )}
                              <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-300">
                                <span className="text-lg font-bold text-emerald-700">应付金额</span>
                                <span className="text-2xl font-black text-emerald-600">¥{actualAmount.toLocaleString()}</span>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-center py-4 text-slate-400">
                            <p className="text-sm">请选择至少一项缴费项目</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 优惠设置 */}
                  <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                    <div className="flex items-center justify-between mb-3">
                      <label className="font-bold text-amber-800 flex items-center gap-2">
                        <Tag className="w-4 h-4" />
                        优惠设置
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={paymentForm.hasDiscount}
                          onChange={e => setPaymentForm(prev => ({ 
                            ...prev, 
                            hasDiscount: e.target.checked,
                            discountType: e.target.checked ? 'fixed' : '',
                            discountValue: 0,
                            customAmount: undefined
                          }))}
                          className="w-4 h-4 rounded text-amber-600"
                        />
                        <span className="text-sm text-amber-700">有优惠</span>
                      </label>
                    </div>
                    
                    {paymentForm.hasDiscount && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { value: 'percentage', label: '百分比' },
                            { value: 'fixed', label: '固定金额' },
                            { value: 'custom', label: '自定义金额' },
                          ].map(type => (
                            <button
                              key={type.value}
                              onClick={() => setPaymentForm(prev => ({ 
                                ...prev, 
                                discountType: type.value as any,
                                discountValue: 0,
                                customAmount: type.value === 'custom' ? 0 : undefined
                              }))}
                              className={`p-2 rounded-lg text-sm font-bold transition-all ${
                                paymentForm.discountType === type.value
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-white text-amber-700 border border-amber-300'
                              }`}
                            >
                              {type.label}
                            </button>
                          ))}
                        </div>
                        
                        {paymentForm.discountType === 'percentage' && (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={paymentForm.discountValue || ''}
                              onChange={e => setPaymentForm(prev => ({ ...prev, discountValue: e.target.value === '' ? 0 : Number(e.target.value) }))}
                              placeholder="优惠百分比"
                              className="flex-1 p-2 bg-white rounded-lg border border-amber-300 outline-none focus:ring-2 focus:ring-amber-500"
                              min="0"
                              max="100"
                            />
                            <span className="text-amber-700 font-bold">%</span>
                          </div>
                        )}
                        
                        {paymentForm.discountType === 'fixed' && (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-bold">¥</span>
                            <input
                              type="number"
                              value={paymentForm.discountValue || ''}
                              onChange={e => setPaymentForm(prev => ({ ...prev, discountValue: e.target.value === '' ? 0 : Number(e.target.value) }))}
                              placeholder="优惠金额"
                              className="flex-1 p-2 bg-white rounded-lg border border-amber-300 outline-none focus:ring-2 focus:ring-amber-500"
                              min="0"
                            />
                          </div>
                        )}
                        
                        {paymentForm.discountType === 'custom' && (
                          <div className="flex items-center gap-2">
                            <span className="text-amber-700 font-bold">实付 ¥</span>
                            <input
                              type="number"
                              value={paymentForm.customAmount || ''}
                              onChange={e => setPaymentForm(prev => ({ ...prev, customAmount: Number(e.target.value) || undefined }))}
                              placeholder="实付金额"
                              className="flex-1 p-2 bg-white rounded-lg border border-amber-300 outline-none focus:ring-2 focus:ring-amber-500"
                              min="0"
                            />
                          </div>
                        )}
                        
                        <input
                          type="text"
                          value={paymentForm.discountReason}
                          onChange={e => setPaymentForm(prev => ({ ...prev, discountReason: e.target.value }))}
                          placeholder="优惠原因：老生优惠、员工子女、双胞胎..."
                          className="w-full p-2 bg-white rounded-lg border border-amber-300 outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                    )}
                  </div>

                  {/* 支付方式 */}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">支付方式</label>
                    <div className="grid grid-cols-5 gap-2">
                      {[
                        { value: 'wechat', label: '微信' },
                        { value: 'alipay', label: '支付宝' },
                        { value: 'cash', label: '现金' },
                        { value: 'bank', label: '银行转账' },
                        { value: 'other', label: '其他' },
                      ].map(method => (
                        <button
                          key={method.value}
                          onClick={() => setPaymentForm(prev => ({ ...prev, paymentMethod: method.value as any }))}
                          className={`p-2 rounded-lg text-sm font-bold transition-all ${
                            paymentForm.paymentMethod === method.value
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 收款码显示区域 - 微信/支付宝时显示 */}
                  {['wechat', 'alipay'].includes(paymentForm.paymentMethod) && (
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200">
                      <p className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                        <QrCode className="w-4 h-4" />
                        请扫描收款码支付
                      </p>
                      {(() => {
                        const matchingQr = qrCodes.find(qr => 
                          qr.type === paymentForm.paymentMethod && qr.isActive
                        );
                        if (matchingQr && matchingQr.qrCodeUrl) {
                          return (
                            <div className="text-center">
                              <div className="inline-block p-3 bg-white rounded-2xl shadow-lg">
                                <img 
                                  src={matchingQr.qrCodeUrl} 
                                  alt="收款码" 
                                  className="w-48 h-48 object-contain"
                                />
                              </div>
                              <p className="mt-3 text-sm font-bold text-emerald-700">{matchingQr.name}</p>
                              {matchingQr.accountName && (
                                <p className="text-xs text-emerald-600 mt-1">账户：{matchingQr.accountName}</p>
                              )}
                              <p className="mt-3 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg inline-block">
                                ⚠️ 请家长扫码支付后，点击下方"确认已收款"按钮
                              </p>
                            </div>
                          );
                        } else {
                          return (
                            <div className="text-center py-6">
                              <QrCode className="w-12 h-12 mx-auto text-slate-300 mb-2" />
                              <p className="text-sm text-slate-500">
                                暂未配置{paymentForm.paymentMethod === 'wechat' ? '微信' : '支付宝'}收款码
                              </p>
                              <p className="text-xs text-slate-400 mt-1">
                                请前往"收款码"页面添加收款二维码
                              </p>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  )}

                  {/* 备注 */}
                  <textarea
                    value={paymentForm.notes}
                    onChange={e => setPaymentForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="备注（选填）"
                    className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    rows={2}
                  />
                </>
              )}
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setSelectedStudentForPayment(null);
                  setSearchTerm('');
                  setPaymentForm({
                    selectedFees: { tuition: true, meal: true, agency: false, bedding: false },
                    periodType: 'monthly',
                    paymentMethod: 'wechat',
                    hasDiscount: false,
                    discountType: '',
                    discountValue: 0,
                    discountReason: '',
                    customAmount: undefined,
                    notes: '',
                    isNewStudent: false,
                  });
                }}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              {selectedStudentForPayment && Object.values(paymentForm.selectedFees).some(v => v) && (
                <button
                  onClick={() => {
                    // 为每个选中的费用类型创建缴费记录
                    const selectedFeeTypes = Object.entries(paymentForm.selectedFees)
                      .filter(([_, selected]) => selected)
                      .map(([type]) => type as 'tuition' | 'meal' | 'agency' | 'bedding');
                    
                    const newPayments: FeePayment[] = [];
                    
                    selectedFeeTypes.forEach(feeType => {
                      const payment = createPayment(
                        selectedStudentForPayment,
                        feeType,
                        paymentForm.periodType,
                        {
                          paymentDate: new Date().toISOString().slice(0, 10),
                          paymentMethod: paymentForm.paymentMethod,
                          operator: currentUser.name,
                          notes: paymentForm.notes + (selectedFeeTypes.length > 1 ? ` [综合缴费-${selectedFeeTypes.length}项]` : ''),
                          // 优惠按比例分摊到各项费用（简化处理：仅应用到周期性费用）
                          discountType: paymentForm.hasDiscount && ['tuition', 'meal'].includes(feeType) && paymentForm.discountType ? paymentForm.discountType as any : undefined,
                          discountValue: paymentForm.hasDiscount && ['tuition', 'meal'].includes(feeType) ? paymentForm.discountValue : undefined,
                          discountReason: paymentForm.hasDiscount && ['tuition', 'meal'].includes(feeType) ? paymentForm.discountReason : undefined,
                        }
                      );
                      newPayments.push(payment);
                    });
                    
                    setPayments(prev => [...newPayments, ...prev]);
                    setIsPaymentModalOpen(false);
                    setSelectedStudentForPayment(null);
                    setSearchTerm('');
                    setPaymentForm({
                      selectedFees: { tuition: true, meal: true, agency: false, bedding: false },
                      periodType: 'monthly',
                      paymentMethod: 'wechat',
                      hasDiscount: false,
                      discountType: '',
                      discountValue: 0,
                      discountReason: '',
                      customAmount: undefined,
                      notes: '',
                      isNewStudent: false,
                    });
                    loadData(); // 刷新数据
                  }}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  {['wechat', 'alipay'].includes(paymentForm.paymentMethod) 
                    ? `确认已收款 (${Object.values(paymentForm.selectedFees).filter(v => v).length}项)`
                    : `确认收费 (${Object.values(paymentForm.selectedFees).filter(v => v).length}项)`
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 收款码管理弹窗 */}
      {isQRCodeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-emerald-600" />
                {editingQRCode ? '编辑收款码' : '添加收款码'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              {/* 收款码名称 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">收款码名称</label>
                <input
                  type="text"
                  value={qrCodeForm.name}
                  onChange={e => setQrCodeForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="如：金星幼儿园微信收款"
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              {/* 收款类型 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">收款类型</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'wechat', label: '微信', color: 'green' },
                    { value: 'alipay', label: '支付宝', color: 'blue' },
                    { value: 'bank', label: '银行', color: 'purple' },
                  ].map(type => (
                    <button
                      key={type.value}
                      onClick={() => setQrCodeForm(prev => ({ ...prev, type: type.value as any }))}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${
                        qrCodeForm.type === type.value
                          ? `border-${type.color}-500 bg-${type.color}-50`
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <span className={`font-bold ${
                        qrCodeForm.type === type.value ? `text-${type.color}-700` : 'text-slate-600'
                      }`}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              
              {/* 上传二维码 */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">收款二维码</label>
                <input
                  ref={qrCodeInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        setQrCodeForm(prev => ({ ...prev, qrCodeUrl: event.target?.result as string }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                <div 
                  onClick={() => qrCodeInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                >
                  {qrCodeForm.qrCodeUrl ? (
                    <img src={qrCodeForm.qrCodeUrl} alt="预览" className="w-40 h-40 mx-auto rounded-lg" />
                  ) : (
                    <>
                      <Upload className="w-10 h-10 mx-auto text-slate-400 mb-2" />
                      <p className="text-sm text-slate-500">点击上传二维码图片</p>
                      <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG 格式</p>
                    </>
                  )}
                </div>
              </div>
              
              {/* 账户信息（可选） */}
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">账户名称（选填）</label>
                <input
                  type="text"
                  value={qrCodeForm.accountName}
                  onChange={e => setQrCodeForm(prev => ({ ...prev, accountName: e.target.value }))}
                  placeholder="收款账户名称"
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">说明（选填）</label>
                <textarea
                  value={qrCodeForm.description}
                  onChange={e => setQrCodeForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="备注说明..."
                  className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  rows={2}
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsQRCodeModalOpen(false);
                  setEditingQRCode(null);
                }}
                className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (!qrCodeForm.name || !qrCodeForm.qrCodeUrl) {
                    alert('请填写名称并上传二维码图片');
                    return;
                  }
                  
                  const qrCode: PaymentQRCode = {
                    id: editingQRCode?.id || `qr_${Date.now()}`,
                    name: qrCodeForm.name,
                    type: qrCodeForm.type,
                    qrCodeUrl: qrCodeForm.qrCodeUrl,
                    accountName: qrCodeForm.accountName,
                    accountNumber: qrCodeForm.accountNumber,
                    campus: campus,
                    isActive: editingQRCode?.isActive ?? true,
                    description: qrCodeForm.description,
                    createdBy: currentUser.name,
                    createdAt: editingQRCode?.createdAt || new Date().toISOString(),
                  };
                  
                  const saved = savePaymentQRCode(qrCode);
                  
                  if (editingQRCode) {
                    setQrCodes(prev => prev.map(q => q.id === saved.id ? saved : q));
                  } else {
                    setQrCodes(prev => [saved, ...prev]);
                  }
                  
                  setIsQRCodeModalOpen(false);
                  setEditingQRCode(null);
                  setQrCodeForm({ name: '', type: 'wechat', qrCodeUrl: '', accountName: '', accountNumber: '', description: '' });
                }}
                className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinanceView;


