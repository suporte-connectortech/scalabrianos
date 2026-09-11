import React, { useState } from 'react';
import {
  Settings, LogOut, Home as HomeIcon, ChevronDown, ChevronRight,
  Users, Lock, ClipboardList, DollarSign, ShieldCheck, Globe
} from 'lucide-react';
import { useLayout } from '../../context/LayoutContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../context/AuthContext';
import { getFileUrl } from '../../api';
import '../../styles/Sidebar.css';

interface SubItem {
  icon: React.ReactNode;
  label: string;
  path: string;
  subItems?: SubItem[];
}

interface MenuItem {
  icon: React.ReactNode;
  label: string;
  path?: string;
  subItems?: SubItem[];
}

const Sidebar: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAdminGeral, canEdit, isRegional } = useAuth();
  const { isSidebarOpen, toggleSidebar } = useLayout();
  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    [t('menu.admin')]: true,
    'Itinerário Formativo': false
  });

  const toggleSection = (label: string) => {
    setOpenSections(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const menuItems: MenuItem[] = [];

  const isInactiveMissionary = !isAdminGeral && !canEdit && !isRegional && !!user?.situacao && user.situacao.trim().toUpperCase() !== 'ATIVO';

  // 1. Missionários / Seminaristas
  if (isAdminGeral || canEdit || isRegional) {
    menuItems.push({ icon: <Users size={20} />, label: t('menu.missionaries'), path: '/missionarios' });
  }

  // 2. Presença Missionária
  if (isAdminGeral || canEdit || isRegional) {
    menuItems.push({ icon: <HomeIcon size={20} />, label: t('menu.houses'), path: '/casas-religiosas' });
  }

  // 3. Prestação de Contas, Extratos e Mapa (apenas para ativos ou administradores)
  if (!isInactiveMissionary) {
    menuItems.push({ icon: <DollarSign size={20} />, label: t('menu.finance'), path: '/financeiro' });
    if (user?.role !== 'REGISTRO_REGIONAL' && user?.role !== 'ADMIN_GERAL') {
      menuItems.push({ icon: <ClipboardList size={20} />, label: 'Extratos Mensais', path: '/extratos-mensais' });
    }
    menuItems.push({ icon: <Globe size={20} />, label: t('menu.map'), path: '/mapa' });
  }




  // 5. Gestão da Plataforma
  if (isAdminGeral || canEdit || isRegional) {
    menuItems.push({
      label: t('menu.admin'),
      icon: <Settings size={20} />,
      subItems: [
        { icon: <Lock size={18} />, label: t('menu.profiles'), path: '/administradores' },
        { icon: <ClipboardList size={18} />, label: t('menu.system_logs'), path: '/logs' },
        { icon: <ShieldCheck size={18} />, label: t('menu.access_logs'), path: '/logs-acesso' },
      ]
    });
  }




  const renderMenuItems = (items: (MenuItem | SubItem)[], level = 0) => {
    return items.map((item, index) => {
      const hasSubItems = 'subItems' in item && item.subItems && item.subItems.length > 0;
      const isOpen = openSections[item.label];
      const isActive = item.path ? location.pathname === item.path || location.pathname.startsWith(item.path + '/') : false;

      return (
        <div key={index} className="menu-node">
          <div
            className={`sidebar-item level-${level} ${isActive ? 'active' : ''}`}
            onClick={() => {
              if (hasSubItems) {
                toggleSection(item.label);
              } else if (item.path) {
                navigate(item.path);
              }
            }}
          >
            <span className="item-icon">{item.icon}</span>
            <span className="item-label">{item.label}</span>
            {hasSubItems && (
              <span className="chevron">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
            )}
          </div>
          {hasSubItems && isOpen && (
            <div className="sub-menu-container">
              {renderMenuItems(item.subItems!, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-items">
        {renderMenuItems(menuItems)}
      </div>

      <div className="sidebar-footer">
        <div className={`sidebar-item ${location.pathname === '/meu-perfil' ? 'active' : ''}`} onClick={() => navigate('/meu-perfil')}>
          <span className="item-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {user?.foto_perfil ? (
               <img src={getFileUrl(user.foto_perfil) || user.foto_perfil} alt="Perfil" style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
               <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 'bold' }}>
                 {getInitials(user?.nome || '')}
               </div>
            )}
          </span>
          <span className="item-label">Meu Perfil</span>
        </div>
        <div className="sidebar-item logout" onClick={() => navigate('/login')}>
          <span className="item-icon"><LogOut size={20} /></span>
          <span className="item-label">{t('menu.logout')}</span>
        </div>
      </div>

    </div>
    {/* Overlay for mobile when sidebar is open */}
    {isSidebarOpen && (
      <div 
        className="sidebar-overlay" 
        onClick={toggleSidebar} 
      />
    )}
    </>
  );
};

export default Sidebar;
