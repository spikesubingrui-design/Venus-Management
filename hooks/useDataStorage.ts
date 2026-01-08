/**
 * 数据存储 Hook
 * 提供确认上传和电子留存功能
 */

import { useState, useCallback } from 'react';
import { User } from '../types';
import { 
  saveWithLog, 
  batchSaveWithLog, 
  getData, 
  saveData,
  logOperation,
  STORAGE_KEYS 
} from '../services/storageService';

interface UseDataStorageOptions {
  storageKey: string;
  module: string;
  type: string;
  currentUser: User;
}

interface PendingItem<T> {
  data: T;
  isUpdate: boolean;
  title: string;
  summary: string;
  details?: { label: string; value: string }[];
}

export function useDataStorage<T extends { id: string; name?: string; title?: string }>({
  storageKey,
  module,
  type,
  currentUser,
}: UseDataStorageOptions) {
  const [pendingUpload, setPendingUpload] = useState<PendingItem<T> | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // 获取所有数据
  const loadData = useCallback((): T[] => {
    return getData<T>(storageKey);
  }, [storageKey]);

  // 准备上传（显示确认弹窗）
  const prepareUpload = useCallback((
    data: T,
    options?: {
      title?: string;
      summary?: string;
      details?: { label: string; value: string }[];
    }
  ) => {
    const existingData = getData<T>(storageKey);
    const isUpdate = existingData.some(d => d.id === data.id);
    
    setPendingUpload({
      data,
      isUpdate,
      title: options?.title || data.name || data.title || data.id,
      summary: options?.summary || `${isUpdate ? '更新' : '新增'}${type}：${data.name || data.title || data.id}`,
      details: options?.details,
    });
    setShowConfirm(true);
  }, [storageKey, type]);

  // 确认上传
  const confirmUpload = useCallback(() => {
    if (!pendingUpload) return false;

    const success = saveWithLog(
      storageKey,
      pendingUpload.data,
      module,
      type,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      false
    );

    if (success) {
      setSuccessMessage(`${pendingUpload.isUpdate ? '更新' : '上传'}成功`);
      setShowSuccess(true);
    }

    setShowConfirm(false);
    setPendingUpload(null);
    return success;
  }, [pendingUpload, storageKey, module, type, currentUser]);

  // 取消上传
  const cancelUpload = useCallback(() => {
    setShowConfirm(false);
    setPendingUpload(null);
  }, []);

  // 直接保存（用于简单操作，会记录日志但不需要确认）
  const quickSave = useCallback((data: T, summary?: string) => {
    return saveWithLog(
      storageKey,
      data,
      module,
      type,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      false
    );
  }, [storageKey, module, type, currentUser]);

  // 删除（需要确认）
  const prepareDelete = useCallback((data: T) => {
    setPendingUpload({
      data,
      isUpdate: false, // 用于标识删除操作
      title: data.name || data.title || data.id,
      summary: `删除${type}：${data.name || data.title || data.id}`,
      details: [{ label: '操作类型', value: '删除' }],
    });
    setShowConfirm(true);
  }, [type]);

  // 确认删除
  const confirmDelete = useCallback(() => {
    if (!pendingUpload) return false;

    const success = saveWithLog(
      storageKey,
      pendingUpload.data,
      module,
      type,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      true // isDelete = true
    );

    if (success) {
      setSuccessMessage('删除成功');
      setShowSuccess(true);
    }

    setShowConfirm(false);
    setPendingUpload(null);
    return success;
  }, [pendingUpload, storageKey, module, type, currentUser]);

  // 批量保存
  const batchSave = useCallback((dataList: T[], summary: string) => {
    return batchSaveWithLog(
      storageKey,
      dataList,
      module,
      type,
      currentUser.id,
      currentUser.name,
      currentUser.role,
      summary
    );
  }, [storageKey, module, type, currentUser]);

  // 关闭成功提示
  const closeSuccess = useCallback(() => {
    setShowSuccess(false);
  }, []);

  return {
    // 数据操作
    loadData,
    prepareUpload,
    confirmUpload,
    cancelUpload,
    quickSave,
    prepareDelete,
    confirmDelete,
    batchSave,
    
    // 状态
    pendingUpload,
    showConfirm,
    showSuccess,
    successMessage,
    closeSuccess,
  };
}

/**
 * 简单日志记录（用于不需要确认的操作）
 */
export function useSimpleLog(currentUser: User) {
  const log = useCallback((
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONFIRM' | 'UPLOAD',
    module: string,
    targetType: string,
    targetId: string,
    targetName: string,
    summary: string,
    beforeData?: any,
    afterData?: any
  ) => {
    logOperation(
      currentUser.id,
      currentUser.name,
      currentUser.role,
      action,
      module,
      targetType,
      targetId,
      targetName,
      summary,
      beforeData,
      afterData
    );
  }, [currentUser]);

  return { log };
}

export { STORAGE_KEYS };








