import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface ChineseDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  name?: string;
  min?: string;
  max?: string;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

export const ChineseDatePicker: React.FC<ChineseDatePickerProps> = ({
  value,
  onChange,
  placeholder = '选择日期',
  className = '',
  required = false,
  name,
  min,
  max,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    if (value) return new Date(value);
    return new Date();
  });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (value) {
      setViewDate(new Date(value));
    }
  }, [value]);

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const handlePrevMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrevYear = () => {
    setViewDate(prev => new Date(prev.getFullYear() - 1, prev.getMonth(), 1));
  };

  const handleNextYear = () => {
    setViewDate(prev => new Date(prev.getFullYear() + 1, prev.getMonth(), 1));
  };

  const handleSelectDate = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const dateStr = selectedDate.toISOString().split('T')[0];
    
    // Check min/max constraints
    if (min && dateStr < min) return;
    if (max && dateStr > max) return;
    
    onChange(dateStr);
    setIsOpen(false);
  };

  const isDateDisabled = (day: number): boolean => {
    const dateStr = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toISOString().split('T')[0];
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const isToday = (day: number): boolean => {
    const today = new Date();
    return (
      viewDate.getFullYear() === today.getFullYear() &&
      viewDate.getMonth() === today.getMonth() &&
      day === today.getDate()
    );
  };

  const isSelected = (day: number): boolean => {
    if (!value) return false;
    const selectedDate = new Date(value);
    return (
      viewDate.getFullYear() === selectedDate.getFullYear() &&
      viewDate.getMonth() === selectedDate.getMonth() &&
      day === selectedDate.getDate()
    );
  };

  const renderCalendar = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days: React.ReactNode[] = [];

    // Empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="w-8 h-8" />);
    }

    // Days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const disabled = isDateDisabled(day);
      const selected = isSelected(day);
      const today = isToday(day);

      days.push(
        <button
          key={day}
          type="button"
          disabled={disabled}
          onClick={() => handleSelectDate(day)}
          className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
            selected
              ? 'bg-blue-600 text-white shadow-lg'
              : today
              ? 'bg-amber-100 text-amber-700 border border-amber-300'
              : disabled
              ? 'text-slate-300 cursor-not-allowed'
              : 'text-slate-700 hover:bg-slate-100'
          }`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  return (
    <div ref={containerRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-bold outline-none focus:ring-2 focus:ring-blue-400 flex items-center justify-between ${className}`}
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
          {/* Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevYear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <ChevronLeft className="w-4 h-4" />
              <ChevronLeft className="w-4 h-4 -ml-2" />
            </button>
            <span className="font-black text-slate-800">{viewDate.getFullYear()}年</span>
            <button
              type="button"
              onClick={handleNextYear}
              className="p-1 hover:bg-slate-100 rounded-lg text-slate-500"
            >
              <ChevronRight className="w-4 h-4" />
              <ChevronRight className="w-4 h-4 -ml-2" />
            </button>
          </div>

          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <span className="font-bold text-lg text-slate-700">{MONTHS[viewDate.getMonth()]}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-2 hover:bg-slate-100 rounded-lg"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {WEEKDAYS.map((day, i) => (
              <div
                key={day}
                className={`w-8 h-8 flex items-center justify-center text-xs font-bold ${
                  i === 0 || i === 6 ? 'text-red-400' : 'text-slate-400'
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {renderCalendar()}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split('T')[0];
                onChange(today);
                setIsOpen(false);
              }}
              className="flex-1 py-2 text-sm font-bold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              今天
            </button>
            <button
              type="button"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              className="flex-1 py-2 text-sm font-bold text-slate-500 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
            >
              清除
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// 简单的中文日期格式化函数（可用于显示）
export const formatChineseDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
};

// 中文星期
export const getChineseWeekday = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return `星期${WEEKDAYS[date.getDay()]}`;
};

export default ChineseDatePicker;
