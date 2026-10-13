import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  User, MapPin, BookOpen, Home as HomeIcon, Loader2, AlertCircle,
  Save, Trash2, Plus, Star, FileText, Download, ShieldCheck, Eye,
  Activity, ChevronLeft, DollarSign, GraduationCap, Upload, Lock,
  CheckCircle, Printer, ChevronDown, ChevronRight, Edit, Heart, Church,
  ExternalLink, Globe
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';
import api, { getFileUrl } from '../api';
import { BankAutocomplete } from '../components/Common/BankAutocomplete';
import { appAlert, appConfirm } from '../components/Common/AppDialog';
import FileInputButton from '../components/Common/FileInputButton';
import CorrecaoModal, { type CorrecaoDetalhe } from '../components/Common/CorrecaoModal';
import { OBITO_ACCEPT, OBITO_INVALID_MSG, isValidObitoFile } from '../utils/obito';
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
  transferido_data_inicio: string;
  transferido_data_fim: string;
  transferido_origem: string;
  transferido_destino: string;
  transferido_doc_path: string;
  transferido_observacao: string;
}

const MAX_TRANSFERIDO_DOCS = 4;

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
  banco?: string;
  tipo_conta: string;
  titularidade: string;
  agencia: string;
  numero: string;
  observacoes?: string;
  doc_path?: string;
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
  links_externos?: string;
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

const getDateLocale = (): string => ((i18n.language || '').startsWith('es') ? 'es-ES' : 'pt-BR');

