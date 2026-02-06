import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import './index.scss'

interface NavBarProps {
  title?: string
  backgroundColor?: string
  textColor?: string
  showBack?: boolean
  onBack?: () => void
}

export default function NavBar({ 
  title = '', 
  backgroundColor = '#1e293b',
  textColor = '#ffffff',
  showBack = true,
  onBack
}: NavBarProps) {
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [navBarHeight, setNavBarHeight] = useState(44)

  useEffect(() => {
    // 获取系统信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    // 获取胶囊按钮位置（用于计算导航栏高度）
    try {
      const menuButton = Taro.getMenuButtonBoundingClientRect()
      const navHeight = (menuButton.top - systemInfo.statusBarHeight!) * 2 + menuButton.height
      setNavBarHeight(navHeight)
    } catch (e) {
      // 降级处理
      setNavBarHeight(44)
    }
  }, [])

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else {
      const pages = Taro.getCurrentPages()
      if (pages.length > 1) {
        Taro.navigateBack()
      } else {
        // 如果没有上一页，跳转到首页
        Taro.switchTab({ url: '/pages/index/index' })
      }
    }
  }

  const totalHeight = statusBarHeight + navBarHeight

  return (
    <View 
      className='nav-bar' 
      style={{ 
        backgroundColor,
        paddingTop: `${statusBarHeight}px`,
        height: `${totalHeight}px`
      }}
    >
      <View className='nav-bar-content' style={{ height: `${navBarHeight}px` }}>
        {showBack && (
          <View className='nav-back' onClick={handleBack}>
            <Text className='back-icon' style={{ color: textColor }}>‹</Text>
            <Text className='back-text' style={{ color: textColor }}>返回</Text>
          </View>
        )}
        <View className='nav-title'>
          <Text style={{ color: textColor }}>{title}</Text>
        </View>
        <View className='nav-right' />
      </View>
    </View>
  )
}

// 导出占位组件，用于撑开页面内容
export function NavBarPlaceholder() {
  const [height, setHeight] = useState(64)

  useEffect(() => {
    const systemInfo = Taro.getSystemInfoSync()
    const statusBarHeight = systemInfo.statusBarHeight || 20
    
    try {
      const menuButton = Taro.getMenuButtonBoundingClientRect()
      const navHeight = (menuButton.top - systemInfo.statusBarHeight!) * 2 + menuButton.height
      // 增加12px额外间距
      setHeight(statusBarHeight + navHeight + 12)
    } catch (e) {
      setHeight(statusBarHeight + 44 + 12)
    }
  }, [])

  return <View style={{ height: `${height}px` }} />
}
