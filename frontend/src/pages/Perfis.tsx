import React, { useState, useEffect } from 'react';
import { Search, Filter, Lock, Eye, EyeOff, X, Save, Loader2, AlertCircle } from 'lucide-react';
import { useAuth, type UserRole } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import '../styles/Perfis.css';

interface UserProfile {
  id: number;
  nome: string;
  login: string;
  password?: string;
  role: UserRole;
  status: 'ATIVO' | 'INATIVO';
  situacao: 'ATIVO' | 'FALECIDO' | 'EGRESSO' | 'EXCLAUSTRADO';
}

const Perfis: React.FC = () => {
  const { canEdit } = useAuth();
  const { t } = useTranslation();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/usuarios/get');
      setProfiles(Array.isArray(response.data) ? response.data.filter((u: any) => !isHiddenTestUser(u.login)) : []);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching profiles:', err);
      setError(t('profiles_page.error', 'Erro ao carregar perfis'));
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'ADMIN_GERAL': return t('profiles_page.roles.admin_geral', 'Administrador Geral');
      case 'ADMINISTRADOR': return t('profiles_page.roles.administrador', 'Administrador');
      case 'COLABORADOR': return t('profiles_page.roles.colaborador', 'Colaborador');
      case 'INTERMITENTE': return t('profiles_page.roles.intermitente', 'Intermitente');
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

  const handleOpenEdit = (profile: UserProfile) => {
    setEditingProfile({ ...profile });
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
      situacao: 'ATIVO'
    });
    setIsModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    setSaveLoading(true);
    try {
      if (editingProfile.id === 0) {
        await api.post('/usuarios', editingProfile);
      } else {
        await api.put(`/usuarios/${editingProfile.id}`, editingProfile);
      }
      await fetchProfiles();
      setIsModalOpen(false);
      setEditingProfile(null);
    } catch (err) {
      console.error('Error saving profile:', err);
      alert(t('profiles_page.error_saving', 'Erro ao salvar perfil'));
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <Lock size={24} />
          <h2>{t('profiles_page.title', 'Gestão de Perfis')}</h2>
        </div>
        {canEdit && (
          <button className="btn-new" onClick={handleNewProfile}>
            {t('profiles_page.new_btn', '+ Novo Perfil')}
          </button>
        )}
      </div>

      <div className="filters-card">
        <div className="filter-group">
          <label>{t('profiles_page.filters.search', 'BUSCAR POR NOME')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('missionaries.search_placeholder', 'Pesquisar...')} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('profiles_page.filters.role', 'PERFIL / CARGO')}</label>
          <select onChange={() => {
            // Perfis.tsx needs to handle filtering if it's implemented. Let's make sure the selector fits the other options.
          }}>
            <option value="">{t('profiles_page.filters.all', 'Todos')}</option>
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
        <button className="btn-filter">
          <Filter size={18} /> {t('missionaries.filters.filter_btn', 'Filtrar')}
        </button>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <Loader2 className="animate-spin" size={32} />
          <p>{t('profiles_page.loading', 'Carregando perfis...')}</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button onClick={fetchProfiles} className="btn-retry">{t('profiles_page.retry', 'Tentar novamente')}</button>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>{t('profiles_page.table.id', 'ID')}</th>
                <th>{t('profiles_page.table.name', 'Nome')}</th>
                <th>{t('profiles_page.table.login', 'Login (E-mail)')}</th>
                <th className="center">{t('profiles_page.table.role', 'Perfil')}</th>
                <th className="center">{t('profiles_page.table.status', 'Status')}</th>
                <th className="center">{t('profiles_page.table.situation', 'Situação')}</th>
                <th>{t('profiles_page.table.actions', 'Ações')}</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((profile) => (
                <tr key={profile.id}>
                  <td>#{profile.id}</td>
                  <td className="bold">{profile.nome}</td>
                  <td>{profile.login}</td>
                  <td className="center">
                    <span className={`role-tag ${profile.role.toLowerCase()}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                  </td>
                  <td className="center">
                    <span className={`status-tag ${profile.status.toLowerCase()}`}>
                      {t(`profiles_page.status.${profile.status.toLowerCase()}`, profile.status)}
                    </span>
                  </td>
                  <td className="center">
                    <span className={`situacao-tag ${profile.situacao.toLowerCase()}`}>
                      {t(`missionaries.situations.${profile.situacao.toLowerCase()}`, profile.situacao)}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon-view" title={t('missionaries.table.view_details')} onClick={() => handleOpenEdit(profile)}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && editingProfile && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingProfile.id === 0 ? t('profiles_page.modal.new_title', 'Novo Perfil de Usuário') : t('profiles_page.modal.edit_title', 'Dados do Perfil')}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label>{t('profiles_page.modal.full_name', 'Nome Completo')}</label>
                <input
                  type="text"
                  value={editingProfile.nome}
                  onChange={(e) => setEditingProfile({ ...editingProfile, nome: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{t('profiles_page.modal.login', 'Login (E-mail)')}</label>
                <input
                  type="email"
                  value={editingProfile.login}
                  onChange={(e) => setEditingProfile({ ...editingProfile, login: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>{editingProfile.id === 0 ? t('profiles_page.modal.password_new', 'Senha') : t('profiles_page.modal.password_edit', 'Nova Senha (deixe em branco para manter)')}</label>
                <div className="password-group">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={editingProfile.password || ''}
                    onChange={(e) => setEditingProfile({ ...editingProfile, password: e.target.value })}
                    required={editingProfile.id === 0}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? t('common.hide_password', 'Ocultar senha') : t('common.show_password', 'Mostrar senha')}
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label>{t('profiles_page.modal.role', 'Perfil / Cargo')}</label>
                <select
                  value={editingProfile.role}
                  onChange={(e) => setEditingProfile({ ...editingProfile, role: e.target.value as UserRole })}
                >
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
              <div className="form-group">
                <label>{t('profiles_page.modal.status', 'Status')}</label>
                <select
                  value={editingProfile.status}
                  onChange={(e) => setEditingProfile({ ...editingProfile, status: e.target.value as 'ATIVO' | 'INATIVO' })}
                >
                  <option value="ATIVO">{t('profiles_page.status.ativo', 'ATIVO')}</option>
                  <option value="INATIVO">{t('profiles_page.status.inativo', 'INATIVO')}</option>
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>{t('profiles_page.modal.cancel', 'Cancelar')}</button>
                <button type="submit" className="btn-save" disabled={saveLoading}>
                  {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {editingProfile.id === 0 ? t('profiles_page.modal.create_btn', 'Criar Perfil') : t('profiles_page.modal.save_btn', 'Salvar Alterações')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Perfis;