function formatDateLocal(dateStr?: string | null): string {
  const d = parseDateLocal(dateStr);
  return d ? d.toLocaleDateString(getDateLocale()) : '?';
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
  if (anos > 0) parts.push(anos > 1 ? i18n.t('profile.duration.years', { n: anos, defaultValue: `${anos} anos` }) : i18n.t('profile.duration.year', { n: anos, defaultValue: `${anos} ano` }));
  if (meses > 0) parts.push(meses > 1 ? i18n.t('profile.duration.months', { n: meses, defaultValue: `${meses} meses` }) : i18n.t('profile.duration.month', { n: meses, defaultValue: `${meses} mês` }));
  return parts.length ? parts.join(` ${i18n.t('profile.duration.and', 'e')} `) : i18n.t('profile.duration.less_than_month', 'menos de 1 mês');
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
  if (clean === 'TRANSFERIDO') return 'Transferido';
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
  const { canEdit, user: authUser, isAdminGeral, isOconomo, isSuperior, isRegional, canAccessObito } = useAuth();
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  // ?tab= abre direto uma seção (ex.: vindo de uma solicitação de correção do missionário)
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'dados');
  const tabParam = searchParams.get('tab');
  const correcaoParam = Number(searchParams.get('correcao')) || null;
  const [correcaoBanner, setCorrecaoBanner] = useState<CorrecaoDetalhe | null>(null);
  const [correcaoModalOpen, setCorrecaoModalOpen] = useState(false);

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam, id]);

  const loadCorrecaoBanner = () => {
    if (!correcaoParam) { setCorrecaoBanner(null); return; }
    api.get(`/correcoes/${correcaoParam}`)
      .then(res => setCorrecaoBanner(res.data))
      .catch(() => setCorrecaoBanner(null));
  };

  useEffect(loadCorrecaoBanner, [correcaoParam]);

  const fecharCorrecaoBanner = () => {
    setCorrecaoBanner(null);
    const next = new URLSearchParams(searchParams);
    next.delete('correcao');
    next.delete('tab');
    setSearchParams(next, { replace: true });
  };

  // Display-only translation of situation values (stored values stay unchanged)
  const situacaoLabel = (sit?: string | null): string => {
    if (!sit) return '';
    const map: Record<string, string> = {
      ATIVO: 'ativo', EGRESSO: 'egresso', FALECIDO: 'falecido', EXCLAUSTRADO: 'exclaustrado',
      TRANSFERIDO: 'transferido', AFASTADO: 'afastado',
    };
    const key = map[sit.trim().toUpperCase()];
    return key ? t(`missionaries.situations.${key}`, sit) : sit;
  };

  // Display-only translation of standard function names (stored values stay unchanged)
  const funcaoLabel = (fun: string): string => {
    const map: Record<string, string> = {
      'Superior Local': 'superior_local',
      'Pároco': 'paroco',
      'Diretor (rádios, escolas, fundações, escritórios)': 'diretor',
      'Ecônomo Local': 'economo_local',
      'Vigário': 'vigario',
      'Reitor (seminários)': 'reitor'
    };
    const key = map[fun];
    return key ? t(`profile.functions.${key}`, fun) : fun;
  };

  const [missionario, setMissionario] = useState<Missionario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [civilData, setCivilData] = useState<CivilData>({ data_nascimento: '', filiacao: '', nome_pai: '', nome_mae: '', cidade_estado: '', diocese: '', pais: '', naturalidade: '', rnm: '', cpf: '', titulo_eleitor: '', cnh: '', passaporte: '' });
  const [cepLoading, setCepLoading] = useState(false);
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
  const [linksExternosInput, setLinksExternosInput] = useState('');
  const [newSingleLinkUrl, setNewSingleLinkUrl] = useState('');
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);

  useEffect(() => {
    if (quadroPessoal?.links_externos !== undefined) {
      setLinksExternosInput(quadroPessoal.links_externos || '');
    }
  }, [quadroPessoal?.links_externos]);

  const parseExternalLinks = (raw?: string) => {
    if (!raw) return [];
    const items = raw
      .split(/[\n,;]+/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    return items.map(url => {
      let fullUrl = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        fullUrl = 'https://' + url;
      }
      let domain = '';
      try {
        domain = new URL(fullUrl).hostname.replace('www.', '');
      } catch {
        domain = fullUrl;
      }

      let label = domain;
      let badgeType = 'default';

      if (domain.includes('linkedin.com')) {
        label = 'LinkedIn';
        badgeType = 'linkedin';
      } else if (domain.includes('lattes.cnpq.br') || url.toLowerCase().includes('lattes')) {
        label = t('profile.links.lattes_label', 'Currículo Lattes');
        badgeType = 'lattes';
      } else if (domain.includes('orcid.org')) {
        label = 'ORCID';
        badgeType = 'orcid';
      } else if (domain.includes('github.com')) {
        label = 'GitHub';
        badgeType = 'github';
      } else if (domain.includes('instagram.com')) {
        label = 'Instagram';
        badgeType = 'instagram';
      } else if (domain.includes('facebook.com')) {
        label = 'Facebook';
        badgeType = 'facebook';
      } else if (domain.includes('youtube.com')) {
        label = 'YouTube';
        badgeType = 'youtube';
      } else {
        label = domain || t('profile.links.external_link', 'Link Externo');
      }

      return {
        url: fullUrl,
        label,
        domain,
        badgeType
      };
    });
  };

  const handleSaveLinksExternos = async (customValue?: string, silent?: boolean) => {
    const val = customValue !== undefined ? customValue : linksExternosInput;
    setIsSavingLinks(true);
    try {
      await api.post(`/usuarios/${id}/quadro-pessoal`, {
        funcao_atual: quadroPessoal?.funcao_atual || '',
        competencias: quadroPessoal?.competencias || '',
        cv_path: quadroPessoal?.cv_path || '',
        links_externos: val
      });
      setQuadroPessoal(prev => prev ? { ...prev, links_externos: val } : {
        id: 0,
        usuario_id: Number(id),
        funcao_atual: '',
        competencias: '',
        cv_path: '',
        links_externos: val
      });
      setLinksExternosInput(val);
      setIsEditingLinks(false);
      if (!silent) {
        appAlert(t('profile.links.saved_success', 'Links externos salvos com sucesso!'));
      }
    } catch (err) {
      console.error('Erro ao salvar links externos:', err);
      appAlert(t('profile.links.error_saving', 'Erro ao salvar links externos.'));
    } finally {
      setIsSavingLinks(false);
    }
  };

  const handleAddSingleLink = async () => {
    const trimmed = newSingleLinkUrl.trim();
    if (!trimmed) return;

    let fullUrl = trimmed;
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      fullUrl = 'https://' + trimmed;
    }

    const currentLinks = parseExternalLinks(quadroPessoal?.links_externos);
    if (currentLinks.some(l => l.url.toLowerCase() === fullUrl.toLowerCase())) {
      appAlert(t('profile.links.already_exists', 'Este link já foi adicionado.'));
      return;
    }

    const updatedRaw = currentLinks.length > 0
      ? `${(quadroPessoal?.links_externos || '').trim()}\n${fullUrl}`
      : fullUrl;

    await handleSaveLinksExternos(updatedRaw);
    setNewSingleLinkUrl('');
  };

  const handleDeleteLink = async (indexToDelete: number) => {
    const links = parseExternalLinks(quadroPessoal?.links_externos);
    const targetLink = links[indexToDelete];
    if (!targetLink) return;

    const confirmMsg = t('profile.links.delete_confirm', {
      label: targetLink.label,
      url: targetLink.url,
      defaultValue: `Deseja realmente excluir o link: ${targetLink.label} (${targetLink.url})?`
    });

    if (!await appConfirm(confirmMsg)) {
      return;
    }

    const remaining = links
      .filter((_, idx) => idx !== indexToDelete)
      .map(l => l.url)
      .join('\n');

    await handleSaveLinksExternos(remaining);
  };

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
        cv_path: filePath,
        links_externos: quadroPessoal?.links_externos || ''
      });

      setQuadroPessoal(prev => ({
        id: prev?.id || 0,
        usuario_id: Number(id),
        funcao_atual: prev?.funcao_atual || '',
        competencias: prev?.competencias || '',
        cv_path: filePath,
        links_externos: prev?.links_externos || ''
      }));

      appAlert(t('profile.msgs.cv_attached', 'Curriculum Vitae anexado com sucesso!'));
    } catch (err) {
      console.error('Erro ao anexar CV:', err);
      appAlert(t('profile.msgs.cv_attach_error', 'Erro ao anexar Curriculum Vitae.'));
    } finally {
      setCvUploadLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteCv = async () => {
    if (!await appConfirm(t('profile.msgs.cv_remove_confirm', 'Tem certeza de que deseja remover o arquivo do Curriculum Vitae?'))) return;
    setCvUploadLoading(true);
    try {
      if (quadroPessoal?.links_externos) {
        await api.post(`/usuarios/${id}/quadro-pessoal`, {
          funcao_atual: quadroPessoal?.funcao_atual || '',
          competencias: quadroPessoal?.competencias || '',
          cv_path: '',
          links_externos: quadroPessoal.links_externos
        });
        setQuadroPessoal(prev => prev ? { ...prev, cv_path: '' } : null);
      } else {
        await api.delete(`/usuarios/${id}/quadro-pessoal`);
        setQuadroPessoal(null);
      }
      appAlert(t('profile.msgs.cv_removed', 'Curriculum Vitae removido com sucesso!'));
    } catch (err) {
      console.error('Erro ao remover CV:', err);
      appAlert(t('profile.msgs.cv_remove_error', 'Erro ao remover Curriculum Vitae.'));
    } finally {
      setCvUploadLoading(false);
    }
  };

  const handlePrintCvFile = (cvPath: string) => {
    if (!cvPath) {
      appAlert(t('profile.msgs.cv_none_to_print', 'Nenhum arquivo de currículo anexado para impressão.'));
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
  const [editingItinEtapa, setEditingItinEtapa] = useState<string | null>(null);
  const [editingItinLabel, setEditingItinLabel] = useState<string | null>(null);
  const initializedIdRef = useRef<string | null>(null);
  const [nit, setNit] = useState('');
  const [situacaoData, setSituacaoData] = useState<SituacaoData>({
    data_falecimento: '', cidade_falecimento: '', certidao_obito_path: '', local_sepultamento: '',
    egresso_incardinado_path: '', egresso_desistencia_path: '', egresso_laicizado_path: '',
    egresso_transf_sacerdotes_path: '', egresso_transf_para_regiao_path: '', egresso_transf_da_regiao_path: '',
    exclaustrado_data: '', exclaustrado_processo: '', exclaustrado_doc_path: '',
    transferido_data_inicio: '', transferido_data_fim: '', transferido_origem: '', transferido_destino: '',
    transferido_doc_path: '', transferido_observacao: ''
  });
  const [originalSituacao, setOriginalSituacao] = useState('');
  const [showSituacaoConfirmModal, setShowSituacaoConfirmModal] = useState(false);
  const [motivoSituacao, setMotivoSituacao] = useState('');
  const [historicoSituacao, setHistoricoSituacao] = useState<HistoricoSituacaoItem[]>([]);
  const [historicoPerfil, setHistoricoPerfil] = useState<HistoricoPerfilItem[]>([]);

  const uploadSituacaoDoc = async (campo: keyof SituacaoData, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (campo === 'certidao_obito_path' && !isValidObitoFile(file)) {
      e.target.value = '';
      appAlert(t('profile.situation.obito_invalid_format', OBITO_INVALID_MSG));
      return;
    }
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
            transferido_data_inicio: sitRes.data.transferido_data_inicio ? sitRes.data.transferido_data_inicio.split('T')[0] : prev.transferido_data_inicio,
            transferido_data_fim: sitRes.data.transferido_data_fim ? sitRes.data.transferido_data_fim.split('T')[0] : prev.transferido_data_fim,
          }));
        }
        appAlert(t('profile.msgs.doc_attached', 'Documento anexado com sucesso!'));
      }
    } catch (err: any) {
      appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + (err?.response?.data?.message || err.message));
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
              <FileText size={16} /> {t('profile.ui.view_attached_doc', 'Ver Documento Anexado')}
            </a>
            {canEdit && (
              <button
                type="button"
                onClick={async () => {
                  if (await appConfirm(t('profile.msgs.doc_remove_confirm', 'Deseja realmente remover este documento anexado?'))) {
                    setIsSaving(true);
                    try {
                      await api.delete(`/usuarios/${id}/situacao/doc/${campo}`);
                      setSituacaoData(prev => ({ ...prev, [campo]: '' }));
                      appAlert(t('profile.msgs.doc_removed', 'Documento removido com sucesso!'));
                    } catch (err: any) {
                      appAlert(t('profile.msgs.doc_remove_error_detail', 'Erro ao remover documento: ') + (err?.response?.data?.message || err.message));
                    } finally {
                      setIsSaving(false);
                    }
                  }
                }}
                style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
              >
                <Trash2 size={14} /> {t('profile.ui.remove_attachment', 'Remover Anexo')}
              </button>
            )}
          </div>
        ) : (
          canEdit ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="file"
                id={`file-input-${campo}`}
                accept={campo === 'certidao_obito_path' ? OBITO_ACCEPT : '.pdf,.jpg,.jpeg,.png'}
                style={{ display: 'none' }}
                onChange={e => uploadSituacaoDoc(campo, e)}
              />
              <label
                htmlFor={`file-input-${campo}`}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
              >
                <Upload size={15} /> {t('profile.ui.attach_doc_formats', 'Anexar Documento (PDF, PNG ou JPG)')}
              </label>
              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('profile.ui.no_file_attached', 'Nenhum arquivo anexado')}</span>
            </div>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic' }}>{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
          )
        )}
      </div>
    );
  };

  const renderExclaustradoDocs = () => {
    const filePaths = (situacaoData.exclaustrado_doc_path || '').split(',').map(s => s.trim()).filter(Boolean);
    return (
      <div id="exclaustrado_doc_path" className="form-group full" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', transition: 'all 0.3s ease' }}>
        <label style={{ fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>{t('profile.situation.exclaustrado_docs_label', 'Documentos Anexados (Adicione quantos desejar)')}</label>

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
                    <FileText size={16} /> {t('profile.ui.view_doc_n', { n: idx + 1, defaultValue: `Ver Documento ${idx + 1}` })}
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
                      <Trash2 size={14} /> {t('profile.ui.remove', 'Remover')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', display: 'block', marginBottom: '12px' }}>{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
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
                    appAlert(t('profile.msgs.doc_attached_save_reminder', 'Documento anexado! Não esqueça de clicar em "Salvar Situação" para finalizar.'));
                  }
                } catch (err: any) {
                  appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + (err?.response?.data?.message || err.message));
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
              <Upload size={15} /> {t('profile.ui.add_doc', 'Adicionar Documento')}
            </label>
          </div>
        )}
      </div>
    );
  };

  const renderTransferidoDocs = () => {
    const filePaths = (situacaoData.transferido_doc_path || '').split(',').map(s => s.trim()).filter(Boolean);
    const canAddMore = filePaths.length < MAX_TRANSFERIDO_DOCS;
    return (
      <div id="transferido_doc_path" className="form-group full" style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '10px', transition: 'all 0.3s ease' }}>
        <label style={{ fontWeight: 600, color: '#334155', marginBottom: '6px', display: 'block' }}>
          {t('profile.situation.transferido_docs_label', { n: filePaths.length, max: MAX_TRANSFERIDO_DOCS, defaultValue: `Documentos da Transferência (${filePaths.length}/${MAX_TRANSFERIDO_DOCS} — PDF, PNG ou JPG)` })}
        </label>

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
                    <FileText size={16} /> {t('profile.ui.view_doc_n', { n: idx + 1, defaultValue: `Ver Documento ${idx + 1}` })}
                  </a>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!await appConfirm(t('profile.msgs.doc_remove_confirm', 'Deseja realmente remover este documento anexado?'))) return;
                        setIsSaving(true);
                        try {
                          const res = await api.delete(`/usuarios/${id}/situacao/transferido-doc/${idx}`);
                          setSituacaoData(prev => ({ ...prev, transferido_doc_path: res.data?.transferido_doc_path || '' }));
                        } catch (err: any) {
                          appAlert(t('profile.msgs.doc_remove_error_detail', 'Erro ao remover documento: ') + (err?.response?.data?.message || err.message));
                        } finally {
                          setIsSaving(false);
                        }
                      }}
                      style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem' }}
                    >
                      <Trash2 size={14} /> {t('profile.ui.remove', 'Remover')}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: '0.85rem', color: '#94a3b8', fontStyle: 'italic', display: 'block', marginBottom: '12px' }}>{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
        )}

        {canEdit && (canAddMore ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="file"
              id="file-input-transferido_doc_path"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const fd = new FormData();
                fd.append('arquivo', file);
                setIsSaving(true);
                try {
                  const res = await api.post(`/usuarios/${id}/situacao/transferido-doc`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                  setSituacaoData(prev => ({ ...prev, transferido_doc_path: res.data?.transferido_doc_path || prev.transferido_doc_path }));
                } catch (err: any) {
                  appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + (err?.response?.data?.message || err.message));
                } finally {
                  setIsSaving(false);
                  e.target.value = '';
                }
              }}
            />
            <label
              htmlFor="file-input-transferido_doc_path"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <Upload size={15} /> {t('profile.ui.add_doc', 'Adicionar Documento')}
            </label>
          </div>
        ) : (
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('profile.situation.transferido_limit', { max: MAX_TRANSFERIDO_DOCS, defaultValue: `Limite de ${MAX_TRANSFERIDO_DOCS} anexos atingido. Remova um documento para anexar outro.` })}</span>
        ))}
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
          textValue = inp.nextSibling?.textContent?.trim() || inp.name || t('common.yes', 'Sim');
        } else if (inp.type === 'date') {
          textValue = formatDateLocal(inp.value) || '-';
        } else {
          textValue = inp.value.trim() || '-';
        }
      } else if (tagName === 'select') {
        const sel = origEl as HTMLSelectElement;
        const optText = sel.options[sel.selectedIndex]?.text || sel.value;
        textValue = (optText.includes('Selecione') || optText.includes('Seleccione')) ? '-' : optText.trim() || '-';
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

    const dateLocale = getDateLocale();
    const dataAtual = new Date().toLocaleDateString(dateLocale);
    const horaAtual = new Date().toLocaleTimeString(dateLocale, { hour: '2-digit', minute: '2-digit' });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="${dateLocale}">
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
            <div class="org-name">${t('profile.print.org_name', 'Congregação dos Missionários de São Carlos – Scalabrinianos')}</div>
            <div class="doc-title">${title}</div>
            <div class="print-header-meta">
              <span>${t('profile.missionary_role', 'Missionário')}: <strong>${missionario?.nome || ''}</strong></span>
              <span>ID: <strong>#${missionario?.id || ''}</strong></span>
              <span>${t('profile.print.issued', 'Emissão')}: <strong>${dataAtual} ${t('profile.print.at', 'às')} ${horaAtual}</strong></span>
            </div>
          </div>

          <div class="print-body">
            ${clone.innerHTML}
          </div>

          <div class="print-footer">
            <span>${t('profile.print.footer_system', 'Portal Scalabrinianos — Sistema de Gestão')}</span>
            <span>${t('profile.print.footer_individual', 'Documento impresso individualmente')}</span>
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
          if (new URLSearchParams(window.location.hash.split('?')[1] || '').get('tab')) return prev;
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
          transferido_data_inicio: data.situacaoData.transferido_data_inicio ? data.situacaoData.transferido_data_inicio.split('T')[0] : '',
          transferido_data_fim: data.situacaoData.transferido_data_fim ? data.situacaoData.transferido_data_fim.split('T')[0] : '',
          transferido_origem: data.situacaoData.transferido_origem || '',
          transferido_destino: data.situacaoData.transferido_destino || '',
          transferido_doc_path: data.situacaoData.transferido_doc_path || '',
          transferido_observacao: data.situacaoData.transferido_observacao || '',
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
      appAlert(t('profile.msgs.civil_saved', 'Dados civis atualizados!'));
    } catch { appAlert(t('profile.msgs.civil_save_error', 'Erro ao salvar dados civis')); }
    finally { setIsSaving(false); }
  };

  const saveReligiosos = async () => {
    setIsSaving(true);
    try {
      await api.post(`/usuarios/${id}/dados-religiosos`, {
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

      appAlert(t('profile.msgs.religious_saved', 'Dados religiosos e situação atualizados!'));
    } catch { appAlert(t('profile.msgs.religious_save_error', 'Erro ao salvar dados religiosos')); }
    finally { setIsSaving(false); }
  };


  const saveEndereco = async () => {
    setIsSaving(true);
    try {
      await Promise.all([
        api.post(`/usuarios/${id}/endereco-contato`, enderecoData),
        api.post(`/usuarios/${id}/contatos`, { contatos })
      ]);
      appAlert(t('profile.msgs.address_saved', 'Endereço e contatos atualizados!'));
    } catch { appAlert(t('profile.msgs.address_save_error', 'Erro ao salvar endereço e contatos')); }
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
    } catch { appAlert(t('profile.msgs.house_bind_error', 'Erro ao vincular casa')); }
  };

  const removeCasa = async (vinculoId: number) => {
    if (!await appConfirm(t('profile.msgs.house_unbind_confirm', 'Remover este vínculo?'))) return;
    try {
      await api.delete(`/usuarios/${id}/casas-historico/${vinculoId}`);
      fetchData();
    } catch { appAlert(t('profile.msgs.house_unbind_error', 'Erro ao remover vínculo')); }
  };

  const uploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pendingDocDesc.trim()) return appAlert(t('profile.msgs.doc_desc_required', 'Informe a descrição do documento'));

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
      const msg = err?.response?.data?.message || err?.message || t('profile.msgs.doc_upload_error', 'Erro ao enviar documento');
      appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + msg);
    } finally { setIsSaving(false); }
  };

  const uploadReligiousDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pendingReligiousDocDesc.trim()) return appAlert(t('profile.msgs.doc_desc_required', 'Informe a descrição do documento'));

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
      const msg = err?.response?.data?.message || err?.message || t('profile.msgs.doc_upload_error', 'Erro ao enviar documento');
      appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + msg);
    } finally { setIsSaving(false); }
  };

  const uploadSacramentoDoc = async (campo: 'doc_batismo' | 'doc_primeira_comunhao' | 'doc_crisma', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('arquivo', file);
    fd.append('campo', campo);
    setIsSaving(true);
    try {
      const res = await api.post(`/usuarios/${id}/dados-religiosos/upload-sacramento`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setReligiososData(prev => ({ ...prev, [campo]: res.data?.path || '' }));
      appAlert(t('profile.msgs.doc_attached', 'Documento anexado com sucesso!'));
    } catch (err: any) {
      appAlert(t('profile.msgs.doc_upload_error_detail', 'Erro ao enviar documento: ') + (err?.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleCepChange = async (cep: string) => {
    setEnderecoData(prev => ({ ...prev, cep }));
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
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
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setCepLoading(false);
    }
  };

  const removeDocument = async (docId: number) => {
    if (!await appConfirm(t('profile.msgs.doc_delete_confirm', 'Excluir este documento permanentemente?'))) return;
    try {
      await api.delete(`/usuarios/${id}/documentos/${docId}`);
      fetchData();
    } catch { appAlert(t('profile.msgs.doc_remove_error', 'Erro ao remover documento')); }
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
      appAlert(t('profile.msgs.access_saved', 'Informações de acesso atualizadas com sucesso!'));
      setNewPassword('');
      const hPerfRes = await api.get(`/usuarios/${id}/historico-perfil`).catch(() => ({ data: [] }));
      setHistoricoPerfil(Array.isArray(hPerfRes.data) ? hPerfRes.data : []);
    } catch (err: any) {
      appAlert(t('profile.msgs.save_info_error_detail', 'Erro ao salvar informações: ') + (err.response?.data?.message || err.message));
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
        appAlert(t('profile.msgs.situation_data_saved', 'Dados de situação atualizados com sucesso!'));
      } catch (err: any) {
        appAlert(t('profile.msgs.situation_data_save_error_detail', 'Erro ao salvar dados de situação: ') + (err.response?.data?.message || err.message));
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
      appAlert(t('profile.msgs.situation_saved_history', 'Situação atualizada com sucesso e registrada no histórico!'));

      const hSitRes = await api.get(`/usuarios/${id}/historico-situacao`).catch(() => ({ data: [] }));
      setHistoricoSituacao(Array.isArray(hSitRes.data) ? hSitRes.data : []);
    } catch (err: any) {
      appAlert(t('profile.msgs.situation_save_error_detail', 'Erro ao salvar situação: ') + (err.response?.data?.message || err.message));
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
      appAlert(t('profile.msgs.doc_attached', 'Documento anexado com sucesso!'));
    } catch {
      appAlert(t('profile.msgs.doc_attach_error', 'Erro ao anexar documento'));
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
    } catch { appAlert(t('profile.msgs.record_save_error', 'Erro ao salvar registro')); }
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
        appAlert(t('profile.msgs.record_update_error', 'Erro ao atualizar registro'));
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
      appAlert(t('profile.msgs.doc_attached', 'Documento anexado com sucesso!'));
    } catch {
      appAlert(t('profile.msgs.doc_upload_error', 'Erro ao enviar documento'));
    } finally {
      setIsSaving(false);
      e.target.value = '';
    }
  };

  const handleGenericDelete = async (endpoint: string, itemId: number) => {
    if (!await appConfirm(t('profile.msgs.record_delete_confirm', 'Excluir este registro?'))) return;
    try {
      await api.delete(`/usuarios/${id}/${endpoint}/${itemId}`);
      fetchData();
    } catch { appAlert(t('profile.msgs.record_remove_error', 'Erro ao remover registro')); }
  };

  if (isLoading) return <div className="perfil-loading"><Loader2 className="animate-spin" size={40} /><p>{t('profile.loading')}</p></div>;
  if (!missionario) return <div className="perfil-loading"><AlertCircle size={40} /><p>{t('profile.not_found')}</p></div>;

  const isSelfProfile = authUser?.id === missionario?.id;
  const canPrint = (isAdminGeral || canEdit || isRegional) && !isSelfProfile;

  // Tabs principais (Situação só aparece para Admin/Regional)
  const mainTabs = [
    ...(!isSelfProfile ? [{ key: 'situacao', label: t('profile.tabs.situation', '0. Situação'), icon: <Star size={16} />, perm: 'dados_civis' }] : []),
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

  const openItinEditModal = (subLabel: string, etapaKey: string, stageData?: Partial<ItineraryStage>) => {
    setEditingItinEtapa(etapaKey);
    setEditingItinLabel(subLabel);
    setTempForm({
      etapa: etapaKey,
      local: stageData?.local || '',
      periodo: stageData?.periodo || '',
      observacoes: stageData?.observacoes || '',
      doc_path: stageData?.doc_path || '',
      is_sub_etapa: stageData?.is_sub_etapa || etapaKey.includes('-')
    });
    setShowAddForm('itinerario');
  };

  const handleDeleteItinStage = async (etapaKey: string) => {
    if (!await appConfirm(t('profile.msgs.itin_remove_confirm', 'Deseja realmente remover ou limpar este registro do itinerário?'))) return;
    let updated: ItineraryStage[] = [];
    if (etapaKey.includes('-')) {
      updated = itinerarioStages.filter(s => s.etapa !== etapaKey);
    } else {
      updated = itinerarioStages.map(s => s.etapa === etapaKey ? { ...s, local: '', periodo: '', observacoes: '', doc_path: '' } : s);
    }
    setItinerarioStages(updated);
    try {
      await api.post(`/usuarios/${id}/itinerario`, { stages: updated });
    } catch (e) {
      console.error('Erro ao salvar itinerario:', e);
    }
  };

  // Helper: renders itinerary stage items for a given sub-section as premium cards
  const renderItinSubItems = (
    subItems: Array<{ label: string; etapaKey: string }>,
    iconClass: string = 'icon-itin-seminario',
    iconComponent: React.ReactNode = <GraduationCap size={20} />
  ) => (
    <div className="generic-list" style={{ marginTop: '16px' }}>
      {subItems.map(sub => {
        const matchingStages = itinerarioStages.filter(s => s.etapa === sub.etapaKey || s.etapa.startsWith(sub.etapaKey + '-'));
        const stagesToRender = matchingStages.length > 0 ? matchingStages : [{ etapa: sub.etapaKey, local: '', periodo: '', doc_path: '', is_sub_etapa: false, observacoes: '' }];

        return (
          <div key={sub.etapaKey} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
              <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#013375' }}>{sub.label}</span>
              {canEdit && (
                <button
                  type="button"
                  className="btn-action-lite-text"
                  style={{ fontSize: '0.78rem', padding: '2px 8px' }}
                  onClick={() => openItinEditModal(sub.label, `${sub.etapaKey}-${Date.now()}`, { etapa: `${sub.etapaKey}-${Date.now()}`, is_sub_etapa: true })}
                >
                  <Plus size={13} /> {t('profile.itinerary.add_place_period', 'Adicionar Local/Período')}
                </button>
              )}
            </div>

            {stagesToRender.map((stage, sIdx) => {
              const hasContent = !!(stage.local || stage.periodo || stage.observacoes || stage.doc_path);
              return (
                <div key={stage.etapa + '-' + sIdx} className="list-item-card-premium">
                  <div className={`item-icon-container ${iconClass}`}>
                    {iconComponent}
                  </div>
                  <div className="item-main-content">
                    {stage.periodo ? (
                      <>
                        <strong>{stage.periodo}</strong>
                        <div className="item-subtitle">
                          {stage.local || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t('profile.itinerary.place_not_informed', 'Local não informado')}</span>}
                        </div>
                      </>
                    ) : (
                      <>
                        <strong>{stage.local || sub.label}</strong>
                        <div className="item-subtitle">
                          <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>{t('profile.itinerary.period_not_informed', 'Período não informado')}</span>
                        </div>
                      </>
                    )}
                    {stage.local && stage.periodo && (
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, display: 'inline-block' }}>
                          {sub.label}
                        </span>
                      </div>
                    )}
                    {stage.observacoes && (
                      <div className="item-description" style={{ marginTop: '8px', whiteSpace: 'pre-wrap' }}>
                        <strong>{t('profile.ui.observation', 'Observação')}:</strong> {stage.observacoes}
                      </div>
                    )}
                    {stage.doc_path && (
                      <div style={{ marginTop: '8px' }}>
                        <a
                          href={getFileUrl(stage.doc_path) || '#'}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-itin-doc success"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', padding: '4px 10px', borderRadius: '6px', fontSize: '0.8rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', fontWeight: 600 }}
                        >
                          <FileText size={14} /> {t('profile.itinerary.view_doc_proof', 'Visualizar Documento / Comprovante')}
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                    {stage.doc_path && (
                      <a href={getFileUrl(stage.doc_path) || '#'} target="_blank" rel="noreferrer" className="btn-action-lite" title={t('profile.ui.view_doc', 'Visualizar Documento')}>
                        <Eye size={14} />
                      </a>
                    )}
                    {canEdit && (
                      <>
                        <button
                          type="button"
                          className="btn-action-lite"
                          onClick={() => openItinEditModal(sub.label, stage.etapa, stage)}
                          title={t('common.edit', 'Editar')}
                        >
                          <Edit size={14} />
                        </button>
                        {!stage.doc_path && (
                          <button
                            type="button"
                            className="btn-action-lite"
                            onClick={() => { activeEtapaRef.current = stage.etapa; itinFileInputRef.current?.click(); }}
                            title={t('profile.ui.attach_doc', 'Anexar Documento')}
                          >
                            <FileText size={14} />
                          </button>
                        )}
                        {(stage.etapa.includes('-') || hasContent) && (
                          <button
                            type="button"
                            className="btn-action-lite delete"
                            onClick={() => handleDeleteItinStage(stage.etapa)}
                            title={t('profile.ui.delete_clear', 'Excluir / Limpar')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap', minWidth: 0 }}>
              <h1>{missionario.nome}</h1>
              {!isSelfProfile && (
                <span className={`situacao-tag-premium ${(missionario.situacao || '').toLowerCase()}`}>
                  {situacaoLabel(missionario.situacao)}
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
                {t('profile.ui.edit_user_access', 'Editar acessos do usuário')}
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
          <div className="sidebar-section-title">{t('profile.ui.more_info', 'Mais Informações')}</div>
          <nav className="sidebar-nav">
            {SIDEBAR.map(item => {
              if (item.key === 'itinerario') {
                const itinSubItems = [
                  { key: 'itin_4.1', label: t('profile.itinerary.menu_4_1', '4.1 Seminário') },
                  { key: 'itin_4.2', label: t('profile.itinerary.menu_4_2', '4.2 Vida Religiosa') },
                  { key: 'itin_4.3', label: t('profile.itinerary.menu_4_3', '4.3 Ministérios') },
                  { key: 'itin_4.4', label: t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção') },
                ];
                const isItinActive = activeTab.startsWith('itin_');
                return (
                  <div key="itinerario-group" className="sidebar-nav-group">
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
            {correcaoBanner && (
              <div className="cm-banner">
                <div className="cm-banner-body">
                  <strong>
                    {correcaoBanner.status === 'RESOLVIDA'
                      ? t('correcao.banner_resolved', 'Solicitação de correção (resolvida)')
                      : t('correcao.banner_title', 'Correção solicitada pelo missionário')} — {correcaoBanner.secao}
                  </strong>
                  {t('correcao.fields', 'Campos a alterar')}:
                  <ul className="cm-campos">
                    {correcaoBanner.campos.map(c => <li key={c}>{c}</li>)}
                  </ul>
                  <p className="cm-banner-note">“{correcaoBanner.descricao}”</p>
                </div>
                <div className="cm-banner-actions">
                  <button className="cm-btn-primary" onClick={() => setCorrecaoModalOpen(true)}>{t('correcao.view_details', 'Ver detalhes')}</button>
                  <button className="cm-btn-secondary" style={{ color: '#475569', borderColor: '#cbd5e1' }} onClick={fecharCorrecaoBanner}>{t('common.close', 'Fechar')}</button>
                </div>
              </div>
            )}
            {correcaoModalOpen && correcaoBanner && (
              <CorrecaoModal
                correcaoId={correcaoBanner.id}
                hideGoToSection
                onClose={() => setCorrecaoModalOpen(false)}
                onResolved={loadCorrecaoBanner}
              />
            )}
            {/* --- 0. SITUAÇÃO --- */}
            {(activeTab === 'situacao' || activeTab.startsWith('situacao_')) && (() => {
              const currentSituacao = normalizeSituacao(missionario.situacao);
              return (
                <div className="tab-panel">
                  <div className="section-card" id="print-situacao">
                    <div className="section-header-flex">
                      <h3 className="section-title"><Star size={16} /> {t('profile.situation.title', '0. Situação do Missionário')}</h3>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.situation', '0. Situação'), 'print-situacao')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                    </div>

                    {/* Status badge display */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
                      <span className={`situacao-tag-premium ${currentSituacao.toLowerCase()}`} style={{ fontSize: '1rem', padding: '10px 24px' }}>
                        {situacaoLabel(currentSituacao)}
                      </span>
                      <span style={{ color: '#64748b', fontSize: '0.9rem' }}>{t('profile.situation.current_hint', 'Situação atual do missionário no sistema')}</span>
                    </div>

                    {/* Alterar Situação (quando edita) */}
                    {canEdit && (
                      <div className="form-grid-2" style={{ marginBottom: '24px' }}>
                        <div className="form-group">
                          <label>{t('profile.situation.change_label', 'Alterar Situação do Missionário')}</label>
                          <select
                            value={currentSituacao}
                            onChange={e => setMissionario({ ...missionario, situacao: e.target.value } as any)}
                          >
                            <option value="Ativo">{t('missionaries.situations.ativo', 'Ativo')}</option>
                            <option value="Egresso">{t('missionaries.situations.egresso', 'Egresso')}</option>
                            {(canAccessObito || currentSituacao === 'Falecido') && (
                              <option value="Falecido" disabled={!canAccessObito}>{t('missionaries.situations.falecido', 'Falecido')}</option>
                            )}
                            <option value="Exclaustrado">{t('missionaries.situations.exclaustrado', 'Exclaustrado')}</option>
                            <option value="Transferido">{t('missionaries.situations.transferido', 'Transferido')}</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* ── FALECIDO — dados de óbito restritos ao Registro Regional ── */}
                    {currentSituacao === 'Falecido' && !canAccessObito && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', color: '#64748b', fontSize: '0.9rem' }}>
                        🔒 {t('profile.situation.obito_restricted', 'As informações de óbito são restritas ao perfil Registro Regional.')}
                      </div>
                    )}
                    {currentSituacao === 'Falecido' && canAccessObito && (
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
                          🕊️ {t('profile.situation.obito_title', 'Informações de Falecimento')}
                        </h4>
                        {(activeTab === 'situacao' || activeTab === 'situacao_falecido_data_cidade') && (
                          <div id="falecido_data_cidade" className="form-grid-2" style={{ marginBottom: '16px' }}>
                            <div className="form-group">
                              <label>{t('profile.situation.death_date', 'Data de Falecimento')}</label>
                              <input
                                type="date"
                                value={situacaoData.data_falecimento || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, data_falecimento: e.target.value })}
                                disabled={!canEdit}
                              />
                            </div>
                            <div className="form-group">
                              <label>{t('profile.situation.death_city', 'Cidade de Falecimento')}</label>
                              <input
                                type="text"
                                value={situacaoData.cidade_falecimento || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, cidade_falecimento: e.target.value })}
                                placeholder={t('profile.situation.death_city_placeholder', 'Cidade - UF / País')}
                                disabled={!canEdit}
                              />
                            </div>
                          </div>
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_certidao_obito_path') && (
                          renderSituacaoDocField(t('profile.situation.obito_certificate', 'Certidão de Óbito (PDF, PNG ou JPG)'), 'certidao_obito_path', 'certidao_obito_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_falecido_sepultamento') && (
                          <div id="falecido_sepultamento" className="form-group full">
                            <label>{t('profile.situation.burial_place', 'Local de Sepultamento')}</label>
                            <input
                              type="text"
                              value={situacaoData.local_sepultamento || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, local_sepultamento: e.target.value })}
                              placeholder={t('profile.situation.burial_placeholder', 'Cemitério, Jazigo, Cidade...')}
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
                          📋 {t('profile.situation.egresso_title', 'Documentos e Informações de Egresso')}
                        </h4>

                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_incardinado_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_incardinado', '1. Incardinados (Documento PDF / JPEG)'), 'egresso_incardinado_path', 'egresso_incardinado_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_desistencia_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_desistencia', '2. Desistência ou em outro instituto (Documento PDF / JPEG)'), 'egresso_desistencia_path', 'egresso_desistencia_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_laicizado_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_laicizado', '3. Laicizados (Documento PDF / JPEG)'), 'egresso_laicizado_path', 'egresso_laicizado_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_sacerdotes_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_transf_sacerdotes', '4. Sacerdotes e Religiosos Transferidos (Documento PDF / JPEG)'), 'egresso_transf_sacerdotes_path', 'egresso_transf_sacerdotes_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_para_regiao_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_transf_para_regiao', '4.1 Para a Região (Documento PDF / JPEG)'), 'egresso_transf_para_regiao_path', 'egresso_transf_para_regiao_path')
                        )}
                        {(activeTab === 'situacao' || activeTab === 'situacao_egresso_transf_da_regiao_path') && (
                          renderSituacaoDocField(t('profile.situation.egresso_transf_da_regiao', '4.2 Da Região para outras Províncias / Região (Documento PDF / JPEG)'), 'egresso_transf_da_regiao_path', 'egresso_transf_da_regiao_path')
                        )}
                      </div>
                    )}

                    {/* ── EXCLAUSTRADO ── */}
                    {currentSituacao === 'Exclaustrado' && (
                      <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#991b1b', fontSize: '1rem', borderBottom: '2px solid #fca5a5', paddingBottom: '8px' }}>
                          📜 {t('profile.situation.exclaustrado_title', 'Informações de Exclaustração')}
                        </h4>
                        <div className="form-grid-2">
                          {(activeTab === 'situacao' || activeTab === 'situacao_exclaustrado_data') && (
                            <div id="exclaustrado_data" className="form-group">
                              <label>{t('profile.situation.exclaustrado_date', 'Data de Exclaustração')}</label>
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
                              <label>{t('profile.situation.exclaustrado_process', 'Processo / Decreto')}</label>
                              <input
                                type="text"
                                value={situacaoData.exclaustrado_processo || ''}
                                onChange={e => setSituacaoData({ ...situacaoData, exclaustrado_processo: e.target.value })}
                                placeholder={t('profile.situation.exclaustrado_process_placeholder', 'Número do processo ou decreto...')}
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

                    {/* ── TRANSFERIDO ── */}
                    {currentSituacao === 'Transferido' && (
                      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: '#1e40af', fontSize: '1rem', borderBottom: '2px solid #93c5fd', paddingBottom: '8px' }}>
                          🔁 {t('profile.situation.transferido_title', 'Informações de Transferência')}
                        </h4>
                        <div className="form-grid-2">
                          <div id="transferido_periodo" className="form-group">
                            <label>{t('profile.situation.period_start', 'Período — Início')}</label>
                            <input
                              type="date"
                              value={situacaoData.transferido_data_inicio || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, transferido_data_inicio: e.target.value })}
                              disabled={!canEdit}
                            />
                          </div>
                          <div className="form-group">
                            <label>{t('profile.situation.period_end', 'Período — Fim')}</label>
                            <input
                              type="date"
                              value={situacaoData.transferido_data_fim || ''}
                              min={situacaoData.transferido_data_inicio || undefined}
                              onChange={e => setSituacaoData({ ...situacaoData, transferido_data_fim: e.target.value })}
                              disabled={!canEdit}
                            />
                          </div>
                          <div id="transferido_origem" className="form-group">
                            <label>{t('profile.situation.origin', 'Região/Província de Origem')}</label>
                            <input
                              type="text"
                              value={situacaoData.transferido_origem || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, transferido_origem: e.target.value })}
                              placeholder={t('profile.situation.origin_placeholder', 'Região ou província de origem')}
                              disabled={!canEdit}
                            />
                          </div>
                          <div id="transferido_destino" className="form-group">
                            <label>{t('profile.situation.destination', 'Região/Província de Destino')}</label>
                            <input
                              type="text"
                              value={situacaoData.transferido_destino || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, transferido_destino: e.target.value })}
                              placeholder={t('profile.situation.destination_placeholder', 'Região ou província de destino')}
                              disabled={!canEdit}
                            />
                          </div>
                          {renderTransferidoDocs()}
                          <div id="transferido_observacao" className="form-group full">
                            <label>{t('profile.ui.observation', 'Observação')}</label>
                            <textarea
                              rows={3}
                              value={situacaoData.transferido_observacao || ''}
                              onChange={e => setSituacaoData({ ...situacaoData, transferido_observacao: e.target.value })}
                              placeholder={t('profile.situation.transferido_obs_placeholder', 'Informações adicionais sobre a transferência...')}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {canEdit && (
                      <div className="section-actions" style={{ marginTop: '20px' }}>
                        <button className="btn-save-perfil" onClick={handleSaveSituacao} disabled={isSaving}>
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          {t('profile.situation.save_btn', 'Salvar Situação')}
                        </button>
                      </div>
                    )}

                    {/* ── HISTÓRICO DE ALTERAÇÕES DE SITUAÇÃO ── */}
                    <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                        <Activity size={18} style={{ color: '#013375' }} />
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                          {t('profile.situation.history_title', 'Histórico de Alterações de Situação')}
                        </h4>
                      </div>

                      {historicoSituacao.length === 0 ? (
                        <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                          {t('profile.situation.history_empty', 'Nenhuma alteração de situação registrada até o momento.')}
                        </div>
                      ) : (
                        <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                          <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                              <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                                <th style={{ padding: '10px 12px' }}>{t('profile.history.date_time', 'Data / Hora')}</th>
                                <th style={{ padding: '10px 12px' }}>{t('profile.situation.history_change', 'Mudança de Situação')}</th>
                                <th style={{ padding: '10px 12px' }}>{t('profile.history.changed_by', 'Alterado Por')}</th>
                                <th style={{ padding: '10px 12px' }}>{t('profile.history.reason', 'Motivo / Observação')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historicoSituacao.map(item => (
                                <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                    {item.created_at ? new Date(item.created_at).toLocaleString(getDateLocale()) : '—'}
                                  </td>
                                  <td style={{ padding: '10px 12px' }}>
                                    <span className={`situacao-tag-premium ${(item.situacao_anterior || '').toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                      {situacaoLabel(item.situacao_anterior) || '—'}
                                    </span>
                                    <span style={{ margin: '0 6px', color: '#94a3b8' }}>➔</span>
                                    <span className={`situacao-tag-premium ${(item.situacao_nova || '').toLowerCase()}`} style={{ fontSize: '0.75rem', padding: '3px 8px' }}>
                                      {situacaoLabel(item.situacao_nova)}
                                    </span>
                                  </td>
                                  <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                                    {item.alterado_por_nome || t('profile.history.system', 'Sistema')}
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
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.personal', '1. Dados Civis'), 'print-dados-civis')}>
                        <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
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
                        placeholder={t('profile.civil.city_placeholder', 'Ex: São Paulo, SP')}
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
                        placeholder={t('profile.civil.country_placeholder', 'Ex: Brasil')}
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
                        placeholder={t('profile.civil.diocese_placeholder', 'Ex: Diocese de São Paulo')}
                      />
                    </div>

                    {/* RNM / RG / CI / DI — Alfanumérico */}
                    <div className="form-group">
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        RG / RNM / CI / DI <FileText size={14} style={{ opacity: 0.5 }} />
                      </label>
                      <input
                        type="text"
                        value={civilData.rnm}
                        maxLength={30}
                        onChange={e => {
                          setCivilData({ ...civilData, rnm: e.target.value });
                        }}
                        disabled={!canEdit}
                        placeholder={t('profile.civil.rg_placeholder', 'Ex: 12.345.678-9, V123456-X...')}
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
                        {t('profile.civil.voter_id', 'Título Eleitor')} <FileText size={14} style={{ opacity: 0.5 }} />
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
                        {t('profile.civil.passport', 'Passaporte')} <FileText size={14} style={{ opacity: 0.5 }} />
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
                  <div className="pm-grid-2" style={{ gap: '10px' }}>
                    {nacionalidades.map((nac, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                        <input type="text" value={nac} onChange={e => {
                          const nn = [...nacionalidades];
                          nn[idx] = e.target.value;
                          setNacionalidades(nn);
                        }} placeholder={t('profile.civil.nationality_placeholder', 'Nacionalidade...')} style={{ flex: 1 }} disabled={!canEdit} />
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
                            placeholder={t('profile.civil.doc_desc_placeholder', 'Ex: RG, Passaporte, CPF...')}
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
                          {isSaving ? t('profile.ui.sending', 'Enviando...') : t('profile.actions.upload_btn')}
                        </button>
                      </div>
                      <p className="doc-upload-hint">{t('profile.ui.upload_hint', 'PDF, JPG ou PNG · máx. 20MB')}</p>
                    </div>
                  )}

                  {documentos.length === 0 ? (
                    <p className="empty-msg">{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</p>
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
                                <span className="doc-date">· {new Date(doc.data_upload).toLocaleDateString(getDateLocale())}</span>
                              </span>
                            </div>
                            <div className="doc-card-actions">
                              <a href={getFileUrl(doc.url) || '#'} target="_blank" rel="noreferrer" className="doc-btn view" title={t('profile.ui.view', 'Visualizar')}>
                                <Eye size={15} />
                              </a>
                              <a href={getFileUrl(doc.url) || '#'} download={doc.arquivo_nome} className="doc-btn download" title={t('profile.ui.download', 'Download')}>
                                <Download size={15} />
                              </a>
                              {canEdit && (
                                <button className="doc-btn delete" onClick={() => removeDocument(doc.id)} title={t('common.delete', 'Excluir')}>
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
                    <h3 className="section-title"><MapPin size={16} /> {t('profile.tabs.contact', '2. Contatos')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.contact', '2. Contatos'), 'print-contatos')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && contatos.length < 3 && (
                        <button className="btn-action-lite-text" onClick={() => setContatos([...contatos, { parentesco: '', nome: '', endereco: '', telefone: '', email: '' }])}>
                          <Plus size={16} /> <span>{t('profile.contacts.add_btn', 'Adicionar Contato')}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.address.main_address', 'Endereço Principal')}</h4>
                  <div className="form-grid-3 religious-grid-2">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.cep')} {cepLoading && <Loader2 size={12} className="animate-spin" style={{ marginLeft: 4 }} />}</label>
                      <input type="text" value={enderecoData.cep || ''} onChange={e => handleCepChange(e.target.value)} placeholder="00000-000" disabled={!canEdit} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.neighborhood')}</label>
                      <input type="text" value={enderecoData.bairro || ''} onChange={e => setEnderecoData({ ...enderecoData, bairro: e.target.value })} placeholder={t('missionaries.wizard.address.neighborhood_placeholder', 'Bairro...')} disabled={!canEdit} />
                    </div>
                    <div className="form-group full">
                      <label>{t('missionaries.wizard.address.street')}</label>
                      <input type="text" value={enderecoData.logradouro || ''} onChange={e => setEnderecoData({ ...enderecoData, logradouro: e.target.value })} placeholder={t('missionaries.wizard.address.street_placeholder', 'Rua, Av., número...')} disabled={!canEdit} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.complement')}</label>
                      <input type="text" value={enderecoData.complemento || ''} onChange={e => setEnderecoData({ ...enderecoData, complemento: e.target.value })} placeholder={t('missionaries.wizard.address.complement_placeholder', 'Apto, Bloco...')} disabled={!canEdit} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.city_state')}</label>
                      <input type="text" value={enderecoData.cidade_estado || ''} onChange={e => setEnderecoData({ ...enderecoData, cidade_estado: e.target.value })} placeholder={t('missionaries.wizard.address.city_state_placeholder', 'Cidade - UF')} disabled={!canEdit} />
                    </div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.address.missionary_contacts', 'Contatos do Missionário')}</h4>
                  <div className="form-grid-3">
                    <div className="form-group"><label>{t('missionaries.wizard.address.cellphone')}</label><input type="text" value={enderecoData.celular_whatsapp || ''} onChange={e => setEnderecoData({ ...enderecoData, celular_whatsapp: e.target.value })} placeholder="(00) 90000-0000" disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.phone')}</label><input type="text" value={enderecoData.telefone_fixo || ''} onChange={e => setEnderecoData({ ...enderecoData, telefone_fixo: e.target.value })} placeholder="(00) 0000-0000" disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.personal_email')}</label><input type="email" value={enderecoData.email_pessoal || ''} onChange={e => setEnderecoData({ ...enderecoData, email_pessoal: e.target.value })} placeholder={t('missionaries.wizard.address.personal_email_placeholder', 'email@pessoal.com')} disabled={!canEdit} /></div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.contacts.family_title', 'Contatos de Familiares / Parentes')}</h4>
                  <div className="contatos-list" style={{ marginTop: '12px' }}>
                    {contatos.length === 0 && (
                      <p style={{ opacity: 0.6, textAlign: 'center', padding: '20px' }}>{t('profile.contacts.empty', 'Nenhum contato cadastrado. Adicione até 3 contatos.')}</p>
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
                            <label>{t('profile.labels.relationship', 'Parentesco')}</label>
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
                              <option value="">{t('profile.ui.select', 'Selecione...')}</option>
                              <option value="Pai">{t('profile.contacts.rel_father', 'Pai')}</option>
                              <option value="Mãe">{t('profile.contacts.rel_mother', 'Mãe')}</option>
                              <option value="Irmão(a)">{t('profile.contacts.rel_sibling', 'Irmão(a)')}</option>
                              <option value="Outros">{t('profile.contacts.rel_others', 'Outros')}</option>
                            </select>

                            {(!['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) && contato.parentesco !== '') || contato.parentesco === 'Outros' ? (
                              <input
                                type="text"
                                placeholder={t('profile.contacts.other_rel_placeholder', 'Qual parentesco? (ex: Padrasto)')}
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
                            <label>{t('profile.labels.name', 'Nome')}</label>
                            <input
                              type="text"
                              placeholder={t('profile.contacts.name_placeholder', 'Nome...')}
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
                            <label>{t('profile.labels.phone', 'Telefone')}</label>
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
                            <label>{t('profile.labels.address', 'Endereço')}</label>
                            <input
                              type="text"
                              placeholder={t('profile.contacts.address_placeholder', 'Endereço completo...')}
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
                            <label>{t('profile.labels.email', 'E-mail')}</label>
                            <input
                              type="email"
                              placeholder={t('profile.ui.email_placeholder', 'email@exemplo.com')}
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
                        {t('profile.contacts.save_btn', 'Salvar Contatos')}
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
                    <h3 className="section-title" style={{ margin: 0 }}><ShieldCheck size={16} /> {t('profile.access.title', 'Acesso ao Sistema')}</h3>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <strong>{t('profile.access.created_at', 'Data de Cadastro')}:</strong> {missionario.created_at ? new Date(missionario.created_at).toLocaleString(getDateLocale()) : '—'}
                    </div>
                  </div>
                  <div className="form-grid-2">
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>{t('profile.labels.name', 'Nome')}</label>
                      <input
                        type="text"
                        value={missionario.nome}
                        onChange={e => {
                          const v = e.target.value.replace(/[0-9]/g, '');
                          setMissionario({ ...missionario, nome: v });
                        }}
                        disabled={!canEdit}
                        placeholder={t('profile.access.full_name_placeholder', 'Nome completo')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.login_email', 'E-mail de Login')}</label>
                      <input
                        type="email"
                        value={missionario.login}
                        onChange={e => setMissionario({ ...missionario, login: e.target.value })}
                        disabled={!canEdit}
                        placeholder={t('profile.ui.email_placeholder', 'email@exemplo.com')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.new_password_hint', 'Nova Senha (deixe em branco para não alterar)')}</label>
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
                        {t('profile.access.update_btn', 'Atualizar Acesso')}
                      </button>
                    </div>
                  )}

                  {/* ── HISTÓRICO DE TROCA DE PERFIL ── */}
                  <div style={{ marginTop: '30px', borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                      <Activity size={18} style={{ color: '#013375' }} />
                      <h4 style={{ margin: 0, fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                        {t('profile.access.history_title', 'Histórico de Alterações de Perfil / Cargo')}
                      </h4>
                    </div>

                    {historicoPerfil.length === 0 ? (
                      <div style={{ padding: '16px', background: '#f8fafc', borderRadius: '8px', color: '#64748b', fontSize: '0.88rem', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                        {t('profile.access.history_empty', 'Nenhuma troca de perfil/cargo registrada até o momento.')}
                      </div>
                    ) : (
                      <div style={{ overflowX: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <table style={{ width: '100%', minWidth: '560px', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                          <thead>
                            <tr style={{ background: '#f1f5f9', color: '#475569', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                              <th style={{ padding: '10px 12px' }}>{t('profile.history.date_time', 'Data / Hora')}</th>
                              <th style={{ padding: '10px 12px' }}>{t('profile.access.history_change', 'Mudança de Perfil')}</th>
                              <th style={{ padding: '10px 12px' }}>{t('profile.history.changed_by', 'Alterado Por')}</th>
                              <th style={{ padding: '10px 12px' }}>{t('profile.history.reason', 'Motivo / Observação')}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {historicoPerfil.map(item => (
                              <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: '#64748b' }}>
                                  {item.created_at ? new Date(item.created_at).toLocaleString(getDateLocale()) : '—'}
                                </td>
                                <td style={{ padding: '10px 12px' }}>
                                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#f1f5f9', color: '#475569', fontSize: '0.78rem', fontWeight: 600 }}>
                                    {item.perfil_anterior ? t(`roles.${item.perfil_anterior.toLowerCase()}`, item.perfil_anterior) : '—'}
                                  </span>
                                  <span style={{ margin: '0 6px', color: '#94a3b8' }}>➔</span>
                                  <span style={{ padding: '3px 8px', borderRadius: '6px', background: '#e0e7ff', color: '#3730a3', fontSize: '0.78rem', fontWeight: 700 }}>
                                    {item.perfil_novo ? t(`roles.${item.perfil_novo.toLowerCase()}`, item.perfil_novo) : '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>
                                  {item.alterado_por_nome || t('profile.history.system', 'Sistema')}
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
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.religious', '3. Dados Religiosos'), 'print-dados-religiosos')}>
                        <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                      </button>
                    )}
                  </div>
                  <h4 className="religious-subtitle">{t('missionaries.wizard.religious.sacraments', 'Sacramentos')}</h4>
                  <div className="form-grid-3">
                    <div className="form-group"><label>{t('profile.labels.baptism', 'Batismo')}</label><input type="date" value={religiososData.data_batismo || ''} onChange={e => setReligiososData({ ...religiososData, data_batismo: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('profile.labels.first_communion', 'Primeira Comunhão')}</label><input type="date" value={religiososData.data_primeira_comunhao || ''} onChange={e => setReligiososData({ ...religiososData, data_primeira_comunhao: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('profile.labels.confirmation', 'Crisma')}</label><input type="date" value={religiososData.data_crisma || ''} onChange={e => setReligiososData({ ...religiososData, data_crisma: e.target.value })} disabled={!canEdit} /></div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.religious.vows_title', 'Consagração e Votos')}</h4>
                  <div className="form-grid-3 religious-grid-2">
                    <div className="form-group"><label>{t('missionaries.wizard.religious.first_vows_date', 'Primeiros Votos (Data)')}</label><input type="date" value={religiososData.primeiros_votos_data || ''} onChange={e => setReligiososData({ ...religiososData, primeiros_votos_data: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.religious.perpetual_vows_date', 'Votos Perpétuos (Data)')}</label><input type="date" value={religiososData.votos_perpetuos_data || ''} onChange={e => setReligiososData({ ...religiososData, votos_perpetuos_data: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group full"><label>{t('missionaries.wizard.religious.profession_place', 'Lugar de Profissão')}</label><input type="text" value={religiososData.lugar_profissao || ''} onChange={e => setReligiososData({ ...religiososData, lugar_profissao: e.target.value })} placeholder={t('missionaries.wizard.religious.profession_place_placeholder', 'Lugar de profissão...')} disabled={!canEdit} /></div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.religious.ordination_title', 'Ordenação')}</h4>
                  <div className="form-grid-3 religious-grid-2">
                    <div className="form-group"><label>{t('missionaries.wizard.religious.diaconate_date', 'Diaconato (Data)')}</label><input type="date" value={religiososData.diaconato_data || ''} onChange={e => setReligiososData({ ...religiososData, diaconato_data: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.religious.presbyterate_date', 'Presbiterato (Data)')}</label><input type="date" value={religiososData.presbiterato_data || ''} onChange={e => setReligiososData({ ...religiososData, presbiterato_data: e.target.value })} disabled={!canEdit} /></div>
                    <div className="form-group full"><label>{t('missionaries.wizard.religious.ordaining_bishop', 'Bispo Ordenante')}</label><input type="text" value={religiososData.bispo_ordenante || ''} onChange={e => setReligiososData({ ...religiososData, bispo_ordenante: e.target.value })} placeholder={t('missionaries.wizard.religious.bishop_placeholder', 'Nome do Bispo ordenante...')} disabled={!canEdit} /></div>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.religious.admin_functions', 'Funções Administrativas')}</h4>
                  <div className="religious-checkbox-row">
                    <label className="checkbox-label">
                      <input type="checkbox" checked={!!missionario.is_oconomo} onChange={e => setMissionario({ ...missionario, is_oconomo: e.target.checked })} disabled={!canEdit} />
                      <span>{t('profile.oconomo_badge', 'É Ecônomo')}</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={!!missionario.is_superior} onChange={e => setMissionario({ ...missionario, is_superior: e.target.checked })} disabled={!canEdit} />
                      <span>{t('profile.superior_badge', 'É Superior Local')}</span>
                    </label>
                  </div>

                  <h4 className="religious-subtitle">{t('missionaries.wizard.religious.attach_certificates', 'Anexar Certidões')}</h4>
                  <div className="form-grid-3">
                    {([
                      ['doc_batismo', t('missionaries.wizard.religious.baptism_certificate', 'Certidão de Batismo')],
                      ['doc_primeira_comunhao', t('missionaries.wizard.religious.communion_certificate', 'Certidão 1ª Comunhão')],
                      ['doc_crisma', t('missionaries.wizard.religious.confirmation_certificate', 'Certidão de Crisma')],
                    ] as const).map(([campo, label]) => (
                      <div key={campo} className="form-group">
                        <label>{label}</label>
                        {religiososData[campo] && (
                          <a href={getFileUrl(religiososData[campo]) || '#'} target="_blank" rel="noreferrer" className="religious-doc-link">
                            <FileText size={14} /> {t('profile.ui.view_doc', 'Ver Documento')}
                          </a>
                        )}
                        {canEdit ? (
                          <FileInputButton accept=".pdf,.jpg,.jpeg,.png" onChange={e => uploadSacramentoDoc(campo, e)} disabled={isSaving} />
                        ) : !religiososData[campo] && (
                          <span className="religious-doc-empty">{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="section-title mt-4">
                    <h3>{t('profile.labels.attach_certificate', 'Anexar Certidão')}</h3>
                  </div>
                  <div className="form-grid-1">
                    <div className="form-group full">
                      <label>{t('profile.labels.doc_desc', 'Descrição do documento')}</label>
                      <input
                        type="text"
                        placeholder={t('profile.religious.doc_desc_placeholder', 'Ex: Certidão de Batismo')}
                        value={pendingReligiousDocDesc}
                        onChange={e => setPendingReligiousDocDesc(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="form-group full">
                      <label>{t('profile.labels.attach_file', 'Anexar arquivo')}</label>
                      <div className="file-input-wrapper" style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="file" ref={religiousFileInputRef} onChange={uploadReligiousDocument} style={{ display: 'none' }} accept=".pdf,.jpg,.jpeg,.png" disabled={!canEdit} />
                        <button type="button" className="btn-upload-doc" onClick={() => religiousFileInputRef.current?.click()} disabled={!canEdit || isSaving}>
                          {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                          {isSaving ? t('profile.ui.sending', 'Enviando...') : t('profile.ui.select_file', 'Selecionar arquivo')}
                        </button>
                        <span style={{ color: '#555', fontSize: '0.95rem' }}>{t('profile.ui.formats_short', 'PDF/JPG/PNG')}</span>
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
                    <h3 className="section-title"><GraduationCap size={16} /> {t('profile.itinerary.menu_4_1', '4.1 Seminário')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.itinerary.menu_4_1', '4.1 Seminário'), 'print-itinerario-41')}>
                        <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                      </button>
                    )}
                  </div>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_1_1', '4.1.1 Seminário Menor'), etapaKey: '4.1.1' },
                    { label: t('profile.itinerary.stages.s4_1_2', '4.1.2 Propedêutico'), etapaKey: '4.1.2' },
                    { label: t('profile.itinerary.stages.s4_1_3', '4.1.3 Filosofia'), etapaKey: '4.1.3' },
                    { label: t('profile.itinerary.stages.s4_1_4', '4.1.4 Postulado'), etapaKey: '4.1.4' },
                    { label: t('profile.itinerary.stages.s4_1_5', '4.1.5 Noviciado'), etapaKey: '4.1.5' },
                    { label: t('profile.itinerary.stages.s4_1_6', '4.1.6 Teologia'), etapaKey: '4.1.6' },
                    { label: t('profile.itinerary.stages.s4_1_7', '4.1.7 Tirocínio'), etapaKey: '4.1.7' },
                  ], 'icon-itin-seminario', <GraduationCap size={20} />)}
                </div>
              </div>
            )}

            {/* --- 4.2 VIDA RELIGIOSA --- */}
            {activeTab === 'itin_4.2' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-42">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Heart size={16} /> {t('profile.itinerary.menu_4_2', '4.2 Vida Religiosa')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.itinerary.menu_4_2', '4.2 Vida Religiosa'), 'print-itinerario-42')}>
                        <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                      </button>
                    )}
                  </div>
                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_2_1', '4.2.1 Primeira Profissão')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_2_1_1', '4.2.1.1 Relatório do Mestre'), etapaKey: '4.2.1.1' },
                    { label: t('profile.itinerary.stages.s4_2_1_2', '4.2.1.2 Pedido do noviço'), etapaKey: '4.2.1.2' },
                    { label: t('profile.itinerary.stages.s4_2_1_3', '4.2.1.3 Declaração de cessão da administração de bens'), etapaKey: '4.2.1.3' },
                    { label: t('profile.itinerary.stages.s4_2_1_4', '4.2.1.4 Admissão'), etapaKey: '4.2.1.4' },
                    { label: t('profile.itinerary.stages.s4_2_1_5', '4.2.1.5 Fórmula manuscrita'), etapaKey: '4.2.1.5' },
                    { label: t('profile.itinerary.stages.s4_2_1_6', '4.2.1.6 Delegação para receber os votos'), etapaKey: '4.2.1.6' },
                    { label: t('profile.itinerary.stages.s4_2_1_7', '4.2.1.7 Lugar (Primeira Profissão)'), etapaKey: '4.2.1.7' },
                  ], 'icon-itin-religiosa', <Heart size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_2_2', '4.2.2 Renovação dos Votos')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_2_2_1', '4.2.2.1 Relatório do Formador'), etapaKey: '4.2.2.1' },
                    { label: t('profile.itinerary.stages.s4_2_2_2', '4.2.2.2 Pedido do religioso'), etapaKey: '4.2.2.2' },
                    { label: t('profile.itinerary.stages.s4_2_2_3', '4.2.2.3 Admissão Fórmula manuscrita'), etapaKey: '4.2.2.3' },
                    { label: t('profile.itinerary.stages.s4_2_2_4', '4.2.2.4 Delegação para receber os votos'), etapaKey: '4.2.2.4' },
                  ], 'icon-itin-religiosa', <Heart size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_2_3', '4.2.3 Profissão Perpétua')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_2_3_1', '4.2.3.1 Relatório do Formador'), etapaKey: '4.2.3.1' },
                    { label: t('profile.itinerary.stages.s4_2_3_2', '4.2.3.2 Pedido do religioso'), etapaKey: '4.2.3.2' },
                    { label: t('profile.itinerary.stages.s4_2_3_3', '4.2.3.3 Declaração de nada exigir'), etapaKey: '4.2.3.3' },
                    { label: t('profile.itinerary.stages.s4_2_3_4', '4.2.3.4 Testamento particular'), etapaKey: '4.2.3.4' },
                    { label: t('profile.itinerary.stages.s4_2_3_5', '4.2.3.5 Declaração Nada Obsta'), etapaKey: '4.2.3.5' },
                    { label: t('profile.itinerary.stages.s4_2_3_6', '4.2.3.6 Admissão'), etapaKey: '4.2.3.6' },
                    { label: t('profile.itinerary.stages.s4_2_3_7', '4.2.3.7 Fórmula manuscrita'), etapaKey: '4.2.3.7' },
                    { label: t('profile.itinerary.stages.s4_2_3_8', '4.2.3.8 Delegação para receber os votos'), etapaKey: '4.2.3.8' },
                    { label: t('profile.itinerary.stages.s4_2_3_9', '4.2.3.9 Notificação à paróquia de batismo'), etapaKey: '4.2.3.9' },
                    { label: t('profile.itinerary.stages.s4_2_3_10', '4.2.3.10 Lugar (Profissão Perpétua)'), etapaKey: '4.2.3.10' },
                  ], 'icon-itin-religiosa', <Heart size={20} />)}
                </div>
              </div>
            )}

            {/* --- 4.3 MINISTÉRIOS --- */}
            {activeTab === 'itin_4.3' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-43">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Church size={16} /> {t('profile.itinerary.menu_4_3', '4.3 Ministérios')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.itinerary.menu_4_3', '4.3 Ministérios'), 'print-itinerario-43')}>
                        <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                      </button>
                    )}
                  </div>
                  <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_3_1', '4.3.1 Leitorado')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_3_1_1', '4.3.1.1 Apresentação'), etapaKey: '4.3.1.1' },
                    { label: t('profile.itinerary.stages.s4_3_1_2', '4.3.1.2 Pedido'), etapaKey: '4.3.1.2' },
                    { label: t('profile.itinerary.stages.s4_3_1_3', '4.3.1.3 Admissão'), etapaKey: '4.3.1.3' },
                    { label: t('profile.itinerary.stages.s4_3_1_4', '4.3.1.4 Certificado'), etapaKey: '4.3.1.4' },
                  ], 'icon-itin-ministerios', <Church size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_3_2', '4.3.2 Acolitado')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_3_2_1', '4.3.2.1 Apresentação'), etapaKey: '4.3.2.1' },
                    { label: t('profile.itinerary.stages.s4_3_2_2', '4.3.2.2 Pedido'), etapaKey: '4.3.2.2' },
                    { label: t('profile.itinerary.stages.s4_3_2_3', '4.3.2.3 Admissão'), etapaKey: '4.3.2.3' },
                    { label: t('profile.itinerary.stages.s4_3_2_4', '4.3.2.4 Certificado'), etapaKey: '4.3.2.4' },
                  ], 'icon-itin-ministerios', <Church size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_3_3', '4.3.3 Diaconato')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_3_3_1', '4.3.3.1 Relatório do Formador'), etapaKey: '4.3.3.1' },
                    { label: t('profile.itinerary.stages.s4_3_3_2', '4.3.3.2 Pedido do religioso'), etapaKey: '4.3.3.2' },
                    { label: t('profile.itinerary.stages.s4_3_3_3', '4.3.3.3 Declaração dos estudos teológicos'), etapaKey: '4.3.3.3' },
                    { label: t('profile.itinerary.stages.s4_3_3_4', '4.3.3.4 Declaração Nada Obsta'), etapaKey: '4.3.3.4' },
                    { label: t('profile.itinerary.stages.s4_3_3_5', '4.3.3.5 Admissão'), etapaKey: '4.3.3.5' },
                    { label: t('profile.itinerary.stages.s4_3_3_6', '4.3.3.6 Cartas dimissórias'), etapaKey: '4.3.3.6' },
                    { label: t('profile.itinerary.stages.s4_3_3_7', '4.3.3.7 Ata de ordenação'), etapaKey: '4.3.3.7' },
                    { label: t('profile.itinerary.stages.s4_3_3_8', '4.3.3.8 Notificação à paróquia de batismo'), etapaKey: '4.3.3.8' },
                  ], 'icon-itin-ministerios', <Church size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_3_4', '4.3.4 Presbiterado')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_3_4_1', '4.3.4.1 Relatório do Formador'), etapaKey: '4.3.4.1' },
                    { label: t('profile.itinerary.stages.s4_3_4_2', '4.3.4.2 Pedido do diácono'), etapaKey: '4.3.4.2' },
                    { label: t('profile.itinerary.stages.s4_3_4_3', '4.3.4.3 Declaração dos estudos teológicos'), etapaKey: '4.3.4.3' },
                    { label: t('profile.itinerary.stages.s4_3_4_4', '4.3.4.4 Declaração Nada Obsta'), etapaKey: '4.3.4.4' },
                    { label: t('profile.itinerary.stages.s4_3_4_5', '4.3.4.5 Admissão'), etapaKey: '4.3.4.5' },
                    { label: t('profile.itinerary.stages.s4_3_4_6', '4.3.4.6 Cartas dimissórias'), etapaKey: '4.3.4.6' },
                    { label: t('profile.itinerary.stages.s4_3_4_7', '4.3.4.7 Ata de ordenação'), etapaKey: '4.3.4.7' },
                    { label: t('profile.itinerary.stages.s4_3_4_8', '4.3.4.8 Notificação à paróquia de batismo'), etapaKey: '4.3.4.8' },
                  ], 'icon-itin-ministerios', <Church size={20} />)}

                  <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#013375', fontSize: '1rem', fontWeight: 700 }}>{t('profile.itinerary.h_4_3_5', '4.3.5 Primeira destinação missionária')}</h4>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.stages.s4_3_5_1', '4.3.5.1 Carta do religioso'), etapaKey: '4.3.5.1' },
                    { label: t('profile.itinerary.stages.s4_3_5_2', '4.3.5.2 Relatório'), etapaKey: '4.3.5.2' },
                    { label: t('profile.itinerary.stages.s4_3_5_3', '4.3.5.3 Parecer do Superior Regional'), etapaKey: '4.3.5.3' },
                  ], 'icon-itin-ministerios', <Church size={20} />)}
                </div>
              </div>
            )}

            {/* --- 4.4 DESTINAÇÃO --- */}
            {activeTab === 'itin_4.4' && (
              <div className="tab-panel">
                <div className="section-card" id="print-itinerario-44">
                  <div className="section-header-flex">
                    <h3 className="section-title"><MapPin size={16} /> {t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção'), 'print-itinerario-44')}>
                          <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                        </button>
                      )}
                      {canEdit && (
                        <button
                          className="btn-action-lite-text"
                          onClick={() => openItinEditModal(t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção'), `4.4-${Date.now()}`, { etapa: `4.4-${Date.now()}`, is_sub_etapa: true })}
                        >
                          <Plus size={14} /> <span>{t('profile.labels.add_item', 'Adicionar')}</span>
                        </button>
                      )}
                    </div>
                  </div>
                  {renderItinSubItems([
                    { label: t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção'), etapaKey: '4.4' },
                  ], 'icon-itin-destinacao', <MapPin size={20} />)}
                </div>
              </div>
            )}



            {/* --- 5. FORMAÇÃO ACADÊMICA --- */}
            {activeTab === 'formacao_academica' && (
              <div className="tab-panel">
                <div className="section-card" id="print-formacao">
                  <div className="section-header-flex">
                    <h3 className="section-title"><GraduationCap size={16} /> {t('profile.tabs.formacao_academica', '5. Formação Acadêmica')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.formacao_academica', '5. Formação Acadêmica'), 'print-formacao')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => { setEditingFormacao(null); setTempForm({}); setShowAddForm('formacao'); }}>
                          <Plus size={14} /> <span>{t('profile.labels.add_item', 'Adicionar')}</span>
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
                                <strong>{t('profile.ui.obs_short', 'Obs')}:</strong> {f.observacoes}
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
                                  <FileText size={14} /> {t('profile.ui.view_proof_attachment', 'Visualizar Comprovante / Anexo')}
                                </a>
                              </div>
                            )}
                          </div>
                          <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                            {f.doc_path && (
                              <a href={getFileUrl(f.doc_path) || '#'} target="_blank" rel="noreferrer" className="btn-action-lite" title={t('profile.ui.view_doc', 'Visualizar Documento')}>
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
                                  title={t('common.edit', 'Editar')}
                                >
                                  <Edit size={14} />
                                </button>
                                <button className="btn-action-lite delete" onClick={() => handleGenericDelete('formacao-academica', f.id)} title={t('common.delete', 'Excluir')}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {formacaoAcademica.length === 0 && <p className="empty-msg">{t('profile.academic.empty', 'Nenhuma formação acadêmica registrada.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 6. ATIVIDADE MISSIONÁRIA --- */}
            {activeTab === 'atividade_missionaria' && (
              <div className="tab-panel">
                <div className="section-card" id="print-atividade">
                  <div className="section-header-flex">
                    <h3 className="section-title"><MapPin size={16} /> {t('profile.tabs.atividade_missionaria', '6. Atividade Missionária')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.atividade_missionaria', '6. Atividade Missionária'), 'print-atividade')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => { setEditingAtividade(null); setTempForm({}); setShowAddForm('atividade'); }}>
                          <Plus size={14} /> <span>{t('profile.labels.add_item', 'Adicionar')}</span>
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
                                    {funcaoLabel(fun.trim())}
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
                                  title={t('common.edit', 'Editar')}
                                >
                                  <Edit size={14} />
                                </button>
                                <button className="btn-action-lite delete" onClick={() => handleGenericDelete('atividade-missionaria', a.id)} title={t('common.delete', 'Excluir')}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    {atividadesMissionarias.length === 0 && <p className="empty-msg">{t('profile.activity.empty', 'Nenhuma atividade missionária registrada.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 7. SAÚDE --- */}
            {activeTab === 'saude_individual' && (
              <div className="tab-panel">
                <div className="section-card" id="print-saude">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Activity size={16} /> {t('profile.tabs.saude_individual', '7. Saúde')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.saude_individual', '7. Saúde'), 'print-saude')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && (
                        <button className="btn-action-lite-text" onClick={() => setShowAddForm('saude')}>
                          <Plus size={14} /> <span>{t('profile.ui.add_record', 'Adicionar Registro')}</span>
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
                          <strong>{s.seguradora || t('profile.health.insurer_not_informed', 'Seguradora não informada')}</strong>
                          <div className="item-subtitle">CNS: {s.sus_card || 'N/A'} • {t('profile.health.card', 'Carteira')}: {s.numero_carteira || 'N/A'}</div>
                          {s.doc_path && (
                            <a
                              href={getFileUrl(s.doc_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginTop: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#065f46', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '4px 10px', textDecoration: 'none' }}
                            >
                              {/\.(jpe?g|png|webp)$/i.test(s.doc_path) ? (
                                <img src={getFileUrl(s.doc_path) || ''} alt="" style={{ height: '28px', width: 'auto', borderRadius: '4px', objectFit: 'cover' }} />
                              ) : (
                                <FileText size={14} />
                              )}
                              {t('profile.health.view_card_attachment', 'Ver cartão do SUS / convênio')}
                            </a>
                          )}
                        </div>
                        <div className="item-actions-premium" style={{ display: 'flex', gap: '8px' }}>
                          {s.doc_path && (
                            <a
                              href={getFileUrl(s.doc_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-action-lite"
                              title={t('profile.health.view_card', 'Visualizar Carteirinha / Documento')}
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
                                title={t('common.edit', 'Editar')}
                              >
                                <Edit size={14} />
                              </button>
                              <button className="btn-action-lite delete" onClick={() => handleGenericDelete('saude', s.id)} title={t('common.delete', 'Excluir')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {saudeRecords.length === 0 && <p className="empty-msg">{t('profile.health.empty', 'Nenhum registro de saúde cadastrado.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 8. PREVIDENCIÁRIO / IR --- */}
            {activeTab === 'previdenciario' && (
              <div className="tab-panel">
                <div className="section-card" id="print-previdenciario">
                  <div className="section-header-flex">
                    <h3 className="section-title"><ShieldCheck size={16} /> {t('profile.tabs.previdenciario', '8. Previdenciário / IR')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.previdenciario', '8. Previdenciário / IR'), 'print-previdenciario')}>
                        <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                      </button>
                    )}
                  </div>
                  <div className="form-group" style={{ maxWidth: '400px', marginTop: '15px' }}>
                    <label>{t('profile.labels.nit', 'NIT (Número de Identificação do Trabalhador)')}</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input type="text" value={nit} onChange={e => setNit(e.target.value)} disabled={!canEdit} placeholder={t('profile.social.nit_placeholder', 'Digite o NIT...')} />
                      {canEdit && <button className="btn-save-perfil" onClick={saveCivil} style={{ padding: '0 15px' }} title={t('profile.social.save_nit', 'Salvar NIT')}><Save size={16} /></button>}
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
                    <h3 className="section-title"><DollarSign size={16} /> {t('profile.tabs.contas_bancarias', '9. Contas Bancárias')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.contas_bancarias', '9. Contas Bancárias'), 'print-banco')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && <button className="btn-action-lite-text" onClick={() => setShowAddForm('banco')}><Plus size={14} /> <span>{t('profile.labels.add_item', 'Adicionar')}</span></button>}
                    </div>
                  </div>
                  <div className="generic-list">
                    {contasBancarias.map(b => (
                      <div key={b.id} className="list-item-card-premium" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="item-icon-container icon-banco">
                              <DollarSign size={20} />
                            </div>
                            <div className="item-main-content">
                              <strong style={{ fontSize: '1rem', color: '#0f172a' }}>
                                {b.banco ? b.banco : (b.tipo_conta || t('profile.bank.account_fallback', 'Conta Bancária'))}
                              </strong>
                              <div className="item-subtitle" style={{ marginTop: '2px', color: '#475569' }}>
                                {b.banco && <span style={{ fontWeight: 600, marginRight: '6px' }}>{b.tipo_conta} •</span>}
                                <span>{t('profile.bank.holder', 'Titular')}: <strong>{b.titularidade || t('profile.bank.not_informed_f', 'Não informada')}</strong></span>
                                <span style={{ marginLeft: '10px' }}>{t('profile.bank.agency_short', 'Ag')}: <strong>{b.agencia || '---'}</strong> • {t('profile.bank.account_short', 'Conta')}: <strong>{b.numero || '---'}</strong></span>
                              </div>
                            </div>
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
                                  title={t('common.edit', 'Editar')}
                                >
                                  <Edit size={14} />
                                </button>
                                <button className="btn-action-lite delete" onClick={() => handleGenericDelete('contas-bancarias', b.id)} title={t('common.delete', 'Excluir')}>
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </div>

                        {b.observacoes && (
                          <div style={{
                            background: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '8px 12px',
                            fontSize: '0.85rem',
                            color: '#334155',
                            marginTop: '2px',
                            marginLeft: '44px'
                          }}>
                            <span style={{ fontWeight: 600, color: '#64748b', marginRight: '6px' }}>{t('profile.ui.observations', 'Observações')}:</span>
                            {b.observacoes}
                          </div>
                        )}
                      </div>
                    ))}
                    {contasBancarias.length === 0 && <p className="empty-msg">{t('profile.bank.empty', 'Nenhuma conta bancária registrada.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 10. OBRAS REALIZADAS --- */}
            {activeTab === 'formacao_missao' && (
              <div className="tab-panel">
                <div className="section-card" id="print-obras">
                  <div className="section-header-flex">
                    <h3 className="section-title"><Star size={16} /> {t('profile.tabs.formacao_missao', '10. Obras Realizadas')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.formacao_missao', '10. Obras Realizadas'), 'print-obras')}>
                          <Printer size={15} /> <span>{t('profile.ui.print', 'Imprimir')}</span>
                        </button>
                      )}
                      {canEdit && <button className="btn-action-lite-text" onClick={() => { setEditingObra(null); setTempForm({}); setShowAddForm('obras'); }}><Plus size={14} /> <span>{t('profile.labels.add_item', 'Adicionar')}</span></button>}
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
                                title={t('common.edit', 'Editar')}
                              >
                                <Edit size={14} />
                              </button>
                              <button className="btn-action-lite delete" onClick={() => handleGenericDelete('obras-realizadas', o.id)} title={t('common.delete', 'Excluir')}>
                                <Trash2 size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    {obrasRealizadas.length === 0 && <p className="empty-msg">{t('profile.works.empty', 'Nenhuma obra registrada.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 11. OBSERVAÇÕES --- */}
            {activeTab === 'obs' && (
              <div className="tab-panel">
                <div className="section-card" id="print-obs">
                  <div className="section-header-flex">
                    <h3 className="section-title"><FileText size={16} /> {t('profile.tabs.obs', '11. Observações')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {canPrint && (
                        <button className="btn-action-lite-text" onClick={() => printSection(t('profile.tabs.obs', '11. Observações'), 'print-obs')}>
                          <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                        </button>
                      )}
                      {canEdit && <button className="btn-save-perfil" onClick={() => setShowAddForm('obs')}><Plus size={16} /> {t('profile.obs.new_btn', 'Nova Obs')}</button>}
                    </div>
                  </div>
                  <div className="obs-list" style={{ marginTop: '20px' }}>
                    {observacoesGerais.map(o => (
                      <div key={o.id} className="obs-entry-card">
                        <div className="obs-date">{new Date(o.created_at).toLocaleString(getDateLocale())}</div>
                        <div className="obs-text">{o.texto}</div>
                        {canEdit && (
                          <div className="obs-actions">
                            <button className="btn-action-lite delete" onClick={() => handleGenericDelete('observacoes-gerais', o.id)}><Trash2 size={14} /></button>
                          </div>
                        )}
                      </div>
                    ))}
                    {observacoesGerais.length === 0 && <p className="empty-msg">{t('profile.obs.empty', 'Nenhuma observação registrada.')}</p>}
                  </div>
                </div>
              </div>
            )}

            {/* --- 12. CURRICULUM VITAE --- */}
            {activeTab === 'quadro_pessoal' && (
              <div className="tab-panel">
                {/* Links Externos */}
                <div className="section-card" style={{ marginBottom: '20px' }}>
                  <div className="section-header-flex">
                    <div>
                      <h3 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Globe size={18} /> {t('profile.links.title', 'Links Externos (Perfis Profissionais / Pessoais)')}
                      </h3>
                      <p className="section-subtitle" style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                        {t('profile.links.subtitle', 'URLs de perfis externos do missionário (ex: LinkedIn, Plataforma Lattes, ORCID, Portfólio, Site Pessoal).')}
                      </p>
                    </div>
                    {canEdit && (
                      <button
                        type="button"
                        className="btn-action-lite-text"
                        onClick={() => setIsEditingLinks(!isEditingLinks)}
                      >
                        <Edit size={14} /> {isEditingLinks ? t('profile.links.close_edit', 'Fechar Edição') : t('profile.links.edit_all', 'Edição em Massa')}
                      </button>
                    )}
                  </div>

                  {/* Direct single-link insertion form */}
                  {canEdit && !isEditingLinks && (
                    <div className="cv-add-link-form" style={{ marginTop: '16px', marginBottom: '16px' }}>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: '1 1 320px' }}>
                          <Globe size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                          <input
                            type="url"
                            placeholder={t('profile.links.add_placeholder', 'Cole aqui a URL (ex: https://linkedin.com/in/... ou http://lattes.cnpq.br/...)')}
                            value={newSingleLinkUrl}
                            onChange={e => setNewSingleLinkUrl(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddSingleLink();
                              }
                            }}
                            style={{
                              width: '100%',
                              padding: '10px 14px 10px 38px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              fontSize: '0.9rem',
                              outline: 'none',
                              boxSizing: 'border-box'
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          className="btn-save-perfil"
                          onClick={handleAddSingleLink}
                          disabled={!newSingleLinkUrl.trim() || isSavingLinks}
                          style={{
                            padding: '10px 18px',
                            fontSize: '0.875rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            background: '#013375',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: !newSingleLinkUrl.trim() || isSavingLinks ? 'not-allowed' : 'pointer',
                            opacity: !newSingleLinkUrl.trim() || isSavingLinks ? 0.6 : 1
                          }}
                        >
                          {isSavingLinks ? <Loader2 className="animate-spin" size={15} /> : <Plus size={16} />}
                          {t('profile.links.add_btn', 'Adicionar Link')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bulk edit / list of links */}
                  {isEditingLinks ? (
                    <div className="cv-links-edit-box">
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '6px', color: '#1e293b' }}>
                        {t('profile.links.bulk_label', 'URLs de Perfis Externos (separe múltiplos links por quebra de linha, vírgula ou ponto e vírgula):')}
                      </label>
                      <textarea
                        className="form-control"
                        rows={4}
                        placeholder="https://www.linkedin.com/in/...&#10;http://lattes.cnpq.br/...&#10;https://meuportfolio.com"
                        value={linksExternosInput}
                        onChange={e => setLinksExternosInput(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit',
                          marginBottom: '12px',
                          boxSizing: 'border-box'
                        }}
                      />
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="btn-back"
                          style={{ padding: '6px 14px', fontSize: '0.85rem' }}
                          onClick={() => {
                            setLinksExternosInput(quadroPessoal?.links_externos || '');
                            setIsEditingLinks(false);
                          }}
                          disabled={isSavingLinks}
                        >
                          {t('common.cancel', 'Cancelar')}
                        </button>
                        <button
                          type="button"
                          className="btn-save-perfil"
                          style={{ padding: '6px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => handleSaveLinksExternos()}
                          disabled={isSavingLinks}
                        >
                          {isSavingLinks ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          {t('profile.links.save_links', 'Salvar Links')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {parseExternalLinks(quadroPessoal?.links_externos).length > 0 ? (
                        <div className="cv-links-grid">
                          {parseExternalLinks(quadroPessoal?.links_externos).map((item, idx) => (
                            <div key={idx} className={`cv-link-card-container badge-${item.badgeType}`}>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noreferrer"
                                className="cv-link-card-main"
                                title={`${t('profile.links.open', 'Abrir')} ${item.url}`}
                              >
                                <div className="cv-link-icon">
                                  <ExternalLink size={16} />
                                </div>
                                <div className="cv-link-content">
                                  <span className="cv-link-label">{item.label}</span>
                                  <span className="cv-link-url">{item.url}</span>
                                </div>
                              </a>
                              {canEdit && (
                                <button
                                  type="button"
                                  className="btn-delete-link"
                                  title={t('profile.links.delete_tooltip', 'Excluir link')}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDeleteLink(idx);
                                  }}
                                >
                                  <Trash2 size={16} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="cv-links-empty">
                          <Globe size={28} style={{ color: '#94a3b8', marginBottom: '8px' }} />
                          <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                            {t('profile.links.empty', 'Nenhum link externo cadastrado.')}
                          </p>
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '4px' }}>
                            {t('profile.links.empty_hint', 'Insira o link de LinkedIn, Lattes, ORCID ou portfólio no campo acima.')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Arquivo do Curriculum Vitae */}
                <div className="section-card" id="print-quadro">
                  <div className="section-header-flex">
                    <h3 className="section-title"><FileText size={18} /> {t('profile.cv.file_title', 'Arquivo Anexo do CV')}</h3>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      {quadroPessoal?.cv_path && (
                        <>
                          <a
                            href={getFileUrl(quadroPessoal.cv_path) || '#'}
                            target="_blank"
                            rel="noreferrer"
                            className="btn-action-lite-text"
                            style={{ textDecoration: 'none' }}
                            title={t('profile.cv.open_new_tab', 'Abrir arquivo em nova aba')}
                          >
                            <Eye size={15} /> {t('profile.cv.view_file', 'Visualizar Arquivo')}
                          </a>
                          <button
                            className="btn-action-lite-text"
                            onClick={() => handlePrintCvFile(quadroPessoal.cv_path || '')}
                            title={t('profile.cv.print_attached', 'Imprimir arquivo anexado')}
                          >
                            <Printer size={15} /> {t('profile.cv.print_cv', 'Imprimir CV')}
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
                          {quadroPessoal?.cv_path ? t('profile.cv.replace_cv', 'Substituir CV') : t('profile.cv.attach_cv', 'Anexar CV')}
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
                          <h4>{t('profile.cv.heading', 'Curriculum Vitae do Missionário')}</h4>
                          <p className="cv-filename">
                            {quadroPessoal.cv_path.split('/').pop() || 'Curriculum_Vitae.pdf'}
                          </p>
                          <div className="cv-badges">
                            <span className="cv-status-badge">✓ {t('profile.cv.attached_badge', 'Arquivo Anexado')}</span>
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
                            title={t('profile.cv.open_tab', 'Abrir em nova aba')}
                          >
                            <Eye size={15} /> {t('profile.ui.view', 'Visualizar')}
                          </a>
                          <button
                            className="cv-btn-print"
                            onClick={() => handlePrintCvFile(quadroPessoal.cv_path || '')}
                            title={t('profile.cv.print_doc', 'Imprimir documento')}
                          >
                            <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                          </button>
                          {canEdit && (
                            <>
                              <button
                                className="cv-btn-replace"
                                onClick={() => cvFileInputRef.current?.click()}
                                title={t('profile.cv.replace_title', 'Substituir por outro arquivo')}
                              >
                                <Upload size={15} /> {t('profile.cv.replace', 'Substituir')}
                              </button>
                              <button
                                className="cv-btn-delete"
                                onClick={handleDeleteCv}
                                title={t('profile.cv.delete_file', 'Excluir arquivo')}
                              >
                                <Trash2 size={15} /> {t('common.delete', 'Excluir')}
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
                            title={t('profile.cv.preview_title', 'Visualização do Curriculum Vitae')}
                            className="cv-iframe-preview"
                          />
                        ) : /\.(jpe?g|png|webp|gif)$/i.test(quadroPessoal.cv_path) ? (
                          <div className="cv-image-preview-wrapper">
                            <img
                              src={getFileUrl(quadroPessoal.cv_path) || ''}
                              alt={t('profile.modal.cv', 'Curriculum Vitae')}
                              className="cv-image-preview"
                            />
                          </div>
                        ) : (
                          <div className="cv-doc-preview-placeholder">
                            <FileText size={48} />
                            <p>{t('profile.cv.attached_format', 'Documento anexado no formato')} <strong>{quadroPessoal.cv_path.split('.').pop()?.toUpperCase()}</strong>.</p>
                            <a
                              href={getFileUrl(quadroPessoal.cv_path) || '#'}
                              target="_blank"
                              rel="noreferrer"
                              className="cv-btn-view-large"
                            >
                              <Eye size={18} /> {t('profile.cv.open_view_file', 'Abrir e Visualizar Arquivo')}
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
                      <h4>{t('profile.cv.empty_title', 'Nenhum Curriculum Vitae Anexado')}</h4>
                      <p>
                        {canEdit 
                          ? t('profile.cv.empty_hint_edit', 'Clique aqui para anexar o arquivo do Curriculum Vitae (PDF, Imagens ou Documentos).')
                          : t('profile.cv.empty_hint_view', 'Nenhum arquivo de currículo foi disponibilizado para este missionário.')}
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
                          <Plus size={16} /> {t('profile.cv.attach_cv_file', 'Anexar Arquivo do CV')}
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
                    <h3 className="section-title"><Plus size={16} /> {t('profile.sections.bind_house', 'Presença Missionária')}</h3>
                    <div className="form-grid-3 casa-bind-grid">
                      <div className="form-group">
                        <label>{t('missionaries.wizard.houses.select_house')}</label>
                        <select value={novaVinculacao.casa_id} onChange={e => setNovaVinculacao(p => ({ ...p, casa_id: e.target.value }))}>
                          <option value="">{t('profile.ui.select', 'Selecione...')}</option>
                          {casasDisponiveis.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.type', 'Tipo')}</label>
                        <select value={(novaVinculacao as any).tipo || ''} onChange={e => setNovaVinculacao(p => ({ ...p, tipo: e.target.value }))}>
                          <option value="">{t('profile.ui.select', 'Selecione...')}</option>
                          <option value="CI">{t('profile.casas.type_ci', 'Casas de Idosos – CI')}</option>
                          <option value="CR">{t('profile.casas.type_cr', 'Casas Religiosas – CR')}</option>
                          <option value="M">{t('profile.casas.type_m', 'Obras – M')}</option>
                          <option value="P">{t('profile.casas.type_p', 'Paróquia – P')}</option>
                          <option value="PV">{t('profile.casas.type_pv', 'Pastoral Vocacional - PV')}</option>
                          <option value="CS">{t('profile.casas.type_cs', 'Seminário - CS')}</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.pm', 'PM')}</label>
                        <input type="text" value={(novaVinculacao as any).pm || ''} onChange={e => setNovaVinculacao(p => ({ ...p, pm: e.target.value }))} placeholder={t('profile.casas.pm_placeholder', 'Ex: CR 13')} />
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.country', 'País')}</label>
                        <input type="text" list="paises-list" value={(novaVinculacao as any).pais || 'Brasil'} onChange={e => setNovaVinculacao(p => ({ ...p, pais: e.target.value }))} placeholder={t('profile.ui.select_or_type', 'Selecione ou digite...')} />
                        <datalist id="paises-list">
                          {PAISES_COMMON.map(p => <option key={p} value={p} />)}
                        </datalist>
                      </div>
                      <div className="form-group"><label>{t('missionaries.wizard.houses.start_date')}</label><input type="date" value={novaVinculacao.data_inicio} onChange={e => setNovaVinculacao(p => ({ ...p, data_inicio: e.target.value }))} /></div>
                      <div className="form-group"><label>{t('profile.labels.exit_date_optional', 'Data de Saída (opcional)')}</label><input type="date" value={novaVinculacao.data_fim} onChange={e => setNovaVinculacao(p => ({ ...p, data_fim: e.target.value }))} /></div>
                    </div>
                    <button className="btn-save-perfil" onClick={addCasa} style={{ marginTop: '15px' }}><Plus size={16} /> {t('profile.actions.bind_btn')}</button>
                  </div>
                )}

                <div className="section-card" id="print-casas">
                  <div className="section-header-flex">
                    <h3 className="section-title"><HomeIcon size={16} /> {t('profile.sections.history_house', 'Histórico de Presença')}</h3>
                    {canPrint && (
                      <button className="btn-action-lite-text" onClick={() => printSection(t('profile.casas.history_title', 'Histórico de Presença Missionária'), 'print-casas')}>
                        <Printer size={15} /> {t('profile.ui.print', 'Imprimir')}
                      </button>
                    )}
                  </div>
                  <div className="casas-list">
                    {/* EXIBIR TODAS AS CASAS DO HISTÓRICO SEM O FILTRO RESTRITIVO DE FUNÇÃO */}
                    {casasHistorico.map(c => (
                      <div key={c.id} className={`casa-item ${!c.data_fim ? 'casa-ativa' : ''}`}>
                        <div className="casa-info">
                          <span className="casa-nome">{c.casa_nome}</span>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                            {c.is_superior && <span className="superior-badge"><Star size={11} /> {t('profile.casas.superior', 'Superior')}</span>}
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '6px', flexWrap: 'wrap' }}>
                              {Array.isArray(c.funcao) && c.funcao.length > 0 ? (
                                c.funcao.map((f, idx) => (
                                  <span key={idx} className="role-badge" style={{ background: '#eef2ff', color: '#1e3a8a', padding: '4px 8px', borderRadius: '8px', fontSize: '12px' }}>{funcaoLabel(f)}</span>
                                ))
                              ) : null}
                            </div>
                            <span className="duracao-pill" style={{ background: '#f0f4f8', fontSize: '11px', padding: '2px 6px', borderRadius: '4px' }}>⏱ {calcDuracao(c.data_inicio, c.data_fim)}</span>
                          </div>
                          <span className="casa-periodo" style={{ marginTop: '4px', display: 'block', fontSize: '12px', color: '#666' }}>
                            {formatDateLocal(c.data_inicio)} → {c.data_fim ? formatDateLocal(c.data_fim) : t('profile.casas.current', 'Atual')}
                          </span>
                        </div>
                        {canEdit && <button className="btn-action-lite delete" onClick={() => removeCasa(c.id)}><Trash2 size={16} /></button>}
                      </div>
                    ))}
                    {casasHistorico.length === 0 && <p className="empty-msg">{t('profile.casas.empty', 'Nenhuma casa vinculada.')}</p>}
                  </div>
                </div>
              </div>
            )}


            {/* --- PERMISSÕES --- */}
            {activeTab === 'permissoes' && (
              <div className="tab-panel">
                <div className="section-card">
                  <h3 className="section-title"><ShieldCheck size={16} /> {t('profile.perms.title', 'Permissões de Visualização')}</h3>
                  <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '20px' }}>
                    {t('profile.perms.subtitle', 'Abaixo estão as seções do cadastro que este missionário tem permissão para visualizar no seu próprio perfil.')}
                  </p>

                  <div className="pm-permissions-box" style={{ background: '#f8fafc', padding: '24px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(250px, 100%), 1fr))', gap: '15px' }}>
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
                              {t(`profile.permissions_list.${perm.id}`, perm.label)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {(isAdminGeral || canEdit) && (
                    <div style={{ marginTop: '20px', padding: '15px', background: '#eff6ff', borderRadius: '8px', color: '#1e40af', fontSize: '0.85rem' }}>
                      <strong>{t('profile.perms.admin_note', 'Nota de Administrador')}:</strong> {t('profile.perms.admin_note_text_1', 'Você pode alterar estas permissões na tela de')} <a href="#/administradores" style={{ color: '#013375', fontWeight: 700 }}>{t('profile.perms.access_management', 'Gestão de Acessos')}</a> {t('profile.perms.admin_note_text_2', 'ou editando o cadastro do missionário.')}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* --- MODAL CONFIRMAÇÃO SITUAÇÃO --- */}
            {showSituacaoConfirmModal && (
              <div className="modal-overlay">
                <div className="modal-content perfil-modal" style={{ maxWidth: '520px', width: '90%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: '#fef3c7', color: '#b45309', padding: '10px', borderRadius: '10px' }}>
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1e293b' }}>{t('profile.situation.confirm_title', 'Confirmar Alteração de Situação')}</h3>
                      <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>{t('profile.situation.confirm_audit', 'Registro de auditoria permanente')}</p>
                    </div>
                  </div>

                  <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '0.88rem', color: '#92400e' }}>
                    <strong>⚠️ {t('profile.situation.attention', 'Atenção')}:</strong> {t('profile.situation.confirm_warning', 'Esta alteração será gravada permanentemente no histórico deste perfil, registrando seu usuário e data/hora.')}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('profile.situation.previous', 'Situação Anterior')}</div>
                      <span className={`situacao-tag-premium ${(originalSituacao || 'ativo').toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                        {situacaoLabel(originalSituacao || 'Ativo')}
                      </span>
                    </div>
                    <div style={{ fontSize: '1.2rem', color: '#94a3b8' }}>➔</div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{t('profile.situation.new', 'Nova Situação')}</div>
                      <span className={`situacao-tag-premium ${(missionario.situacao || 'ativo').toLowerCase()}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                        {situacaoLabel(missionario.situacao)}
                      </span>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: '6px', display: 'block' }}>
                      {t('profile.situation.reason_label', 'Motivo / Observação da Mudança (Opcional):')}
                    </label>
                    <textarea
                      rows={3}
                      placeholder={t('profile.situation.reason_placeholder', 'Ex: Falecimento confirmado, decreto de transferência, laicização...')}
                      value={motivoSituacao}
                      onChange={e => setMotivoSituacao(e.target.value)}
                      style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }}
                    />
                  </div>

                  <div className="modal-actions" style={{ marginTop: 0, display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => {
                        setMissionario({ ...missionario, situacao: originalSituacao });
                        setShowSituacaoConfirmModal(false);
                      }}
                      disabled={isSaving}
                    >
                      {t('common.cancel', 'Cancelar')}
                    </button>
                    <button
                      type="button"
                      className="btn-save-perfil"
                      onClick={handleConfirmSituacaoSave}
                      disabled={isSaving}
                    >
                      {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                      {t('profile.ui.confirm_save', 'Confirmar e Salvar')}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* --- MODAL --- */}
            {showAddForm && (
              <div className="modal-overlay">
                <div className="modal-content perfil-modal" style={{ maxWidth: '600px', width: '90%' }}>
                  <h3>
                    {editingFormacao || editingAtividade || editingSaude || editingBanco || editingObra || (showAddForm === 'itinerario' && (tempForm.local || tempForm.periodo || tempForm.observacoes)) ? `${t('common.edit', 'Editar')} ` : `${t('profile.labels.add_item', 'Adicionar')} `}
                    {showAddForm === 'itinerario' ? (editingItinLabel || t('profile.modal.itinerary', 'Itinerário Formativo')) :
                      showAddForm === 'formacao' ? t('profile.modal.academic', 'Formação Acadêmica') :
                        showAddForm === 'atividade' ? t('profile.modal.activity', 'Atividade Missionária') :
                          showAddForm === 'obras' ? t('profile.modal.works', 'Obras Realizadas') :
                            showAddForm === 'saude' ? t('profile.modal.health', 'Registro de Saúde') :
                              showAddForm === 'banco' ? t('profile.modal.bank', 'Conta Bancária') :
                                showAddForm === 'quadro' ? t('profile.modal.cv', 'Curriculum Vitae') : t('profile.ui.observation', 'Observação')}
                  </h3>

                  <div className="form-grid-1" style={{ gap: '15px', marginTop: '15px' }}>
                    {showAddForm === 'itinerario' && (
                      <>
                        <div className="form-group">
                          <label>{t('profile.labels.period', 'Período')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.itin_period_placeholder', 'Ex: 01/01/2000 - 31/12/2004 ou 2000-2004')}
                            value={tempForm.periodo || ''}
                            onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.modal.place_institution', 'Local / Instituição')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.itin_place_placeholder', 'Ex: Seminário Menor São Carlos, Guaporé, RS')}
                            value={tempForm.local || ''}
                            onChange={e => setTempForm({ ...tempForm, local: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.ui.observation', 'Observação')}</label>
                          <textarea
                            rows={4}
                            placeholder={t('profile.modal.itin_obs_placeholder', 'Digite as observações sobre este período/etapa...')}
                            value={tempForm.observacoes || ''}
                            onChange={e => setTempForm({ ...tempForm, observacoes: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.modal.attach_doc_proof', 'Anexar Documento / Comprovante (PDF, JPG, PNG)')}</label>
                          {tempForm.doc_path ? (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: '#013375' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    {t('profile.modal.attachment_loaded', 'Anexo Carregado')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <a
                                    href={getFileUrl(tempForm.doc_path) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <Eye size={14} /> {t('profile.ui.view', 'Visualizar')}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setTempForm({ ...tempForm, doc_path: undefined })}
                                    style={{ fontSize: '0.85rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title={t('profile.modal.remove_attachment_resend', 'Remover anexo para reenviar')}
                                  >
                                    <Trash2 size={14} /> {t('profile.modal.delete_attachment', 'Excluir Anexo')}
                                  </button>
                                </div>
                              </div>
                              {/\.(jpe?g|png|webp)$/i.test(tempForm.doc_path) && (
                                <div style={{ marginTop: '10px' }}>
                                  <img
                                    src={getFileUrl(tempForm.doc_path) || ''}
                                    alt={t('profile.modal.preview', 'Preview')}
                                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="file-input-wrapper" style={{ marginTop: '6px' }}>
                              <FileInputButton
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  const fd = new FormData();
                                  fd.append('arquivo', file);
                                  fd.append('descricao', `Doc Etapa: ${editingItinEtapa || 'Itinerário'}`);
                                  try {
                                    const res = await api.post(`/usuarios/${id}/documentos`, fd, {
                                      headers: { 'Content-Type': 'multipart/form-data' }
                                    });
                                    const newPath = res.data.url || res.data.arquivo_path;
                                    setTempForm(prev => ({ ...prev, doc_path: newPath }));
                                  } catch {
                                    appAlert(t('profile.msgs.doc_load_error', 'Erro ao carregar documento'));
                                  }
                                }}
                                accept=".pdf,.jpg,.jpeg,.png"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {showAddForm === 'formacao' && (
                      <>
                        <div className="form-group">
                          <label>{t('profile.modal.course_required', 'Curso *')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.course_placeholder', 'Ex: Teologia, Filosofia, História...')}
                            value={tempForm.curso || ''}
                            onChange={e => setTempForm({ ...tempForm, curso: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.modal.institution_faculty', 'Instituição / Faculdade')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.institution_placeholder', 'Ex: PUC, USP...')}
                            value={tempForm.faculdade || ''}
                            onChange={e => setTempForm({ ...tempForm, faculdade: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.modal.formation_period', 'Data / Período de Formação')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.formation_period_placeholder', 'Ex: 2018-2022 ou 2022')}
                            value={tempForm.periodo || ''}
                            onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.ui.observations', 'Observações')}</label>
                          <textarea
                            rows={3}
                            placeholder={t('profile.modal.extra_obs_placeholder', 'Observações adicionais...')}
                            value={tempForm.observacoes || ''}
                            onChange={e => setTempForm({ ...tempForm, observacoes: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.modal.attach_doc_image', 'Anexar Documento / Imagem (Certificado, Diploma, Declaração)')}</label>
                          {tempForm.doc_path ? (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: '#013375' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    {t('profile.modal.attachment_loaded', 'Anexo Carregado')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <a
                                    href={getFileUrl(tempForm.doc_path) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <Eye size={14} /> {t('profile.ui.view', 'Visualizar')}
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setTempForm({ ...tempForm, doc_path: undefined })}
                                    style={{ fontSize: '0.85rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title={t('profile.modal.remove_attachment_resend', 'Remover anexo para reenviar')}
                                  >
                                    <Trash2 size={14} /> {t('profile.modal.delete_attachment', 'Excluir Anexo')}
                                  </button>
                                </div>
                              </div>
                              {/\.(jpe?g|png|webp)$/i.test(tempForm.doc_path) && (
                                <div style={{ marginTop: '10px' }}>
                                  <img
                                    src={getFileUrl(tempForm.doc_path) || ''}
                                    alt={t('profile.modal.preview', 'Preview')}
                                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="file-input-wrapper" style={{ marginTop: '6px' }}>
                              <FileInputButton
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
                          <label>{t('profile.modal.mission_place_required', 'Lugar / Local da Missão *')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.mission_place_placeholder', 'Ex: Paróquia São José - São Paulo, SP')}
                            value={tempForm.lugar || ''}
                            onChange={e => setTempForm({ ...tempForm, lugar: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.labels.period', 'Período')}</label>
                          <input
                            type="text"
                            placeholder={t('profile.modal.period_placeholder', 'Ex: 2020-2024 ou 2024')}
                            value={tempForm.periodo || ''}
                            onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })}
                          />
                        </div>

                        {/* Função da Atividade (Checkboxes movidos para cá) */}
                        <div className="form-group">
                          <label style={{ fontWeight: 700, color: '#013375', marginBottom: '8px', display: 'block' }}>
                            {t('profile.modal.activity_function', 'Função da Atividade')}
                          </label>
                          <div className="pm-grid-2" style={{ gap: '8px', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
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
                                  {funcaoLabel(r)}
                                </label>
                              );
                            })}
                          </div>

                          {/* Opção Outros */}
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>{t('profile.modal.other_functions', 'Outras Funções (preenchimento livre)')}</label>
                            <input
                              type="text"
                              placeholder={t('profile.modal.other_function_placeholder', 'Digite outra função se houver...')}
                              value={tempForm.outra_funcao || ''}
                              onChange={e => setTempForm({ ...tempForm, outra_funcao: e.target.value })}
                              style={{ marginTop: '4px', width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                            />
                          </div>
                        </div>

                        <div className="form-group">
                          <label>{t('profile.modal.mission_desc_activities', 'Descrição da Missão / Atividades')}</label>
                          <textarea
                            rows={3}
                            placeholder={t('profile.modal.mission_desc_placeholder', 'Descreva a missão realizada...')}
                            value={tempForm.missao || ''}
                            onChange={e => setTempForm({ ...tempForm, missao: e.target.value })}
                          />
                        </div>
                      </>
                    )}

                    {showAddForm === 'obras' && (
                      <>
                        <div className="form-group"><label>{t('profile.labels.place', 'Lugar')}</label><input type="text" value={tempForm.lugar || ''} onChange={e => setTempForm({ ...tempForm, lugar: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.period', 'Período')}</label><input type="text" value={tempForm.periodo || ''} onChange={e => setTempForm({ ...tempForm, periodo: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.work_done', 'Obra Realizada')}</label><textarea rows={3} value={tempForm.obra || ''} onChange={e => setTempForm({ ...tempForm, obra: e.target.value })} /></div>
                      </>
                    )}
                    {showAddForm === 'saude' && (
                      <>
                        <div className="form-group"><label>{t('profile.labels.cns', 'CNS (Cartão SUS)')}</label><input type="text" value={tempForm.sus_card || ''} onChange={e => setTempForm({ ...tempForm, sus_card: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.insurance', 'Seguradora')}</label><input type="text" value={tempForm.seguradora || ''} onChange={e => setTempForm({ ...tempForm, seguradora: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.wallet_num', 'Nº Carteira')}</label><input type="text" value={tempForm.numero_carteira || ''} onChange={e => setTempForm({ ...tempForm, numero_carteira: e.target.value })} /></div>
                        <div className="form-group">
                          <label>{t('profile.health.card_attachment', 'Cartão do SUS ou Convênio Médico (imagem ou PDF)')}</label>
                          {tempForm.doc_path ? (
                            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <FileText size={18} style={{ color: '#013375' }} />
                                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#334155' }}>
                                    {t('profile.modal.attachment_loaded', 'Anexo Carregado')}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                  <a
                                    href={getFileUrl(tempForm.doc_path) || '#'}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ fontSize: '0.85rem', color: '#1d4ed8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}
                                  >
                                    <Eye size={14} /> <span>{t('profile.ui.view', 'Visualizar')}</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setTempForm({ ...tempForm, doc_path: undefined })}
                                    style={{ fontSize: '0.85rem', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                    title={t('profile.modal.remove_attachment_resend', 'Remover anexo para reenviar')}
                                  >
                                    <Trash2 size={14} /> <span>{t('profile.modal.delete_attachment', 'Excluir Anexo')}</span>
                                  </button>
                                </div>
                              </div>
                              {/\.(jpe?g|png|webp)$/i.test(tempForm.doc_path) && (
                                <div style={{ marginTop: '10px' }}>
                                  <img
                                    src={getFileUrl(tempForm.doc_path) || ''}
                                    alt={t('profile.modal.preview', 'Preview')}
                                    style={{ maxHeight: '100px', maxWidth: '100%', objectFit: 'contain', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="file-input-wrapper" style={{ marginTop: '6px' }}>
                              <FileInputButton
                                onChange={e => uploadGenericDoc(e, 'saude')}
                                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                    {showAddForm === 'banco' && (
                      <>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>{t('profile.modal.bank_institution', 'Instituição Financeira / Banco')}</label>
                          <BankAutocomplete
                            value={tempForm.banco || ''}
                            onChange={val => setTempForm({ ...tempForm, banco: val })}
                            placeholder={t('profile.modal.bank_placeholder', 'Selecione ou digite o banco (ex: Nubank, Mercado Pago, C6, Inter, Itaú, BB...)')}
                          />
                        </div>
                        <div className="form-group"><label>{t('profile.labels.account_type', 'Tipo de Conta')}</label><input type="text" placeholder={t('profile.modal.account_type_placeholder', 'Ex: Corrente, Poupança, Salário, Pagamento')} value={tempForm.tipo_conta || ''} onChange={e => setTempForm({ ...tempForm, tipo_conta: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.ownership', 'Titularidade')}</label><input type="text" placeholder={t('profile.modal.holder_placeholder', 'Nome do titular da conta')} value={tempForm.titularidade || ''} onChange={e => setTempForm({ ...tempForm, titularidade: e.target.value })} /></div>
                        <div className="form-group">
                          <label>{t('profile.labels.agency', 'Agência')}</label>
                          <input
                            type="text"
                            maxLength={10}
                            placeholder={t('profile.modal.agency_placeholder', 'Ex: 0001 ou 1234-5')}
                            value={tempForm.agencia || ''}
                            onChange={e => setTempForm({ ...tempForm, agencia: e.target.value.replace(/[^0-9a-zA-Z\-/.]/g, '').slice(0, 10) })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.labels.account_num', 'Número Conta')}</label>
                          <input
                            type="text"
                            maxLength={16}
                            placeholder={t('profile.modal.account_num_placeholder', 'Ex: 12345678-9')}
                            value={tempForm.numero || ''}
                            onChange={e => setTempForm({ ...tempForm, numero: e.target.value.replace(/[^0-9a-zA-Z\-/.]/g, '').slice(0, 16) })}
                          />
                        </div>
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <label>{t('profile.modal.account_obs', 'Observações da Conta')}</label>
                          <textarea
                            rows={3}
                            placeholder={t('profile.modal.account_obs_placeholder', 'Observações relativas à conta bancária (chave PIX, finalidade, etc.)...')}
                            value={tempForm.observacoes || ''}
                            onChange={e => setTempForm({ ...tempForm, observacoes: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                    {showAddForm === 'quadro' && (
                      <>
                        <div className="form-group"><label>{t('profile.labels.current_function', 'Função Atual')}</label><input type="text" value={tempForm.funcao_atual || ''} onChange={e => setTempForm({ ...tempForm, funcao_atual: e.target.value })} /></div>
                        <div className="form-group"><label>{t('profile.labels.competencies_summary', 'Competências / Resumo')}</label><textarea rows={4} value={tempForm.competencias || ''} onChange={e => setTempForm({ ...tempForm, competencias: e.target.value })} /></div>
                        <div className="form-group">
                          <label>{t('profile.modal.external_links', 'Links Externos (URLs de perfis profissionais/pessoais)')}</label>
                          <textarea
                            rows={3}
                            placeholder={t('profile.modal.external_links_placeholder', 'Ex: https://www.linkedin.com/in/... ou http://lattes.cnpq.br/...')}
                            value={tempForm.links_externos || ''}
                            onChange={e => setTempForm({ ...tempForm, links_externos: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.labels.cv_doc', 'CV / Documento (PDF ou JPEG)')}</label>
                          <div className="file-input-wrapper">
                            <FileInputButton onChange={e => uploadGenericDoc(e, 'quadro-pessoal')} accept=".pdf,.jpg,.jpeg,.png" />
                          </div>
                        </div>
                      </>
                    )}
                    {showAddForm === 'obs' && (
                      <div className="form-group"><label>{t('profile.labels.obs_text', 'Texto da Observação')}</label><textarea rows={6} value={tempForm.texto || ''} onChange={e => setTempForm({ ...tempForm, texto: e.target.value })} /></div>
                    )}
                  </div>

                  <div className="modal-actions" style={{ marginTop: '25px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button
                      type="button"
                      className="btn-back"
                      onClick={() => {
                        setShowAddForm(null);
                        setEditingFormacao(null);
                        setEditingAtividade(null);
                        setEditingSaude(null);
                        setEditingBanco(null);
                        setEditingObra(null);
                        setEditingItinEtapa(null);
                        setEditingItinLabel(null);
                        setTempForm({});
                      }}
                    >
                      {t('common.cancel', 'Cancelar')}
                    </button>
                    <button
                      type="button"
                      className="btn-save-perfil"
                      disabled={isSaving}
                      onClick={async () => {
                        if (showAddForm === 'itinerario') {
                          const etapaKey = editingItinEtapa || tempForm.etapa || '4.4';
                          const existingIdx = itinerarioStages.findIndex(s => s.etapa === etapaKey);
                          let updated: ItineraryStage[];
                          if (existingIdx >= 0) {
                            updated = itinerarioStages.map((s, idx) => idx === existingIdx ? {
                              ...s,
                              local: tempForm.local || '',
                              periodo: tempForm.periodo || '',
                              observacoes: tempForm.observacoes || '',
                              doc_path: tempForm.doc_path !== undefined ? tempForm.doc_path : (s.doc_path || ''),
                              is_sub_etapa: s.is_sub_etapa || etapaKey.includes('-')
                            } : s);
                          } else {
                            updated = [...itinerarioStages, {
                              etapa: etapaKey,
                              local: tempForm.local || '',
                              periodo: tempForm.periodo || '',
                              observacoes: tempForm.observacoes || '',
                              doc_path: tempForm.doc_path || '',
                              is_sub_etapa: etapaKey.includes('-')
                            }];
                          }
                          setItinerarioStages(updated);
                          setIsSaving(true);
                          try {
                            await api.post(`/usuarios/${id}/itinerario`, { stages: updated });
                            setShowAddForm(null);
                            setEditingItinEtapa(null);
                            setEditingItinLabel(null);
                            setTempForm({});
                          } catch {
                            appAlert(t('profile.msgs.itinerary_save_error', 'Erro ao salvar itinerário'));
                          } finally {
                            setIsSaving(false);
                          }
                          return;
                        }

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
                      {t('profile.ui.confirm', 'Confirmar')}
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
