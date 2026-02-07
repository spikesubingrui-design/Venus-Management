/**
 * Icon 组件 - 简洁可靠版
 */

import { View, Text } from '@tarojs/components'
import './index.scss'

interface IconProps {
  name: string
  size?: number
  color?: string
  className?: string
  onClick?: (e: any) => void
}

// 简单图标映射（使用常见 emoji，确保微信小程序支持）
const iconMap: Record<string, string> = {
  // 导航
  'home': '🏠',
  'location': '📍',
  'search': '🔍',
  'menu': '☰',
  'settings': '⚙️',
  'refresh': '🔄',
  
  // 用户
  'user': '👤',
  'users': '👥',
  'family': '👨‍👩‍👧',
  'teacher': '👨‍🏫',
  
  // 幼儿园
  'school': '🏫',
  'clipboard': '📋',
  'clipboard-check': '📝',
  'attendance': '✅',
  
  // 健康
  'thermometer': '🌡️',
  'heart': '❤️',
  'shield': '🛡️',
  'alert-triangle': '⚠️',
  'activity': '💓',
  
  // 交通
  'car': '🚗',
  'bus': '🚌',
  
  // 财务
  'dollar': '💰',
  'wallet': '👛',
  'trending-up': '📈',
  'trending-down': '📉',
  'receipt': '🧾',
  
  // 食物
  'utensils': '🍴',
  'meal': '🍽️',
  'coffee': '☕',
  'apple': '🍎',
  
  // 文档
  'file': '📄',
  'file-text': '📃',
  'folder': '📁',
  'book': '📖',
  
  // 图表
  'chart': '📊',
  'chart-pie': '📊',
  
  // 通信
  'phone': '📱',
  'message': '💬',
  'bell': '🔔',
  'mail': '✉️',
  
  // 时间
  'clock': '⏰',
  'calendar': '📅',
  'timer': '⏱️',
  
  // 媒体
  'camera': '📷',
  'image': '🖼️',
  'video': '🎥',
  
  // 成长
  'seedling': '🌱',
  'growth': '📈',
  'award': '🏆',
  'star': '⭐',
  
  // 操作
  'check': '✅',
  'close': '❌',
  'plus': '➕',
  'minus': '➖',
  'edit': '✏️',
  'delete': '🗑️',
  'save': '💾',
  'logout': '🚪',
  
  // 其他
  'eye': '👁️',
  'lock': '🔒',
  'unlock': '🔓',
  'download': '⬇️',
  'upload': '⬆️',
  'share': '📤',
  'link': '🔗',
  'globe': '🌐',
  'sun': '☀️',
  'moon': '🌙',
  'info': 'ℹ️',
  'help': '❓',
  'scale': '⚖️',
}

// emoji 映射
const emojiMap: Record<string, string> = {
  '🏠': 'home', '📍': 'location', '🔍': 'search', '⚙️': 'settings', '🔄': 'refresh',
  '👤': 'user', '👥': 'users', '👨‍👩‍👧': 'family', '👪': 'family', '👨‍🏫': 'teacher',
  '🏫': 'school', '📋': 'clipboard', '📝': 'clipboard-check', '✅': 'attendance',
  '🌡️': 'thermometer', '❤️': 'heart', '🛡️': 'shield', '⚠️': 'alert-triangle',
  '🚗': 'car', '🚌': 'bus',
  '💰': 'dollar', '👛': 'wallet', '📈': 'trending-up', '📉': 'trending-down',
  '🍴': 'utensils', '🍲': 'meal', '🥗': 'meal', '☕': 'coffee',
  '📄': 'file', '📁': 'folder', '📖': 'book',
  '📊': 'chart', '🧭': 'location',
  '📱': 'phone', '💬': 'message', '🔔': 'bell',
  '⏰': 'clock', '📅': 'calendar',
  '📷': 'camera', '🎥': 'video',
  '🌱': 'seedling', '🏆': 'award', '⭐': 'star',
  '✏️': 'edit', '🗑️': 'delete', '💾': 'save',
  '🔒': 'lock', '🔓': 'unlock', '🌐': 'globe',
}

export default function Icon({ 
  name, 
  size = 48, 
  color = '333333',
  className = '',
  onClick 
}: IconProps) {
  // 获取图标名
  const iconName = emojiMap[name] || name
  // 获取图标字符
  const iconChar = iconMap[iconName] || name
  
  return (
    <View 
      className={`icon-container ${className}`}
      style={{
        width: `${size}rpx`,
        height: `${size}rpx`,
      }}
      onClick={onClick}
    >
      <Text 
        className='icon-text'
        style={{
          fontSize: `${size * 0.6}rpx`,
          color: `#${color}`,
          lineHeight: `${size}rpx`,
        }}
      >
        {iconChar}
      </Text>
    </View>
  )
}
