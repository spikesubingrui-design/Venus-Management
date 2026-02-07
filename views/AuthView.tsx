
import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { LogIn, ShieldCheck, Phone, AlertCircle, Loader2, Lock, Eye, EyeOff, Crown, Cloud, CloudOff, Leaf, TreeDeciduous, Sprout } from 'lucide-react';
import { Logo } from '../App';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { isAliyunConfigured } from '../services/aliyunOssService';
import { useToast } from '../components/Toast';
import { saveAndSync } from '../services/storageService';

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

// 简单的密码哈希函数（与小程序保持一致）
const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
};

// 短信云函数配置
const SMS_CONFIG = {
  functionUrl: 'https://venus-gfectwrqon.cn-beijing.fcapp.run',
};

const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const toast = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [loginType, setLoginType] = useState<'password' | 'sms'>('password');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [cloudConnected, setCloudConnected] = useState(false);
  
  // 验证码相关状态
  const [smsCode, setSmsCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  // 设置密码弹窗（验证码登录后首次设置）
  const [showSetPasswordModal, setShowSetPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [pendingUser, setPendingUser] = useState<User | null>(null);

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

  // 从教职工名单/授权名单获取用户信息（与小程序一致）
  const getUserInfoFromStaff = (phoneNumber: string): Partial<User> => {
    // 从教职工名单查找
    const staffList: any[] = JSON.parse(localStorage.getItem('kt_staff') || '[]');
    const staffInfo = staffList.find((s: any) => s.phone === phoneNumber);

    // 从授权名单查找
    const authorizedPhonesRaw: any[] = JSON.parse(localStorage.getItem('kt_authorized_phones') || '[]');
    const authInfo = authorizedPhonesRaw.find((p: any) => typeof p === 'object' ? p.phone === phoneNumber : p === phoneNumber);

    let assignedClasses: string[] = staffInfo?.assignedClasses || [];
    if (typeof authInfo === 'object' && authInfo?.assignedClass && !assignedClasses.includes(authInfo.assignedClass)) {
      assignedClasses = [...assignedClasses, authInfo.assignedClass];
    }

    return {
      name: staffInfo?.name || (typeof authInfo === 'object' ? authInfo?.name : '') || `用户${phoneNumber.slice(-4)}`,
      role: (staffInfo?.role || (typeof authInfo === 'object' ? authInfo?.role : '') || 'TEACHER') as UserRole,
      campus: staffInfo?.campus || (typeof authInfo === 'object' ? authInfo?.campus : '') || '十七幼',
      assignedClasses,
    };
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

  // 验证码验证通用函数
  const verifySmsCode = async (): Promise<boolean> => {
    try {
      const response = await fetch(SMS_CONFIG.functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', phone, code: smsCode }),
      });
      const result = await response.json();
      if (!result.success) {
        setError(result.message || '验证码错误');
        return false;
      }
      return true;
    } catch (err) {
      setError('验证失败，请稍后重试');
      return false;
    }
  };

  // 确保用户记录存在（验证码登录 & 注册共用逻辑）
  const ensureUserExists = (phoneNumber: string): User => {
    const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
    let user = allUsers.find(u => u.phone === phoneNumber);

    if (!user) {
      const info = getUserInfoFromStaff(phoneNumber);
      user = {
        id: `user_${phoneNumber}`,
        phone: phoneNumber,
        name: info.name || `用户${phoneNumber.slice(-4)}`,
        role: info.role || 'TEACHER' as UserRole,
        campus: info.campus || '十七幼',
        assignedClasses: info.assignedClasses || [],
        createdAt: new Date().toISOString(),
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${info.name || phoneNumber}`
      };
      allUsers.push(user);
      saveAndSync('kt_all_users', allUsers);
    } else {
      // 更新教职工信息（以名单为准）
      const info = getUserInfoFromStaff(phoneNumber);
      if (info.name && info.name !== `用户${phoneNumber.slice(-4)}`) {
        user.name = info.name;
        user.role = info.role || user.role;
        user.campus = info.campus || user.campus;
        user.assignedClasses = (info.assignedClasses && info.assignedClasses.length > 0) ? info.assignedClasses : user.assignedClasses;
        const idx = allUsers.findIndex(u => u.phone === phoneNumber);
        if (idx !== -1) allUsers[idx] = user;
        saveAndSync('kt_all_users', allUsers);
      }
    }
    return user;
  };

  // 设置密码并完成登录
  const handleSetPasswordAndLogin = () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('密码错误', '密码至少需要6位');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      toast.error('密码错误', '两次密码不一致');
      return;
    }
    if (!pendingUser) return;

    // 保存密码（与小程序一致的格式）
    const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    const hashedPwd = btoa(encodeURIComponent(newPassword + '_venus_salt_' + pendingUser.phone));
    passwords[pendingUser.phone] = hashedPwd;
    localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));

    setShowSetPasswordModal(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    toast.success('密码设置成功', `欢迎，${pendingUser.name}！`);
    onLogin(pendingUser);
    setPendingUser(null);
  };

  // 跳过设置密码
  const handleSkipSetPassword = () => {
    if (!pendingUser) return;
    setShowSetPasswordModal(false);
    setNewPassword('');
    setNewPasswordConfirm('');
    toast.success('登录成功', `欢迎，${pendingUser.name}！`);
    onLogin(pendingUser);
    setPendingUser(null);
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
      const verified = await verifySmsCode();
      if (!verified) { setLoading(false); return; }
      
      // 确保用户存在（自动创建/更新）
      const user = ensureUserExists(phone);

      // 检查是否已设置密码
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
      if (!passwords[phone]) {
        // 未设置密码，弹出设置密码弹窗
        setPendingUser(user);
        setShowSetPasswordModal(true);
        setLoading(false);
        return;
      }

      // 已有密码，直接登录
      toast.success('登录成功', `欢迎，${user.name}！`);
      onLogin(user);
    } catch (err) {
      console.error('验证码登录失败:', err);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
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
      saveAndSync('kt_authorized_phones', authPhones);
    }
    
    saveAndSync('kt_all_users', allUsers);
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
    setLoading(true);

    // 验证手机号
    if (!phone || phone.length !== 11) {
      setError('请输入正确的11位手机号');
      setLoading(false);
      return;
    }

    if (isLogin) {
      // ========== 密码登录模式 ==========
      if (!password || password.length < 6) {
        setError('密码至少需要6位');
        setLoading(false);
        return;
      }

      const passwordHash = hashPassword(password);
      
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
        
        saveAndSync('kt_all_users', allUsers);
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
      // ========== 注册模式（与小程序一致：手机号+验证码+密码） ==========
      if (!smsCode || smsCode.length !== 6) {
        setError('请输入6位验证码');
        setLoading(false);
        return;
      }

      if (!password || password.length < 6) {
        setError('密码至少需要6位');
        setLoading(false);
        return;
      }

      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        setLoading(false);
        return;
      }

      // 验证验证码
      const verified = await verifySmsCode();
      if (!verified) { setLoading(false); return; }

      // 检查是否已注册且已设密码
      const allUsers: User[] = JSON.parse(localStorage.getItem('kt_all_users') || '[]');
      const existingUser = allUsers.find(u => u.phone === phone);
      const passwords: Record<string, string> = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
      
      if (existingUser && passwords[phone]) {
        setError('该手机号已注册，请直接登录');
        setLoading(false);
        return;
      }

      // 检查授权
      const isAuthorized = await checkAuthorization(phone);
      if (!isAuthorized) {
        toast.error('注册失败', '您的手机号未获得授权，请联系管理员');
        setError('未在教职工名单中，请联系园长添加');
        setLoading(false);
        return;
      }

      // 从教职工名单自动获取信息
      const user = ensureUserExists(phone);

      // 保存密码（与小程序一致的格式）
      const hashedPwd = btoa(encodeURIComponent(password + '_venus_salt_' + phone));
      passwords[phone] = hashedPwd;
      localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));

      // 云端注册
      await cloudRegister(user, hashPassword(password));
      
      toast.success('注册成功', `欢迎加入，${user.name}！`);
      onLogin(user);
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
          <p className="text-white/60 text-sm mt-3">每颗星星都闪亮，每个孩子都很棒</p>
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
            {/* 手机号 */}
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

            {/* 验证码输入（验证码登录 & 注册模式） */}
            {(!isLogin || (isLogin && loginType === 'sms')) && (
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
            
            {/* 密码输入（密码登录 & 注册模式） */}
            {(!isLogin || loginType === 'password') && (
              <div className="relative">
                <Lock className="absolute left-4 md:left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  placeholder={isLogin ? "密码" : "设置密码（至少6位）"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  className="w-full pl-12 md:pl-14 pr-14 py-3 md:py-4 bg-slate-50 border-2 border-slate-100 rounded-xl md:rounded-2xl outline-none focus:border-amber-500 font-bold text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 md:right-5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
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
              {isLogin ? '登录' : '快捷注册'}
            </button>
          </form>
          
          {/* 注册提示 */}
          {!isLogin && (
            <div className="p-2.5 md:p-3 bg-slate-50 rounded-lg md:rounded-xl">
              <p className="text-xs text-slate-400 leading-relaxed">
                输入教职工名单中的手机号即可快捷注册，姓名、角色、园区将自动从名单获取
              </p>
            </div>
          )}
          
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

      {/* 设置密码弹窗 - 验证码登录后首次设置 */}
      {showSetPasswordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#faf8f5' }}>
            <div className="p-6 text-center" style={{ backgroundColor: '#3d4a32' }}>
              <Lock className="w-10 h-10 text-white/80 mx-auto mb-2" />
              <h3 className="text-white font-bold text-lg">设置登录密码</h3>
              <p className="text-white/60 text-sm mt-1">设置后可使用密码快捷登录</p>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-700 font-medium">
                您尚未设置登录密码，建议设置一个方便下次快捷登录
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type={showPassword ? 'text' : 'password'}
                  placeholder="设置密码（至少6位）" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="w-full pl-12 pr-14 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 font-bold text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="password"
                  placeholder="确认密码" 
                  value={newPasswordConfirm} 
                  onChange={e => setNewPasswordConfirm(e.target.value)} 
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl outline-none focus:border-amber-500 font-bold text-base"
                />
              </div>
              
              <button 
                onClick={handleSetPasswordAndLogin}
                className="w-full bg-amber-600 text-white font-bold py-4 rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-700 active:scale-[0.98] transition-all"
              >
                设置密码并登录
              </button>
              
              <button 
                onClick={handleSkipSetPassword}
                className="w-full text-slate-400 text-sm font-medium py-2 hover:text-slate-500 transition-colors"
              >
                跳过，稍后设置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthView;
