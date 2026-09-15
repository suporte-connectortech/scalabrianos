import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, Users, ArrowLeft, Loader2, AlertCircle, 
  Globe, Building2, User, UserCheck, Info, Star, DollarSign
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../api';
import '../styles/CasasReligiosas.css';

interface ResponsavelItem {
  cargo: string;
  nome: string;
  nomes?: string[];
}

interface Missionary {
  id: number;
  nome: string;
  login: string;
  situacao: string;
  funcao?: string;
  is_superior?: boolean;
  is_oconomo?: boolean;
}

interface ReligiousHouse {
  id: number;
  nome: string;
  endereco: string;
  cidade?: string;
  cep?: string;
  status: 'ATIVO' | 'INATIVO';
  regional?: string;
  paroco?: string;
  vigario_paroquial?: string;
  tipo?: string;
  pm_code?: string;
  responsaveis?: ResponsavelItem[];
  missionarios?: Missionary[];
}

const TIPO_LABELS: Record<string, string> = {
  CI: 'Casas de Idosos – CI',
  CR: 'Casas Religiosas – CR',
  M: 'Obras – M',
  P: 'Paróquia – P',
  PV: 'Pastoral Vocacional – PV',
  CS: 'Seminário – CS',
};

const PerfilCasa: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [house, setHouse] = useState<ReligiousHouse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHouseDetails();
  }, [id]);

  const fetchHouseDetails = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/casas-religiosas/${id}`);
      setHouse(response.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching house details:', err);
      setError(t('casas.error_loading') || 'Erro ao carregar detalhes da presença.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-state" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 className="animate-spin" size={48} color="#032b57" />
        <p style={{ color: '#64748b', fontWeight: 600 }}>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !house) {
    return (
      <div className="error-state" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <AlertCircle size={48} color="#dc2626" />
        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{error || 'Presença não encontrada.'}</p>
        <button className="btn-back-casa" onClick={() => navigate('/casas-religiosas')}>
          <ArrowLeft size={18} /> Voltar para Presenças
        </button>
      </div>
    );
  }

  const tipoLabel = house.tipo ? (TIPO_LABELS[house.tipo] || house.tipo) : null;

  return (
    <div className="page-container">
      {/* Responsive & Robust Header */}
      <div className="casa-detail-header">
        <div className="casa-detail-top">
          <button className="btn-back-casa" onClick={() => navigate('/casas-religiosas')}>
            <ArrowLeft size={18} /> Voltar para Presenças
          </button>
          <span className={`status-tag ${house.status.toLowerCase()}`}>
            {house.status}
          </span>
        </div>

        <div className="casa-detail-title-wrapper">
          <div className="casa-detail-icon">
            <Building2 size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="casa-detail-title">{house.nome}</h2>
            <div className="casa-detail-meta">
              {house.pm_code && <span className="pm-code">{house.pm_code}</span>}
              {tipoLabel && <span className="casa-tipo-pill">{tipoLabel}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left Column: Info Cards */}
        <div className="profile-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Building2 size={18} /> Informações Gerais
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Endereço
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4 }}>
                  <MapPin size={16} style={{ color: '#032b57', flexShrink: 0, marginTop: '2px' }} /> 
                  <span>{house.endereco || '---'}</span>
                </p>
              </div>
              
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  País / Regional
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} style={{ color: '#032b57', flexShrink: 0 }} /> 
                  <span>{house.regional || 'Brasil'}</span>
                </p>
              </div>

              {/* Dynamic Responsibles */}
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Responsáveis
                </label>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {house.responsaveis && house.responsaveis.length > 0 ? (
                    house.responsaveis.map((resp, idx) => (
                      <div key={idx} className="responsavel-card-item">
                        <div className="responsavel-role">
                          <UserCheck size={14} />
                          <span>{resp.cargo}</span>
                        </div>
                        <div className="responsavel-name">{resp.nome}</div>
                      </div>
                    ))
                  ) : (house.missionarios && house.missionarios.length > 0) ? (
                    <div className="sem-responsaveis-box">
                      <Info size={16} />
                      <span>Somente missionários vinculados (sem Superior, Ecônomo Local ou Pároco atribuído).</span>
                    </div>
                  ) : (
                    <div className="sem-responsaveis-box">
                      <Info size={16} />
                      <span>Nenhum missionário vinculado a esta presença no momento.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Missionaries List */}
        <div className="profile-main">
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Users size={18} /> Missionários Vinculados ({house.missionarios?.length || 0})
            </h4>
            
            <div className="data-table" style={{ boxShadow: 'none', border: '1px solid #f1f5f9' }}>
              <table style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função / Atribuição</th>
                    <th>Email</th>
                    <th className="center">Status</th>
                    <th className="center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(house.missionarios || []).length > 0 ? (
                    house.missionarios?.map(m => (
                      <tr key={m.id}>
                        <td className="bold">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{m.nome}</span>
                            {m.is_superior && (
                              <span title="Superior" style={{ color: '#eab308', display: 'inline-flex' }}>
                                <Star size={14} fill="#eab308" />
                              </span>
                            )}
                            {m.is_oconomo && (
                              <span title="Ecônomo Local" style={{ color: '#16a34a', display: 'inline-flex' }}>
                                <DollarSign size={14} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {m.funcao ? (
                            <span className="role-badge-table">{m.funcao}</span>
                          ) : m.is_superior ? (
                            <span className="role-badge-table">Superior Local</span>
                          ) : m.is_oconomo ? (
                            <span className="role-badge-table">Ecônomo Local</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Missionário</span>
                          )}
                        </td>
                        <td>{m.login}</td>
                        <td className="center">
                          <span className={`status-tag ${m.situacao?.toLowerCase()}`}>
                            {m.situacao}
                          </span>
                        </td>
                        <td className="center">
                          <button 
                            className="btn-action-icon view" 
                            title="Ver perfil do missionário"
                            onClick={() => navigate(`/missionarios/${m.id}`)}
                          >
                            <User size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        Nenhum missionário vinculado a esta presença no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilCasa;
