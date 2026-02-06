/**
 * 内账二次验证弹窗组件
 * 用于访问敏感财务信息前的身份验证
 */

import React, { useState, useEffect } from 'react'
import { Lock, Eye, EyeOff, Shield, Clock, AlertTriangle, X, Key, Settings, Info, Check } from 'lucide-react'
import { 
  verifyInternalPassword, 
  isInternalVerified, 
  getInternalAuthInfo,
  setInternalPassword,
  hasCustomPassword,
  clearInternalAuth
} from '../services/internalAuthService'

interface InternalAuthModalProps {
  isOpen: boolean
  onSuccess: () => void
  onCancel: () => void
  userName: string
  allowSetPassword?: boolean  // 是否允许设置密码（仅超级管理员）
}

export const InternalAuthModal: React.FC<InternalAuthModalProps> = ({
  isOpen,
  onSuccess,
  onCancel,
  userName,
  allowSetPassword = false
}) => {
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'verify' | 'setPassword'>('verify')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    if (isOpen) {
      setPassword('')
      setError('')
      setMode('verify')
      setNewPassword('')
      setConfirmPassword('')
    }
  }, [isOpen])

  const handleVerify = () => {
    if (!password.trim()) {
      setError('请输入密码')
      return
    }

    setIsLoading(true)
    setError('')

    // 模拟验证延迟
    setTimeout(() => {
      if (verifyInternalPassword(password, userName)) {
        onSuccess()
      } else {
        setError('密码错误，请重试')
      }
      setIsLoading(false)
    }, 500)
  }

  const handleSetPassword = () => {
    if (!newPassword.trim()) {
      setError('请输入新密码')
      return
    }
    if (newPassword.length < 6) {
      setError('密码至少6位')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('两次密码不一致')
      return
    }

    setInternalPassword(newPassword)
    setError('')
    setMode('verify')
    alert('密码设置成功！请使用新密码验证。')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (mode === 'verify') {
        handleVerify()
      } else {
        handleSetPassword()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div 
        className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-slate-700 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-600/20 to-slate-700/20 px-6 py-5 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center shadow-lg">
                <Lock className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {mode === 'verify' ? '专业模式' : '设置密码'}
                </h2>
                <p className="text-sm text-slate-400">
                  {mode === 'verify' ? '请输入访问密码' : '设置新的访问密码'}
                </p>
              </div>
            </div>
            <button 
              onClick={onCancel}
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {mode === 'verify' ? (
            <>
              {/* 提示 */}
              <div className="flex items-start gap-3 bg-slate-500/10 border border-slate-500/20 rounded-xl p-4">
                <Info className="w-5 h-5 text-slate-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-slate-300/80">
                  <p className="font-medium text-slate-300 mb-1">验证提示</p>
                  <p>验证通过后有效期30分钟。</p>
                </div>
              </div>

              {/* 密码输入 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  访问密码
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="请输入密码"
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 pr-12 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5 text-slate-400" />
                    ) : (
                      <Eye className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              {/* 提示 - 仅首次显示 */}
              {!hasCustomPassword() && (
                <p className="text-xs text-slate-500">
                  初始: qdjx7777
                </p>
              )}
            </>
          ) : (
            <>
              {/* 新密码输入 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">新密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="至少6位"
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                  autoFocus
                />
              </div>

              {/* 确认密码 */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">确认密码</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="再次输入密码"
                  className="w-full bg-slate-800/50 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/50 border-t border-slate-700 flex items-center justify-between gap-3">
          {mode === 'verify' && allowSetPassword && (
            <button
              onClick={() => setMode('setPassword')}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              修改密码
            </button>
          )}
          {mode === 'setPassword' && (
            <button
              onClick={() => setMode('verify')}
              className="flex items-center gap-2 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors text-sm"
            >
              返回验证
            </button>
          )}
          
          <div className="flex-1" />
          
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              onClick={mode === 'verify' ? handleVerify : handleSetPassword}
              disabled={isLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-slate-500 to-slate-600 hover:from-slate-600 hover:to-slate-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-slate-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  验证中...
                </>
              ) : mode === 'verify' ? (
                <>
                  <Check className="w-4 h-4" />
                  确认
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  保存
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ 状态指示器组件 ============

interface InternalAuthStatusProps {
  onLogout?: () => void
}

export const InternalAuthStatus: React.FC<InternalAuthStatusProps> = ({ onLogout }) => {
  const [authInfo, setAuthInfo] = useState(getInternalAuthInfo())

  useEffect(() => {
    const timer = setInterval(() => {
      setAuthInfo(getInternalAuthInfo())
    }, 30000) // 每30秒更新一次

    return () => clearInterval(timer)
  }, [])

  if (!authInfo.verified) return null

  return (
    <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5">
      <span className="w-2 h-2 rounded-full bg-slate-500 animate-pulse" />
      <span className="text-xs text-slate-500">
        {authInfo.remainingMinutes}m
      </span>
      {onLogout && (
        <button
          onClick={() => {
            clearInternalAuth()
            onLogout()
          }}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      )}
    </div>
  )
}

export default InternalAuthModal
