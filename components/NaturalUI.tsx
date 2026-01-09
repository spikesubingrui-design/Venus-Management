
import React from 'react';
import { Leaf, TreeDeciduous, Flower2, Sun, Cloud, Sprout, Bird } from 'lucide-react';

// 自然有机风格配色
export const naturalColors = {
  primary: '#4a5d3a',      // 橄榄绿
  primaryLight: '#6b7c5c', // 浅橄榄绿
  primaryPale: '#c9dbb8',  // 淡绿
  secondary: '#8b6f47',    // 棕褐色
  secondaryLight: '#c9a962', // 金黄色
  accent: '#8b7355',       // 暖棕色
  background: '#faf8f5',   // 米白
  backgroundAlt: '#f5f2ed', // 浅米色
  border: '#e8e4dc',       // 边框色
  text: '#3d4a32',         // 深绿文字
  textMuted: '#8b7355',    // 柔和文字
};

// 波浪分割线组件
export const WaveDivider: React.FC<{ color?: string; flip?: boolean; className?: string }> = ({ 
  color = naturalColors.primary, 
  flip = false,
  className = ''
}) => (
  <svg 
    viewBox="0 0 1200 120" 
    preserveAspectRatio="none" 
    className={`w-full h-8 ${flip ? 'rotate-180' : ''} ${className}`}
    style={{ display: 'block' }}
  >
    <path 
      d="M0,60 C200,120 400,0 600,60 C800,120 1000,0 1200,60 L1200,120 L0,120 Z" 
      fill={color}
    />
  </svg>
);

