import Taro from '@tarojs/taro'

// tabBar 页面白名单（与 taro-app/src/app.config.ts 保持一致）
const TAB_PAGES = new Set([
  '/pages/index/index',
  '/pages/students/index',
  '/pages/growth/index',
  '/pages/profile/index',
])

/**
 * 安全跳转：
 * - tabBar 页面（无参数）：使用 switchTab
 * - tabBar 页面（有参数）：先存参数，再 switchTab
 * - 非 tabBar 页面：navigateTo
 */
export async function safeGo(url: string): Promise<void> {
  // 解析URL，分离路径和参数
  const [path, queryString] = url.split('?')
  const isTabPage = TAB_PAGES.has(path)
  
  if (isTabPage) {
    // 如果有查询参数，存储到本地供目标页面读取
    if (queryString) {
      const params: Record<string, string> = {}
      queryString.split('&').forEach(pair => {
        const [key, value] = pair.split('=')
        if (key && value) {
          params[key] = decodeURIComponent(value)
        }
      })
      Taro.setStorageSync('_nav_params_' + path, params)
    }
    
    try {
      await Taro.switchTab({ url: path })
      return
    } catch (e) {
      // 降级处理
      await Taro.navigateTo({ url })
      return
    }
  }

  await Taro.navigateTo({ url })
}

/**
 * 获取跳转参数（用于tabBar页面）
 */
export function getNavParams(path: string): Record<string, string> | null {
  const key = '_nav_params_' + path
  const params = Taro.getStorageSync(key)
  if (params) {
    Taro.removeStorageSync(key) // 读取后清除
    return params
  }
  return null
}