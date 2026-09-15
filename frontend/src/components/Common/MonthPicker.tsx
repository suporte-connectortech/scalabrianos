import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import '../../styles/MonthPicker.css';

export interface MonthPickerProps {
  value: string; // 'YYYY-MM'
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}

const MONTH_NAMES = [
  { short: 'Jan', full: 'Janeiro', num: '01' },
  { short: 'Fev', full: 'Fevereiro', num: '02' },
  { short: 'Mar', full: 'Março', num: '03' },
  { short: 'Abr', full: 'Abril', num: '04' },
  { short: 'Mai', full: 'Maio', num: '05' },
  { short: 'Jun', full: 'Junho', num: '06' },
  { short: 'Jul', full: 'Julho', num: '07' },
  { short: 'Ago', full: 'Agosto', num: '08' },
  { short: 'Set', full: 'Setembro', num: '09' },
  { short: 'Out', full: 'Outubro', num: '10' },
  { short: 'Nov', full: 'Novembro', num: '11' },
  { short: 'Dez', full: 'Dezembro', num: '12' },
];

export const formatMonthLabel = (val?: string): string => {
  if (!val || !val.includes('-')) return '';
  const [yearStr, monthStr] = val.split('-');
  const monthIdx = parseInt(monthStr, 10) - 1;
  if (monthIdx >= 0 && monthIdx < 12) {
    return `${MONTH_NAMES[monthIdx].full} de ${yearStr}`;
  }
  return val;
};

const MonthPicker: React.FC<MonthPickerProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  style,
  placeholder = 'Selecione o mês/ano...'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentYear = new Date().getFullYear();
  const currentMonthNum = String(new Date().getMonth() + 1).padStart(2, '0');
  const currentValFormatted = `${currentYear}-${currentMonthNum}`;

  const parseYearFromVal = () => {
    if (value && value.includes('-')) {
      const y = parseInt(value.split('-')[0], 10);
      if (!isNaN(y) && y > 1900 && y < 2100) return y;
    }
    return currentYear;
  };

  const [viewYear, setViewYear] = useState<number>(parseYearFromVal);

  useEffect(() => {
    setViewYear(parseYearFromVal());
  }, [value]);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelectMonth = (monthNum: string) => {
    const formatted = `${viewYear}-${monthNum}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const handleSelectCurrentMonth = () => {
    onChange(currentValFormatted);
    setViewYear(currentYear);
    setIsOpen(false);
  };

  const [selectedYearStr, selectedMonthStr] = (value && value.includes('-')) ? value.split('-') : ['', ''];
  const label = formatMonthLabel(value);

  return (
    <div 
      className={`custom-month-picker-wrapper ${disabled ? 'disabled' : ''} ${className}`} 
      ref={containerRef}
      style={style}
    >
      <button
        type="button"
        className={`custom-month-picker-trigger ${isOpen ? 'active' : ''}`}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span className="picker-trigger-text">
          {label || placeholder}
        </span>
        <Calendar size={16} className="picker-trigger-icon" />
      </button>

      {isOpen && (
        <div className="custom-month-picker-popover" role="dialog">
          <div className="picker-header">
            <button
              type="button"
              className="picker-nav-btn"
              onClick={() => setViewYear(prev => prev - 1)}
              title="Ano anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="picker-year-display">{viewYear}</span>
            <button
              type="button"
              className="picker-nav-btn"
              onClick={() => setViewYear(prev => prev + 1)}
              title="Próximo ano"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="picker-months-grid">
            {MONTH_NAMES.map((m) => {
              const isSelected = selectedYearStr === String(viewYear) && selectedMonthStr === m.num;
              const isThisCurrentMonth = currentYear === viewYear && currentMonthNum === m.num;
              return (
                <button
                  key={m.num}
                  type="button"
                  className={`picker-month-btn ${isSelected ? 'selected' : ''} ${isThisCurrentMonth ? 'current-month' : ''}`}
                  onClick={() => handleSelectMonth(m.num)}
                >
                  {m.short}
                </button>
              );
            })}
          </div>

          <div className="picker-footer">
            <button
              type="button"
              className="picker-footer-btn clear"
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
            >
              Limpar
            </button>
            <button
              type="button"
              className="picker-footer-btn today"
              onClick={handleSelectCurrentMonth}
            >
              Este mês
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthPicker;