// 圆形徽章组件
export const Badge: React.FC<{ 
  children: React.ReactNode; 
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}> = ({ children, variant = 'primary', size = 'md', className = '' }) => {
  const variants = {
    primary: { bg: '#4a5d3a20', border: '#4a5d3a40', text: '#4a5d3a' },
    secondary: { bg: '#8b6f4720', border: '#8b6f4740', text: '#8b6f47' },
    accent: { bg: '#c9a96220', border: '#c9a96240', text: '#8b6f47' },
    success: { bg: '#4a5d3a', border: '#4a5d3a', text: 'white' },
    warning: { bg: '#c9a962', border: '#c9a962', text: '#3d4a32' },
  };
  const sizes = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };
  const v = variants[variant];
  return (
    <span 
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold border-2 border-dashed ${sizes[size]} ${className}`}
      style={{ backgroundColor: v.bg, borderColor: v.border, color: v.text }}
    >
      {children}
    </span>
  );
};

// 圆形印章组件
export const Stamp: React.FC<{ 
  text: string; 
  icon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}> = ({ text, icon, size = 'md', variant = 'primary' }) => {
  const sizes = {
    sm: 'w-16 h-16 text-[8px]',
    md: 'w-24 h-24 text-[10px]',
    lg: 'w-32 h-32 text-xs',
  };
  const colors = variant === 'primary' 
    ? { border: '#4a5d3a', text: '#4a5d3a' }
    : { border: '#8b6f47', text: '#8b6f47' };
  
  return (
    <div 
      className={`${sizes[size]} rounded-full border-4 border-double flex flex-col items-center justify-center font-bold uppercase tracking-widest text-center p-2 rotate-[-12deg]`}
      style={{ borderColor: colors.border, color: colors.text }}
    >
      {icon && <div className="mb-1">{icon}</div>}
      <span>{text}</span>
    </div>
  );
};

// 自然风格卡片
export const NaturalCard: React.FC<{
  children: React.ReactNode;
  title?: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'primary' | 'warm' | 'highlight';
  className?: string;
  noPadding?: boolean;
}> = ({ children, title, icon, variant = 'default', className = '', noPadding = false }) => {
  const variants = {
    default: { bg: 'white', border: '#e8e4dc', headerBg: '#f5f2ed' },
    primary: { bg: '#f8faf6', border: '#c9dbb8', headerBg: '#4a5d3a' },
    warm: { bg: '#faf8f5', border: '#e8dfd4', headerBg: '#8b6f47' },
    highlight: { bg: 'white', border: '#c9a962', headerBg: '#c9a962' },
  };
  const v = variants[variant];
  const headerTextColor = ['primary', 'warm', 'highlight'].includes(variant) ? 'white' : '#4a5d3a';
  
  return (
    <div 
      className={`rounded-3xl overflow-hidden shadow-lg ${className}`}
      style={{ backgroundColor: v.bg, border: `2px solid ${v.border}` }}
    >
      {title && (
        <div 
          className="px-6 py-4 flex items-center gap-3"
          style={{ backgroundColor: v.headerBg, color: headerTextColor }}
        >
          {icon && <span className="opacity-80">{icon}</span>}
          <h3 className="font-bold text-lg" style={{ fontFamily: "'Noto Serif SC', serif" }}>{title}</h3>
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  );
};

// 自然风格按钮
export const NaturalButton: React.FC<{
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  type?: 'button' | 'submit';
}> = ({ children, variant = 'primary', size = 'md', icon, onClick, disabled, className = '', type = 'button' }) => {
  const variants = {
    primary: 'bg-[#4a5d3a] text-white hover:bg-[#3d4a2f] shadow-lg shadow-[#4a5d3a]/20',
    secondary: 'bg-[#c9a962] text-[#3d4a32] hover:bg-[#b89952] shadow-lg shadow-[#c9a962]/20',
    outline: 'bg-transparent border-2 border-[#4a5d3a] text-[#4a5d3a] hover:bg-[#4a5d3a]/10',
    ghost: 'bg-transparent text-[#4a5d3a] hover:bg-[#4a5d3a]/10',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-xs rounded-lg gap-1.5',
    md: 'px-5 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-2xl gap-2',
  };
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center font-semibold transition-all duration-200 disabled:opacity-50 active:scale-95 ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
};

// 自然风格输入框
export const NaturalInput: React.FC<{
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  icon?: React.ReactNode;
  className?: string;
}> = ({ placeholder, value, onChange, type = 'text', icon, className = '' }) => (
  <div className={`relative ${className}`}>
    {icon && (
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8b7355]">
        {icon}
      </span>
    )}
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      className={`w-full ${icon ? 'pl-12' : 'pl-4'} pr-4 py-3 rounded-xl border-2 border-[#e8e4dc] bg-white text-[#3d4a32] placeholder:text-[#8b7355]/50 outline-none transition-all focus:border-[#4a5d3a] focus:ring-2 focus:ring-[#4a5d3a]/10`}
    />
  </div>
);

// 装饰性叶子背景
export const LeafDecoration: React.FC<{ className?: string; opacity?: number }> = ({ 
  className = '', 
  opacity = 0.05 
}) => (
  <div className={`absolute pointer-events-none ${className}`} style={{ opacity }}>
    <Leaf className="w-full h-full text-[#4a5d3a]" />
  </div>
);

// 自然风格统计卡片
export const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; isUp: boolean };
  variant?: 'green' | 'gold' | 'brown' | 'sage';
}> = ({ title, value, icon, trend, variant = 'green' }) => {
  const variants = {
    green: { bg: 'linear-gradient(135deg, #4a5d3a 0%, #6b7c5c 100%)', iconBg: '#c9dbb8' },
    gold: { bg: 'linear-gradient(135deg, #c9a962 0%, #d4bc7a 100%)', iconBg: '#faf6f0' },
    brown: { bg: 'linear-gradient(135deg, #8b6f47 0%, #a68b5c 100%)', iconBg: '#f5f2ed' },
    sage: { bg: 'linear-gradient(135deg, #8b9d7c 0%, #a8b89c 100%)', iconBg: '#f0f4ec' },
  };
  const v = variants[variant];
  
  return (
    <div 
      className="rounded-2xl p-5 text-white shadow-xl relative overflow-hidden"
      style={{ background: v.bg }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-white/70 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold">{value}</p>
          {trend && (
            <p className={`text-xs mt-2 ${trend.isUp ? 'text-[#c9dbb8]' : 'text-rose-200'}`}>
              {trend.isUp ? '↑' : '↓'} {Math.abs(trend.value)}% 较上月
            </p>
          )}
        </div>
        <div 
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: v.iconBg, color: '#4a5d3a' }}
        >
          {icon}
        </div>
      </div>
      {/* 装饰 */}
      <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full bg-white/5" />
      <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-white/5" />
    </div>
  );
};

