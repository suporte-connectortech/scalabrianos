import React, { useState, useEffect, useRef } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { type BankItem, loadAllBanks, searchBanks, formatBankLabel, POPULAR_BANKS } from '../../utils/banks';

interface BankAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export const BankAutocomplete: React.FC<BankAutocompleteProps> = ({
  value,
  onChange,
  placeholder = 'Selecione ou digite o banco (ex: Nubank, Itaú, Inter...)',
  disabled = false,
  className = '',
  id
}) => {
  const [banksList, setBanksList] = useState<BankItem[]>(POPULAR_BANKS);
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllBanks().then(list => setBanksList(list));
  }, []);

  useEffect(() => {
    setSearchTerm(value || '');
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = searchBanks(searchTerm, banksList);

  const handleSelect = (bank: BankItem) => {
    const formatted = formatBankLabel(bank);
    setSearchTerm(formatted);
    onChange(formatted);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    setSearchTerm(text);
    onChange(text);
    if (!isOpen) setIsOpen(true);
    setHighlightedIndex(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter' && highlightedIndex >= 0 && highlightedIndex < filtered.length) {
      e.preventDefault();
      handleSelect(filtered[highlightedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`bank-autocomplete-container ${className}`} ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="form-control"
          autoComplete="off"
          style={{
            width: '100%',
            paddingRight: '36px',
            boxSizing: 'border-box'
          }}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            if (!disabled) {
              setIsOpen(!isOpen);
              if (!isOpen) inputRef.current?.focus();
            }
          }}
          style={{
            position: 'absolute',
            right: '8px',
            background: 'transparent',
            border: 'none',
            color: '#64748b',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          className="bank-autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '230px',
            overflowY: 'auto',
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 9999
          }}
        >
          {filtered.length > 0 ? (
            filtered.map((bank, index) => {
              const formatted = formatBankLabel(bank);
              const isSelected = value === formatted || value === bank.name || value === bank.fullName;
              const isHighlighted = highlightedIndex === index;

              return (
                <div
                  key={`${bank.code}-${bank.name}-${index}`}
                  onClick={() => handleSelect(bank)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    background: isHighlighted ? '#f1f5f9' : isSelected ? '#eff6ff' : 'transparent',
                    color: isSelected ? '#1d4ed8' : '#1e293b',
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Building2 size={14} style={{ color: isSelected ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontWeight: isSelected ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {formatted}
                    </span>
                  </div>
                  {isSelected && <Check size={14} style={{ color: '#2563eb', flexShrink: 0, marginLeft: '8px' }} />}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '10px 12px', fontSize: '0.85rem', color: '#64748b', textAlign: 'center' }}>
              Nenhum banco encontrado. Você pode manter o texto digitado livremente.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
