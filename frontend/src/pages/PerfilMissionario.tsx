import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User, MapPin, BookOpen, Home as HomeIcon, Loader2, AlertCircle,
  Save, Trash2, Plus, Star, FileText, Download, ShieldCheck, Eye,
  Activity, ChevronLeft, DollarSign, GraduationCap, Upload, Lock,
  CheckCircle, Printer, ChevronDown, ChevronRight, Edit
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api, { getFileUrl } from '../api';
import '../styles/PerfilMissionario.css';

// ─── Types ────────────────────────────────────────────────────────────────────

// ─── Types ────────────────────────────────────────────────────────────────────

interface Missionario {
  id: number;
  nome: string;
  login: string;
  role?: string;
  status?: string;
  situacao: string;
  is_oconomo: boolean;
  is_superior: boolean;
  proximos_passos: string;
  permissoes?: Record<string, boolean>;
  created_at?: string;
}

export interface HistoricoSituacaoItem {
  id: number;
  situacao_anterior: string;
  situacao_nova: string;
  motivo?: string;
  alterado_por_id?: number;
  alterado_por_nome?: string;
  created_at: string;
}

export interface HistoricoPerfilItem {
  id: number;
  perfil_anterior: string;
  perfil_novo: string;
  motivo?: string;
  alterado_por_id?: number;
  alterado_por_nome?: string;
  created_at: string;
}

interface ItineraryStage {
  etapa: string;
  local: string;
  periodo: string;
  is_sub_etapa: boolean;
  doc_path?: string;
  observacoes?: string;
}

interface CivilData {
  data_nascimento: string;
  filiacao: string;
  nome_pai?: string;
  nome_mae?: string;
  cidade_estado: string;
  diocese: string;
  pais: string;
  naturalidade: string;
  rnm: string;
  cpf: string;
  titulo_eleitor: string;
  cnh: string;
  passaporte: string;
}

interface EnderecoData {
  logradouro: string;
  complemento: string;
  bairro: string;
  cep: string;
  cidade_estado: string;
  celular_whatsapp: string;
  telefone_fixo: string;
  email_pessoal: string;
}

interface ReligiososData {
  primeiros_votos_data: string;
  votos_perpetuos_data: string;
  lugar_profissao: string;
  diaconato_data: string;
  presbiterato_data: string;
  bispo_ordenante: string;
  data_batismo: string;
  data_primeira_comunhao: string;
  data_crisma: string;
  doc_batismo: string;
  doc_primeira_comunhao: string;
  doc_crisma: string;
}

interface SituacaoData {
  data_falecimento: string;
  cidade_falecimento: string;
  certidao_obito_path: string;
  local_sepultamento: string;
  egresso_incardinado_path: string;
  egresso_desistencia_path: string;
  egresso_laicizado_path: string;
  egresso_transf_sacerdotes_path: string;
  egresso_transf_para_regiao_path: string;
  egresso_transf_da_regiao_path: string;
  exclaustrado_data: string;
  exclaustrado_processo: string;
  exclaustrado_doc_path?: string;
}

const PAISES_COMMON = [
  'Afeganistão', 'África do Sul', 'Albânia', 'Alemanha', 'Andorra', 'Angola', 'Antígua e Barbuda', 'Arábia Saudita', 'Argélia', 'Argentina', 'Armênia', 'Austrália', 'Áustria', 'Azerbaijão',
  'Bahamas', 'Bangladesh', 'Barbados', 'Bahrein', 'Bélgica', 'Belize', 'Benim', 'Bielorrússia', 'Bolívia', 'Bósnia e Herzegovina', 'Botsuana', 'Brasil', 'Brunei', 'Bulgária', 'Burquina Faso', 'Burundi',
  'Butão', 'Cabo Verde', 'Camarões', 'Camboja', 'Canadá', 'Catar', 'Cazaquistão', 'Chade', 'Chile', 'China', 'Chipre', 'Colômbia', 'Comores', 'Congo-Brazzaville', 'Coreia do Norte', 'Coreia do Sul',
  'Costa do Marfim', 'Costa Rica', 'Croácia', 'Cuba', 'Dinamarca', 'Djibuti', 'Dominica', 'Egito', 'El Salvador', 'Emirados Árabes Unidos', 'Equador', 'Eritreia', 'Eslováquia', 'Eslovênia', 'Espanha',
  'Estados Unidos', 'Estônia', 'Etiópia', 'Fiji', 'Filipinas', 'Finlândia', 'França', 'Gabão', 'Gâmbia', 'Gana', 'Geórgia', 'Granada', 'Grécia', 'Guatemala', 'Guiana', 'Guiné', 'Guiné Equatorial',
  'Guiné-Bissau', 'Haiti', 'Honduras', 'Hungria', 'Iêmen', 'Ilhas Marechal', 'Ilhas Salomão', 'Índia', 'Indonésia', 'Irã', 'Iraque', 'Irlanda', 'Islândia', 'Israel', 'Itália', 'Jamaica', 'Japão',
  'Jordânia', 'Kiribati', 'Kuwait', 'Laos', 'Lesoto', 'Letônia', 'Líbano', 'Libéria', 'Líbia', 'Listenstaine', 'Lituânia', 'Luxemburgo', 'Macedônia do Norte', 'Madagascar', 'Malásia', 'Malaui',
  'Maldivas', 'Mali', 'Malta', 'Marrocos', 'Maurícia', 'Mauritânia', 'México', 'Mianmar', 'Micronésia', 'Moçambique', 'Moldávia', 'Mônaco', 'Mongólia', 'Montenegro', 'Namíbia', 'Nauru', 'Nepal',
  'Nicarágua', 'Níger', 'Nigéria', 'Noruega', 'Nova Zelândia', 'Omã', 'Países Baixos', 'Palau', 'Panamá', 'Papua-Nova Guiné', 'Paquistão', 'Paraguai', 'Peru', 'Polônia', 'Portugal', 'Quênia',
  'Quirguistão', 'Reino Unido', 'República Centro-Africana', 'República Checa', 'República Democrática do Congo', 'República Dominicana', 'Romênia', 'Ruanda', 'Rússia', 'Samoa', 'Santa Lúcia',
  'São Cristóvão e Neves', 'São Marinho', 'São Tomé e Príncipe', 'São Vicente e Granadinas', 'Seicheles', 'Senegal', 'Serra Leoa', 'Sérvia', 'Singapura', 'Síria', 'Somália', 'Sri Lanka', 'Suazilândia',
  'Sudão', 'Sudão do Sul', 'Suécia', 'Suíça', 'Suriname', 'Tailândia', 'Taiwan', 'Tajiquistão', 'Tanzânia', 'Timor-Leste', 'Togo', 'Tonga', 'Trindade e Tobago', 'Tunísia', 'Turquemenistão', 'Turquia',
  'Tuvalu', 'Ucrânia', 'Uganda', 'Uruguai', 'Usbequistão', 'Vanuatu', 'Vaticano', 'Venezuela', 'Vietname', 'Zâmbia', 'Zimbábue'
];

interface Documento {
  id: number;
  descricao: string;
  url: string;
  data_upload: string;
  tipo_arquivo?: string;
  arquivo_nome?: string;
}

interface FormacaoAcademica {
  id: number;
  curso: string;
  faculdade: string;
  periodo: string;
  observacoes?: string;
  doc_path?: string;
}

interface AtividadeMissionaria {
  id: number;
  lugar: string;
  periodo: string;
  missao?: string;
  funcao_atividade?: string;
}

interface ObraRealizada {
  id: number;
  lugar: string;
  periodo: string;
  obra?: string;
}

interface SaudeRecord {
  id: number;
  seguradora?: string;
  sus_card?: string;
  numero_carteira?: string;
  doc_path?: string;
}

interface ContaBancaria {
  id: number;
  tipo_conta: string;
  titularidade: string;
  agencia: string;
  numero: string;
}

interface Contato {
  parentesco: string;
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
}

interface ObservacaoGeral {
  id: number;
  created_at: string;
  texto: string;
}

interface CasaHistorico {
  id: number;
  casa_id: number;
  casa_nome: string;
  data_inicio: string;
  data_fim: string | null;
  funcao: string[];
  is_superior: boolean;
}

interface Casa { id: number; nome: string; }

interface QuadroPessoal {
  id?: number;
  usuario_id?: number;
  funcao_atual?: string;
  competencias?: string;
  cv_path?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
  return d ? d.toLocaleDateString('pt-BR') : '?';
}

function calcDuracao(dataInicio: string, dataFim?: string | null): string {
  if (!dataInicio) return '';
  const ini = parseDateLocal(dataInicio);
  if (!ini) return '';
  const fim = dataFim ? (parseDateLocal(dataFim) || new Date()) : new Date();
  let anos = fim.getFullYear() - ini.getFullYear();
  let meses = fim.getMonth() - ini.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  const parts = [];
  if (anos > 0) parts.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (meses > 0) parts.push(`${meses} ${meses > 1 ? 'meses' : 'mês'}`);
  return parts.length ? parts.join(' e ') : 'menos de 1 mês';
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
  { id: 'obras_realizadas', label: '10. Obras Realizadas (Visualização)' },
  { id: 'observacoes', label: '11. Observações (Visualização)' },
  { id: 'quadro_pessoal', label: '12. Curriculum Vitae (Visualização)' },
];

const normalizeSituacao = (sit?: string): string => {
  if (!sit) return 'Ativo';
  const clean = sit.trim().toUpperCase();
  if (clean === 'EGRESSO') return 'Egresso';
  if (clean === 'FALECIDO') return 'Falecido';
  if (clean === 'EXCLAUSTRADO') return 'Exclaustrado';
  return 'Ativo';
};

const parseFuncoesAtividade = (str?: string | null): string[] => {
  if (!str) return [];
  const normalized = str.trim();
  if (!normalized) return [];

  const parts: string[] = [];
  let current = '';
  let inParen = 0;

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (char === '(') inParen++;
    else if (char === ')') inParen = Math.max(0, inParen - 1);

    if (char === ',' && inParen === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());

  // Re-stitch any broken fragments if old data was split with simple comma
  const result: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (p.startsWith('Diretor (rádios') || p.startsWith('Diretor (radios') || p.startsWith('Diretor (')) {
      let combined = p;
      while (i + 1 < parts.length && !combined.includes(')')) {
        i++;
        combined += ', ' + parts[i];
      }
      result.push(combined);
    } else if (p === 'escolas' || p === 'fundações' || p === 'fundacoes' || p === 'escritórios)' || p === 'escritorios)') {
      // Ignore orphaned fragment from previous naive comma split
      continue;
    } else {
      result.push(p);
    }
  }

  return result;
};

const extractSortDate = (periodoStr?: string | null): number => {
  if (!periodoStr) return 0;
  const str = periodoStr.trim();

  // 1. Match DD/MM/YYYY
  const brDate = str.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brDate) {
    const day = parseInt(brDate[1], 10);
    const month = parseInt(brDate[2], 10);
    const year = parseInt(brDate[3], 10);
    return new Date(year, month - 1, day).getTime();
  }

  // 2. Match YYYY-MM-DD
  const isoDate = str.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoDate) {
    const year = parseInt(isoDate[1], 10);
    const month = parseInt(isoDate[2], 10);
    const day = parseInt(isoDate[3], 10);
    return new Date(year, month - 1, day).getTime();
  }

  // 3. Match 4-digit year (1900-2099)
  const yearMatch = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return new Date(parseInt(yearMatch[1], 10), 0, 1).getTime();
  }

  const anyYear = str.match(/\d{4}/);
  if (anyYear) {
    return new Date(parseInt(anyYear[0], 10), 0, 1).getTime();
  }

  return 0;
};

