
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { LogIn, ShieldCheck, Phone, AlertCircle, UserCircle, Users, UtensilsCrossed, GraduationCap, Loader2, Building2, Lock, Eye, EyeOff, Crown, Cloud, CloudOff, Info, Leaf, TreeDeciduous, Sprout } from 'lucide-react';
import { Logo } from '../App';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { isAliyunConfigured } from '../services/aliyunOssService';
import { useToast } from '../components/Toast';

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

// 预置财务账号
const PRESET_FINANCE = {
  phone: '15936701063',
  password: 'qdjx7777',
  name: '张玉玲',
  role: 'FINANCE' as UserRole,
  campus: '总园'
};

// 默认园区列表（包含总园）
const DEFAULT_CAMPUSES = [
  '总园', '南江', '高新', '新市花园', '创越', 
  '七幼', '八幼', '九幼', '十幼', '十二幼', '十七幼'
];

// 简单的密码哈希函数
const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
};

// 密码强度验证
const validatePassword = (password: string): { valid: boolean; message: string } => {
  if (!password || password.length < 6) {
    return { valid: false, message: '密码至少需要6位' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个英文字母' };
    }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: '密码必须包含至少一个数字' };
  }
  return { valid: true, message: '' };
};

// 可注册的角色
const AVAILABLE_ROLES: { role: UserRole; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  { role: 'ADMIN', label: '园区管理员', icon: Users, desc: '管理本园区所有功能', color: 'text-amber-600 bg-amber-50' },
  { role: 'FINANCE', label: '财务人员', icon: Crown, desc: '收费管理和财务报表', color: 'text-rose-600 bg-rose-50' },
  { role: 'TEACHER', label: '教师', icon: GraduationCap, desc: '考勤、健康、课程等', color: 'text-blue-600 bg-blue-50' },
  { role: 'KITCHEN', label: '厨房人员', icon: UtensilsCrossed, desc: '食谱和采购管理', color: 'text-emerald-600 bg-emerald-50' },
  { role: 'PARENT', label: '家长', icon: UserCircle, desc: '查看孩子信息和通知', color: 'text-purple-600 bg-purple-50' },
];

