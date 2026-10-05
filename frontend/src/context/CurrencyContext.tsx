import React, { createContext, useContext, useState } from 'react';

export type CurrencyType = 'BRL' | 'EUR';

interface CurrencyContextType {
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;
  toggleCurrency: () => void;
  exchangeRate: number; // 1 EUR = X BRL
  setExchangeRate: (rate: number) => void;
  formatCurrency: (valInBrl: number | string | null | undefined, options?: { showCode?: boolean; hideSymbol?: boolean }) => string;
  convertValue: (valInBrl: number | string | null | undefined) => number;
  currencySymbol: string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currency, setCurrencyState] = useState<CurrencyType>(() => {
    try {
      const saved = localStorage.getItem('preferred_currency');
      return (saved === 'EUR' || saved === 'BRL') ? saved : 'BRL';
    } catch (e) {
      return 'BRL';
    }
  });

  // Default exchange rate: 1 EUR = 6.10 BRL
  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('eur_brl_rate');
      return saved ? parseFloat(saved) : 6.10;
    } catch (e) {
      return 6.10;
    }
  });

  const setCurrency = (c: CurrencyType) => {
    setCurrencyState(c);
    try {
      localStorage.setItem('preferred_currency', c);
    } catch (e) {}
  };

  const toggleCurrency = () => {
    setCurrency(currency === 'BRL' ? 'EUR' : 'BRL');
  };

  const setExchangeRate = (rate: number) => {
    setExchangeRateState(rate);
    try {
      localStorage.setItem('eur_brl_rate', String(rate));
    } catch (e) {}
  };

  const convertValue = (valInBrl: number | string | null | undefined): number => {
    const num = typeof valInBrl === 'number' ? valInBrl : parseFloat(String(valInBrl || 0)) || 0;
    if (currency === 'EUR') {
      return num / (exchangeRate || 6.10);
    }
    return num;
  };

  const currencySymbol = currency === 'EUR' ? '€' : 'R$';

  const formatCurrency = (
    valInBrl: number | string | null | undefined,
    options?: { showCode?: boolean; hideSymbol?: boolean }
  ): string => {
    const num = typeof valInBrl === 'number' ? valInBrl : parseFloat(String(valInBrl || 0)) || 0;
    const isEur = currency === 'EUR';
    const converted = isEur ? num / (exchangeRate || 6.10) : num;
    const locale = isEur ? 'es-ES' : 'pt-BR';
    const formattedNum = converted.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (options?.hideSymbol) {
      return formattedNum;
    }

    if (options?.showCode) {
      return `${currencySymbol} ${formattedNum} (${currency})`;
    }

    return `${currencySymbol} ${formattedNum}`;
  };

  return (
    <CurrencyContext.Provider
      value={{
        currency,
        setCurrency,
        toggleCurrency,
        exchangeRate,
        setExchangeRate,
        formatCurrency,
        convertValue,
        currencySymbol,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};
