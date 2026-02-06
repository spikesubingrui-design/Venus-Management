
import React, { useState, useEffect } from 'react';
import { 
  Shield, UserCheck, AlertTriangle, Flame, Clock, Calendar,
  MapPin, Camera, CheckCircle2, XCircle, Plus, Eye, Search,
  ClipboardCheck, Users, Bell, FileText, QrCode, X, Smartphone,
  Building, Car, Phone, BadgeCheck, History, BarChart3, Filter, Upload
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { User } from '../types';
import { saveAndSync } from '../services/storageService';
import { hasPermission } from '../services/permissionService';
import { logOperation } from '../services/storageService';
import ConfirmUploadModal, { UploadSuccessToast } from '../components/ConfirmUploadModal';
import { ChineseDatePicker, formatChineseDate } from '../components/ChineseDatePicker';

interface SafetyViewProps {
  currentUser: User;
}

// 来访记录类型
interface VisitorRecord {
  id: string;
  name: string;
  idNumber: string;
  phone: string;
  company: string;
  visitPurpose: string;
  visitTarget: string;
  visitTargetDept: string;
  entryTime: string;
  exitTime?: string;
  vehiclePlate?: string;
  photoUrl?: string;
  status: 'in' | 'out';
  createdBy: string;
  notes?: string;
}

// 消防检查记录类型
interface FireInspection {
  id: string;
  date: string;
  inspector: string;
  area: string;
  items: {
    name: string;
    status: 'pass' | 'fail' | 'na';
    notes?: string;
  }[];
  overallStatus: 'pass' | 'fail';
  photos?: string[];
  createdAt: string;
}

// 安防巡视记录类型
interface PatrolRecord {
  id: string;
  date: string;
  patroller: string;
  route: string;
  startTime: string;
  endTime: string;
  checkpoints: {
    name: string;
    time: string;
    status: 'normal' | 'abnormal';
    notes?: string;
  }[];
  issues?: string;
  status: 'completed' | 'in_progress';
}

// 巡视点配置
interface PatrolPoint {
  id: string;
  name: string;
  location: string;
  type: 'indoor' | 'outdoor' | 'gate';
  qrCode: string;
  isActive: boolean;
}

type ViewMode = 'VISITOR' | 'FIRE' | 'PATROL' | 'SETTINGS';

const SafetyView: React.FC<SafetyViewProps> = ({ currentUser }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('VISITOR');
  const [visitors, setVisitors] = useState<VisitorRecord[]>([]);
  const [fireInspections, setFireInspections] = useState<FireInspection[]>([]);
  const [patrols, setPatrols] = useState<PatrolRecord[]>([]);
  const [patrolPoints, setPatrolPoints] = useState<PatrolPoint[]>([]);
  const [isAddVisitorModal, setIsAddVisitorModal] = useState(false);
  const [isAddFireModal, setIsAddFireModal] = useState(false);
  const [isAddPatrolModal, setIsAddPatrolModal] = useState(false);
  const [isAddPointModal, setIsAddPointModal] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<PatrolPoint | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  
  // 确认上传相关状态
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingData, setPendingData] = useState<{ type: 'visitor' | 'fire' | 'patrol' | 'checkout'; data: any } | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    // 加载数据
    const savedVisitors = localStorage.getItem('kt_visitors');
    const savedFire = localStorage.getItem('kt_fire_inspections');
    const savedPatrols = localStorage.getItem('kt_patrols');
    const savedPoints = localStorage.getItem('kt_patrol_points');
    
    if (savedVisitors) setVisitors(JSON.parse(savedVisitors));
    if (savedFire) setFireInspections(JSON.parse(savedFire));
    if (savedPatrols) setPatrols(JSON.parse(savedPatrols));
    if (savedPoints) setPatrolPoints(JSON.parse(savedPoints));
    
    // 不再预填充默认巡视点，由管理员自行配置
  }, []);

  // 统计数据
  const todayVisitors = visitors.filter(v => v.entryTime.startsWith(today));
  const currentlyIn = visitors.filter(v => v.status === 'in');
  const todayInspections = fireInspections.filter(f => f.date === today);
  const todayPatrols = patrols.filter(p => p.date === today);

  // 保存来访记录 - 准备数据并显示确认弹窗
  const saveVisitor = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newVisitor: VisitorRecord = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      idNumber: fd.get('idNumber') as string,
      phone: fd.get('phone') as string,
      company: fd.get('company') as string,
      visitPurpose: fd.get('purpose') as string,
      visitTarget: fd.get('target') as string,
      visitTargetDept: fd.get('targetDept') as string,
      entryTime: new Date().toISOString(),
      vehiclePlate: fd.get('vehicle') as string,
      status: 'in',
      createdBy: currentUser.name,
      notes: fd.get('notes') as string,
    };
    
    setPendingData({ type: 'visitor', data: newVisitor });
    setShowConfirmModal(true);
  };

  // 签出访客 - 显示确认弹窗
  const checkoutVisitor = (id: string) => {
    const visitor = visitors.find(v => v.id === id);
    setPendingData({ type: 'checkout', data: { id, visitor } });
    setShowConfirmModal(true);
  };
  
  // 执行确认上传
  const executeConfirm = () => {
    if (!pendingData) return;
    
    if (pendingData.type === 'visitor') {
      const updated = [pendingData.data, ...visitors];
      setVisitors(updated);
      saveAndSync('kt_visitors', updated);
      
      logOperation(
        currentUser.id, currentUser.name, currentUser.role,
        'CREATE', 'safety', '来访登记',
        pendingData.data.id, pendingData.data.name,
        `登记访客：${pendingData.data.name}`,
        null, pendingData.data
      );
      
      setSuccessMessage('来访登记成功，已电子留存');
      setIsAddVisitorModal(false);
    } else if (pendingData.type === 'checkout') {
      const updated = visitors.map(v => 
        v.id === pendingData.data.id ? { ...v, status: 'out' as const, exitTime: new Date().toISOString() } : v
      );
      setVisitors(updated);
      saveAndSync('kt_visitors', updated);
      
      logOperation(
        currentUser.id, currentUser.name, currentUser.role,
        'UPDATE', 'safety', '访客签出',
        pendingData.data.id, pendingData.data.visitor?.name || '',
        `访客签出：${pendingData.data.visitor?.name}`,
        pendingData.data.visitor, { ...pendingData.data.visitor, status: 'out' }
      );
      
      setSuccessMessage('访客已签出，记录已保存');
    } else if (pendingData.type === 'fire') {
      const updated = [pendingData.data, ...fireInspections];
      setFireInspections(updated);
      saveAndSync('kt_fire_inspections', updated);
      
      logOperation(
        currentUser.id, currentUser.name, currentUser.role,
        'CREATE', 'safety', '消防检查',
        pendingData.data.id, `${pendingData.data.area} - ${pendingData.data.date}`,
        `消防检查：${pendingData.data.area}`,
        null, pendingData.data
      );
      
      setSuccessMessage('消防检查记录已上传');
      setIsAddFireModal(false);
    } else if (pendingData.type === 'patrol') {
      const updated = [pendingData.data, ...patrols];
      setPatrols(updated);
      saveAndSync('kt_patrols', updated);
      
      logOperation(
        currentUser.id, currentUser.name, currentUser.role,
        'CREATE', 'safety', '安防巡视',
        pendingData.data.id, pendingData.data.route,
        `安防巡视：${pendingData.data.route}`,
        null, pendingData.data
      );
      
      setSuccessMessage('巡视记录已上传');
      setIsAddPatrolModal(false);
    }
    
    setShowConfirmModal(false);
    setPendingData(null);
    setShowSuccessToast(true);
  };

  // 保存消防检查 - 准备数据并显示确认弹窗
  const saveFireInspection = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const checkItems = [
      { name: '灭火器', status: fd.get('extinguisher') as 'pass' | 'fail' },
      { name: '消防栓', status: fd.get('hydrant') as 'pass' | 'fail' },
      { name: '疏散通道', status: fd.get('evacuation') as 'pass' | 'fail' },
      { name: '应急灯', status: fd.get('emergencyLight') as 'pass' | 'fail' },
      { name: '消防标识', status: fd.get('fireSign') as 'pass' | 'fail' },
      { name: '电器线路', status: fd.get('electrical') as 'pass' | 'fail' },
    ];
    
    const newInspection: FireInspection = {
      id: Date.now().toString(),
      date: today,
      inspector: fd.get('inspector') as string,
      area: fd.get('area') as string,
      items: checkItems,
      overallStatus: checkItems.every(i => i.status === 'pass') ? 'pass' : 'fail',
      createdAt: new Date().toISOString(),
    };
    
    setPendingData({ type: 'fire', data: newInspection });
    setShowConfirmModal(true);
    setIsAddFireModal(false);
  };

  // 保存巡视记录
  const savePatrol = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const newPatrol: PatrolRecord = {
      id: Date.now().toString(),
      date: today,
      patroller: fd.get('patroller') as string,
      route: fd.get('route') as string,
      startTime: fd.get('startTime') as string,
      endTime: fd.get('endTime') as string,
      checkpoints: patrolPoints.filter(p => p.isActive).map(p => ({
        name: p.name,
        time: new Date().toLocaleTimeString('zh-CN'),
        status: 'normal' as const,
      })),
      issues: fd.get('issues') as string,
      status: 'completed',
    };
    
    const updated = [newPatrol, ...patrols];
    setPatrols(updated);
    saveAndSync('kt_patrols', updated);
    setIsAddPatrolModal(false);
  };

  // 添加巡视点
  const savePatrolPoint = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    
    const newPoint: PatrolPoint = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      location: fd.get('location') as string,
      type: fd.get('type') as 'indoor' | 'outdoor' | 'gate',
      qrCode: `point-${Date.now()}`,
      isActive: true,
    };
    
    const updated = [...patrolPoints, newPoint];
    setPatrolPoints(updated);
    saveAndSync('kt_patrol_points', updated);
    setIsAddPointModal(false);
  };

  // 切换巡视点状态
  const togglePointActive = (id: string) => {
    const updated = patrolPoints.map(p => 
      p.id === id ? { ...p, isActive: !p.isActive } : p
    );
    setPatrolPoints(updated);
    saveAndSync('kt_patrol_points', updated);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题和统计 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Shield className="w-8 h-8 text-blue-600" />
            安全工作
          </h1>
          <p className="text-slate-400 mt-1">来访登记 · 消防安防 · 安全巡视</p>
        </div>
        
        {/* 统计卡片 */}
        <div className="flex gap-3">
          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-400 font-bold">今日来访</p>
            <p className="text-2xl font-black text-blue-600">{todayVisitors.length}</p>
          </div>
          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-400 font-bold">园内访客</p>
            <p className="text-2xl font-black text-amber-600">{currentlyIn.length}</p>
          </div>
          <div className="bg-white px-4 py-3 rounded-2xl border border-slate-100 shadow-sm">
            <p className="text-xs text-slate-400 font-bold">今日巡查</p>
            <p className="text-2xl font-black text-emerald-600">{todayInspections.length + todayPatrols.length}</p>
          </div>
        </div>
      </div>

      {/* 视图切换 */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border border-slate-100 w-fit">
        <button 
          onClick={() => setViewMode('VISITOR')} 
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'VISITOR' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <UserCheck className="w-4 h-4" />来访登记
        </button>
        <button 
          onClick={() => setViewMode('FIRE')} 
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'FIRE' ? 'bg-red-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <Flame className="w-4 h-4" />消防检查
        </button>
        <button 
          onClick={() => setViewMode('PATROL')} 
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'PATROL' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <MapPin className="w-4 h-4" />安防巡视
        </button>
        <button 
          onClick={() => setViewMode('SETTINGS')} 
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'SETTINGS' ? 'bg-slate-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-50'}`}
        >
          <ClipboardCheck className="w-4 h-4" />巡视点设置
        </button>
      </div>

      {/* 来访登记视图 */}
      {viewMode === 'VISITOR' && (
        <div className="space-y-4">
          {/* 工具栏 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input 
                  type="text"
                  placeholder="搜索姓名/单位..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold w-64"
                />
              </div>
              <ChineseDatePicker 
                value={dateFilter}
                onChange={(value) => setDateFilter(value)}
                placeholder="选择日期筛选"
                className="!py-2 text-sm"
              />
            </div>
            <button 
              onClick={() => setIsAddVisitorModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />登记来访
            </button>
          </div>

          {/* 来访列表 */}
          <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">访客信息</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">来访事由</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">被访人</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">入园时间</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">状态</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">操作</th>
                </tr>
              </thead>
              <tbody>
                {visitors
                  .filter(v => v.entryTime.startsWith(dateFilter))
                  .filter(v => !searchTerm || v.name.includes(searchTerm) || v.company.includes(searchTerm))
                  .map(visitor => (
                    <tr key={visitor.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-slate-800">{visitor.name}</p>
                          <p className="text-xs text-slate-400">{visitor.company}</p>
                          <p className="text-xs text-slate-400">{visitor.phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-bold">
                          {visitor.visitPurpose}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-bold text-slate-700">{visitor.visitTarget}</p>
                        <p className="text-xs text-slate-400">{visitor.visitTargetDept}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm text-slate-600">
                          {new Date(visitor.entryTime).toLocaleTimeString('zh-CN')}
                        </p>
                        {visitor.exitTime && (
                          <p className="text-xs text-slate-400">
                            离开: {new Date(visitor.exitTime).toLocaleTimeString('zh-CN')}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {visitor.status === 'in' ? (
                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                            园内
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded-full text-xs font-bold">
                            已离开
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {visitor.status === 'in' && (
                          <button 
                            onClick={() => checkoutVisitor(visitor.id)}
                            className="px-3 py-1 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold hover:bg-amber-100"
                          >
                            签出
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {visitors.filter(v => v.entryTime.startsWith(dateFilter)).length === 0 && (
              <div className="py-12 text-center">
                <UserCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">暂无来访记录</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 消防检查视图 */}
      {viewMode === 'FIRE' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChineseDatePicker 
                value={dateFilter}
                onChange={(value) => setDateFilter(value)}
                placeholder="选择日期筛选"
                className="!py-2 text-sm"
              />
            </div>
            <button 
              onClick={() => setIsAddFireModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />新增检查
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fireInspections
              .filter(f => f.date === dateFilter)
              .map(inspection => (
                <div key={inspection.id} className={`bg-white p-6 rounded-2xl border-2 ${inspection.overallStatus === 'pass' ? 'border-emerald-200' : 'border-red-200'}`}>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800">{inspection.area}</h3>
                      <p className="text-xs text-slate-400">检查人：{inspection.inspector}</p>
                    </div>
                    {inspection.overallStatus === 'pass' ? (
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />合格
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-bold flex items-center gap-1">
                        <XCircle className="w-3 h-3" />不合格
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {inspection.items.map((item, idx) => (
                      <div key={idx} className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 ${
                        item.status === 'pass' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {item.status === 'pass' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {item.name}
                      </div>
                    ))}
                  </div>
                  
                  <p className="text-xs text-slate-400 mt-4">
                    {new Date(inspection.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
          </div>
          
          {fireInspections.filter(f => f.date === dateFilter).length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <Flame className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无消防检查记录</p>
              <button 
                onClick={() => setIsAddFireModal(true)}
                className="text-red-600 font-bold mt-2 hover:underline"
              >
                开始检查
              </button>
            </div>
          )}
        </div>
      )}

      {/* 安防巡视视图 */}
      {viewMode === 'PATROL' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChineseDatePicker 
                value={dateFilter}
                onChange={(value) => setDateFilter(value)}
                placeholder="选择日期筛选"
                className="!py-2 text-sm"
              />
            </div>
            <button 
              onClick={() => setIsAddPatrolModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />记录巡视
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patrols
              .filter(p => p.date === dateFilter)
              .map(patrol => (
                <div key={patrol.id} className="bg-white p-6 rounded-2xl border border-slate-100">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-slate-800">{patrol.route}</h3>
                      <p className="text-xs text-slate-400">巡视人：{patrol.patroller}</p>
                    </div>
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">
                      已完成
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
                    <Clock className="w-4 h-4" />
                    {patrol.startTime} - {patrol.endTime}
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400">巡视点打卡</p>
                    <div className="flex flex-wrap gap-1">
                      {patrol.checkpoints.map((cp, idx) => (
                        <span key={idx} className={`px-2 py-1 rounded text-xs font-bold ${
                          cp.status === 'normal' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                        }`}>
                          {cp.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {patrol.issues && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <p className="text-xs font-bold text-amber-700">发现问题</p>
                      <p className="text-sm text-amber-600">{patrol.issues}</p>
                    </div>
                  )}
                </div>
              ))}
          </div>
          
          {patrols.filter(p => p.date === dateFilter).length === 0 && (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
              <MapPin className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">暂无巡视记录</p>
              <button 
                onClick={() => setIsAddPatrolModal(true)}
                className="text-emerald-600 font-bold mt-2 hover:underline"
              >
                开始巡视
              </button>
            </div>
          )}
        </div>
      )}

      {/* 巡视点设置 */}
      {viewMode === 'SETTINGS' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-600">管理巡视点位，生成二维码供巡视人员扫码打卡</p>
            <button 
              onClick={() => setIsAddPointModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-xl text-sm font-bold hover:bg-slate-700 shadow-lg"
            >
              <Plus className="w-4 h-4" />添加巡视点
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patrolPoints.map(point => (
              <div key={point.id} className={`bg-white p-6 rounded-2xl border-2 ${point.isActive ? 'border-emerald-200' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800">{point.name}</h3>
                    <p className="text-xs text-slate-400">{point.location}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    point.type === 'gate' ? 'bg-blue-100 text-blue-700' :
                    point.type === 'outdoor' ? 'bg-emerald-100 text-emerald-700' :
                    'bg-purple-100 text-purple-700'
                  }`}>
                    {point.type === 'gate' ? '出入口' : point.type === 'outdoor' ? '户外' : '室内'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setSelectedPoint(point); setShowQRCode(true); }}
                    className="flex-1 py-2 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-1"
                  >
                    <QrCode className="w-4 h-4" />查看二维码
                  </button>
                  <button 
                    onClick={() => togglePointActive(point.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold ${
                      point.isActive ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {point.isActive ? '禁用' : '启用'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 来访登记弹窗 */}
      {isAddVisitorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveVisitor} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-6 h-6 text-blue-600" />
              来访登记
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <input required name="name" placeholder="访客姓名 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input name="phone" placeholder="联系电话" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input name="idNumber" placeholder="身份证号" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold col-span-2" />
              <input name="company" placeholder="所属单位" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold col-span-2" />
              <select required name="purpose" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold">
                <option value="">来访事由 *</option>
                <option value="家长来访">家长来访</option>
                <option value="业务洽谈">业务洽谈</option>
                <option value="检查指导">检查指导</option>
                <option value="维修服务">维修服务</option>
                <option value="送货">送货</option>
                <option value="其他">其他</option>
              </select>
              <input name="vehicle" placeholder="车牌号（选填）" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input required name="target" placeholder="被访人 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
              <input name="targetDept" placeholder="被访部门" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold" />
            </div>
            
            <textarea name="notes" placeholder="备注" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-bold resize-none" />

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsAddVisitorModal(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg">确认登记</button>
            </div>
          </form>
        </div>
      )}

      {/* 消防检查弹窗 */}
      {isAddFireModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={saveFireInspection} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Flame className="w-6 h-6 text-red-600" />
              消防检查
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <input required name="inspector" placeholder="检查人 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold" />
              <select required name="area" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-bold">
                <option value="">检查区域 *</option>
                <option value="教学楼">教学楼</option>
                <option value="办公区">办公区</option>
                <option value="厨房">厨房</option>
                <option value="操场">操场</option>
                <option value="门卫室">门卫室</option>
              </select>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm font-bold text-slate-600">检查项目</p>
              {[
                { name: 'extinguisher', label: '灭火器' },
                { name: 'hydrant', label: '消防栓' },
                { name: 'evacuation', label: '疏散通道' },
                { name: 'emergencyLight', label: '应急灯' },
                { name: 'fireSign', label: '消防标识' },
                { name: 'electrical', label: '电器线路' },
              ].map(item => (
                <div key={item.name} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                  <span className="font-bold text-slate-700">{item.label}</span>
                  <div className="flex gap-2">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={item.name} value="pass" defaultChecked className="hidden peer" />
                      <span className="px-3 py-1 bg-slate-100 rounded peer-checked:bg-emerald-500 peer-checked:text-white text-xs font-bold">合格</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={item.name} value="fail" className="hidden peer" />
                      <span className="px-3 py-1 bg-slate-100 rounded peer-checked:bg-red-500 peer-checked:text-white text-xs font-bold">不合格</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsAddFireModal(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg">保存检查</button>
            </div>
          </form>
        </div>
      )}

      {/* 巡视记录弹窗 */}
      {isAddPatrolModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={savePatrol} className="bg-white rounded-3xl p-8 w-full max-w-lg space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-emerald-600" />
              安防巡视记录
            </h2>
            
            <div className="grid grid-cols-2 gap-4">
              <input required name="patroller" placeholder="巡视人 *" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
              <select required name="route" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold">
                <option value="">巡视路线 *</option>
                <option value="常规巡视">常规巡视</option>
                <option value="重点区域">重点区域</option>
                <option value="夜间巡逻">夜间巡逻</option>
              </select>
              <input required name="startTime" type="time" lang="zh-CN" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
              <input required name="endTime" type="time" lang="zh-CN" className="p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold" />
            </div>
            
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-xs font-bold text-slate-400 mb-2">巡视点位（{patrolPoints.filter(p => p.isActive).length}个）</p>
              <div className="flex flex-wrap gap-2">
                {patrolPoints.filter(p => p.isActive).map(p => (
                  <span key={p.id} className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold">
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
            
            <textarea name="issues" placeholder="发现问题（选填）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold resize-none" />

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsAddPatrolModal(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-bold shadow-lg">保存记录</button>
            </div>
          </form>
        </div>
      )}

      {/* 添加巡视点弹窗 */}
      {isAddPointModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={savePatrolPoint} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <MapPin className="w-6 h-6 text-slate-600" />
              添加巡视点
            </h2>
            
            <div className="space-y-4">
              <input required name="name" placeholder="巡视点名称 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-slate-500 font-bold" />
              <input required name="location" placeholder="位置描述 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-slate-500 font-bold" />
              <select required name="type" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-slate-500 font-bold">
                <option value="indoor">室内</option>
                <option value="outdoor">户外</option>
                <option value="gate">出入口</option>
              </select>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsAddPointModal(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-slate-600 text-white rounded-xl font-bold shadow-lg">添加</button>
            </div>
          </form>
        </div>
      )}

      {/* 二维码弹窗 */}
      {showQRCode && selectedPoint && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md text-center animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <QrCode className="w-6 h-6 text-blue-600" />
                巡视点二维码
              </h2>
              <button onClick={() => { setShowQRCode(false); setSelectedPoint(null); }} className="p-2 hover:bg-slate-100 rounded-xl">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl inline-block mb-4">
              <QRCodeSVG 
                value={`${window.location.origin}/patrol-checkin?point=${selectedPoint.id}&name=${encodeURIComponent(selectedPoint.name)}`}
                size={200}
                level="H"
                includeMargin
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-2">
              <p className="text-lg font-bold text-slate-800">{selectedPoint.name}</p>
              <p className="text-sm text-slate-400">{selectedPoint.location}</p>
              <p className="text-xs text-slate-300 mt-4">
                巡视人员扫码打卡
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 确认上传弹窗 */}
      {showConfirmModal && pendingData && (
        <ConfirmUploadModal
          isOpen={showConfirmModal}
          onConfirm={executeConfirm}
          onCancel={() => { setShowConfirmModal(false); setPendingData(null); }}
          title={
            pendingData.type === 'visitor' ? pendingData.data.name :
            pendingData.type === 'checkout' ? `${pendingData.data.visitor?.name} 签出` :
            pendingData.type === 'fire' ? `消防检查 - ${pendingData.data.area}` :
            pendingData.type === 'patrol' ? pendingData.data.route : '安全记录'
          }
          type={
            pendingData.type === 'visitor' ? '来访登记' :
            pendingData.type === 'checkout' ? '访客签出' :
            pendingData.type === 'fire' ? '消防检查' : '安防巡视'
          }
          summary={
            pendingData.type === 'visitor' ? `登记访客：${pendingData.data.name}，来自${pendingData.data.company}` :
            pendingData.type === 'checkout' ? `确认访客 ${pendingData.data.visitor?.name} 离开，记录签出时间` :
            pendingData.type === 'fire' ? `提交${pendingData.data.area}的消防检查记录` :
            `提交安防巡视记录`
          }
          details={
            pendingData.type === 'visitor' ? [
              { label: '访客姓名', value: pendingData.data.name },
              { label: '来访单位', value: pendingData.data.company },
              { label: '访问目的', value: pendingData.data.visitPurpose },
              { label: '拜访对象', value: pendingData.data.visitTarget },
            ] :
            pendingData.type === 'fire' ? [
              { label: '检查区域', value: pendingData.data.area },
              { label: '检查人', value: pendingData.data.inspector },
              { label: '检查日期', value: pendingData.data.date },
              { label: '整体状态', value: pendingData.data.overallStatus === 'pass' ? '✓ 合格' : '✗ 不合格' },
            ] : []
          }
          isUpdate={pendingData.type === 'checkout'}
        />
      )}
      
      {/* 成功提示 */}
      {showSuccessToast && (
        <UploadSuccessToast 
          message={successMessage} 
          onClose={() => setShowSuccessToast(false)} 
        />
      )}
    </div>
  );
};

export default SafetyView;

