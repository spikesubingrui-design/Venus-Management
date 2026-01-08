
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { LogIn, ShieldCheck, Phone, AlertCircle, UserCircle, Users, UtensilsCrossed, GraduationCap, Loader2, Building2, Lock, Eye, EyeOff, Crown } from 'lucide-react';
import { Logo } from '../App';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface AuthViewProps {
  onLogin: (user: User) => void;
}

// 主管理账号（超级管理员）
const SUPER_ADMIN = {
  phone: '18513001100',
  password: 'su123789',
  name: '系统管理员',
  role: 'SUPER_ADMIN' as UserRole,
  campus: '总园'
};

// 默认园区列表（包含总园）
const DEFAULT_CAMPUSES = [
  '总园', '南江', '高新', '新市花园', '创越', 
  '七幼', '八幼', '九幼', '十幼', '十二幼', '十七幼'
];

// 可配置的园区列表（从localStorage或配置文件读取）
const getConfiguredCampuses = (): string[] => {
  const saved = localStorage.getItem('kt_campuses');
  if (saved) {
    const parsed = JSON.parse(saved);
    // 确保总园在列表中
    if (!parsed.includes('总园')) {
      const updated = ['总园', ...parsed];
      localStorage.setItem('kt_campuses', JSON.stringify(updated));
      return updated;
    }
    return parsed;
  }
  // 默认园区列表
  localStorage.setItem('kt_campuses', JSON.stringify(DEFAULT_CAMPUSES));
  return DEFAULT_CAMPUSES;
};

// 可注册的角色
const AVAILABLE_ROLES: { role: UserRole; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { role: 'ADMIN', label: '园区管理员', icon: Users, desc: '管理本园区所有功能', color: 'text-amber-600 bg-amber-50' },
  { role: 'TEACHER', label: '教师', icon: GraduationCap, desc: '考勤、健康、课程等', color: 'text-blue-600 bg-blue-50' },
  { role: 'KITCHEN', label: '厨房人员', icon: UtensilsCrossed, desc: '食谱和采购管理', color: 'text-emerald-600 bg-emerald-50' },
  { role: 'PARENT', label: '家长', icon: UserCircle, desc: '查看孩子信息和通知', color: 'text-purple-600 bg-purple-50' },
];