// 短信云函数配置
const SMS_CONFIG = {
  functionUrl: 'https://venus-gfectwrqon.cn-beijing.fcapp.run',
};

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loginType, setLoginType] = useState<'password' | 'sms'>('password');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordTip, setShowPasswordTip] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const [campuses, setCampuses] = useState<string[]>([]);
  const [campus, setCampus] = useState('');
  const [role, setRole] = useState<UserRole>('TEACHER');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  
  // 验证码相关状态
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    initializeData();
  }, []);
  
  // 验证码倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 初始化数据
  const initializeData = async () => {
    // 加载园区列表
    await loadCampuses();
    
    // 检查阿里云OSS连接状态
    if (isAliyunConfigured) {
      setCloudConnected(true);
      console.log('✅ 阿里云OSS已配置');
    }
    
    // 如果Supabase也配置了，额外检查
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from('users').select('id').limit(1);
        if (!error) {
          setCloudConnected(true);
          console.log('✅ Supabase云端数据库连接成功');
        }
      } catch (err) {
        console.log('❌ Supabase连接失败，使用阿里云OSS');
      }
    }
    
    // 初始化超级管理员
    await initSuperAdmin();
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入正确的11位手机号');
      return;
    }
    
    if (countdown > 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(SMS_CONFIG.functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send', phone }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setCountdown(60);
        toast.success('发送成功', '验证码已发送到您的手机');
      } else {
        setError(result.message || '发送失败，请稍后重试');
      }
    } catch (err) {
      console.error('发送验证码失败:', err);
      setError('网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 验证码登录
  const handleSmsLogin = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入正确的11位手机号');
      return;
    }
    if (!smsCode || smsCode.length !== 6) {
      setError('请输入6位验证码');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // 验证验证码
      const response = await fetch(SMS_CONFIG.functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, code: smsCode }),
      });
      
      const result = await response.json();
      
      if (!result.success) {
        setError(result.message || '验证码错误');
        setLoading(false);
        return;
      }
      
      // 验证成功，检查用户
      const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
      let user = allUsers.find(u => u.phone === phone);
      
      if (!user) {
        // 自动创建用户
        user = {
          id: `user_${Date.now()}`,
          phone,
          name: `用户${phone.slice(-4)}`,
          role: 'TEACHER' as UserRole,
          campus: '总园',
          createdAt: new Date().toISOString(),
        };
        allUsers.push(user);
        localStorage.setItem('kt_all_users', JSON.stringify(allUsers));
      }
      
      toast.success('登录成功', `欢迎，${user.name}！`);
      onLogin(user);
    } catch (err) {
      console.error('验证码登录失败:', err);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 加载园区列表（优先云端）
  const loadCampuses = async () => {
    let campusList = DEFAULT_CAMPUSES;
    
    if (isSupabaseConfigured) {
      try {
        const { data } = await supabase.from('campuses').select('name').eq('is_active', true);
        if (data && data.length > 0) {
          campusList = data.map(c => c.name);
          // 确保总园在列表中
          if (!campusList.includes('总园')) {
            campusList = ['总园', ...campusList];
          }
        }
      } catch (err) {
        console.log('加载云端园区失败，使用默认列表');
      }
    }
    
    // 同步到本地
    localStorage.setItem('kt_campuses', JSON.stringify(campusList));
    setCampuses(campusList);
    if (campusList.length > 0) setCampus(campusList[0]);
  };

  // 初始化超级管理员（云端 + 本地）
  const initSuperAdmin = async () => {
    const passwordHash = hashPassword(SUPER_ADMIN.password);
    
    // 云端初始化
    if (isSupabaseConfigured) {
      try {
        const { data: existing } = await supabase
          .from('users')
          .select('*')
          .eq('phone', SUPER_ADMIN.phone)
          .single();
        
        if (!existing) {
          // 创建超级管理员
          await supabase.from('users').insert({
            phone: SUPER_ADMIN.phone,
            name: SUPER_ADMIN.name,
            password_hash: passwordHash,
            role: SUPER_ADMIN.role,
            campus: SUPER_ADMIN.campus,
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=superadmin`
          });
          console.log('☁️ 云端超级管理员已创建');
        } else if (!existing.password_hash) {
          // 更新密码
          await supabase.from('users')
            .update({ password_hash: passwordHash })
            .eq('phone', SUPER_ADMIN.phone);
        }
      } catch (err) {
        console.log('云端超级管理员初始化失败:', err);
      }
    }
    
    // 本地初始化（作为备份）
    const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    
    const superAdminIndex = allUsers.findIndex(u => u.phone === SUPER_ADMIN.phone);
    
    if (superAdminIndex === -1) {
      allUsers.push({
        id: 'super_admin_1',
        name: SUPER_ADMIN.name,
        phone: SUPER_ADMIN.phone,
        role: SUPER_ADMIN.role,
        campus: SUPER_ADMIN.campus,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=superadmin`
      });
    } else {
      allUsers[superAdminIndex].role = SUPER_ADMIN.role;
      allUsers[superAdminIndex].campus = SUPER_ADMIN.campus;
      }
    
    passwords[SUPER_ADMIN.phone] = passwordHash;
    
    // 初始化预置财务账号
    const financePasswordHash = hashPassword(PRESET_FINANCE.password);
    const financeIndex = allUsers.findIndex(u => u.phone === PRESET_FINANCE.phone);
    
    if (financeIndex === -1) {
      allUsers.push({
        id: 'finance_preset_1',
        name: PRESET_FINANCE.name,
        phone: PRESET_FINANCE.phone,
        role: PRESET_FINANCE.role,
        campus: PRESET_FINANCE.campus,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=zhangyuling`
      });
    } else {
      allUsers[financeIndex].role = PRESET_FINANCE.role;
      allUsers[financeIndex].name = PRESET_FINANCE.name;
    }
    passwords[PRESET_FINANCE.phone] = financePasswordHash;
    
    // 添加到授权手机号
    const authPhones: string[] = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
    if (!authPhones.includes(PRESET_FINANCE.phone)) {
      authPhones.push(PRESET_FINANCE.phone);
      localStorage.setItem('kt_authorized_phones', JSON.stringify(authPhones));
    }
    
    localStorage.setItem('kt_all_users', JSON.stringify(allUsers));
    localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));
  };

  // 检查授权（云端 + 本地）
  const checkAuthorization = async (phoneNumber: string): Promise<boolean> => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // 超级管理员始终有权限
    if (cleanPhone === SUPER_ADMIN.phone) return true;
    
    // 预置财务账号始终有权限
    if (cleanPhone === PRESET_FINANCE.phone) return true;
    
    // 云端检查
    if (isSupabaseConfigured && cloudConnected) {
      try {
        const { data } = await supabase
          .from('authorized_phones')
          .select('*')
          .eq('phone', cleanPhone)
          .single();
        
        if (data) {
          console.log('☁️ 云端授权验证通过');
          return true;
        }
        
        // 检查云端是否有授权记录
        const { count } = await supabase
          .from('authorized_phones')
          .select('*', { count: 'exact', head: true });
        
        // 如果云端没有任何授权记录，允许注册
        if (count === 0) {
          console.log('☁️ 云端无授权限制，允许注册');
          return true;
        }
        
        return false;
      } catch (err) {
        console.log('云端授权检查失败，回退到本地');
      }
    }
    
    // 本地检查
    const authorizedPhones: string[] = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
    const cleanAuthorizedPhones = authorizedPhones.map(p => p.replace(/\D/g, ''));
    
    // 如果本地授权列表为空，允许注册
    if (authorizedPhones.length === 0) return true;
    
    return cleanAuthorizedPhones.includes(cleanPhone);
  };

  // 云端登录
  const cloudLogin = async (phoneNumber: string, passwordHash: string): Promise<User | null> => {
    if (!isSupabaseConfigured || !cloudConnected) return null;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('phone', phoneNumber)
        .eq('password_hash', passwordHash)
        .single();
      
      if (error || !data) return null;
      
      // 更新最后登录时间
      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('phone', phoneNumber);
      
      console.log('☁️ 云端登录成功');
      
      return {
        id: data.id,
        name: data.name,
        phone: data.phone,
        role: data.role,
        campus: data.campus,
        avatar: data.avatar
      };
    } catch (err) {
      console.log('云端登录失败:', err);
      return null;
    }
    };

  // 云端注册
  const cloudRegister = async (userData: User, passwordHash: string): Promise<boolean> => {
    if (!isSupabaseConfigured || !cloudConnected) return false;
    
    try {
      const { error } = await supabase.from('users').insert({
        phone: userData.phone,
        name: userData.name,
        password_hash: passwordHash,
        role: userData.role,
        campus: userData.campus,
        avatar: userData.avatar
      });
      
      if (error) {
        console.log('云端注册失败:', error);
        return false;
      }
      
      // 标记授权手机号已使用
      await supabase
        .from('authorized_phones')
        .update({ is_used: true })
        .eq('phone', userData.phone);
      
      console.log('☁️ 云端注册成功');
      return true;
    } catch (err) {
      console.log('云端注册异常:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setPasswordError(false);
    setLoading(true);

    // 验证手机号
    if (!phone || phone.length !== 11) {
      setError('请输入正确的11位手机号');
      setLoading(false);
      return;
    }

    // 验证密码（登录时只检查基本长度，注册时检查安全标准）
    if (!password || password.length < 6) {
      setError('密码至少需要6位');
      setPasswordError(true);
          setLoading(false);
          return; 
        }

    // 注册时验证密码安全标准
    if (!isLogin) {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.valid) {
        setError(passwordValidation.message);
        setPasswordError(true);
        setLoading(false);
        return;
      }
    }

    const passwordHash = hashPassword(password);

    if (isLogin) {
      // ========== 登录模式 ==========
      
      // 1. 尝试云端登录
      const cloudUser = await cloudLogin(phone, passwordHash);
      if (cloudUser) {
        // 同步到本地
        const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
        const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
        
        const existingIndex = allUsers.findIndex(u => u.phone === phone);
        if (existingIndex === -1) {
          allUsers.push(cloudUser);
      } else {
          allUsers[existingIndex] = cloudUser;
        }
        passwords[phone] = passwordHash;
        
        localStorage.setItem('kt_all_users', JSON.stringify(allUsers));
        localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));
        
        toast.success('登录成功', `欢迎回来，${cloudUser.name}！`);
        onLogin(cloudUser);
        setLoading(false);
        return;
      }
      
      // 2. 本地登录
      const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
      const existingUser = allUsers.find(u => u.phone === phone);
      
      if (!existingUser) {
        toast.error('登录失败', '该手机号未注册，请先注册');
        setError('该手机号未注册，请先注册');
        setLoading(false);
        return;
      }
      
      if (passwords[phone] !== passwordHash) {
        toast.error('登录失败', '密码错误，请重新输入');
        setError('密码错误');
        setLoading(false);
        return;
      }
      
      toast.success('登录成功', `欢迎回来，${existingUser.name}！`);
      onLogin(existingUser);
      
    } else {
      // ========== 注册模式 ==========

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

      // 检查是否已注册
      const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
      if (allUsers.find(u => u.phone === phone)) {
        setError('该手机号已注册，请直接登录');
        setLoading(false);
        return;
      }

      // 检查授权
      const isAuthorized = await checkAuthorization(phone);
      if (!isAuthorized) {
        toast.error('注册失败', '您的手机号未获得授权，请联系管理员');
        setError('您的手机号未获得授权，请联系管理员添加授权后再注册');
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

      // 云端注册
      await cloudRegister(newUser, passwordHash);

      // 本地注册
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
      allUsers.push(newUser);
      passwords[phone] = passwordHash;
      
      localStorage.setItem('kt_all_users', JSON.stringify(allUsers));
      localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));
      
      toast.success('注册成功', `欢迎加入，${newUser.name}！`);
      onLogin(newUser);
    }
    
    setLoading(false);
  };

    return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 md:p-6 relative overflow-hidden"
      style={{ 
        background: 'linear-gradient(135deg, #4a5d3a 0%, #6b7c5c 50%, #8b9d7c 100%)',
      }}
    >
      {/* 装饰性背景图案 */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.3'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
      {/* 装饰性叶子 */}
      <Leaf className="absolute top-10 left-10 w-24 h-24 text-white/10 rotate-45" />
      <TreeDeciduous className="absolute bottom-10 right-10 w-32 h-32 text-white/10" />
      <Sprout className="absolute top-1/4 right-20 w-16 h-16 text-white/10 -rotate-12" />
      
      <div className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden max-h-[95vh] overflow-y-auto relative z-10" style={{ backgroundColor: '#faf8f5' }}>
        {/* 头部 - 深绿色 */}
        <div className="p-8 md:p-12 text-center relative" style={{ backgroundColor: '#3d4a32' }}>
          <Logo size="md" hideText light />
          <p className="text-white/60 text-sm mt-3">自然 · 养育 · 成长</p>
          {/* 云端连接状态 */}
          <div 
            className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold"
            style={{ 
              backgroundColor: cloudConnected ? 'rgba(201, 219, 184, 0.2)' : 'rgba(255,255,255,0.1)',
              color: cloudConnected ? '#c9dbb8' : 'rgba(255,255,255,0.5)'
            }}
          >
            {cloudConnected ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
            {cloudConnected ? '云端已连接' : '离线模式'}
              </div>
          {/* 波浪装饰 */}
          <svg className="absolute bottom-0 left-0 right-0 w-full h-6 translate-y-1" viewBox="0 0 1200 120" preserveAspectRatio="none">
            <path d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z" fill="#faf8f5" />
          </svg>
        </div>
        
        <div className="p-6 md:p-10 space-y-4 md:space-y-6">
          {/* 登录/注册切换 */}
          <div className="flex p-1 rounded-xl" style={{ backgroundColor: '#f5f2ed' }}>
            <button 
              onClick={() => { setIsLogin(true); setError(''); }} 
              className={`flex-1 py-2.5 md:py-3 text-sm font-semibold rounded-lg transition-all ${
                isLogin ? 'shadow' : ''
              }`}
              style={{ 
                backgroundColor: isLogin ? 'white' : 'transparent',
                color: isLogin ? '#4a5d3a' : '#8b7355'
              }}
            >
              登录
            </button>
            <button 
              onClick={() => { setIsLogin(false); setError(''); }} 
              className={`flex-1 py-2.5 md:py-3 text-sm font-semibold rounded-lg transition-all ${
                !isLogin ? 'shadow' : ''
              }`}
              style={{ 
                backgroundColor: !isLogin ? 'white' : 'transparent',
                color: !isLogin ? '#4a5d3a' : '#8b7355'
              }}
            >
              注册
            </button>
          </div>
          
          {/* 登录方式切换（仅登录模式显示） */}
          {isLogin && (
            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => { setLoginType('password'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                  loginType === 'password' 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                密码登录
              </button>
              <button
                type="button"
                onClick={() => { setLoginType('sms'); setError(''); }}
                className={`flex-1 py-2 rounded-lg font-semibold transition-all ${
                  loginType === 'sms' 
                    ? 'bg-amber-100 text-amber-700' 
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                验证码登录
              </button>
            </div>
          )}
          
          {error && (
            <div className="p-4 rounded-xl text-xs font-semibold flex gap-2" style={{ backgroundColor: '#fef2f2', color: '#dc2626' }}>
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          
          <form onSubmit={isLogin && loginType === 'sms' ? (e) => { e.preventDefault(); handleSmsLogin(); } : handleSubmit} className="space-y-3 md:space-y-4" noValidate>
            {!isLogin && (
              <>
                <input 
                  required 
                  placeholder="您的姓名" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full px-4 md:px-5 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base" 
                />
                
                {/* 角色选择 */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 px-2">选择您的角色</p>
                  <div className="grid grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map(r => (
                      <label 
                        key={r.role}
                        className={`p-2.5 md:p-3 rounded-lg md:rounded-xl border-2 cursor-pointer transition-all ${
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
                        <div className="flex items-center gap-1.5 md:gap-2 mb-0.5 md:mb-1">
                          <div className={`p-1 md:p-1.5 rounded-md md:rounded-lg ${r.color}`}>
                            <r.icon className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          </div>
                          <span className="font-bold text-xs md:text-sm text-slate-700">{r.label}</span>
                        </div>
                        <p className="text-[9px] md:text-[10px] text-slate-400 hidden md:block">{r.desc}</p>
                      </label>
                    ))}
                  </div>
                </div>
                
                {/* 园区选择 */}
                {campuses.length > 0 ? (
                  <div className="relative">
                    <Building2 className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                    <select 
                      value={campus} 
                      onChange={e => setCampus(e.target.value)} 
                      className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold appearance-none cursor-pointer text-base"
                    >
                      <option value="">选择所属园区</option>
                      {campuses.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="p-3 md:p-4 bg-amber-50 rounded-xl md:rounded-2xl text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    暂无可选园区，请联系管理员配置
                  </div>
                )}
              </>
            )}
            
            <div className="relative">
              <Phone className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              <input 
                required 
                type="tel" 
                inputMode="numeric"
                placeholder="手机号" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base" 
              />
            </div>
            
            {/* 密码输入（密码登录或注册模式） */}
            {(!isLogin || loginType === 'password') && (
              <div className="relative">
                <Lock className={`absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 ${passwordError ? 'text-rose-400' : 'text-slate-300'}`} />
                  <input 
                    required 
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? "密码" : "设置密码"} 
                  value={password} 
                  onChange={e => { setPassword(e.target.value); setPasswordError(false); }} 
                  className={`w-full pl-12 md:pl-14 pr-20 md:pr-24 py-3 md:py-4 bg-slate-50 border-2 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base ${
                    passwordError ? 'border-rose-400 bg-rose-50' : 'border-slate-100'
                  }`}
                />
                <div className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  {/* 注册时显示密码要求感叹号 */}
                  {!isLogin && (
                    <div className="relative z-50">
                <button 
                  type="button"
                        onClick={() => setShowPasswordTip(!showPasswordTip)}
                        onMouseEnter={() => setShowPasswordTip(true)}
                        onMouseLeave={() => setShowPasswordTip(false)}
                        className={`p-1 rounded-full transition-colors ${passwordError ? 'text-rose-500' : 'text-amber-500 hover:text-amber-600'}`}
                      >
                        <Info className="w-4 h-4" />
                      </button>
                      {/* 密码要求提示框 */}
                      {showPasswordTip && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 p-3 bg-slate-800 text-white text-xs rounded-xl shadow-2xl z-[100]">
                          <p className="font-bold mb-2">密码要求：</p>
                          <ul className="space-y-1">
                            <li className={password.length >= 6 ? 'text-emerald-400' : 'text-slate-400'}>
                              {password.length >= 6 ? '✓' : '○'} 至少6位字符
                            </li>
                            <li className={/[a-zA-Z]/.test(password) ? 'text-emerald-400' : 'text-slate-400'}>
                              {/[a-zA-Z]/.test(password) ? '✓' : '○'} 包含英文字母(a-z)
                            </li>
                            <li className={/[0-9]/.test(password) ? 'text-emerald-400' : 'text-slate-400'}>
                              {/[0-9]/.test(password) ? '✓' : '○'} 包含数字(0-9)
                            </li>
                          </ul>
                          <div className="absolute -bottom-1 right-3 w-2 h-2 bg-slate-800 rotate-45"></div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-slate-400 hover:text-slate-600 p-1"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                </div>
              </div>
            )}
            
            {/* 确认密码（仅注册模式） */}
            {!isLogin && (
              <div className="relative">
                <Lock className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="确认密码" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="w-full pl-12 md:pl-14 pr-4 md:pr-5 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base" 
                />
              </div>
            )}

            {/* 验证码输入（验证码登录模式） */}
            {isLogin && loginType === 'sms' && (
              <div className="relative">
                <ShieldCheck className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required 
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="请输入6位验证码" 
                  value={smsCode} 
                  onChange={e => setSmsCode(e.target.value.replace(/\D/g, ''))} 
                  className="w-full pl-12 md:pl-14 pr-28 md:pr-32 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base" 
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={countdown > 0 || loading}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
                    countdown > 0 || loading
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                >
                  {countdown > 0 ? `${countdown}s` : '获取验证码'}
                </button>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-amber-600 text-white font-bold py-4 md:py-5 rounded-xl md:rounded-2xl shadow-xl shadow-amber-200 hover:bg-amber-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50"
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
            <div className="p-2.5 md:p-3 bg-amber-50 rounded-lg md:rounded-xl flex items-start gap-2">
              <Crown className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700">
                <p className="font-bold">管理员账号</p>
                <p className="mt-1 text-amber-600">手机号: 18513001100</p>
              </div>
            </div>
          )}
          
          <p className="text-center text-[9px] md:text-[10px] text-slate-300 font-bold uppercase tracking-widest pb-2">
            Kidda Education Cloud Platform
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
