
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { getRoleName } from '../services/permissionService';
import { Lock, Eye, EyeOff, Phone, Shield, ChevronRight, CheckCircle, AlertCircle, User as UserIcon, MapPin, Briefcase } from 'lucide-react';

interface ProfileViewProps {
  currentUser: User;
  onUserUpdate?: (user: User) => void;
}

const ProfileView: React.FC<ProfileViewProps> = ({ currentUser, onUserUpdate }) => {
  // 密码管理
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPwd, setShowOldPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [pwdMessage, setPwdMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const passwords = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');
    setHasPassword(!!passwords[currentUser.phone]);
  }, [currentUser.phone]);

  // 简单的密码哈希（与登录页一致）
  const hashPassword = (pwd: string): string => {
    let hash = 0;
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return 'hash_' + Math.abs(hash).toString(16);
  };

  const handleSavePassword = () => {
    setPwdMessage(null);

    if (hasPassword && !oldPassword) {
      setPwdMessage({ type: 'error', text: '请输入原密码' });
      return;
    }

    if (!newPassword) {
      setPwdMessage({ type: 'error', text: '请输入新密码' });
      return;
    }

    if (newPassword.length < 6) {
      setPwdMessage({ type: 'error', text: '密码长度至少6位' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwdMessage({ type: 'error', text: '两次输入的密码不一致' });
      return;
    }

    const passwords = JSON.parse(localStorage.getItem('kt_user_passwords') || '{}');

    // 验证旧密码
    if (hasPassword) {
      const storedHash = passwords[currentUser.phone];
      const inputHash = hashPassword(oldPassword);
      if (storedHash !== inputHash) {
        setPwdMessage({ type: 'error', text: '原密码不正确' });
        return;
      }
    }

    // 保存新密码
    passwords[currentUser.phone] = hashPassword(newPassword);
    localStorage.setItem('kt_user_passwords', JSON.stringify(passwords));

    setHasPassword(true);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordSection(false);
    setPwdMessage({ type: 'success', text: hasPassword ? '密码修改成功' : '密码设置成功' });

    setTimeout(() => setPwdMessage(null), 3000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center gap-3 mb-2">
        <UserIcon className="w-6 h-6 text-[#4a5d3a]" />
        <h1 className="text-2xl font-bold text-[#4a5d3a]" style={{ fontFamily: "'Noto Serif SC', serif" }}>个人中心</h1>
      </div>

      {/* 成功/错误提示 */}
      {pwdMessage && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
          pwdMessage.type === 'success' 
            ? 'bg-green-50 text-green-700 border border-green-200' 
            : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {pwdMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {pwdMessage.text}
        </div>
      )}

      {/* 用户信息卡片 */}
      <div className="bg-white rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
        <div className="p-6 flex items-center gap-5" style={{ background: 'linear-gradient(135deg, #4a5d3a 0%, #6b8c5a 100%)' }}>
          <img 
            src={currentUser.avatar} 
            className="w-20 h-20 rounded-full border-4 border-white/30 shadow-lg" 
            alt={currentUser.name}
          />
          <div className="text-white">
            <h2 className="text-xl font-bold">{currentUser.name}</h2>
            <p className="text-white/80 text-sm mt-1">{getRoleName(currentUser.role)}</p>
          </div>
        </div>
        
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3 py-2">
            <Phone className="w-4 h-4 text-[#8b7355]" />
            <span className="text-sm text-[#8b7355]">手机号</span>
            <span className="ml-auto text-sm font-medium text-[#4a5d3a]">
              {currentUser.phone ? currentUser.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '未绑定'}
            </span>
          </div>
          <div className="border-t border-[#e8e4dc]" />
          
          <div className="flex items-center gap-3 py-2">
            <Briefcase className="w-4 h-4 text-[#8b7355]" />
            <span className="text-sm text-[#8b7355]">角色</span>
            <span className="ml-auto text-sm font-medium text-[#4a5d3a]">{getRoleName(currentUser.role)}</span>
          </div>
          <div className="border-t border-[#e8e4dc]" />
          
          <div className="flex items-center gap-3 py-2">
            <MapPin className="w-4 h-4 text-[#8b7355]" />
            <span className="text-sm text-[#8b7355]">园区</span>
            <span className="ml-auto text-sm font-medium text-[#4a5d3a]">{currentUser.campus || '未分配'}</span>
          </div>
        </div>
      </div>

      {/* 设置菜单 */}
      <div className="bg-white rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e8e4dc]">
          <h3 className="text-sm font-bold text-[#4a5d3a]">账号安全</h3>
        </div>
        
        {/* 修改密码入口 */}
        <button 
          onClick={() => { setShowPasswordSection(!showPasswordSection); setPwdMessage(null); }}
          className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#f5f2ed] transition-colors"
        >
          <Lock className="w-4 h-4 text-[#8b7355]" />
          <span className="text-sm text-[#4a5d3a] font-medium">{hasPassword ? '修改密码' : '设置密码'}</span>
          <span className="ml-auto flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              hasPassword ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
            }`}>
              {hasPassword ? '已设置' : '未设置'}
            </span>
            <ChevronRight className={`w-4 h-4 text-[#8b7355] transition-transform ${showPasswordSection ? 'rotate-90' : ''}`} />
          </span>
        </button>

        {/* 密码修改表单 */}
        {showPasswordSection && (
          <div className="px-5 pb-5 space-y-4 border-t border-[#e8e4dc] pt-4">
            {hasPassword && (
              <div>
                <label className="block text-xs font-medium text-[#8b7355] mb-1.5">原密码</label>
                <div className="relative">
                  <input
                    type={showOldPwd ? 'text' : 'password'}
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    placeholder="请输入原密码"
                    className="w-full px-4 py-2.5 rounded-xl border border-[#e8e4dc] focus:border-[#4a5d3a] focus:ring-1 focus:ring-[#4a5d3a]/20 outline-none text-sm"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowOldPwd(!showOldPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355]"
                  >
                    {showOldPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#8b7355] mb-1.5">新密码</label>
              <div className="relative">
                <input
                  type={showNewPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8e4dc] focus:border-[#4a5d3a] focus:ring-1 focus:ring-[#4a5d3a]/20 outline-none text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowNewPwd(!showNewPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355]"
                >
                  {showNewPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#8b7355] mb-1.5">确认新密码</label>
              <div className="relative">
                <input
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="请再次输入新密码"
                  className="w-full px-4 py-2.5 rounded-xl border border-[#e8e4dc] focus:border-[#4a5d3a] focus:ring-1 focus:ring-[#4a5d3a]/20 outline-none text-sm"
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b7355]"
                >
                  {showConfirmPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowPasswordSection(false); setOldPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="flex-1 py-2.5 rounded-xl border border-[#e8e4dc] text-sm font-medium text-[#8b7355] hover:bg-[#f5f2ed] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSavePassword}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white transition-colors"
                style={{ backgroundColor: '#4a5d3a' }}
              >
                {hasPassword ? '确认修改' : '设置密码'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 系统信息 */}
      <div className="bg-white rounded-2xl border border-[#e8e4dc] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e8e4dc]">
          <h3 className="text-sm font-bold text-[#4a5d3a]">系统信息</h3>
        </div>
        <div className="px-5 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8b7355]">系统版本</span>
            <span className="text-sm font-medium text-[#4a5d3a]">V1.1.3</span>
          </div>
          <div className="border-t border-[#e8e4dc]" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#8b7355]">用户ID</span>
            <span className="text-xs font-mono text-[#8b7355]/70">{currentUser.id.slice(0, 12)}...</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileView;