// 页面标题组件
export const PageTitle: React.FC<{
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
}> = ({ title, subtitle, icon, action }) => (
  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
    <div className="flex items-center gap-4">
      <div 
        className="p-3 rounded-2xl shadow-lg"
        style={{ backgroundColor: '#4a5d3a' }}
      >
        <span className="text-[#c9dbb8]">{icon}</span>
      </div>
      <div>
        <h1 
          className="text-2xl md:text-3xl font-bold"
          style={{ color: '#4a5d3a', fontFamily: "'Noto Serif SC', serif" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm mt-1" style={{ color: '#8b7355' }}>{subtitle}</p>
        )}
      </div>
    </div>
    {action && <div>{action}</div>}
  </div>
);

// 空状态组件
export const EmptyState: React.FC<{
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="text-center py-16 px-8">
    <div 
      className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center"
      style={{ backgroundColor: '#4a5d3a10' }}
    >
      {icon || <Sprout className="w-10 h-10" style={{ color: '#4a5d3a40' }} />}
    </div>
    <h3 className="text-lg font-bold mb-2" style={{ color: '#4a5d3a' }}>{title}</h3>
    {description && (
      <p className="text-sm mb-6" style={{ color: '#8b7355' }}>{description}</p>
    )}
    {action}
  </div>
);

// 标签页组件
export const NaturalTabs: React.FC<{
  tabs: { id: string; label: string; icon?: React.ReactNode; badge?: number }[];
  activeTab: string;
  onChange: (id: string) => void;
}> = ({ tabs, activeTab, onChange }) => (
  <div 
    className="flex p-1.5 rounded-2xl gap-1"
    style={{ backgroundColor: '#f5f2ed', border: '1px solid #e8e4dc' }}
  >
    {tabs.map(tab => (
      <button
        key={tab.id}
        onClick={() => onChange(tab.id)}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
          activeTab === tab.id 
            ? 'bg-[#4a5d3a] text-white shadow-lg' 
            : 'text-[#6b7c5c] hover:bg-[#4a5d3a]/10'
        }`}
      >
        {tab.icon}
        <span>{tab.label}</span>
        {tab.badge !== undefined && tab.badge > 0 && (
          <span 
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              activeTab === tab.id ? 'bg-white/20' : 'bg-[#c9a962] text-white'
            }`}
          >
            {tab.badge}
          </span>
        )}
      </button>
    ))}
  </div>
);

// 自然风格表格
export const NaturalTable: React.FC<{
  headers: string[];
  children: React.ReactNode;
}> = ({ headers, children }) => (
  <div className="overflow-x-auto rounded-2xl border-2" style={{ borderColor: '#e8e4dc' }}>
    <table className="w-full">
      <thead>
        <tr style={{ backgroundColor: '#f5f2ed' }}>
          {headers.map((header, i) => (
            <th 
              key={i}
              className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider"
              style={{ color: '#4a5d3a' }}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#e8e4dc]">
        {children}
      </tbody>
    </table>
  </div>
);

// 自然装饰图案背景
export const NaturalPattern: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div 
    className={`absolute inset-0 pointer-events-none ${className}`}
    style={{
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%234a5d3a' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
    }}
  />
);

export default {
  naturalColors,
  WaveDivider,
  Badge,
  Stamp,
  NaturalCard,
  NaturalButton,
  NaturalInput,
  LeafDecoration,
  StatCard,
  PageTitle,
  EmptyState,
  NaturalTabs,
  NaturalTable,
  NaturalPattern,
};
