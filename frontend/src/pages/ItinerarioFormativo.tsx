import React, { useState, useEffect } from 'react';
import {
  Save, Milestone, GraduationCap, Loader2, Users,
  CheckCircle2, AlertCircle, Search, Eye
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import '../styles/ItinerarioFormativo.css';
import '../styles/ItinerarioDashboard.css';

interface FormationStage {
  etapa: string;
  local: string;
  periodo: string;
}

interface DashboardItem {
  id: number;
  nome: string;
  casa_nome: string;
  stages: string[];
  missing: string[];
  has_academic: boolean;
  progress: number;
  total_mandatory: number;
}

// const MANDATORY_STAGES = ['SEMINARIO', 'PROPEDEUTICO', 'FILOSOFIA', 'POSTULADO', 'NOVICIADO', 'TEOLOGIA'];

const ItinerarioFormativo: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { canEdit, user, isAdminGeral } = useAuth();

  const [stages, setStages] = useState<Record<string, FormationStage>>({
    'SEMINARIO': { etapa: 'SEMINARIO', local: '', periodo: '' },
    'PROPEDEUTICO': { etapa: 'PROPEDEUTICO', local: '', periodo: '' },
    'FILOSOFIA': { etapa: 'FILOSOFIA', local: '', periodo: '' },
    'POSTULADO': { etapa: 'POSTULADO', local: '', periodo: '' },
    'NOVICIADO': { etapa: 'NOVICIADO', local: '', periodo: '' },
    'TEOLOGIA': { etapa: 'TEOLOGIA', local: '', periodo: '' },
  });

  const [outrasFormacoes, setOutrasFormacoes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dashboard states
  const [dashboardData, setDashboardData] = useState<DashboardItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const isManagement = isAdminGeral || (user?.role === 'ADMINISTRADOR');

  useEffect(() => {
    if (isManagement) {
      fetchDashboard();
    } else if (user?.id) {
      fetchItinerary();
    }
  }, [user?.id, isManagement]);

  const fetchDashboard = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/itinerario-dashboard');
      setDashboardData(Array.isArray(response.data) ? response.data.filter((u: any) => !isHiddenTestUser(u.login)) : []);
    } catch (err) {
      console.error('Error fetching itinerary dashboard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchItinerary = async () => {
    setIsLoading(true);
    try {
      const response = await api.post(`/usuarios/${user?.id}/itinerario/get`);
      if (response.data && Array.isArray(response.data)) {
        const newStages = { ...stages };
        response.data.forEach((s: any) => {
          if (newStages[s.etapa]) {
            newStages[s.etapa] = { etapa: s.etapa, local: s.local || '', periodo: s.periodo || '' };
          }
        });
        setStages(newStages);
      }
    } catch (err) {
      console.error('Error fetching itinerary:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = (etapa: string, field: 'local' | 'periodo', value: string) => {
    setStages(prev => ({
      ...prev,
      [etapa]: { ...prev[etapa], [field]: value }
    }));
  };

  const handleSaveAll = async () => {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const stagesArray = Object.values(stages).filter(s => s.local || s.periodo);
      await api.post(`/usuarios/${user.id}/itinerario`, { stages: stagesArray });
      alert(t('common.save'));
    } catch (err) {
      console.error('Error saving itinerary:', err);
      alert(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <Loader2 className="animate-spin" size={48} />
        <p>{t('common.loading')}</p>
      </div>
    );
  }

  // --- Dashboard View (Admin) ---
  if (isManagement) {
    const filtered = dashboardData.filter(d =>
      d.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.casa_nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const stats = {
      total: dashboardData.length,
      complete: dashboardData.filter(d => d.missing.length === 0).length,
      incomplete: dashboardData.filter(d => d.missing.length > 0).length,
    };

    return (
      <div className="page-container">
        <div className="page-header">
          <div className="title-with-badge">
            <Milestone size={24} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <h2 style={{ margin: 0 }}>Visão Geral dos Seminaristas</h2>
              <span style={{ fontSize: '13px', color: '#64748b' }}>Monitoramento de progresso e pendências</span>
            </div>
          </div>
        </div>

        <div className="itinerary-dashboard">
          <div className="itinerary-stats">
            <div className="card-premium stat-card">
              <div className="stat-icon" style={{ color: '#013375' }}><Users size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Total de Religiosos</span>
              </div>
            </div>
            <div className="card-premium stat-card">
              <div className="stat-icon" style={{ color: '#16a34a' }}><CheckCircle2 size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{stats.complete}</span>
                <span className="stat-label">Itinerários Completos</span>
              </div>
            </div>
            <div className="card-premium stat-card">
              <div className="stat-icon" style={{ color: '#dc2626' }}><AlertCircle size={24} /></div>
              <div className="stat-info">
                <span className="stat-value">{stats.incomplete}</span>
                <span className="stat-label">Itinerários Pendentes</span>
              </div>
            </div>
          </div>

          <div className="card-lite" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div className="search-input" style={{ width: '350px' }}>
                <input
                  type="text"
                  placeholder="Buscar missionário ou presença..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search size={18} />
              </div>
            </div>

            <div className="data-table itinerary-table">
              <table>
                <thead>
                  <tr>
                    <th>Religioso</th>
                    <th>Presença</th>
                    <th>Progresso</th>
                    <th>Pendências</th>
                    <th className="center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="missionary-info">
                          <span className="missionary-name">{item.nome}</span>
                          <span className="missionary-house">ID: #{item.id}</span>
                        </div>
                      </td>
                      <td>{item.casa_nome || '---'}</td>
                      <td>
                        <div style={{ width: '150px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span className="progress-text">{item.progress}/{item.total_mandatory} etapas</span>
                            <span className="progress-text">{Math.round((item.progress / item.total_mandatory) * 100)}%</span>
                          </div>
                          <div className="progress-bar-container">
                            <div
                              className="progress-bar-fill"
                              style={{ width: `${(item.progress / item.total_mandatory) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="missing-list">
                          {item.missing.length === 0 ? (
                            <span className="complete-badge">Completo</span>
                          ) : (
                            item.missing.map(m => (
                              <span key={m} className="missing-badge">{m}</span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="center">
                        <button
                          className="btn-action-lite"
                          onClick={() => navigate(`/missionarios/${item.id}`)}
                          title="Ver Perfil Completo"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Individual View (Missionary) ---
  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <Milestone size={24} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: 0 }}>Meu Itinerário Formativo</h2>
            <span style={{ fontSize: '13px', color: '#64748b' }}>Registro de etapas e formação religiosa</span>
          </div>
        </div>
        {canEdit && (
          <button className="btn-save-main" onClick={handleSaveAll} disabled={isSaving}>
            {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
            {isSaving ? t('login.loading') : t('common.save')}
          </button>
        )}
      </div>

      <div className="itinerary-dashboard">
        <div className="card-premium">
          <div className="section-title">
            <Milestone size={20} /> <h3>Etapas de Formação</h3>
          </div>

          <div className="form-grid" style={{ marginTop: '24px' }}>
            {Object.keys(stages).map(key => (
              <div key={key} className="form-group">
                <label>{key.charAt(0) + key.slice(1).toLowerCase()}</label>
                <div className="multi-input">
                  <input
                    type="text"
                    placeholder="Ano/Período"
                    value={stages[key].periodo}
                    onChange={(e) => handleStageChange(key, 'periodo', e.target.value)}
                    disabled={!canEdit}
                  />
                  <input
                    type="text"
                    placeholder="Local/Instituição"
                    value={stages[key].local}
                    onChange={(e) => handleStageChange(key, 'local', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="section-title mt-4" style={{ paddingTop: '24px', borderTop: '1px solid #f1f5f9' }}>
            <GraduationCap size={20} /> <h3>Formação Acadêmica Adicional</h3>
          </div>
          <div className="form-grid" style={{ marginTop: '20px' }}>
            <div className="form-group full-row">
              <label>Outras Especializações / Mestrados</label>
              <textarea
                rows={4}
                placeholder="Descreva outras formações..."
                value={outrasFormacoes}
                onChange={(e) => setOutrasFormacoes(e.target.value)}
                disabled={!canEdit}
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItinerarioFormativo;
