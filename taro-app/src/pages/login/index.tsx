import { useState, useEffect } from 'react'
import { View, Text, Input, Image, ScrollView, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import useGlobalShare from '../../hooks/useGlobalShare'
import { downloadAllData, isAliyunConfigured, uploadUsers } from '../../services/aliyunOssService'
import { sendVerificationCode, verifyCode, isRealSmsEnabled } from '../../services/smsService'
import { getPhoneByCode } from '../../services/wxPhoneService'
import { safeGo } from '../../utils/nav'
import logoImg from '../../assets/logo.png'
import './index.scss'

// 安全的toast显示函数
const safeToast = (title: string | undefined | null, icon: 'success' | 'none' = 'none') => {
  Taro.showToast({ 
    title: title || '操作完成', 
    icon 
  })
}

interface User {
  id: string
  phone: string
  name: string
  role: string
  campus?: string
  assignedClasses?: string[]  // 分配的班级
  passwordHash?: string
  createdAt?: string
}

// 可选角色
const AVAILABLE_ROLES = [
  { role: 'ADMIN', label: '园区管理员', icon: '👔', desc: '管理本园区' },
  { role: 'TEACHER', label: '教师', icon: '👩‍🏫', desc: '考勤、课程' },
  { role: 'KITCHEN', label: '厨房人员', icon: '🍳', desc: '食谱管理' },
  { role: 'PARENT', label: '家长', icon: '👨‍👩‍👧', desc: '查看信息' },
]

// 默认园区
const DEFAULT_CAMPUSES = ['十七幼', '总园', '南江', '高新', '新市花园', '创越']

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginType, setLoginType] = useState<'password' | 'sms'>('password')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  
  // 注册时的角色和园区
  const [selectedRole, setSelectedRole] = useState('TEACHER')
  const [selectedCampus, setSelectedCampus] = useState('总园')
  
  // 验证码相关
  const [smsCode, setSmsCode] = useState('')
  const [countdown, setCountdown] = useState(0)
  const [devCode, setDevCode] = useState('') // 开发模式下显示的验证码

  // 协议相关
  const [agreed, setAgreed] = useState(false)
  const [showAgreement, setShowAgreement] = useState<'service' | 'privacy' | null>(null)

  useGlobalShare({ title: '金星幼儿园 - 智慧校园管理', path: '/pages/login/index' })

  useEffect(() => {
    const user = Taro.getStorageSync('kt_current_user')
    if (user) {
      safeGo('/pages/index/index')
    }
  }, [])

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  const hashPassword = (pwd: string): string => {
    let hash = 0
    for (let i = 0; i < pwd.length; i++) {
      const char = pwd.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return 'hash_' + Math.abs(hash).toString(16)
  }

  // 登录成功后自动同步数据（下载全部数据，不上传）
  const syncAfterLogin = async () => {
    if (!isAliyunConfigured) return
    
    Taro.showLoading({ title: '同步数据中...' })
    try {
      const result = await downloadAllData()
      Taro.hideLoading()
      if (result.success) {
        console.log(`[Login] 同步完成: ${result.students}学生, ${result.staff}教职工`)
        Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('[Login] 同步失败:', err)
    }
  }

  // 登录成功处理
  const onLoginSuccess = async (user: User) => {
    // 先同步数据（下载最新的学生、教职工数据）
    await syncAfterLogin()
    
    // 从最新的kt_staff数据中获取更完整的信息（班级分配等）
    const staffList = Taro.getStorageSync('kt_staff') || []
    const staffInfo = staffList.find((s: any) => s.phone === user.phone)
    
    // 合并staff数据中的信息（教职工名单为权威数据源）
    const enrichedUser = {
      ...user,
      name: staffInfo?.name || user.name,
      role: staffInfo?.role || user.role,
      assignedClasses: staffInfo?.assignedClasses || user.assignedClasses || [],
    }
    
    console.log('[Login] 用户信息:', enrichedUser)
    Taro.setStorageSync('kt_current_user', enrichedUser)
    
    safeToast('登录成功', 'success')
    setTimeout(() => {
      safeGo('/pages/index/index')
    }, 1000)
  }

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone.trim() || phone.length !== 11) {
      safeToast('请输入有效手机号')
      return
    }

    if (countdown > 0) return

    Taro.showLoading({ title: '发送中...' })
    try {
      const result = await sendVerificationCode(phone)
      Taro.hideLoading()

      if (result && result.success) {
        setCountdown(60)
        // 开发模式下显示验证码
        if (result.code) {
          setDevCode(result.code)
          Taro.showModal({
            title: '开发模式',
            content: `验证码: ${result.code}\n\n（正式环境会发送短信）`,
            showCancel: false
          })
        } else {
          safeToast(result.message || '验证码已发送', 'success')
        }
      } else {
        safeToast(result?.message || '发送失败')
      }
    } catch (err) {
      Taro.hideLoading()
      console.error('[SMS] 发送异常:', err)
      safeToast('发送失败，请重试')
    }
  }

  // 密码登录
  const handlePasswordLogin = async () => {
    if (!phone.trim()) {
      safeToast('请输入手机号')
      return
    }
    if (!password.trim()) {
      safeToast('请输入密码')
      return
    }

    setLoading(true)

    // 超级管理员
    if (phone === '18513001100') {
      if (password === 'su123789') {
        await onLoginSuccess({
          id: 'super_admin',
          phone: '18513001100',
          name: '系统管理员',
          role: 'SUPER_ADMIN',
          campus: '金星幼儿园'
        })
      } else {
        safeToast('密码错误')
      }
      setLoading(false)
      return
    }

    // 测试账号 - 管理员
    if (phone === 'admin') {
      if (password === 'admin123') {
        await onLoginSuccess({
          id: 'test_admin',
          phone: 'admin',
          name: '测试管理员',
          role: 'SUPER_ADMIN',
          campus: '金星幼儿园'
        })
      } else {
        safeToast('密码错误')
      }
      setLoading(false)
      return
    }
    
    // 测试账号 - 老师（花开小二）
    if (phone === 'teacher') {
      if (password === 'teacher123') {
        await onLoginSuccess({
          id: 'test_teacher',
          phone: 'teacher',
          name: '张老师',
          role: 'TEACHER',
          campus: '金星幼儿园',
          assignedClasses: ['花开小二']
        })
      } else {
        safeToast('密码错误')
      }
      setLoading(false)
      return
    }
    
    // 测试账号 - 老师（未分配班级）
    if (phone === 'teacher2') {
      if (password === 'teacher123') {
        await onLoginSuccess({
          id: 'test_teacher2',
          phone: 'teacher2',
          name: '李老师',
          role: 'TEACHER',
          campus: '金星幼儿园',
          assignedClasses: []
        })
      } else {
        safeToast('密码错误')
      }
      setLoading(false)
      return
    }
    
    // 测试账号 - 厨师
    if (phone === 'cook' || phone === 'chef') {
      if (password === 'cook123') {
        await onLoginSuccess({
          id: 'test_cook',
          phone: 'cook',
          name: '王厨师',
          role: 'KITCHEN',
          campus: '金星幼儿园'
        })
      } else {
        safeToast('密码错误')
      }
      setLoading(false)
      return
    }

    // 普通用户
    const users: User[] = Taro.getStorageSync('kt_all_users') || []
    const user = users.find(u => u.phone === phone)

    if (!user) {
      safeToast('用户不存在，请先注册')
      setLoading(false)
      return
    }

    const inputHash = hashPassword(password)
    if (user.passwordHash !== inputHash) {
      safeToast('密码错误')
      setLoading(false)
      return
    }

    await onLoginSuccess(user)
    setLoading(false)
  }

  // 验证码登录
  const handleSmsLogin = async () => {
    if (!phone.trim() || phone.length !== 11) {
      safeToast('请输入有效手机号')
      return
    }
    if (!smsCode.trim()) {
      safeToast('请输入验证码')
      return
    }

    setLoading(true)

    try {
      // 验证验证码
      const verifyResult = await verifyCode(phone, smsCode)
      if (!verifyResult || !verifyResult.success) {
        safeToast(verifyResult?.message || '验证失败')
        setLoading(false)
        return
      }

      // 从教职工名单查找（这是权威数据源）
      const staffList = Taro.getStorageSync('kt_staff') || []
      const staffInfo = staffList.find((s: any) => s.phone === phone)

      // 检查用户是否已注册（按手机号去重）
      const users: User[] = Taro.getStorageSync('kt_all_users') || []
      let user = users.find(u => u.phone === phone)

      if (!user) {
        // 新用户 - 必须在教职工名单或授权列表中
        const authorizedPhonesRaw: any[] = Taro.getStorageSync('kt_authorized_phones') || []
        const authorizedPhoneList = authorizedPhonesRaw.map((p: any) => typeof p === 'string' ? p : p.phone)
        if (!staffInfo && authorizedPhoneList.length > 0 && !authorizedPhoneList.includes(phone)) {
          safeToast('手机号未授权，请联系园长')
          setLoading(false)
          return
        }

        // 自动创建用户，使用手机号作为唯一标识（防止跨设备重复）
        user = {
          id: `user_${phone}`,
          phone,
          name: staffInfo?.name || `用户${phone.slice(-4)}`,
          role: staffInfo?.role || 'TEACHER',
          campus: '十七幼',
          assignedClasses: staffInfo?.assignedClasses || [],
        }
        users.push(user)
        Taro.setStorageSync('kt_all_users', users)
      }

      await onLoginSuccess(user)
    } catch (err) {
      console.error('[SMS] 验证异常:', err)
      safeToast('验证失败，请重试')
    }
    setLoading(false)
  }

  // 登录处理
  const handleLogin = async () => {
    if (loginType === 'password') {
      await handlePasswordLogin()
    } else {
      await handleSmsLogin()
    }
  }

  // 手机号注册 - 验证码 + 密码
  const handleRegister = async () => {
    if (!phone.trim() || phone.length !== 11) {
      safeToast('请输入有效手机号')
      return
    }
    if (!smsCode.trim()) {
      safeToast('请输入验证码')
      return
    }
    if (!password.trim() || password.length < 6) {
      safeToast('请设置至少6位密码')
      return
    }
    if (password !== confirmPassword) {
      safeToast('两次密码输入不一致')
      return
    }

    setLoading(true)

    try {
      // 验证验证码
      const verifyResult = await verifyCode(phone, smsCode)
      if (!verifyResult || !verifyResult.success) {
        safeToast(verifyResult?.message || '验证码错误')
        setLoading(false)
        return
      }

      // 检查是否已注册
      const users: User[] = Taro.getStorageSync('kt_all_users') || []
      if (users.some(u => u.phone === phone)) {
        safeToast('该手机号已注册，请直接登录')
        setMode('login')
        setLoading(false)
        return
      }

      // 从教职工名单中查找
      const staffList = Taro.getStorageSync('kt_staff') || []
      const staffInfo = staffList.find((s: any) => s.phone === phone)

      // 从授权名单中查找
      const authorizedPhonesRaw: any[] = Taro.getStorageSync('kt_authorized_phones') || []
      const authInfo = authorizedPhonesRaw.find((p: any) => 
        typeof p === 'object' ? p.phone === phone : p === phone
      )

      if (!staffInfo) {
        const authorizedPhoneList = authorizedPhonesRaw.map((p: any) => typeof p === 'string' ? p : p.phone)
        if (authorizedPhoneList.length > 0 && !authorizedPhoneList.includes(phone)) {
          safeToast('未在教职工名单中，请联系园长添加')
          setLoading(false)
          return
        }
      }

      // 合并班级信息
      let assignedClasses: string[] = staffInfo?.assignedClasses || []
      if (typeof authInfo === 'object' && authInfo?.assignedClass && !assignedClasses.includes(authInfo.assignedClass)) {
        assignedClasses = [...assignedClasses, authInfo.assignedClass]
      }

      // 创建用户 - 使用手机号作为唯一ID防止跨设备重复
      const newUser: User = {
        id: `user_${phone}`,
        phone,
        name: staffInfo?.name || (typeof authInfo === 'object' ? authInfo?.name : '') || `用户${phone.slice(-4)}`,
        role: staffInfo?.role || (typeof authInfo === 'object' ? authInfo?.role : '') || 'TEACHER',
        campus: staffInfo?.campus || (typeof authInfo === 'object' ? authInfo?.campus : '') || '十七幼',
        assignedClasses,
        createdAt: new Date().toISOString()
      }

      users.push(newUser)
      Taro.setStorageSync('kt_all_users', users)

      // 保存密码（简单哈希）
      const passwords = Taro.getStorageSync('kt_user_passwords') || {}
      const hashedPwd = btoa(encodeURIComponent(password + '_venus_salt_' + phone))
      passwords[phone] = hashedPwd
      Taro.setStorageSync('kt_user_passwords', passwords)
      
      // 同步用户数据到云端
      if (isAliyunConfigured) {
        uploadUsers().then(result => {
          if (result.success) {
            console.log('[Login] 用户数据已同步到云端')
          }
        })
      }

      safeToast('注册成功', 'success')
      // 登录成功
      await onLoginSuccess(newUser)
      
    } catch (err) {
      console.error('[Register] 注册异常:', err)
      safeToast('注册失败，请重试')
    }
    setLoading(false)
  }

  // 微信手机号快捷登录
  const handleWxPhoneLogin = async (e: any) => {
    const { code, errMsg } = e.detail
    
    if (!code) {
      // 用户取消授权
      if (errMsg?.includes('deny') || errMsg?.includes('cancel')) {
        return // 静默处理
      }
      safeToast('授权失败，请使用验证码登录')
      return
    }

    if (!agreed) {
      safeToast('请先同意用户协议和隐私政策')
      return
    }

    setLoading(true)
    Taro.showLoading({ title: '登录中...' })

    try {
      // 通过后端换取手机号
      const result = await getPhoneByCode(code)
      
      if (!result.success || !result.phone) {
        Taro.hideLoading()
        safeToast(result.error || '获取手机号失败')
        setLoading(false)
        return
      }

      const wxPhone = result.phone

      // 从教职工名单查找
      const staffList = Taro.getStorageSync('kt_staff') || []
      const staffInfo = staffList.find((s: any) => s.phone === wxPhone)

      // 检查用户是否已注册
      const users: User[] = Taro.getStorageSync('kt_all_users') || []
      let user = users.find(u => u.phone === wxPhone)

      if (!user) {
        // 检查授权（兼容纯字符串和对象格式）
        const authorizedPhonesRaw: any[] = Taro.getStorageSync('kt_authorized_phones') || []
        const authorizedPhoneList = authorizedPhonesRaw.map((p: any) => typeof p === 'string' ? p : p.phone)
        if (!staffInfo && authorizedPhoneList.length > 0 && !authorizedPhoneList.includes(wxPhone)) {
          Taro.hideLoading()
          safeToast('手机号未授权，请联系园长')
          setLoading(false)
          return
        }

        // 自动创建用户
        user = {
          id: `user_${wxPhone}`,
          phone: wxPhone,
          name: staffInfo?.name || `用户${wxPhone.slice(-4)}`,
          role: staffInfo?.role || 'TEACHER',
          campus: '十七幼',
          assignedClasses: staffInfo?.assignedClasses || [],
          createdAt: new Date().toISOString()
        }
        users.push(user)
        Taro.setStorageSync('kt_all_users', users)

        // 同步用户到云端
        if (isAliyunConfigured) {
          uploadUsers().catch(() => {})
        }
      }

      Taro.hideLoading()
      await onLoginSuccess(user)
    } catch (err) {
      Taro.hideLoading()
      console.error('[WxPhone] 异常:', err)
      safeToast('登录失败，请使用验证码登录')
    }
    setLoading(false)
  }

  return (
    <View className='login-page'>
      {/* 特定人群说明 - 微信审核要求 */}
      <View className='access-notice'>
        <Text className='notice-text'>本系统仅限奇德金星幼儿园授权人员使用</Text>
      </View>
      
      <View className='form-card'>
        {/* 头部 - 深绿色 */}
        <View className='header-bg'>
          <View className='logo'>
            <Image className='logo-image' src={logoImg} mode='aspectFit' />
          </View>
          <Text className='subtitle'>自然 · 养育 · 成长</Text>
        </View>

        {/* 切换标签 */}
        <View className='mode-tabs'>
          <View 
            className={`tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => setMode('login')}
          >
            <Text>登录</Text>
          </View>
          <View 
            className={`tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => setMode('register')}
          >
            <Text>注册</Text>
          </View>
        </View>

        {/* 登录方式切换（仅登录模式） */}
        {mode === 'login' && (
          <View className='login-type-tabs'>
            <View 
              className={`type-tab ${loginType === 'password' ? 'active' : ''}`}
              onClick={() => setLoginType('password')}
            >
              <Text>密码登录</Text>
            </View>
            <View 
              className={`type-tab ${loginType === 'sms' ? 'active' : ''}`}
              onClick={() => setLoginType('sms')}
            >
              <Text>验证码登录</Text>
            </View>
          </View>
        )}

        {/* 表单 */}
        <View className='form'>
          <View className='form-item'>
            <Text className='label'>手机号</Text>
            <Input
              className='input'
              type={mode === 'login' && loginType === 'password' ? 'text' : 'number'}
              placeholder={mode === 'login' && loginType === 'password' ? '请输入手机号' : '请输入11位手机号'}
              value={phone}
              onInput={(e) => setPhone(e.detail.value)}
              maxlength={mode === 'login' && loginType === 'password' ? 20 : 11}
            />
          </View>

          {/* 密码输入 - 仅登录密码模式 */}
          {mode === 'login' && loginType === 'password' && (
            <View className='form-item'>
              <Text className='label'>密码</Text>
              <View className='password-wrap'>
                <Input
                  className='input'
                  password={!showPassword}
                  placeholder='请输入密码'
                  value={password}
                  onInput={(e) => setPassword(e.detail.value)}
                />
                <Text 
                  className='toggle-eye' 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? '🙈' : '👁️'}
                </Text>
              </View>
            </View>
          )}

          {/* 验证码输入 - 登录验证码模式和注册模式 */}
          {(mode === 'register' || (mode === 'login' && loginType === 'sms')) && (
            <View className='form-item'>
              <Text className='label'>验证码</Text>
              <View className='sms-wrap'>
                <Input
                  className='input sms-input'
                  type='number'
                  placeholder='请输入6位验证码'
                  value={smsCode}
                  onInput={(e) => setSmsCode(e.detail.value)}
                  maxlength={6}
                />
                <View 
                  className={`send-btn ${countdown > 0 ? 'disabled' : ''}`}
                  onClick={handleSendCode}
                >
                  <Text>{countdown > 0 ? `${countdown}s` : '获取验证码'}</Text>
                </View>
              </View>
              {devCode && !isRealSmsEnabled() && (
                <Text className='dev-code-hint'>开发模式验证码: {devCode}</Text>
              )}
            </View>
          )}

          {/* 注册密码 - 仅注册模式 */}
          {mode === 'register' && (
            <>
              <View className='form-item'>
                <Text className='label'>设置密码</Text>
                <View className='password-wrap'>
                  <Input
                    className='input'
                    password={!showPassword}
                    placeholder='请设置6-20位密码'
                    value={password}
                    onInput={(e) => setPassword(e.detail.value)}
                    maxlength={20}
                  />
                  <Text 
                    className='toggle-eye' 
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </Text>
                </View>
              </View>
              <View className='form-item'>
                <Text className='label'>确认密码</Text>
                <Input
                  className='input'
                  password
                  placeholder='请再次输入密码'
                  value={confirmPassword}
                  onInput={(e) => setConfirmPassword(e.detail.value)}
                  maxlength={20}
                />
              </View>
            </>
          )}

          {/* 协议勾选 - 微信审核要求 */}
          <View className='agreement-row' onClick={() => setAgreed(!agreed)}>
            <View className={`agree-check ${agreed ? 'checked' : ''}`}>
              {agreed && <Text className='check-mark'>✓</Text>}
            </View>
            <Text className='agree-text'>
              已阅读并同意
            </Text>
            <Text className='agree-link' onClick={(e) => { e.stopPropagation(); setShowAgreement('service') }}>《用户服务协议》</Text>
            <Text className='agree-text'>和</Text>
            <Text className='agree-link' onClick={(e) => { e.stopPropagation(); setShowAgreement('privacy') }}>《隐私政策》</Text>
          </View>

          <View 
            className={`submit-btn ${loading ? 'loading' : ''} ${!agreed ? 'btn-disabled' : ''}`}
            onClick={() => {
              if (!agreed) {
                safeToast('请先同意用户协议和隐私政策')
                return
              }
              mode === 'login' ? handleLogin() : handleRegister()
            }}
          >
            <Text>{loading ? '处理中...' : (mode === 'login' ? '登录' : '快捷注册')}</Text>
          </View>

          {/* 微信手机号快捷登录 */}
          <View className='wx-divider'>
            <View className='line' />
            <Text className='or-text'>或</Text>
            <View className='line' />
          </View>

          <Button 
            className='wx-phone-btn'
            openType='getPhoneNumber'
            onGetPhoneNumber={handleWxPhoneLogin}
          >
            <Text className='wx-icon'>📱</Text>
            <Text>微信手机号快捷登录</Text>
          </Button>

          {mode === 'register' && (
            <View className='tips'>
              <Text className='tip'>输入教职工名单中的手机号即可快捷注册</Text>
              <Text className='tip'>姓名、角色、班级将自动从名单获取</Text>
            </View>
          )}
        </View>
      </View>

      <View className='footer'>
        <Text>KIDDA EDUCATION CLOUD PLATFORM</Text>
      </View>

      {/* 协议弹窗 */}
      {showAgreement && (
        <View className='agreement-overlay' onClick={() => setShowAgreement(null)}>
          <View className='agreement-modal' onClick={(e) => e.stopPropagation()}>
            <View className='agreement-header'>
              <Text className='agreement-title'>
                {showAgreement === 'service' ? '用户服务协议' : '隐私政策'}
              </Text>
              <Text className='agreement-close' onClick={() => setShowAgreement(null)}>✕</Text>
            </View>
            <ScrollView scrollY className='agreement-body'>
              {showAgreement === 'service' ? (
                <View className='agreement-content'>
                  <Text className='p'>更新日期：2026年2月1日</Text>
                  <Text className='p'>欢迎使用奇德金星幼儿园智慧校园管理系统（以下简称"本系统"）。本系统由濮阳市奇德国际教育有限公司运营，仅供奇德金星幼儿园教职工及学生家长使用。</Text>
                  <Text className='h'>一、服务说明</Text>
                  <Text className='p'>本系统提供学生考勤管理、健康记录、成长档案、食谱管理等幼儿园日常管理功能。使用本系统需凭授权手机号注册登录。</Text>
                  <Text className='h'>二、用户注册</Text>
                  <Text className='p'>用户需提供真实手机号码进行注册验证。手机号码仅用于身份验证和系统登录，不会用于其他商业用途。</Text>
                  <Text className='h'>三、用户义务</Text>
                  <Text className='p'>用户应妥善保管账号信息，不得将账号提供给无关人员使用。用户录入的学生信息应真实准确。</Text>
                  <Text className='h'>四、数据安全</Text>
                  <Text className='p'>本系统采用阿里云服务器存储数据，实行严格的数据访问权限控制，确保数据安全。</Text>
                  <Text className='h'>五、免责声明</Text>
                  <Text className='p'>因不可抗力、系统维护等原因导致服务中断，本系统不承担相关责任。</Text>
                  <Text className='h'>六、联系方式</Text>
                  <Text className='p'>如有问题请联系园区管理员。</Text>
                </View>
              ) : (
                <View className='agreement-content'>
                  <Text className='p'>更新日期：2026年2月1日</Text>
                  <Text className='p'>濮阳市奇德国际教育有限公司（以下简称"我们"）非常重视用户隐私保护。本隐私政策说明我们如何收集、使用和保护您的个人信息。</Text>
                  <Text className='h'>一、信息收集</Text>
                  <Text className='p'>我们收集的信息包括：手机号码（用于注册登录和身份验证）、姓名和职务信息（用于系统角色分配）。</Text>
                  <Text className='h'>二、信息使用</Text>
                  <Text className='p'>您的手机号仅用于：账号注册与登录验证、发送验证码短信。我们不会将您的手机号用于营销推广或提供给第三方。</Text>
                  <Text className='h'>三、信息存储</Text>
                  <Text className='p'>您的个人信息存储于阿里云服务器，采用加密传输和访问控制措施保障数据安全。数据保存期限为用户使用系统期间。</Text>
                  <Text className='h'>四、信息共享</Text>
                  <Text className='p'>我们不会将您的个人信息出售、出租或共享给任何第三方，法律法规要求除外。</Text>
                  <Text className='h'>五、用户权利</Text>
                  <Text className='p'>您有权查看、修改、删除您的个人信息。如需删除账号，请联系园区管理员。</Text>
                  <Text className='h'>六、未成年人保护</Text>
                  <Text className='p'>本系统记录的学生信息仅供教学管理使用，严格限制访问权限，确保未成年人信息安全。</Text>
                  <Text className='h'>七、联系我们</Text>
                  <Text className='p'>如对隐私政策有疑问，请联系园区管理员。</Text>
                </View>
              )}
            </ScrollView>
            <View className='agreement-footer' onClick={() => { setAgreed(true); setShowAgreement(null) }}>
              <Text>我已阅读并同意</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
