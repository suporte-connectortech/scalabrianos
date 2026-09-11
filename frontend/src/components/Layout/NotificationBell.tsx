import React, { useState, useEffect, useRef } from 'react';
import { Bell, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import '../../styles/NotificationBell.css';

interface Notificacao {
  id: number;
  usuario_id: number;
  mensagem: string;
  tipo: 'INFO' | 'ALERTA' | 'SUCESSO';
  lida: boolean;
  link_path?: string;
  created_at: string;
}

const NotificationBell: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);



  const fetchNotificacoes = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const res = await api.get('/notificacoes');
      if (Array.isArray(res.data)) {
        setNotificacoes(res.data);
      }
    } catch (err) {
      // Silently catch to avoid polluting logs on background polls
    }
  };

  useEffect(() => {
    fetchNotificacoes();

    // 2 minutes polling (120s) only if active tab and logged in
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchNotificacoes();
      }
    }, 120000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchNotificacoes();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notificacoes.filter(n => !n.lida).length;

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notificacoes/${id}/lida`);
      setNotificacoes(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
    } catch (err) { console.error(err); }
  };

  const markAllAsRead = async () => {
    try {
      await api.put('/notificacoes/ler-todas');
      setNotificacoes(prev => prev.map(n => ({ ...n, lida: true })));
    } catch (err) { console.error(err); }
  };

  const handleNotificationClick = (n: Notificacao) => {
    if (!n.lida) markAsRead(n.id);
    if (n.link_path) {
      navigate(n.link_path);
      setIsOpen(false);
    }
  };

  const formatNotifDate = (dt: string) => {
    return new Date(dt).toLocaleString(i18n.language === 'es' ? 'es-ES' : 'pt-BR');
  };

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button className="bell-button" onClick={() => setIsOpen(!isOpen)} title={t('notifications.title')}>
        <Bell size={22} />
        {unreadCount > 0 && <span className="bell-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notif-header">
            <h3>{t('notifications.title')}</h3>
            {unreadCount > 0 && <button onClick={markAllAsRead}>{t('notifications.mark_all')}</button>}
          </div>

          <div className="notif-list">
            {notificacoes.length === 0 ? (
              <div className="notif-empty">{t('notifications.empty')}</div>
            ) : (
              notificacoes.map(n => (
                <div 
                  key={n.id} 
                  className={`notif-item ${!n.lida ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className={`notif-icon ${n.tipo.toLowerCase()}`}>
                    {n.tipo === 'ALERTA' ? <AlertCircle size={16} /> : 
                     n.tipo === 'SUCESSO' ? <CheckCircle size={16} /> : 
                     <Info size={16} />}
                  </div>
                  <div className="notif-content">
                    <p className="notif-msg">{n.mensagem}</p>
                    <span className="notif-time">{formatNotifDate(n.created_at)}</span>
                  </div>
                  {!n.lida && <div className="notif-unread-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
