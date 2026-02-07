/**
 * 全局分享配置 Hook
 * 在每个页面中调用，使右上角"..."菜单中的分享/转发功能可用
 */
import { useShareAppMessage, useShareTimeline } from '@tarojs/taro'

interface ShareOptions {
  title?: string
  path?: string
  imageUrl?: string
}

export default function useGlobalShare(options?: ShareOptions) {
  const defaultTitle = '金星幼儿园 - 智慧校园管理'
  const defaultPath = '/pages/index/index'

  // 分享给好友
  useShareAppMessage(() => {
    return {
      title: options?.title || defaultTitle,
      path: options?.path || defaultPath,
      imageUrl: options?.imageUrl || ''
    }
  })

  // 分享到朋友圈
  useShareTimeline(() => {
    return {
      title: options?.title || defaultTitle
    }
  })
}
