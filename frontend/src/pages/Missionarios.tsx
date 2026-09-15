import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight, ChevronLeft, User, MapPin, BookOpen, Lock, CheckCircle,
  Home as HomeIcon, Plus, Trash2, FileText, Image as ImageIcon,
  Activity, Users, Search, Filter, Eye, X, Loader2, AlertCircle,
  GraduationCap, DollarSign, Save, ShieldCheck, EyeOff, Star, Upload
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import '../styles/Perfis.css';
import '../styles/Missionarios.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Missionario {
  id: number;
  nome: string;
  login: string;
  role: 'PADRE';
  status: 'ATIVO' | 'INATIVO';
  situacao: 'ATIVO' | 'FALECIDO' | 'EGRESSO' | 'EXCLAUSTRADO';
  is_oconomo: boolean;
  is_superior: boolean;
  casa_nome?: string;
  cidade?: string;
  pais?: string;
  cidade_nascimento?: string;
  pais_nascimento?: string;
}

interface Casa { id: number; nome: string; }

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
  banco_tipo: string;
  banco_titular: string;
  banco_agencia: string;
  banco_numero: string;

  // Step 10 - Obras Realizadas
  obra_periodo: string;
  obra_lugar: string;
  obra_descricao: string;

  // Step 11 - Observações
  obs_geral: string;

  // Step 12 - Quadro de Pessoal CV
  quadro_funcao_atual: string;
  quadro_competencias: string;

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

