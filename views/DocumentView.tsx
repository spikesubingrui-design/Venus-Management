
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Folder, File, FileText, Image, Video, Music, Archive, Plus, Trash2, Edit2,
  Download, Share2, Lock, Unlock, Users, Search, Filter, ChevronRight, ChevronDown,
  FolderPlus, Upload, Eye, X, Shield, Check, AlertTriangle, Loader2
} from 'lucide-react';
import { User } from '../types';
import { hasPermission } from '../services/permissionService';

interface DocumentViewProps {
  currentUser: User;
}

// 文件/文件夹类型
interface DocumentItem {
  id: string;
  name: string;
  type: 'folder' | 'file';
  fileType?: 'doc' | 'pdf' | 'image' | 'video' | 'audio' | 'archive' | 'other';
  parentId: string | null;
  size?: number;
  url?: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  
  // 权限设置
  isPublic: boolean;
  accessRoles?: string[];  // 可访问的角色
  accessUsers?: string[];  // 可访问的用户ID
}

// 权限设置记录
interface AccessPermission {
  documentId: string;
  role?: string;
  userId?: string;
  permission: 'view' | 'edit' | 'admin';
  grantedBy: string;
  grantedAt: string;
}

const FILE_ICONS = {
  folder: { icon: Folder, color: 'text-amber-500 bg-amber-50' },
  doc: { icon: FileText, color: 'text-blue-500 bg-blue-50' },
  pdf: { icon: FileText, color: 'text-red-500 bg-red-50' },
  image: { icon: Image, color: 'text-emerald-500 bg-emerald-50' },
  video: { icon: Video, color: 'text-purple-500 bg-purple-50' },
  audio: { icon: Music, color: 'text-pink-500 bg-pink-50' },
  archive: { icon: Archive, color: 'text-slate-500 bg-slate-50' },
  other: { icon: File, color: 'text-slate-400 bg-slate-50' },
};

const ROLES = ['SUPER_ADMIN', 'ADMIN', 'TEACHER', 'KITCHEN', 'PARENT'];
const ROLE_NAMES: Record<string, string> = {
  'SUPER_ADMIN': '超级管理员',
  'ADMIN': '园区管理员',
  'TEACHER': '教师',
  'KITCHEN': '厨房人员',
  'PARENT': '家长',
};

