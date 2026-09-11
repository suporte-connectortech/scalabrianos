import React, { useState, useEffect } from 'react';
import { Search, Filter, Lock, Eye, EyeOff, Trash2, X, Save, Loader2, AlertCircle, ShieldCheck, Plus, Star, Home as HomeIcon, ChevronLeft, ChevronRight, Clock, Activity, History, Calendar, ArrowRight, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
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

function formatDateTimeLocal(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
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
  created_at?: string;
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

  const [activeModalTab, setActiveModalTab] = useState<'dados' | 'historico' | 'atividades'>('dados');
  const [historicoCompleto, setHistoricoCompleto] = useState<{
    usuario?: any;
    historico_perfil: any[];
    historico_situacao: any[];
    logs: any[];
  }>({ historico_perfil: [], historico_situacao: [], logs: [] });
  const [historyLoading, setHistoryLoading] = useState(false);
  const [initialRole, setInitialRole] = useState<UserRole | null>(null);
  const [confirmRoleModalOpen, setConfirmRoleModalOpen] = useState(false);
  const [roleChangeReason, setRoleChangeReason] = useState('');

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
      if (!window.confirm('Deseja realmente remover este vínculo de casa do histórico?')) return;
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

  const showCasaVinculoSection = [
    'SUPERIOR_LOCAL',
    'SUPERIOR_REGIONAL',
    'ECONOMO_LOCAL',
    'ECONOMO_REGIONAL',
    'PADRE',
    'MISSIONARIO'
  ].includes(editingProfile?.role || '');

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

  const fetchUserHistory = async (userId: number) => {
    setHistoryLoading(true);
    try {
      const res = await api.get(`/usuarios/${userId}/historico-completo`);
      setHistoricoCompleto(res.data || { historico_perfil: [], historico_situacao: [], logs: [] });
    } catch (err) {
      console.error('Erro ao carregar histórico completo:', err);
      setHistoricoCompleto({ historico_perfil: [], historico_situacao: [], logs: [] });
    } finally {
      setHistoryLoading(false);
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

  const getRoleLabel = (role: UserRole | string) => {
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
      case 'CADASTRO_INICIAL': return 'Cadastro Inicial';
      default: return role || '—';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'Ativo';
      case 'INATIVO': return 'Inativo';
      case 'BLOQUEADO': return 'Bloqueado';
      case 'PENDENTE': return 'Pendente';
      default: return status || '—';
    }
  };

  const getSituacaoLabel = (sit: string) => {
    switch (sit) {
      case 'EM_ATIVIDADE': return 'Em Atividade';
      case 'FALECIDO': return 'Falecido';
      case 'EGRESSO': return 'Egresso';
      case 'EXCLAUSTRADO': return 'Exclaustrado';
      case 'AFASTADO': return 'Afastado';
      case 'FORMACAO': return 'Em Formação';
      default: return sit || '—';
    }
  };

  const renderChangeItem = (item: string, idx: number) => {
    let trimmed = item.trim();
    if (!trimmed) return null;

    // Extract any embedded motif [Motivo...: ...]
    let extractedMotivo = '';
    const motivoMatch = trimmed.match(/\[Motivo[^:]*:\s*([^\]]+)\]/i) || trimmed.match(/\[Motivo\s*([^\]]+)\]/i);
    if (motivoMatch) {
      extractedMotivo = motivoMatch[1].trim();
      trimmed = trimmed.replace(motivoMatch[0], '').trim();
    }

    // Standalone Motivo / Justificativa
    if (trimmed.startsWith('Motivo') && trimmed.includes(':')) {
      const mText = trimmed.substring(trimmed.indexOf(':') + 1).trim();
      return (
        <div key={idx} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#fffbeb',
          color: '#92400e',
          border: '1px solid #fde68a',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          fontWeight: 600,
          whiteSpace: 'nowrap'
        }}>
          <Info size={13} style={{ color: '#d97706', flexShrink: 0 }} />
          <span style={{ fontWeight: 800 }}>Motivo:</span>
          <span>{mText}</span>
        </div>
      );
    }

    // Senha de acesso
    if (trimmed.toLowerCase().includes('senha')) {
      return (
        <div key={idx} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#fdf2f8',
          color: '#9d174d',
          border: '1px solid #fbcfe8',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}>
          <Lock size={13} style={{ color: '#db2777', flexShrink: 0 }} />
          <span>{trimmed}</span>
        </div>
      );
    }

    // Permissões de visualização
    if (trimmed.toLowerCase().includes('permissões') || trimmed.toLowerCase().includes('permissoes')) {
      return (
        <div key={idx} style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#f0fdf4',
          color: '#166534',
          border: '1px solid #bbf7d0',
          padding: '4px 10px',
          borderRadius: '8px',
          fontSize: '0.8rem',
          fontWeight: 700,
          whiteSpace: 'nowrap'
        }}>
          <ShieldCheck size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
          <span>{trimmed}</span>
        </div>
      );
    }

    // Standard field diff (FieldName: Antes (...) ➔ Atualizado (...))
    let fieldName = '';
    let rest = trimmed;
    const colonPos = trimmed.indexOf(':');
    if (colonPos !== -1) {
      fieldName = trimmed.substring(0, colonPos).trim();
      rest = trimmed.substring(colonPos + 1).trim();
    }

    const isPerfil = fieldName.toLowerCase().includes('perfil') || trimmed.toLowerCase().includes('perfil');
    const isStatus = fieldName.toLowerCase().includes('status') || trimmed.toLowerCase().includes('status');
    const isSituacao = fieldName.toLowerCase().includes('situação') || fieldName.toLowerCase().includes('situacao');
    const isNome = fieldName.toLowerCase().includes('nome');
    const isLogin = fieldName.toLowerCase().includes('login') || fieldName.toLowerCase().includes('e-mail') || fieldName.toLowerCase().includes('email');

    let valorAntes = '';
    let valorNovo = '';

    if (rest.includes('➔') || rest.includes('->') || rest.includes(' para ') || rest.includes('-->')) {
      const arrow = rest.includes('➔') ? '➔' : (rest.includes('->') ? '->' : (rest.includes('-->') ? '-->' : ' para '));
      const parts = rest.split(arrow);
      valorAntes = parts[0] ? parts[0].trim() : '';
      valorNovo = parts[1] ? parts[1].trim() : '';
    } else {
      // Single value fallback: deduce previous value
      if (isPerfil) {
        valorNovo = rest;
        const pMatch = historicoCompleto?.historico_perfil?.[0];
        valorAntes = pMatch ? pMatch.perfil_anterior : (rest.toUpperCase().includes('PADRE') || rest.toUpperCase().includes('MISSIONARIO') ? 'CADASTRO_INICIAL' : 'PADRE');
      } else if (isStatus) {
        valorNovo = rest;
        valorAntes = rest.toUpperCase().includes('INATIVO') ? 'ATIVO' : 'INATIVO';
      } else if (isSituacao) {
        valorNovo = rest;
        const sMatch = historicoCompleto?.historico_situacao?.[0];
        valorAntes = sMatch ? sMatch.situacao_anterior : 'EM_ATIVIDADE';
      } else {
        valorNovo = rest;
      }
    }

    const cleanVal = (val: string, type: string) => {
      let v = val
        .replace(/\[Motivo[^\]]*\]/gi, '')
        .replace(/^Antes\s*\(?/i, '')
        .replace(/^Antes:\s*/i, '')
        .replace(/^Atualizado\s*\(?/i, '')
        .replace(/^Atualizado:\s*/i, '')
        .replace(/^Atualmente\s*\(?/i, '')
        .replace(/^Atualmente:\s*/i, '')
        .replace(/^\(/, '')
        .replace(/\)$/, '')
        .replace(/^["']/, '')
        .replace(/["']$/, '')
        .trim();

      if (type === 'perfil') return getRoleLabel(v);
      if (type === 'status') return getStatusLabel(v);
      if (type === 'situacao') return getSituacaoLabel(v);
      return v;
    };

    const typeStr = isPerfil ? 'perfil' : (isStatus ? 'status' : (isSituacao ? 'situacao' : 'other'));
    const formattedAntes = valorAntes ? cleanVal(valorAntes, typeStr) : '';
    const formattedNovo = valorNovo ? cleanVal(valorNovo, typeStr) : cleanVal(rest, typeStr);

    const displayField = fieldName || (isPerfil ? 'Perfil' : (isStatus ? 'Status' : (isSituacao ? 'Situação' : (isNome ? 'Nome' : (isLogin ? 'Login / E-mail' : 'Campo')))));

    return (
      <div key={idx} style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        whiteSpace: 'nowrap',
        gap: '8px'
      }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          whiteSpace: 'nowrap',
          gap: '8px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '5px 12px',
          borderRadius: '8px',
          fontSize: '0.82rem',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
        }}>
          <span style={{ fontWeight: 800, color: '#0f172a' }}>
            {displayField}:
          </span>

          {formattedAntes && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              background: '#fee2e2',
              color: '#991b1b',
              border: '1px solid #fecaca',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: 700,
              fontSize: '0.78rem',
              whiteSpace: 'nowrap'
            }}>
              <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', opacity: 0.85, fontWeight: 800 }}>Antes:</span>
              <span>{formattedAntes}</span>
            </span>
          )}

          {formattedAntes && formattedNovo && (
            <ArrowRight size={13} style={{ color: '#013375', flexShrink: 0, margin: '0 2px' }} />
          )}

          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            background: '#dbeafe',
            color: '#1e40af',
            border: '1px solid #bfdbfe',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: 800,
            fontSize: '0.78rem',
            whiteSpace: 'nowrap'
          }}>
            {formattedAntes && (
              <span style={{ fontSize: '0.66rem', textTransform: 'uppercase', opacity: 0.85, fontWeight: 800 }}>Atualizado:</span>
            )}
            <span>{formattedNovo}</span>
          </span>
        </div>

        {extractedMotivo && (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#fffbeb',
            color: '#92400e',
            border: '1px solid #fde68a',
            padding: '4px 10px',
            borderRadius: '8px',
            fontSize: '0.8rem',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}>
            <Info size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span style={{ fontWeight: 800 }}>Motivo:</span>
            <span>{extractedMotivo}</span>
          </div>
        )}
      </div>
    );
  };

  const formatLogDetails = (log: any) => {
    let detalhes: string = log.detalhes || '';
    if (!detalhes) return <span style={{ color: '#94a3b8' }}>Sem detalhes</span>;

    // Clean ADMIN_GERAL from text
    detalhes = detalhes.replace(/ADMIN_GERAL\s*\(([^)]+)\)/g, '$1');
    detalhes = detalhes.replace(/ADMIN_GERAL\s*/g, 'Registro Regional ');
    detalhes = detalhes.replace(/editou usuário/g, 'editou o usuário');

    // Handle legacy logs "Editou usuario ID 40"
    if (detalhes.startsWith('Editou usuario ID') || detalhes.startsWith('Editou usuário ID')) {
      const targetName = editingProfile?.nome ? `${editingProfile.nome} (#${editingProfile.id})` : `ID #${log.usuario_id}`;
      const autor = log.autor_nome || (log.autor_role && log.autor_role !== 'ADMIN_GERAL' ? getRoleLabel(log.autor_role) : 'Registro Regional');
      const pMatch = historicoCompleto?.historico_perfil?.[0];
      const prevRole = pMatch ? getRoleLabel(pMatch.perfil_anterior) : 'Missionário';
      const newRole = pMatch ? getRoleLabel(pMatch.perfil_novo) : getRoleLabel(editingProfile?.role || '');

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ color: '#013375', fontWeight: 700, fontSize: '0.88rem' }}>
            {autor} editou o usuário <span style={{ color: '#0f172a' }}>{targetName}</span>:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {renderChangeItem(`Perfil: Antes (${prevRole}) ➔ Atualizado (${newRole})`, 0)}
            {editingProfile?.status && renderChangeItem(`Status: Antes (Ativo) ➔ Atualizado (${editingProfile.status})`, 1)}
          </div>
        </div>
      );
    }

    // If it has standard colon ": " with items
    if (detalhes.includes(': ')) {
      const colonIdx = detalhes.indexOf(': ');
      const prefix = detalhes.substring(0, colonIdx).trim();
      const diffContent = detalhes.substring(colonIdx + 2).trim();
      const items = diffContent.split(' | ');

      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontWeight: 700, color: '#013375', fontSize: '0.88rem' }}>
            {prefix}:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {items.map((item, i) => renderChangeItem(item, i))}
          </div>
        </div>
      );
    }

    return <span style={{ color: '#0f172a', fontWeight: 500 }}>{detalhes}</span>;
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
    setInitialRole(profile.role);
    setRoleChangeReason('');
    setActiveModalTab('dados');

    // Load user history & logs
    fetchUserHistory(profile.id);

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
    setInitialRole(null);
    setRoleChangeReason('');
    setActiveModalTab('dados');
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

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProfile) return;

    // If role changed on an existing profile, request confirmation
    if (editingProfile.id !== 0 && initialRole && editingProfile.role !== initialRole) {
      setConfirmRoleModalOpen(true);
      return;
    }

    executeSaveProfile();
  };

  const executeSaveProfile = async (motivo?: string) => {
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

      const payload = {
        ...editingProfile,
        motivo_perfil: motivo || roleChangeReason || undefined
      };

      if (editingProfile.id === 0) {
        const response = await api.post('/usuarios', payload);
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
        await api.put(`/usuarios/${editingProfile.id}`, payload);
      }
      await fetchProfiles();
      setConfirmRoleModalOpen(false);
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
                      <button className="btn-icon-view" onClick={() => handleOpenEdit(profile)} title="Ver e Editar"><Eye size={18} /></button>
                      {canEdit && (
                        <button className="btn-icon-delete" type="button" onClick={() => handleDeleteProfile(profile)} title="Excluir"><Trash2 size={18} /></button>
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

      {/* MODAL PRINCIPAL */}
      {isModalOpen && editingProfile && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '1020px', width: '96%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, borderRadius: '20px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '20px 30px', borderBottom: '1px solid #f1f5f9', background: 'linear-gradient(to right, #f8fafc, #ffffff)', borderTopLeftRadius: '20px', borderTopRightRadius: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ background: '#013375', color: 'white', padding: '8px', borderRadius: '10px' }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.3rem', color: '#0f172a', fontWeight: 800, margin: 0 }}>
                    {editingProfile.id === 0 ? 'Novo Registro de Acesso' : `${editingProfile.nome || 'Usuário'} — #${editingProfile.id}`}
                  </h3>
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Perfil Atual: <strong style={{ color: '#013375' }}>{getRoleLabel(editingProfile.role)}</strong>
                  </span>
                </div>
              </div>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} style={{ background: '#f1f5f9', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
            </div>

            {/* MODAL TABS */}
            {editingProfile.id !== 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', padding: '0 16px', overflowX: 'auto' }}>
                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: activeModalTab === 'dados' ? '#013375' : '#64748b',
                    borderBottom: activeModalTab === 'dados' ? '3px solid #013375' : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setActiveModalTab('dados')}
                >
                  <ShieldCheck size={16} /> Dados & Permissões
                </button>
                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: activeModalTab === 'historico' ? '#013375' : '#64748b',
                    borderBottom: activeModalTab === 'historico' ? '3px solid #013375' : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setActiveModalTab('historico')}
                >
                  <History size={16} /> Histórico de Perfil & Cadastro
                  {historicoCompleto.historico_perfil?.length > 0 && (
                    <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem' }}>
                      {historicoCompleto.historico_perfil.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  style={{
                    padding: '12px 16px',
                    border: 'none',
                    background: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: activeModalTab === 'atividades' ? '#013375' : '#64748b',
                    borderBottom: activeModalTab === 'atividades' ? '3px solid #013375' : '3px solid transparent',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => setActiveModalTab('atividades')}
                >
                  <Activity size={16} /> Atividades no Sistema
                  {historicoCompleto.logs?.length > 0 && (
                    <span style={{ background: '#dcfce7', color: '#166534', padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem' }}>
                      {historicoCompleto.logs.length}
                    </span>
                  )}
                </button>
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', margin: 0 }}>
              
              {/* ABA 1: DADOS & PERMISSÕES */}
              {activeModalTab === 'dados' && (
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', overflowY: 'auto', flex: 1 }}>

                  {/* COLUNA ESQUERDA: DADOS BÁSICOS */}
                  <div className="form-column">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ marginBottom: '5px' }}>
                        <h4 style={{ fontSize: '0.9rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '15px', borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
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
                          style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
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
                          style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                          placeholder="email@exemplo.com"
                        />
                      </div>

                      <div className="form-group">
                        <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.9rem' }}>
                          {editingProfile.id === 0 ? t('missionaries.wizard.access.password') : 'Redefinir Senha'}
                        </label>
                        <div className="password-group" style={{ display: 'flex', gap: '10px' }}>
                          <div style={{ position: 'relative', flex: 1 }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={editingProfile.password || ''}
                              onChange={e => setEditingProfile({ ...editingProfile, password: e.target.value })}
                              required={editingProfile.id === 0}
                              style={{ padding: '12px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', width: '100%', fontSize: '0.95rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                              placeholder="••••••••"
                            />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                          <button type="button" onClick={generateRandomPassword} style={{ background: '#f1f5f9', color: '#013375', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0 16px', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                            Gerar
                          </button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '15px', background: '#f8fafc', padding: '16px', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'block', fontSize: '0.85rem' }}>Perfil de Acesso</label>
                          <select value={editingProfile.role} onChange={e => setEditingProfile({ ...editingProfile, role: e.target.value as UserRole })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', cursor: 'pointer', background: 'white' }}>
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
                          <select value={editingProfile.status} onChange={e => setEditingProfile({ ...editingProfile, status: e.target.value as 'ATIVO' | 'INATIVO' })} style={{ padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.9rem', cursor: 'pointer', background: 'white' }}>
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
                      <div style={{ marginBottom: '15px' }}>
                        <h4 style={{ fontSize: '0.9rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, marginBottom: '8px', borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
                          Permissões de Visualização
                        </h4>
                        <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0, paddingLeft: '16px' }}>Defina o que este usuário poderá visualizar nos perfis.</p>
                      </div>

                      <div style={{
                        background: '#ffffff',
                        padding: '10px',
                        borderRadius: '16px',
                        border: '1px solid #e2e8f0',
                        flex: 1,
                        maxHeight: '400px',
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
                              gap: '12px',
                              fontSize: '0.88rem',
                              cursor: 'pointer',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              background: isChecked ? 'linear-gradient(to right, #eff6ff, #ffffff)' : 'transparent',
                              border: `1px solid ${isChecked ? '#bfdbfe' : 'transparent'}`,
                              transition: 'all 0.2s',
                              position: 'relative'
                            }}>
                              <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '5px',
                                border: `2px solid ${isChecked ? '#013375' : '#cbd5e1'}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: isChecked ? '#013375' : 'white',
                                transition: 'all 0.2s'
                              }}>
                                {isChecked && <ShieldCheck size={13} color="white" />}
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
                    <div className="casa-wizard-add" style={{ gridColumn: '1 / -1', marginTop: '10px', padding: '18px', border: '1px solid #e2e8f0', borderRadius: '14px', background: '#f8fafc' }}>
                      <div style={{ marginBottom: '14px' }}>
                        <h4 style={{ fontSize: '0.88rem', color: '#013375', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 800, margin: 0, borderLeft: '4px solid #013375', paddingLeft: '12px' }}>
                          Presença Missionária (Opcional)
                        </h4>
                      </div>
                      <div className="casa-wizard-add-fields" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1.2fr 1.2fr', gap: '12px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.8rem' }}>Tipo</label>
                          <select value={novaCasa.tipo} onChange={e => setNovaCasa(p => ({ ...p, tipo: e.target.value }))} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.88rem', background: 'white' }}>
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
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.8rem' }}>Comunidade Religiosa</label>
                          <select value={novaCasa.casa_id} onChange={e => setNovaCasa(p => ({ ...p, casa_id: e.target.value }))} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.88rem', background: 'white' }}>
                            <option value="">Selecione...</option>
                            {casasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </select>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.8rem' }}>PM</label>
                          <input type="text" value={novaCasa.pm} onChange={e => setNovaCasa(p => ({ ...p, pm: e.target.value }))} placeholder="Ex: CR 13" style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.88rem' }} />
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.8rem' }}>País</label>
                          <input type="text" list="paises-list-admin" value={novaCasa.pais} onChange={e => setNovaCasa(p => ({ ...p, pais: e.target.value }))} placeholder="Selecione ou digite..." style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.88rem' }} />
                          <datalist id="paises-list-admin">
                            {PAISES_COMMON.map(p => <option key={p} value={p} />)}
                          </datalist>
                        </div>
                        <div className="form-group" style={{ margin: 0 }}>
                          <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.8rem' }}>Data de Início</label>
                          <input type="date" value={novaCasa.data_inicio} onChange={e => setNovaCasa(p => ({ ...p, data_inicio: e.target.value }))} style={{ padding: '9px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', fontSize: '0.88rem' }} />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1', display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '6px' }}>
                          {[
                            { key: 'Superior Local', label: 'Superior Local', isSuperior: true },
                            { key: 'Ecônomo Local', label: 'Ecônomo Local' },
                            { key: 'Pároco', label: 'Pároco' },
                            { key: 'Diretor', label: 'Diretor' },
                            { key: 'Vigário', label: 'Vigário' },
                            { key: 'Reitor', label: 'Reitor' },
                          ].map(r => (
                            <label key={r.key} className="checkbox-label" style={{ marginTop: '0', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer', whiteSpace: 'nowrap' }}>
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
                      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
                        <button type="button" className="btn-add-casa-wz" onClick={addCasaVinculo} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#013375', color: 'white', border: 'none', padding: '7px 15px', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.85rem' }}>
                          <Plus size={15} /> Vincular Presença
                        </button>
                      </div>

                      {casasVinculos.length === 0 ? (
                        <div className="casa-empty" style={{ textAlign: 'center', padding: '12px', color: '#94a3b8', fontSize: '0.85rem' }}>Nenhuma presença vinculada ainda.</div>
                      ) : (
                        <div className="casas-wz-list" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {casasVinculos.map((v, i) => (
                            <div key={i} className="casa-wz-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'white', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                              <div className="casa-wz-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <HomeIcon size={16} className="casa-icon" style={{ color: '#013375' }} />
                                <div>
                                  <span className="casa-wz-nome" style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b' }}>{casaNome(v.casa_id)}</span>
                                  <div className="casa-wz-meta" style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                                <Trash2 size={15} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: HISTÓRICO DE PERFIL & CADASTRO */}
              {activeModalTab === 'historico' && (
                <div style={{ padding: '25px 30px', overflowY: 'auto', flex: 1 }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 10px' }} />
                      <p>Carregando histórico do usuário...</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                      
                      {/* Card de Informações de Cadastro */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '18px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div style={{ background: '#013375', color: 'white', padding: '10px', borderRadius: '10px' }}>
                            <Calendar size={22} />
                          </div>
                          <div>
                            <span style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700 }}>Data de Cadastro / Criação</span>
                            <h4 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', color: '#0f172a', fontWeight: 800 }}>
                              {formatDateTimeLocal(historicoCompleto.usuario?.created_at)}
                            </h4>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Perfil Atual:</span>
                            <span className={`role-tag ${(editingProfile.role || '').toLowerCase()}`} style={{ fontSize: '0.85rem' }}>
                              {getRoleLabel(editingProfile.role)}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Status:</span>
                            <span className={`status-tag ${(editingProfile.status || '').toLowerCase()}`} style={{ fontSize: '0.85rem' }}>
                              {editingProfile.status}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Histórico de Alterações de Perfil */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <History size={18} style={{ color: '#013375' }} />
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                            Histórico de Alterações de Perfil / Cargo
                          </h4>
                        </div>
                        
                        {historicoCompleto.historico_perfil && historicoCompleto.historico_perfil.length > 0 ? (
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Data e Hora</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Mudança de Perfil</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Alterado Por</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Observação / Motivo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historicoCompleto.historico_perfil.map((item: any, idx: number) => (
                                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfcfd' }}>
                                    <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      <Clock size={13} style={{ display: 'inline', marginRight: '5px', color: '#64748b' }} />
                                      {formatDateTimeLocal(item.created_at)}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.8rem', fontWeight: 600 }}>
                                          {getRoleLabel(item.perfil_anterior)}
                                        </span>
                                        <ArrowRight size={14} style={{ color: '#94a3b8' }} />
                                        <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#3730a3', fontSize: '0.8rem', fontWeight: 700 }}>
                                          {getRoleLabel(item.perfil_novo)}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 600 }}>
                                      {(item.alterado_por_nome || '').replace(/ADMIN_GERAL\s*\(([^)]+)\)/g, '$1').replace(/ADMIN_GERAL/g, 'Registro Regional') || 'Registro Regional'}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: item.motivo ? '#334155' : '#94a3b8', fontStyle: item.motivo ? 'normal' : 'italic' }}>
                                      {item.motivo || 'Sem observação'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <div style={{ padding: '25px', textAlign: 'center', background: '#f8fafc', borderRadius: '10px', color: '#64748b', fontSize: '0.88rem' }}>
                            Nenhuma alteração de perfil registrada após o cadastro.
                          </div>
                        )}
                      </div>

                      {/* Tabela de Histórico de Situações (se houver) */}
                      {historicoCompleto.historico_situacao && historicoCompleto.historico_situacao.length > 0 && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                            <Star size={18} style={{ color: '#013375' }} />
                            <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                              Histórico de Alterações de Situação
                            </h4>
                          </div>
                          <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                              <thead>
                                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Data e Hora</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Mudança de Situação</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Alterado Por</th>
                                  <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>Observação / Motivo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {historicoCompleto.historico_situacao.map((item: any, idx: number) => (
                                  <tr key={item.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfcfd' }}>
                                    <td style={{ padding: '12px 14px', color: '#334155', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                      <Clock size={13} style={{ display: 'inline', marginRight: '5px', color: '#64748b' }} />
                                      {formatDateTimeLocal(item.created_at)}
                                    </td>
                                    <td style={{ padding: '12px 14px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                        <span className={`situacao-tag ${(item.situacao_anterior || '').toLowerCase()}`}>
                                          {getSituacaoLabel(item.situacao_anterior)}
                                        </span>
                                        <ArrowRight size={14} style={{ color: '#94a3b8' }} />
                                        <span className={`situacao-tag ${(item.situacao_nova || '').toLowerCase()}`}>
                                          {getSituacaoLabel(item.situacao_nova)}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ padding: '12px 14px', color: '#0f172a', fontWeight: 600 }}>
                                      {(item.alterado_por_nome || '').replace(/ADMIN_GERAL\s*\(([^)]+)\)/g, '$1').replace(/ADMIN_GERAL/g, 'Registro Regional') || 'Registro Regional'}
                                    </td>
                                    <td style={{ padding: '12px 14px', color: item.motivo ? '#334155' : '#94a3b8', fontStyle: item.motivo ? 'normal' : 'italic' }}>
                                      {item.motivo || 'Sem observação'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: ATIVIDADES NO SISTEMA (LOGS) */}
              {activeModalTab === 'atividades' && (
                <div style={{ padding: '25px 30px', overflowY: 'auto', flex: 1 }}>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <Loader2 className="animate-spin" size={32} style={{ margin: '0 auto 10px' }} />
                      <p>Carregando atividades do usuário...</p>
                    </div>
                  ) : historicoCompleto.logs && historicoCompleto.logs.length > 0 ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Activity size={18} style={{ color: '#013375' }} />
                          <h4 style={{ margin: 0, fontSize: '1rem', color: '#0f172a', fontWeight: 800 }}>
                            Histórico de Atividades e Alterações no Sistema
                          </h4>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          Exibindo as últimas <strong>{historicoCompleto.logs.length}</strong> ações
                        </span>
                      </div>

                      <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '850px' }}>
                          <thead>
                            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                              <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700, width: '140px', whiteSpace: 'nowrap' }}>Data / Hora</th>
                              <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700, width: '140px', whiteSpace: 'nowrap' }}>Ação</th>
                              <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700, minWidth: '450px' }}>Detalhes da Ação</th>
                              <th style={{ padding: '10px 14px', color: '#475569', fontWeight: 700, width: '120px', whiteSpace: 'nowrap' }}>Entidade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historicoCompleto.logs.map((log: any, idx: number) => (
                              <tr key={log.id || idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fcfcfd' }}>
                                <td style={{ padding: '12px 14px', color: '#475569', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  <Clock size={12} style={{ display: 'inline', marginRight: '5px', color: '#94a3b8' }} />
                                  {formatDateTimeLocal(log.created_at)}
                                </td>
                                <td style={{ padding: '12px 14px' }}>
                                  <span style={{
                                    padding: '3px 8px',
                                    borderRadius: '6px',
                                    fontSize: '0.78rem',
                                    fontWeight: 700,
                                    background: log.acao?.includes('CRIO') || log.acao?.includes('ADICIONOU') ? '#dcfce7' :
                                      log.acao?.includes('EDIT') || log.acao?.includes('ALTER') || log.acao?.includes('ATUALIZ') ? '#eff6ff' :
                                        log.acao?.includes('EXCLUI') || log.acao?.includes('REMOVE') || log.acao?.includes('DELET') ? '#fee2e2' : '#f1f5f9',
                                    color: log.acao?.includes('CRIO') || log.acao?.includes('ADICIONOU') ? '#166534' :
                                      log.acao?.includes('EDIT') || log.acao?.includes('ALTER') || log.acao?.includes('ATUALIZ') ? '#1e40af' :
                                        log.acao?.includes('EXCLUI') || log.acao?.includes('REMOVE') || log.acao?.includes('DELET') ? '#991b1b' : '#475569'
                                  }}>
                                    {log.acao}
                                  </span>
                                </td>
                                <td style={{ padding: '12px 14px', color: '#0f172a' }}>
                                  {formatLogDetails(log)}
                                </td>
                                <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {log.entidade || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: '35px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', color: '#64748b' }}>
                      <Activity size={32} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
                      <p style={{ margin: 0, fontWeight: 600 }}>Nenhuma atividade registrada para este usuário.</p>
                    </div>
                  )}
                </div>
              )}

              {/* MODAL FOOTER */}
              <div className="modal-footer" style={{ padding: '20px 30px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', borderBottomLeftRadius: '20px', borderBottomRightRadius: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                  {editingProfile.id !== 0 && initialRole && editingProfile.role !== initialRole && (
                    <span style={{ color: '#d97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <AlertTriangle size={15} /> Troca de perfil pendente de confirmação
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)} style={{ borderRadius: '10px', padding: '10px 20px', fontWeight: 700, fontSize: '0.88rem', border: '1px solid #e2e8f0' }}>
                    {t('common.cancel')}
                  </button>
                  <button type="submit" className="btn-save" disabled={saveLoading} style={{ borderRadius: '10px', padding: '10px 28px', fontWeight: 800, fontSize: '0.88rem', background: '#013375', color: 'white', boxShadow: '0 4px 6px -1px rgba(1, 51, 117, 0.3)' }}>
                    {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {editingProfile.id === 0 ? 'Criar Acesso' : 'Salvar Alterações'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE TROCA DE PERFIL COM AVISO */}
      {confirmRoleModalOpen && editingProfile && initialRole && (
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '90%', borderRadius: '18px', padding: '25px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#fef3c7', color: '#d97706', padding: '10px', borderRadius: '12px' }}>
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
                  Confirmar Troca de Perfil de Acesso
                </h3>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Usuário: <strong>{editingProfile.nome}</strong>
                </span>
              </div>
            </div>

            {/* Aviso de Auditoria */}
            <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '10px', padding: '12px 16px', marginBottom: '18px', fontSize: '0.85rem', color: '#92400e', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Aviso de Registro Permanente:</strong> Esta alteração será gravada permanentemente no histórico com a data, hora exata e o nome do seu usuário autenticado.
              </div>
            </div>

            {/* Resumo da Mudança */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <span style={{ padding: '5px 10px', borderRadius: '6px', background: '#e2e8f0', color: '#334155', fontWeight: 700, fontSize: '0.85rem' }}>
                {getRoleLabel(initialRole)}
              </span>
              <ArrowRight size={18} style={{ color: '#013375' }} />
              <span style={{ padding: '5px 10px', borderRadius: '6px', background: '#013375', color: 'white', fontWeight: 700, fontSize: '0.85rem' }}>
                {getRoleLabel(editingProfile.role)}
              </span>
            </div>

            {/* Campo Opcional de Motivo */}
            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block', fontSize: '0.85rem' }}>
                Motivo / Justificativa da Mudança (opcional)
              </label>
              <textarea
                rows={3}
                placeholder="Ex: Nomeado para nova função pela direção regional..."
                value={roleChangeReason}
                onChange={e => setRoleChangeReason(e.target.value)}
                style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.88rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setConfirmRoleModalOpen(false)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #e2e8f0', fontWeight: 600, fontSize: '0.88rem' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-save"
                onClick={() => executeSaveProfile(roleChangeReason)}
                disabled={saveLoading}
                style={{ padding: '10px 22px', borderRadius: '8px', background: '#013375', color: 'white', fontWeight: 800, fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {saveLoading ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                Confirmar e Gravar Mudança
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Administradores;
