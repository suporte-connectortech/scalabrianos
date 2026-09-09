import React, { useState, useEffect } from 'react';
import { Search, Filter, Lock, Eye, EyeOff, Trash2, X, Save, Loader2, AlertCircle, ShieldCheck, Plus, Star, Home as HomeIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth, type UserRole } from '../context/AuthContext';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import '../styles/Perfis.css';
import '../styles/Missionarios.css';

interface Casa {
  id: number;
  nome: string;
}

interface CasaVinculo {
  id?: number;
  casa_id: string;
  data_inicio: string;
  is_superior: boolean;
  funcao: string[] | string;
  pm?: string;
  tipo?: string;
  pais?: string;
}

const PAISES_COMMON = [
  'Brasil', 'Argentina', 'Itália', 'Paraguai', 'Uruguai', 'Bolívia',
  'Chile', 'Colômbia', 'Equador', 'Peru', 'Venezuela', 'Estados Unidos',
  'Canadá', 'México', 'Portugal', 'Espanha', 'França', 'Alemanha'
];

function parseDateLocal(dateStr?: string | null): Date | null {
  if (!dateStr) return null;
  const base = String(dateStr).split('T')[0].split(' ')[0];
  const parts = base.split('-');
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]) - 1;
    const d = Number(parts[2]);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) return new Date(y, m, d);
  }
  const d = new Date(dateStr as string);
  return isNaN(d.getTime()) ? null : d;
}

function formatDateLocal(dateStr?: string | null): string {
  const d = parseDateLocal(dateStr);
  return d ? d.toLocaleDateString('pt-BR') : '—';
}

function calcDuracao(dataInicio: string): string {
  if (!dataInicio) return '';
  const ini = parseDateLocal(dataInicio);
  if (!ini) return '';
  const hoje = new Date();
  let anos = hoje.getFullYear() - ini.getFullYear();
  let months = hoje.getMonth() - ini.getMonth();
  if (months < 0) { anos--; months += 12; }
  const parts = [];
  if (anos > 0) parts.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (months > 0) parts.push(`${months} ${months > 1 ? 'meses' : 'mês'}`);
  return parts.length ? parts.join(' e ') : 'menos de 1 mês';
}

interface AdminProfile {
  id: number;
  nome: string;
  login: string;
  password?: string;
  role: UserRole;
  status: 'ATIVO' | 'INATIVO';
  situacao: 'ATIVO' | 'FALECIDO' | 'EGRESSO' | 'EXCLAUSTRADO';
  permissoes?: Record<string, boolean>;
  casa_nome?: string;
}

const PERMISSIONS_LIST = [
  { id: 'dados_civis', label: '1. Dados Civis (Visualização)' },
  { id: 'contatos', label: '2. Contatos (Visualização)' },
  { id: 'dados_religiosos', label: '3. Dados Religiosos (Visualização)' },
  { id: 'itinerario_formativo', label: '4. Itinerário Formativo (Visualização)' },
  { id: 'formacao_academica', label: '5. Formação Acadêmica (Visualização)' },
  { id: 'atividade_missionaria', label: '6. Atividade Missionária (Visualização)' },
  { id: 'saude', label: '7. Saúde (Visualização)' },
  { id: 'previdenciario_ir', label: '8. Previdenciário/IR (Visualização)' },
  { id: 'conta_bancaria', label: '9. Contas Bancárias (Visualização)' },
  { id: 'obras_realizadas', label: '10. Formação & Missão (Visualização)' },
  { id: 'observacoes', label: '11. Observações (Visualização)' },
  { id: 'quadro_pessoal', label: '12. Curriculum Vitae (Visualização)' },
];

const ADMIN_ROLES: UserRole[] = [
  'ADMIN_GERAL',
  'ADMINISTRADOR',
  'COLABORADOR',
  'INTERMITENTE',
  'PADRE',
  'REGISTRO_REGIONAL',
  'SUPERIOR_REGIONAL',
  'SECRETARIO_REGIONAL',
  'ECONOMO_REGIONAL',
  'SECRETARIADO_MISSAO',
  'SECRETARIADO_VIDA_RELIGIOSA',
  'SECRETARIADO_FORMACAO',
  'SUPERIOR_LOCAL',
  'ECONOMO_LOCAL',
  'MISSIONARIO'
];