const initialWizard: WizardData = {
  situacao: 'Ativo',
  data_falecimento: '',
  cidade_falecimento: '',
  local_sepultamento: '',
  exclaustrado_data: '',
  exclaustrado_processo: '',

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

  banco_tipo: '',
  banco_titular: '',
  banco_agencia: '',
  banco_numero: '',

  obra_periodo: '',
  obra_lugar: '',
  obra_descricao: '',

  obs_geral: '',

  quadro_funcao_atual: '',
  quadro_competencias: '',

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
  let meses = hoje.getMonth() - ini.getMonth();
  if (meses < 0) { anos--; meses += 12; }
  const parts = [];
  if (anos > 0) parts.push(`${anos} ano${anos > 1 ? 's' : ''}`);
  if (meses > 0) parts.push(`${meses} ${meses > 1 ? 'meses' : 'mês'}`);
  return parts.length ? parts.join(' e ') : 'menos de 1 mês';
}

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
  const { canEdit } = useAuth();
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
    { num: '0', label: '0. Situação', icon: <Star size={14} /> },
    { num: '1', label: '1. Dados Civis', icon: <User size={14} /> },
    { num: '2', label: '2. Contatos', icon: <MapPin size={14} /> },
    { num: '3', label: '3. Dados Religiosos', icon: <BookOpen size={14} /> },
    { num: '4', label: '4. Itinerário Formativo', icon: <Activity size={14} /> },
    { num: '5', label: '5. Formação Acadêmica', icon: <GraduationCap size={14} /> },
    { num: '6', label: '6. Atividade Missionária', icon: <MapPin size={14} /> },
    { num: '7', label: '7. Saúde', icon: <Activity size={14} /> },
    { num: '8', label: '8. Previdenciário / IR', icon: <ShieldCheck size={14} /> },
    { num: '9', label: '9. Contas Bancárias', icon: <DollarSign size={14} /> },
    { num: '10', label: '10. Obras Realizadas', icon: <Star size={14} /> },
    { num: '11', label: '11. Observações', icon: <FileText size={14} /> },
    { num: '12', label: '12. Curriculum Vitae', icon: <Users size={14} /> },
    { num: 'PM', label: 'Presença Missionária', icon: <HomeIcon size={14} /> },
    { num: 'AP', label: 'Acesso & Permissões', icon: <Lock size={14} /> },
  ];

  // Step 0 — Situation Files
  const [certidaoObitoFile, setCertidaoObitoFile] = useState<File | null>(null);
  const [egressoIncardinadoFile, setEgressoIncardinadoFile] = useState<File | null>(null);
  const [egressoDesistenciaFile, setEgressoDesistenciaFile] = useState<File | null>(null);
  const [egressoLaicizadoFile, setEgressoLaicizadoFile] = useState<File | null>(null);
  const [egressoTransfSacerdotesFile, setEgressoTransfSacerdotesFile] = useState<File | null>(null);
  const [egressoTransfParaRegiaoFile, setEgressoTransfParaRegiaoFile] = useState<File | null>(null);
  const [egressoTransfDaRegiaoFile, setEgressoTransfDaRegiaoFile] = useState<File | null>(null);
  const [exclaustradoDocFile, setExclaustradoDocFile] = useState<File | null>(null);

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
  const [novaCasa, setNovaCasa] = useState<CasaVinculo>({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });

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
      setError(err?.response?.data?.message || err.message || 'Erro ao carregar missionários');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCasas = async () => {
    try {
      const res = await api.get('/casas');
      setCasasDisponiveis(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Erro ao carregar casas:', err);
    }
  };

  const openWizard = () => {
    setWizardData(initialWizard);
    setCertidaoObitoFile(null);
    setEgressoIncardinadoFile(null);
    setEgressoDesistenciaFile(null);
    setEgressoLaicizadoFile(null);
    setEgressoTransfSacerdotesFile(null);
    setEgressoTransfParaRegiaoFile(null);
    setEgressoTransfDaRegiaoFile(null);
    setExclaustradoDocFile(null);

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
    setNovaCasa({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
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
      alert(t('missionaries.wizard.docs.hint'));
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
    if (!novaCasa.casa_id) { alert('Selecione uma casa'); return; }
    if (!novaCasa.data_inicio) { alert('Informe a data de início'); return; }
    setCasasVinculos(prev => [...prev, { ...novaCasa }]);
    setNovaCasa({ casa_id: '', data_inicio: '', is_superior: false, funcao: [], tipo: '', pm: '', pais: 'Brasil' });
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
      alert('Informe o nome do missionário.');
      return;
    }

    const isFalecido = wizardData.situacao === 'Falecido';

    if (!isFalecido && !wizardData.login.trim()) {
      alert('Informe o e-mail de login.');
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
      await api.post(`/usuarios/${newId}/situacao`, {
        data_falecimento: wizardData.data_falecimento || null,
        cidade_falecimento: wizardData.cidade_falecimento || null,
        local_sepultamento: wizardData.local_sepultamento || null,
        exclaustrado_data: wizardData.exclaustrado_data || null,
        exclaustrado_processo: wizardData.exclaustrado_processo || null,
      });

      const uploadSituacaoFile = async (campo: string, file: File) => {
        const fd = new FormData();
        fd.append('arquivo', file);
        fd.append('campo', campo);
        await api.post(`/usuarios/${newId}/situacao/upload-doc`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      };

      if (certidaoObitoFile) await uploadSituacaoFile('certidao_obito_path', certidaoObitoFile);
      if (egressoIncardinadoFile) await uploadSituacaoFile('egresso_incardinado_path', egressoIncardinadoFile);
      if (egressoDesistenciaFile) await uploadSituacaoFile('egresso_desistencia_path', egressoDesistenciaFile);
      if (egressoLaicizadoFile) await uploadSituacaoFile('egresso_laicizado_path', egressoLaicizadoFile);
      if (egressoTransfSacerdotesFile) await uploadSituacaoFile('egresso_transf_sacerdotes_path', egressoTransfSacerdotesFile);
      if (egressoTransfParaRegiaoFile) await uploadSituacaoFile('egresso_transf_para_regiao_path', egressoTransfParaRegiaoFile);
      if (egressoTransfDaRegiaoFile) await uploadSituacaoFile('egresso_transf_da_regiao_path', egressoTransfDaRegiaoFile);
      if (exclaustradoDocFile) await uploadSituacaoFile('exclaustrado_doc_path', exclaustradoDocFile);

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
          data_fim: null,
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
        stageDocs[idoc.stage] = upRes.data.url || upRes.data.arquivo_path;
      }

      const finalItinerario = wizardData.itinerario.map(stage => {
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

      // 10 — Formação Acadêmica
      if (wizardData.formacao_curso || wizardData.formacao_instituicao) {
        await api.post(`/usuarios/${newId}/formacao-academica`, {
          curso: wizardData.formacao_curso,
          faculdade: wizardData.formacao_instituicao,
          periodo: wizardData.formacao_periodo,
          observacoes: wizardData.formacao_observacoes
        });
      }

      // 11 — Atividade Missionária
      if (wizardData.atividade_lugar || (wizardData.atividade_funcoes && wizardData.atividade_funcoes.length > 0)) {
        let funs = [...(wizardData.atividade_funcoes || [])];
        if (funs.includes('Outros') && wizardData.atividade_funcoes_outros?.trim()) {
          funs = funs.map(f => f === 'Outros' ? `Outros: ${wizardData.atividade_funcoes_outros.trim()}` : f);
        }
        await api.post(`/usuarios/${newId}/atividade-missionaria`, {
          lugar: wizardData.atividade_lugar,
          periodo: wizardData.atividade_periodo,
          missao: wizardData.atividade_missao,
          funcao_atividade: funs.join(', ')
        });
      }

      // 12 — Saúde
      if (wizardData.saude_sus || wizardData.saude_seguradora || wizardData.saude_carteira) {
        await api.post(`/usuarios/${newId}/saude`, {
          sus_card: wizardData.saude_sus,
          seguradora: wizardData.saude_seguradora,
          numero_carteira: wizardData.saude_carteira
        });
      }

      // 13 — Contas Bancárias
      if (wizardData.banco_numero || wizardData.banco_agencia) {
        await api.post(`/usuarios/${newId}/contas-bancarias`, {
          tipo_confirmacao: wizardData.banco_tipo,
          tipo_conta: wizardData.banco_tipo,
          titularidade: wizardData.banco_titular,
          agencia: wizardData.banco_agencia,
          numero: wizardData.banco_numero
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

      // 16 — Quadro de Pessoal CV
      if (wizardData.quadro_funcao_atual || wizardData.quadro_competencias) {
        await api.post(`/usuarios/${newId}/quadro-pessoal`, {
          funcao_atual: wizardData.quadro_funcao_atual,
          competencias: wizardData.quadro_competencias
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

      if (formacaoDocFile) {
        const fd = new FormData();
        fd.append('arquivo', formacaoDocFile);
        fd.append('descricao', 'Comprovante de Formação');
        await api.post(`/usuarios/${newId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (saudeDocFile) {
        const fd = new FormData();
        fd.append('arquivo', saudeDocFile);
        fd.append('descricao', 'Documento de Saúde');
        await api.post(`/usuarios/${newId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      if (quadroCvFile) {
        const fd = new FormData();
        fd.append('arquivo', quadroCvFile);
        fd.append('descricao', 'CV - Quadro de Pessoal');
        await api.post(`/usuarios/${newId}/documentos`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      await fetchMissionarios();
      setIsWizardOpen(false);
      alert(`${wizardData.nome} cadastrado com sucesso!`);
    } catch (err: any) {
      alert('Erro: ' + (err?.response?.data?.message || err.message));
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
            <h2 style={{ margin: 0 }}>Visão Geral do Cadastro de missionários</h2>
          </div>
        </div>
        {canEdit && <button className="btn-new" onClick={openWizard}><Plus size={18} /> Cadastro</button>}
      </div>

      <div className="filters-card" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
        <div className="filter-group">
          <label>NOME</label>
          <div className="search-input">
            <input type="text" placeholder="Buscar por nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>PRESENÇA MISSIONÁRIA</label>
          <div className="search-input">
            <input type="text" placeholder="Filtrar por casa..." value={casaFilter} onChange={e => setCasaFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>CIDADE</label>
          <div className="search-input">
            <input type="text" placeholder="Filtrar por cidade..." value={cidadeFilter} onChange={e => setCidadeFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>PAÍS</label>
          <div className="search-input">
            <input type="text" placeholder="Filtrar por país..." value={paisFilter} onChange={e => setPaisFilter(e.target.value)} />
            <Search size={18} />
          </div>
        </div>
        <div className="filter-group">
          <label>SITUAÇÃO</label>
          <select value={situacaoFilter} onChange={e => setSituacaoFilter(e.target.value)}>
            <option value="">{t('missionaries.filters.all')}</option>
            <option value="ATIVO">{t('missionaries.situations.ativo', 'Ativo')}</option>
            <option value="FALECIDO">{t('missionaries.situations.falecido', 'Falecido')}</option>
            <option value="EGRESSO">{t('missionaries.situations.egresso', 'Egresso')}</option>
            <option value="EXCLAUSTRADO">{t('missionaries.situations.exclaustrado', 'Exclaustrado')}</option>
          </select>
        </div>
        <button className="btn-filter" style={{ gridColumn: 'span 1', width: '100%', height: '42px', marginTop: '0' }}><Filter size={18} /> {t('missionaries.filters.filter_btn')}</button>
      </div>

      {isLoading ? (
        <div className="loading-state"><Loader2 className="animate-spin" size={32} /><p>{t('missionaries.loading')}</p></div>
      ) : error ? (
        <div className="error-state"><AlertCircle size={32} /><p>{error}</p><button onClick={fetchMissionarios} className="btn-retry">{t('common.retry')}</button></div>
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
                    <button className="btn-action-lite" title={t('missionaries.table.view_details')} onClick={() => navigate(`/missionarios/${m.id}`)}>
                      <Eye size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>{t('missionaries.empty')}</td></tr>
              )}
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
                  <span style={{ fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7a8caa' }}>Missionário em cadastro</span>
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
                  <div className="wizard-divider">0. Situação do Missionário</div>
                  
                  <div className="form-group full" style={{ marginBottom: '14px' }}>
                    <label>Situação do Missionário *</label>
                    <select value={wizardData.situacao} onChange={e => set('situacao', e.target.value)}>
                      <option value="Ativo">Ativo</option>
                      <option value="Egresso">Egresso</option>
                      <option value="Falecido">Falecido</option>
                      <option value="Exclaustrado">Exclaustrado</option>
                    </select>
                  </div>

                  {/* ── FALECIDO (Registro do Óbito) ── */}
                  {wizardData.situacao === 'Falecido' && (
                    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#334155', fontSize: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '8px' }}>
                        🕊️ Informações de Falecimento (Registro do Óbito)
                      </h4>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>Data de Falecimento</label>
                          <input
                            type="date"
                            value={wizardData.data_falecimento}
                            onChange={e => set('data_falecimento', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Cidade de Falecimento</label>
                          <input
                            type="text"
                            value={wizardData.cidade_falecimento}
                            onChange={e => set('cidade_falecimento', e.target.value)}
                            placeholder="Cidade - UF / País"
                          />
                        </div>
                      </div>

                      <div className="form-group full" style={{ marginBottom: '14px' }}>
                        <label>Certidão de Óbito (PDF / JPEG)</label>
                        <div className="doc-add-row" style={{ alignItems: 'center' }}>
                          <input
                            type="file"
                            id="certidao-obito-file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={e => setCertidaoObitoFile(e.target.files?.[0] || null)}
                          />
                          <button
                            type="button"
                            className="btn-add-doc"
                            onClick={() => document.getElementById('certidao-obito-file')?.click()}
                          >
                            <Upload size={15} /> {certidaoObitoFile ? 'Substituir Certidão' : 'Anexar Certidão de Óbito'}
                          </button>
                          <span style={{ fontSize: '0.85rem', color: certidaoObitoFile ? '#166534' : '#64748b', fontWeight: certidaoObitoFile ? 600 : 400 }}>
                            {certidaoObitoFile ? `Arquivo: ${certidaoObitoFile.name}` : 'Nenhum arquivo anexado'}
                          </span>
                          {certidaoObitoFile && (
                            <button
                              type="button"
                              onClick={() => setCertidaoObitoFile(null)}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="form-group full">
                        <label>Local de Sepultamento</label>
                        <input
                          type="text"
                          value={wizardData.local_sepultamento}
                          onChange={e => set('local_sepultamento', e.target.value)}
                          placeholder="Cemitério, Jazigo, Cidade..."
                        />
                      </div>
                    </div>
                  )}

                  {/* ── EGRESSO ── */}
                  {wizardData.situacao === 'Egresso' && (
                    <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '12px', padding: '20px', marginBottom: '10px' }}>
                      <h4 style={{ margin: '0 0 16px 0', color: '#854d0e', fontSize: '1rem', borderBottom: '2px solid #fde047', paddingBottom: '8px' }}>
                        📋 Documentos e Informações de Egresso
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {[
                          { label: '1. Incardinados (Documento PDF / JPEG)', file: egressoIncardinadoFile, setFile: setEgressoIncardinadoFile, id: 'egr-inc' },
                          { label: '2. Desistência ou em outro instituto (Documento PDF / JPEG)', file: egressoDesistenciaFile, setFile: setEgressoDesistenciaFile, id: 'egr-des' },
                          { label: '3. Laicizados (Documento PDF / JPEG)', file: egressoLaicizadoFile, setFile: setEgressoLaicizadoFile, id: 'egr-lai' },
                          { label: '4. Sacerdotes e Religiosos Transferidos (Documento PDF / JPEG)', file: egressoTransfSacerdotesFile, setFile: setEgressoTransfSacerdotesFile, id: 'egr-transf' },
                          { label: '4.1 Para a Região (Documento PDF / JPEG)', file: egressoTransfParaRegiaoFile, setFile: setEgressoTransfParaRegiaoFile, id: 'egr-reg' },
                          { label: '4.2 Da Região para outras Províncias / Região (Documento PDF / JPEG)', file: egressoTransfDaRegiaoFile, setFile: setEgressoTransfDaRegiaoFile, id: 'egr-prov' },
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
                                <Upload size={14} /> {item.file ? 'Substituir Documento' : 'Anexar Documento'}
                              </button>
                              <span style={{ fontSize: '0.8rem', color: item.file ? '#166534' : '#64748b' }}>
                                {item.file ? item.file.name : 'Nenhum documento anexado'}
                              </span>
                              {item.file && (
                                <button
                                  type="button"
                                  onClick={() => item.setFile(null)}
                                  style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', padding: '3px 6px', cursor: 'pointer', fontSize: '0.75rem' }}
                                >
                                  Remover
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
                        📜 Informações de Exclaustração
                      </h4>
                      <div className="form-row-2" style={{ marginBottom: '14px' }}>
                        <div className="form-group">
                          <label>Data de Exclaustração</label>
                          <input
                            type="date"
                            value={wizardData.exclaustrado_data}
                            onChange={e => set('exclaustrado_data', e.target.value)}
                          />
                        </div>
                        <div className="form-group">
                          <label>Processo / Decreto</label>
                          <input
                            type="text"
                            value={wizardData.exclaustrado_processo}
                            onChange={e => set('exclaustrado_processo', e.target.value)}
                            placeholder="Número do processo ou decreto..."
                          />
                        </div>
                      </div>

                      <div className="form-group full">
                        <label>Documento (PDF / JPEG)</label>
                        <div className="doc-add-row" style={{ alignItems: 'center' }}>
                          <input
                            type="file"
                            id="exclaustrado-doc-file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            style={{ display: 'none' }}
                            onChange={e => setExclaustradoDocFile(e.target.files?.[0] || null)}
                          />
                          <button
                            type="button"
                            className="btn-add-doc"
                            onClick={() => document.getElementById('exclaustrado-doc-file')?.click()}
                          >
                            <Upload size={15} /> {exclaustradoDocFile ? 'Substituir Documento' : 'Anexar Documento'}
                          </button>
                          <span style={{ fontSize: '0.85rem', color: exclaustradoDocFile ? '#166534' : '#64748b' }}>
                            {exclaustradoDocFile ? exclaustradoDocFile.name : 'Nenhum documento anexado'}
                          </span>
                          {exclaustradoDocFile && (
                            <button
                              type="button"
                              onClick={() => setExclaustradoDocFile(null)}
                              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.8rem' }}
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 1 — 1. DADOS CIVIS ══ */}
              {wizardStep === 1 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">1. Dados Civis</div>
                  
                  <div className="form-group full">
                    <label>{t('missionaries.wizard.civil.full_name')} *</label>
                    <input
                      type="text"
                      value={wizardData.nome}
                      onChange={e => set('nome', e.target.value)}
                      placeholder="Nome completo..."
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
                        placeholder="Nome do pai..."
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('profile.labels.mother_name', 'Nome da Mãe')}</label>
                      <input
                        type="text"
                        value={wizardData.nome_mae}
                        onChange={e => set('nome_mae', e.target.value.replace(/[0-9]/g, ''))}
                        placeholder="Nome da mãe..."
                      />
                    </div>
                  </div>

                  <div className="form-row-3">
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.birth_place_city')}</label>
                      <input
                        type="text"
                        value={wizardData.cidade_estado}
                        onChange={e => set('cidade_estado', e.target.value)}
                        placeholder="Ex: São Paulo, SP"
                      />
                    </div>
                    <div className="form-group">
                      <label>{t('missionaries.wizard.civil.country')}</label>
                      <input
                        type="text"
                        list="paises-list"
                        value={wizardData.pais}
                        onChange={e => set('pais', e.target.value)}
                        placeholder="Ex: Brasil"
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
                        onChange={e => set('diocese', e.target.value)}
                        placeholder="Ex: Diocese de São Paulo"
                      />
                    </div>
                  </div>

                  {/* Documentos de Identificação Civil */}
                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Documentos Civis</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>RG / RNM / CI / DI</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={wizardData.rnm}
                        onChange={e => set('rnm', e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="000000000"
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
                      <label>Título Eleitor</label>
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
                      <label>Passaporte</label>
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
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', alignItems: 'start' }}>
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
                          placeholder="Nacionalidade..."
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
                  <div className="wizard-divider" style={{ marginTop: '16px' }}>{t('missionaries.wizard.docs.title', 'Documentos & Anexos')}</div>
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
                      title="Selecionar arquivo (PDF, JPG, PNG)"
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
                  <div className="wizard-divider">2. Contatos</div>

                  <div className="wizard-divider" style={{ marginTop: '6px' }}>Endereço Principal</div>
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
                      <input type="text" value={wizardData.bairro} onChange={e => set('bairro', e.target.value)} placeholder="Bairro..." />
                    </div>
                  </div>

                  <div className="form-group full">
                    <label>{t('missionaries.wizard.address.street')}</label>
                    <input type="text" value={wizardData.logradouro} onChange={e => set('logradouro', e.target.value)} placeholder="Rua, Av., número..." />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group"><label>{t('missionaries.wizard.address.complement')}</label><input type="text" value={wizardData.complemento} onChange={e => set('complemento', e.target.value)} placeholder="Apto, Bloco..." /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.city_state')}</label><input type="text" value={wizardData.endereco_cidade_estado} onChange={e => set('endereco_cidade_estado', e.target.value)} placeholder="Cidade - UF" /></div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Contatos do Missionário</div>
                  <div className="form-row-3">
                    <div className="form-group"><label>{t('missionaries.wizard.address.cellphone')}</label><input type="text" value={wizardData.celular_whatsapp} onChange={e => set('celular_whatsapp', e.target.value)} placeholder="(00) 90000-0000" /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.phone')}</label><input type="text" value={wizardData.telefone_fixo} onChange={e => set('telefone_fixo', e.target.value)} placeholder="(00) 0000-0000" /></div>
                    <div className="form-group"><label>{t('missionaries.wizard.address.personal_email')}</label><input type="email" value={wizardData.email_pessoal} onChange={e => set('email_pessoal', e.target.value)} placeholder="email@pessoal.com" /></div>
                  </div>

                  {/* Contatos de Familiares / Parentes */}
                  <div className="wizard-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                    <span>Contatos de Familiares / Parentes</span>
                    {wizardData.contatos.length < 3 && (
                      <button
                        type="button"
                        className="btn-add-doc"
                        style={{ padding: '2px 8px', fontSize: '10px' }}
                        onClick={() => set('contatos', [...wizardData.contatos, { parentesco: '', nome: '', endereco: '', telefone: '', email: '' }])}
                      >
                        <Plus size={12} /> Adicionar Contato
                      </button>
                    )}
                  </div>

                  {wizardData.contatos.length === 0 ? (
                    <p style={{ opacity: 0.6, fontSize: '0.85rem', fontStyle: 'italic', margin: '4px 0' }}>
                      Nenhum contato familiar adicionado. Clique no botão acima para adicionar até 3 contatos.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                      {wizardData.contatos.map((contato, idx) => (
                        <div key={idx} style={{ padding: '14px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', position: 'relative' }}>
                          <button
                            type="button"
                            onClick={() => set('contatos', wizardData.contatos.filter((_, i) => i !== idx))}
                            style={{ position: 'absolute', top: '10px', right: '10px', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 6px', cursor: 'pointer' }}
                            title="Remover Contato"
                          >
                            <Trash2 size={14} />
                          </button>

                          <div className="form-row-3" style={{ marginBottom: '10px' }}>
                            <div className="form-group">
                              <label>Parentesco</label>
                              <select
                                value={['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) || contato.parentesco === '' ? contato.parentesco : 'Outros'}
                                onChange={e => {
                                  const val = e.target.value;
                                  const newC = [...wizardData.contatos];
                                  newC[idx].parentesco = val === 'Outros' ? 'Outros' : val;
                                  set('contatos', newC);
                                }}
                              >
                                <option value="">Selecione...</option>
                                <option value="Pai">Pai</option>
                                <option value="Mãe">Mãe</option>
                                <option value="Irmão(a)">Irmão(a)</option>
                                <option value="Outros">Outros</option>
                              </select>
                              {((!['Pai', 'Mãe', 'Irmão(a)'].includes(contato.parentesco) && contato.parentesco !== '') || contato.parentesco === 'Outros') && (
                                <input
                                  type="text"
                                  placeholder="Qual parentesco?"
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
                              <label>Nome</label>
                              <input
                                type="text"
                                placeholder="Nome completo..."
                                value={contato.nome}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].nome = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label>Telefone</label>
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
                              <label>Endereço</label>
                              <input
                                type="text"
                                placeholder="Endereço..."
                                value={contato.endereco}
                                onChange={e => {
                                  const newC = [...wizardData.contatos];
                                  newC[idx].endereco = e.target.value;
                                  set('contatos', newC);
                                }}
                              />
                            </div>
                            <div className="form-group">
                              <label>E-mail</label>
                              <input
                                type="email"
                                placeholder="email@familiar.com"
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
                  <div className="wizard-divider">3. Dados Religiosos</div>

                  <div className="wizard-divider" style={{ marginTop: '4px' }}>Sacramentos</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Batismo (Data)</label>
                      <input type="date" value={wizardData.data_batismo} onChange={e => set('data_batismo', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Primeira Comunhão (Data)</label>
                      <input type="date" value={wizardData.data_primeira_comunhao} onChange={e => set('data_primeira_comunhao', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Crisma (Data)</label>
                      <input type="date" value={wizardData.data_crisma} onChange={e => set('data_crisma', e.target.value)} />
                    </div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Consagração e Votos</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Primeiros Votos (Data)</label>
                      <input type="date" value={wizardData.primeiros_votos_data} onChange={e => set('primeiros_votos_data', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Votos Perpétuos (Data)</label>
                      <input type="date" value={wizardData.votos_perpetuos_data} onChange={e => set('votos_perpetuos_data', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>Lugar de Profissão</label>
                    <input type="text" value={wizardData.lugar_profissao} onChange={e => set('lugar_profissao', e.target.value)} placeholder="Lugar de profissão..." />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Ordenação</div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Diaconato (Data)</label>
                      <input type="date" value={wizardData.diaconato_data} onChange={e => set('diaconato_data', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Presbiterato (Data)</label>
                      <input type="date" value={wizardData.presbiterato_data} onChange={e => set('presbiterato_data', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>Bispo Ordenante</label>
                    <input type="text" value={wizardData.bispo_ordenante} onChange={e => set('bispo_ordenante', e.target.value)} placeholder="Nome do Bispo ordenante..." />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Funções Administrativas</div>
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

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Anexar Certidões</div>
                  <div className="form-row-3">
                    <div className="form-group">
                      <label>Certidão de Batismo</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setBatismoDocFile(e.target.files?.[0] || null)} />
                      {batismoDocFile && <span className="file-selected" style={{ fontSize: '0.8rem', color: '#166534' }}>{batismoDocFile.name}</span>}
                    </div>
                    <div className="form-group">
                      <label>Certidão 1ª Comunhão</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setComunhaoDocFile(e.target.files?.[0] || null)} />
                      {comunhaoDocFile && <span className="file-selected" style={{ fontSize: '0.8rem', color: '#166534' }}>{comunhaoDocFile.name}</span>}
                    </div>
                    <div className="form-group">
                      <label>Certidão de Crisma</label>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCrismaDocFile(e.target.files?.[0] || null)} />
                      {crismaDocFile && <span className="file-selected" style={{ fontSize: '0.8rem', color: '#166534' }}>{crismaDocFile.name}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* ══ STEP 4 — 4. ITINERÁRIO FORMATIVO ══ */}
              {wizardStep === 4 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">4. Itinerário Formativo</div>
                  <p className="wizard-hint">Preencha os dados das etapas de formação do missionário.</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    {[
                      { title: '4.1 Seminário' },
                      { label: '4.1.1 Seminário Menor', etapa: '4.1.1' },
                      { label: '4.1.2 Propedêutico', etapa: '4.1.2' },
                      { label: '4.1.3 Filosofia', etapa: '4.1.3' },
                      { label: '4.1.4 Postulado', etapa: '4.1.4' },
                      { label: '4.1.5 Noviciado', etapa: '4.1.5' },
                      { label: '4.1.6 Teologia', etapa: '4.1.6' },
                      { label: '4.1.7 Tirocínio', etapa: '4.1.7' },
                      { title: '4.2.1 Primeira Profissão' },
                      { label: '4.2.1.1 Relatório do Mestre', etapa: '4.2.1.1' },
                      { label: '4.2.1.2 Pedido do noviço', etapa: '4.2.1.2' },
                      { label: '4.2.1.3 Declaração de cessão da administração de bens', etapa: '4.2.1.3' },
                      { label: '4.2.1.4 Admissão', etapa: '4.2.1.4' },
                      { label: '4.2.1.5 Fórmula manuscrita', etapa: '4.2.1.5' },
                      { label: '4.2.1.6 Delegação para receber os votos', etapa: '4.2.1.6' },
                      { title: '4.2.2 Renovação dos Votos' },
                      { label: '4.2.2.1 Relatório do Formador', etapa: '4.2.2.1' },
                      { label: '4.2.2.2 Pedido do religioso', etapa: '4.2.2.2' },
                      { label: '4.2.2.3 Admissão Fórmula manuscrita', etapa: '4.2.2.3' },
                      { label: '4.2.2.4 Delegação para receber os votos', etapa: '4.2.2.4' },
                      { title: '4.2.3 Profissão Perpétua' },
                      { label: '4.2.3.1 Relatório do Formador', etapa: '4.2.3.1' },
                      { label: '4.2.3.2 Pedido do religioso', etapa: '4.2.3.2' },
                      { label: '4.2.3.3 Declaração de nada exigir', etapa: '4.2.3.3' },
                      { label: '4.2.3.4 Testamento particular', etapa: '4.2.3.4' },
                      { label: '4.2.3.5 Declaração Nada Obsta', etapa: '4.2.3.5' },
                      { label: '4.2.3.6 Admissão', etapa: '4.2.3.6' },
                      { label: '4.2.3.7 Fórmula manuscrita', etapa: '4.2.3.7' },
                      { label: '4.2.3.8 Delegação para receber os votos', etapa: '4.2.3.8' },
                      { label: '4.2.3.9 Notificação à paróquia de batismo', etapa: '4.2.3.9' },
                      { title: '4.3.1 Leitorado' },
                      { label: '4.3.1.1 Apresentação', etapa: '4.3.1.1' },
                      { label: '4.3.1.2 Pedido', etapa: '4.3.1.2' },
                      { label: '4.3.1.3 Admissão', etapa: '4.3.1.3' },
                      { label: '4.3.1.4 Certificado', etapa: '4.3.1.4' },
                      { title: '4.3.2 Acolitado' },
                      { label: '4.3.2.1 Apresentação', etapa: '4.3.2.1' },
                      { label: '4.3.2.2 Pedido', etapa: '4.3.2.2' },
                      { label: '4.3.2.3 Admissão', etapa: '4.3.2.3' },
                      { label: '4.3.2.4 Certificado', etapa: '4.3.2.4' },
                      { title: '4.3.3 Diaconato' },
                      { label: '4.3.3.1 Relatório do Formador', etapa: '4.3.3.1' },
                      { label: '4.3.3.2 Pedido do religioso', etapa: '4.3.3.2' },
                      { label: '4.3.3.3 Declaração dos estudos teológicos', etapa: '4.3.3.3' },
                      { label: '4.3.3.4 Declaração Nada Obsta', etapa: '4.3.3.4' },
                      { label: '4.3.3.5 Admissão', etapa: '4.3.3.5' },
                      { label: '4.3.3.6 Cartas dimissórias', etapa: '4.3.3.6' },
                      { label: '4.3.3.7 Ata de ordenação', etapa: '4.3.3.7' },
                      { label: '4.3.3.8 Notificação à paróquia de batismo', etapa: '4.3.3.8' },
                      { title: '4.3.4 Presbiterado' },
                      { label: '4.3.4.1 Relatório do Formador', etapa: '4.3.4.1' },
                      { label: '4.3.4.2 Pedido do diácono', etapa: '4.3.4.2' },
                      { label: '4.3.4.3 Declaração dos estudos teológicos', etapa: '4.3.4.3' },
                      { label: '4.3.4.4 Declaração Nada Obsta', etapa: '4.3.4.4' },
                      { label: '4.3.4.5 Admissão', etapa: '4.3.4.5' },
                      { label: '4.3.4.6 Cartas dimissórias', etapa: '4.3.4.6' },
                      { label: '4.3.4.7 Ata de ordenação', etapa: '4.3.4.7' },
                      { label: '4.3.4.8 Notificação à paróquia de batismo', etapa: '4.3.4.8' },
                      { title: '4.3.5 Primeira destinação missionária' },
                      { label: '4.3.5.1 Carta do religioso', etapa: '4.3.5.1' },
                      { label: '4.3.5.2 Relatório', etapa: '4.3.5.2' },
                      { label: '4.3.5.3 Parecer do Superior Regional', etapa: '4.3.5.3' },
                      { title: '4.4 Destinação dada pela Direção' },
                      { label: '4.4 Destinação dada pela Direção', etapa: '4.4' },
                    ].map((seg, idx) => {
                      if (seg.title) {
                        return (
                          <div key={idx} style={{ gridColumn: '1 / -1', color: '#013375', fontWeight: 700, marginTop: '16px', borderBottom: '2px solid #e2e8f0', paddingBottom: '4px', fontSize: '0.9rem' }}>
                            {seg.title}
                          </div>
                        );
                      }
                      const stage = wizardData.itinerario.find(s => s.etapa === seg.etapa) || { etapa: (seg.etapa as string), is_sub_etapa: true, local: '', periodo: '', observacoes: '' };
                      const updateStage = (field: 'local' | 'periodo' | 'observacoes', val: string) => {
                        const newItin = [...wizardData.itinerario];
                        let ti = newItin.findIndex(s => s.etapa === seg.etapa);
                        if (ti > -1) {
                          newItin[ti] = { ...newItin[ti], [field]: val };
                        } else {
                          newItin.push({ ...stage, [field]: val });
                        }
                        set('itinerario', newItin);
                      };
                      const showObs = seg.etapa === '4.1.5' || seg.etapa === '4.1.7' || (seg.etapa && seg.etapa.startsWith('4.2'));
                      return (
                        <div key={idx} style={{ padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fafafa' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.78rem', color: '#013375', marginBottom: '6px' }}>{seg.label}</div>
                          <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                                <input type="text" value={stage.periodo} onChange={e => updateStage('periodo', e.target.value)} placeholder="Período (ex: 1990-1994)" style={{ fontSize: '0.78rem' }} />
                              </div>
                              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                                <input type="text" value={stage.local} onChange={e => updateStage('local', e.target.value)} placeholder="Local / Instituição" style={{ fontSize: '0.78rem' }} />
                              </div>
                            </div>
                            {showObs && (
                              <div className="form-group" style={{ marginBottom: 0, width: '100%' }}>
                                <input type="text" value={stage.observacoes || ''} onChange={e => updateStage('observacoes', e.target.value)} placeholder="Observações" style={{ fontSize: '0.78rem', width: '100%' }} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '16px' }}>Documentos do Itinerário (opcional)</div>
                  <div className="form-row-2" style={{ alignItems: 'flex-end', gap: '10px' }}>
                    <div className="form-group" style={{ flex: 1 }}>
                      <label>Selecione a Etapa</label>
                      <select
                        value={itinSelectedStage}
                        onChange={e => setItinSelectedStage(e.target.value)}
                        style={{ width: '100%' }}
                      >
                        <option value="">-- Escolha uma etapa --</option>
                        {ITIN_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
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
                        <Plus size={16} /> Anexar Arquivo
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
                      <p style={{ fontSize: '12px', fontWeight: 700, marginBottom: '8px', color: '#666' }}>Arquivos Selecionados:</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {itineraryDocs.map((d, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '6px 10px', borderRadius: '6px', border: '1px solid #eee' }}>
                            <div style={{ fontSize: '13px' }}>
                              <strong style={{ color: 'var(--primary)' }}>{d.stage}:</strong> <span style={{ color: '#666' }}>{d.file.name}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => setItineraryDocs(prev => prev.filter((_, i) => i !== idx))}
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
                  <div className="wizard-divider">5. Formação Acadêmica</div>
                  <div className="form-group full">
                    <label>Curso / Graduação</label>
                    <input type="text" value={wizardData.formacao_curso} onChange={e => set('formacao_curso', e.target.value)} placeholder="Ex: Teologia, Filosofia, Administração..." />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Instituição / Faculdade</label>
                      <input type="text" value={wizardData.formacao_instituicao} onChange={e => set('formacao_instituicao', e.target.value)} placeholder="Ex: PUC, Unicamp..." />
                    </div>
                    <div className="form-group">
                      <label>Período</label>
                      <input type="text" value={wizardData.formacao_periodo} onChange={e => set('formacao_periodo', e.target.value)} placeholder="Ex: 2018-2022" />
                    </div>
                  </div>
                  <div className="form-group full">
                    <label>Observações</label>
                    <input type="text" value={wizardData.formacao_observacoes} onChange={e => set('formacao_observacoes', e.target.value)} placeholder="Observações..." />
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Documento Comprobatório / Diploma (opcional)</div>
                  <div className="doc-add-row" style={{ alignItems: 'center' }}>
                    <button type="button" className="btn-add-doc" onClick={() => formacaoFileRef.current?.click()}>
                      <Plus size={16} /> {formacaoDocFile ? 'Substituir Documento' : 'Anexar PDF / Imagem'}
                    </button>
                    <span style={{ fontSize: '13px', color: formacaoDocFile ? '#166534' : '#666' }}>
                      {formacaoDocFile ? formacaoDocFile.name : 'Nenhum arquivo selecionado'}
                    </span>
                    <input
                      ref={formacaoFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => setFormacaoDocFile(e.target.files?.[0] || null)}
                    />
                    {formacaoDocFile && (
                      <button type="button" onClick={() => setFormacaoDocFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title="Remover">✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 6 — 6. ATIVIDADE MISSIONÁRIA ══ */}
              {wizardStep === 6 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">6. Atividade Missionária</div>
                  <div className="form-group full">
                    <label>Lugar / Instituição / Paróquia</label>
                    <input type="text" value={wizardData.atividade_lugar} onChange={e => set('atividade_lugar', e.target.value)} placeholder="Ex: Casa do Migrante de Passo Fundo" />
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Período</label>
                      <input type="text" value={wizardData.atividade_periodo} onChange={e => set('atividade_periodo', e.target.value)} placeholder="Ex: 2000 a 2002" />
                    </div>
                    <div className="form-group">
                      <label>Missão / Descrição</label>
                      <input type="text" value={wizardData.atividade_missao} onChange={e => set('atividade_missao', e.target.value)} placeholder="Descrição breve das atividades..." />
                    </div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Função da Atividade</div>
                  <p style={{ fontSize: '0.78rem', color: '#666', marginBottom: '8px' }}>
                    Selecione uma ou mais funções exercidas nesta atividade missionária:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
                    {[
                      { key: 'Superior Local', label: 'Superior Local' },
                      { key: 'Pároco', label: 'Pároco' },
                      { key: 'Diretor', label: 'Diretor (rádios, escolas, fundações, escritórios)' },
                      { key: 'Ecônomo Local', label: 'Ecônomo Local' },
                      { key: 'Vigário', label: 'Vigário' },
                      { key: 'Reitor', label: 'Reitor (seminários)' },
                      { key: 'Outros', label: 'Outros' },
                    ].map(r => (
                      <label key={r.key} className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={Array.isArray(wizardData.atividade_funcoes) && wizardData.atividade_funcoes.includes(r.key)}
                          onChange={e => {
                            const current = Array.isArray(wizardData.atividade_funcoes) ? [...wizardData.atividade_funcoes] : [];
                            if (e.target.checked) {
                              if (!current.includes(r.key)) current.push(r.key);
                            } else {
                              const idx = current.indexOf(r.key);
                              if (idx >= 0) current.splice(idx, 1);
                            }
                            set('atividade_funcoes', current);
                          }}
                        />
                        {r.label}
                      </label>
                    ))}
                  </div>

                  {Array.isArray(wizardData.atividade_funcoes) && wizardData.atividade_funcoes.includes('Outros') && (
                    <div className="form-group full" style={{ marginTop: '12px' }}>
                      <label>Especifique a Função ("Outros")</label>
                      <input
                        type="text"
                        value={wizardData.atividade_funcoes_outros}
                        onChange={e => set('atividade_funcoes_outros', e.target.value)}
                        placeholder="Digite a outra função exercida..."
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ══ STEP 7 — 7. SAÚDE ══ */}
              {wizardStep === 7 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">7. Saúde</div>
                  <div className="form-row-3">
                    <div className="form-group"><label>CNS (SUS)</label><input type="text" value={wizardData.saude_sus} onChange={e => set('saude_sus', e.target.value)} placeholder="Cartão SUS" /></div>
                    <div className="form-group"><label>Seguradora</label><input type="text" value={wizardData.saude_seguradora} onChange={e => set('saude_seguradora', e.target.value)} placeholder="Seguradora" /></div>
                    <div className="form-group"><label>Nº Carteira</label><input type="text" value={wizardData.saude_carteira} onChange={e => set('saude_carteira', e.target.value)} placeholder="Número da carteira" /></div>
                  </div>

                  <div className="wizard-divider" style={{ marginTop: '14px' }}>Documento de Saúde (opcional)</div>
                  <div className="doc-add-row" style={{ alignItems: 'center' }}>
                    <button type="button" className="btn-add-doc" onClick={() => saudeFileRef.current?.click()}>
                      <Plus size={16} /> {saudeDocFile ? 'Substituir Documento' : 'Anexar PDF / Imagem'}
                    </button>
                    <span style={{ fontSize: '13px', color: saudeDocFile ? '#166534' : '#666' }}>
                      {saudeDocFile ? saudeDocFile.name : 'Nenhum arquivo selecionado'}
                    </span>
                    <input
                      ref={saudeFileRef}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => setSaudeDocFile(e.target.files?.[0] || null)}
                    />
                    {saudeDocFile && (
                      <button type="button" onClick={() => setSaudeDocFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title="Remover">✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 8 — 8. PREVIDENCIÁRIO / IR ══ */}
              {wizardStep === 8 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">8. Previdenciário / IR</div>
                  <div className="form-group full" style={{ maxWidth: '400px' }}>
                    <label>NIT (Número de Identificação do Trabalhador)</label>
                    <input type="text" value={wizardData.nit} onChange={e => set('nit', e.target.value)} placeholder="000.00000.00-0" />
                  </div>
                </div>
              )}

              {/* ══ STEP 9 — 9. CONTAS BANCÁRIAS ══ */}
              {wizardStep === 9 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">9. Contas Bancárias</div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Tipo de Conta</label><input type="text" value={wizardData.banco_tipo} onChange={e => set('banco_tipo', e.target.value)} placeholder="Corrente, Poupança..." /></div>
                    <div className="form-group"><label>Titularidade</label><input type="text" value={wizardData.banco_titular} onChange={e => set('banco_titular', e.target.value)} placeholder="Titular da conta" /></div>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Agência</label><input type="text" value={wizardData.banco_agencia} onChange={e => set('banco_agencia', e.target.value)} placeholder="Agência" /></div>
                    <div className="form-group"><label>Número da Conta</label><input type="text" value={wizardData.banco_numero} onChange={e => set('banco_numero', e.target.value)} placeholder="Número da conta" /></div>
                  </div>
                </div>
              )}

              {/* ══ STEP 10 — 10. OBRAS REALIZADAS ══ */}
              {wizardStep === 10 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">10. Obras Realizadas</div>
                  <div className="form-row-2">
                    <div className="form-group"><label>Período</label><input type="text" value={wizardData.obra_periodo} onChange={e => set('obra_periodo', e.target.value)} placeholder="Ex: 2010-2015" /></div>
                    <div className="form-group"><label>Lugar</label><input type="text" value={wizardData.obra_lugar} onChange={e => set('obra_lugar', e.target.value)} placeholder="Local da obra/livro..." /></div>
                  </div>
                  <div className="form-group full">
                    <label>Descrição da Obra / Publicação</label>
                    <input type="text" value={wizardData.obra_descricao} onChange={e => set('obra_descricao', e.target.value)} placeholder="Título da publicação ou detalhes da obra..." />
                  </div>
                </div>
              )}

              {/* ══ STEP 11 — 11. OBSERVAÇÕES ══ */}
              {wizardStep === 11 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">11. Observações</div>
                  <div className="form-group full">
                    <label>Texto da Observação</label>
                    <textarea value={wizardData.obs_geral} onChange={e => set('obs_geral', e.target.value)} placeholder="Observações gerais do missionário..." style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '8px', minHeight: '100px' }} />
                  </div>
                </div>
              )}

              {/* ══ STEP 12 — 12. CURRICULUM VITAE ══ */}
              {wizardStep === 12 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">12. Curriculum Vitae</div>
                  <p className="wizard-hint">
                    Anexe o arquivo oficial do Curriculum Vitae do missionário (PDF, Imagens ou Documentos).
                  </p>
                  <div className="doc-add-row" style={{ alignItems: 'center', marginTop: '1rem' }}>
                    <button type="button" className="btn-add-doc" onClick={() => quadroFileRef.current?.click()}>
                      <Plus size={16} /> {quadroCvFile ? 'Substituir CV' : 'Anexar Currículo (CV)'}
                    </button>
                    <span style={{ fontSize: '13px', color: quadroCvFile ? '#166534' : '#666', fontWeight: quadroCvFile ? 600 : 400 }}>
                      {quadroCvFile ? `✓ ${quadroCvFile.name}` : 'Nenhum arquivo de CV selecionado'}
                    </span>
                    <input
                      ref={quadroFileRef}
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      style={{ display: 'none' }}
                      onChange={e => setQuadroCvFile(e.target.files?.[0] || null)}
                    />
                    {quadroCvFile && (
                      <button type="button" onClick={() => setQuadroCvFile(null)} style={{ background: 'none', border: 'none', color: '#e57373', cursor: 'pointer', fontSize: '18px' }} title="Remover">✕</button>
                    )}
                  </div>
                </div>
              )}

              {/* ══ STEP 13 — PRESENÇA MISSIONÁRIA ══ */}
              {wizardStep === 13 && (
                <div className="wizard-step-content">
                  <div className="wizard-divider">Presença Missionária</div>
                  <p className="wizard-hint">
                    Vincule o missionário a uma ou mais casas religiosas.
                  </p>

                  <div className="casa-wizard-add">
                    <div className="casa-wizard-add-fields">
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={novaCasa.tipo} onChange={e => setNovaCasa(p => ({ ...p, tipo: e.target.value }))}>
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
                        <label>Selecione a Casa</label>
                        <select value={novaCasa.casa_id} onChange={e => setNovaCasa(p => ({ ...p, casa_id: e.target.value }))}>
                          <option value="">Selecione...</option>
                          {(Array.isArray(casasDisponiveis) ? casasDisponiveis : []).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>PM</label>
                        <input type="text" value={novaCasa.pm} onChange={e => setNovaCasa(p => ({ ...p, pm: e.target.value }))} placeholder="Ex: CR 13" />
                      </div>
                      <div className="form-group">
                        <label>País</label>
                        <input type="text" list="paises-list" value={novaCasa.pais} onChange={e => setNovaCasa(p => ({ ...p, pais: e.target.value }))} placeholder="Selecione ou digite..." />
                      </div>
                      <div className="form-group">
                        <label>Data de Início</label>
                        <input type="date" value={novaCasa.data_inicio} onChange={e => setNovaCasa(p => ({ ...p, data_inicio: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
                      <button type="button" className="btn-add-casa-wz" onClick={addCasaVinculo}>
                        <Plus size={15} /> Vincular Casa
                      </button>
                    </div>
                  </div>

                  {!Array.isArray(casasVinculos) || casasVinculos.length === 0 ? (
                    <div className="casa-empty">Nenhuma casa vinculada ainda.</div>
                  ) : (
                    <div className="casas-wz-list">
                      {casasVinculos.map((v, i) => (
                        <div key={i} className="casa-wz-item">
                          <div className="casa-wz-left">
                            <HomeIcon size={18} className="casa-icon" />
                            <div>
                              <span className="casa-wz-nome">{casaNome(v.casa_id)}</span>
                              <div className="casa-wz-meta">
                                <span>Desde {formatDateLocal(v.data_inicio)}</span>
                                <span className="duracao-pill">⏱ {calcDuracao(v.data_inicio)}</span>
                                {v.pm && <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '4px' }}>PM: {v.pm}</div>}
                                {v.tipo && <div style={{ fontSize: '12px', color: '#475569', marginTop: '2px' }}>{v.tipo}</div>}
                              </div>
                            </div>
                          </div>
                          <button type="button" className="btn-remove-wz" onClick={() => removeCasaVinculo(i)}>
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
                  <div className="wizard-divider">Acesso & Permissões</div>

                  {wizardData.situacao === 'Falecido' ? (
                    <div style={{
                      background: 'linear-gradient(90deg, #f1f5f9, #f8fafc)',
                      border: '1px solid #cbd5e1',
                      borderRadius: '12px',
                      padding: '16px 20px',
                      marginBottom: '16px',
                    }}>
                      <h4 style={{ margin: '0 0 6px 0', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🕊️ Registro de Missionário Falecido
                      </h4>
                      <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b', lineHeight: 1.5 }}>
                        Para missionários com situação <strong>Falecido</strong>, as credenciais de login e as permissões de acesso ao sistema <strong>não são obrigatórias nem necessárias</strong>. O histórico completo de cadastro e o registro de óbito serão preservados para consultas institucionais.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p className="wizard-hint">
                        Configure os dados de login e permissões de acesso do missionário ao sistema.
                      </p>
                      <div className="form-group full">
                        <label>E-mail de Login *</label>
                        <input type="email" value={wizardData.login} onChange={e => set('login', e.target.value)} placeholder="padre@email.com" />
                      </div>
                      <div className="form-group full">
                        <label>Senha de Acesso <span style={{ color: '#94a3b8', fontWeight: 400 }}>(opcional)</span></label>
                        <div className="password-group">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={wizardData.password}
                            onChange={e => set('password', e.target.value)}
                            placeholder="Deixe em branco para usar a senha padrão"
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
                            Se nenhuma senha for digitada, o sistema usará a senha padrão{' '}
                            <strong style={{ color: '#1d4ed8', fontFamily: 'monospace', fontSize: '0.9rem' }}>Scalab@10</strong>.
                          </p>
                        </div>
                      </div>

                      <div className="form-group full">
                        <label>Status da Conta</label>
                        <select value={wizardData.status} onChange={e => set('status', e.target.value as 'ATIVO' | 'INATIVO')}>
                          <option value="ATIVO">Ativo - Acesso Liberado</option>
                          <option value="INATIVO">Inativo - Acesso Bloqueado</option>
                        </select>
                      </div>

                      <div className="form-group full">
                        <label>Acesso (Permissões)</label>
                        <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
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
                                <div style={{ textAlign: 'center', fontWeight: 600, color: '#475569' }}>{perm.label}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Summary */}
                  <div className="wizard-summary" style={{ marginTop: '16px' }}>
                    <h4>Resumo do Cadastro</h4>
                    <div className="summary-row"><span>Nome:</span><strong>{wizardData.nome || '—'}</strong></div>
                    <div className="summary-row"><span>Situação:</span><strong>{wizardData.situacao}</strong></div>
                    {wizardData.situacao !== 'Falecido' && (
                      <div className="summary-row"><span>E-mail de Login:</span><strong>{wizardData.login || '—'}</strong></div>
                    )}
                    {wizardData.situacao === 'Falecido' && wizardData.data_falecimento && (
                      <div className="summary-row"><span>Data do Óbito:</span><strong>{formatDateLocal(wizardData.data_falecimento)}</strong></div>
                    )}
                    <div className="summary-row"><span>Casas Vinculadas:</span><strong>{casasVinculos.length}</strong></div>
                    <div className="summary-row"><span>Documentos Anexados:</span><strong>{docs.length + (certidaoObitoFile ? 1 : 0) + (formacaoDocFile ? 1 : 0) + (saudeDocFile ? 1 : 0) + (quadroCvFile ? 1 : 0)}</strong></div>
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
                {wizardStep > 0 ? <><ChevronLeft size={18} /> Voltar</> : 'Cancelar'}
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
                      alert('Informe o nome completo.');
                      return;
                    }
                    setWizardStep(s => s + 1);
                  }}
                >
                  Próximo <ChevronRight size={16} />
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
