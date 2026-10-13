import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronLeft, User, MapPin, BookOpen, Lock, CheckCircle,
  Home as HomeIcon, Plus, Trash2, FileText, Image as ImageIcon,
  Activity, Users, Search, Filter, Eye, X, Loader2, AlertCircle,
  GraduationCap, DollarSign, Save, ShieldCheck, EyeOff, Star, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import { BankAutocomplete } from '../components/Common/BankAutocomplete';
import { appAlert } from '../components/Common/AppDialog';
import FileInputButton from '../components/Common/FileInputButton';
import { OBITO_ACCEPT, OBITO_INVALID_MSG, isValidObitoFile } from '../utils/obito';
import '../styles/Perfis.css';
import '../styles/Missionarios.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Missionario {
  id: number;
  nome: string;
  login: string;
  role: 'PADRE';
  status: 'ATIVO' | 'INATIVO';
  situacao: 'ATIVO' | 'FALECIDO' | 'EGRESSO' | 'EXCLAUSTRADO' | 'TRANSFERIDO';
  is_oconomo: boolean;
  is_superior: boolean;
  casa_nome?: string;
  cidade?: string;
  pais?: string;
  cidade_nascimento?: string;
  pais_nascimento?: string;
}

interface Casa {
  id: number;
  nome: string;
  tipo?: string;
  pm_code?: string;
  pais?: string;
  cidade?: string;
  regional?: string;
}

interface DocEntry {
  uid: string;         // temp local id
  descricao: string;
  file: File | null;
  previewUrl: string;
  tipo: string;        // 'pdf' | 'jpg' | 'png'
}

interface CasaVinculo {
  casa_id: string;
  data_inicio: string;
  data_fim?: string;
  is_superior: boolean;
  funcao?: string[];
  tipo?: string;
  pm?: string;
  pais?: string;
}

interface Contato {
  parentesco: string;
  nome: string;
  endereco: string;
  telefone: string;
  email: string;
}

interface WizardData {
  // Step 0 - Situação
  situacao: string;
  data_falecimento: string;
  cidade_falecimento: string;
  local_sepultamento: string;
  exclaustrado_data: string;
  exclaustrado_processo: string;
  transferido_data_inicio: string;
  transferido_data_fim: string;
  transferido_origem: string;
  transferido_destino: string;
  transferido_observacao: string;

  // Step 1 - Dados Civis
  nome: string;
  data_nascimento: string;
  nome_pai: string;
  nome_mae: string;
  naturalidade: string;
  pais: string;
  cidade_estado: string;
  diocese: string;
  rnm: string;
  cpf: string;
  titulo_eleitor: string;
  cnh: string;
  passaporte: string;
  nacionalidades: string[];

  // Step 2 - Contatos
  logradouro: string;
  complemento: string;
  bairro: string;
  cep: string;
  endereco_cidade_estado: string;
  celular_whatsapp: string;
  telefone_fixo: string;
  email_pessoal: string;
  contatos: Contato[];

  // Step 3 - Dados Religiosos
  primeiros_votos_data: string;
  votos_perpetuos_data: string;
  lugar_profissao: string;
  diaconato_data: string;
  presbiterato_data: string;
  bispo_ordenante: string;
  is_oconomo: boolean;
  is_superior: boolean;
  data_batismo: string;
  data_primeira_comunhao: string;
  data_crisma: string;

  // Step 4 - Itinerário Formativo
  itinerario: ItineraryStage[];

  // Step 5 - Formação Acadêmica
  formacao_curso: string;
  formacao_instituicao: string;
  formacao_periodo: string;
  formacao_observacoes: string;

  // Step 6 - Atividade Missionária
  atividade_lugar: string;
  atividade_periodo: string;
  atividade_missao: string;
  atividade_funcoes: string[];
  atividade_funcoes_outros: string;

  // Step 7 - Saúde
  saude_sus: string;
  saude_seguradora: string;
  saude_carteira: string;

  // Step 8 - Previdenciário / IR
  nit: string;

  // Step 9 - Contas Bancárias
  banco_nome: string;
  banco_tipo: string;
  banco_titular: string;
  banco_agencia: string;
  banco_numero: string;
  banco_observacoes: string;

  // Step 10 - Obras Realizadas
  obra_periodo: string;
  obra_lugar: string;
  obra_descricao: string;

  // Step 11 - Observações
  obs_geral: string;

  // Step 12 - Quadro de Pessoal CV
  quadro_funcao_atual: string;
  quadro_competencias: string;
  quadro_links_externos: string;

  // Step 14 - Acesso & Permissões
  login: string;
  password: string;
  status: 'ATIVO' | 'INATIVO';
  permissoes: Record<string, boolean>;
}

interface ItineraryStage {
  etapa: string;
  is_sub_etapa: boolean;
  local: string;
  periodo: string;
  observacoes?: string;
}

const MAX_TRANSFERIDO_DOCS = 4;

const initialWizard: WizardData = {
  situacao: 'Ativo',
  data_falecimento: '',
  cidade_falecimento: '',
  local_sepultamento: '',
  exclaustrado_data: '',
  exclaustrado_processo: '',
  transferido_data_inicio: '',
  transferido_data_fim: '',
  transferido_origem: '',
  transferido_destino: '',
  transferido_observacao: '',

  nome: '',
  data_nascimento: '',
  nome_pai: '',
  nome_mae: '',
  naturalidade: '',
  pais: 'Brasil',
  cidade_estado: '',
  diocese: '',
  rnm: '',
  cpf: '',
  titulo_eleitor: '',
  cnh: '',
  passaporte: '',
  nacionalidades: ['Brasileira'],

  logradouro: '',
  complemento: '',
  bairro: '',
  cep: '',
  endereco_cidade_estado: '',
  celular_whatsapp: '',
  telefone_fixo: '',
  email_pessoal: '',
  contatos: [],

  primeiros_votos_data: '',
  votos_perpetuos_data: '',
  lugar_profissao: '',
  diaconato_data: '',
  presbiterato_data: '',
  bispo_ordenante: '',
  is_oconomo: false,
  is_superior: false,
  data_batismo: '',
  data_primeira_comunhao: '',
  data_crisma: '',

  itinerario: [
    { etapa: '4.1.1', is_sub_etapa: true, local: '', periodo: '' },
    { etapa: '4.1.2', is_sub_etapa: true, local: '', periodo: '' },
    { etapa: '4.1.3', is_sub_etapa: true, local: '', periodo: '' },
    { etapa: '4.1.4', is_sub_etapa: true, local: '', periodo: '' },
  ],

  formacao_curso: '',
  formacao_instituicao: '',
  formacao_periodo: '',
  formacao_observacoes: '',

  atividade_lugar: '',
  atividade_periodo: '',
  atividade_missao: '',
  atividade_funcoes: [],
  atividade_funcoes_outros: '',

  saude_sus: '',
  saude_seguradora: '',
  saude_carteira: '',
  nit: '',

  banco_nome: '',
  banco_tipo: '',
  banco_titular: '',
  banco_agencia: '',
  banco_numero: '',
  banco_observacoes: '',

  obra_periodo: '',
  obra_lugar: '',
  obra_descricao: '',

  obs_geral: '',

  quadro_funcao_atual: '',
  quadro_competencias: '',
  quadro_links_externos: '',

  login: '',
  password: '',
  status: 'ATIVO',
  permissoes: {}
};

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
  return d ? d.toLocaleDateString(getDateLocale()) : '—';
}

// Mesmo cálculo/tradução de duração usado no perfil do missionário
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

// Código da etapa (ex.: '4.2.1.7') a partir do rótulo em português (ex.: '4.2.1.7 Lugar (Primeira Profissão)')
const itinStageCode = (stage: string): string => stage.split(' ')[0];

// Rótulo traduzido da etapa, com as mesmas chaves usadas no perfil
const itinStageLabel = (code: string, fallback: string): string =>
  code === '4.4'
    ? i18n.t('profile.itinerary.menu_4_4', fallback)
    : i18n.t(`profile.itinerary.stages.s${code.replace(/\./g, '_')}`, fallback);

// Funções da atividade missionária (mesma lista e tradução do perfil)
const FUNCOES_ATIVIDADE: { value: string; key: string }[] = [
  { value: 'Superior Local', key: 'superior_local' },
  { value: 'Pároco', key: 'paroco' },
  { value: 'Diretor (rádios, escolas, fundações, escritórios)', key: 'diretor' },
  { value: 'Ecônomo Local', key: 'economo_local' },
  { value: 'Vigário', key: 'vigario' },
  { value: 'Reitor (seminários)', key: 'reitor' },
];

const SITUACAO_KEYS: Record<string, string> = {
  Ativo: 'ativo', Egresso: 'egresso', Falecido: 'falecido', Exclaustrado: 'exclaustrado', Transferido: 'transferido',
};

const ITIN_STAGES = [
  '4.1.1 Seminário Menor',
  '4.1.2 Propedêutico',
  '4.1.3 Filosofia',
  '4.1.4 Postulado',
  '4.1.5 Noviciado',
  '4.1.6 Teologia',
  '4.1.7 Tirocínio',
  '4.2.1.1 Relatório do Mestre',
  '4.2.1.2 Pedido do noviço',
  '4.2.1.3 Declaração de cessão da administração de bens',
  '4.2.1.4 Admissão',
  '4.2.1.5 Fórmula manuscrita',
  '4.2.1.6 Delegação para receber os votos',
  '4.2.1.7 Lugar (Primeira Profissão)',
  '4.2.2.1 Relatório do Formador',
  '4.2.2.2 Pedido do religioso',
  '4.2.2.3 Admissão Fórmula manuscrita',
  '4.2.2.4 Delegação para receber os votos',
  '4.2.3.1 Relatório do Formador',
  '4.2.3.2 Pedido do religioso',
  '4.2.3.3 Declaração de nada exigir',
  '4.2.3.4 Testamento particular',
  '4.2.3.5 Declaração Nada Obsta',
  '4.2.3.6 Admissão',
  '4.2.3.7 Fórmula manuscrita',
  '4.2.3.8 Delegação para receber os votos',
  '4.2.3.9 Notificação à paróquia de batismo',
  '4.2.3.10 Lugar (Profissão Perpétua)',
  '4.3.1.1 Apresentação',
  '4.3.1.2 Pedido',
  '4.3.1.3 Admissão',
  '4.3.1.4 Certificado',
  '4.3.2.1 Apresentação',
  '4.3.2.2 Pedido',
  '4.3.2.3 Admissão',
  '4.3.2.4 Certificado',
  '4.3.3.1 Relatório do Formador',
  '4.3.3.2 Pedido do religioso',
  '4.3.3.3 Declaração dos estudos teológicos',
  '4.3.3.4 Declaração Nada Obsta',
  '4.3.3.5 Admissão',
  '4.3.3.6 Cartas dimissórias',
  '4.3.3.7 Ata de ordenação',
  '4.3.3.8 Notificação à paróquia de batismo',
  '4.3.4.1 Relatório do Formador',
  '4.3.4.2 Pedido do diácono',
  '4.3.4.3 Declaração dos estudos teológicos',
  '4.3.4.4 Declaração Nada Obsta',
  '4.3.4.5 Admissão',
  '4.3.4.6 Cartas dimissórias',
  '4.3.4.7 Ata de ordenação',
  '4.3.4.8 Notificação à paróquia de batismo',
  '4.3.5.1 Carta do religioso',
  '4.3.5.2 Relatório',
  '4.3.5.3 Parecer do Superior Regional',
  '4.4 Destinação dada pela Direção'
];

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