const PerfilMissionario: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit, user: authUser, isAdminGeral, isOconomo, isSuperior, isRegional } = useAuth();
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('dados');

  const [missionario, setMissionario] = useState<Missionario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [civilData, setCivilData] = useState<CivilData>({ data_nascimento: '', filiacao: '', nome_pai: '', nome_mae: '', cidade_estado: '', diocese: '', pais: '', naturalidade: '', rnm: '', cpf: '', titulo_eleitor: '', cnh: '', passaporte: '' });
  const [enderecoData, setEnderecoData] = useState<EnderecoData>({ logradouro: '', complemento: '', bairro: '', cep: '', cidade_estado: '', celular_whatsapp: '', telefone_fixo: '', email_pessoal: '' });
  const [religiososData, setReligiososData] = useState<ReligiososData>({ primeiros_votos_data: '', votos_perpetuos_data: '', lugar_profissao: '', diaconato_data: '', presbiterato_data: '', bispo_ordenante: '', data_batismo: '', data_primeira_comunhao: '', data_crisma: '', doc_batismo: '', doc_primeira_comunhao: '', doc_crisma: '' });
  const [casasHistorico, setCasasHistorico] = useState<CasaHistorico[]>([]);
  const [casasDisponiveis, setCasasDisponiveis] = useState<Casa[]>([]);
  const [novaVinculacao, setNovaVinculacao] = useState({ casa_id: '', data_inicio: '', data_fim: '', funcao: [] as string[], is_superior: false });
  const [isSaving, setIsSaving] = useState(false);
  // const [cepLoading, setCepLoading] = useState(false);
  const [nacionalidades, setNacionalidades] = useState<string[]>([]);

  // Documents state
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [pendingDocDesc, setPendingDocDesc] = useState('');
  const [pendingReligiousDocDesc, setPendingReligiousDocDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const religiousFileInputRef = useRef<HTMLInputElement>(null);

  // Itinerary state
  const [itinerarioStages, setItinerarioStages] = useState<ItineraryStage[]>([]);
  const [isSavingItinerary, setIsSavingItinerary] = useState(false);
  // const [_itinDocUploading, setItinDocUploading] = useState<number | null>(null);
  const itinFileInputRef = useRef<HTMLInputElement>(null);
  const activeEtapaRef = useRef<string | null>(null);
  // New Sections State
  const [formacaoAcademica, setFormacaoAcademica] = useState<FormacaoAcademica[]>([]);
  const [atividadesMissionarias, setAtividadesMissionarias] = useState<AtividadeMissionaria[]>([]);
  const [obrasRealizadas, setObrasRealizadas] = useState<ObraRealizada[]>([]);
  const [saudeRecords, setSaudeRecords] = useState<SaudeRecord[]>([]);
  const [contasBancarias, setContasBancarias] = useState<ContaBancaria[]>([]);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [observacoesGerais, setObservacoesGerais] = useState<ObservacaoGeral[]>([]);
  const [quadroPessoal, setQuadroPessoal] = useState<QuadroPessoal | null>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);
  const [cvUploadLoading, setCvUploadLoading] = useState(false);

  const handleCvUploadDirect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('arquivo', file);

    setCvUploadLoading(true);
    try {
      const res = await api.post(`/upload-anexo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const filePath = res.data.arquivo_path || res.data.url;

      await api.post(`/usuarios/${id}/quadro-pessoal`, {
        funcao_atual: quadroPessoal?.funcao_atual || '',
        competencias: quadroPessoal?.competencias || '',
        cv_path: filePath
      });

      setQuadroPessoal({
        id: quadroPessoal?.id || 0,
        usuario_id: Number(id),
        funcao_atual: quadroPessoal?.funcao_atual || '',
        competencias: quadroPessoal?.competencias || '',
        cv_path: filePath
      });

      alert('Curriculum Vitae anexado com sucesso!');
    } catch (err) {
      console.error('Erro ao anexar CV:', err);
      alert('Erro ao anexar Curriculum Vitae.');
    } finally {
      setCvUploadLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteCv = async () => {
    if (!window.confirm('Tem certeza de que deseja remover o arquivo do Curriculum Vitae?')) return;
    setCvUploadLoading(true);
    try {
      await api.delete(`/usuarios/${id}/quadro-pessoal`);
      setQuadroPessoal(null);
      alert('Curriculum Vitae removido com sucesso!');
    } catch (err) {
      console.error('Erro ao remover CV:', err);
      alert('Erro ao remover Curriculum Vitae.');
    } finally {
      setCvUploadLoading(false);
    }
  };

  const handlePrintCvFile = (cvPath: string) => {
    if (!cvPath) {
      alert('Nenhum arquivo de currículo anexado para impressão.');
      return;
    }
    const fileUrl = getFileUrl(cvPath);
    if (!fileUrl) return;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = fileUrl;

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.open(fileUrl, '_blank');
      }
    };

    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 60000);
  };
  const [editingFormacao, setEditingFormacao] = useState<number | null>(null);
  const [editingAtividade, setEditingAtividade] = useState<number | null>(null);
  const [editingSaude, setEditingSaude] = useState<number | null>(null);
  const [editingBanco, setEditingBanco] = useState<number | null>(null);
  const [editingObra, setEditingObra] = useState<number | null>(null);
  const initializedIdRef = useRef<string | null>(null);
  const [nit, setNit] = useState('');
  const [situacaoData, setSituacaoData] = useState<SituacaoData>({
    data_falecimento: '', cidade_falecimento: '', certidao_obito_path: '', local_sepultamento: '',
    egresso_incardinado_path: '', egresso_desistencia_path: '', egresso_laicizado_path: '',
    egresso_transf_sacerdotes_path: '', egresso_transf_para_regiao_path: '', egresso_transf_da_regiao_path: '',
    exclaustrado_data: '', exclaustrado_processo: '', exclaustrado_doc_path: ''
  });
  const [originalSituacao, setOriginalSituacao] = useState('');
  const [showSituacaoConfirmModal, setShowSituacaoConfirmModal] = useState(false);
  const [motivoSituacao, setMotivoSituacao] = useState('');
  const [historicoSituacao, setHistoricoSituacao] = useState<HistoricoSituacaoItem[]>([]);
  const [historicoPerfil, setHistoricoPerfil] = useState<HistoricoPerfilItem[]>([]);

  const uploadSituacaoDoc = async (campo: keyof SituacaoData, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('arquivo', file);
    fd.append('campo', campo);
    setIsSaving(true);
    try {
      const res = await api.post(`/usuarios/${id}/situacao/upload-doc`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data?.filePath) {
        setSituacaoData(prev => ({ ...prev, [campo]: res.data.filePath }));
        const sitRes = await api.get(`/usuarios/${id}/situacao`).catch(() => null);
        if (sitRes?.data) {
          setSituacaoData(prev => ({
            ...prev,
            ...sitRes.data,
            [campo]: res.data.filePath,
            data_falecimento: sitRes.data.data_falecimento ? sitRes.data.data_falecimento.split('T')[0] : prev.data_falecimento,
            exclaustrado_data: sitRes.data.exclaustrado_data ? sitRes.data.exclaustrado_data.split('T')[0] : prev.exclaustrado_data,
          }));
        }
        alert('Documento anexado com sucesso!');
      }
    } catch (err: any) {
      alert('Erro ao enviar documento: ' + (err?.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const renderSituacaoDocField = (label: string, campo: keyof SituacaoData, elementId?: string) => {
    const filePath = situacaoData[campo] as string;
    const docUrl = filePath ? (getFileUrl(filePath) || filePath) : null;
    return (
      <div id={elementId} className="form-group full" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', transition: 'all 0.3s ease' }}>
        <label style={{ fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>{label}</label>
        {filePath ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a
              href={docUrl!}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}
            >
              <FileText size={16} /> Ver Documento Anexado
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Deseja realmente remover este documento anexado?')) {
                    setIsSaving(true);
                    try {
                      await api.delete(`/usuarios/${id}/situacao/doc/${campo}`);
                      setSituacaoData(prev => ({ ...prev, [campo]: '' }));
                      alert('Documento removido com sucesso!');
                    } catch (err: any) {
                      alert('Erro ao remover documento: ' + (err?.response?.data?.message || err.message));
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
              >
                <Trash2 size={14} /> Remover Anexo
              </button>
            )}
          </div>
        ) : (
          canEdit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="file"
                id={`file-input-${campo}`}
                accept=".pdf,.jpg,.jpeg,.png"
                style={{ display: 'none' }}
                onChange={e => uploadSituacaoDoc(campo, e)}
              />
              <label
                htmlFor={`file-input-${campo}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Upload size={15} /> Anexar Documento (PDF / JPEG)
              </label>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Nenhum arquivo anexado</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>Nenhum documento anexado.</span>
          )
        )}
      </div>
    );
  };

  const renderExclaustradoDocs = () => {
    const filePaths = (situacaoData.exclaustrado_doc_path || '').split(',').map(s => s.trim()).filter(Boolean);
    return (
      <div id="exclaustrado_doc_path" className="form-group full" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', transition: 'all 0.3s ease' }}>
        <label style={{ fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>Documentos Anexados (Adicione quantos desejar)</label>

        {filePaths.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
            {filePaths.map((path, idx) => {
              const docUrl = getFileUrl(path) || path;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <a
                    href={docUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#1d4ed8', fontWeight: 600, textDecoration: 'none', background: '#eff6ff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #bfdbfe' }}
                  >
                    <FileText size={16} /> Ver Documento {idx + 1}
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => {
                        const newPaths = filePaths.filter((_, i) => i !== idx);
                        setSituacaoData(prev => ({ ...prev, exclaustrado_doc_path: newPaths.join(',') }));
                      }}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                    >
                      <Trash2 size={14} /> Remover
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', display: 'block', marginBottom: '12px' }}>Nenhum documento anexado.</span>
        )}

        {canEdit && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="file"
              id="file-input-exclaustrado_doc_path"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append('arquivo', file);
                fd.append('descricao', `Documento de Exclaustração`);
                setIsSaving(true);
                try {
                  const res = await api.post(`/usuarios/${id}/documentos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                  if (res.data?.url || res.data?.arquivo_path) {
                    const newUrl = res.data.url || res.data.arquivo_path;
                    const newPaths = [...filePaths, newUrl];
                    setSituacaoData(prev => ({ ...prev, exclaustrado_doc_path: newPaths.join(',') }));
                    alert('Documento anexado! Não esqueça de clicar em "Salvar Situação" para finalizar.');
                  }
                } catch (err: any) {
                  alert('Erro ao enviar documento: ' + (err?.response?.data?.message || err.message));
                } finally {
                  setIsSaving(false);
                  e.target.value = '';
                }
              }}
            />
            <label
              htmlFor="file-input-exclaustrado_doc_path"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <Upload size={15} /> Adicionar Documento
            </label>
          </div>
        )}
      </div>
    );
  };

  // Forms for adding
  const [showAddForm, setShowAddForm] = useState<string | null>(null);
  const [tempForm, setTempForm] = useState<Record<string, any>>({});
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);


  // Sidebar cascade for Itinerário Formativo
  const [itinSidebarExpanded, setItinSidebarExpanded] = useState(false);

  // Print utility function for individual sections (Premium & Clean)
  const printSection = (title: string, contentId: string) => {
    const content = document.getElementById(contentId);
    if (!content) return;

    // Clone element to manipulate without affecting UI
    const clone = content.cloneNode(true) as HTMLElement;

    // 1. Remove buttons, action icons, system elements, file inputs & upload sections
    const selectorToRemove = [
      'button',
      'a.btn-action-lite',
      'a.btn-itin-doc',
      '.btn-action-lite-text',
      '.btn-action-lite',
      '.item-actions-premium',
      '.section-actions',
      '.btn-save-perfil',
      '.btn-upload-doc',
      '.btn-itin-doc',
      'input[type="file"]',
      '.file-input-wrapper',
      '.doc-upload-zone',
      '.docs-section',
      'svg',
      '.doc-card-actions',
      'datalist',
      '.section-header-flex button',
    ].join(', ');

    clone.querySelectorAll(selectorToRemove).forEach(el => el.remove());

    // 2. Remove top section-header-flex or duplicate section-title at root of clone
    const topHeader = clone.querySelector('.section-header-flex');
    if (topHeader) {
      topHeader.remove();
    } else {
      const topTitle = clone.querySelector('.section-title');
      if (topTitle) topTitle.remove();
    }

    // 3. Convert form inputs/selects/textareas to plain text values
    const origInputs = Array.from(content.querySelectorAll('input, select, textarea'));
    const cloneInputs = Array.from(clone.querySelectorAll('input, select, textarea'));

    origInputs.forEach((origEl, idx) => {
      const cloneEl = cloneInputs[idx];
      if (!cloneEl) return;

      const tagName = origEl.tagName.toLowerCase();
      let textValue = '';

      if (tagName === 'input') {
        const inp = origEl as HTMLInputElement;
        if (inp.type === 'checkbox' || inp.type === 'radio') {
          if (!inp.checked) {
            const parentGroup = cloneEl.closest('label') || cloneEl.parentElement;
            if (parentGroup && parentGroup !== clone) {
              parentGroup.remove();
            } else {
              cloneEl.remove();
            }
            return;
          }
          textValue = inp.nextSibling?.textContent?.trim() || inp.name || 'Sim';
        } else if (inp.type === 'date') {
          textValue = formatDateLocal(inp.value) || '-';
        } else {
          textValue = inp.value.trim() || '-';
        }
      } else if (tagName === 'select') {
        const sel = origEl as HTMLSelectElement;
        const optText = sel.options[sel.selectedIndex]?.text || sel.value;
        textValue = optText.includes('Selecione') ? '-' : optText.trim() || '-';
      } else if (tagName === 'textarea') {
        const txt = origEl as HTMLTextAreaElement;
        textValue = txt.value.trim() || '-';
      }

      // Replace form input control with clean text span
      const span = document.createElement('span');
      span.className = 'print-data-value';
      span.textContent = textValue;
      cloneEl.parentNode?.replaceChild(span, cloneEl);
    });

    // 4. Open print window and generate elegant HTML report
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${title} - ${missionario?.nome || ''}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Inter:wght@300;400;500;600;700&display=swap');
          
          * { margin: 0; padding: 0; box-sizing: border-box; }
          
          @page {
            size: A4;
            margin: 12mm 15mm 15mm 15mm;
          }

          body {
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            color: #0f172a;
            background: #ffffff;
            line-height: 1.5;
            font-size: 12.5px;
            padding: 20px;
          }

          .print-container {
            max-width: 800px;
            margin: 0 auto;
          }

          /* Header institucional elegante */
          .print-header {
            text-align: center;
            padding-bottom: 18px;
            margin-bottom: 24px;
            border-bottom: 2px solid #013375;
          }

          .print-header .org-name {
            font-family: 'Cinzel', serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 1.5px;
            color: #013375;
            text-transform: uppercase;
            margin-bottom: 4px;
          }

          .print-header .doc-title {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
            margin-top: 6px;
            margin-bottom: 12px;
          }

          .print-header-meta {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 20px;
            font-size: 12px;
            color: #475569;
            background: #f8fafc;
            padding: 8px 16px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
          }

          .print-header-meta span strong {
            color: #013375;
          }

          /* Form grids e grupos */
          .form-grid-1, .form-grid-2, .form-grid-3, .form-grid-4 {
            display: grid;
            gap: 14px 18px;
            margin-bottom: 20px;
          }

          .form-grid-1 { grid-template-columns: 1fr; }
          .form-grid-2 { grid-template-columns: 1fr 1fr; }
          .form-grid-3 { grid-template-columns: 1fr 1fr 1fr; }
          .form-grid-4 { grid-template-columns: 1fr 1fr 1fr 1fr; }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .form-group label {
            font-size: 10.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #64748b;
          }

          .print-data-value {
            font-size: 13px;
            font-weight: 500;
            color: #0f172a;
            padding: 4px 0 6px 0;
            border-bottom: 1px dashed #cbd5e1;
            min-height: 22px;
            display: block;
          }

          /* Listas e Cards Premium */
          .list-item-card-premium, .contato-item-premium, .generic-list > div {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            border-radius: 8px !important;
            padding: 14px 18px !important;
            margin-bottom: 14px !important;
            page-break-inside: avoid;
          }

          .item-main-content strong {
            font-size: 14px;
            color: #013375;
            display: block;
            margin-bottom: 4px;
          }

          .item-subtitle {
            font-size: 12px;
            color: #475569;
          }

          .item-description {
            font-size: 12px;
            color: #334155;
            margin-top: 6px;
            line-height: 1.5;
            white-space: pre-wrap;
            word-break: break-word;
          }

          /* Status Badges */
          .situacao-tag-premium, .tag {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            border: 1px solid #cbd5e1;
          }

          .situacao-tag-premium.ativo { background: #dcfce7; color: #166534; border-color: #bbf7d0; }
          .situacao-tag-premium.egresso { background: #fef3c7; color: #92400e; border-color: #fde68a; }
          .situacao-tag-premium.falecido { background: #f1f5f9; color: #475569; border-color: #cbd5e1; }

          /* Ocultar elementos desnecessários */
          button, .btn-action-lite, .btn-action-lite-text, .section-actions, .item-actions-premium, svg, .docs-section {
            display: none !important;
          }

          /* Footer */
          .print-footer {
            margin-top: 40px;
            padding-top: 12px;
            border-top: 1.5px solid #013375;
            display: flex;
            justify-content: space-between;
            font-size: 10.5px;
            color: #64748b;
          }

          @media print {
            body { padding: 0; }
            .print-container { max-width: 100%; }
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          <div class="print-header">
            <div class="org-name">Congregação dos Missionários de São Carlos – Scalabrinianos</div>
            <div class="doc-title">${title}</div>
            <div class="print-header-meta">
              <span>Missionário: <strong>${missionario?.nome || ''}</strong></span>
              <span>ID: <strong>#${missionario?.id || ''}</strong></span>
              <span>Emissão: <strong>${dataAtual} às ${horaAtual}</strong></span>
            </div>
          </div>

          <div class="print-body">
            ${clone.innerHTML}
          </div>

          <div class="print-footer">
            <span>Portal Scalabrinianos — Sistema de Gestão</span>
            <span>Documento impresso individualmente</span>
          </div>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  };

  const API_URL = import.meta.env.VITE_API_URL || '/api';
  void API_URL;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (id) {
      const isOwner = authUser?.id === parseInt(id);
      const isManager = isAdminGeral || canEdit || isOconomo || isSuperior || isRegional;

      if (!isManager && !isOwner) {
        navigate('/home');
        return;
      }
      const isFirst = initializedIdRef.current !== id;
      if (isFirst) {
        initializedIdRef.current = id;
        fetchData(true);
      } else {
        fetchData(false);
      }
    }
  }, [id, authUser, isAdminGeral, canEdit, isOconomo, isSuperior, isRegional]);

  const fetchData = async (isInitial = false) => {
    if (isInitial) setIsLoading(true);
    try {
      let data: any = null;
      try {
        const fullRes = await api.get(`/usuarios/${id}/perfil-completo`);
        data = fullRes.data;
      } catch {
        // Fallback to individual requests if needed
        const [mRes, civRes, endRes, relRes, casasRes, histRes, nacRes, docRes, itinRes] = await Promise.all([
          api.get(`/usuarios/${id}`),
          api.get(`/usuarios/${id}/dados-civis`),
          api.get(`/usuarios/${id}/endereco-contato`),
          api.get(`/usuarios/${id}/dados-religiosos`),
          api.post(`/casas-religiosas/get`),
          api.get(`/usuarios/${id}/casas-historico`),
          api.get(`/usuarios/${id}/nacionalidades`),
          api.get(`/usuarios/${id}/documentos`),
          api.get(`/usuarios/${id}/itinerario`),
        ]);
        const [fRes, aRes, oRes, sRes, bRes, obsRes, qRes, contRes, sitRes, hSitRes, hPerfRes] = await Promise.all([
          api.get(`/usuarios/${id}/formacao-academica`),
          api.get(`/usuarios/${id}/atividade-missionaria`),
          api.get(`/usuarios/${id}/obras-realizadas`),
          api.get(`/usuarios/${id}/saude`),
          api.get(`/usuarios/${id}/contas-bancarias`),
          api.get(`/usuarios/${id}/observacoes-gerais`),
          api.get(`/usuarios/${id}/quadro-pessoal`),
          api.get(`/usuarios/${id}/contatos`),
          api.get(`/usuarios/${id}/situacao`),
          api.get(`/usuarios/${id}/historico-situacao`).catch(() => ({ data: [] })),
          api.get(`/usuarios/${id}/historico-perfil`).catch(() => ({ data: [] })),
        ]);
        data = {
          missionario: mRes.data,
          dadosCivis: civRes.data,
          enderecoContato: endRes.data,
          dadosReligiosos: relRes.data,
          casasDisponiveis: casasRes.data,
          casasHistorico: histRes.data,
          nacionalidades: nacRes.data,
          documentos: docRes.data,
          itinerario: itinRes.data,
          formacaoAcademica: fRes.data,
          atividadesMissionarias: aRes.data,
          obrasRealizadas: oRes.data,
          saudeRecords: sRes.data,
          contasBancarias: bRes.data,
          observacoesGerais: obsRes.data,
          quadroPessoal: qRes.data,
          contatos: contRes.data,
          situacaoData: sitRes.data,
          historicoSituacao: hSitRes.data,
          historicoPerfil: hPerfRes.data,
        };
      }

      if (!data || !data.missionario) return;

      const normSit = normalizeSituacao(data.missionario?.situacao);
      let parsedPerms = data.missionario?.permissoes;
      if (typeof parsedPerms === 'string') {
        try { parsedPerms = JSON.parse(parsedPerms); } catch { parsedPerms = {}; }
      }
      setMissionario({ ...data.missionario, situacao: normSit, permissoes: parsedPerms || {} });
      setOriginalSituacao(normSit);
      const isSelf = authUser?.id === data.missionario?.id;

      if (isInitial) {
        setActiveTab(prev => {
          if (prev && prev !== 'dados') return prev;
          if (isSelf) return 'dados';
          if (normSit !== 'Ativo') return 'situacao';
          return 'dados';
        });
      }
      if (data.dadosCivis) {
        const parts = data.dadosCivis.filiacao ? data.dadosCivis.filiacao.split('/') : [];
        setCivilData({
          ...data.dadosCivis,
          nome_pai: parts[0] ? parts[0].trim() : '',
          nome_mae: parts[1] ? parts[1].trim() : '',
          data_nascimento: data.dadosCivis.data_nascimento ? data.dadosCivis.data_nascimento.split('T')[0] : ''
        });
      }
      if (data.enderecoContato) setEnderecoData(data.enderecoContato);
      if (data.dadosReligiosos) setReligiososData({
        ...data.dadosReligiosos,
        primeiros_votos_data: data.dadosReligiosos.primeiros_votos_data ? data.dadosReligiosos.primeiros_votos_data.split('T')[0] : '',
        votos_perpetuos_data: data.dadosReligiosos.votos_perpetuos_data ? data.dadosReligiosos.votos_perpetuos_data.split('T')[0] : '',
        diaconato_data: data.dadosReligiosos.diaconato_data ? data.dadosReligiosos.diaconato_data.split('T')[0] : '',
        presbiterato_data: data.dadosReligiosos.presbiterato_data ? data.dadosReligiosos.presbiterato_data.split('T')[0] : '',
        data_batismo: data.dadosReligiosos.data_batismo ? data.dadosReligiosos.data_batismo.split('T')[0] : '',
        data_primeira_comunhao: data.dadosReligiosos.data_primeira_comunhao ? data.dadosReligiosos.data_primeira_comunhao.split('T')[0] : '',
        data_crisma: data.dadosReligiosos.data_crisma ? data.dadosReligiosos.data_crisma.split('T')[0] : '',
        doc_batismo: data.dadosReligiosos.doc_batismo || '',
        doc_primeira_comunhao: data.dadosReligiosos.doc_primeira_comunhao || '',
        doc_crisma: data.dadosReligiosos.doc_crisma || '',
      });
      setCasasDisponiveis(Array.isArray(data.casasDisponiveis) ? data.casasDisponiveis : []);
      setCasasHistorico(Array.isArray(data.casasHistorico) ? data.casasHistorico.map((h: any) => ({ ...h, funcao: h.funcao ? (typeof h.funcao === 'string' ? h.funcao.split(',').map((s: string) => s.trim()) : h.funcao) : [] })) : []);
      const rawNacs = data.nacionalidades;
      const loadedNacs: string[] = Array.isArray(rawNacs) ? rawNacs.map((n: any) => typeof n === 'string' ? n : (n?.nacionalidade || '')) : (Array.isArray(rawNacs?.nacionalidades) ? rawNacs.nacionalidades : []);
      setNacionalidades(loadedNacs.length > 0 ? loadedNacs : ['']);
      setDocumentos(Array.isArray(data.documentos) ? data.documentos : []);
      setItinerarioStages(Array.isArray(data.itinerario) ? data.itinerario : []);
      setNit(data.dadosCivis?.nit || '');

      setFormacaoAcademica(Array.isArray(data.formacaoAcademica) ? data.formacaoAcademica : []);
      setAtividadesMissionarias(Array.isArray(data.atividadesMissionarias) ? data.atividadesMissionarias : []);
      setObrasRealizadas(Array.isArray(data.obrasRealizadas) ? data.obrasRealizadas : []);
      setSaudeRecords(Array.isArray(data.saudeRecords) ? data.saudeRecords : []);
      setContasBancarias(Array.isArray(data.contasBancarias) ? data.contasBancarias : []);
      setObservacoesGerais(Array.isArray(data.observacoesGerais) ? data.observacoesGerais : []);
      setQuadroPessoal(Array.isArray(data.quadroPessoal) ? data.quadroPessoal[0] : (data.quadroPessoal || null));
      setContatos(Array.isArray(data.contatos) ? data.contatos : []);
      setHistoricoSituacao(Array.isArray(data.historicoSituacao) ? data.historicoSituacao : []);
      setHistoricoPerfil(Array.isArray(data.historicoPerfil) ? data.historicoPerfil : []);

      if (data.situacaoData) {
        setSituacaoData(prev => ({
          ...prev,
          ...data.situacaoData,
          data_falecimento: data.situacaoData.data_falecimento ? data.situacaoData.data_falecimento.split('T')[0] : '',
          cidade_falecimento: data.situacaoData.cidade_falecimento || '',
          certidao_obito_path: data.situacaoData.certidao_obito_path || '',
          local_sepultamento: data.situacaoData.local_sepultamento || '',
          egresso_incardinado_path: data.situacaoData.egresso_incardinado_path || '',
          egresso_desistencia_path: data.situacaoData.egresso_desistencia_path || '',
          egresso_laicizado_path: data.situacaoData.egresso_laicizado_path || '',
          egresso_transf_sacerdotes_path: data.situacaoData.egresso_transf_sacerdotes_path || '',
          egresso_transf_para_regiao_path: data.situacaoData.egresso_transf_para_regiao_path || '',
          egresso_transf_da_regiao_path: data.situacaoData.egresso_transf_da_regiao_path || '',
          exclaustrado_data: data.situacaoData.exclaustrado_data ? data.situacaoData.exclaustrado_data.split('T')[0] : '',
          exclaustrado_processo: data.situacaoData.exclaustrado_processo || '',
          exclaustrado_doc_path: data.situacaoData.exclaustrado_doc_path || '',
        }));
      }

    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /*
  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    setEnderecoData(prev => ({ ...prev, cep }));

    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          setEnderecoData(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            cidade_estado: `${data.localidade} - ${data.uf}`
          }));
        }
      } catch { }
      finally { setCepLoading(false); }
    }
  };
  */

  const saveCivil = async () => {
    setIsSaving(true);
    try {
      const filiacao = (civilData.nome_pai || civilData.nome_mae) ? `${civilData.nome_pai || ''} / ${civilData.nome_mae || ''}` : '';
      const civilDataToSave = { ...civilData, filiacao };
      delete civilDataToSave.nome_pai;
      delete civilDataToSave.nome_mae;

      const filteredNacs = (nacionalidades || []).map(n => n.trim()).filter(Boolean);

      await Promise.all([
        api.post(`/usuarios/${id}/dados-civis`, { ...civilDataToSave, nit }),
        api.post(`/usuarios/${id}/nacionalidades`, { nacionalidades: filteredNacs })
      ]);
      alert('Dados civis atualizados!');
    } catch { alert('Erro ao salvar dados civis'); }
    finally { setIsSaving(false); }
  };

  const saveReligiosos = async () => {
    setIsSaving(true);
    try {
      await api.put(`/usuarios/${id}/dados-religiosos`, {
        ...religiososData,
        data_batismo: religiososData.data_batismo || null,
        data_primeira_comunhao: religiososData.data_primeira_comunhao || null,
        data_crisma: religiososData.data_crisma || null,
      });

      // Update main user status and roles
      await api.put(`/usuarios/${id}`, {
        nome: missionario?.nome,
        login: missionario?.login,
        is_oconomo: missionario?.is_oconomo,
        is_superior: missionario?.is_superior,
        situacao: missionario?.situacao,
        proximos_passos: missionario?.proximos_passos,
        permissoes: missionario?.permissoes || {},
      });

      // Update Situation Details
      await api.post(`/usuarios/${id}/situacao`, situacaoData);

      alert('Dados religiosos e situação atualizados!');
    } catch { alert('Erro ao salvar dados religiosos'); }
    finally { setIsSaving(false); }
  };


  const saveEndereco = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        api.post(`/usuarios/${id}/endereco-contato`, enderecoData),
        api.post(`/usuarios/${id}/contatos`, { contatos })
      ]);
      alert('Endereço e contatos atualizados!');
    } catch { alert('Erro ao salvar endereço e contatos'); }
    finally { setIsSaving(false); }
  };

  const addCasa = async () => {
    try {
      await api.post(`/usuarios/${id}/casas-historico`, {
        casa_id: novaVinculacao.casa_id,
        data_inicio: novaVinculacao.data_inicio,
        data_fim: novaVinculacao.data_fim || null,
        funcao: Array.isArray(novaVinculacao.funcao) ? novaVinculacao.funcao.join(',') : (novaVinculacao.funcao || ''),
        is_superior: novaVinculacao.is_superior,
        pm: (novaVinculacao as any).pm || null,
        tipo: (novaVinculacao as any).tipo || null,
        pais: (novaVinculacao as any).pais || null,
      });
      fetchData();
      setNovaVinculacao({ casa_id: '', data_inicio: '', data_fim: '', funcao: [] as string[], is_superior: false, pm: '', tipo: '', pais: 'Brasil' } as any);
    } catch { alert('Erro ao vincular casa'); }
  };

  const removeCasa = async (vinculoId: number) => {
    if (!window.confirm('Remover este vínculo?')) return;
    try {
      await api.delete(`/usuarios/${id}/casas-historico/${vinculoId}`);
      fetchData();
    } catch { alert('Erro ao remover vínculo'); }
  };

  const uploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pendingDocDesc.trim()) return alert('Informe a descrição do documento');

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('descricao', pendingDocDesc);

    setIsSaving(true);
    try {
      await api.post(`/usuarios/${id}/documentos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPendingDocDesc('');
      if (fileInputRef.current) fileInputRef.current.value = ''; // reset input
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }, message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Erro ao enviar documento';
      alert(`Erro ao enviar documento: ${msg}`);
    } finally { setIsSaving(false); }
  };

  const uploadReligiousDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pendingReligiousDocDesc.trim()) return alert('Informe a descrição do documento');

    const formData = new FormData();
    formData.append('arquivo', file);
    formData.append('descricao', pendingReligiousDocDesc);

    setIsSaving(true);
    try {
      await api.post(`/usuarios/${id}/documentos`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPendingReligiousDocDesc('');
      if (religiousFileInputRef.current) religiousFileInputRef.current.value = ''; // reset input
      fetchData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }, message?: string };
      const msg = err?.response?.data?.message || err?.message || 'Erro ao enviar documento';
      alert(`Erro ao enviar documento: ${msg}`);
    } finally { setIsSaving(false); }
  };

  const removeDocument = async (docId: number) => {
    if (!window.confirm('Excluir este documento permanentemente?')) return;
    try {
      await api.delete(`/usuarios/${id}/documentos/${docId}`);
      fetchData();
    } catch { alert('Erro ao remover documento'); }
  };

  const saveItinerary = async () => {
    setIsSavingItinerary(true);
    try {
      await api.post(`/usuarios/${id}/itinerario`, { stages: itinerarioStages });
      alert('Itinerário atualizado com sucesso!');
    } catch { alert('Erro ao salvar itinerário'); }
    finally { setIsSavingItinerary(false); }
  };

  const saveBasicInfo = async () => {
    if (!missionario) return;
    setIsSaving(true);
    try {
      const payload: any = {
        nome: missionario.nome,
        login: missionario.login,
        situacao: missionario.situacao,
        is_oconomo: missionario.is_oconomo,
        is_superior: missionario.is_superior,
        proximos_passos: missionario.proximos_passos,
        role: missionario.role || 'MISSIONARIO',
        status: missionario.status || 'ATIVO',
        permissoes: missionario.permissoes || {}
      };

      if (newPassword.trim()) {
        payload.password = newPassword;
      }

      await api.put(`/usuarios/${id}`, payload);
      alert('Informações de acesso atualizadas com sucesso!');
      setNewPassword('');
      const hPerfRes = await api.get(`/usuarios/${id}/historico-perfil`).catch(() => ({ data: [] }));
      setHistoricoPerfil(Array.isArray(hPerfRes.data) ? hPerfRes.data : []);
    } catch (err: any) {
      alert('Erro ao salvar informações: ' + (err.response?.data?.message || err.message));
    }
    finally { setIsSaving(false); }
  };

  const handleSaveSituacao = async () => {
    if (!missionario) return;
    const currentSit = normalizeSituacao(missionario.situacao);
    if (currentSit !== normalizeSituacao(originalSituacao)) {
      setShowSituacaoConfirmModal(true);
    } else {
      setIsSaving(true);
      try {
        await api.post(`/usuarios/${id}/situacao`, situacaoData);
        alert('Dados de situação atualizados com sucesso!');
      } catch (err: any) {
        alert('Erro ao salvar dados de situação: ' + (err.response?.data?.message || err.message));
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleConfirmSituacaoSave = async () => {
    if (!missionario) return;
    setIsSaving(true);
    try {
      const payload: any = {
        nome: missionario.nome,
        login: missionario.login,
        situacao: missionario.situacao,
        is_oconomo: missionario.is_oconomo,
        is_superior: missionario.is_superior,
        proximos_passos: missionario.proximos_passos,
        role: missionario.role || 'MISSIONARIO',
        status: missionario.status || 'ATIVO',
        permissoes: missionario.permissoes || {},
        motivo_situacao: motivoSituacao
      };
      await api.put(`/usuarios/${id}`, payload);
      await api.post(`/usuarios/${id}/situacao`, situacaoData);

      const norm = normalizeSituacao(missionario.situacao);
      setOriginalSituacao(norm);
      setShowSituacaoConfirmModal(false);
      setMotivoSituacao('');
      alert('Situação atualizada com sucesso e registrada no histórico!');

      const hSitRes = await api.get(`/usuarios/${id}/historico-situacao`).catch(() => ({ data: [] }));
      setHistoricoSituacao(Array.isArray(hSitRes.data) ? hSitRes.data : []);
    } catch (err: any) {
      alert('Erro ao salvar situação: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };



  const handleItinDocUpload = async (e: React.ChangeEvent<HTMLInputElement>, etapa: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsSaving(true);
    const fd = new FormData();
    fd.append('arquivo', file);
    fd.append('descricao', `Doc Etapa: ${etapa}`);

    try {
      const res = await api.post(`/usuarios/${id}/documentos`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const newPath = res.data.url || res.data.arquivo_path;
      const existing = itinerarioStages.find(s => s.etapa === etapa);
      let newStages: ItineraryStage[] = [];
      if (existing) {
        newStages = itinerarioStages.map(s => s.etapa === etapa ? { ...s, doc_path: newPath } : s);
      } else {
        newStages = [...itinerarioStages, { etapa, local: '', periodo: '', doc_path: newPath, is_sub_etapa: false }];
      }
      setItinerarioStages(newStages);
      await api.post(`/usuarios/${id}/itinerario`, { stages: newStages });
      if (itinFileInputRef.current) itinFileInputRef.current.value = '';
      alert('Documento anexado com sucesso!');
    } catch {
      alert('Erro ao anexar documento');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenericAdd = async (endpoint: string, data: Record<string, any>) => {
    setIsSaving(true);
    try {
      await api.post(`/usuarios/${id}/${endpoint}`, data);
      setShowAddForm(null);
      setEditingFormacao(null);
      setEditingAtividade(null);
      setEditingSaude(null);
      setEditingBanco(null);
      setEditingObra(null);
      setTempForm({});
      await fetchData(false);
    } catch { alert('Erro ao salvar registro'); }
    finally { setIsSaving(false); }
  };

  const handleGenericUpdate = async (endpoint: string, itemId: number, data: Record<string, any>) => {
    setIsSaving(true);
    try {
      await api.put(`/usuarios/${id}/${endpoint}/${itemId}`, data);
      setShowAddForm(null);
      setEditingFormacao(null);
      setEditingAtividade(null);
      setEditingSaude(null);
      setEditingBanco(null);
      setEditingObra(null);
      setTempForm({});
      await fetchData(false);
    } catch {
      // Fallback if PUT endpoint is not defined on backend, try DELETE + POST
      try {
        await api.delete(`/usuarios/${id}/${endpoint}/${itemId}`);
        await api.post(`/usuarios/${id}/${endpoint}`, data);
        setShowAddForm(null);
        setEditingFormacao(null);
        setEditingAtividade(null);
        setEditingSaude(null);
        setEditingBanco(null);
        setEditingObra(null);
        setTempForm({});
        await fetchData(false);
      } catch {
        alert('Erro ao atualizar registro');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const uploadGenericDoc = async (e: React.ChangeEvent<HTMLInputElement>, endpoint: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('arquivo', file);

    setIsSaving(true);
    try {
      const res = await api.post(`/upload-anexo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const filePath = res.data.arquivo_path || res.data.url;
      const fieldName = endpoint === 'quadro-pessoal' ? 'cv_path' : 'doc_path';
      setTempForm(prev => ({ ...prev, [fieldName]: filePath }));
      alert('Documento anexado com sucesso!');
    } catch {
      alert('Erro ao enviar documento');
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleGenericDelete = async (endpoint: string, itemId: number) => {
    if (!window.confirm('Excluir este registro?')) return;
    try {
      await api.delete(`/usuarios/${id}/${endpoint}/${itemId}`);
      fetchData();
    } catch { alert('Erro ao remover registro'); }
  };

  if (isLoading) return <div className="perfil-loading"><Loader2 className="animate-spin" size={40} /><p>{t('profile.loading')}</p></div>;
  if (!missionario) return <div className="perfil-loading"><AlertCircle size={40} /><p>{t('profile.not_found')}</p></div>;

  const isSelfProfile = authUser?.id === missionario?.id;
  const canPrint = (isAdminGeral || canEdit || isRegional) && !isSelfProfile;

  // Tabs principais (Situação só aparece para Admin/Regional)
  const mainTabs = [
    ...(!isSelfProfile ? [{ key: 'situacao', label: '0. Situação', icon: <Star size={16} />, perm: 'dados_civis' }] : []),
    { key: 'dados', label: t('profile.tabs.personal'), icon: <User size={16} />, perm: 'dados_civis' },
    { key: 'contatos', label: t('profile.tabs.contact'), icon: <MapPin size={16} />, perm: 'contatos' },
  ];

  const sidebarItems: { key: string; label: string; icon: React.ReactNode; perm: string | null }[] = [
    { key: 'religiosos', label: t('profile.tabs.religious'), icon: <BookOpen size={16} />, perm: 'dados_religiosos' },
    { key: 'itinerario', label: t('profile.tabs.itinerary'), icon: <Activity size={16} />, perm: 'itinerario_formativo' },
    { key: 'formacao_academica', label: t('profile.tabs.formacao_academica'), icon: <GraduationCap size={16} />, perm: 'formacao_academica' },
    { key: 'atividade_missionaria', label: t('profile.tabs.atividade_missionaria'), icon: <MapPin size={16} />, perm: 'atividade_missionaria' },
    { key: 'saude_individual', label: t('profile.tabs.saude_individual'), icon: <Activity size={16} />, perm: 'saude' },
    { key: 'previdenciario', label: t('profile.tabs.previdenciario'), icon: <ShieldCheck size={16} />, perm: 'previdenciario_ir' },
    { key: 'contas_bancarias', label: t('profile.tabs.contas_bancarias'), icon: <DollarSign size={16} />, perm: 'conta_bancaria' },
    { key: 'formacao_missao', label: t('profile.tabs.formacao_missao'), icon: <Star size={16} />, perm: 'obras_realizadas' },
    { key: 'obs', label: t('profile.tabs.obs'), icon: <FileText size={16} />, perm: 'observacoes' },
    { key: 'quadro_pessoal', label: t('profile.tabs.quadro_pessoal'), icon: <FileText size={16} />, perm: 'quadro_pessoal' },
    { key: 'casas', label: t('profile.tabs.houses'), icon: <HomeIcon size={16} />, perm: null },
    { key: 'acesso', label: t('profile.tabs.access'), icon: <Lock size={16} />, perm: null },
    { key: 'permissoes', label: t('profile.tabs.permissions'), icon: <ShieldCheck size={16} />, perm: null },
  ];

  const handleSidebarItemClick = (key: string) => {
    setActiveTab(key);
  };

  const handleMainTabClick = (key: string) => {
    setActiveTab(key);
  };

  const TABS = mainTabs.filter(tab => {
    if (isAdminGeral || (canEdit && authUser?.id !== missionario.id)) return true;
    if (!tab.perm) return true;
    return !!missionario.permissoes?.[tab.perm];
  });

  const SIDEBAR = sidebarItems.filter(tab => {
    if (isAdminGeral || (canEdit && authUser?.id !== missionario.id)) return true;
    if (!tab.perm) return true;
    return !!missionario.permissoes?.[tab.perm];
  });

  const shouldShowObservacoes = (etapa?: string) => {
    if (!etapa) return false;
    const cleanEtapa = etapa.split('-')[0];
    return cleanEtapa === '4.1.5' || cleanEtapa === '4.1.7' || cleanEtapa.startsWith('4.2');
  };

  // Helper: renders itinerary stage items for a given sub-section
  const renderItinSubItems = (subItems: Array<{ label: string; etapaKey: string }>) => (
    <>
      <div style={{ marginTop: '16px' }}>
        {subItems.map(sub => {
          const matchingStages = itinerarioStages.filter(s => s.etapa === sub.etapaKey || s.etapa.startsWith(sub.etapaKey + '-'));
          const stagesToRender = matchingStages.length > 0 ? matchingStages : [{ etapa: sub.etapaKey, local: '', periodo: '', doc_path: '', is_sub_etapa: false, observacoes: '' }];
          return (
            <div key={sub.etapaKey} style={{ marginBottom: '20px', padding: '12px', background: '#fafafa', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ fontSize: '0.9rem', color: '#1e293b' }}>{sub.label}</strong>
                {canEdit && (
                  <button type="button" className="btn-action-lite-text" style={{ fontSize: '0.8rem', padding: '2px 8px' }}
                    onClick={() => { const ne = `${sub.etapaKey}-${Date.now()}`; setItinerarioStages([...itinerarioStages, { etapa: ne, local: '', periodo: '', doc_path: '', is_sub_etapa: true, observacoes: '' }]); }}>
                    <Plus size={14} /> Novo Local/Período
                  </button>
                )}
              </div>
              {stagesToRender.map((stage, sIdx) => (
                <div key={stage.etapa + '-' + sIdx} style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Período (ex: 1990-1994)" value={stage.periodo}
                    onChange={e => { const val = e.target.value; const updated = itinerarioStages.some(s => s.etapa === stage.etapa) ? itinerarioStages.map(s => s.etapa === stage.etapa ? { ...s, periodo: val } : s) : [...itinerarioStages, { ...stage, periodo: val }]; setItinerarioStages(updated); }}
                    disabled={!canEdit} style={{ flex: '1', minWidth: '160px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  <input type="text" placeholder="Local / Instituição" value={stage.local}
                    onChange={e => { const val = e.target.value; const updated = itinerarioStages.some(s => s.etapa === stage.etapa) ? itinerarioStages.map(s => s.etapa === stage.etapa ? { ...s, local: val } : s) : [...itinerarioStages, { ...stage, local: val }]; setItinerarioStages(updated); }}
                    disabled={!canEdit} style={{ flex: '2', minWidth: '220px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  {shouldShowObservacoes(stage.etapa) && (
                    <input type="text" placeholder="Observações" value={stage.observacoes || ''}
                      onChange={e => { const val = e.target.value; const updated = itinerarioStages.some(s => s.etapa === stage.etapa) ? itinerarioStages.map(s => s.etapa === stage.etapa ? { ...s, observacoes: val } : s) : [...itinerarioStages, { ...stage, observacoes: val }]; setItinerarioStages(updated); }}
                      disabled={!canEdit} style={{ flex: '2', minWidth: '220px', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }} />
                  )}
                  <div className="itin-doc-actions" style={{ display: 'flex', gap: '6px' }}>
                    {stage.doc_path ? (
                      <a href={getFileUrl(stage.doc_path) || '#'} target="_blank" rel="noreferrer" className="btn-itin-doc success"><FileText size={14} /> Ver Doc</a>
                    ) : (
                      <button type="button" className="btn-itin-doc" onClick={() => { activeEtapaRef.current = stage.etapa; itinFileInputRef.current?.click(); }} disabled={!canEdit}>
                        <Plus size={14} /> Anexar
                      </button>
                    )}
                    {canEdit && stage.etapa.includes('-') && (
                      <button type="button" className="btn-action-lite delete" onClick={() => setItinerarioStages(itinerarioStages.filter(s => s.etapa !== stage.etapa))}><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {canEdit && (
        <button className="btn-save-perfil" onClick={saveItinerary} disabled={isSavingItinerary} style={{ marginTop: '12px' }}>
          {isSavingItinerary ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Salvar Itinerário
        </button>
      )}
    </>
  );

  return (
    <div className="page-container">
      <div className="perfil-header">
        <button className="btn-back" onClick={() => navigate('/missionarios')}>
          <ChevronLeft size={18} /> {t('profile.back_btn')}
        </button>
        <div className="perfil-id">ID: #{missionario.id}</div>
      </div>

      <div className="perfil-top-card">
        <div className="perfil-avatar-wrapper">
          <div className="perfil-avatar">{missionario.nome.charAt(0)}</div>
          <div className={`perfil-status-dot ${(missionario.situacao || '').toLowerCase()}`}></div>
        </div>
        <div className="perfil-main-info" style={{ flex: 1 }}>
          <div className="perfil-name-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <h1>{missionario.nome}</h1>
              {!isSelfProfile && (
                <span className={`situacao-tag-premium ${(missionario.situacao || '').toLowerCase()}`}>
                  {missionario.situacao}
                </span>
              )}
            </div>
            {canEdit && (
              <button
                className="btn-edit-access"
                onClick={() => setActiveTab('acesso')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  background: '#013375',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '600',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <Lock size={14} />
                Editar acessos do usuário
              </button>
            )}
          </div>
          <div className="perfil-badges-row">
            <div className="perfil-badge-item">
              <User size={14} />
              <span>{t('profile.missionary_role')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Layout principal: sidebar esquerda + conteúdo ── */}
      <div className="perfil-layout">

        {/* Sidebar esquerda em cascata */}
        <aside className="perfil-sidebar">
          <div className="sidebar-section-title">Mais Informações</div>
          <nav className="sidebar-nav">
            {SIDEBAR.map(item => {
              if (item.key === 'itinerario') {
                const itinSubItems = [
                  { key: 'itin_4.1', label: '4.1 Seminário' },
                  { key: 'itin_4.2', label: '4.2 Vida Religiosa' },
                  { key: 'itin_4.3', label: '4.3 Ministérios' },
                  { key: 'itin_4.4', label: '4.4 Destinação dada pela Direção' },
                ];
                const isItinActive = activeTab.startsWith('itin_');
                return (
                  <div key="itinerario-group">
                    <button
                      className={`sidebar-nav-item ${isItinActive ? 'active' : ''}`}
                      style={{ display: 'flex', alignItems: 'center', width: '100%' }}
                      onClick={() => {
                        const willExpand = !itinSidebarExpanded;
                        setItinSidebarExpanded(willExpand);
                        if (willExpand && !isItinActive) setActiveTab('itin_4.1');
                      }}
                    >
                      <span className="sidebar-nav-icon">{item.icon}</span>
                      <span className="sidebar-nav-label" style={{ flex: 1 }}>{item.label}</span>
                      <span style={{ marginLeft: '4px', display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                        {(itinSidebarExpanded || isItinActive) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    </button>
                    {(itinSidebarExpanded || isItinActive) && itinSubItems.map(sub => (
                      <button
                        key={sub.key}
                        className={`sidebar-nav-item ${activeTab === sub.key ? 'active' : ''}`}
                        style={{ paddingLeft: '32px', fontSize: '0.82rem', opacity: 0.92 }}
                        onClick={() => setActiveTab(sub.key)}
                      >
                        <span className="sidebar-nav-label">{sub.label}</span>
                      </button>
                    ))}
                  </div>
                );
              }
              return (
                <button
                  key={item.key}
                  className={`sidebar-nav-item ${activeTab === item.key ? 'active' : ''}`}
                  onClick={() => handleSidebarItemClick(item.key)}
                >
                  <span className="sidebar-nav-icon">{item.icon}</span>
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Área principal com tabs Dados Civis e Contatos */}
        <div className="perfil-main-area">
          <div className="perfil-tabs">
            {TABS.map(tab => {
              const isActive = tab.key === 'situacao' ? (activeTab === 'situacao' || activeTab.startsWith('situacao_')) : activeTab === tab.key;
              return (
                <button key={tab.key} className={`tab-btn ${isActive ? 'active' : ''}`} onClick={() => handleMainTabClick(tab.key)}>
                  {tab.icon} {tab.label}
                </button>
              );
            })}
          </div>

          <div className="perfil-content">
            {/* --- 0. SITUAÇÃO --- */}
            {(activeTab === 'situacao' || activeTab.startsWith('situacao_')) && (() => {
              const currentSituacao = normalizeSituacao(missionario.situacao);
              return (
                <div className="tab-panel">
                  <div className="section-card" id="print-situacao">
                    <div className="section-header-flex">
                      <h3 className="section-title"><Star size={16} /> 0. Situação do Missionário</h3>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('0. Situação', 'print-situacao')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                    </div>

                    {/* Status badge display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                      <span className={`situacao-tag-premium ${currentSituacao.toLowerCase()}`} style={{ fontSize: '1rem', padding: '10px 24px' }}>
                        {currentSituacao}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Situação atual do missionário no sistema</span>
                    </div>

                    {/* Alterar Situação (quando edita) */}
                    {canEdit && (
                      <div className="form-grid-2" style={{ marginBottom: '24px' }}>
                        <div className="form-group">
                          <label>Alterar Situação do Missionário</label>
                          <select
                            value={currentSituacao}
                            onChange={e => setMissionario({ ...missionario, situacao: e.target.value } as any)}
                          >
                            <option value="Ativo">Ativo</option>
                            <option value="Egresso">Egresso</option>
                            <option value="Falecido">Falecido</option>
                            <option value="Exclaustrado">Exclaustrado</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ── FALECIDO ── */}
                    {currentSituacao === 'Falecido' && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
                          🕊️ Informações de Falecimento
                        </h4>
                        {(activeTab === 'situacao' || activeTab === 'situacao_falecido_data_cidade') && (
                          <div id="falecido_data_cidade" className="form-grid-2" style={{ marginBottom: '16px' }}>
                            <div className="form-group">
                              <label>Data de Falecimento</label>
                              <input
                                type="date"
                                value={situacaoData.data_falecimento || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, data_falecimento: e.target.value })}
                                disabled={!canEdit}
                              />
                            </div>
                            <div className="form-group">
                              <label>Cidade de Falecimento</label>
                              <input
                                type="text"
                                value={situacaoData.cidade_falecimento || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, cidade_falecimento: e.target.value })}
                                placeholder="Cidade - UF / País"
                                disabled={!canEdit}
                              />
                            </div>
                          </div>
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_certidao_obito_path') && (
                          renderSituacaoDocField('Certidão de Óbito (PDF / JPEG)', 'certidao_obito_path', 'certidao_obito_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_falecido_sepultamento') && (
                          <div id="falecido_sepultamento" className="form-group full">
                            <label>Local de Sepultamento</label>
                            <input
                              type="text"
                              value={situacaoData.local_sepultamento || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, local_sepultamento: e.target.value })}
                              placeholder="Cemitério, Jazigo, Cidade..."
                              disabled={!canEdit}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── EGRESSO ── */}
                    {currentSituacao === 'Egresso' && (
                      <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#854d0e', fontSize: '1rem', borderBottom: '2px solid #fde047', paddingBottom: '8px' }}>
                          📋 Documentos e Informações de Egresso
                        </h4>

                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_incardinado_path') && (
                          renderSituacaoDocField('1. Incardinados (Documento PDF / JPEG)', 'egresso_incardinado_path', 'egresso_incardinado_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_desistencia_path') && (
                          renderSituacaoDocField('2. Desistência ou em outro instituto (Documento PDF / JPEG)', 'egresso_desistencia_path', 'egresso_desistencia_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_laicizado_path') && (
                          renderSituacaoDocField('3. Laicizados (Documento PDF / JPEG)', 'egresso_laicizado_path', 'egresso_laicizado_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_sacerdotes_path') && (
                          renderSituacaoDocField('4. Sacerdotes e Religiosos Transferidos (Documento PDF / JPEG)', 'egresso_transf_sacerdotes_path', 'egresso_transf_sacerdotes_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_para_regiao_path') && (
                          renderSituacaoDocField('4.1 Para a Região (Documento PDF / JPEG)', 'egresso_transf_para_regiao_path', 'egresso_transf_para_regiao_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_da_regiao_path') && (
                          renderSituacaoDocField('4.2 Da Região para outras Províncias / Região (Documento PDF / JPEG)', 'egresso_transf_da_regiao_path', 'egresso_transf_da_regiao_path')
                        )}
                      </div>
                    )}

                    {/* ── EXCLAUSTRADO ── */}
                    {currentSituacao === 'Exclaustrado' && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#991b1b', fontSize: '1rem', borderBottom: '2px solid #fca5a5', paddingBottom: '8px' }}>
                          📜 Informações de Exclaustração
                        </h4>
                        <div className="form-grid-2">
                          {(activeTab === 'situacao' || activeTab === 'situacao_exclaustrado_data') && (
                            <div id="exclaustrado_data" className="form-group">
                              <label>Data de Exclaustração</label>
                              <input
                                type="date"
                                value={situacaoData.exclaustrado_data || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, exclaustrado_data: e.target.value })}
                                disabled={!canEdit}
                              />
                            </div>
                          )}
                          {(activeTab === 'situacao' || activeTab === 'situacao_exclaustrado_processo') && (
                            <div id="exclaustrado_processo" className="form-group">
                              <label>Processo / Decreto</label>
                              <input
                                type="text"
                                value={situacaoData.exclaustrado_processo || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, exclaustrado_processo: e.target.value })}
                                placeholder="Número do processo ou decreto..."
                                disabled={!canEdit}
                              />
                            </div>
                          )}
                          {(activeTab === 'situacao' || activeTab === 'situacao_exclaustrado_doc_path') && (
                            renderExclaustradoDocs()
                          )}
                        </div>
                      </div>
                    )}

                    {canEdit && (
                      <div className="section-actions" style={{ marginTop: '20px' }}>
                        <button className="btn-save-perfil" onClick={handleSaveSituacao} disabled={isSaving}>
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          Salvar Situação
                        </button>
                      </div>
                    )}

                    {/* ── HISTÓRICO DE ALTERAÇÕES DE SITUAÇÃO ── */}
                    <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Activity size={18} style={{ color: '#013375' }} />
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                          Histórico de Alterações de Situação
                        </h4>
                      </div>

                      {historicoSituacao.length === 0 ? (
                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                          Nenhuma alteração de situação registrada até o momento.
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                                <th style={{ padding: '10px 12px' }}>Data / Hora</th>
                                <th style={{ padding: '10px 12px' }}>Mudança de Situação</th>
                                <th style={{ padding: '10px 12px' }}>Alterado Por</th>
                                <th style={{ padding: '10px 12px' }}>Motivo / Observação</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historicoSituacao.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                    {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—'}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className={`situacao-tag-premium ${(item.situacao_anterior || '').toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                      {item.situacao_anterior || '—'}
                                    </span>
                                    <span style={{ margin: '0 6px', color: '#94a3b8' }}>➔</span>
                                    <span className={`situacao-tag-premium ${(item.situacao_nova || '').toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                      {item.situacao_nova}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                                    {item.alterado_por_nome || 'Sistema'}
                                  </td>
                                  <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                    {item.motivo || '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* --- 1. DADOS CIVIS --- */}
            {activeTab === 'dados' && (
              <div className="tab-panel">
                <div className="section-card" id="print-dados-civis">
                  <div className="section-header-flex">
                    <h3 className="section-title"><User size={16} /> {t('profile.sections.civil')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('1. Dados Civis', 'print-dados-civis')}>
                        <Printer size={15} /> <span>Imprimir</span>
                      </button>
                    )}
                  </div>
                  <div className="form-grid-3">

                    {/* Data de Nascimento */}
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.birth_date')}</label>
                      <input type="date" value={civilData.data_nascimento} onChange={e => setCivilData({ ...civilData, data_nascimento: e.target.value })} disabled={!canEdit} />
                    </div>

                    {/* Nome do Pai */}
                    <div className="form-group">
                      <label>{t('profile.labels.father_name')}</label>
                      <input
                        type="text"
                        value={civilData.nome_pai || ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setCivilData({ ...civilData, nome_pai: v });
                        }}
                        disabled={!canEdit}
                        placeholder={t('profile.labels.father_name')}
                      />
                    </div>

                    {/* Nome da Mãe */}
                    <div className="form-group">
                      <label>{t('profile.labels.mother_name')}</label>
                      <input
                        type="text"
                        value={civilData.nome_mae || ''}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setCivilData({ ...civilData, nome_mae: v });
                        }}
                        disabled={!canEdit}
                        placeholder={t('profile.labels.mother_name')}
                      />
                    </div>

                    {/* Nascimento — Cidade/Estado nascimento */}
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.birth_place_city')}</label>
                      <input
                        type="text"
                        value={civilData.cidade_estado}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setCivilData({ ...civilData, cidade_estado: v });
                        }}
                        disabled={!canEdit}
                        placeholder="Ex: São Paulo, SP"
                      />
                    </div>

                    {/* País — texto */}
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.country')}</label>
                      <input
                        type="text"
                        list="paises"
                        value={civilData.pais}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setCivilData({ ...civilData, pais: v });
                        }}
                        disabled={!canEdit}
                        placeholder="Ex: Brasil"
                      />
                      <datalist id="paises">{PAISES_COMMON.map(p => <option key={p} value={p} />)}</datalist>
                    </div>

                    {/* Diocese — texto */}
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.diocese')}</label>
                      <input
                        type="text"
                        value={civilData.diocese}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setCivilData({ ...civilData, diocese: v });
                        }}
                        disabled={!canEdit}
                        placeholder="Ex: Diocese de São Paulo"
                      />
                    </div>

                    {/* RNM — até 10 dígitos */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        RG / RNM / CI / DI <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={civilData.rnm}
                        maxLength={10}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setCivilData({ ...civilData, rnm: v });
                        }}
                        disabled={!canEdit}
                        placeholder="000000000"
                      />
                    </div>

                    {/* CPF — exatamente 11 dígitos */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        CPF <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={civilData.cpf}
                        maxLength={11}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setCivilData({ ...civilData, cpf: v });
                        }}
                        disabled={!canEdit}
                        placeholder="00000000000"
                      />
                    </div>

                    {/* Título de Eleitor — exatamente 12 dígitos */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Título Eleitor <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={civilData.titulo_eleitor}
                        maxLength={12}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 12);
                          setCivilData({ ...civilData, titulo_eleitor: v });
                        }}
                        disabled={!canEdit}
                        placeholder="000000000000"
                      />
                    </div>

                    {/* CNH — exatamente 11 dígitos */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        CNH <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={civilData.cnh}
                        maxLength={11}
                        onChange={e => {
                          const v = e.target.value.replace(/\D/g, '').slice(0, 11);
                          setCivilData({ ...civilData, cnh: v });
                        }}
                        disabled={!canEdit}
                        placeholder="00000000000"
                      />
                    </div>

                    {/* Passaporte — alfanumérico, até 9 chars, letras maiúsculas */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        Passaporte <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        value={civilData.passaporte}
                        maxLength={9}
                        onChange={e => {
                          const v = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
                          setCivilData({ ...civilData, passaporte: v });
                        }}
                        disabled={!canEdit}
                        placeholder="AA000000"
                        style={{ fontFamily: 'monospace', letterSpacing: '2px' }}
                      />
                    </div>

                  </div>

                  <div className="section-header-flex" style={{ marginTop: '20px', marginBottom: '10px' }}>
                    <h4 className="wizard-divider-lite">{t('missionaries.wizard.civil.nationalities')}</h4>
                    {canEdit && (
                      <button className="btn-action-lite-text" onClick={() => setNacionalidades([...nacionalidades, ''])}>
                        <Plus size={14} /> {t('missionaries.wizard.civil.add_btn')}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {nacionalidades.map((nac, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                        <input type="text" value={nac} onChange={e => {
                          const nn = [...nacionalidades];
                          nn[idx] = e.target.value;
                          setNacionalidades(nn);
                        }} placeholder="Nacionalidade..." style={{ flex: 1 }} disabled={!canEdit} />
                        {canEdit && idx > 0 && <button onClick={() => setNacionalidades(nacionalidades.filter((_, i) => i !== idx))} className="btn-action-lite delete"><Trash2 size={16} /></button>}
                      </div>
                    ))}
                  </div>
                  {canEdit && (
                    <div className="section-actions" style={{ marginTop: '20px' }}>
                      <button className="btn-save-perfil" onClick={saveCivil} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        {t('profile.actions.save_civil')}
                      </button>
                    </div>
                  )}
                </div>



                {/* Seção de Documentos dentro da aba Dados */}
                <div className="section-card docs-section">
                  <h3 className="section-title"><FileText size={16} /> {t('profile.sections.docs')}</h3>

                  {canEdit && (
                    <div className="doc-upload-zone">
                      <div className="doc-upload-icon-area">
                        <Upload size={28} className="doc-upload-icon" />
                      </div>
                      <div className="doc-upload-fields">
                        <div className="form-group">
                          <label>{t('missionaries.wizard.docs.placeholder')}</label>
                          <input
                            type="text"
                            placeholder="Ex: RG, Passaporte, CPF..."
                            value={pendingDocDesc}
                            onChange={e => setPendingDocDesc(e.target.value)}
                          />
                        </div>
                        <input type="file" ref={fileInputRef} onChange={uploadDocument} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" />
                        <button
                          className="btn-upload-doc"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={isSaving}
                        >
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {isSaving ? 'Enviando...' : t('profile.actions.upload_btn')}
                        </button>
                      </div>
                      <p className="doc-upload-hint">PDF, JPG ou PNG · máx. 20MB</p>
                    </div>
                  )}

                  {documentos.length === 0 ? (
                    <p className="empty-msg">Nenhum documento anexado.</p>
                  ) : (
                    <div className="docs-grid">
                      {documentos.map(doc => {
                        const ext = (doc.tipo_arquivo || 'file').toUpperCase();
                        const isPdf = ext === 'PDF';
                        const isImg = ['PNG', 'JPG', 'JPEG'].includes(ext);
                        return (
                          <div key={doc.id} className="doc-card">
                            <div className={`doc-card-icon ${isPdf ? 'pdf' : isImg ? 'img' : 'file'}`}>
                              {isPdf ? <FileText size={22} /> : isImg ? <Eye size={22} /> : <FileText size={22} />}
                              <span className="doc-type-badge">{ext}</span>
                            </div>
                            <div className="doc-card-body">
                              <span className="doc-card-name" title={doc.descricao}>{doc.descricao}</span>
                              <span className="doc-card-meta">
                                {doc.arquivo_nome && <span className="doc-filename" title={doc.arquivo_nome}>{doc.arquivo_nome}</span>}
                                <span className="doc-date">· {new Date(doc.data_upload).toLocaleDateString('pt-BR')}</span>
                              </span>
                            </div>
                            <div className="doc-card-actions">
                              <a href={getFileUrl(doc.url) || '#'} target="_blank" rel="noreferrer" className="doc-btn view" title="Visualizar">
                                <Eye size={15} />
                              </a>
                              <a href={getFileUrl(doc.url) || '#'} download={doc.arquivo_nome} className="doc-btn download" title="Download">
                                <Download size={15} />
                              </a>
                              {canEdit && (
                                <button className="doc-btn delete" onClick={() => removeDocument(doc.id)} title="Excluir">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- 2. CONTATOS --- */}
            {activeTab === 'contatos' && (
              <div className="tab-panel">
                <div className="section-card" id="print-contatos">
                  <div className="section-header-flex">
                    <h3 className="section-title"><MapPin size={16} /> 2. Contatos</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('2. Contatos', 'print-contatos')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && contatos.length < 3 && (
                        <button className="btn-action-lite-text" onClick={() => setContatos([...contatos, { parentesco: '', nome: '', endereco: '', telefone: '', email: '' }])}>
                          <Plus size={16} /> <span>Adicionar Contato</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="contatos-list" style={{ marginTop: '20px' }}>
                    {contatos.length === 0 && (
                      <p style={{ opacity: 0.6, textAlign: 'center', padding: '20px' }}>Nenhum contato cadastrado. Adicione até 3 contatos.</p>
                    )}
                    {contatos.map((contato, idx) => (
                      <div key={idx} className="contato-item-premium" style={{
                        padding: '20px',
                        background: '#f8fafc',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        border: '1px solid #e2e8f0',
                        position: 'relative'
                      }}>
                        <div style={{ position: 'absolute', top: '10px', right: '10px' }}>
                          {canEdit && (
                            <button className="btn-action-lite delete" onClick={() => setContatos(contatos.filter((_, i) => i !== idx))}>
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                        <div className="form-grid-3">
                          <div className="form-group">
                            <label>Parentesco</label>
                            <select
                              value={['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) || contato.parentesco === '' ? contato.parentesco : 'Outros'}
                              onChange={e => {
                                const val = e.target.value;
                                const newC = [...contatos];
                                newC[idx].parentesco = val === 'Outros' ? 'Outros' : val;
                                setContatos(newC);
                              }}
                              disabled={!canEdit}
                              style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: 'white'
                              }}
                            >
                              <option value="">Selecione...</option>
                              <option value="Pai">Pai</option>
                              <option value="Mãe">Mãe</option>
                              <option value="Irmão(a)">Irmão(a)</option>
                              <option value="Outros">Outros</option>
                            </select>

                            {(!['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) && contato.parentesco !== '') || contato.parentesco === 'Outros' ? (
                              <input
                                type="text"
                                placeholder="Qual parentesco? (ex: Padrasto)"
                                value={contato.parentesco === 'Outros' ? '' : contato.parentesco}
                                onChange={e => {
                                  const newC = [...contatos];
                                  newC[idx].parentesco = e.target.value;
                                  setContatos(newC);
                                }}
                                disabled={!canEdit}
                                style={{ marginTop: '8px', width: '100%' }}
                              />
                            ) : null}
                          </div>
                          <div className="form-group">
                            <label>Nome</label>
                            <input
                              type="text"
                              placeholder="Nome..."
                              value={contato.nome}
                              onChange={e => {
                                const newC = [...contatos];
                                newC[idx].nome = e.target.value;
                                setContatos(newC);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="form-group">
                            <label>Telefone</label>
                            <input
                              type="text"
                              placeholder="(00) 00000-0000"
                              value={contato.telefone}
                              onChange={e => {
                                const newC = [...contatos];
                                newC[idx].telefone = e.target.value;
                                setContatos(newC);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="form-group full">
                            <label>Endereço</label>
                            <input
                              type="text"
                              placeholder="Endereço completo..."
                              value={contato.endereco}
                              onChange={e => {
                                const newC = [...contatos];
                                newC[idx].endereco = e.target.value;
                                setContatos(newC);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="form-group">
                            <label>E-mail</label>
                            <input
                              type="email"
                              placeholder="email@exemplo.com"
                              value={contato.email}
                              onChange={e => {
                                const newC = [...contatos];
                                newC[idx].email = e.target.value;
                                setContatos(newC);
                              }}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {canEdit && (
                    <div className="section-actions" style={{ marginTop: '20px' }}>
                      <button className="btn-save-perfil" onClick={saveEndereco} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar Contatos
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- ACESSO AO SISTEMA --- */}
            {activeTab === 'acesso' && (
              <div className="tab-panel">
                <div className="section-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
                    <h3 className="section-title" style={{ margin: 0 }}><ShieldCheck size={16} /> Acesso ao Sistema</h3>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <strong>Data de Cadastro:</strong> {missionario.created_at ? new Date(missionario.created_at).toLocaleString('pt-BR') : '—'}
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Nome</label>
                      <input
                        type="text"
                        value={missionario.nome}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setMissionario({ ...missionario, nome: v });
                        }}
                        disabled={!canEdit}
                        placeholder="Nome completo"
                      />
                    </div>
                    <div className="form-group">
                      <label>E-mail de Login</label>
                      <input
                        type="email"
                        value={missionario.login}
                        onChange={e => setMissionario({ ...missionario, login: e.target.value })}
                        disabled={!canEdit}
                        placeholder="email@exemplo.com"
                      />
                    </div>
                    <div className="form-group">
                      <label>Nova Senha (deixe em branco para não alterar)</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          disabled={!canEdit}
                          placeholder="••••••••"
                          style={{ width: '100%' }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}
                        >
                          {showPassword ? <Eye size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="section-actions" style={{ marginTop: '20px' }}>
                      <button className="btn-save-perfil" onClick={saveBasicInfo} disabled={isSaving}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Atualizar Acesso
                      </button>
                    </div>
                  )}

                  {/* ── HISTÓRICO DE TROCA DE PERFIL ── */}
                  <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <Activity size={18} style={{ color: '#013375' }} />
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                        Histórico de Alterações de Perfil / Cargo
                      </h4>
                    </div>

                    {historicoPerfil.length === 0 ? (
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                        Nenhuma troca de perfil/cargo registrada até o momento.
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                              <th style={{ padding: '10px 12px' }}>Data / Hora</th>
                              <th style={{ padding: '10px 12px' }}>Mudança de Perfil</th>
                              <th style={{ padding: '10px 12px' }}>Alterado Por</th>
                              <th style={{ padding: '10px 12px' }}>Motivo / Observação</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historicoPerfil.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                  {item.created_at ? new Date(item.created_at).toLocaleString('pt-BR') : '—'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                    {item.perfil_anterior || '—'}
                                  </span>
                                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>➔</span>
                                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#3730a3', fontSize: '0.78rem', fontWeight: 700 }}>
                                    {item.perfil_novo}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                                  {item.alterado_por_nome || 'Sistema'}
                                </td>
                                <td style={{ padding: '10px 12px', color: '#64748b' }}>
                                  {item.motivo || '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* --- RELIGIOSOS & ITINERÁRIO --- */}
            {activeTab === 'religiosos' && (
              <div className="tab-panel">
                <div className="section-card" id="print-dados-religiosos">
                  <div className="section-header-flex">
                    <h3 className="section-title"><BookOpen size={16} /> {t('profile.sections.religious')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('3. Dados Religiosos', 'print-dados-religiosos')}>
                        <Printer size={15} /> <span>Imprimir</span>
                      </button>
                    )}
                  </div>
                  <div className="form-grid-3">
                    <div className="form-group"><label>Batismo</label><input type="date" value={religiososData.data_batismo} onChange={e => setReligiososData({ ...religiososData, data_batismo: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group"><label>Crisma</label><input type="date" value={religiososData.data_crisma} onChange={e => setReligiososData({ ...religiososData, data_crisma: e.target.value })} disabled={!canEdit} /></div>
                  </div>

                  <div className="section-title mt-4">
                    <h3>Anexar Certidão</h3>
                  </div>
                  <div className="form-grid-1">
                    <div className="form-group full">
                      <label>Descrição do documento</label>
                      <input
                        type="text"
                        placeholder="Ex: Certidão de Batismo"
                        value={pendingReligiousDocDesc}
                        onChange={e => setPendingReligiousDocDesc(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="form-group full">
                      <label>Anexar arquivo</label>
                      <div className="file-input-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="file" ref={religiousFileInputRef} onChange={uploadReligiousDocument} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" disabled={!canEdit} />
                        <button type="button" className="btn-upload-doc" onClick={() => religiousFileInputRef.current?.click()} disabled={!canEdit || isSaving}>
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {isSaving ? 'Enviando...' : 'Selecionar arquivo'}
                        </button>
                        <span style={{ color: '#555', fontSize: '0.95rem' }}>PDF/JPG/PNG</span>
                      </div>
                    </div>
                  </div>
                  {canEdit && (
                    <div className="section-actions" style={{ marginTop: '20px' }}>
                      <button className="btn-save-perfil" onClick={saveReligiosos} disabled={isSaving}>
                        {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={18} />}
                        {t('profile.actions.save_religious')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hidden File Input for Itinerary Documents */}
            <input type="file" ref={itinFileInputRef} onChange={e => { if (activeEtapaRef.current) handleItinDocUpload(e, activeEtapaRef.current); }} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" />

            {/* --- 4.1 SEMINÁRIO --- */}
            {activeTab === 'itin_4.1' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-41">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> 4.1 Seminário</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('4.1 Seminário', 'print-itinerario-41')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  {renderItinSubItems([
                    { label: '4.1.1 Seminário Menor', etapaKey: '4.1.1' },
                    { label: '4.1.2 Propedêutico', etapaKey: '4.1.2' },
                    { label: '4.1.3 Filosofia', etapaKey: '4.1.3' },
                    { label: '4.1.4 Postulado', etapaKey: '4.1.4' },
                    { label: '4.1.5 Noviciado', etapaKey: '4.1.5' },
                    { label: '4.1.6 Teologia', etapaKey: '4.1.6' },
                    { label: '4.1.7 Tirocínio', etapaKey: '4.1.7' },
                  ])}
                </div>
              </div>
            )}

            {/* --- 4.2 VIDA RELIGIOSA --- */}
            {activeTab === 'itin_4.2' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-42">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> 4.2 Vida Religiosa</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('4.2 Vida Religiosa', 'print-itinerario-42')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.2.1 Primeira Profissão</h4>
                  {renderItinSubItems([
                    { label: '4.2.1.1 Relatório do Mestre', etapaKey: '4.2.1.1' },
                    { label: '4.2.1.2 Pedido do noviço', etapaKey: '4.2.1.2' },
                    { label: '4.2.1.3 Declaração de cessão da administração de bens', etapaKey: '4.2.1.3' },
                    { label: '4.2.1.4 Admissão', etapaKey: '4.2.1.4' },
                    { label: '4.2.1.5 Fórmula manuscrita', etapaKey: '4.2.1.5' },
                    { label: '4.2.1.6 Delegação para receber os votos', etapaKey: '4.2.1.6' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.2.2 Renovação dos Votos</h4>
                  {renderItinSubItems([
                    { label: '4.2.2.1 Relatório do Formador', etapaKey: '4.2.2.1' },
                    { label: '4.2.2.2 Pedido do religioso', etapaKey: '4.2.2.2' },
                    { label: '4.2.2.3 Admissão Fórmula manuscrita', etapaKey: '4.2.2.3' },
                    { label: '4.2.2.4 Delegação para receber os votos', etapaKey: '4.2.2.4' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.2.3 Profissão Perpétua</h4>
                  {renderItinSubItems([
                    { label: '4.2.3.1 Relatório do Formador', etapaKey: '4.2.3.1' },
                    { label: '4.2.3.2 Pedido do religioso', etapaKey: '4.2.3.2' },
                    { label: '4.2.3.3 Declaração de nada exigir', etapaKey: '4.2.3.3' },
                    { label: '4.2.3.4 Testamento particular', etapaKey: '4.2.3.4' },
                    { label: '4.2.3.5 Declaração Nada Obsta', etapaKey: '4.2.3.5' },
                    { label: '4.2.3.6 Admissão', etapaKey: '4.2.3.6' },
                    { label: '4.2.3.7 Fórmula manuscrita', etapaKey: '4.2.3.7' },
                    { label: '4.2.3.8 Delegação para receber os votos', etapaKey: '4.2.3.8' },
                    { label: '4.2.3.9 Notificação à paróquia de batismo', etapaKey: '4.2.3.9' },
                  ])}
                </div>
              </div>
            )}

            {/* --- 4.3 MINISTÉRIOS --- */}
            {activeTab === 'itin_4.3' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-43">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> 4.3 Ministérios</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('4.3 Ministérios', 'print-itinerario-43')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.3.1 Leitorado</h4>
                  {renderItinSubItems([
                    { label: '4.3.1.1 Apresentação', etapaKey: '4.3.1.1' },
                    { label: '4.3.1.2 Pedido', etapaKey: '4.3.1.2' },
                    { label: '4.3.1.3 Admissão', etapaKey: '4.3.1.3' },
                    { label: '4.3.1.4 Certificado', etapaKey: '4.3.1.4' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.3.2 Acolitado</h4>
                  {renderItinSubItems([
                    { label: '4.3.2.1 Apresentação', etapaKey: '4.3.2.1' },
                    { label: '4.3.2.2 Pedido', etapaKey: '4.3.2.2' },
                    { label: '4.3.2.3 Admissão', etapaKey: '4.3.2.3' },
                    { label: '4.3.2.4 Certificado', etapaKey: '4.3.2.4' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.3.3 Diaconato</h4>
                  {renderItinSubItems([
                    { label: '4.3.3.1 Relatório do Formador', etapaKey: '4.3.3.1' },
                    { label: '4.3.3.2 Pedido do religioso', etapaKey: '4.3.3.2' },
                    { label: '4.3.3.3 Declaração dos estudos teológicos', etapaKey: '4.3.3.3' },
                    { label: '4.3.3.4 Declaração Nada Obsta', etapaKey: '4.3.3.4' },
                    { label: '4.3.3.5 Admissão', etapaKey: '4.3.3.5' },
                    { label: '4.3.3.6 Cartas dimissórias', etapaKey: '4.3.3.6' },
                    { label: '4.3.3.7 Ata de ordenação', etapaKey: '4.3.3.7' },
                    { label: '4.3.3.8 Notificação à paróquia de batismo', etapaKey: '4.3.3.8' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.3.4 Presbiterado</h4>
                  {renderItinSubItems([
                    { label: '4.3.4.1 Relatório do Formador', etapaKey: '4.3.4.1' },
                    { label: '4.3.4.2 Pedido do diácono', etapaKey: '4.3.4.2' },
                    { label: '4.3.4.3 Declaração dos estudos teológicos', etapaKey: '4.3.4.3' },
                    { label: '4.3.4.4 Declaração Nada Obsta', etapaKey: '4.3.4.4' },
                    { label: '4.3.4.5 Admissão', etapaKey: '4.3.4.5' },
                    { label: '4.3.4.6 Cartas dimissórias', etapaKey: '4.3.4.6' },
                    { label: '4.3.4.7 Ata de ordenação', etapaKey: '4.3.4.7' },
                    { label: '4.3.4.8 Notificação à paróquia de batismo', etapaKey: '4.3.4.8' },
                  ])}

                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem' }}>4.3.5 Primeira destinação missionária</h4>
                  {renderItinSubItems([
                    { label: '4.3.5.1 Carta do religioso', etapaKey: '4.3.5.1' },
                    { label: '4.3.5.2 Relatório', etapaKey: '4.3.5.2' },
                    { label: '4.3.5.3 Parecer do Superior Regional', etapaKey: '4.3.5.3' },
                  ])}
                </div>
              </div>
            )}

            {/* --- 4.4 DESTINAÇÃO --- */}
            {activeTab === 'itin_4.4' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-44">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> 4.4 Destinação dada pela Direção</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('4.4 Destinação dada pela Direção', 'print-itinerario-44')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  {renderItinSubItems([
                    { label: '4.4 Destinação dada pela Direção', etapaKey: '4.4' },
                  ])}
                </div>
              </div>
            )}



            {/* --- 5. FORMAÇÃO ACADÊMICA --- */}
            {activeTab === 'formacao_academica' && (
              <div className="tab-panel">
                <div className="section-card" id="print-formacao">
                  <div className="section-header-flex">
                    <h3 className="section-title"><GraduationCap size={16} /> 5. Formação Acadêmica</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('5. Formação Acadêmica', 'print-formacao')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => { setEditingFormacao(null); setTempForm({}); setShowAddForm('formacao'); }}>
                          <Plus size={14} /> <span>Adicionar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="generic-list">
                    {[...formacaoAcademica]
                      .sort((a, b) => {
                        const getYear = (str: string) => {
                          const m = (str || '').match(/\d{4}/);
                          return m ? parseInt(m[0], 10) : 0;
                        };
                        const yearDiff = getYear(a.periodo || '') - getYear(b.periodo || '');
                        if (yearDiff !== 0) return yearDiff;
                        return (a.id || 0) - (b.id || 0);
                      })
                      .map(f => (
                        <div key={f.id} className="list-item-card-premium">
                          <div className="item-icon-container icon-formacao">
                            <GraduationCap size={20} />
                          </div>
                          <div className="item-main-content">
                            <strong>{f.curso}</strong>
                            <div className="item-subtitle">{f.faculdade} • {f.periodo}</div>
                            {f.observacoes && (
                              <div className="item-description" style={{ marginTop: '6px', fontSize: '0.85rem', color: '#475569' }}>
                                <strong>Obs:</strong> {f.observacoes}
                              </div>
                            )}
                            {f.doc_path && (
                              <div style={{ marginTop: '8px' }}>
                                <a
                                  href={getFileUrl(f.doc_path) || '#'}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn-itin-doc success"
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 600 }}
                                >
                                  <FileText size={14} /> Visualizar Comprovante / Anexo
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                            {f.doc_path && (
                              <a href={getFileUrl(f.doc_path) || '#'} target="_blank" rel="noreferrer" className="btn-action-lite" title="Visualizar Documento">
                                <Eye size={14} />
                              </a>
                            )}
                            {canEdit && (
                              <>
                                <button
                                  className="btn-action-lite"
                                  onClick={() => {
                                    setEditingFormacao(f.id);
                                    setTempForm({ ...f });
                                    setShowAddForm('formacao');
                                  }}
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button className="btn-action-lite delete" onClick={() => handleGenericDelete('formacao-academica', f.id)} title="Excluir">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {formacaoAcademica.length === 0 && <p className="empty-msg">Nenhuma formação acadêmica registrada.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 6. ATIVIDADE MISSIONÁRIA --- */}
            {activeTab === 'atividade_missionaria' && (
              <div className="tab-panel">
                <div className="section-card" id="print-atividade">
                  <div className="section-header-flex">
                    <h3 className="section-title"><MapPin size={16} /> 6. Atividade Missionária</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('6. Atividade Missionária', 'print-atividade')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => { setEditingAtividade(null); setTempForm({}); setShowAddForm('atividade'); }}>
                          <Plus size={14} /> <span>Adicionar</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="generic-list">
                    {[...atividadesMissionarias]
                      .sort((a, b) => {
                        const diff = extractSortDate(a.periodo) - extractSortDate(b.periodo);
                        if (diff !== 0) return diff;
                        return (a.id || 0) - (b.id || 0);
                      })
                      .map(a => (
                        <div key={a.id} className="list-item-card-premium">
                          <div className="item-icon-container icon-missao">
                            <MapPin size={20} />
                          </div>
                          <div className="item-main-content">
                            <strong>{a.lugar}</strong>
                            <div className="item-subtitle">{a.periodo}</div>
                            {a.funcao_atividade && (
                              <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {parseFuncoesAtividade(a.funcao_atividade).map((fun: string, fIdx: number) => (
                                  <span key={fIdx} style={{ background: '#eef2ff', color: '#1e3a8a', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600 }}>
                                    {fun.trim()}
                                  </span>
                                ))}
                              </div>
                            )}
                            {a.missao && <div className="item-description" style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{a.missao}</div>}
                          </div>
                          <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                            {canEdit && (
                              <>
                                <button
                                  className="btn-action-lite"
                                  onClick={() => {
                                    setEditingAtividade(a.id);
                                    const parsed = parseFuncoesAtividade(a.funcao_atividade);
                                    const standardOptions = [
                                      'Superior Local',
                                      'Pároco',
                                      'Diretor (rádios, escolas, fundações, escritórios)',
                                      'Ecônomo Local',
                                      'Vigário',
                                      'Reitor (seminários)',
                                    ];
                                    const standardFuns = parsed.filter(f => standardOptions.includes(f));
                                    const customFuns = parsed.filter(f => !standardOptions.includes(f)).join(', ');
                                    setTempForm({
                                      ...a,
                                      funcoes: standardFuns,
                                      outra_funcao: customFuns
                                    });
                                    setShowAddForm('atividade');
                                  }}
                                  title="Editar"
                                >
                                  <Edit size={14} />
                                </button>
                                <button className="btn-action-lite delete" onClick={() => handleGenericDelete('atividade-missionaria', a.id)} title="Excluir">
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {atividadesMissionarias.length === 0 && <p className="empty-msg">Nenhuma atividade missionária registrada.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 7. SAÚDE --- */}
            {activeTab === 'saude_individual' && (
              <div className="tab-panel">
                <div className="section-card" id="print-saude">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> 7. Saúde</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('7. Saúde', 'print-saude')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => setShowAddForm('saude')}>
                          <Plus size={14} /> <span>Adicionar Registro</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="generic-list">
                    {saudeRecords.map(s => (
                      <div key={s.id} className="list-item-card-premium">
                        <div className="item-icon-container icon-saude">
                          <Activity size={20} />
                        </div>
                        <div className="item-main-content">
                          <strong>{s.seguradora || 'Seguradora não informada'}</strong>
                          <div className="item-subtitle">CNS: {s.sus_card || 'N/A'} • Carteira: {s.numero_carteira || 'N/A'}</div>
                        </div>
                        <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                          {s.doc_path && (
                            <a
                              href={getFileUrl(s.doc_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-action-lite"
                              title="Visualizar Carteirinha / Documento"
                              style={{ color: '#013375', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <FileText size={14} />
                            </a>
                          )}
                          {canEdit && (
                            <>
                              <button
                                className="btn-action-lite"
                                onClick={() => {
                                  setEditingSaude(s.id);
                                  setTempForm(s);
                                  setShowAddForm('saude');
                                }}
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button className="btn-action-lite delete" onClick={() => handleGenericDelete('saude', s.id)} title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {saudeRecords.length === 0 && <p className="empty-msg">Nenhum registro de saúde cadastrado.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 8. PREVIDENCIÁRIO / IR --- */}
            {activeTab === 'previdenciario' && (
              <div className="tab-panel">
                <div className="section-card" id="print-previdenciario">
                  <div className="section-header-flex">
                    <h3 className="section-title"><ShieldCheck size={16} /> 8. Previdenciário / IR</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('8. Previdenciário / IR', 'print-previdenciario')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  <div className="form-group" style={{ maxWidth: '400px', marginTop: '15px' }}>
                    <label>NIT (Número de Identificação do Trabalhador)</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="text" value={nit} onChange={e => setNit(e.target.value)} disabled={!canEdit} placeholder="Digite o NIT..." />
                      {canEdit && <button className="btn-save-perfil" onClick={saveCivil} style={{ padding: '0 15px' }} title="Salvar NIT"><Save size={16} /></button>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* --- 9. CONTAS BANCÁRIAS --- */}
            {activeTab === 'contas_bancarias' && (
              <div className="tab-panel">
                <div className="section-card" id="print-banco">
                  <div className="section-header-flex">
                    <h3 className="section-title"><DollarSign size={16} /> 9. Contas Bancárias</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('9. Contas Bancárias', 'print-banco')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && <button className="btn-action-lite-text" onClick={() => setShowAddForm('banco')}><Plus size={14} /> <span>Adicionar</span></button>}
                    </div>
                  </div>
                  <div className="generic-list">
                    {contasBancarias.map(b => (
                      <div key={b.id} className="list-item-card-premium">
                        <div className="item-icon-container icon-banco">
                          <DollarSign size={20} />
                        </div>
                        <div className="item-main-content">
                          <strong>{b.tipo_conta} • {b.titularidade}</strong>
                          <div className="item-subtitle">Ag: {b.agencia} • Conta: {b.numero}</div>
                        </div>
                        <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                          {canEdit && (
                            <>
                              <button
                                className="btn-action-lite"
                                onClick={() => {
                                  setEditingBanco(b.id);
                                  setTempForm(b);
                                  setShowAddForm('banco');
                                }}
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button className="btn-action-lite delete" onClick={() => handleGenericDelete('contas-bancarias', b.id)} title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {contasBancarias.length === 0 && <p className="empty-msg">Nenhuma conta bancária registrada.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 10. OBRAS REALIZADAS --- */}
            {activeTab === 'formacao_missao' && (
              <div className="tab-panel">
                <div className="section-card" id="print-obras">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Star size={16} /> 10. Obras Realizadas</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('10. Obras Realizadas', 'print-obras')}>
                          <Printer size={15} /> <span>Imprimir</span>
                        </button>
                      )}
                      {canEdit && <button className="btn-action-lite-text" onClick={() => { setEditingObra(null); setTempForm({}); setShowAddForm('obras'); }}><Plus size={14} /> <span>Adicionar</span></button>}
                    </div>
                  </div>
                  <div className="generic-list">
                    {obrasRealizadas.map(o => (
                      <div key={o.id} className="list-item-card-premium">
                        <div className="item-icon-container icon-obra">
                          <Star size={20} />
                        </div>
                        <div className="item-main-content">
                          <strong>{o.lugar}</strong>
                          <div className="item-subtitle">{o.periodo}</div>
                          {o.obra && <div className="item-description" style={{ whiteSpace: 'pre-wrap' }}>{o.obra}</div>}
                        </div>
                        <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                          {canEdit && (
                            <>
                              <button
                                className="btn-action-lite"
                                onClick={() => {
                                  setEditingObra(o.id);
                                  setTempForm(o);
                                  setShowAddForm('obras');
                                }}
                                title="Editar"
                              >
                                <Edit size={14} />
                              </button>
                              <button className="btn-action-lite delete" onClick={() => handleGenericDelete('obras-realizadas', o.id)} title="Excluir">
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {obrasRealizadas.length === 0 && <p className="empty-msg">Nenhuma obra registrada.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 11. OBSERVAÇÕES --- */}
            {activeTab === 'obs' && (
              <div className="tab-panel">
                <div className="section-card" id="print-obs">
                  <div className="section-header-flex">
                    <h3 className="section-title"><FileText size={16} /> 11. Observações</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection('11. Observações', 'print-obs')}>
                          <Printer size={15} /> Imprimir
                        </button>
                      )}
                      {canEdit && <button className="btn-save-perfil" onClick={() => setShowAddForm('obs')}><Plus size={16} /> Nova Obs</button>}
                    </div>
                  </div>
                  <div className="obs-list" style={{ marginTop: '20px' }}>
                    {observacoesGerais.map(o => (
                      <div key={o.id} className="obs-entry-card">
                        <div className="obs-date">{new Date(o.created_at).toLocaleString()}</div>
                        <div className="obs-text">{o.texto}</div>
                        {canEdit && (
                          <div className="obs-actions">
                            <button className="btn-action-lite delete" onClick={() => handleGenericDelete('observacoes-gerais', o.id)}><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {observacoesGerais.length === 0 && <p className="empty-msg">Nenhuma observação registrada.</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 12. CURRICULUM VITAE --- */}
            {activeTab === 'quadro_pessoal' && (
              <div className="tab-panel">
                <div className="section-card" id="print-quadro">
                  <div className="section-header-flex">
                    <h3 className="section-title"><FileText size={18} /> 12. Curriculum Vitae</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {quadroPessoal?.cv_path && (
                        <>
                          <a
                            href={getFileUrl(quadroPessoal.cv_path) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-action-lite-text"
                            style={{ textDecoration: 'none' }}
                            title="Abrir arquivo em nova aba"
                          >
                            <Eye size={15} /> Visualizar Arquivo
                          </a>
                          <button
                            className="btn-action-lite-text"
                            onClick={() => handlePrintCvFile(quadroPessoal.cv_path || '')}
                            title="Imprimir arquivo anexado"
                          >
                            <Printer size={15} /> Imprimir CV
                          </button>
                        </>
                      )}
                      {canEdit && (
                        <button
                          className="btn-action-lite-text"
                          onClick={() => cvFileInputRef.current?.click()}
                          disabled={cvUploadLoading}
                        >
                          {cvUploadLoading ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
                          {quadroPessoal?.cv_path ? 'Substituir CV' : 'Anexar CV'}
                        </button>
                      )}
                    </div>
                  </div>

                  <input
                    ref={cvFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    onChange={handleCvUploadDirect}
                  />

                  {quadroPessoal?.cv_path ? (
                    <div className="cv-container-premium">
                      <div className="cv-file-header-card">
                        <div className="cv-icon-box">
                          <FileText size={30} />
                        </div>
                        <div className="cv-file-info">
                          <h4>Curriculum Vitae do Missionário</h4>
                          <p className="cv-filename">
                            {quadroPessoal.cv_path.split('/').pop() || 'Curriculum_Vitae.pdf'}
                          </p>
                          <div className="cv-badges">
                            <span className="cv-status-badge">✓ Arquivo Anexado</span>
                            <span className="cv-type-badge">
                              {(quadroPessoal.cv_path.split('.').pop() || 'PDF').toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="cv-actions-group">
                          <a
                            href={getFileUrl(quadroPessoal.cv_path) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="cv-btn-view"
                            title="Abrir em nova aba"
                          >
                            <Eye size={15} /> Visualizar
                          </a>
                          <button
                            className="cv-btn-print"
                            onClick={() => handlePrintCvFile(quadroPessoal.cv_path || '')}
                            title="Imprimir documento"
                          >
                            <Printer size={15} /> Imprimir
                          </button>
                          {canEdit && (
                            <>
                              <button
                                className="cv-btn-replace"
                                onClick={() => cvFileInputRef.current?.click()}
                                title="Substituir por outro arquivo"
                              >
                                <Upload size={15} /> Substituir
                              </button>
                              <button
                                className="cv-btn-delete"
                                onClick={handleDeleteCv}
                                title="Excluir arquivo"
                              >
                                <Trash2 size={15} /> Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Embedded Visualizer */}
                      <div className="cv-preview-frame-container">
                        {quadroPessoal.cv_path.toLowerCase().endsWith('.pdf') ? (
                          <iframe
                            src={`${getFileUrl(quadroPessoal.cv_path) || ''}#toolbar=1`}
                            title="Visualização do Curriculum Vitae"
                            className="cv-iframe-preview"
                          />
                        ) : /\.(jpe?g|png|webp|gif)$/i.test(quadroPessoal.cv_path) ? (
                          <div className="cv-image-preview-wrapper">
                            <img
                              src={getFileUrl(quadroPessoal.cv_path) || ''}
                              alt="Curriculum Vitae"
                              className="cv-image-preview"
                            />
                          </div>
                        ) : (
                          <div className="cv-doc-preview-placeholder">
                            <FileText size={48} />
                            <p>Documento anexado no formato <strong>{quadroPessoal.cv_path.split('.').pop()?.toUpperCase()}</strong>.</p>
                            <a
                              href={getFileUrl(quadroPessoal.cv_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="cv-btn-view-large"
                            >
                              <Eye size={18} /> Abrir e Visualizar Arquivo
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="cv-empty-upload-zone" 
                      onClick={() => canEdit && cvFileInputRef.current?.click()}
                    >
                      <div className="cv-upload-illustration">
                        <Upload size={36} />
                      </div>
                      <h4>Nenhum Curriculum Vitae Anexado</h4>
                      <p>
                        {canEdit 
                          ? 'Clique aqui para anexar o arquivo do Curriculum Vitae (PDF, Imagens ou Documentos).'
                          : 'Nenhum arquivo de currículo foi disponibilizado para este missionário.'}
                      </p>
                      {canEdit && (
                        <button
                          type="button"
                          className="btn-upload-cv-cta"
                          onClick={(e) => {
                            e.stopPropagation();
                            cvFileInputRef.current?.click();
                          }}
                        >
                          <Plus size={16} /> Anexar Arquivo do CV
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- CASAS (PRESENÇA MISSIONÁRIA) --- */}
            {activeTab === 'casas' && (
              <div className="tab-panel">
                {canEdit && (
                  <div className="section-card">
                    <h3 className="section-title"><Plus size={16} /> Presença Missionária</h3>
                    <div className="form-grid-3">
                      <div className="form-group">
                        <label>{t('missionaries.wizard.houses.select_house')}</label>
                        <select value={novaVinculacao.casa_id} onChange={e => setNovaVinculacao(p => ({ ...p, casa_id: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {casasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={(novaVinculacao as any).tipo || ''} onChange={e => setNovaVinculacao(p => ({ ...p, tipo: e.target.value }))}>
                          <option value="">Selecione...</option>
                          <option value="CI">Casas de Idosos – CI</option>
                          <option value="CR">Casas Religiosas – CR</option>
                          <option value="M">Obras – M</option>
                          <option value="P">Paróquia – P</option>
                          <option value="PV">Pastoral Vocacional - PV</option>
                          <option value="CS">Seminário - CS</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>PM</label>
                        <input type="text" value={(novaVinculacao as any).pm || ''} onChange={e => setNovaVinculacao(p => ({ ...p, pm: e.target.value }))} placeholder="Ex: CR 13" />
                      </div>
                      <div className="form-group">
                        <label>País</label>
                        <input type="text" list="paises-list" value={(novaVinculacao as any).pais || 'Brasil'} onChange={e => setNovaVinculacao(p => ({ ...p, pais: e.target.value }))} placeholder="Selecione ou digite..." />
                        <datalist id="paises-list">
                          {PAISES_COMMON.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      <div className="form-group"><label>{t('missionaries.wizard.houses.start_date')}</label><input type="date" value={novaVinculacao.data_inicio} onChange={e => setNovaVinculacao(p => ({ ...p, data_inicio: e.target.value }))} /></div>
                      <div className="form-group"><label>Data de Saída (opcional)</label><input type="date" value={novaVinculacao.data_fim} onChange={e => setNovaVinculacao(p => ({ ...p, data_fim: e.target.value }))} /></div>
                    </div>
                    <button className="btn-save-perfil" onClick={addCasa} style={{ marginTop: '15px' }}><Plus size={16} /> {t('profile.actions.bind_btn')}</button>
                  </div>
                )}

                <div className="section-card" id="print-casas">
                  <div className="section-header-flex">
                    <h3 className="section-title"><HomeIcon size={16} /> Histórico de Presença</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection('Histórico de Presença Missionária', 'print-casas')}>
                        <Printer size={15} /> Imprimir
                      </button>
                    )}
                  </div>
                  <div className="casas-list">
                    {/* EXIBIR TODAS AS CASAS DO HISTÓRICO SEM O FILTRO RESTRITIVO DE FUNÇÃO */}
                    {casasHistorico.map(c => (
                      <div key={c.id} className={`casa-item ${!c.data_fim ? 'casa-ativa' : ''}`}>
                        <div className="casa-info">
                          <span className="casa-nome">{c.casa_nome}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                            {c.is_superior && <span className="superior-badge"><Star size={11} /> Superior</span>}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '6px', flexWrap: 'wrap' }}>
                              {Array.isArray(c.funcao) && c.funcao.length > 0 ? (
                                c.funcao.map((f, idx) => (
                                  <span key={idx} className="role-badge" style={{ background: '#eef2ff', color: '#1e3a8a', padding: '4px 8px', borderRadius: '8px', fontSize: '12px' }}>{f}</span>
                                ))
                              ) : null}
                            </div>
                            <span className="duracao-pill" style={{ background: '#f0f4f8', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>⏱ {calcDuracao(c.data_inicio, c.data_fim)}</span>
                          </div>
                          <span className="casa-periodo" style={{ marginTop: '4px', display: 'block', fontSize: '12px', color: '#666' }}>
                            {formatDateLocal(c.data_inicio)} → {c.data_fim ? formatDateLocal(c.data_fim) : 'Atual'}
                          </span>
                        </div>
                        {canEdit && <button className="btn-action-lite delete" onClick={() => removeCasa(c.id)}><Trash2 size={16} /></button>}
                      </div>
                    ))}
                    {casasHistorico.length === 0 && <p className="empty-msg">Nenhuma casa vinculada.</p>}
                  </div>
                </div>
              </div>
            )}


            {/* --- PERMISSÕES --- */}
            {activeTab === 'permissoes' && (
              <div className="tab-panel">
                <div className="section-card">
                  <h3 className="section-title"><ShieldCheck size={16} /> Permissões de Visualização</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
                    Abaixo estão as seções do cadastro que este missionário tem permissão para visualizar no seu próprio perfil.
                  </p>

                  <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
                      {PERMISSIONS_LIST.map(perm => {
                        const isGranted = !!missionario.permissoes?.[perm.id];
                        return (
                          <div key={perm.id} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            background: 'white',
                            borderRadius: '8px',
                            border: `1px solid ${isGranted ? '#10b981' : '#e2e8f0'}`,
                            opacity: isGranted ? 1 : 0.6
                          }}>
                            {isGranted ? (
                              <CheckCircle size={18} style={{ color: '#10b981' }} />
                            ) : (
                              <Lock size={18} style={{ color: '#94a3b8' }} />
                            )}
                            <span style={{
                              fontSize: '0.85rem',
                              fontWeight: isGranted ? 600 : 400,
                              color: isGranted ? '#0f172a' : '#64748b'
                            }}>
                              {perm.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(isAdminGeral || canEdit) && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#eff6ff', borderRadius: '8px', color: '#1e40af', fontSize: '0.85rem' }}>
                      <strong>Nota de Administrador:</strong> Você pode alterar estas permissões na tela de <a href="#/administradores" style={{ color: '#013375', fontWeight: 700 }}>Gestão de Acessos</a> ou editando o cadastro do missionário.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- MODAL CONFIRMAÇÃO SITUAÇÃO --- */}
            {showSituacaoConfirmModal && (
              <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: '520px', width: '90%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#fef3c7', color: '#b45309', padding: '10px', borderRadius: '10px' }}>
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>Confirmar Alteração de Situação</h3>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>Registro de auditoria permanente</p>
                    </div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.88rem', color: '#92400e' }}>
                    <strong>⚠️ Atenção:</strong> Esta alteração será gravada permanentemente no histórico deste perfil, registrando seu usuário e data/hora.
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Situação Anterior</div>
                      <span className={`situacao-tag-premium ${(originalSituacao || 'ativo').toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                        {originalSituacao || 'Ativo'}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>➔</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Nova Situação</div>
                      <span className={`situacao-tag-premium ${(missionario.situacao || 'ativo').toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                        {missionario.situacao}
                      </span>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px', display: 'block' }}>
                      Motivo / Observação da Mudança (Opcional):
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Ex: Falecimento confirmado, decreto de transferência, laicização..."
                      value={motivoSituacao}
                      onChange={e => setMotivoSituacao(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setMissionario({ ...missionario, situacao: originalSituacao });
                        setShowSituacaoConfirmModal(false);
                      }}
                      disabled={isSaving}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="btn-save-perfil"
                      onClick={handleConfirmSituacaoSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      Confirmar e Salvar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- MODAL --- */}
            {showAddForm && (
              <div className="modal-overlay">
                <div className="modal-content" style={{ maxWidth: '600px', width: '90%' }}>
                  <h3>
                    {editingFormacao || editingAtividade || editingSaude || editingBanco || editingObra ? 'Editar ' : 'Adicionar '}
                    {showAddForm === 'formacao' ? 'Formação Acadêmica' : showAddForm === 'atividade' ? 'Atividade Missionária' : showAddForm === 'obras' ? 'Obras Realizadas' : showAddForm === 'saude' ? 'Registro de Saúde' : showAddForm === 'banco' ? 'Conta Bancária' : showAddForm === 'quadro' ? 'Curriculum Vitae' : 'Observação'}
                  </h3>

                  <div className="form-grid-1" style={{ gap: '15px', marginTop: '15px' }}>
                    {showAddForm === 'formacao' && (
                      <>
                        <div className="form-group">
                          <label>Curso *</label>
                          <input
                            type="text"
                            placeholder="Ex: Teologia, Filosofia, História..."
                            value={tempForm.curso || ''}
                            onChange={e => setTempForm({ ...tempForm, curso: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Instituição / Faculdade</label>
                          <input
                            type="text"
                            placeholder="Ex: PUC, USP..."
                            value={tempForm.faculdade || ''}
                            onChange={e => setTempForm({ ...tempForm, faculdade: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Data / Período de Formação</label>
                          <input
                            type="text"
                            placeholder="Ex: 2018-2022 ou 2022"
                            value={tempForm.periodo || ''}
                            onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Observações</label>
                          <textarea
                            rows={3}
                            placeholder="Observações adicionais..."
                            value={tempForm.observacoes || ''}
                            onChange={e => setTempForm({ ...tempForm, observacoes: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Anexar Documento / Imagem (Certificado, Diploma, Declaração)</label>
                          {tempForm.doc_path ? (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: '#013375' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    Anexo Carregado
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <a
                                    href={getFileUrl(tempForm.doc_path) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <Eye size={14} /> Visualizar
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setTempForm({ ...tempForm, doc_path: undefined })}
                                    style={{ fontSize: '0.85rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Remover anexo para reenviar"
                                  >
                                    <Trash2 size={14} /> Excluir Anexo
                                  </button>
                                </div>
                              </div>
                              {/\.(jpe?g|png|webp)$/i.test(tempForm.doc_path) && (
                                <div style={{ marginTop: '10px' }}>
                                  <img
                                    src={getFileUrl(tempForm.doc_path) || ''}
                                    alt="Preview"
                                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="file-input-wrapper" style={{ marginTop: '6px' }}>
                              <input
                                type="file"
                                onChange={e => uploadGenericDoc(e, 'formacao-academica')}
                                accept=".pdf,.jpg,.jpeg,.png"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {showAddForm === 'atividade' && (
                      <>
                        <div className="form-group">
                          <label>Lugar / Local da Missão *</label>
                          <input
                            type="text"
                            placeholder="Ex: Paróquia São José - São Paulo, SP"
                            value={tempForm.lugar || ''}
                            onChange={e => setTempForm({ ...tempForm, lugar: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>Período</label>
                          <input
                            type="text"
                            placeholder="Ex: 2020-2024 ou 2024"
                            value={tempForm.periodo || ''}
                            onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })}
                          />
                        </div>

                        {/* Função da Atividade (Checkboxes movidos para cá) */}
                        <div className="form-group">
                          <label style={{ fontWeight: 700, color: '#013375', marginBottom: '8px', display: 'block' }}>
                            Função da Atividade
                          </label>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            {[
                              'Superior Local',
                              'Pároco',
                              'Diretor (rádios, escolas, fundações, escritórios)',
                              'Ecônomo Local',
                              'Vigário',
                              'Reitor (seminários)',
                            ].map(r => {
                              const currentFuns: string[] = Array.isArray(tempForm.funcoes) ? tempForm.funcoes : [];
                              const isChecked = currentFuns.includes(r);
                              return (
                                <label key={r} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={e => {
                                      let updated = [...currentFuns];
                                      if (e.target.checked) {
                                        if (!updated.includes(r)) updated.push(r);
                                      } else {
                                        updated = updated.filter(item => item !== r);
                                      }
                                      setTempForm({ ...tempForm, funcoes: updated });
                                    }}
                                  />
                                  {r}
                                </label>
                              );
                            })}
                          </div>

                          {/* Opção Outros */}
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>Outras Funções (preenchimento livre)</label>
                            <input
                              type="text"
                              placeholder="Digite outra função se houver..."
                              value={tempForm.outra_funcao || ''}
                              onChange={e => setTempForm({ ...tempForm, outra_funcao: e.target.value })}
                              style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>Descrição da Missão / Atividades</label>
                          <textarea
                            rows={3}
                            placeholder="Descreva a missão realizada..."
                            value={tempForm.missao || ''}
                            onChange={e => setTempForm({ ...tempForm, missao: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {showAddForm === 'obras' && (
                      <>
                        <div className="form-group"><label>Lugar</label><input type="text" value={tempForm.lugar || ''} onChange={e => setTempForm({ ...tempForm, lugar: e.target.value })} /></div>
                        <div className="form-group"><label>Período</label><input type="text" value={tempForm.periodo || ''} onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })} /></div>
                        <div className="form-group"><label>Obra Realizada</label><textarea rows={3} value={tempForm.obra || ''} onChange={e => setTempForm({ ...tempForm, obra: e.target.value })} /></div>
                      </>
                    )}
                    {showAddForm === 'saude' && (
                      <>
                        <div className="form-group"><label>CNS (Cartão SUS)</label><input type="text" value={tempForm.sus_card || ''} onChange={e => setTempForm({ ...tempForm, sus_card: e.target.value })} /></div>
                        <div className="form-group"><label>Seguradora</label><input type="text" value={tempForm.seguradora || ''} onChange={e => setTempForm({ ...tempForm, seguradora: e.target.value })} /></div>
                        <div className="form-group"><label>Nº Carteira</label><input type="text" value={tempForm.numero_carteira || ''} onChange={e => setTempForm({ ...tempForm, numero_carteira: e.target.value })} /></div>
                        <div className="form-group">
                          <label>Anexar Carteirinha / Documento (PDF ou Imagem)</label>
                          {tempForm.doc_path ? (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: '#013375' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    Anexo Carregado
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <a
                                    href={getFileUrl(tempForm.doc_path) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <Eye size={14} /> <span>Visualizar</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setTempForm({ ...tempForm, doc_path: undefined })}
                                    style={{ fontSize: '0.85rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title="Remover anexo para reenviar"
                                  >
                                    <Trash2 size={14} /> <span>Excluir Anexo</span>
                                  </button>
                                </div>
                              </div>
                              {/\.(jpe?g|png|webp)$/i.test(tempForm.doc_path) && (
                                <div style={{ marginTop: '10px' }}>
                                  <img
                                    src={getFileUrl(tempForm.doc_path) || ''}
                                    alt="Preview"
                                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="file-input-wrapper" style={{ marginTop: '6px' }}>
                              <input
                                type="file"
                                onChange={e => uploadGenericDoc(e, 'saude')}
                                accept=".pdf,.jpg,.jpeg,.png"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {showAddForm === 'banco' && (
                      <>
                        <div className="form-group"><label>Tipo de Conta</label><input type="text" placeholder="Ex: Corrente, Poupança" value={tempForm.tipo_conta || ''} onChange={e => setTempForm({ ...tempForm, tipo_conta: e.target.value })} /></div>
                        <div className="form-group"><label>Titularidade</label><input type="text" value={tempForm.titularidade || ''} onChange={e => setTempForm({ ...tempForm, titularidade: e.target.value })} /></div>
                        <div className="form-group"><label>Agência</label><input type="text" value={tempForm.agencia || ''} onChange={e => setTempForm({ ...tempForm, agencia: e.target.value })} /></div>
                        <div className="form-group"><label>Número Conta</label><input type="text" value={tempForm.numero || ''} onChange={e => setTempForm({ ...tempForm, numero: e.target.value })} /></div>
                      </>
                    )}
                    {showAddForm === 'quadro' && (
                      <>
                        <div className="form-group"><label>Função Atual</label><input type="text" value={tempForm.funcao_atual || ''} onChange={e => setTempForm({ ...tempForm, funcao_atual: e.target.value })} /></div>
                        <div className="form-group"><label>Competências / Resumo</label><textarea rows={4} value={tempForm.competencias || ''} onChange={e => setTempForm({ ...tempForm, competencias: e.target.value })} /></div>
                        <div className="form-group">
                          <label>CV / Documento (PDF ou JPEG)</label>
                          <div className="file-input-wrapper">
                            <input type="file" onChange={e => uploadGenericDoc(e, 'quadro-pessoal')} />
                          </div>
                        </div>
                      </>
                    )}
                    {showAddForm === 'obs' && (
                      <div className="form-group"><label>Texto da Observação</label><textarea rows={6} value={tempForm.texto || ''} onChange={e => setTempForm({ ...tempForm, texto: e.target.value })} /></div>
                    )}
                  </div>

                  <div className="modal-actions" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button className="btn-back" onClick={() => { setShowAddForm(null); setEditingFormacao(null); setEditingAtividade(null); setEditingSaude(null); setEditingBanco(null); setEditingObra(null); setTempForm({}); }}>Cancelar</button>
                    <button
                      className="btn-save-perfil"
                      onClick={() => {
                        const endpoint = showAddForm === 'formacao' ? 'formacao-academica' :
                          showAddForm === 'atividade' ? 'atividade-missionaria' :
                            showAddForm === 'obras' ? 'obras-realizadas' :
                              showAddForm === 'saude' ? 'saude' :
                                showAddForm === 'banco' ? 'contas-bancarias' :
                                  showAddForm === 'obs' ? 'observacoes-gerais' :
                                    showAddForm === 'quadro' ? 'quadro-pessoal' : '';

                        // Combine funcoes for atividade
                        const payload = { ...tempForm };
                        if (showAddForm === 'atividade') {
                          const funs: string[] = Array.isArray(tempForm.funcoes) ? [...tempForm.funcoes] : [];
                          if (tempForm.outra_funcao && tempForm.outra_funcao.trim()) {
                            const customParsed = parseFuncoesAtividade(tempForm.outra_funcao);
                            customParsed.forEach(cf => {
                              if (cf && !funs.includes(cf)) funs.push(cf);
                            });
                          }
                          payload.funcao_atividade = funs.join(', ');
                        }

                        if (showAddForm === 'formacao' && editingFormacao) {
                          handleGenericUpdate(endpoint, editingFormacao, payload);
                        } else if (showAddForm === 'atividade' && editingAtividade) {
                          handleGenericUpdate(endpoint, editingAtividade, payload);
                        } else if (showAddForm === 'saude' && editingSaude) {
                          handleGenericUpdate(endpoint, editingSaude, payload);
                        } else if (showAddForm === 'banco' && editingBanco) {
                          handleGenericUpdate(endpoint, editingBanco, payload);
                        } else if (showAddForm === 'obras' && editingObra) {
                          handleGenericUpdate(endpoint, editingObra, payload);
                        } else {
                          handleGenericAdd(endpoint, payload);
                        }
                      }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>{/* fim perfil-main-area */}
      </div>{/* fim perfil-layout */}
    </div>
  );
};

export default PerfilMissionario;
