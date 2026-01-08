/**
 * 阿里云 OSS 存储服务
 * 国内访问稳定，替代 Supabase
 */

import OSS from 'ali-oss';
import { STORAGE_KEYS } from './storageService';

// 阿里云 OSS 配置
const OSS_CONFIG = {
  region: 'oss-cn-beijing',
  accessKeyId: 'LTAI5t8bGTe6ZJAuKSQXi3Di',
  accessKeySecret: 'eu2urgQIcJ6eK0s87UkZLEbgk1qacj',
  bucket: 'venus-data',
};

// OSS 客户端实例
let ossClient: OSS | null = null;

// 初始化 OSS 客户端
function getOssClient(): OSS {
  if (!ossClient) {
    ossClient = new OSS({
      region: OSS_CONFIG.region,
      accessKeyId: OSS_CONFIG.accessKeyId,
      accessKeySecret: OSS_CONFIG.accessKeySecret,
      bucket: OSS_CONFIG.bucket,
    });
  }
  return ossClient;
}

// 检查 OSS 是否已配置
export const isAliyunConfigured = 
  OSS_CONFIG.accessKeyId !== '' && 
  OSS_CONFIG.accessKeySecret !== '' &&
  OSS_CONFIG.bucket !== '';

// 存储键到文件路径的映射
function getFilePath(storageKey: string): string {
  return `jinxing-edu/${storageKey}.json`;
}

// 防抖计时器
const debounceTimers: Record<string, NodeJS.Timeout> = {};
const DEBOUNCE_DELAY = 500; // 500ms防抖

/**
 * 上传数据到阿里云 OSS
 */
export async function uploadToAliyun(storageKey: string, data: any[]): Promise<boolean> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过上传');
    return false;
  }

  try {
    const client = getOssClient();
    const filePath = getFilePath(storageKey);
    const content = JSON.stringify(data, null, 2);
    
    // 使用Blob替代Buffer（浏览器兼容）
    const blob = new Blob([content], { type: 'application/json; charset=utf-8' });
    
    await client.put(filePath, blob, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
    
    console.log(`[AliyunOSS] ✅ 上传成功: ${storageKey} (${data.length}条)`);
    return true;
  } catch (error: any) {
    console.error(`[AliyunOSS] ❌ 上传失败: ${storageKey}`, error.message);
    return false;
  }
}

/**
 * 从阿里云 OSS 下载数据
 */
export async function downloadFromAliyun<T>(storageKey: string): Promise<T[]> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过下载');
    return [];
  }

  try {
    const client = getOssClient();
    const filePath = getFilePath(storageKey);
    
    const result = await client.get(filePath);
    
    // 浏览器环境处理响应内容
    let content: string;
    if (result.content instanceof Blob) {
      content = await result.content.text();
    } else if (typeof result.content === 'string') {
      content = result.content;
    } else if (result.content && result.content.toString) {
      content = result.content.toString('utf-8');
    } else {
      content = JSON.stringify(result.content);
    }
    
    const data = JSON.parse(content);
    console.log(`[AliyunOSS] ✅ 下载成功: ${storageKey} (${data.length}条)`);
    return data;
  } catch (error: any) {
    if (error.code === 'NoSuchKey' || error.status === 404) {
      console.log(`[AliyunOSS] 文件不存在: ${storageKey}，返回空数组`);
      return [];
    }
    console.error(`[AliyunOSS] ❌ 下载失败: ${storageKey}`, error.message);
    return [];
  }
}

/**
 * 同步数据到阿里云（带防抖）
 */
export function syncToAliyun(storageKey: string): void {
  if (!isAliyunConfigured) return;

  // 清除之前的计时器
  if (debounceTimers[storageKey]) {
    clearTimeout(debounceTimers[storageKey]);
  }

  // 设置新的防抖计时器
  debounceTimers[storageKey] = setTimeout(async () => {
    try {
      const localData = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (localData.length > 0) {
        await uploadToAliyun(storageKey, localData);
      }
    } catch (err) {
      console.error(`[AliyunOSS] 同步失败: ${storageKey}`, err);
    }
  }, DEBOUNCE_DELAY);
}

/**
 * 从阿里云初始化所有数据
 */
export async function initializeFromAliyun(): Promise<void> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过初始化');
    return;
  }

  console.log('[AliyunOSS] 🚀 开始从阿里云初始化数据...');

  const keysToSync = [
    STORAGE_KEYS.STUDENTS,
    STORAGE_KEYS.STAFF,
    STORAGE_KEYS.OPERATION_LOGS,
    STORAGE_KEYS.ANNOUNCEMENTS,
    STORAGE_KEYS.DOCUMENTS,
    STORAGE_KEYS.VISITORS,
    STORAGE_KEYS.HEALTH_RECORDS,
    STORAGE_KEYS.ATTENDANCE_RECORDS,
    STORAGE_KEYS.MEAL_PLANS,
  ];

  for (const key of keysToSync) {
    try {
      // 获取本地数据
      const localData: { id: string }[] = JSON.parse(localStorage.getItem(key) || '[]');
      
      // 获取云端数据
      const cloudData = await downloadFromAliyun<{ id: string }>(key);
      
      if (localData.length > 0 && cloudData.length === 0) {
        // 本地有数据，云端没有 → 上传
        console.log(`[AliyunOSS] 📤 ${key}: 上传本地${localData.length}条到云端`);
        await uploadToAliyun(key, localData);
      } else if (cloudData.length > 0) {
        // 云端有数据 → 合并
        const merged = mergeData(localData, cloudData);
        localStorage.setItem(key, JSON.stringify(merged));
        console.log(`[AliyunOSS] 📥 ${key}: 云端${cloudData.length}条，合并后${merged.length}条`);
        
        // 如果合并后数据更多，也上传回云端
        if (merged.length > cloudData.length) {
          await uploadToAliyun(key, merged);
        }
      }
    } catch (err) {
      console.error(`[AliyunOSS] 初始化 ${key} 失败:`, err);
    }
  }

  console.log('[AliyunOSS] ✅ 初始化完成');
}

/**
 * 合并本地和云端数据
 */
function mergeData<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const merged = new Map<string, T>();

  // 先添加本地数据
  local.forEach(item => merged.set(item.id, item));

  // 用云端数据覆盖同ID的项
  cloud.forEach(item => merged.set(item.id, item));

  return Array.from(merged.values());
}

/**
 * 检查阿里云连接状态
 */
export async function checkAliyunHealth(): Promise<{ isHealthy: boolean; latency?: number; error?: string }> {
  if (!isAliyunConfigured) {
    return { isHealthy: false, error: '未配置' };
  }

  const startTime = Date.now();

  try {
    const client = getOssClient();
    // 尝试列出文件来检查连接
    await client.list({ prefix: 'jinxing-edu/', 'max-keys': 1 });
    
    const latency = Date.now() - startTime;
    return { isHealthy: true, latency };
  } catch (error: any) {
    return { isHealthy: false, error: error.message };
  }
}

/**
 * 获取同步状态
 */
export function getSyncStatus() {
  return {
    enabled: isAliyunConfigured,
    provider: '阿里云 OSS',
    region: OSS_CONFIG.region,
    bucket: OSS_CONFIG.bucket,
  };
}