// 简单的密码哈希函数（生产环境应使用更安全的方案）
const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
};

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [campuses, setCampuses] = useState<string[]>([]);
  const [campus, setCampus] = useState('');
  const [role, setRole] = useState<UserRole>('TEACHER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = getConfiguredCampuses();
    setCampuses(saved);
    if (saved.length > 0) setCampus(saved[0]);
    
    // 初始化超级管理员账号（如果不存在）
    initSuperAdmin();
  }, []);

  // 初始化超级管理员
  const initSuperAdmin = () => {
    const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    
    // 检查超级管理员是否存在
    const superAdminIndex = allUsers.findIndex(u => u.phone === SUPER_ADMIN.phone);
    
    if (superAdminIndex === -1) {
      // 不存在则创建
      const superAdmin: User = {
        id: 'super_admin_1',
        name: SUPER_ADMIN.name,
        phone: SUPER_ADMIN.phone,
        role: SUPER_ADMIN.role,
        campus: SUPER_ADMIN.campus,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=superadmin`
      };
      allUsers.push(superAdmin);
      console.log('超级管理员账号已创建');
    } else {
      // 存在则更新角色为超级管理员
      allUsers[superAdminIndex].role = SUPER_ADMIN.role;
      allUsers[superAdminIndex].campus = SUPER_ADMIN.campus;
    }
    
    // 总是设置/更新超级管理员密码
    passwords[SUPER_ADMIN.phone] = hashPassword(SUPER_ADMIN.password);
    
    localStorage.setItem('kt_all_users', JSON.stringify(allUsers));
    localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));
    
    console.log('超级管理员密码已设置:', SUPER_ADMIN.phone);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // 验证手机号
    if (!phone || phone.length !== 11) {
      setError('请输入正确的11位手机号');
      setLoading(false);
      return;
    }

    // 验证密码
    if (!password || password.length < 6) {
      setError('密码至少需要6位');
      setLoading(false);
      return;
    }

    // 获取本地用户和密码
    const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    const existingUser = allUsers.find(u => u.phone === phone);

    if (isLogin) {
      // 登录模式
      if (!existingUser) {
        setError('该手机号未注册，请先注册');
        setLoading(false);
        return;
      }

      // 验证密码
      const storedHash = passwords[phone];
      const inputHash = hashPassword(password);
      
      if (storedHash !== inputHash) {
        setError('密码错误');
        setLoading(false);
        return;
      }

      // 尝试云端认证
      if (isSupabaseConfigured) {
        try {
          const { data } = await supabase.from('users').select('*').eq('phone', phone).single();
          if (data) { 
            onLogin(data); 
            setLoading(false);
            return; 
          }
        } catch (err) { 
          console.log('Cloud auth not available, using local storage'); 
        }
      }

      onLogin(existingUser);
    } else {
      // 注册模式
      if (existingUser) {
        setError('该手机号已注册，请直接登录');
        setLoading(false);
        return;
      }

      if (!name.trim()) {
        setError('请输入姓名');
        setLoading(false);
        return;
      }

      if (!campus) {
        setError('请选择所属园区');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setLoading(false);
        return;
      }

      // 检查授权（可选功能）
      const authorizedPhones: string[] = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
      if (authorizedPhones.length > 0 && !authorizedPhones.includes(phone)) {
        setError('您的手机号未获得授权，请联系管理员');
        setLoading(false);
        return;
      }

      const newUser: User = {
        id: Date.now().toString(),
        name: name.trim(),
        phone,
        role,
        campus,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`
      };

      // 保存新用户和密码
      const updatedUsers = [...allUsers, newUser];
      const updatedPasswords = { ...passwords, [phone]: hashPassword(password) };
      
      localStorage.setItem('kt_all_users', JSON.stringify(updatedUsers));
      localStorage.setItem('kt_user_passwords', JSON.stringify(updatedPasswords));
      
      onLogin(newUser);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl overflow-hidden">
        <div className="bg-slate-800 p-12 text-center">
          <Logo size="lg" hideText light />
        </div>
        <div className="p-10 space-y-6">
          <div className="flex p-1 bg-slate-50 rounded-2xl">
            <button 
              onClick={() => { setIsLogin(true); setError(''); }} 
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isLogin ? 'bg-white shadow text-amber-700' : 'text-slate-400'}`}
            >
              登录
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); }} 
              className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isLogin ? 'bg-white shadow text-amber-700' : 'text-slate-400'}`}
            >
              注册
            </button>
          </div>
          
          {error && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-bold flex gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {!isLogin && (
              <>
                <input 
                  required 
                  placeholder="您的姓名" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" 
                />
                
                {/* 角色选择 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 px-2">选择您的角色</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map(r => (
                      <label 
                        key={r.role}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          role === r.role 
                            ? 'border-amber-500 bg-amber-50' 
                            : 'border-slate-100 hover:border-slate-200'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="role" 
                          value={r.role} 
                          checked={role === r.role}
                          onChange={() => setRole(r.role)}
                          className="hidden"
                        />
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`p-1.5 rounded-lg ${r.color}`}>
                            <r.icon className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm text-slate-700">{r.label}</span>
                        </div>
                        <p className="text-[10px] text-slate-400">{r.desc}</p>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* 园区选择 */}
                {campuses.length > 0 ? (
                  <div className="relative">
                    <Building2 className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <select 
                      value={campus} 
                      onChange={e => setCampus(e.target.value)} 
                      className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold appearance-none cursor-pointer"
                    >
                      <option value="">选择所属园区</option>
                      {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-50 rounded-2xl text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    暂无可选园区，请联系管理员配置
                  </div>
                )}
              </>
            )}
            
            <div className="relative">
              <Phone className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                required 
                type="tel" 
                placeholder="手机号" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" 
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                required 
                type={showPassword ? 'text' : 'password'}
                placeholder="密码" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="w-full pl-14 pr-12 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" 
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="确认密码" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full pl-14 pr-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:border-amber-500 font-bold" 
                />
              </div>
            )}

            {/* 验证码登录提示（开发中） */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-2 text-slate-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-xs">验证码登录功能开发中...</span>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-600 text-white font-bold py-5 rounded-2xl shadow-xl shadow-amber-200 hover:bg-amber-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5" />
              )}
              {isLogin ? '登录' : '注册'}
            </button>
          </form>

          {/* 管理员提示 */}
          {isLogin && (
            <div className="p-3 bg-amber-50 rounded-xl flex items-start gap-2">
              <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-bold">管理员账号</p>
                <p className="mt-1 text-amber-600">手机号: 18513001100</p>
              </div>
            </div>
          )}
          
          <p className="text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">
            Kidda Education Cloud Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
