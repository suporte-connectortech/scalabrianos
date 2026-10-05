import React from 'react';
import { Menu, LogOut } from 'lucide-react';
import { useLayout } from '../../context/LayoutContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import logo from '../../assets/logo_vertical.png';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';
import { useCurrency } from '../../context/CurrencyContext';
import '../../styles/Header.css';

const Header: React.FC = () => {
  const { toggleSidebar } = useLayout();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { currency, setCurrency } = useCurrency();

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <header className="header">
      <div className="header-left">
        <button className="menu-toggle" onClick={toggleSidebar}>
          <Menu size={24} />
        </button>
        <div className="logo-container">
          <img src={logo} alt="Scalabrianos Logo" className="header-logo" />
        </div>
      </div>

      <div className="header-right">
        <NotificationBell />

        {/* Seletor de Moeda (BRL / EUR) */}
        <div className="currency-selector" title={t('currency.select_title', 'Moeda de Exibição / Moneda')}>
          <button
            className={`currency-btn ${currency === 'BRL' ? 'active' : ''}`}
            onClick={() => setCurrency('BRL')}
            title="Real (R$)"
          >
            R$
          </button>
          <button
            className={`currency-btn ${currency === 'EUR' ? 'active' : ''}`}
            onClick={() => setCurrency('EUR')}
            title="Euro (€)"
          >
            €
          </button>
        </div>

        {/* Seletor de Idioma (PT / ES) */}
        <div className="language-selector">
          <button
            className={`lang-btn ${i18n.language.startsWith('pt') ? 'active' : ''}`}
            onClick={() => handleLanguageChange('pt')}
            title="Português"
          >
            PT
          </button>
          <button
            className={`lang-btn ${i18n.language.startsWith('es') ? 'active' : ''}`}
            onClick={() => handleLanguageChange('es')}
            title="Español"
          >
            ES
          </button>
        </div>

        <div className="user-info" onClick={() => navigate('/login')}>
          <span>{user?.nome || 'Admin'}</span>
          <LogOut size={20} className="logout-icon" aria-label={t('header.logout')} />
        </div>
      </div>

    </header>
  );
};

export default Header;