const DocumentView: React.FC<DocumentViewProps> = ({ currentUser }) => {
  // 权限检查
  const canUpload = hasPermission(currentUser.role, 'document.upload');
  const canDelete = hasPermission(currentUser.role, 'document.delete');
  const canManagePermission = hasPermission(currentUser.role, 'document.permission');
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [permissions, setPermissions] = useState<AccessPermission[]>([]);
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<DocumentItem[]>([]);
  const [search, setSearch] = useState('');
  const [isCreateFolderModal, setIsCreateFolderModal] = useState(false);
  const [isUploadModal, setIsUploadModal] = useState(false);
  const [isPermissionModal, setIsPermissionModal] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // 文件上传相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('kt_documents');
    if (saved) {
      setDocuments(JSON.parse(saved));
    }
    // 不再预填充默认文件夹，由管理员自行创建
    
    const savedPermissions = localStorage.getItem('kt_document_permissions');
    if (savedPermissions) setPermissions(JSON.parse(savedPermissions));
  }, []);

  // 获取当前文件夹的内容
  const currentItems = documents.filter(d => d.parentId === currentFolder);
  const filteredItems = search 
    ? currentItems.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : currentItems;

  // 导航到文件夹
  const navigateToFolder = (folder: DocumentItem | null) => {
    if (folder) {
      setCurrentFolder(folder.id);
      setFolderPath(prev => [...prev, folder]);
    } else {
      setCurrentFolder(null);
      setFolderPath([]);
    }
  };

  // 返回上级
  const navigateUp = () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setCurrentFolder(newPath.length > 0 ? newPath[newPath.length - 1].id : null);
    }
  };

  // 创建文件夹
  const createFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newFolder: DocumentItem = {
      id: Date.now().toString(),
      name: fd.get('name') as string,
      type: 'folder',
      parentId: currentFolder,
      description: fd.get('description') as string,
      isPublic: fd.get('isPublic') === 'on',
      accessRoles: fd.get('isPublic') === 'on' ? undefined : (fd.getAll('roles') as string[]),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: '当前用户',
    };
    const updated = [...documents, newFolder];
    setDocuments(updated);
    localStorage.setItem('kt_documents', JSON.stringify(updated));
    setIsCreateFolderModal(false);
  };

  // 处理文件选择
  const handleFileSelect = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    // 限制文件大小 20MB
    if (file.size > 20 * 1024 * 1024) {
      alert('文件大小不能超过 20MB');
      return;
    }
    
    setUploadingFile(file);
  }, []);

  // 拖拽处理
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // 将文件转换为 base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // 上传文件
  const uploadFile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!uploadingFile) {
      alert('请先选择文件');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // 模拟上传进度
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 10;
        if (progress <= 90) {
          setUploadProgress(progress);
        }
      }, 100);
      
      // 转换文件为 base64
      const base64Data = await fileToBase64(uploadingFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      const fd = new FormData(e.currentTarget);
      const fileType = getFileType(uploadingFile.name);
      
      const newFile: DocumentItem = {
        id: Date.now().toString(),
        name: uploadingFile.name,
        type: 'file',
        fileType,
        parentId: currentFolder,
        url: base64Data, // 存储 base64 数据
        description: fd.get('description') as string || '',
        tags: (fd.get('tags') as string || '').split(',').map(t => t.trim()).filter(Boolean),
        size: uploadingFile.size,
        isPublic: fd.get('isPublic') === 'on',
        accessRoles: fd.get('isPublic') === 'on' ? undefined : (fd.getAll('roles') as string[]),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentUser.name,
      };
      
      // 保存到状态和 localStorage
      const updated = [...documents, newFile];
      setDocuments(updated);
      
      try {
        localStorage.setItem('kt_documents', JSON.stringify(updated));
      } catch (storageError) {
        console.error('存储空间不足:', storageError);
        alert('存储空间不足，文件过大无法保存。请尝试上传较小的文件（建议小于5MB）');
        return;
      }
      
      // 重置状态并关闭弹窗
      setIsUploadModal(false);
      setUploadingFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // 显示成功提示
      alert(`文件 "${uploadingFile.name}" 上传成功！`);
      
    } catch (error) {
      console.error('文件上传失败:', error);
      alert('文件上传失败: ' + (error instanceof Error ? error.message : '未知错误'));
    } finally {
      setIsUploading(false);
    }
  };
  
  // 清除选中的文件
  const clearUploadingFile = () => {
    setUploadingFile(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 获取文件类型
  const getFileType = (filename: string): DocumentItem['fileType'] => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['doc', 'docx', 'txt', 'rtf'].includes(ext || '')) return 'doc';
    if (['pdf'].includes(ext || '')) return 'pdf';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
    if (['mp4', 'avi', 'mov', 'wmv'].includes(ext || '')) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(ext || '')) return 'audio';
    if (['zip', 'rar', '7z'].includes(ext || '')) return 'archive';
    return 'other';
  };

  // 删除文档
  const deleteDocument = (id: string) => {
    // 递归删除子文件夹和文件
    const idsToDelete = new Set<string>();
    const collectIds = (parentId: string) => {
      idsToDelete.add(parentId);
      documents.filter(d => d.parentId === parentId).forEach(d => collectIds(d.id));
    };
    collectIds(id);
    
    const updated = documents.filter(d => !idsToDelete.has(d.id));
    setDocuments(updated);
    localStorage.setItem('kt_documents', JSON.stringify(updated));
  };

  // 保存权限
  const savePermissions = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedDocument) return;
    
    const fd = new FormData(e.currentTarget);
    const updatedDoc = {
      ...selectedDocument,
      isPublic: fd.get('isPublic') === 'on',
      accessRoles: fd.get('isPublic') === 'on' ? undefined : (fd.getAll('roles') as string[]),
      updatedAt: new Date().toISOString(),
    };
    
    const updated = documents.map(d => d.id === selectedDocument.id ? updatedDoc : d);
    setDocuments(updated);
    localStorage.setItem('kt_documents', JSON.stringify(updated));
    setIsPermissionModal(false);
    setSelectedDocument(null);
  };

  // 格式化文件大小
  const formatSize = (bytes?: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  // 预览文件
  const handleFileClick = (item: DocumentItem) => {
    if (item.type === 'folder') {
      navigateToFolder(item);
      return;
    }
    
    if (!item.url || item.url === '#') {
      alert('文件数据不可用');
      return;
    }
    
    // 设置预览文件
    setPreviewFile(item);
  };
  
  // 预览文件状态
  const [previewFile, setPreviewFile] = useState<DocumentItem | null>(null);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* 页面标题 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
            <Folder className="w-8 h-8 text-amber-600" />
            资料管理
          </h1>
          <p className="text-slate-400 mt-1">文件管理 · 文件夹授权 · 资源共享</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsCreateFolderModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50"
          >
            <FolderPlus className="w-4 h-4 text-amber-600" />新建文件夹
          </button>
          <button 
            onClick={() => setIsUploadModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl text-sm font-bold hover:bg-amber-700 shadow-lg"
          >
            <Upload className="w-4 h-4" />上传文件
          </button>
        </div>
      </div>

      {/* 面包屑导航 */}
      <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-slate-100">
        <button 
          onClick={() => navigateToFolder(null)} 
          className="text-sm font-bold text-amber-600 hover:underline"
        >
          根目录
        </button>
        {folderPath.map((folder, idx) => (
          <React.Fragment key={folder.id}>
            <ChevronRight className="w-4 h-4 text-slate-300" />
            <button 
              onClick={() => {
                setCurrentFolder(folder.id);
                setFolderPath(folderPath.slice(0, idx + 1));
              }}
              className="text-sm font-bold text-slate-600 hover:text-amber-600"
            >
              {folder.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* 工具栏 */}
      <div className="flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
          <input 
            type="text"
            placeholder="搜索文件..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 py-2 bg-white border border-slate-100 rounded-xl text-sm font-bold w-64"
          />
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="1" width="6" height="6" rx="1" />
              <rect x="9" y="1" width="6" height="6" rx="1" />
              <rect x="1" y="9" width="6" height="6" rx="1" />
              <rect x="9" y="9" width="6" height="6" rx="1" />
            </svg>
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-amber-100 text-amber-600' : 'text-slate-400 hover:bg-slate-100'}`}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <rect x="1" y="2" width="14" height="2" rx="0.5" />
              <rect x="1" y="7" width="14" height="2" rx="0.5" />
              <rect x="1" y="12" width="14" height="2" rx="0.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 文件列表 - 网格视图 */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredItems.map(item => {
            const iconConfig = item.type === 'folder' 
              ? FILE_ICONS.folder 
              : FILE_ICONS[item.fileType || 'other'];
            const IconComponent = iconConfig.icon;
            
            return (
              <div 
                key={item.id}
                className="bg-white p-4 rounded-2xl border border-slate-100 hover:shadow-lg transition-all cursor-pointer group"
                onClick={() => item.type === 'folder' ? navigateToFolder(item) : handleFileClick(item)}
              >
                <div className="relative">
                  <div className={`w-16 h-16 mx-auto rounded-2xl ${iconConfig.color} flex items-center justify-center mb-3`}>
                    <IconComponent className="w-8 h-8" />
                  </div>
                  
                  {/* 权限标识 */}
                  <div className="absolute top-0 right-0">
                    {item.isPublic ? (
                      <Unlock className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Lock className="w-4 h-4 text-amber-500" />
                    )}
                  </div>
                  
                  {/* 操作按钮 */}
                  <div className="absolute -top-2 -left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    {item.type === 'file' && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleFileClick(item); }}
                        className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-blue-50"
                        title="下载/预览"
                      >
                        <Download className="w-3 h-3 text-blue-600" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setSelectedDocument(item); setIsPermissionModal(true); }}
                      className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-slate-50"
                      title="权限设置"
                    >
                      <Shield className="w-3 h-3 text-amber-600" />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); if(confirm('确定删除吗？')) deleteDocument(item.id); }}
                      className="p-1.5 bg-white rounded-lg shadow-lg hover:bg-red-50"
                      title="删除"
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
                
                <h3 className="font-bold text-slate-800 text-sm text-center truncate" title={item.name}>{item.name}</h3>
                {item.type === 'file' && (
                  <p className="text-xs text-slate-400 text-center">{formatSize(item.size)}</p>
                )}
                {item.type === 'folder' && (
                  <p className="text-xs text-amber-500 text-center">点击打开</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 文件列表 - 列表视图 */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">名称</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">类型</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">大小</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">权限</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">修改日期</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => {
                const iconConfig = item.type === 'folder' 
                  ? FILE_ICONS.folder 
                  : FILE_ICONS[item.fileType || 'other'];
                const IconComponent = iconConfig.icon;
                
                return (
                  <tr 
                    key={item.id} 
                    className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer"
                    onClick={() => item.type === 'folder' ? navigateToFolder(item) : handleFileClick(item)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${iconConfig.color}`}>
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-slate-800">{item.name}</span>
                          {item.type === 'folder' && (
                            <p className="text-xs text-amber-500">点击打开</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.type === 'folder' ? '文件夹' : item.fileType?.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {item.type === 'file' ? formatSize(item.size) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {item.isPublic ? (
                        <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs font-bold flex items-center gap-1 w-fit">
                          <Unlock className="w-3 h-3" />公开
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-bold flex items-center gap-1 w-fit">
                          <Lock className="w-3 h-3" />限制
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.type === 'file' && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleFileClick(item); }}
                            className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                            title="下载/预览"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedDocument(item); setIsPermissionModal(true); }}
                          className="p-2 hover:bg-amber-50 rounded-lg text-amber-600"
                          title="权限设置"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); if(confirm('确定删除吗？')) deleteDocument(item.id); }}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                          title="删除"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredItems.length === 0 && (
            <div className="py-12 text-center">
              <Folder className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-bold">此文件夹为空</p>
            </div>
          )}
        </div>
      )}

      {/* 新建文件夹弹窗 */}
      {isCreateFolderModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={createFolder} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <FolderPlus className="w-6 h-6 text-amber-500" />
              新建文件夹
            </h2>
            
            <div className="space-y-4">
              <input required name="name" placeholder="文件夹名称 *" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              <textarea name="description" placeholder="描述（选填）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" />
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isPublic" className="w-4 h-4 rounded text-amber-600" />
                  <span className="text-sm font-bold text-slate-600">公开访问（所有人可见）</span>
                </label>
                
                <p className="text-xs font-bold text-slate-400">或选择可访问的角色：</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="roles" value={role} className="w-4 h-4 rounded text-amber-600" />
                      <span className="text-sm text-slate-600">{ROLE_NAMES[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setIsCreateFolderModal(false)} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg">创建</button>
            </div>
          </form>
        </div>
      )}

      {/* 上传文件弹窗 */}
      {isUploadModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={uploadFile} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Upload className="w-6 h-6 text-amber-500" />
                上传文件
              </h2>
              <button 
                type="button" 
                onClick={() => { setIsUploadModal(false); clearUploadingFile(); }}
                className="p-2 hover:bg-slate-100 rounded-full"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            <div className="space-y-4">
              {/* 文件上传区域 */}
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-amber-500 bg-amber-50'
                    : uploadingFile
                    ? 'border-emerald-300 bg-emerald-50'
                    : 'border-slate-300 hover:border-amber-400 hover:bg-slate-50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={e => handleFileSelect(e.target.files)}
                  className="hidden"
                />
                
                {uploadingFile ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-emerald-100 rounded-2xl flex items-center justify-center">
                      {(() => {
                        const fileType = getFileType(uploadingFile.name);
                        const iconConfig = FILE_ICONS[fileType || 'other'];
                        const IconComponent = iconConfig.icon;
                        return <IconComponent className="w-8 h-8 text-emerald-600" />;
                      })()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 truncate">{uploadingFile.name}</p>
                      <p className="text-sm text-slate-500">{formatSize(uploadingFile.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); clearUploadingFile(); }}
                      className="text-sm text-red-500 hover:text-red-700 font-bold"
                    >
                      重新选择
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {isDragging ? (
                      <>
                        <Upload className="w-12 h-12 mx-auto text-amber-500 animate-bounce" />
                        <p className="text-amber-600 font-bold">松开鼠标上传文件</p>
                      </>
                    ) : (
                      <>
                        <Upload className="w-12 h-12 mx-auto text-slate-300" />
                        <p className="text-slate-600 font-bold">拖拽文件到此处上传</p>
                        <p className="text-slate-400 text-sm">或点击选择文件 · 最大 20MB</p>
                      </>
                    )}
                  </div>
                )}
                
                {/* 上传进度条 */}
                {isUploading && (
                  <div className="absolute inset-x-6 bottom-4">
                    <div className="bg-slate-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-amber-500 h-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-1 text-center">{uploadProgress}%</p>
                  </div>
                )}
              </div>
              
              <textarea name="description" placeholder="文件描述（选填）" rows={2} className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold resize-none" />
              <input name="tags" placeholder="标签（逗号分隔，选填）" className="w-full p-3 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold" />
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" name="isPublic" className="w-4 h-4 rounded text-amber-600" />
                  <span className="text-sm font-bold text-slate-600">公开访问</span>
                </label>
                
                <p className="text-xs font-bold text-slate-400">或选择可访问的角色：</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" name="roles" value={role} className="w-4 h-4 rounded text-amber-600" />
                      <span className="text-sm text-slate-600">{ROLE_NAMES[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button 
                type="button" 
                onClick={() => { setIsUploadModal(false); clearUploadingFile(); }} 
                className="flex-1 py-3 text-slate-400 font-bold"
                disabled={isUploading}
              >
                取消
              </button>
              <button 
                type="button"
                onClick={async () => {
                  if (!uploadingFile) {
                    alert('请先选择文件');
                    return;
                  }
                  
                  setIsUploading(true);
                  setUploadProgress(10);
                  
                  try {
                    // 转换文件为 base64
                    const base64Data = await fileToBase64(uploadingFile);
                    setUploadProgress(80);
                    
                    const fileType = getFileType(uploadingFile.name);
                    const descInput = document.querySelector('textarea[name="description"]') as HTMLTextAreaElement;
                    const tagsInput = document.querySelector('input[name="tags"]') as HTMLInputElement;
                    const isPublicCheck = document.querySelector('input[name="isPublic"]') as HTMLInputElement;
                    
                    const newFile: DocumentItem = {
                      id: Date.now().toString(),
                      name: uploadingFile.name,
                      type: 'file',
                      fileType,
                      parentId: currentFolder,
                      url: base64Data,
                      description: descInput?.value || '',
                      tags: (tagsInput?.value || '').split(',').map(t => t.trim()).filter(Boolean),
                      size: uploadingFile.size,
                      isPublic: isPublicCheck?.checked || false,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                      createdBy: currentUser.name,
                    };
                    
                    setUploadProgress(90);
                    
                    // 保存
                    const updated = [...documents, newFile];
                    setDocuments(updated);
                    localStorage.setItem('kt_documents', JSON.stringify(updated));
                    
                    setUploadProgress(100);
                    
                    // 关闭弹窗
                    setIsUploadModal(false);
                    setUploadingFile(null);
                    setUploadProgress(0);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    
                    alert('文件上传成功！');
                  } catch (error: any) {
                    console.error('上传失败:', error);
                    alert('上传失败: ' + (error?.message || '未知错误'));
                  } finally {
                    setIsUploading(false);
                  }
                }}
                disabled={!uploadingFile || isUploading}
                className={`flex-1 py-3 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 ${
                  uploadingFile && !isUploading 
                    ? 'bg-amber-600 text-white hover:bg-amber-700' 
                    : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    上传中 {uploadProgress}%
                  </>
                ) : uploadingFile ? (
                  <>
                    <Upload className="w-4 h-4" />
                    上传文件
                  </>
                ) : (
                  '请先选择文件'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 权限设置弹窗 */}
      {isPermissionModal && selectedDocument && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={savePermissions} className="bg-white rounded-3xl p-8 w-full max-w-md space-y-6 animate-in zoom-in-95">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              <Shield className="w-6 h-6 text-amber-500" />
              权限设置
            </h2>
            
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="font-bold text-slate-800">{selectedDocument.name}</p>
              <p className="text-xs text-slate-400">{selectedDocument.type === 'folder' ? '文件夹' : '文件'}</p>
            </div>
            
            <div className="space-y-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="checkbox" 
                  name="isPublic" 
                  defaultChecked={selectedDocument.isPublic}
                  className="w-4 h-4 rounded text-amber-600" 
                />
                <span className="text-sm font-bold text-slate-600">公开访问（所有人可见）</span>
              </label>
              
              <div className="space-y-3">
                <p className="text-sm font-bold text-slate-600">可访问的角色：</p>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        name="roles" 
                        value={role} 
                        defaultChecked={selectedDocument.accessRoles?.includes(role)}
                        className="w-4 h-4 rounded text-amber-600" 
                      />
                      <span className="text-sm text-slate-600">{ROLE_NAMES[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-bold text-amber-600">权限说明</span>
                </div>
                <p className="text-xs text-amber-700">
                  公开文件所有用户可见；非公开文件仅选中角色可访问。文件夹权限会影响其下所有内容。
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => { setIsPermissionModal(false); setSelectedDocument(null); }} className="flex-1 py-3 text-slate-400 font-bold">取消</button>
              <button type="submit" className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold shadow-lg">保存权限</button>
            </div>
          </form>
        </div>
      )}
      {/* 文件预览弹窗 */}
      {previewFile && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col">
          {/* 顶部工具栏 */}
          <div className="flex items-center justify-between p-4 bg-slate-800/50">
            <div className="flex items-center gap-3">
              {(() => {
                const iconConfig = FILE_ICONS[previewFile.fileType || 'other'];
                const IconComponent = iconConfig.icon;
                return (
                  <div className={`p-2 rounded-xl ${iconConfig.color}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                );
              })()}
              <div>
                <h3 className="font-bold text-white">{previewFile.name}</h3>
                <p className="text-xs text-slate-400">{formatSize(previewFile.size)} · {previewFile.fileType?.toUpperCase()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewFile.url || '';
                  link.download = previewFile.name;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                下载
              </button>
              <button
                onClick={() => setPreviewFile(null)}
                className="p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <X className="w-6 h-6 text-white" />
              </button>
            </div>
          </div>
          
          {/* 预览内容区 */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            {previewFile.fileType === 'image' ? (
              <img 
                src={previewFile.url} 
                alt={previewFile.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            ) : previewFile.fileType === 'video' ? (
              <video 
                src={previewFile.url} 
                controls 
                autoPlay
                className="max-w-full max-h-full rounded-lg shadow-2xl"
              >
                您的浏览器不支持视频播放
              </video>
            ) : previewFile.fileType === 'audio' ? (
              <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
                <Music className="w-24 h-24 mx-auto text-pink-500 mb-4" />
                <p className="font-bold text-slate-800 mb-4">{previewFile.name}</p>
                <audio src={previewFile.url} controls autoPlay className="w-full">
                  您的浏览器不支持音频播放
                </audio>
              </div>
            ) : previewFile.fileType === 'pdf' ? (
              <iframe 
                src={previewFile.url} 
                className="w-full h-full rounded-lg"
                title={previewFile.name}
              />
            ) : (
              // 文档类和其他文件 - 显示文件信息
              <div className="bg-white rounded-3xl p-8 shadow-2xl text-center max-w-md">
                {(() => {
                  const iconConfig = FILE_ICONS[previewFile.fileType || 'other'];
                  const IconComponent = iconConfig.icon;
                  return (
                    <div className={`w-24 h-24 mx-auto rounded-3xl ${iconConfig.color} flex items-center justify-center mb-6`}>
                      <IconComponent className="w-12 h-12" />
                    </div>
                  );
                })()}
                <h3 className="text-xl font-black text-slate-800 mb-2">{previewFile.name}</h3>
                <p className="text-slate-500 mb-4">{formatSize(previewFile.size)}</p>
                {previewFile.description && (
                  <p className="text-sm text-slate-600 mb-4 bg-slate-50 p-3 rounded-xl">{previewFile.description}</p>
                )}
                {previewFile.tags && previewFile.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center mb-4">
                    {previewFile.tags.map((tag, idx) => (
                      <span key={idx} className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mb-6">
                  上传时间：{new Date(previewFile.createdAt).toLocaleString('zh-CN')}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = previewFile.url || '';
                      link.download = previewFile.name;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    下载文件
                  </button>
                  <button
                    onClick={() => setPreviewFile(null)}
                    className="px-6 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300 transition-colors"
                  >
                    关闭
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentView;

