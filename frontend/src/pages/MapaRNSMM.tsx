import React, { useState, useEffect } from 'react';
import { Info, Globe, Building, Users, Heart, ExternalLink, Loader2, Home as HouseIcon, Activity, Star, School } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import '../styles/Relatorios.css';

interface DashboardStats {
  totalUsers?: number;
  totalHouses?: number;
  totalItineraries?: number;
  housesByType?: Record<string, number>;
  recentActivities?: Array<{ id: number, user: string, activity: string, time: string }>;
}

const MapaRNSMM: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdminGeral, isRegional, canEdit } = useAuth();
  const isAdm = isAdminGeral || isRegional || canEdit;
  const address = "R. Dr. Mário Vicente, 1108 - Ipiranga, São Paulo - SP, 04270-001";
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const [statsData, setStatsData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await api.post('/stats');
      setStatsData(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const countries = [
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Bolívia', flag: '🇧🇴' },
    { name: 'Brasil', flag: '🇧🇷' },
    { name: 'Chile', flag: '🇨🇱' },
    { name: 'Paraguai', flag: '🇵🇾' },
    { name: 'Peru', flag: '🇵🇪' },
    { name: 'Uruguai', flag: '🇺🇾' },
  ];

  const missionAreas = [
    { title: 'Acolhimento', desc: 'Casas de acolhida e centros de atenção ao migrante.', icon: <Building size={20} /> },
    { title: 'Promoção Humanitária', desc: 'Defesa de direitos e integração social.', icon: <Heart size={20} /> },
    { title: 'Presença Eclesial', desc: 'Paróquias, missões e pastorais especializadas.', icon: <Users size={20} /> },
  ];

  if (isLoading) {
    return (
      <div className="loading-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: '20px' }}>
        <Loader2 className="animate-spin" size={48} color="#013375" />
        <p style={{ color: '#013375', fontWeight: 600 }}>{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header" style={{ marginBottom: '0.5rem' }}>
        <div className="title-with-badge">
          <Globe size={32} className="text-primary" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h1 style={{ margin: 0, fontSize: '1.75rem', fontWeight: 800, color: '#013375' }}>Mapa RNSMM</h1>
          </div>
        </div>
      </div>

      {/* Main Stats Row */}
      {isAdm && (
        <div className="mapa-stats-grid">
          <div className="card-lite" onClick={() => navigate('/missionarios')} style={{ cursor: 'pointer', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Missionários</span>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#013375' }}>{statsData?.totalUsers || 0}</span>
          </div>
          <div className="card-lite" onClick={() => navigate('/itinerario-formativo')} style={{ cursor: 'pointer', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Religiosos / Seminaristas</span>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#013375' }}>{statsData?.totalItineraries || 0}</span>
          </div>
          <div className="card-lite" onClick={() => navigate('/casas-religiosas')} style={{ cursor: 'pointer', padding: '1.5rem', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '1rem', fontWeight: 700, color: '#64748b', marginBottom: '8px' }}>Presença Missionária</span>
              <span style={{ fontSize: '2.5rem', fontWeight: 900, color: '#013375' }}>{statsData?.totalHouses || 0}</span>
          </div>
        </div>
      )}

      {/* Presença Missionária Detailed Breakdown */}
      {isAdm && (
        <div className="card-lite mapa-presenca-card">
          <h3 style={{ margin: '0 0 1.5rem', textAlign: 'center', color: '#013375', fontSize: '1.25rem', fontWeight: 800 }}>Presença Missionária</h3>
          <div className="mapa-presenca-grid">
              {[
                  { label: 'Casas Religiosas (CR)', count: statsData?.housesByType?.CR || 0, icon: <HouseIcon size={20} />, type: 'CR' },
                  { label: 'Casas de Idosos (CI)', count: statsData?.housesByType?.CI || 0, icon: <Activity size={20} />, type: 'CI' },
                  { label: 'Obras (M)', count: statsData?.housesByType?.M || 0, icon: <Heart size={20} />, type: 'M' },
                  { label: 'Paróquias/Igrejas (P)', count: statsData?.housesByType?.P || 0, icon: <Globe size={20} />, type: 'P' },
                  { label: 'Pastoral Vocacional (PV)', count: statsData?.housesByType?.PV || 0, icon: <Star size={20} />, type: 'PV' },
                  { label: 'Seminários (CS)', count: statsData?.housesByType?.CS || 0, icon: <School size={20} />, type: 'CS' },
              ].map((item, idx) => (
                  <div key={idx} onClick={() => navigate('/casas-religiosas')} className="mapa-presenca-item">
                      <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', textAlign: 'center' }}>{item.label}</span>
                      <span style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b' }}>{item.count}</span>
                  </div>
              ))}
          </div>
        </div>
      )}

      <div className="map-full-card card-lite" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' }}>
        <div className="mapa-header-bar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Globe className="text-primary" size={28} />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Sede Canônica RNSMM</h3>
            </div>
            <a 
                href={googleMapsUrl} 
                target="_blank" 
                rel="noreferrer" 
                className="btn-save"
                style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '10px', 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    textDecoration: 'none',
                    padding: '12px 24px',
                    borderRadius: '12px'
                }}
            >
                Abrir no Google Maps <ExternalLink size={18} />
            </a>
        </div>
        
        <div className="mapa-iframe-wrapper">
            <iframe
                title="Google Maps Sede RNSMM"
                width="100%"
                height="100%"
                frameBorder="0"
                style={{ border: 0 }}
                src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=16&ie=UTF8&iwloc=&output=embed`}
                allowFullScreen
            ></iframe>
        </div>
      </div>

      <div className="mapa-bottom-grid">
        <div className="card-lite" style={{ padding: '2rem', borderRadius: '20px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#013375', fontSize: '1.1rem' }}>
            <Info size={22} /> Missão e História
          </h4>
          <p style={{ fontSize: '1rem', lineHeight: '1.7', color: '#475569', textAlign: 'justify', margin: 0 }}>
            A <strong>RNSMM</strong> nasceu da união estratégica das províncias scalabrinianas para melhor atender o fluxo migratório na América do Sul. 
            Hoje, coordena a presença em 7 países, unificando a gestão e o carisma de acolhida.
          </p>
        </div>

        <div className="card-lite" style={{ padding: '2rem', borderRadius: '20px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#013375', fontSize: '1.1rem' }}>
            <Globe size={22} /> Países da Região
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px' }}>
            {countries.map(c => (
              <div key={c.name} style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e2e8f0' }}>
                <span>{c.flag}</span>
                <span>{c.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-lite" style={{ padding: '2rem', borderRadius: '20px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.5rem', color: '#013375', fontSize: '1.1rem' }}>
            <Heart size={22} /> Frentes de Trabalho
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {missionAreas.map(area => (
              <div key={area.title} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ background: '#eff6ff', color: '#3b82f6', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {area.icon}
                </div>
                <div>
                  <h5 style={{ margin: '0 0 2px', fontSize: '0.95rem', fontWeight: 700 }}>{area.title}</h5>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>{area.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapaRNSMM;