const Missionarios: React.FC = () => {
  const { canEdit, canAccessObito } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [missionarios, setMissionarios] = useState<Missionario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters and pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [casaFilter, setCasaFilter] = useState('');
  const [cidadeFilter, setCidadeFilter] = useState('');
  const [paisFilter, setPaisFilter] = useState('');
  const [situacaoFilter, setSituacaoFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Wizard
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardData, setWizardData] = useState<WizardData>(initialWizard);
  const [saveLoading, setSaveLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Steps definition matching profile sections exactly
  const STEPS = [
    { num: '0', label: t('profile.tabs.situation', '0. Situação'), icon: <Star size={14} /> },
    { num: '1', label: t('profile.tabs.personal', '1. Dados Civis'), icon: <User size={14} /> },
    { num: '2', label: t('profile.tabs.contact', '2. Contatos'), icon: <MapPin size={14} /> },
    { num: '3', label: t('profile.tabs.religious', '3. Dados Religiosos'), icon: <BookOpen size={14} /> },
    { num: '4', label: t('profile.tabs.itinerary', '4. Itinerário Formativo'), icon: <Activity size={14} /> },
    { num: '5', label: t('profile.tabs.formacao_academica', '5. Formação Acadêmica'), icon: <GraduationCap size={14} /> },
    { num: '6', label: t('profile.tabs.atividade_missionaria', '6. Atividade Missionária'), icon: <MapPin size={14} /> },
    { num: '7', label: t('profile.tabs.saude_individual', '7. Saúde'), icon: <Activity size={14} /> },
    { num: '8', label: t('profile.tabs.previdenciario', '8. Previdenciário / IR'), icon: <ShieldCheck size={14} /> },
    { num: '9', label: t('profile.tabs.contas_bancarias', '9. Contas Bancárias'), icon: <DollarSign size={14} /> },
    { num: '10', label: t('profile.tabs.formacao_missao', '10. Obras Realizadas'), icon: <Star size={14} /> },
    { num: '11', label: t('profile.tabs.obs', '11. Observações'), icon: <FileText size={14} /> },
    { num: '12', label: t('profile.tabs.quadro_pessoal', '12. Curriculum Vitae'), icon: <Users size={14} /> },
    { num: 'PM', label: t('profile.tabs.houses', 'Presença Missionária'), icon: <HomeIcon size={14} /> },
    { num: 'AP', label: t('missionaries.wizard.steps.access_permissions', 'Acesso & Permissões'), icon: <Lock size={14} /> },
  ];

  const situacaoLabel = (sit: string) => (SITUACAO_KEYS[sit] ? t(`missionaries.situations.${SITUACAO_KEYS[sit]}`, sit) : sit);

  // Step 0 — Situation Files
  const [certidaoObitoFile, setCertidaoObitoFile] = useState<File | null>(null);
  const [egressoIncardinadoFile, setEgressoIncardinadoFile] = useState<File | null>(null);
  const [egressoDesistenciaFile, setEgressoDesistenciaFile] = useState<File | null>(null);
  const [egressoLaicizadoFile, setEgressoLaicizadoFile] = useState<File | null>(null);
  const [egressoTransfSacerdotesFile, setEgressoTransfSacerdotesFile] = useState<File | null>(null);
  const [egressoTransfParaRegiaoFile, setEgressoTransfParaRegiaoFile] = useState<File | null>(null);
  const [egressoTransfDaRegiaoFile, setEgressoTransfDaRegiaoFile] = useState<File | null>(null);
  const [exclaustradoDocFiles, setExclaustradoDocFiles] = useState<File[]>([]);
  const [transferidoDocFiles, setTransferidoDocFiles] = useState<File[]>([]);

  // Step 1 — dynamic docs
  const [docs, setDocs] = useState<DocEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocDescricao, setPendingDocDescricao] = useState('');

  // Step 2 — address / CEP
  const [cepLoading, setCepLoading] = useState(false);

  // Step 3 — sacrament docs
  const [batismoDocFile, setBatismoDocFile] = useState<File | null>(null);
  const [comunhaoDocFile, setComunhaoDocFile] = useState<File | null>(null);
  const [crismaDocFile, setCrismaDocFile] = useState<File | null>(null);

  // Step 4 — itinerary docs
  const itinStepFileRef = useRef<HTMLInputElement>(null);
  const [itinSelectedStage, setItinSelectedStage] = useState('');
  const [itineraryDocs, setItineraryDocs] = useState<{ file: File; stage: string }[]>([]);

  // Step 5 — academic formation doc
  const formacaoFileRef = useRef<HTMLInputElement>(null);
  const [formacaoDocFile, setFormacaoDocFile] = useState<File | null>(null);

  // Step 7 — health doc
  const saudeFileRef = useRef<HTMLInputElement>(null);
  const [saudeDocFile, setSaudeDocFile] = useState<File | null>(null);

  // Step 12 — staff framework CV
  const quadroFileRef = useRef<HTMLInputElement>(null);
  const [quadroCvFile, setQuadroCvFile] = useState<File | null>(null);

  // Step 13 — casas
  const [casasDisponiveis, setCasasDisponiveis] = useState<Casa[]>([]);
  const [casasVinculos, setCasasVinculos] = useState<CasaVinculo[]>([]);
  const [novaCasa, setNovaCasa] = useState<CasaVinculo>({ casa_id: '', data_inicio: '', data_fim: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });

  // Ref for auto-scrolling active step pill
  const activeStepRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchMissionarios();
    fetchCasas();
  }, []);

  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [wizardStep]);

  const fetchMissionarios = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get('/usuarios');
      const padres = res.data.filter((u: any) => u.role === 'PADRE' && !isHiddenTestUser(u.login));
      setMissionarios(padres);
    } catch (err: any) {
      setError(err?.response?.data?.message || err.message || t('missionaries.error_loading', 'Erro ao carregar missionários'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCasas = async () => {
    try {
      const res = await api.post('/casas-religiosas/get');
      setCasasDisponiveis(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      try {
        const fallback = await api.get('/casas-religiosas');
        setCasasDisponiveis(Array.isArray(fallback.data) ? fallback.data : []);
      } catch (e) {
        console.error('Erro ao carregar casas:', e);
      }
    }
  };

  const openWizard = () => {
    fetchCasas();
    setWizardData(initialWizard);
    setCertidaoObitoFile(null);
    setEgressoIncardinadoFile(null);
    setEgressoDesistenciaFile(null);
    setEgressoLaicizadoFile(null);
    setEgressoTransfSacerdotesFile(null);
    setEgressoTransfParaRegiaoFile(null);
    setEgressoTransfDaRegiaoFile(null);
    setExclaustradoDocFiles([]);
    setTransferidoDocFiles([]);

    setDocs([]);
    setPendingDocDescricao('');
    setBatismoDocFile(null);
    setComunhaoDocFile(null);
    setCrismaDocFile(null);
    setFormacaoDocFile(null);
    setSaudeDocFile(null);
    setQuadroCvFile(null);
    setItineraryDocs([]);
    setItinSelectedStage('');
    setCasasVinculos([]);
    setNovaCasa({ casa_id: '', data_inicio: '', data_fim: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
    setWizardStep(0);
    setIsWizardOpen(true);
  };

  const set = (field: keyof WizardData, val: any) => {
    setWizardData(prev => ({ ...prev, [field]: val }));
  };

  const handleCepChange = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    set('cep', cep);

    if (cleanCep.length === 8) {
      setCepLoading(true);
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();

        if (!data.erro) {
          setWizardData(prev => ({
            ...prev,
            logradouro: data.logradouro || prev.logradouro,
            bairro: data.bairro || prev.bairro,
            endereco_cidade_estado: `${data.localidade} - ${data.uf}`
          }));
        }
      } catch (error) {
        console.error('Erro ao buscar CEP:', error);
      } finally {
        setCepLoading(false);
      }
    }
  };

  // ── Document handlers ──
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!pendingDocDescricao.trim()) {
      appAlert(t('missionaries.wizard.docs.hint'));
      e.target.value = '';
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const previewUrl = ['jpg', 'jpeg', 'png'].includes(ext) ? URL.createObjectURL(file) : '';
    const entry: DocEntry = {
      uid: `${Date.now()}`,
      descricao: pendingDocDescricao.trim(),
      file,
      previewUrl,
      tipo: ext,
    };
    setDocs(prev => [...prev, entry]);
    setPendingDocDescricao('');
    e.target.value = '';
  };

  const removeDoc = (uid: string) => {
    setDocs(prev => prev.filter(d => d.uid !== uid));
  };

  // ── Casa handlers ──
  const addCasaVinculo = () => {
    if (!novaCasa.casa_id) { appAlert(t('missionaries.wizard.houses.select_house_alert', 'Selecione uma casa')); return; }
    if (!novaCasa.data_inicio) { appAlert(t('missionaries.wizard.houses.start_date_alert', 'Informe a data de início')); return; }
    setCasasVinculos(prev => [...prev, { ...novaCasa }]);
    setNovaCasa({ casa_id: '', data_inicio: '', data_fim: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
  };

  const removeCasaVinculo = (idx: number) =>
    setCasasVinculos(prev => prev.filter((_, i) => i !== idx));

  const uploadSacramentoFile = async (userId: number, campo: 'doc_batismo' | 'doc_primeira_comunhao' | 'doc_crisma', file: File) => {
    const fd = new FormData();
    fd.append('arquivo', file);
    fd.append('campo', campo);
    await api.post(`/usuarios/${userId}/dados-religiosos/upload-sacramento`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  // ── Finish & Save All Wizard Data ──
  const handleFinish = async () => {
    if (!wizardData.nome.trim()) {
      appAlert(t('missionaries.wizard.msgs.missionary_name_required', 'Informe o nome do missionário.'));
      return;
    }

    const isFalecido = wizardData.situacao === 'Falecido';

    if (!isFalecido && !wizardData.login.trim()) {
      appAlert(t('missionaries.wizard.msgs.login_required', 'Informe o e-mail de login.'));
      return;
    }

    const effectiveLogin = isFalecido && !wizardData.login.trim()
      ? `falecido_${Date.now()}@scalabrianos.org`
      : wizardData.login.trim();

    const effectivePassword = wizardData.password?.trim() || (isFalecido ? `fal_${Math.random().toString(36).slice(-8)}` : 'Scalab@10');
    const effectiveStatus = isFalecido ? 'INATIVO' : wizardData.status;

    setSaveLoading(true);
    try {
      const hasOconomoLocal = (wizardData.atividade_funcoes || []).includes('Ecônomo Local');
      const hasSuperiorLocal = (wizardData.atividade_funcoes || []).includes('Superior Local');

      const effectiveIsOconomo = wizardData.is_oconomo || hasOconomoLocal;
      const effectiveIsSuperior = wizardData.is_superior || hasSuperiorLocal;

      // 1 — Create user
      const userRes = await api.post('/usuarios', {
        nome: wizardData.nome,
        login: effectiveLogin,
        password: effectivePassword,
        role: 'PADRE',
        status: effectiveStatus,
        situacao: wizardData.situacao,
        is_oconomo: effectiveIsOconomo,
        is_superior: effectiveIsSuperior,
        permissoes: isFalecido ? {} : wizardData.permissoes,
      });
      const newId = userRes.data.id;

      // 2 — Save Situation Details
      // Exclaustração: vários documentos, como no perfil (anexados em /documentos e gravados em exclaustrado_doc_path)
      const exclaustradoPaths: string[] = [];
      if (wizardData.situacao === 'Exclaustrado') {
        for (const file of exclaustradoDocFiles) {
          const fd = new FormData();
          fd.append('arquivo', file);
          fd.append('descricao', 'Documento de Exclaustração');
          const upRes = await api.post(`/usuarios/${newId}/documentos`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const docUrl = upRes.data?.url || upRes.data?.arquivo_path;
          if (docUrl) exclaustradoPaths.push(docUrl);
        }
      }

      await api.post(`/usuarios/${newId}/situacao`, {
        data_falecimento: wizardData.data_falecimento || null,
        cidade_falecimento: wizardData.cidade_falecimento || null,
        local_sepultamento: wizardData.local_sepultamento || null,
        exclaustrado_data: wizardData.exclaustrado_data || null,
        exclaustrado_processo: wizardData.exclaustrado_processo || null,
        exclaustrado_doc_path: exclaustradoPaths.length ? exclaustradoPaths.join(',') : null,
        transferido_data_inicio: wizardData.transferido_data_inicio || null,
        transferido_data_fim: wizardData.transferido_data_fim || null,
        transferido_origem: wizardData.transferido_origem || null,
        transferido_destino: wizardData.transferido_destino || null,
        transferido_observacao: wizardData.transferido_observacao || null,
      });

      const uploadSituacaoFile = async (campo: string, file: File) => {
        const fd = new FormData();
        fd.append('arquivo', file);
        fd.append('campo', campo);
        await api.post(`/usuarios/${newId}/situacao/upload-doc`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      };

      if (certidaoObitoFile && canAccessObito) await uploadSituacaoFile('certidao_obito_path', certidaoObitoFile);
      if (egressoIncardinadoFile) await uploadSituacaoFile('egresso_incardinado_path', egressoIncardinadoFile);
      if (egressoDesistenciaFile) await uploadSituacaoFile('egresso_desistencia_path', egressoDesistenciaFile);
      if (egressoLaicizadoFile) await uploadSituacaoFile('egresso_laicizado_path', egressoLaicizadoFile);
      if (egressoTransfSacerdotesFile) await uploadSituacaoFile('egresso_transf_sacerdotes_path', egressoTransfSacerdotesFile);
      if (egressoTransfParaRegiaoFile) await uploadSituacaoFile('egresso_transf_para_regiao_path', egressoTransfParaRegiaoFile);
      if (egressoTransfDaRegiaoFile) await uploadSituacaoFile('egresso_transf_da_regiao_path', egressoTransfDaRegiaoFile);
      if (wizardData.situacao === 'Transferido') {
        for (const file of transferidoDocFiles.slice(0, MAX_TRANSFERIDO_DOCS)) {
          const fd = new FormData();
          fd.append('arquivo', file);
          await api.post(`/usuarios/${newId}/situacao/transferido-doc`, fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      // 3 — Civil data
      const fullFiliacao = `${wizardData.nome_pai || ''} / ${wizardData.nome_mae || ''}`.trim();
      await api.post(`/usuarios/${newId}/dados-civis`, {
        data_nascimento: wizardData.data_nascimento || null,
        filiacao: fullFiliacao === '/' ? '' : fullFiliacao,
        cidade_estado: wizardData.cidade_estado,
        diocese: wizardData.diocese,
        pais: wizardData.pais,
        naturalidade: wizardData.naturalidade,
        rnm: wizardData.rnm || '',
        cpf: wizardData.cpf || '',
        titulo_eleitor: wizardData.titulo_eleitor || '',
        cnh: wizardData.cnh || '',
        passaporte: wizardData.passaporte || '',
        nit: wizardData.nit || ''
      });

      // 4 — Address & Personal Contact
      await api.post(`/usuarios/${newId}/endereco-contato`, {
        logradouro: wizardData.logradouro,
        complemento: wizardData.complemento,
        bairro: wizardData.bairro,
        cep: wizardData.cep,
        cidade_estado: wizardData.endereco_cidade_estado,
        celular_whatsapp: wizardData.celular_whatsapp,
        telefone_fixo: wizardData.telefone_fixo,
        email_pessoal: wizardData.email_pessoal,
      });

      // 5 — Relative Contacts
      if (wizardData.contatos && wizardData.contatos.length > 0) {
        await api.post(`/usuarios/${newId}/contatos`, { contatos: wizardData.contatos });
      }

      // 6 — Religious data
      await api.post(`/usuarios/${newId}/dados-religiosos`, {
        primeiros_votos_data: wizardData.primeiros_votos_data || null,
        votos_perpetuos_data: wizardData.votos_perpetuos_data || null,
        lugar_profissao: wizardData.lugar_profissao,
        diaconato_data: wizardData.diaconato_data || null,
        presbiterato_data: wizardData.presbiterato_data || null,
        bispo_ordenante: wizardData.bispo_ordenante,
        data_batismo: wizardData.data_batismo || null,
        data_primeira_comunhao: wizardData.data_primeira_comunhao || null,
        data_crisma: wizardData.data_crisma || null,
      });

      if (batismoDocFile) await uploadSacramentoFile(newId, 'doc_batismo', batismoDocFile);
      if (comunhaoDocFile) await uploadSacramentoFile(newId, 'doc_primeira_comunhao', comunhaoDocFile);
      if (crismaDocFile) await uploadSacramentoFile(newId, 'doc_crisma', crismaDocFile);

      // 7 — Casa vinculos
      for (const v of casasVinculos) {
        await api.post(`/usuarios/${newId}/casas-historico`, {
          casa_id: v.casa_id,
          data_inicio: v.data_inicio,
          data_fim: v.data_fim || null,
          funcao: '',
          is_superior: false,
          pm: v.pm || null,
          tipo: v.tipo || null,
          pais: v.pais || null,
        });
      }

      // 8 — Nacionalidades
      const filteredNacs = (wizardData.nacionalidades || []).map(n => n.trim()).filter(Boolean);
      await api.post(`/usuarios/${newId}/nacionalidades`, { nacionalidades: filteredNacs });

      // 9 — Itinerário Formativo
      const stageDocs: Record<string, string> = {};
      for (const idoc of itineraryDocs) {
        const fd = new FormData();
        fd.append('arquivo', idoc.file);
        fd.append('descricao', `Itinerário - ${idoc.stage}`);
        const upRes = await api.post(`/usuarios/${newId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        stageDocs[itinStageCode(idoc.stage)] = upRes.data.url || upRes.data.arquivo_path;
      }

      const finalItinerario = wizardData.itinerario
        .filter(stage => stage.local || stage.periodo || stage.observacoes || stageDocs[stage.etapa])
        .map(stage => {
        if (stageDocs[stage.etapa]) {
          return { ...stage, doc_path: stageDocs[stage.etapa] };
        }
        return stage;
      });
      Object.keys(stageDocs).forEach(etapa => {
        if (!finalItinerario.find(s => s.etapa === etapa)) {
          finalItinerario.push({ etapa, local: '', periodo: '', is_sub_etapa: true, doc_path: stageDocs[etapa] });
        }
      });
      await api.post(`/usuarios/${newId}/itinerario`, { stages: finalItinerario });

      // 10 — Formação Acadêmica (o comprovante fica vinculado ao registro, como no perfil)
      if (wizardData.formacao_curso || wizardData.formacao_instituicao || formacaoDocFile) {
        let formacaoDocPath: string | null = null;
        if (formacaoDocFile) {
          const fd = new FormData();
          fd.append('arquivo', formacaoDocFile);
          const upRes = await api.post('/upload-anexo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          formacaoDocPath = upRes.data?.arquivo_path || upRes.data?.url || null;
        }
        await api.post(`/usuarios/${newId}/formacao-academica`, {
          curso: wizardData.formacao_curso,
          faculdade: wizardData.formacao_instituicao,
          periodo: wizardData.formacao_periodo,
          observacoes: wizardData.formacao_observacoes,
          doc_path: formacaoDocPath
        });
      }

      // 11 — Atividade Missionária
      if (wizardData.atividade_lugar || (wizardData.atividade_funcoes && wizardData.atividade_funcoes.length > 0) || wizardData.atividade_funcoes_outros?.trim()) {
        // Mesma regra do perfil: funções padrão + "Outras Funções" em texto livre
        const funs = [...(wizardData.atividade_funcoes || [])];
        const outras = wizardData.atividade_funcoes_outros?.trim();
        if (outras && !funs.includes(outras)) funs.push(outras);
        await api.post(`/usuarios/${newId}/atividade-missionaria`, {
          lugar: wizardData.atividade_lugar,
          periodo: wizardData.atividade_periodo,
          missao: wizardData.atividade_missao,
          funcao_atividade: funs.join(', ')
        });
      }

      // 12 — Saúde (o cartão do SUS / convênio fica vinculado ao registro, como no perfil)
      if (wizardData.saude_sus || wizardData.saude_seguradora || wizardData.saude_carteira || saudeDocFile) {
        let saudeDocPath: string | null = null;
        if (saudeDocFile) {
          const fd = new FormData();
          fd.append('arquivo', saudeDocFile);
          const upRes = await api.post('/upload-anexo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          saudeDocPath = upRes.data?.arquivo_path || upRes.data?.url || null;
        }
        await api.post(`/usuarios/${newId}/saude`, {
          sus_card: wizardData.saude_sus,
          seguradora: wizardData.saude_seguradora,
          numero_carteira: wizardData.saude_carteira,
          doc_path: saudeDocPath
        });
      }

      // 13 — Contas Bancárias
      if (wizardData.banco_numero || wizardData.banco_agencia || wizardData.banco_nome || wizardData.banco_tipo) {
        await api.post(`/usuarios/${newId}/contas-bancarias`, {
          banco: wizardData.banco_nome,
          tipo_confirmacao: wizardData.banco_tipo,
          tipo_conta: wizardData.banco_tipo,
          titularidade: wizardData.banco_titular,
          agencia: wizardData.banco_agencia,
          numero: wizardData.banco_numero,
          observacoes: wizardData.banco_observacoes
        });
      }

      // 14 — Obras Realizadas
      if (wizardData.obra_lugar || wizardData.obra_descricao) {
        await api.post(`/usuarios/${newId}/obras-realizadas`, {
          periodo: wizardData.obra_periodo,
          lugar: wizardData.obra_lugar,
          obra: wizardData.obra_descricao
        });
      }

      // 15 — Observações Gerais
      if (wizardData.obs_geral) {
        await api.post(`/usuarios/${newId}/observacoes-gerais`, {
          texto: wizardData.obs_geral
        });
      }

      // 16 — Quadro de Pessoal CV (o arquivo vai para cv_path, exibido na aba 12 do perfil)
      if (wizardData.quadro_funcao_atual || wizardData.quadro_competencias || wizardData.quadro_links_externos || quadroCvFile) {
        let cvPath = '';
        if (quadroCvFile) {
          const fd = new FormData();
          fd.append('arquivo', quadroCvFile);
          const upRes = await api.post('/upload-anexo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
          cvPath = upRes.data?.arquivo_path || upRes.data?.url || '';
        }
        await api.post(`/usuarios/${newId}/quadro-pessoal`, {
          funcao_atual: wizardData.quadro_funcao_atual,
          competencias: wizardData.quadro_competencias,
          cv_path: cvPath,
          links_externos: wizardData.quadro_links_externos
        });
      }

      // 17 — General Documents & Attachments
      for (const doc of docs) {
        if (!doc.file) continue;
        const fd = new FormData();
        fd.append('arquivo', doc.file);
        fd.append('descricao', doc.descricao);
        await api.post(`/usuarios/${newId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await fetchMissionarios();
      setIsWizardOpen(false);
      appAlert(t('missionaries.wizard.msgs.created_success', { name: wizardData.nome, defaultValue: `${wizardData.nome} cadastrado com sucesso!` }));
    } catch (err: any) {
      appAlert(t('missionaries.wizard.msgs.error_prefix', 'Erro: ') + (err?.response?.data?.message || err.message));
    } finally {
      setSaveLoading(false);
    }
  };

  const filtered = missionarios.filter(m => {
    const s = searchTerm.toLowerCase();
    const matchesSearch = m.nome.toLowerCase().includes(s);
    const matchesCasa = casaFilter ? (m.casa_nome || '').toLowerCase().includes(casaFilter.toLowerCase()) : true;
    const matchesCidade = cidadeFilter ? ((m.cidade_nascimento || m.cidade || '').toLowerCase().includes(cidadeFilter.toLowerCase())) : true;
    const matchesPais = paisFilter ? ((m.pais_nascimento || m.pais || '').toLowerCase().includes(paisFilter.toLowerCase())) : true;
    const matchesSituacao = situacaoFilter ? m.situacao === situacaoFilter : true;

    return matchesSearch && matchesCasa && matchesCidade && matchesPais && matchesSituacao;
  });

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedMissionarios = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const casaNome = (id: any) => casasDisponiveis.find(c => String(c.id) === String(id))?.nome || '-';

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <Users size={24} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h2 style={{ margin: 0 }}>{t('missionaries.title_overview', 'Missionários/Religiosos Cadastrados')}</h2>
          </div>
        </div>
        {canEdit && <button className="btn-new" onClick={openWizard}><Plus size={18} /> {t('missionaries.new_btn', 'Novo Cadastro')}</button>}
      </div>

      <div className="filters-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
        <div className="filter-group">
          <label>{t('missionaries.filters.name_label', 'NOME')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('missionaries.filters.search_name_placeholder', 'Buscar por nome...')} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('missionaries.filters.house_label', 'PRESENÇA MISSIONÁRIA')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('missionaries.filters.filter_house_placeholder', 'Filtrar por casa...')} value={casaFilter} onChange={e => setCasaFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('missionaries.filters.city_label', 'CIDADE')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('missionaries.filters.filter_city_placeholder', 'Filtrar por cidade...')} value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('missionaries.filters.country_label', 'PAÍS')}</label>
          <div className="search-input">
            <input type="text" placeholder={t('missionaries.filters.filter_country_placeholder', 'Filtrar por país...')} value={paisFilter} onChange={e => setPaisFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>{t('missionaries.filters.situation_label', 'SITUAÇÃO')}</label>
          <select value={situacaoFilter} onChange={e => setSituacaoFilter(e.target.value)}>
            <option value="">{t('missionaries.filters.all', 'Todas as Situações')}</option>
            <option value="ATIVO">{t('missionaries.situations.ativo', 'Ativo')}</option>
            <option value="FALECIDO">{t('missionaries.situations.falecido', 'Falecido')}</option>
            <option value="EGRESSO">{t('missionaries.situations.egresso', 'Egresso')}</option>
            <option value="EXCLAUSTRADO">{t('missionaries.situations.exclaustrado', 'Exclaustrado')}</option>
            <option value="TRANSFERIDO">{t('missionaries.situations.transferido', 'Transferido')}</option>
          </select>
        </div>
        <button className="btn-filter" style={{ gridColumn: 'span 1', width: '100%', height: '42px', marginTop: '0' }}><Filter size={18} /> {t('missionaries.filters.filter_btn', 'Filtrar')}</button>
      </div>

      {isLoading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /><p>{t('missionaries.loading', 'Carregando...')}</p></div>
      ) : error ? (
        <div className="error-state"><AlertCircle size={32} /><p>{error}</p><button onClick={fetchMissionarios} className="btn-retry">{t('common.retry', 'Tentar novamente')}</button></div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>{t('missionaries.table.id', 'ID')}</th>
                <th>{t('missionaries.table.name', 'Nome')}</th>
                <th>{t('missionaries.table.city_birth', 'Cidade de Nascimento')}</th>
                <th>{t('missionaries.table.country_birth', 'País de Nascimento')}</th>
                <th>{t('missionaries.table.house', 'Presença Missionária')}</th>
                <th className="center">{t('missionaries.table.situation', 'Situação')}</th>
                <th className="center">{t('missionaries.table.registration', 'Cadastro')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedMissionarios.map(m => (
                <tr key={m.id}>
                  <td>#{m.id}</td>
                  <td className="bold">{m.nome}</td>
                  <td>{m.cidade_nascimento || m.cidade || '---'}</td>
                  <td>{m.pais_nascimento || m.pais || '---'}</td>
                  <td>{m.casa_nome || '---'}</td>
                  <td className="center">
                    <span className={`situacao-tag ${(m.situacao || '').toLowerCase()}`}>
                      {t(`missionaries.situations.${(m.situacao || '').toLowerCase()}`, m.situacao)}
                    </span>
                  </td>
                  <td className="center">
                    <button className="btn-cadastro" title={t('missionaries.table.view_details', 'Ver Detalhes')} onClick={() => navigate(`/missionarios/${m.id}`)}>
                      {t('missionaries.table.registration', 'Cadastro')}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>{t('missionaries.empty', 'Nenhum missionário encontrado')}</td></tr>
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
              <span style={{ fontSize: '14px', color: '#64748b' }}>{t('missionaries.page_of', { current: currentPage, total: totalPages, defaultValue: `Página ${currentPage} de ${totalPages}` })}</span>
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

      {/* ═══════════════ WIZARD MODAL ═══════════════ */}
      {isWizardOpen && (
        <div className="modal-overlay">
          <div className="modal-content wizard-modal">
            <div className="modal-header">
              <h3>{t('missionaries.wizard.title')}</h3>
              <button className="close-btn" onClick={() => setIsWizardOpen(false)}><X size={20} /></button>
            </div>

            {/* Missionary name banner – visible from Step 1 onward when name is entered */}
            {wizardStep >= 1 && wizardData.nome && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'linear-gradient(90deg, #eef4ff 0%, #f5f0ff 100%)',
                border: '1px solid #d0e0ff',
                borderRadius: '10px',
                padding: '8px 16px',
                margin: '0 0 12px 0',
              }}>
                <span style={{ fontSize: '18px' }}>👤</span>
                <div>
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a8caa' }}>{t('missionaries.wizard.registering_banner', 'Missionário em cadastro')}</span>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--primary, #3a6fc4)', lineHeight: 1.2 }}>{wizardData.nome}</div>
                </div>
              </div>
            )}

            {/* Step bar */}
            <div className="wizard-steps">
              {STEPS.map((step, i) => {
                const isActive = i === wizardStep;
                return (
                  <div
                    key={i}
                    ref={isActive ? activeStepRef : null}
                    className={`wizard-step-indicator ${isActive ? 'active' : ''} ${i < wizardStep ? 'done' : ''}`}
                    onClick={() => {
                      if (i <= wizardStep || (wizardStep === 1 && wizardData.nome.trim()) || wizardStep > 1) {
                        setWizardStep(i);
                      }
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="step-circle">
                      {i < wizardStep ? <CheckCircle size={14} /> : <span>{step.num}</span>}
                    </div>
                    <span className="step-label">{step.icon}{step.label}</span>
                    {i < STEPS.length - 1 && <div className="step-line" />}
                  </div>
                );
              })}
            </div>

            {/* ── body ── */}
            <div className="wizard-body">

              {/* ══ STEP 0 — 0. SITUAÇÃO ══ */}
              {wizardStep === 0 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.situation.title', '0. Situação do Missionário')}</div>

                  <div className="form-group full" style={{ marginBottom: '14px' }}>
                    <label>{t('missionaries.wizard.situation.label', 'Situação do Missionário')} *</label>
                    <select value={wizardData.situacao} onChange={e => set('situacao', e.target.value)}>
                      <option value="Ativo">{t('missionaries.situations.ativo', 'Ativo')}</option>
                      <option value="Egresso">{t('missionaries.situations.egresso', 'Egresso')}</option>
                      {canAccessObito && <option value="Falecido">{t('missionaries.situations.falecido', 'Falecido')}</option>}
                      <option value="Exclaustrado">{t('missionaries.situations.exclaustrado', 'Exclaustrado')}</option>
                      <option value="Transferido">{t('missionaries.situations.transferido', 'Transferido')}</option>
                    </select>
                  </div>

                  {/* ── FALECIDO (Registro do Óbito) — restrito ao Registro Regional ── */}
                  {wizardData.situacao === 'Falecido' && canAccessObito && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
                        🕊️ {t('profile.situation.obito_title', 'Informações de Falecimento')}
                      </h4>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>{t('profile.situation.death_date', 'Data de Falecimento')}</label>
                          <input
                            type="date"
                            value={wizardData.data_falecimento}
                            onChange={e => set('data_falecimento', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.situation.death_city', 'Cidade de Falecimento')}</label>
                          <input
                            type="text"
                            value={wizardData.cidade_falecimento}
                            onChange={e => set('cidade_falecimento', e.target.value)}
                            placeholder={t('profile.situation.death_city_placeholder', 'Cidade - UF / País')}
                          />
                        </div>
                      </div>

                      <div className="form-group full" style={{ marginBottom: '14px' }}>
                        <label>{t('profile.situation.obito_certificate', 'Certidão de Óbito (PDF, PNG ou JPG)')}</label>
                        <div className="doc-add-row" style={{ alignItems: 'center' }}>
                          <input
                            type="file"
                            id="certidao-obito-file"
                            accept={OBITO_ACCEPT}
                            style={{ display: 'none' }}
                            onChange={e => {
                              const file = e.target.files?.[0] || null;
                              e.target.value = '';
                              if (file && !isValidObitoFile(file)) {
                                appAlert(t('profile.situation.obito_invalid_format', OBITO_INVALID_MSG));
                                return;
                              }
                              setCertidaoObitoFile(file);
                            }}
                          />
                          <button
                            type="button"
                            className="btn-add-doc"
                            onClick={() => document.getElementById('certidao-obito-file')?.click()}
                          >
                            <Upload size={15} /> <span>{certidaoObitoFile ? t('missionaries.wizard.common.replace_doc', 'Substituir Documento') : t('profile.ui.attach_doc_formats', 'Anexar Documento (PDF, PNG ou JPG)')}</span>
                          </button>
                          <span style={{ fontSize: '0.85rem', color: certidaoObitoFile ? '#166534' : '#64748b', fontWeight: certidaoObitoFile ? 600 : 400 }}>
                            {certidaoObitoFile
                              ? t('missionaries.wizard.common.file_name', { name: certidaoObitoFile.name, defaultValue: `Arquivo: ${certidaoObitoFile.name}` })
                              : t('profile.ui.no_file_attached', 'Nenhum arquivo anexado')}
                          </span>
                          {certidaoObitoFile && (
                            <button
                              type="button"
                              onClick={() => setCertidaoObitoFile(null)}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              {t('profile.ui.remove', 'Remover')}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="form-group full">
                        <label>{t('profile.situation.burial_place', 'Local de Sepultamento')}</label>
                        <input
                          type="text"
                          value={wizardData.local_sepultamento}
                          onChange={e => set('local_sepultamento', e.target.value)}
                          placeholder={t('profile.situation.burial_placeholder', 'Cemitério, Jazigo, Cidade...')}
                        />
                      </div>
                    </div>
                  )}

                  {/* ── EGRESSO ── */}
                  {wizardData.situacao === 'Egresso' && (
                    <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#854d0e', fontSize: '1rem', borderBottom: '2px solid #fde047', paddingBottom: '8px' }}>
                        📋 {t('profile.situation.egresso_title', 'Documentos e Informações de Egresso')}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { label: t('profile.situation.egresso_incardinado', '1. Incardinados (Documento PDF / JPEG)'), file: egressoIncardinadoFile, setFile: setEgressoIncardinadoFile, id: 'egr-inc' },
                          { label: t('profile.situation.egresso_desistencia', '2. Desistência ou em outro instituto (Documento PDF / JPEG)'), file: egressoDesistenciaFile, setFile: setEgressoDesistenciaFile, id: 'egr-des' },
                          { label: t('profile.situation.egresso_laicizado', '3. Laicizados (Documento PDF / JPEG)'), file: egressoLaicizadoFile, setFile: setEgressoLaicizadoFile, id: 'egr-lai' },
                          { label: t('profile.situation.egresso_transf_sacerdotes', '4. Sacerdotes e Religiosos Transferidos (Documento PDF / JPEG)'), file: egressoTransfSacerdotesFile, setFile: setEgressoTransfSacerdotesFile, id: 'egr-transf' },
                          { label: t('profile.situation.egresso_transf_para_regiao', '4.1 Para a Região (Documento PDF / JPEG)'), file: egressoTransfParaRegiaoFile, setFile: setEgressoTransfParaRegiaoFile, id: 'egr-reg' },
                          { label: t('profile.situation.egresso_transf_da_regiao', '4.2 Da Região para outras Províncias / Região (Documento PDF / JPEG)'), file: egressoTransfDaRegiaoFile, setFile: setEgressoTransfDaRegiaoFile, id: 'egr-prov' },
                        ].map(item => (
                          <div key={item.id} style={{ background: '#fff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #fef08a' }}>
                            <label style={{ fontWeight: 600, color: '#334155', fontSize: '0.85rem', display: 'block', marginBottom: '6px' }}>{item.label}</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                              <input
                                type="file"
                                id={item.id}
                                accept=".pdf,.jpg,.jpeg,.png"
                                style={{ display: 'none' }}
                                onChange={e => item.setFile(e.target.files?.[0] || null)}
                              />
                              <button
                                type="button"
                                className="btn-add-doc"
                                style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                                onClick={() => document.getElementById(item.id)?.click()}
                              >
                                <Upload size={14} /> <span>{item.file ? t('missionaries.wizard.common.replace_doc', 'Substituir Documento') : t('profile.ui.attach_doc_formats', 'Anexar Documento (PDF, PNG ou JPG)')}</span>
                              </button>
                              <span style={{ fontSize: '0.8rem', color: item.file ? '#166534' : '#64748b' }}>
                                {item.file ? item.file.name : t('profile.ui.no_file_attached', 'Nenhum arquivo anexado')}
                              </span>
                              {item.file && (
                                <button
                                  type="button"
                                  onClick={() => item.setFile(null)}
                                  style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  {t('profile.ui.remove', 'Remover')}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── EXCLAUSTRADO ── */}
                  {wizardData.situacao === 'Exclaustrado' && (
                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#991b1b', fontSize: '1rem', borderBottom: '2px solid #fca5a5', paddingBottom: '8px' }}>
                        📜 {t('profile.situation.exclaustrado_title', 'Informações de Exclaustração')}
                      </h4>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>{t('profile.situation.exclaustrado_date', 'Data de Exclaustração')}</label>
                          <input
                            type="date"
                            value={wizardData.exclaustrado_data}
                            onChange={e => set('exclaustrado_data', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.situation.exclaustrado_process', 'Processo / Decreto')}</label>
                          <input
                            type="text"
                            value={wizardData.exclaustrado_processo}
                            onChange={e => set('exclaustrado_processo', e.target.value)}
                            placeholder={t('profile.situation.exclaustrado_process_placeholder', 'Número do processo ou decreto...')}
                          />
                        </div>
                      </div>

                      {/* Vários documentos, como no perfil */}
                      <div className="form-group full">
                        <label>{t('profile.situation.exclaustrado_docs_label', 'Documentos Anexados (Adicione quantos desejar)')}</label>
                        {exclaustradoDocFiles.map((file, idx) => (
                          <div key={idx} className="doc-add-row" style={{ alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600, wordBreak: 'break-all' }}>{idx + 1}. {file.name}</span>
                            <button
                              type="button"
                              onClick={() => setExclaustradoDocFiles(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              {t('profile.ui.remove', 'Remover')}
                            </button>
                          </div>
                        ))}
                        <div className="doc-add-row" style={{ alignItems: 'center' }}>
                          <input
                            type="file"
                            id="exclaustrado-doc-file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            multiple
                            style={{ display: 'none' }}
                            onChange={e => {
                              const files = Array.from(e.target.files || []);
                              e.target.value = '';
                              if (files.length) setExclaustradoDocFiles(prev => [...prev, ...files]);
                            }}
                          />
                          <button
                            type="button"
                            className="btn-add-doc"
                            onClick={() => document.getElementById('exclaustrado-doc-file')?.click()}
                          >
                            <Upload size={15} /> <span>{t('profile.ui.add_doc', 'Adicionar Documento')}</span>
                          </button>
                          {exclaustradoDocFiles.length === 0 && (
                            <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ── TRANSFERIDO ── */}
                  {wizardData.situacao === 'Transferido' && (
                    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#1e40af', fontSize: '1rem', borderBottom: '2px solid #93c5fd', paddingBottom: '8px' }}>
                        🔁 {t('profile.situation.transferido_title', 'Informações de Transferência')}
                      </h4>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>{t('profile.situation.period_start', 'Período — Início')}</label>
                          <input
                            type="date"
                            value={wizardData.transferido_data_inicio}
                            onChange={e => set('transferido_data_inicio', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.situation.period_end', 'Período — Fim')}</label>
                          <input
                            type="date"
                            value={wizardData.transferido_data_fim}
                            min={wizardData.transferido_data_inicio || undefined}
                            onChange={e => set('transferido_data_fim', e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>{t('profile.situation.origin', 'Região/Província de Origem')}</label>
                          <input
                            type="text"
                            value={wizardData.transferido_origem}
                            onChange={e => set('transferido_origem', e.target.value)}
                            placeholder={t('profile.situation.origin_placeholder', 'Região ou província de origem')}
                          />
                        </div>
                        <div className="form-group">
                          <label>{t('profile.situation.destination', 'Região/Província de Destino')}</label>
                          <input
                            type="text"
                            value={wizardData.transferido_destino}
                            onChange={e => set('transferido_destino', e.target.value)}
                            placeholder={t('profile.situation.destination_placeholder', 'Região ou província de destino')}
                          />
                        </div>
                      </div>

                      <div className="form-group full" style={{ marginBottom: '14px' }}>
                        <label>{t('profile.situation.transferido_docs_label', { n: transferidoDocFiles.length, max: MAX_TRANSFERIDO_DOCS, defaultValue: `Documentos da Transferência (${transferidoDocFiles.length}/${MAX_TRANSFERIDO_DOCS} — PDF, PNG ou JPG)` })}</label>
                        {transferidoDocFiles.map((file, idx) => (
                          <div key={idx} className="doc-add-row" style={{ alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '0.85rem', color: '#166534', fontWeight: 600, wordBreak: 'break-all' }}>{idx + 1}. {file.name}</span>
                            <button
                              type="button"
                              onClick={() => setTransferidoDocFiles(prev => prev.filter((_, i) => i !== idx))}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              {t('profile.ui.remove', 'Remover')}
                            </button>
                          </div>
                        ))}
                        {transferidoDocFiles.length < MAX_TRANSFERIDO_DOCS ? (
                          <div className="doc-add-row" style={{ alignItems: 'center' }}>
                            <input
                              type="file"
                              id="transferido-doc-file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              multiple
                              style={{ display: 'none' }}
                              onChange={e => {
                                const files = Array.from(e.target.files || []);
                                e.target.value = '';
                                if (!files.length) return;
                                const room = MAX_TRANSFERIDO_DOCS - transferidoDocFiles.length;
                                if (files.length > room) {
                                  appAlert(t('missionaries.wizard.situation.transferido_limit_partial', { max: MAX_TRANSFERIDO_DOCS, room, defaultValue: `Limite de ${MAX_TRANSFERIDO_DOCS} anexos. Apenas ${room} arquivo(s) foram adicionados.` }));
                                }
                                setTransferidoDocFiles(prev => [...prev, ...files.slice(0, room)]);
                              }}
                            />
                            <button
                              type="button"
                              className="btn-add-doc"
                              onClick={() => document.getElementById('transferido-doc-file')?.click()}
                            >
                              <Upload size={15} /> <span>{t('profile.ui.add_doc', 'Adicionar Documento')}</span>
                            </button>
                            {transferidoDocFiles.length === 0 && (
                              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{t('profile.ui.no_doc_attached', 'Nenhum documento anexado.')}</span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{t('profile.situation.transferido_limit', { max: MAX_TRANSFERIDO_DOCS, defaultValue: `Limite de ${MAX_TRANSFERIDO_DOCS} anexos atingido. Remova um documento para anexar outro.` })}</span>
                        )}
                      </div>

                      <div className="form-group full">
                        <label>{t('profile.ui.observation', 'Observação')}</label>
                        <textarea
                          rows={3}
                          value={wizardData.transferido_observacao}
                          onChange={e => set('transferido_observacao', e.target.value)}
                          placeholder={t('profile.situation.transferido_obs_placeholder', 'Informações adicionais sobre a transferência...')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 1 — 1. DADOS CIVIS ══ */}
              {wizardStep === 1 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.sections.civil', '1. Dados Civis')}</div>

                  <div className="form-group full">
                    <label>{t('missionaries.wizard.civil.full_name', 'Nome Completo *')}</label>
                    <input
                      type="text"
                      value={wizardData.nome}
                      onChange={e => set('nome', e.target.value.replace(/[0-9]/g, ''))}
                      placeholder={t('profile.access.full_name_placeholder', 'Nome completo')}
                    />
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.birth_date')}</label>
                      <input
                        type="date"
                        value={wizardData.data_nascimento}
                        onChange={e => set('data_nascimento', e.target.value)}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.father_name', 'Nome do Pai')}</label>
                      <input
                        type="text"
                        value={wizardData.nome_pai}
                        onChange={e => set('nome_pai', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder={t('profile.labels.father_name', 'Nome do Pai')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.mother_name', 'Nome da Mãe')}</label>
                      <input
                        type="text"
                        value={wizardData.nome_mae}
                        onChange={e => set('nome_mae', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder={t('profile.labels.mother_name', 'Nome da Mãe')}
                      />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.birth_place_city')}</label>
                      <input
                        type="text"
                        value={wizardData.cidade_estado}
                        onChange={e => set('cidade_estado', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder={t('profile.civil.city_placeholder', 'Ex: São Paulo, SP')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.country')}</label>
                      <input
                        type="text"
                        list="paises-list"
                        value={wizardData.pais}
                        onChange={e => set('pais', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder={t('profile.civil.country_placeholder', 'Ex: Brasil')}
                      />
                      <datalist id="paises-list">
                        {PAISES_COMMON.map(p => <option key={p} value={p} />)}
                      </datalist>
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.diocese')}</label>
                      <input
                        type="text"
                        value={wizardData.diocese}
                        onChange={e => set('diocese', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder={t('profile.civil.diocese_placeholder', 'Ex: Diocese de São Paulo')}
                      />
                    </div>
                  </div>

                  {/* Documentos de Identificação Civil */}
                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.civil.civil_docs', 'Documentos Civis')}</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>RG / RNM / CI / DI</label>
                      <input
                        type="text"
                        maxLength={30}
                        value={wizardData.rnm}
                        onChange={e => set('rnm', e.target.value)}
                        placeholder={t('profile.civil.rg_placeholder', 'Ex: 12.345.678-9, V123456-X...')}
                      />
                    </div>
                    <div className="form-group">
                      <label>CPF</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={wizardData.cpf}
                        onChange={e => set('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="00000000000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.civil.voter_id', 'Título Eleitor')}</label>
                      <input
                        type="text"
                        maxLength={12}
                        value={wizardData.titulo_eleitor}
                        onChange={e => set('titulo_eleitor', e.target.value.replace(/\D/g, '').slice(0, 12))}
                        placeholder="000000000000"
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>CNH</label>
                      <input
                        type="text"
                        maxLength={11}
                        value={wizardData.cnh}
                        onChange={e => set('cnh', e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="00000000000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.civil.passport', 'Passaporte')}</label>
                      <input
                        type="text"
                        maxLength={9}
                        value={wizardData.passaporte}
                        onChange={e => set('passaporte', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9))}
                        placeholder="AA000000"
                        style={{ fontFamily: 'monospace', letterSpacing: '2px' }}
                      />
                    </div>
                  </div>

                  {/* Nacionalidades */}
                  <div className="wizard-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
                    {t('missionaries.wizard.civil.nationalities')}
                    <button
                      type="button"
                      className="btn-add-doc"
                      style={{ padding: '2px 8px', fontSize: '10px' }}
                      onClick={() => set('nacionalidades', [...wizardData.nacionalidades, ''])}
                    >
                      <Plus size={12} /> {t('missionaries.wizard.civil.add_btn')}
                    </button>
                  </div>
                  <div className="wz-grid-2" style={{ gap: '10px', alignItems: 'start' }}>
                    {wizardData.nacionalidades.map((nac, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                        <input
                          type="text"
                          value={nac}
                          onChange={e => {
                            const newNacs = [...wizardData.nacionalidades];
                            newNacs[idx] = e.target.value;
                            set('nacionalidades', newNacs);
                          }}
                          placeholder={t('profile.civil.nationality_placeholder', 'Nacionalidade...')}
                          style={{ flex: 1 }}
                        />
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => set('nacionalidades', wizardData.nacionalidades.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer' }}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Documentos & Anexos */}
                  <div className="wizard-divider" style={{ marginTop: '16px' }}>{t('profile.sections.docs', 'Documentos & Anexos')}</div>
                  <p className="wizard-hint" style={{ marginBottom: 0 }}>
                    {t('missionaries.wizard.docs.hint')}
                  </p>

                  <div className="doc-add-row">
                    <input
                      type="text"
                      className="doc-desc-input"
                      placeholder={t('missionaries.wizard.docs.placeholder')}
                      value={pendingDocDescricao}
                      onChange={e => setPendingDocDescricao(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') fileInputRef.current?.click(); }}
                    />
                    <button
                      type="button"
                      className="btn-add-doc"
                      onClick={() => fileInputRef.current?.click()}
                      title={t('profile.ui.upload_hint', 'PDF, JPG ou PNG · máx. 20MB')}
                    >
                      <Plus size={16} /> {t('missionaries.wizard.docs.add_btn')}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                  </div>

                  {docs.length > 0 && (
                    <div className="docs-grid">
                      {docs.map(doc => (
                        <div key={doc.uid} className="doc-card">
                          <button type="button" className="doc-remove" onClick={() => removeDoc(doc.uid)}>
                            <X size={12} />
                          </button>
                          <div className="doc-thumb">
                            {doc.previewUrl
                              ? <img src={doc.previewUrl} alt={doc.descricao} />
                              : doc.tipo === 'pdf'
                                ? <FileText size={32} className="doc-icon-pdf" />
                                : <ImageIcon size={32} className="doc-icon-img" />
                            }
                          </div>
                          <div className="doc-info">
                            <span className="doc-desc">{doc.descricao}</span>
                            <span className="doc-filename">{doc.file?.name}</span>
                            <span className={`doc-type doc-type-${doc.tipo}`}>{doc.tipo.toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 2 — 2. CONTATOS ══ */}
              {wizardStep === 2 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.contact', '2. Contatos')}</div>

                  <div className="wizard-divider" style={{ marginTop: '6px' }}>{t('missionaries.wizard.address.main_address', 'Endereço Principal')}</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.cep')} {cepLoading && <Loader2 size={12} className="animate-spin" style={{ marginLeft: 4 }} />}</label>
                      <input
                        type="text"
                        value={wizardData.cep}
                        onChange={e => handleCepChange(e.target.value)}
                        placeholder="00000-000"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.address.neighborhood')}</label>
                      <input type="text" value={wizardData.bairro} onChange={e => set('bairro', e.target.value)} placeholder={t('missionaries.wizard.address.neighborhood_placeholder', 'Bairro...')} />
                    </div>
                  </div>

                  <div className="form-group full">
                    <label>{t('missionaries.wizard.address.street')}</label>
                    <input type="text" value={wizardData.logradouro} onChange={e => set('logradouro', e.target.value)} placeholder={t('missionaries.wizard.address.street_placeholder', 'Rua, Av., número...')} />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group"><label>{t('missionaries.wizard.address.complement')}</label><input type="text" value={wizardData.complemento} onChange={e => set('complemento', e.target.value)} placeholder={t('missionaries.wizard.address.complement_placeholder', 'Apto, Bloco...')} /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.city_state')}</label><input type="text" value={wizardData.endereco_cidade_estado} onChange={e => set('endereco_cidade_estado', e.target.value)} placeholder={t('missionaries.wizard.address.city_state_placeholder', 'Cidade - UF')} /></div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.address.missionary_contacts', 'Contatos do Missionário')}</div>
                  <div className="form-row-3">
                    <div className="form-group"><label>{t('missionaries.wizard.address.cellphone')}</label><input type="text" value={wizardData.celular_whatsapp} onChange={e => set('celular_whatsapp', e.target.value)} placeholder="(00) 90000-0000" /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.phone')}</label><input type="text" value={wizardData.telefone_fixo} onChange={e => set('telefone_fixo', e.target.value)} placeholder="(00) 0000-0000" /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.personal_email')}</label><input type="email" value={wizardData.email_pessoal} onChange={e => set('email_pessoal', e.target.value)} placeholder={t('missionaries.wizard.address.personal_email_placeholder', 'email@pessoal.com')} /></div>
                  </div>

                  {/* Contatos de Familiares / Parentes */}
                  <div className="wizard-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <span>{t('missionaries.wizard.contacts.family_title', 'Contatos de Familiares / Parentes')}</span>
                    {wizardData.contatos.length < 3 && (
                      <button
                        type="button"
                        className="btn-add-doc"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => set('contatos', [...wizardData.contatos, { parentesco: '', nome: '', endereco: '', telefone: '', email: '' }])}
                      >
                        <Plus size={12} /> {t('profile.contacts.add_btn', 'Adicionar Contato')}
                      </button>
                    )}
                  </div>

                  {wizardData.contatos.length === 0 ? (
                    <p style={{ opacity: 0.6, fontSize: '0.85rem', fontStyle: 'italic', margin: '4px 0' }}>
                      {t('profile.contacts.empty', 'Nenhum contato cadastrado. Adicione até 3 contatos.')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {wizardData.contatos.map((contato, idx) => (
                        <div key={idx} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => set('contatos', wizardData.contatos.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer' }}
                            title={t('profile.ui.remove', 'Remover')}
                          >
                            <Trash2 size={14} />
                          </button>

                          <div className="form-row-3" style={{ marginBottom: '10px' }}>
                            <div className="form-group">
                              <label>{t('profile.labels.relationship', 'Parentesco')}</label>
                              <select
                                value={['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) || contato.parentesco === '' ? contato.parentesco : 'Outros'}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newC = [...wizardData.contatos];
                                  newC[idx].parentesco = val === 'Outros' ? 'Outros' : val;
                                  set('contatos', newC);
                                }}
                              >
                                <option value="">{t('profile.ui.select', 'Selecione...')}</option>
                                <option value="Pai">{t('profile.contacts.rel_father', 'Pai')}</option>
                                <option value="Mãe">{t('profile.contacts.rel_mother', 'Mãe')}</option>
                                <option value="Irmão(a)">{t('profile.contacts.rel_sibling', 'Irmão(a)')}</option>
                                <option value="Outros">{t('profile.contacts.rel_others', 'Outros')}</option>
                              </select>
                              {((!['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) && contato.parentesco !== '') || contato.parentesco === 'Outros') && (
                                <input
                                  type="text"
                                  placeholder={t('profile.contacts.other_rel_placeholder', 'Qual parentesco? (ex: Padrasto)')}
                                  value={contato.parentesco === 'Outros' ? '' : contato.parentesco}
                                  onChange={e => {
                                    const newC = [...wizardData.contatos];
                                    newC[idx].parentesco = e.target.value;
                                    set('contatos', newC);
                                  }}
                                  style={{ marginTop: '6px' }}
                                />
                              )}
                            </div>
                            <div className="form-group">
                              <label>{t('profile.labels.name', 'Nome')}</label>
                              <input
                                type="text"
                                placeholder={t('profile.contacts.name_placeholder', 'Nome...')}
                                value={contato.nome}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].nome = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label>{t('profile.labels.phone', 'Telefone')}</label>
                              <input
                                type="text"
                                placeholder="(00) 00000-0000"
                                value={contato.telefone}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].telefone = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                          </div>

                          <div className="form-row-2">
                            <div className="form-group">
                              <label>{t('profile.labels.address', 'Endereço')}</label>
                              <input
                                type="text"
                                placeholder={t('profile.contacts.address_placeholder', 'Endereço completo...')}
                                value={contato.endereco}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].endereco = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label>{t('profile.labels.email', 'E-mail')}</label>
                              <input
                                type="email"
                                placeholder={t('profile.ui.email_placeholder', 'email@exemplo.com')}
                                value={contato.email}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].email = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 3 — 3. DADOS RELIGIOSOS ══ */}
              {wizardStep === 3 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.sections.religious', '3. Dados Religiosos')}</div>

                  <div className="wizard-divider" style={{ marginTop: '4px' }}>{t('missionaries.wizard.religious.sacraments', 'Sacramentos')}</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>{t('profile.labels.baptism', 'Batismo')}</label>
                      <input type="date" value={wizardData.data_batismo} onChange={e => set('data_batismo', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.first_communion', 'Primeira Comunhão')}</label>
                      <input type="date" value={wizardData.data_primeira_comunhao} onChange={e => set('data_primeira_comunhao', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.confirmation', 'Crisma')}</label>
                      <input type="date" value={wizardData.data_crisma} onChange={e => set('data_crisma', e.target.value)} />
                    </div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.religious.vows_title', 'Consagração e Votos')}</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.first_vows_date', 'Primeiros Votos (Data)')}</label>
                      <input type="date" value={wizardData.primeiros_votos_data} onChange={e => set('primeiros_votos_data', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.perpetual_vows_date', 'Votos Perpétuos (Data)')}</label>
                      <input type="date" value={wizardData.votos_perpetuos_data} onChange={e => set('votos_perpetuos_data', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>{t('missionaries.wizard.religious.profession_place', 'Lugar de Profissão')}</label>
                    <input type="text" value={wizardData.lugar_profissao} onChange={e => set('lugar_profissao', e.target.value)} placeholder={t('missionaries.wizard.religious.profession_place_placeholder', 'Lugar de profissão...')} />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.religious.ordination_title', 'Ordenação')}</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.diaconate_date', 'Diaconato (Data)')}</label>
                      <input type="date" value={wizardData.diaconato_data} onChange={e => set('diaconato_data', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.presbyterate_date', 'Presbiterato (Data)')}</label>
                      <input type="date" value={wizardData.presbiterato_data} onChange={e => set('presbiterato_data', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>{t('missionaries.wizard.religious.ordaining_bishop', 'Bispo Ordenante')}</label>
                    <input type="text" value={wizardData.bispo_ordenante} onChange={e => set('bispo_ordenante', e.target.value)} placeholder={t('missionaries.wizard.religious.bishop_placeholder', 'Nome do Bispo ordenante...')} />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.religious.admin_functions', 'Funções Administrativas')}</div>
                  <div className="form-row-2" style={{ marginTop: '6px' }}>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={wizardData.is_oconomo} onChange={e => set('is_oconomo', e.target.checked)} />
                      <span>{t('profile.oconomo_badge', 'É Ecônomo')}</span>
                    </label>
                    <label className="checkbox-label">
                      <input type="checkbox" checked={wizardData.is_superior} onChange={e => set('is_superior', e.target.checked)} />
                      <span>{t('profile.superior_badge', 'É Superior Local')}</span>
                    </label>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('missionaries.wizard.religious.attach_certificates', 'Anexar Certidões')}</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.baptism_certificate', 'Certidão de Batismo')}</label>
                      <FileInputButton accept=".pdf,.jpg,.jpeg,.png" onChange={e => setBatismoDocFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.communion_certificate', 'Certidão 1ª Comunhão')}</label>
                      <FileInputButton accept=".pdf,.jpg,.jpeg,.png" onChange={e => setComunhaoDocFile(e.target.files?.[0] || null)} />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.religious.confirmation_certificate', 'Certidão de Crisma')}</label>
                      <FileInputButton accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCrismaDocFile(e.target.files?.[0] || null)} />
                    </div>
                  </div>
                </div>
              )}

              {/* ══ STEP 4 — 4. ITINERÁRIO FORMATIVO ══ */}
              {wizardStep === 4 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.itinerary', '4. Itinerário Formativo')}</div>
                  <p className="wizard-hint">{t('missionaries.wizard.itinerary.hint', 'Preencha os dados das etapas de formação do missionário.')}</p>

                  <div className="wz-grid-2" style={{ gap: '14px' }}>
                    {([
                      { title: t('profile.itinerary.menu_4_1', '4.1 Seminário') },
                      ...['4.1.1', '4.1.2', '4.1.3', '4.1.4', '4.1.5', '4.1.6', '4.1.7'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_2_1', '4.2.1 Primeira Profissão') },
                      ...['4.2.1.1', '4.2.1.2', '4.2.1.3', '4.2.1.4', '4.2.1.5', '4.2.1.6', '4.2.1.7'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_2_2', '4.2.2 Renovação dos Votos') },
                      ...['4.2.2.1', '4.2.2.2', '4.2.2.3', '4.2.2.4'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_2_3', '4.2.3 Profissão Perpétua') },
                      ...['4.2.3.1', '4.2.3.2', '4.2.3.3', '4.2.3.4', '4.2.3.5', '4.2.3.6', '4.2.3.7', '4.2.3.8', '4.2.3.9', '4.2.3.10'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_3_1', '4.3.1 Leitorado') },
                      ...['4.3.1.1', '4.3.1.2', '4.3.1.3', '4.3.1.4'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_3_2', '4.3.2 Acolitado') },
                      ...['4.3.2.1', '4.3.2.2', '4.3.2.3', '4.3.2.4'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_3_3', '4.3.3 Diaconato') },
                      ...['4.3.3.1', '4.3.3.2', '4.3.3.3', '4.3.3.4', '4.3.3.5', '4.3.3.6', '4.3.3.7', '4.3.3.8'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_3_4', '4.3.4 Presbiterado') },
                      ...['4.3.4.1', '4.3.4.2', '4.3.4.3', '4.3.4.4', '4.3.4.5', '4.3.4.6', '4.3.4.7', '4.3.4.8'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.h_4_3_5', '4.3.5 Primeira destinação missionária') },
                      ...['4.3.5.1', '4.3.5.2', '4.3.5.3'].map(etapa => ({ etapa })),
                      { title: t('profile.itinerary.menu_4_4', '4.4 Destinação dada pela Direção') },
                      { etapa: '4.4' },
                    ] as { title?: string; etapa?: string }[]).map((seg, idx) => {
                      if (seg.title) {
                        return (
                          <div key={idx} style={{ gridColumn: '1 / -1', color: '#013375', fontWeight: 700, marginTop: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', fontSize: '0.9rem' }}>
                            {seg.title}
                          </div>
                        );
                      }
                      const etapa = seg.etapa as string;
                      const ptLabel = ITIN_STAGES.find(s => itinStageCode(s) === etapa) || etapa;
                      // Como no perfil: cada subitem aceita vários Local/Período (etapa, etapa-<timestamp>, ...)
                      const entries = wizardData.itinerario.filter(s => s.etapa === etapa || s.etapa.startsWith(etapa + '-'));
                      const stagesToRender = entries.some(s => s.etapa === etapa)
                        ? entries
                        : [{ etapa, is_sub_etapa: true, local: '', periodo: '', observacoes: '' }, ...entries];
                      const updateStage = (key: string, field: 'local' | 'periodo' | 'observacoes', val: string) => {
                        const newItin = [...wizardData.itinerario];
                        const ti = newItin.findIndex(s => s.etapa === key);
                        if (ti > -1) {
                          newItin[ti] = { ...newItin[ti], [field]: val };
                        } else {
                          newItin.push({ etapa: key, is_sub_etapa: true, local: '', periodo: '', observacoes: '', [field]: val });
                        }
                        set('itinerario', newItin);
                      };
                      const addEntry = () => set('itinerario', [...wizardData.itinerario, { etapa: `${etapa}-${Date.now()}`, is_sub_etapa: true, local: '', periodo: '', observacoes: '' }]);
                      const removeEntry = (key: string) => set('itinerario', wizardData.itinerario.filter(s => s.etapa !== key));
                      return (
                        <div key={idx} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fafafa' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.78rem', color: '#013375' }}>{itinStageLabel(etapa, ptLabel)}</span>
                            <button type="button" className="btn-add-doc" style={{ padding: '2px 8px', fontSize: '0.72rem', whiteSpace: 'nowrap' }} onClick={addEntry}>
                              <Plus size={12} /> {t('profile.itinerary.add_place_period', 'Adicionar Local/Período')}
                            </button>
                          </div>
                          {stagesToRender.map((stage, sIdx) => (
                            <div key={stage.etapa} style={{ display: 'flex', gap: '8px', flexDirection: 'column', paddingTop: sIdx > 0 ? '8px' : 0, marginTop: sIdx > 0 ? '8px' : 0, borderTop: sIdx > 0 ? '1px dashed #cbd5e1' : 'none' }}>
                              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                <div className="form-group" style={{ flex: '1 1 120px', marginBottom: 0 }}>
                                  <input type="text" value={stage.periodo} onChange={e => updateStage(stage.etapa, 'periodo', e.target.value)} placeholder={t('missionaries.wizard.itinerary.period_placeholder', 'Período (ex: 1990-1994)')} style={{ fontSize: '0.78rem' }} />
                                </div>
                                <div className="form-group" style={{ flex: '2 1 160px', marginBottom: 0 }}>
                                  <input type="text" value={stage.local} onChange={e => updateStage(stage.etapa, 'local', e.target.value)} placeholder={t('profile.modal.place_institution', 'Local / Instituição')} style={{ fontSize: '0.78rem' }} />
                                </div>
                                {stage.etapa !== etapa && (
                                  <button type="button" onClick={() => removeEntry(stage.etapa)} title={t('common.delete', 'Excluir')} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '16px', minWidth: '32px', minHeight: '32px' }}>✕</button>
                                )}
                              </div>
                              <div className="form-group" style={{ marginBottom: 0, width: '100%' }}>
                                <textarea rows={2} value={stage.observacoes || ''} onChange={e => updateStage(stage.etapa, 'observacoes', e.target.value)} placeholder={t('profile.ui.observation', 'Observação')} style={{ fontSize: '0.78rem', width: '100%', resize: 'vertical' }} />
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '16px' }}>{t('missionaries.wizard.itinerary.docs_title', 'Documentos do Itinerário (opcional)')}</div>
                  <div className="form-row-2" style={{ alignItems: 'flex-end', gap: '10px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>{t('missionaries.wizard.itinerary.select_stage', 'Selecione a Etapa')}</label>
                      <select
                        value={itinSelectedStage}
                        onChange={e => setItinSelectedStage(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">{t('missionaries.wizard.itinerary.choose_stage', '-- Escolha uma etapa --')}</option>
                        {ITIN_STAGES.map(s => <option key={s} value={s}>{itinStageLabel(itinStageCode(s), s)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <button
                        type="button"
                        className="btn-add-doc"
                        onClick={() => itinStepFileRef.current?.click()}
                        disabled={!itinSelectedStage}
                        style={{ height: '42px', opacity: itinSelectedStage ? 1 : 0.6 }}
                      >
                        <Plus size={16} /> {t('profile.labels.attach_file', 'Anexar arquivo')}
                      </button>
                      <input
                        ref={itinStepFileRef}
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file && itinSelectedStage) {
                            setItineraryDocs(prev => [...prev, { file, stage: itinSelectedStage }]);
                            setItinSelectedStage('');
                            if (itinStepFileRef.current) itinStepFileRef.current.value = '';
                          }
                        }}
                      />
                    </div>
                  </div>

                  {itineraryDocs.length > 0 && (
                    <div style={{ marginTop: '10px', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#666' }}>{t('missionaries.wizard.itinerary.selected_files', 'Arquivos Selecionados:')}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {itineraryDocs.map((d, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #eee' }}>
                            <div style={{ fontSize: '13px' }}>
                              <strong style={{ color: 'var(--primary)' }}>{itinStageLabel(itinStageCode(d.stage), d.stage)}:</strong> <span style={{ color: '#666' }}>{d.file.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setItineraryDocs(prev => prev.filter((_, i) => i !== idx))}
                              title={t('profile.ui.remove', 'Remover')}
                              style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '16px' }}
                            >✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 5 — 5. FORMAÇÃO ACADÊMICA ══ */}
              {wizardStep === 5 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.formacao_academica', '5. Formação Acadêmica')}</div>
                  <div className="form-group full">
                    <label>{t('profile.modal.course_required', 'Curso *')}</label>
                    <input type="text" value={wizardData.formacao_curso} onChange={e => set('formacao_curso', e.target.value)} placeholder={t('profile.modal.course_placeholder', 'Ex: Teologia, Filosofia, História...')} />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('profile.modal.institution_faculty', 'Instituição / Faculdade')}</label>
                      <input type="text" value={wizardData.formacao_instituicao} onChange={e => set('formacao_instituicao', e.target.value)} placeholder={t('profile.modal.institution_placeholder', 'Ex: PUC, USP...')} />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.modal.formation_period', 'Data / Período de Formação')}</label>
                      <input type="text" value={wizardData.formacao_periodo} onChange={e => set('formacao_periodo', e.target.value)} placeholder={t('profile.modal.formation_period_placeholder', 'Ex: 2018-2022 ou 2022')} />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>{t('profile.ui.observations', 'Observações')}</label>
                    <textarea rows={3} value={wizardData.formacao_observacoes} onChange={e => set('formacao_observacoes', e.target.value)} placeholder={t('profile.modal.extra_obs_placeholder', 'Observações adicionais...')} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('profile.modal.attach_doc_image', 'Anexar Documento / Imagem (Certificado, Diploma, Declaração)')}</div>
                  <div className="doc-add-row" style={{ alignItems: 'center' }}>
                    <button type="button" className="btn-add-doc" onClick={() => formacaoFileRef.current?.click()}>
                      <Plus size={16} /> <span>{formacaoDocFile ? t('missionaries.wizard.common.replace_doc', 'Substituir Documento') : t('missionaries.wizard.common.attach_pdf_image', 'Anexar PDF / Imagem')}</span>
                    </button>
                    <span style={{ fontSize: '13px', color: formacaoDocFile ? '#166534' : '#666' }}>
                      {formacaoDocFile ? formacaoDocFile.name : t('missionaries.wizard.common.no_file_selected', 'Nenhum arquivo selecionado')}
                    </span>
                    <input
                      ref={formacaoFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => setFormacaoDocFile(e.target.files?.[0] || null)}
                    />
                    {formacaoDocFile && (
                      <button type="button" onClick={() => setFormacaoDocFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title={t('profile.ui.remove', 'Remover')}>✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 6 — 6. ATIVIDADE MISSIONÁRIA ══ */}
              {wizardStep === 6 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.atividade_missionaria', '6. Atividade Missionária')}</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('profile.modal.mission_place_required', 'Lugar / Local da Missão *')}</label>
                      <input type="text" value={wizardData.atividade_lugar} onChange={e => set('atividade_lugar', e.target.value)} placeholder={t('profile.modal.mission_place_placeholder', 'Ex: Paróquia São José - São Paulo, SP')} />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.period', 'Período')}</label>
                      <input type="text" value={wizardData.atividade_periodo} onChange={e => set('atividade_periodo', e.target.value)} placeholder={t('profile.modal.period_placeholder', 'Ex: 2020-2024 ou 2024')} />
                    </div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('profile.modal.activity_function', 'Função da Atividade')}</div>
                  <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '8px' }}>
                    {t('missionaries.wizard.activity.functions_hint', 'Selecione uma ou mais funções exercidas nesta atividade missionária:')}
                  </p>
                  <div className="wz-grid-2" style={{ gap: '8px 12px' }}>
                    {FUNCOES_ATIVIDADE.map(r => (
                      <label key={r.value} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={Array.isArray(wizardData.atividade_funcoes) && wizardData.atividade_funcoes.includes(r.value)}
                          onChange={e => {
                            const current = Array.isArray(wizardData.atividade_funcoes) ? [...wizardData.atividade_funcoes] : [];
                            if (e.target.checked) {
                              if (!current.includes(r.value)) current.push(r.value);
                            } else {
                              const idx = current.indexOf(r.value);
                              if (idx >= 0) current.splice(idx, 1);
                            }
                            set('atividade_funcoes', current);
                          }}
                        />
                        {t(`profile.functions.${r.key}`, r.value)}
                      </label>
                    ))}
                  </div>

                  <div className="form-group full" style={{ marginTop: '12px' }}>
                    <label>{t('profile.modal.other_functions', 'Outras Funções (preenchimento livre)')}</label>
                    <input
                      type="text"
                      value={wizardData.atividade_funcoes_outros}
                      onChange={e => set('atividade_funcoes_outros', e.target.value)}
                      placeholder={t('profile.modal.other_function_placeholder', 'Digite outra função se houver...')}
                    />
                  </div>

                  <div className="form-group full" style={{ marginTop: '12px' }}>
                    <label>{t('profile.modal.mission_desc_activities', 'Descrição da Missão / Atividades')}</label>
                    <textarea rows={3} value={wizardData.atividade_missao} onChange={e => set('atividade_missao', e.target.value)} placeholder={t('profile.modal.mission_desc_placeholder', 'Descreva a missão realizada...')} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              {/* ══ STEP 7 — 7. SAÚDE ══ */}
              {wizardStep === 7 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.saude_individual', '7. Saúde')}</div>
                  <div className="form-row-3">
                    <div className="form-group"><label>{t('profile.labels.cns', 'CNS (Cartão SUS)')}</label><input type="text" value={wizardData.saude_sus} onChange={e => set('saude_sus', e.target.value)} placeholder={t('missionaries.wizard.health.sus_placeholder', 'Cartão SUS')} /></div>
                    <div className="form-group"><label>{t('profile.labels.insurance', 'Seguradora')}</label><input type="text" value={wizardData.saude_seguradora} onChange={e => set('saude_seguradora', e.target.value)} placeholder={t('missionaries.wizard.health.insurer_placeholder', 'Seguradora')} /></div>
                    <div className="form-group"><label>{t('profile.labels.wallet_num', 'Nº Carteira')}</label><input type="text" value={wizardData.saude_carteira} onChange={e => set('saude_carteira', e.target.value)} placeholder={t('missionaries.wizard.health.wallet_placeholder', 'Número da carteira')} /></div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>{t('profile.health.card_attachment', 'Cartão do SUS ou Convênio Médico (imagem ou PDF)')}</div>
                  <div className="doc-add-row" style={{ alignItems: 'center' }}>
                    <button type="button" className="btn-add-doc" onClick={() => saudeFileRef.current?.click()}>
                      <Plus size={16} /> <span>{saudeDocFile ? t('missionaries.wizard.common.replace_doc', 'Substituir Documento') : t('missionaries.wizard.common.attach_pdf_image', 'Anexar PDF / Imagem')}</span>
                    </button>
                    <span style={{ fontSize: '13px', color: saudeDocFile ? '#166534' : '#666' }}>
                      {saudeDocFile ? saudeDocFile.name : t('missionaries.wizard.common.no_file_selected', 'Nenhum arquivo selecionado')}
                    </span>
                    <input
                      ref={saudeFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      style={{ display: 'none' }}
                      onChange={e => setSaudeDocFile(e.target.files?.[0] || null)}
                    />
                    {saudeDocFile && (
                      <button type="button" onClick={() => setSaudeDocFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title={t('profile.ui.remove', 'Remover')}>✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 8 — 8. PREVIDENCIÁRIO / IR ══ */}
              {wizardStep === 8 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.previdenciario', '8. Previdenciário / IR')}</div>
                  <div className="form-group full" style={{ maxWidth: '400px' }}>
                    <label>{t('profile.labels.nit', 'NIT (Número de Identificação do Trabalhador)')}</label>
                    <input type="text" value={wizardData.nit} onChange={e => set('nit', e.target.value)} placeholder={t('profile.social.nit_placeholder', 'Digite o NIT...')} />
                  </div>
                </div>
              )}

              {/* ══ STEP 9 — 9. CONTAS BANCÁRIAS ══ */}
              {wizardStep === 9 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.contas_bancarias', '9. Contas Bancárias')}</div>
                  <div className="form-group full" style={{ marginBottom: '14px' }}>
                    <label>{t('profile.modal.bank_institution', 'Instituição Financeira / Banco')}</label>
                    <BankAutocomplete
                      value={wizardData.banco_nome}
                      onChange={val => set('banco_nome', val)}
                      placeholder={t('profile.modal.bank_placeholder', 'Selecione ou digite o banco (ex: Nubank, Mercado Pago, C6, Inter, Itaú, BB...)')}
                    />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group"><label>{t('profile.labels.account_type', 'Tipo de Conta')}</label><input type="text" value={wizardData.banco_tipo} onChange={e => set('banco_tipo', e.target.value)} placeholder={t('profile.modal.account_type_placeholder', 'Ex: Corrente, Poupança, Salário, Pagamento')} /></div>
                    <div className="form-group"><label>{t('profile.labels.ownership', 'Titularidade')}</label><input type="text" value={wizardData.banco_titular} onChange={e => set('banco_titular', e.target.value)} placeholder={t('profile.modal.holder_placeholder', 'Nome do titular da conta')} /></div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>{t('profile.labels.agency', 'Agência')}</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={wizardData.banco_agencia}
                        onChange={e => set('banco_agencia', e.target.value.replace(/[^0-9a-zA-Z\-/.]/g, '').slice(0, 10))}
                        placeholder={t('profile.modal.agency_placeholder', 'Ex: 0001 ou 1234-5')}
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.account_num', 'Número Conta')}</label>
                      <input
                        type="text"
                        maxLength={16}
                        value={wizardData.banco_numero}
                        onChange={e => set('banco_numero', e.target.value.replace(/[^0-9a-zA-Z\-/.]/g, '').slice(0, 16))}
                        placeholder={t('profile.modal.account_num_placeholder', 'Ex: 12345678-9')}
                      />
                    </div>
                  </div>
                  <div className="form-group full" style={{ marginTop: '6px' }}>
                    <label>{t('profile.modal.account_obs', 'Observações da Conta')}</label>
                    <textarea
                      value={wizardData.banco_observacoes}
                      onChange={e => set('banco_observacoes', e.target.value)}
                      placeholder={t('profile.modal.account_obs_placeholder', 'Observações relativas à conta bancária (chave PIX, finalidade, etc.)...')}
                      rows={3}
                      style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              )}

              {/* ══ STEP 10 — 10. OBRAS REALIZADAS ══ */}
              {wizardStep === 10 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.formacao_missao', '10. Obras Realizadas')}</div>
                  <div className="form-row-2">
                    <div className="form-group"><label>{t('profile.labels.place', 'Lugar')}</label><input type="text" value={wizardData.obra_lugar} onChange={e => set('obra_lugar', e.target.value)} placeholder={t('missionaries.wizard.works.place_placeholder', 'Local da obra/livro...')} /></div>
                    <div className="form-group"><label>{t('profile.labels.period', 'Período')}</label><input type="text" value={wizardData.obra_periodo} onChange={e => set('obra_periodo', e.target.value)} placeholder={t('missionaries.wizard.works.period_placeholder', 'Ex: 2010-2015')} /></div>
                  </div>
                  <div className="form-group full">
                    <label>{t('profile.labels.work_done', 'Obra Realizada')}</label>
                    <textarea rows={3} value={wizardData.obra_descricao} onChange={e => set('obra_descricao', e.target.value)} placeholder={t('missionaries.wizard.works.desc_placeholder', 'Título da publicação ou detalhes da obra...')} style={{ width: '100%', boxSizing: 'border-box' }} />
                  </div>
                </div>
              )}

              {/* ══ STEP 11 — 11. OBSERVAÇÕES ══ */}
              {wizardStep === 11 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.obs', '11. Observações')}</div>
                  <div className="form-group full">
                    <label>{t('profile.labels.obs_text', 'Texto da Observação')}</label>
                    <textarea value={wizardData.obs_geral} onChange={e => set('obs_geral', e.target.value)} placeholder={t('missionaries.wizard.obs.placeholder', 'Observações gerais do missionário...')} style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', minHeight: '100px' }} />
                  </div>
                </div>
              )}

              {/* ══ STEP 12 — 12. CURRICULUM VITAE ══ */}
              {wizardStep === 12 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.tabs.quadro_pessoal', '12. Curriculum Vitae')}</div>
                  <p className="wizard-hint">
                    {t('missionaries.wizard.cv.hint', 'Anexe o arquivo oficial do Curriculum Vitae do missionário e/ou insira links para perfis profissionais/pessoais externos.')}
                  </p>
                  <div className="form-group full" style={{ marginTop: '1rem' }}>
                    <label>{t('profile.labels.current_function', 'Função Atual')}</label>
                    <input type="text" value={wizardData.quadro_funcao_atual} onChange={e => set('quadro_funcao_atual', e.target.value)} />
                  </div>
                  <div className="form-group full">
                    <label>{t('profile.labels.competencies_summary', 'Competências / Resumo')}</label>
                    <textarea rows={4} value={wizardData.quadro_competencias} onChange={e => set('quadro_competencias', e.target.value)} />
                  </div>
                  <div className="doc-add-row" style={{ alignItems: 'center', marginTop: '1rem' }}>
                    <button type="button" className="btn-add-doc" onClick={() => quadroFileRef.current?.click()}>
                      <Plus size={16} /> <span>{quadroCvFile ? t('profile.cv.replace_cv', 'Substituir CV') : t('profile.cv.attach_cv_file', 'Anexar Arquivo do CV')}</span>
                    </button>
                    <span style={{ fontSize: '13px', color: quadroCvFile ? '#166534' : '#666', fontWeight: quadroCvFile ? 600 : 400 }}>
                      {quadroCvFile ? `✓ ${quadroCvFile.name}` : t('profile.cv.empty_title', 'Nenhum Curriculum Vitae Anexado')}
                    </span>
                    <input
                      ref={quadroFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => setQuadroCvFile(e.target.files?.[0] || null)}
                    />
                    {quadroCvFile && (
                      <button type="button" onClick={() => setQuadroCvFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title={t('profile.ui.remove', 'Remover')}>✕</button>
                    )}
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.35rem', color: '#1e293b' }}>
                      {t('profile.links.title', 'Links Externos (Perfis Profissionais / Pessoais)')}
                    </label>
                    <textarea
                      className="form-control"
                      rows={3}
                      placeholder="https://www.linkedin.com/in/...&#10;http://lattes.cnpq.br/...&#10;https://orcid.org/..."
                      value={wizardData.quadro_links_externos}
                      onChange={e => setWizardData(prev => ({ ...prev, quadro_links_externos: e.target.value }))}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    <small style={{ color: '#64748b', fontSize: '0.8rem', display: 'block', marginTop: '4px' }}>
                      {t('missionaries.wizard.cv.links_help', 'Insira os links para perfis profissionais ou pessoais externos (um por linha).')}
                    </small>
                  </div>
                </div>
              )}

              {/* ══ STEP 13 — PRESENÇA MISSIONÁRIA ══ */}
              {wizardStep === 13 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('profile.sections.bind_house', 'Presença Missionária')}</div>
                  <p className="wizard-hint">
                    {t('missionaries.wizard.houses.link_hint', 'Vincule o missionário a uma ou mais casas religiosas.')}
                  </p>

                  <div className="casa-wizard-add">
                    <div className="casa-wizard-add-fields">
                      <div className="form-group">
                        <label>{t('missionaries.wizard.houses.select_house', 'Comunidade Religiosa')}</label>
                        <select
                          value={novaCasa.casa_id}
                          onChange={e => {
                            const val = e.target.value;
                            const sel = (Array.isArray(casasDisponiveis) ? casasDisponiveis : []).find(c => String(c.id) === String(val));
                            setNovaCasa(p => ({
                              ...p,
                              casa_id: val,
                              tipo: sel?.tipo ? sel.tipo : p.tipo,
                              pm: sel?.pm_code ? sel.pm_code : p.pm,
                              pais: sel?.pais ? sel.pais : (p.pais || 'Brasil'),
                            }));
                          }}
                        >
                          <option value="">{t('profile.ui.select', 'Selecione...')}</option>
                          {(Array.isArray(casasDisponiveis) ? [...casasDisponiveis].sort((a, b) => (a.nome || '').localeCompare(b.nome || '')) : []).map(c => (
                            <option key={c.id} value={c.id}>{c.nome}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.type', 'Tipo')}</label>
                        <select value={novaCasa.tipo} onChange={e => setNovaCasa(p => ({ ...p, tipo: e.target.value }))}>
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
                        <input type="text" value={novaCasa.pm} onChange={e => setNovaCasa(p => ({ ...p, pm: e.target.value }))} placeholder={t('profile.casas.pm_placeholder', 'Ex: CR 13')} />
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.country', 'País')}</label>
                        <input type="text" list="paises-list" value={novaCasa.pais} onChange={e => setNovaCasa(p => ({ ...p, pais: e.target.value }))} placeholder={t('profile.ui.select_or_type', 'Selecione ou digite...')} />
                      </div>
                      <div className="form-group">
                        <label>{t('missionaries.wizard.houses.start_date', 'Data de Início')}</label>
                        <input type="date" value={novaCasa.data_inicio} onChange={e => setNovaCasa(p => ({ ...p, data_inicio: e.target.value }))} />
                      </div>
                      <div className="form-group">
                        <label>{t('profile.labels.exit_date_optional', 'Data de Saída (opcional)')}</label>
                        <input type="date" value={novaCasa.data_fim || ''} min={novaCasa.data_inicio || undefined} onChange={e => setNovaCasa(p => ({ ...p, data_fim: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                      <button type="button" className="btn-add-casa-wz" onClick={addCasaVinculo}>
                        <Plus size={15} /> {t('profile.actions.bind_btn', 'Vincular Casa')}
                      </button>
                    </div>
                  </div>

                  {!Array.isArray(casasVinculos) || casasVinculos.length === 0 ? (
                    <div className="casa-empty">{t('profile.casas.empty', 'Nenhuma casa vinculada.')}</div>
                  ) : (
                    <div className="casas-wz-list">
                      {casasVinculos.map((v, i) => (
                        <div key={i} className="casa-wz-item">
                          <div className="casa-wz-left">
                            <HomeIcon size={18} className="casa-icon" />
                            <div>
                              <span className="casa-wz-nome">{casaNome(v.casa_id)}</span>
                              <div className="casa-wz-meta">
                                <span>{formatDateLocal(v.data_inicio)} → {v.data_fim ? formatDateLocal(v.data_fim) : t('profile.casas.current', 'Atual')}</span>
                                <span className="duracao-pill">⏱ {calcDuracao(v.data_inicio, v.data_fim)}</span>
                                {v.pm && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>{t('profile.labels.pm', 'PM')}: {v.pm}</div>}
                                {v.tipo && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{v.tipo}</div>}
                              </div>
                            </div>
                          </div>
                          <button type="button" className="btn-remove-wz" onClick={() => removeCasaVinculo(i)} title={t('profile.ui.remove', 'Remover')}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 14 — ACESSO & PERMISSÕES ══ */}
              {wizardStep === 14 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">{t('missionaries.wizard.steps.access_permissions', 'Acesso & Permissões')}</div>

                  {wizardData.situacao === 'Falecido' ? (
                    <div style={{
                      background: 'linear-gradient(90deg, #f1f5f9, #f8fafc)',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      marginBottom: '16px',
                    }}>
                      <h4 style={{ margin: '0 0 6px 0', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🕊️ {t('missionaries.wizard.access.deceased_title', 'Registro de Missionário Falecido')}
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                        {t('missionaries.wizard.access.deceased_text_1', 'Para missionários com situação')} <strong>{t('missionaries.situations.falecido', 'Falecido')}</strong>{t('missionaries.wizard.access.deceased_text_2', ', as credenciais de login e as permissões de acesso ao sistema')} <strong>{t('missionaries.wizard.access.deceased_text_3', 'não são obrigatórias nem necessárias')}</strong>{t('missionaries.wizard.access.deceased_text_4', '. O histórico completo de cadastro e o registro de óbito serão preservados para consultas institucionais.')}
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="wizard-hint">
                        {t('missionaries.wizard.access.setup_hint', 'Configure os dados de login e permissões de acesso do missionário ao sistema.')}
                      </p>
                      <div className="form-group full">
                        <label>{t('missionaries.wizard.access.email', 'E-mail de Login *')}</label>
                        <input type="email" value={wizardData.login} onChange={e => set('login', e.target.value)} placeholder="padre@email.com" />
                      </div>
                      <div className="form-group full">
                        <label>{t('missionaries.wizard.access.password_label', 'Senha de Acesso')} <span style={{ color: '#94a3b8', fontWeight: 400 }}>{t('missionaries.wizard.access.optional', '(opcional)')}</span></label>
                        <div className="password-group">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={wizardData.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder={t('missionaries.wizard.access.password_placeholder', 'Deixe em branco para usar a senha padrão')}
                          />
                          <button type="button" className="password-toggle" onClick={() => setShowPassword(p => !p)}>
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        </div>
                        <div style={{
                          display: 'flex', alignItems: 'flex-start', gap: '10px', marginTop: '10px',
                          background: 'linear-gradient(90deg, #eff6ff, #f0fdf4)',
                          border: '1px solid #bfdbfe', borderRadius: '10px', padding: '10px 14px',
                        }}>
                          <span style={{ fontSize: '16px', marginTop: '1px' }}>ℹ️</span>
                          <p style={{ margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.6 }}>
                            {t('missionaries.wizard.access.default_password_note', 'Se nenhuma senha for digitada, o sistema usará a senha padrão')}{' '}
                            <strong style={{ color: '#1d4ed8', fontFamily: 'monospace', fontSize: '0.9rem' }}>Scalab@10</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="form-group full">
                        <label>{t('missionaries.wizard.access.account_status', 'Status da Conta')}</label>
                        <select value={wizardData.status} onChange={e => set('status', e.target.value as 'ATIVO' | 'INATIVO')}>
                          <option value="ATIVO">{t('missionaries.wizard.access.status_active', 'Ativo - Acesso Liberado')}</option>
                          <option value="INATIVO">{t('missionaries.wizard.access.status_inactive', 'Inativo - Acesso Bloqueado')}</option>
                        </select>
                      </div>

                      <div className="form-group full">
                        <label>{t('missionaries.wizard.access.permissions_label', 'Acesso (Permissões)')}</label>
                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                          <div className="wz-grid-3" style={{ gap: '12px' }}>
                            {PERMISSIONS_LIST.map(perm => (
                              <div key={perm.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer', padding: '6px 4px' }}>
                                <input
                                  type="checkbox"
                                  checked={!!wizardData.permissoes?.[perm.id]}
                                  onChange={() => {
                                    const newPerms = { ...wizardData.permissoes };
                                    newPerms[perm.id] = !newPerms[perm.id];
                                    set('permissoes', newPerms);
                                  }}
                                />
                                <div style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>{t(`profile.permissions_list.${perm.id}`, perm.label)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Summary */}
                  <div className="wizard-summary" style={{ marginTop: '16px' }}>
                    <h4>{t('missionaries.wizard.access.summary_title', 'Resumo do Cadastro')}</h4>
                    <div className="summary-row"><span>{t('profile.labels.name', 'Nome')}:</span><strong>{wizardData.nome || '—'}</strong></div>
                    <div className="summary-row"><span>{t('missionaries.table.situation', 'Situação')}:</span><strong>{situacaoLabel(wizardData.situacao)}</strong></div>
                    {wizardData.situacao !== 'Falecido' && (
                      <div className="summary-row"><span>{t('profile.labels.login_email', 'E-mail de Login')}:</span><strong>{wizardData.login || '—'}</strong></div>
                    )}
                    {wizardData.situacao === 'Falecido' && wizardData.data_falecimento && (
                      <div className="summary-row"><span>{t('missionaries.wizard.access.summary_death_date', 'Data do Óbito')}:</span><strong>{formatDateLocal(wizardData.data_falecimento)}</strong></div>
                    )}
                    {wizardData.situacao === 'Transferido' && (wizardData.transferido_origem || wizardData.transferido_destino) && (
                      <div className="summary-row"><span>{t('missionaries.wizard.access.summary_transfer', 'Transferência')}:</span><strong>{wizardData.transferido_origem || '—'} ➔ {wizardData.transferido_destino || '—'}</strong></div>
                    )}
                    <div className="summary-row"><span>{t('missionaries.wizard.access.summary_houses', 'Casas Vinculadas')}:</span><strong>{casasVinculos.length}</strong></div>
                    <div className="summary-row"><span>{t('missionaries.wizard.access.summary_docs', 'Documentos Anexados')}:</span><strong>{docs.length + (certidaoObitoFile ? 1 : 0) + exclaustradoDocFiles.length + transferidoDocFiles.length + (formacaoDocFile ? 1 : 0) + (saudeDocFile ? 1 : 0) + (quadroCvFile ? 1 : 0)}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="wizard-footer">
              <button
                type="button"
                className="btn-back"
                onClick={() => wizardStep > 0 ? setWizardStep(s => s - 1) : setIsWizardOpen(false)}
              >
                {wizardStep > 0 ? <><ChevronLeft size={18} /> {t('common.back', 'Voltar')}</> : t('common.cancel', 'Cancelar')}
              </button>

              <div className="step-dots">
                {STEPS.map((_, i) => <span key={i} className={`dot ${i === wizardStep ? 'active' : ''} ${i < wizardStep ? 'done' : ''}`} />)}
              </div>

              {wizardStep < STEPS.length - 1 ? (
                <button
                  type="button"
                  className="btn-save"
                  onClick={() => {
                    if (wizardStep === 1 && !wizardData.nome.trim()) {
                      appAlert(t('missionaries.wizard.msgs.name_required', 'Informe o nome completo.'));
                      return;
                    }
                    setWizardStep(s => s + 1);
                  }}
                >
                  {t('missionaries.wizard.common.next', 'Próximo')} <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-save"
                  onClick={handleFinish}
                  disabled={saveLoading}
                >
                  {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {t('missionaries.wizard.access.btn_finish', 'Cadastrar Missionário')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Missionarios;
