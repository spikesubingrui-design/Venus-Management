import { PropsWithChildren, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { downloadAllData, isAliyunConfigured } from './services/aliyunOssService'
import './app.scss'

// 数据版本号 - 每次Excel数据更新时递增
const DATA_VERSION = 2

function App({ children }: PropsWithChildren<any>) {
  
  useEffect(() => {
    // 应用启动时强制同步数据
    autoSyncOnLaunch()
  }, [])

  const autoSyncOnLaunch = async () => {
    if (!isAliyunConfigured) {
      console.log('[App] 云端未配置，跳过自动同步')
      return
    }

    const localStudents = Taro.getStorageSync('kt_students') || []
    const localStaff = Taro.getStorageSync('kt_staff') || []
    const savedVersion = Taro.getStorageSync('kt_data_version') || 0
    
    // 强制同步条件：
    // 1. 本地无数据
    // 2. 数据版本不匹配（Excel有更新）
    // 3. 学生数据明显异常（超过200条说明有重复）
    const needsForceSync = 
      localStudents.length === 0 || 
      localStaff.length === 0 ||
      savedVersion < DATA_VERSION ||
      localStudents.length > 200

    if (needsForceSync) {
      console.log(`[App] 需要强制同步: 本地学生${localStudents.length}, 教职工${localStaff.length}, 版本${savedVersion}/${DATA_VERSION}`)
      // 清除旧数据再下载
      if (localStudents.length > 200) {
        console.log('[App] 检测到异常数据，清除后重新下载')
        Taro.removeStorageSync('kt_students')
        Taro.removeStorageSync('kt_staff')
      }
    } else {
      // 非强制情况下检查冷却时间
      const lastSync = Taro.getStorageSync('kt_last_sync_time')
      if (lastSync) {
        const minutesSince = (Date.now() - new Date(lastSync).getTime()) / 60000
        if (minutesSince < 10) {
          console.log(`[App] ${Math.round(minutesSince)}分钟前已同步，跳过`)
          return
        }
      }
    }

    console.log('[App] 开始同步数据...')
    
    try {
      const result = await downloadAllData()
      if (result.success) {
        console.log(`[App] 同步完成: 学生${result.students}, 教职工${result.staff}`)
        Taro.setStorageSync('kt_last_sync_time', new Date().toISOString())
        Taro.setStorageSync('kt_data_version', DATA_VERSION)
      } else {
        console.log('[App] 同步失败:', result.error)
      }
    } catch (err) {
      console.error('[App] 同步异常:', err)
    }
  }

  return children
}

export default App
