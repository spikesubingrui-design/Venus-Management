/**
 * 阿里云 OSS 存储服务
 * 国内访问稳定，替代 Supabase
 * 支持大数据分批上传
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

// 分批上传配置
const BATCH_SIZE = 200; // 每批最多200条记录
const LARGE_DATA_THRESHOLD = 300; // 超过300条启用分批上传

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
      timeout: 120000, // 增加超时时间到2分钟
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

// 获取分批文件路径
function getBatchFilePath(storageKey: string, batchIndex: number): string {
  return `jinxing-edu/${storageKey}_part${batchIndex}.json`;
}

// 获取索引文件路径
function getIndexFilePath(storageKey: string): string {
  return `jinxing-edu/${storageKey}_index.json`;
}

// 防抖计时器
const debounceTimers: Record<string, NodeJS.Timeout> = {};
const DEBOUNCE_DELAY = 500;

/**
 * 分批上传大数据到阿里云 OSS
 */
async function uploadInBatches(storageKey: string, data: any[]): Promise<boolean> {
  const client = getOssClient();
  const totalBatches = Math.ceil(data.length / BATCH_SIZE);
  
  console.log(`[AliyunOSS] 📦 开始分批上传 ${storageKey}: ${data.length}条数据，分${totalBatches}批`);
  
  const batchResults: { batchIndex: number; count: number; success: boolean }[] = [];
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * BATCH_SIZE;
    const end = Math.min(start + BATCH_SIZE, data.length);
    const batchData = data.slice(start, end);
    const batchPath = getBatchFilePath(storageKey, i);
    
    try {
      const content = JSON.stringify(batchData);
      const blob = new Blob([content], { type: 'application/json; charset=utf-8' });
      
      await client.put(batchPath, blob, {
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
      
      console.log(`[AliyunOSS] ✅ 批次 ${i + 1}/${totalBatches} 上传成功 (${batchData.length}条)`);
      batchResults.push({ batchIndex: i, count: batchData.length, success: true });
    } catch (error: any) {
      console.error(`[AliyunOSS] ❌ 批次 ${i + 1}/${totalBatches} 上传失败:`, error.message);
      batchResults.push({ batchIndex: i, count: batchData.length, success: false });
    }
    
    // 批次间延迟，避免请求过快
    if (i < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  
  // 上传索引文件
  const indexData = {
    storageKey,
    totalRecords: data.length,
    totalBatches,
    batchSize: BATCH_SIZE,
    batches: batchResults,
    updatedAt: new Date().toISOString(),
  };
  
  try {
    const indexPath = getIndexFilePath(storageKey);
    const indexBlob = new Blob([JSON.stringify(indexData, null, 2)], { type: 'application/json; charset=utf-8' });
    await client.put(indexPath, indexBlob, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    console.log(`[AliyunOSS] 📋 索引文件上传成功`);
  } catch (error: any) {
    console.error(`[AliyunOSS] ❌ 索引文件上传失败:`, error.message);
  }
  
  const successCount = batchResults.filter(r => r.success).length;
  console.log(`[AliyunOSS] 📊 分批上传完成: ${successCount}/${totalBatches} 批成功`);
  
  return successCount === totalBatches;
}

/**
 * 从阿里云 OSS 下载分批数据
 */
async function downloadInBatches<T>(storageKey: string): Promise<T[]> {
  const client = getOssClient();
  
  // 先尝试下载索引文件
  try {
    const indexPath = getIndexFilePath(storageKey);
    const indexResult = await client.get(indexPath);
    
    let indexContent: string;
    if (indexResult.content instanceof Blob) {
      indexContent = await indexResult.content.text();
    } else if (typeof indexResult.content === 'string') {
      indexContent = indexResult.content;
    } else {
      indexContent = indexResult.content.toString('utf-8');
    }
    
    const indexData = JSON.parse(indexContent);
    console.log(`[AliyunOSS] 📋 发现分批数据: ${indexData.totalRecords}条，${indexData.totalBatches}批`);
    
    // 下载所有批次
    const allData: T[] = [];
    for (let i = 0; i < indexData.totalBatches; i++) {
      try {
        const batchPath = getBatchFilePath(storageKey, i);
        const batchResult = await client.get(batchPath);
        
        let batchContent: string;
        if (batchResult.content instanceof Blob) {
          batchContent = await batchResult.content.text();
        } else if (typeof batchResult.content === 'string') {
          batchContent = batchResult.content;
        } else {
          batchContent = batchResult.content.toString('utf-8');
        }
        
        const batchData = JSON.parse(batchContent);
        allData.push(...batchData);
        console.log(`[AliyunOSS] ✅ 批次 ${i + 1}/${indexData.totalBatches} 下载成功 (${batchData.length}条)`);
      } catch (error: any) {
        console.error(`[AliyunOSS] ❌ 批次 ${i + 1} 下载失败:`, error.message);
      }
      
      // 批次间延迟
      if (i < indexData.totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    console.log(`[AliyunOSS] ✅ 分批下载完成: ${storageKey} (${allData.length}条)`);
    return allData;
  } catch (error: any) {
    // 索引文件不存在，说明不是分批数据
    if (error.code === 'NoSuchKey' || error.status === 404) {
      return []; // 返回空，让调用者尝试下载单文件
    }
    throw error;
  }
}

/**
 * 上传数据到阿里云 OSS（自动判断是否分批）
 */
export async function uploadToAliyun(storageKey: string, data: any[]): Promise<boolean> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过上传');
    return false;
  }

  // 大数据使用分批上传
  if (data.length > LARGE_DATA_THRESHOLD) {
    return await uploadInBatches(storageKey, data);
  }

  // 小数据直接上传
  try {
    const client = getOssClient();
    const filePath = getFilePath(storageKey);
    const content = JSON.stringify(data, null, 2);
    const blob = new Blob([content], { type: 'application/json; charset=utf-8' });
    
    await client.put(filePath, blob, {
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
    
    console.log(`[AliyunOSS] ✅ 上传成功: ${storageKey} (${data.length}条)`);
    return true;
  } catch (error: any) {
    console.error(`[AliyunOSS] ❌ 上传失败: ${storageKey}`, error.message);
    return false;
  }
}

/**
 * 从阿里云 OSS 下载数据（自动判断是否分批）
 */
export async function downloadFromAliyun<T>(storageKey: string): Promise<T[]> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过下载');
    return [];
  }

  try {
    // 先尝试下载分批数据
    const batchData = await downloadInBatches<T>(storageKey);
    if (batchData.length > 0) {
      return batchData;
    }
    
    // 没有分批数据，尝试下载单文件
    const client = getOssClient();
    const filePath = getFilePath(storageKey);
    const result = await client.get(filePath);
    
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

  if (debounceTimers[storageKey]) {
    clearTimeout(debounceTimers[storageKey]);
  }

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
 * 数据去重函数
 */
function deduplicateData<T extends { id: string; name?: string }>(data: T[]): T[] {
  const seen = new Map<string, T>();
  const nameCount = new Map<string, number>();
  
  for (const item of data) {
    // 优先按 ID 去重
    if (!seen.has(item.id)) {
      seen.set(item.id, item);
      // 统计同名数量
      if (item.name) {
        nameCount.set(item.name, (nameCount.get(item.name) || 0) + 1);
      }
    }
  }
  
  const result = Array.from(seen.values());
  console.log(`[AliyunOSS] 🧹 去重: ${data.length} → ${result.length} 条`);
  
  // 检查是否有重名
  const duplicateNames = Array.from(nameCount.entries()).filter(([, count]) => count > 1);
  if (duplicateNames.length > 0) {
    console.warn(`[AliyunOSS] ⚠️ 发现重名: ${duplicateNames.map(([n, c]) => `${n}(${c})`).join(', ')}`);
  }
  
  return result;
}

/**
 * 从阿里云初始化数据（本地优先模式，不自动覆盖）
 * 只有在本地没有数据时才从云端下载
 */
export async function initializeFromAliyun(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过初始化');
    return { success: false, results: {} };
  }

  console.log('[AliyunOSS] 🚀 开始初始化（本地优先模式）...');

  const keysToSync = [
    STORAGE_KEYS.ALL_USERS,           // 用户数据
    STORAGE_KEYS.AUTHORIZED_PHONES,   // 授权手机号
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

  const results: Record<string, { count: number; error?: string }> = {};
  let hasError = false;

  for (let i = 0; i < keysToSync.length; i++) {
    const key = keysToSync[i];
    onProgress?.(i + 1, keysToSync.length, key);

    try {
      // 先检查本地数据
      const localData: { id: string; name?: string }[] = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (localData.length > 0) {
        // 本地有数据：对本地数据去重，不从云端下载
        const dedupedLocal = deduplicateData(localData);
        if (dedupedLocal.length !== localData.length) {
          localStorage.setItem(key, JSON.stringify(dedupedLocal));
          console.log(`[AliyunOSS] 📋 ${key}: 本地数据去重 ${localData.length} → ${dedupedLocal.length}`);
        } else {
          console.log(`[AliyunOSS] ✅ ${key}: 使用本地数据 ${localData.length} 条`);
        }
        results[key] = { count: dedupedLocal.length };
      } else {
        // 本地无数据：从云端下载
        const cloudData = await downloadFromAliyun<{ id: string; name?: string }>(key);
        if (cloudData.length > 0) {
          const dedupedCloud = deduplicateData(cloudData);
          localStorage.setItem(key, JSON.stringify(dedupedCloud));
          console.log(`[AliyunOSS] 📥 ${key}: 从云端下载 ${dedupedCloud.length} 条`);
          results[key] = { count: dedupedCloud.length };
        } else {
          results[key] = { count: 0 };
        }
      }
    } catch (err: any) {
      console.error(`[AliyunOSS] 初始化 ${key} 失败:`, err);
      results[key] = { count: 0, error: err.message };
      hasError = true;
    }
  }

  localStorage.setItem('kt_last_sync_time', new Date().toISOString());
  console.log('[AliyunOSS] ✅ 初始化完成');

  return { success: !hasError, results };
}

/**
 * 上传所有数据到阿里云（带进度回调）
 */
export async function uploadAllToAliyun(
  onProgress?: (current: number, total: number, key: string) => void
): Promise<{ success: boolean; results: Record<string, { count: number; error?: string }> }> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置，跳过上传');
    return { success: false, results: {} };
  }

  console.log('[AliyunOSS] 🚀 开始上传所有数据...');

  const keysToSync = [
    STORAGE_KEYS.ALL_USERS,           // 用户数据
    STORAGE_KEYS.AUTHORIZED_PHONES,   // 授权手机号
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

  const results: Record<string, { count: number; error?: string }> = {};
  let hasError = false;

  for (let i = 0; i < keysToSync.length; i++) {
    const key = keysToSync[i];
    onProgress?.(i + 1, keysToSync.length, key);

    try {
      const localData = JSON.parse(localStorage.getItem(key) || '[]');
      
      if (localData.length > 0) {
        const success = await uploadToAliyun(key, localData);
        results[key] = { count: localData.length };
        if (!success) {
          results[key].error = '上传失败';
          hasError = true;
        }
      } else {
        results[key] = { count: 0 };
      }
    } catch (err: any) {
      results[key] = { count: 0, error: err.message };
      hasError = true;
      console.error(`[AliyunOSS] 上传 ${key} 失败:`, err);
    }
  }

  localStorage.setItem('kt_last_sync_time', new Date().toISOString());
  console.log('[AliyunOSS] ✅ 上传完成');

  return { success: !hasError, results };
}

/**
 * 手动上传指定数据（用于大数据分批上传）
 */
export async function manualUpload(storageKey: string): Promise<boolean> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置');
    return false;
  }
  
  try {
    const localData = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (localData.length === 0) {
      console.log(`[AliyunOSS] ${storageKey} 无数据`);
      return true;
    }
    
    console.log(`[AliyunOSS] 🚀 手动上传 ${storageKey}: ${localData.length}条`);
    return await uploadToAliyun(storageKey, localData);
  } catch (err) {
    console.error(`[AliyunOSS] 手动上传失败:`, err);
    return false;
  }
}

/**
 * 清理本地重复数据（根据ID去重）
 */
export function cleanupDuplicates(storageKey: string): { before: number; after: number } {
  try {
    const data: { id: string }[] = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const before = data.length;
    
    // 使用Map按ID去重，保留最新的
    const uniqueMap = new Map<string, any>();
    data.forEach(item => {
      if (item.id) {
        uniqueMap.set(item.id, item);
      }
    });
    
    const uniqueData = Array.from(uniqueMap.values());
    localStorage.setItem(storageKey, JSON.stringify(uniqueData));
    
    console.log(`[AliyunOSS] 🧹 ${storageKey}: ${before}条 → ${uniqueData.length}条`);
    return { before, after: uniqueData.length };
  } catch (err) {
    console.error(`[AliyunOSS] 清理失败:`, err);
    return { before: 0, after: 0 };
  }
}

/**
 * 清理所有数据的重复项
 */
export function cleanupAllDuplicates(): Record<string, { before: number; after: number }> {
  const results: Record<string, { before: number; after: number }> = {};
  
  const keys = [
    STORAGE_KEYS.STUDENTS,
    STORAGE_KEYS.STAFF,
    STORAGE_KEYS.OPERATION_LOGS,
    STORAGE_KEYS.ANNOUNCEMENTS,
    STORAGE_KEYS.DOCUMENTS,
  ];
  
  keys.forEach(key => {
    results[key] = cleanupDuplicates(key);
  });
  
  return results;
}

/**
 * 合并本地和云端数据
 */
function mergeData<T extends { id: string }>(local: T[], cloud: T[]): T[] {
  const merged = new Map<string, T>();
  local.forEach(item => merged.set(item.id, item));
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

/**
 * 删除云端指定数据文件
 */
export async function deleteCloudData(storageKey: string): Promise<boolean> {
  if (!isAliyunConfigured) {
    console.log('[AliyunOSS] 未配置');
    return false;
  }

  try {
    const client = getOssClient();
    const filePath = getFilePath(storageKey);
    
    // 删除主文件
    try {
      await client.delete(filePath);
      console.log(`[AliyunOSS] 🗑️ 已删除: ${filePath}`);
    } catch (e) {
      // 文件可能不存在，忽略
    }
    
    // 删除分批文件
    const indexPath = `${filePath.replace('.json', '')}_index.json`;
    try {
      const indexResult = await client.get(indexPath);
      let content: string;
      if (indexResult.content instanceof Blob) {
        content = await indexResult.content.text();
      } else {
        content = indexResult.content?.toString?.('utf-8') || '';
      }
      
      const indexData = JSON.parse(content);
      if (indexData.totalBatches) {
        // 删除所有分批文件
        for (let i = 0; i < indexData.totalBatches; i++) {
          const batchPath = `${filePath.replace('.json', '')}_batch_${i}.json`;
          try {
            await client.delete(batchPath);
            console.log(`[AliyunOSS] 🗑️ 已删除: ${batchPath}`);
          } catch (e) {
            // 忽略
          }
        }
        // 删除索引文件
        await client.delete(indexPath);
        console.log(`[AliyunOSS] 🗑️ 已删除: ${indexPath}`);
      }
    } catch (e) {
      // 索引文件不存在，忽略
    }
    
    console.log(`[AliyunOSS] ✅ 云端 ${storageKey} 数据已清除`);
    return true;
  } catch (error: any) {
    console.error(`[AliyunOSS] ❌ 删除失败: ${storageKey}`, error.message);
    return false;
  }
}

/**
 * 清理云端学生数据并重新上传本地数据
 */
export async function resetCloudStudents(): Promise<{ success: boolean; count: number }> {
  console.log('[AliyunOSS] 🔄 开始重置云端学生数据...');
  
  // 1. 删除云端学生数据
  await deleteCloudData(STORAGE_KEYS.STUDENTS);
  
  // 2. 获取本地学生数据并去重
  const localStudents: { id: string; name?: string }[] = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.STUDENTS) || '[]'
  );
  
  const dedupedStudents = deduplicateData(localStudents);
  
  // 3. 保存去重后的本地数据
  localStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(dedupedStudents));
  
  // 4. 上传到云端
  if (dedupedStudents.length > 0) {
    const success = await uploadToAliyun(STORAGE_KEYS.STUDENTS, dedupedStudents);
    console.log(`[AliyunOSS] ✅ 云端学生数据已重置: ${dedupedStudents.length} 条`);
    return { success, count: dedupedStudents.length };
  }
  
  return { success: true, count: 0 };
}