const Administradores: React.FC = () => {
  const { t } = useTranslation();
  const { canEdit } = useAuth();
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<AdminProfile | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  const [casasDisponiveis, setCasasDisponiveis] = useState<Casa[]>([]);
  const [casasVinculos, setCasasVinculos] = useState<CasaVinculo[]>([]);
  const [novaCasa, setNovaCasa] = useState<CasaVinculo>({
    casa_id: '',
    data_inicio: '',
    is_superior: false,
    funcao: [],
    tipo: '',
    pm: '',
    pais: 'Brasil'
  });

  useEffect(() => {
    fetchProfiles();
    fetchCasas();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter]);

  const fetchCasas = async () => {
    try {
      const response = await api.post('/casas-religiosas/get');
      setCasasDisponiveis(response.data || []);
    } catch (err) {
      console.error('Erro ao carregar casas:', err);
    }
  };

  const casaNome = (id: any) => casasDisponiveis.find(c => String(c.id) === String(id))?.nome || '-';

  const showCasaVinculoSection = [
    'SUPERIOR_LOCAL',
    'SUPERIOR_REGIONAL',
    'ECONOMO_LOCAL',
    'ECONOMO_REGIONAL'
  ].includes(editingProfile?.role || '');

  const addCasaVinculo = async () => {
    if (!novaCasa.casa_id) {
      alert('Selecione uma casa');
      return;
    }
    if (!novaCasa.data_inicio) {
      alert('Selecione a data de início');
      return;
    }

    const funcaoPayload = Array.isArray(novaCasa.funcao)
      ? novaCasa.funcao.join(',')
      : (novaCasa.funcao ? String(novaCasa.funcao) : '');

    const item: CasaVinculo = {
      casa_id: novaCasa.casa_id,
      data_inicio: novaCasa.data_inicio,
      is_superior: !!novaCasa.is_superior,
      funcao: Array.isArray(novaCasa.funcao) ? [...novaCasa.funcao] : [],
      pm: novaCasa.pm || '',
      tipo: novaCasa.tipo || '',
      pais: novaCasa.pais || 'Brasil'
    };

    if (editingProfile && editingProfile.id > 0) {
      try {
        await api.post(`/usuarios/${editingProfile.id}/casas-historico`, {
          casa_id: item.casa_id,
          data_inicio: item.data_inicio,
          data_fim: null,
          funcao: funcaoPayload,
          is_superior: item.is_superior,
          pm: item.pm || null,
          tipo: item.tipo || null,
          pais: item.pais || null
        });
        
        const res = await api.get(`/usuarios/${editingProfile.id}/casas-historico`);
        const mapped = (res.data || []).map((v: any) => ({
          id: v.id,
          casa_id: String(v.casa_id),
          data_inicio: v.data_inicio ? v.data_inicio.split('T')[0] : '',
          is_superior: !!v.is_superior,
          funcao: v.funcao ? v.funcao.split(',') : [],
          pm: v.pm || '',
          tipo: v.tipo || '',
          pais: v.pais || 'Brasil'
        }));
        setCasasVinculos(mapped);
      } catch (err) {
        console.error('Erro ao vincular casa:', err);
        alert('Erro ao vincular casa');
      }
    } else {
      setCasasVinculos(prev => [...prev, item]);
    }

    setNovaCasa({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
  };

  const removeCasaVinculo = async (idx: number) => {
    const item = casasVinculos[idx];
    if (editingProfile && editingProfile.id > 0 && item.id) {
      try {
        await api.delete(`/usuarios/${editingProfile.id}/casas-historico/${item.id}`);
        const res = await api.get(`/usuarios/${editingProfile.id}/casas-historico`);
        const mapped = (res.data || []).map((v: any) => ({
          id: v.id,
          casa_id: String(v.casa_id),
          data_inicio: v.data_inicio ? v.data_inicio.split('T')[0] : '',
          is_superior: !!v.is_superior,
          funcao: v.funcao ? v.funcao.split(',') : [],
          pm: v.pm || '',
          tipo: v.tipo || '',
          pais: v.pais || 'Brasil'
        }));
        setCasasVinculos(mapped);
      } catch (err) {
        console.error('Erro ao remover vínculo:', err);
        alert('Erro ao remover vínculo');
      }
    } else {
      setCasasVinculos(prev => prev.filter((_, i) => i !== idx));
    }
  };

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/usuarios/get');
      const adminOnly = response.data.filter((u: AdminProfile) => ADMIN_ROLES.includes(u.role) && !isHiddenTestUser(u.login));
      setProfiles(adminOnly);
      setError(null);
    } catch (err: any) {
      setError(t('missionaries.error_loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < 10; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (editingProfile) {
      setEditingProfile({ ...editingProfile, password: pass });
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN_GERAL': return t('admins.roles.admin_geral');
      case 'ADMINISTRADOR': return t('admins.roles.administrador', 'Administrador');
      case 'COLABORADOR': return t('admins.roles.colaborador');
      case 'INTERMITENTE': return t('admins.roles.intermitente');
      case 'PADRE': return 'Missionário';
      case 'MISSIONARIO': return 'Missionário';
      case 'REGISTRO_REGIONAL': return 'Registro Regional';
      case 'SUPERIOR_REGIONAL': return 'Superior Regional';
      case 'SECRETARIO_REGIONAL': return 'Secretário Regional';
      case 'ECONOMO_REGIONAL': return 'Ecônomo Regional';
      case 'SECRETARIADO_MISSAO': return 'Secretariado da Missão';
      case 'SECRETARIADO_VIDA_RELIGIOSA': return 'Secretariado da Vida Religiosa';
      case 'SECRETARIADO_FORMACAO': return 'Secretariado da Formação';
      case 'SUPERIOR_LOCAL': return 'Superior Local';
      case 'ECONOMO_LOCAL': return 'Ecônomo Local';
      default: return role;
    }
  };

  const handleOpenEdit = async (profile: AdminProfile) => {
    let perms = profile.permissoes || {};
    if (typeof perms === 'string') {
      try {
        perms = JSON.parse(perms);
      } catch {
        perms = {};
      }
    }
    setEditingProfile({ ...profile, permissoes: perms });

    // Load existing house linkages
    try {
      const res = await api.get(`/usuarios/${profile.id}/casas-historico`);
      const mapped = (res.data || []).map((v: any) => ({
        id: v.id,
        casa_id: String(v.casa_id),
        data_inicio: v.data_inicio ? v.data_inicio.split('T')[0] : '',
        is_superior: !!v.is_superior,
        funcao: v.funcao ? v.funcao.split(',') : [],
        pm: v.pm || '',
        tipo: v.tipo || '',
        pais: v.pais || 'Brasil'
      }));
      setCasasVinculos(mapped);
    } catch (err) {
      console.error('Erro ao carregar vínculos de casa:', err);
      setCasasVinculos([]);
    }

    setNovaCasa({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
    setIsModalOpen(true);
  };

  const handleNewProfile = () => {
    setEditingProfile({
      id: 0,
      nome: '',
      login: '',
      password: '',
      role: 'COLABORADOR',
      status: 'ATIVO',
      situacao: 'ATIVO',
      permissoes: {}
    });
    setCasasVinculos([]);
    setNovaCasa({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
    setIsModalOpen(true);
  };

  const handleTogglePermission = (permId: string) => {
    if (!editingProfile) return;
    const currentPerms = { ...editingProfile.permissoes };
    currentPerms[permId] = !currentPerms[permId];
    setEditingProfile({ ...editingProfile, permissoes: currentPerms });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;
    setSaveLoading(true);
    try {
      // Auto-save pending presence inputs if filled but not vinculated yet
      let finalVinculos = [...casasVinculos];
      if (showCasaVinculoSection && novaCasa.casa_id && novaCasa.data_inicio) {
        const alreadyLinked = casasVinculos.some(v => String(v.casa_id) === String(novaCasa.casa_id) && v.data_inicio === novaCasa.data_inicio);
        if (!alreadyLinked) {
          const item: CasaVinculo = {
            casa_id: novaCasa.casa_id,
            data_inicio: novaCasa.data_inicio,
            is_superior: !!novaCasa.is_superior,
            funcao: Array.isArray(novaCasa.funcao) ? [...novaCasa.funcao] : [],
            pm: novaCasa.pm || '',
            tipo: novaCasa.tipo || '',
            pais: novaCasa.pais || 'Brasil'
          };
          
          if (editingProfile.id === 0) {
            finalVinculos.push(item);
          } else {
            const funcaoPayload = Array.isArray(item.funcao) ? item.funcao.join(',') : (item.funcao ? String(item.funcao) : '');
            await api.post(`/usuarios/${editingProfile.id}/casas-historico`, {
              casa_id: item.casa_id,
              data_inicio: item.data_inicio,
              data_fim: null,
              funcao: funcaoPayload,
              is_superior: item.is_superior,
              pm: item.pm || null,
              tipo: item.tipo || null,
              pais: item.pais || null
            });
          }
        }
      }

      let response;
      if (editingProfile.id === 0) {
        response = await api.post('/usuarios', editingProfile);
        const newId = response.data.id;
        
        // Save house linkages
        for (const v of finalVinculos) {
          const funcaoPayload = Array.isArray(v.funcao) ? v.funcao.join(',') : (v.funcao ? String(v.funcao) : '');
          await api.post(`/usuarios/${newId}/casas-historico`, {
            casa_id: v.casa_id,
            data_inicio: v.data_inicio,
            data_fim: null,
            funcao: funcaoPayload,
            is_superior: v.is_superior,
            pm: v.pm || null,
            tipo: v.tipo || null,
            pais: v.pais || null
          });
        }
      } else {
        await api.put(`/usuarios/${editingProfile.id}`, editingProfile);
      }
      await fetchProfiles();
      setIsModalOpen(false);
    } catch {
      alert(t('common.error'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDeleteProfile = async (profile: AdminProfile) => {
    if (!window.confirm(`Tem certeza que deseja excluir o usuário ${profile.nome} (${profile.login})? Isso apagará todas as informações associadas.`)) {
      return;
    }

    try {
      await api.post(`/usuarios/${profile.id}/delete`);
      await fetchProfiles();
    } catch {
      alert('Erro ao excluir usuário. Tente novamente.');
    }
  };

  const filtered = profiles.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.login.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter ? p.role === roleFilter : true;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedProfiles = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <Lock size={24} />
          <h2>{t('admins.title')}</h2>
        </div>
        {canEdit && (
          <button className="btn-new" onClick={handleNewProfile}>{t('admins.new_btn')}</button>
        )}
      </div>

      <div className="filters-card">
        <div className="filter-group">
          <label>{t('admins.filters.search')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('common.loading').replace('...', '') + "..."} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('admins.filters.role')}</label>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
            <option value="">{t('missionaries.filters.all')}</option>
            <option value="SUPERIOR_REGIONAL">Superior Regional</option>
            <option value="SECRETARIO_REGIONAL">Secretário Regional</option>
            <option value="ECONOMO_REGIONAL">Ecônomo Regional</option>
            <option value="SECRETARIADO_MISSAO">Secretariado da Missão</option>
            <option value="SECRETARIADO_VIDA_RELIGIOSA">Secretariado da Vida Religiosa</option>
            <option value="SECRETARIADO_FORMACAO">Secretariado da Formação</option>
            <option value="SUPERIOR_LOCAL">Superior Local</option>
            <option value="ECONOMO_LOCAL">Ecônomo Local</option>
            <option value="PADRE">Missionário</option>
            <option value="REGISTRO_REGIONAL">Registro Regional</option>
          </select>
        </div>
        <button className="btn-filter"><Filter size={18} /> {t('missionaries.filters.filter_btn')}</button>
      </div>

      {isLoading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /><p>{t('common.loading')}</p></div>
      ) : error ? (
        <div className="error-state"><AlertCircle size={32} /><p>{error}</p><button onClick={fetchProfiles} className="btn-retry">{t('common.retry')}</button></div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>{t('missionaries.table.id')}</th>
                <th>{t('missionaries.table.name')}</th>
                <th>{t('missionaries.table.login')}</th>
                <th className="center">{t('admins.filters.role')}</th>
                <th>{t('missionaries.table.house')}</th>
                <th className="center">{t('missionaries.table.status')}</th>
                <th>{t('missionaries.table.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedProfiles.map(profile => (
                <tr key={profile.id}>
                  <td>#{profile.id}</td>
                  <td className="bold">{profile.nome}</td>
                  <td>{profile.login}</td>
                  <td className="center"><span className={`role-tag ${profile.role.toLowerCase()}`}>{getRoleLabel(profile.role)}</span></td>
                  <td>{profile.casa_nome || '—'}</td>
                  <td className="center"><span className={`status-tag ${profile.status.toLowerCase()}`}>{profile.status}</span></td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-icon-view" onClick={() => handleOpenEdit(profile)}><Eye size={18} /></button>
                      {canEdit && (
                        <button className="btn-icon-delete" type="button" onClick={() => handleDeleteProfile(profile)}><Trash2 size={18} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>Página {currentPage} de {totalPages}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{ background: currentPage === 1 ? '#e2e8f0' : 'white', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <button 
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{ background: currentPage === totalPages ? '#e2e8f0' : 'white', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {isModalOpen && editingProfile && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '25px 35px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#013375', color: 'white', padding: '8px', borderRadius: '10px' }}>
                  <ShieldCheck size={20} />
                </div>
                <h3 style={{ fontSize: '1.4rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                  {editingProfile.id === 0 ? 'Novo Registro' : `Editar ${getRoleLabel(editingProfile.role)}`}
                </h3>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
              <div style={{ padding: '35px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2.5rem', overflowY: 'auto', flex: 1 }}>

                {/* COLUNA ESQUERDA: DADOS BÁSICOS */}
                <div className="form-column">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ marginBottom: '5px' }}>
                      <h4 style={{ fontSize: '0.9rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '20px', borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
                        Dados de Acesso
                      </h4>
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>{t('missionaries.wizard.civil.full_name')}</label>
                      <input
                        type="text"
                        value={editingProfile.nome}
                        onChange={e => setEditingProfile({ ...editingProfile, nome: e.target.value })}
                        required
                        style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', transition: 'all 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                        placeholder="Ex: João Silva"
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>{t('missionaries.wizard.access.email')}</label>
                      <input
                        type="email"
                        value={editingProfile.login}
                        onChange={e => setEditingProfile({ ...editingProfile, login: e.target.value })}
                        required
                        style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                        placeholder="email@exemplo.com"
                      />
                    </div>

                    <div className="form-group">
                      <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>
                        {editingProfile.id === 0 ? t('missionaries.wizard.access.password') : 'Redefinir Senha'}
                      </label>
                      <div className="password-group" style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={editingProfile.password || ''}
                            onChange={e => setEditingProfile({ ...editingProfile, password: e.target.value })}
                            required={editingProfile.id === 0}
                            style={{ padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                            placeholder="••••••••"
                          />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        <button type="button" onClick={generateRandomPassword} style={{ background: '#f1f5f9', color: '#013375', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0 18px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                          Gerar
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.85rem' }}>Perfil de Acesso</label>
                        <select value={editingProfile.role} onChange={e => setEditingProfile({ ...editingProfile, role: e.target.value as UserRole })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', cursor: 'pointer', background: 'white' }}>
                          <option value="SUPERIOR_REGIONAL">Superior Regional</option>
                          <option value="SECRETARIO_REGIONAL">Secretário Regional</option>
                          <option value="ECONOMO_REGIONAL">Ecônomo Regional</option>
                          <option value="SECRETARIADO_MISSAO">Secretariado da Missão</option>
                          <option value="SECRETARIADO_VIDA_RELIGIOSA">Secretariado da Vida Religiosa</option>
                          <option value="SECRETARIADO_FORMACAO">Secretariado da Formação</option>
                          <option value="SUPERIOR_LOCAL">Superior Local</option>
                          <option value="ECONOMO_LOCAL">Ecônomo Local</option>
                          <option value="PADRE">Missionário</option>
                          <option value="REGISTRO_REGIONAL">Registro Regional</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.85rem' }}>{t('missionaries.table.status')}</label>
                        <select value={editingProfile.status} onChange={e => setEditingProfile({ ...editingProfile, status: e.target.value as 'ATIVO' | 'INATIVO' })} style={{ padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', cursor: 'pointer', background: 'white' }}>
                          <option value="ATIVO">ATIVO</option>
                          <option value="INATIVO">INATIVO</option>
                        </select>
                      </div>
                    </div>


                  </div>
                </div>

                {/* COLUNA DIREITA: PERMISSÕES */}
                <div className="form-column">
                  <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ marginBottom: '20px' }}>
                      <h4 style={{ fontSize: '0.9rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '10px', borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
                        Permissões de Visualização
                      </h4>
                      <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, paddingLeft: '16px' }}>Defina o que este usuário poderá visualizar nos perfis.</p>
                    </div>

                    <div style={{
                      background: '#ffffff',
                      padding: '10px',
                      borderRadius: '18px',
                      border: '1px solid #e2e8f0',
                      flex: 1,
                      maxHeight: '440px',
                      overflowY: 'auto',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
                      display: 'grid',
                      gridTemplateColumns: '1fr',
                      gap: '8px'
                    }}>
                      {PERMISSIONS_LIST.map(perm => {
                        const isChecked = !!editingProfile.permissoes?.[perm.id];
                        return (
                          <label key={perm.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            padding: '12px 16px',
                            borderRadius: '12px',
                            background: isChecked ? 'linear-gradient(to right, #eff6ff, #ffffff)' : 'transparent',
                            border: `1px solid ${isChecked ? '#bfdbfe' : 'transparent'}`,
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            position: 'relative'
                          }}>
                            <div style={{
                              width: '22px',
                              height: '22px',
                              borderRadius: '6px',
                              border: `2px solid ${isChecked ? '#013375' : '#cbd5e1'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isChecked ? '#013375' : 'white',
                              transition: 'all 0.2s'
                            }}>
                              {isChecked && <ShieldCheck size={14} color="white" />}
                            </div>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleTogglePermission(perm.id)}
                              style={{ display: 'none' }}
                            />
                            <span style={{ color: isChecked ? '#013375' : '#475569', fontWeight: isChecked ? 700 : 500 }}>
                              {perm.label}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* PRESENÇA MISSIONÁRIA: FULL WIDTH BOTTOM */}
                {showCasaVinculoSection && (
                  <div className="casa-wizard-add" style={{ gridColumn: '1 / -1', marginTop: '20px', padding: '20px', border: '1px solid #e2e8f0', borderRadius: '16px', background: '#f8fafc' }}>
                    <div style={{ marginBottom: '16px' }}>
                      <h4 style={{ fontSize: '0.9rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, margin: 0, borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
                        Presença Missionária (Opcional)
                      </h4>
                    </div>
                    <div className="casa-wizard-add-fields" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.2fr 1.2fr', gap: '15px' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.8rem' }}>Tipo</label>
                        <select value={novaCasa.tipo} onChange={e => setNovaCasa(p => ({ ...p, tipo: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', background: 'white' }}>
                          <option value="">Selecione...</option>
                          <option value="CI">Casas de Idosos – CI</option>
                          <option value="CR">Casas Religiosas – CR</option>
                          <option value="M">Obras – M</option>
                          <option value="P">Paróquia – P</option>
                          <option value="PV">Pastoral Vocacional - PV</option>
                          <option value="CS">Seminário - CS</option>
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.8rem' }}>Comunidade Religiosa</label>
                        <select value={novaCasa.casa_id} onChange={e => setNovaCasa(p => ({ ...p, casa_id: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', background: 'white' }}>
                          <option value="">Selecione...</option>
                          {casasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.8rem' }}>PM</label>
                        <input type="text" value={novaCasa.pm} onChange={e => setNovaCasa(p => ({ ...p, pm: e.target.value }))} placeholder="Ex: CR 13" style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem' }} />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.8rem' }}>País</label>
                        <input type="text" list="paises-list-admin" value={novaCasa.pais} onChange={e => setNovaCasa(p => ({ ...p, pais: e.target.value }))} placeholder="Selecione ou digite..." style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem' }} />
                        <datalist id="paises-list-admin">
                          {PAISES_COMMON.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.8rem' }}>Data de Início</label>
                        <input type="date" value={novaCasa.data_inicio} onChange={e => setNovaCasa(p => ({ ...p, data_inicio: e.target.value }))} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem' }} />
                      </div>
                      <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '20px', marginTop: '10px' }}>
                        {[
                          { key: 'Superior Local', label: 'Superior Local', isSuperior: true },
                          { key: 'Ecônomo Local', label: 'Ecônomo Local' },
                          { key: 'Pároco', label: 'Pároco' },
                          { key: 'Diretor', label: 'Diretor' },
                          { key: 'Vigário', label: 'Vigário' },
                          { key: 'Reitor', label: 'Reitor' },
                        ].map(r => (
                          <label key={r.key} className="checkbox-label" style={{ marginTop: '0', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            <input
                              type="checkbox"
                              checked={Array.isArray(novaCasa.funcao) && novaCasa.funcao.includes(r.key)}
                              onChange={e => setNovaCasa(p => {
                                const current = Array.isArray(p.funcao) ? [...p.funcao] : [];
                                if (e.target.checked) {
                                  if (!current.includes(r.key)) current.push(r.key);
                                } else {
                                  const idx = current.indexOf(r.key);
                                  if (idx >= 0) current.splice(idx, 1);
                                }
                                return { ...p, funcao: current, is_superior: r.isSuperior ? current.includes('Superior Local') : p.is_superior };
                              })}
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
                      <button type="button" className="btn-add-casa-wz" onClick={addCasaVinculo} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#013375', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer' }}>
                        <Plus size={15} /> Vincular Presença
                      </button>
                    </div>

                    {casasVinculos.length === 0 ? (
                      <div className="casa-empty" style={{ textAlign: 'center', padding: '15px', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma presença vinculada ainda.</div>
                    ) : (
                      <div className="casas-wz-list" style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {casasVinculos.map((v, i) => (
                          <div key={i} className="casa-wz-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                            <div className="casa-wz-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <HomeIcon size={18} className="casa-icon" style={{ color: '#013375' }} />
                              <div>
                                <span className="casa-wz-nome" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>{casaNome(v.casa_id)}</span>
                                <div className="casa-wz-meta" style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                  <span>desde {formatDateLocal(v.data_inicio)}</span>
                                  <span className="duracao-pill" style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>⏱ {calcDuracao(v.data_inicio)}</span>
                                  {v.funcao && (Array.isArray(v.funcao) ? v.funcao.length > 0 : v.funcao) && (
                                    <span className="superior-pill" style={{ background: '#eff6ff', color: '#1e40af', padding: '2px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <Star size={11} /> {Array.isArray(v.funcao) ? v.funcao.join(', ') : v.funcao}
                                    </span>
                                  )}
                                  {v.pm && <div style={{ width: '100%', color: '#3b82f6' }}>PM: {v.pm}</div>}
                                </div>
                              </div>
                            </div>
                            <button type="button" className="btn-remove-wz" onClick={() => removeCasaVinculo(i)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '25px 35px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)} style={{ borderRadius: '12px', padding: '12px 25px', fontWeight: 700, fontSize: '0.9rem', border: '1px solid #e2e8f0' }}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-save" disabled={saveLoading} style={{ borderRadius: '12px', padding: '12px 35px', fontWeight: 800, fontSize: '0.9rem', background: '#013375', color: 'white', boxShadow: '0 4px 6px -1px rgba(1, 51, 117, 0.3)' }}>
                  {saveLoading ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                  {editingProfile.id === 0 ? 'Criar Acesso' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Administradores;
