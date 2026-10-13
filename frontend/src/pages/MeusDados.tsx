import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  User, MapPin, Church, Home as HomeIcon, GraduationCap, BookOpen, Globe, Hammer,
  HeartPulse, Landmark, FolderOpen, Eye, Flag, Mail, Phone, Clock, Send, X, Loader2, FileText, MessageCircle
} from 'lucide-react';
import api, { getFileUrl } from '../api';
import { useAuth } from '../context/AuthContext';
import { appAlert } from '../components/Common/AppDialog';
import { SEDE_REGIONAL_CONTATO } from '../config/sedeRegional';
import '../styles/MeusDados.css';

type Row = Record<string, any>;

interface MeusDadosData {
  usuario: Row;
  dadosCivis: Row | null;
  nacionalidades: Row[];
  rgs: Row[];
  enderecoContato: Row | null;
  contatos: Row[];
  dadosReligiosos: Row | null;
  casasHistorico: Row[];
  itinerario: Row[];
  formacaoAcademica: Row[];
  atividadesMissionarias: Row[];
  obrasRealizadas: Row[];
  saude: Row[];
  contasBancarias: Row[];
  documentos: Row[];
}

interface Solicitacao {
  id: number;
  secao: string;
  campos?: string[];
  descricao: string;
  status: string;
  created_at: string;
}

interface DocItem {
  nome: string;
  origem: string;
  path: string;
  data?: string;
}

type SectionKey =
  | 'pessoais' | 'contato' | 'religiosos' | 'comunidades' | 'itinerario' | 'formacao'
  | 'atividades' | 'obras' | 'saude' | 'bancarios' | 'documentos';

// Campos que o missionário pode apontar como incorretos em cada seção
const SECTION_FIELDS: Record<Exclude<SectionKey, 'documentos'>, string[]> = {
  pessoais: ['nome', 'data_nascimento', 'filiacao', 'naturalidade', 'cidade_estado', 'diocese', 'pais', 'nacionalidades', 'rg', 'cpf', 'rnm', 'titulo_eleitor', 'cnh', 'passaporte', 'nit'],
  contato: ['logradouro', 'complemento', 'bairro', 'cep', 'cidade_estado', 'celular_whatsapp', 'telefone_fixo', 'email_pessoal', 'contatos_familiares'],
  religiosos: ['primeiros_votos_data', 'votos_perpetuos_data', 'lugar_profissao', 'diaconato_data', 'presbiterato_data', 'bispo_ordenante'],
  comunidades: ['casa_nome', 'data_inicio', 'data_fim', 'tipo', 'pm'],
  itinerario: ['etapa', 'local', 'periodo', 'observacoes'],
  formacao: ['curso', 'faculdade', 'periodo', 'observacoes'],
  atividades: ['lugar', 'periodo', 'funcao_atividade', 'missao'],
  obras: ['lugar', 'periodo', 'obra'],
  saude: ['sus_card', 'seguradora', 'numero_carteira'],
  bancarios: ['banco', 'tipo_conta', 'titularidade', 'agencia', 'numero'],
};
const COMMON_FIELDS = ['documento_anexo', 'informacao_faltando', 'outro'];

// Campos técnicos que não fazem sentido para o missionário
const HIDDEN_KEYS = new Set(['id', 'usuario_id', 'casa_id', 'created_at', 'updated_at', 'arquivo_conteudo', 'is_sub_etapa', 'is_superior', 'is_oconomo']);
const isDocKey = (k: string) => k === 'doc_path' || k.endsWith('_doc_path') || k.endsWith('_path');

const humanize = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const formatValue = (v: any, locale: string): string => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean') return v ? '✓' : '—';
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.toLocaleDateString(locale);
  }
  return s;
};

const MeusDados: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { isAdminGeral, canEdit, isRegional, isOconomo, isSuperior } = useAuth();
  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'pt-BR';
  const isMissionarioComum = !isAdminGeral && !canEdit && !isRegional && !isOconomo && !isSuperior;

  const [data, setData] = useState<MeusDadosData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<SectionKey>('pessoais');
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportSecao, setReportSecao] = useState<SectionKey>('pessoais');
  const [reportTexto, setReportTexto] = useState('');
  const [reportCampos, setReportCampos] = useState<string[]>([]);
  const [camposError, setCamposError] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const label = (k: string) => t(`meus_dados.fields.${k}`, humanize(k));

  const loadSolicitacoes = () =>
    api.get('/meus-dados/correcoes').then(res => setSolicitacoes(res.data || [])).catch(() => {});

  useEffect(() => {
    if (!isMissionarioComum) return;
    api.get('/meus-dados')
      .then(res => setData(res.data))
      .catch(err => console.error('Erro ao carregar meus dados:', err))
      .finally(() => setIsLoading(false));
    loadSolicitacoes();
  }, [isMissionarioComum]);

  const sections: { key: SectionKey; icon: React.ReactNode; title: string; count?: number }[] = useMemo(() => [
    { key: 'pessoais', icon: <User size={18} />, title: t('meus_dados.sections.pessoais', 'Dados Pessoais e Civis') },
    { key: 'contato', icon: <MapPin size={18} />, title: t('meus_dados.sections.contato', 'Endereço e Contatos') },
    { key: 'religiosos', icon: <Church size={18} />, title: t('meus_dados.sections.religiosos', 'Dados Religiosos') },
    { key: 'comunidades', icon: <HomeIcon size={18} />, title: t('meus_dados.sections.comunidades', 'Comunidades Religiosas'), count: data?.casasHistorico.length },
    { key: 'itinerario', icon: <BookOpen size={18} />, title: t('meus_dados.sections.itinerario', 'Itinerário Formativo'), count: data?.itinerario.length },
    { key: 'formacao', icon: <GraduationCap size={18} />, title: t('meus_dados.sections.formacao', 'Formação Acadêmica'), count: data?.formacaoAcademica.length },
    { key: 'atividades', icon: <Globe size={18} />, title: t('meus_dados.sections.atividades', 'Atividade Missionária'), count: data?.atividadesMissionarias.length },
    { key: 'obras', icon: <Hammer size={18} />, title: t('meus_dados.sections.obras', 'Obras Realizadas'), count: data?.obrasRealizadas.length },
    { key: 'saude', icon: <HeartPulse size={18} />, title: t('meus_dados.sections.saude', 'Saúde'), count: data?.saude.length },
    { key: 'bancarios', icon: <Landmark size={18} />, title: t('meus_dados.sections.bancarios', 'Dados Bancários'), count: data?.contasBancarias.length },
    { key: 'documentos', icon: <FolderOpen size={18} />, title: t('meus_dados.sections.documentos', 'Documentos') },
  ], [t, data]);

  const sectionTitle = (k: SectionKey) => sections.find(s => s.key === k)?.title || k;

  // Reúne todos os arquivos anexados ao cadastro, de qualquer seção
  const documentos: DocItem[] = useMemo(() => {
    if (!data) return [];
    const docs: DocItem[] = [];
    const collect = (rows: (Row | null)[], origem: SectionKey, nomeFrom?: (r: Row) => string) => {
      rows.forEach(r => {
        if (!r) return;
        Object.entries(r).forEach(([k, v]) => {
          if (isDocKey(k) && v) {
            const base = k === 'doc_path' ? (nomeFrom?.(r) || sectionTitle(origem)) : label(k.replace(/_doc_path$|_path$/, ''));
            docs.push({ nome: base, origem: sectionTitle(origem), path: String(v) });
          }
        });
      });
    };
    data.documentos.forEach(d => docs.push({
      nome: d.descricao || d.arquivo_nome || t('meus_dados.document', 'Documento'),
      origem: t('meus_dados.general_documents', 'Documentos gerais'),
      path: d.arquivo_path,
      data: d.data_upload,
    }));
    collect([data.dadosCivis], 'pessoais');
    collect(data.nacionalidades, 'pessoais', r => `${label('nacionalidade')}: ${r.nacionalidade}`);
    collect(data.rgs, 'pessoais', r => `RG ${r.numero}`);
    collect(data.casasHistorico, 'comunidades', r => r.casa_nome);
    collect(data.itinerario, 'itinerario', r => humanize(String(r.etapa || '').toLowerCase()));
    collect(data.formacaoAcademica, 'formacao', r => r.curso);
    collect(data.atividadesMissionarias, 'atividades', r => r.lugar || r.periodo);
    collect(data.obrasRealizadas, 'obras', r => r.lugar || r.periodo);
    collect(data.saude, 'saude', r => r.seguradora);
    collect(data.contasBancarias, 'bancarios', r => r.banco || r.tipo_conta);
    return docs.filter(d => d.path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, i18n.language]);

  if (!isMissionarioComum) return <Navigate to="/home" replace />;

  // A Sede recebe seção e campos sempre em português, independente do idioma do missionário
  const tPt = i18n.getFixedT('pt');
  const labelPt = (k: string) => k === 'rg' ? 'RG' : tPt(`meus_dados.fields.${k}`, humanize(k));

  // Opções de campo da seção: { id, label exibido, valor enviado à Sede }
  const fieldOptions = (secao: SectionKey): { id: string; label: string; value: string }[] => {
    if (secao === 'documentos') {
      const nomes = Array.from(new Set(documentos.map(d => d.nome)));
      return [
        ...nomes.map(n => ({ id: `doc:${n}`, label: n, value: `${tPt('meus_dados.document', 'Documento')}: ${n}` })),
        { id: 'documento_faltando', label: label('documento_faltando'), value: labelPt('documento_faltando') },
        { id: 'outro', label: label('outro'), value: labelPt('outro') },
      ];
    }
    return [...SECTION_FIELDS[secao], ...COMMON_FIELDS].map(k => ({
      id: k,
      label: k === 'rg' ? 'RG' : label(k),
      value: labelPt(k),
    }));
  };

  const openReport = (secao: SectionKey) => {
    setReportSecao(secao);
    setReportTexto('');
    setReportCampos([]);
    setCamposError(false);
    setReportOpen(true);
  };

  const toggleCampo = (id: string) => {
    setCamposError(false);
    setReportCampos(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const enviarSolicitacao = async () => {
    if (reportCampos.length === 0) {
      setCamposError(true);
      await appAlert(t('meus_dados.report.fields_required', 'Selecione ao menos um campo que precisa ser alterado.'));
      return;
    }
    if (!reportTexto.trim()) {
      await appAlert(t('meus_dados.report.describe_required', 'Descreva qual informação ou documento está incorreto.'));
      return;
    }
    setIsSending(true);
    try {
      const opcoes = fieldOptions(reportSecao);
      await api.post('/meus-dados/correcoes', {
        secao: tPt(`meus_dados.sections.${reportSecao}`, sectionTitle(reportSecao)),
        secao_key: reportSecao,
        campos: opcoes.filter(o => reportCampos.includes(o.id)).map(o => o.value),
        descricao: reportTexto.trim(),
      });
      setReportOpen(false);
      loadSolicitacoes();
      await appAlert(t('meus_dados.report.sent', 'Sua notificação foi enviada à Sede Regional. Você será contatado para a correção.'));
    } catch (err: any) {
      await appAlert(t('meus_dados.report.error', 'Não foi possível enviar a notificação. Tente novamente.') + (err?.response?.data?.message ? `\n${err.response.data.message}` : ''));
    } finally {
      setIsSending(false);
    }
  };

  // ── Renderizadores ─────────────────────────────────────────
  const renderFields = (obj: Row | null | undefined, order: string[], extra?: { label: string; value: React.ReactNode }[]) => {
    const keys = obj
      ? [...order.filter(k => k in obj), ...Object.keys(obj).filter(k => !order.includes(k))]
          .filter(k => !HIDDEN_KEYS.has(k) && !isDocKey(k))
      : [];
    const fields = keys.map(k => ({ label: label(k), value: formatValue(obj![k], locale) as React.ReactNode }));
    const all = [...(extra || []), ...fields];
    if (all.length === 0 || all.every(f => !f.value)) return <EmptyState />;
    return (
      <dl className="md-fields">
        {all.map((f, i) => (
          <div key={i} className="md-field">
            <dt>{f.label}</dt>
            <dd className={f.value ? '' : 'md-empty-value'}>{f.value || t('meus_dados.not_informed', 'Não informado')}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderDocLinks = (obj: Row | null | undefined) => {
    if (!obj) return null;
    const links = Object.entries(obj).filter(([k, v]) => isDocKey(k) && v);
    if (links.length === 0) return null;
    return (
      <div className="md-doc-links">
        {links.map(([k, v]) => (
          <a key={k} href={getFileUrl(String(v)) || '#'} target="_blank" rel="noreferrer" className="md-doc-chip">
            <Eye size={14} /> {k === 'doc_path' ? t('meus_dados.view_document', 'Ver documento') : label(k.replace(/_doc_path$|_path$/, ''))}
          </a>
        ))}
      </div>
    );
  };

  const renderList = (rows: Row[], titleOf: (r: Row) => string, order: string[], subtitleOf?: (r: Row) => string) => {
    if (rows.length === 0) return <EmptyState />;
    return (
      <div className="md-records">
        {rows.map((r, i) => (
          <article key={r.id || i} className="md-record">
            <header>
              <span className="md-record-index">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h4>{titleOf(r) || '—'}</h4>
                {subtitleOf && subtitleOf(r) && <p>{subtitleOf(r)}</p>}
              </div>
            </header>
            {renderFields(r, order)}
            {renderDocLinks(r)}
          </article>
        ))}
      </div>
    );
  };

  const EmptyState = () => (
    <div className="md-empty">{t('meus_dados.no_records', 'Nenhuma informação cadastrada nesta seção.')}</div>
  );

  const renderSection = () => {
    if (!data) return null;
    switch (activeSection) {
      case 'pessoais':
        return (
          <>
            {renderFields(data.dadosCivis, ['data_nascimento', 'filiacao', 'naturalidade', 'cidade_estado', 'diocese', 'pais', 'cpf', 'rnm', 'titulo_eleitor', 'cnh', 'passaporte', 'nit'], [
              { label: label('nome'), value: data.usuario.nome },
              { label: label('nacionalidades'), value: data.nacionalidades.map(n => n.nacionalidade).join(', ') },
              { label: 'RG', value: data.rgs.map(r => r.numero).join(', ') },
            ])}
            {renderDocLinks(data.dadosCivis)}
          </>
        );
      case 'contato':
        return (
          <>
            {renderFields(data.enderecoContato, ['logradouro', 'complemento', 'bairro', 'cep', 'cidade_estado', 'celular_whatsapp', 'telefone_fixo', 'email_pessoal'])}
            <h3 className="md-subtitle">{t('meus_dados.family_contacts', 'Contatos de familiares')}</h3>
            {renderList(data.contatos, r => r.nome, ['parentesco', 'telefone', 'email', 'endereco'], r => r.parentesco)}
          </>
        );
      case 'religiosos':
        return (
          <>
            {renderFields(data.dadosReligiosos, ['primeiros_votos_data', 'votos_perpetuos_data', 'lugar_profissao', 'diaconato_data', 'presbiterato_data', 'bispo_ordenante'])}
            {renderDocLinks(data.dadosReligiosos)}
          </>
        );
      case 'comunidades':
        return renderList(data.casasHistorico, r => r.casa_nome, ['data_inicio', 'data_fim', 'tipo', 'pm', 'casa_cidade', 'casa_pais'],
          r => (!r.data_fim || String(r.data_fim).slice(0, 10) >= new Date().toISOString().slice(0, 10))
            ? t('meus_dados.current_community', 'Comunidade atual') : '');
      case 'itinerario':
        return renderList(data.itinerario, r => humanize(String(r.etapa || '').toLowerCase()), ['local', 'periodo', 'observacoes']);
      case 'formacao':
        return renderList(data.formacaoAcademica, r => r.curso, ['faculdade', 'periodo', 'observacoes']);
      case 'atividades':
        return renderList(data.atividadesMissionarias, r => r.lugar, ['periodo', 'funcao_atividade', 'missao']);
      case 'obras':
        return renderList(data.obrasRealizadas, r => r.lugar, ['periodo', 'obra']);
      case 'saude':
        return renderList(data.saude, r => r.seguradora || t('meus_dados.sections.saude', 'Saúde'), ['sus_card', 'numero_carteira']);
      case 'bancarios':
        return renderList(data.contasBancarias, r => r.banco || r.tipo_conta, ['tipo_conta', 'titularidade', 'agencia', 'numero', 'observacoes']);
      case 'documentos':
        if (documentos.length === 0) return <EmptyState />;
        return (
          <div className="md-docs-grid">
            {documentos.map((d, i) => (
              <a key={i} className="md-doc-card" href={getFileUrl(d.path) || '#'} target="_blank" rel="noreferrer">
                <span className="md-doc-icon"><FileText size={22} /></span>
                <span className="md-doc-body">
                  <strong>{d.nome}</strong>
                  <small>{d.origem}{d.data ? ` · ${formatValue(d.data, locale)}` : ''}</small>
                </span>
                <span className="md-doc-view"><Eye size={16} /></span>
              </a>
            ))}
          </div>
        );
    }
  };

  const sede = SEDE_REGIONAL_CONTATO;
  const hasSedeContato = !!(sede.email || sede.telefone || sede.whatsapp);
  const onlyDigits = (v: string) => v.replace(/\D/g, '');

  const renderSedeContatos = (compact = false) => (
    <ul className={compact ? 'md-sede-list compact' : 'md-sede-list'}>
      {sede.email && <li><Mail size={14} /> <a href={`mailto:${sede.email}`}>{sede.email}</a></li>}
      {sede.telefone && <li><Phone size={14} /> <a href={`tel:+${onlyDigits(sede.telefone)}`}>{sede.telefone}</a></li>}
      {sede.whatsapp && (
        <li><MessageCircle size={14} /> <a href={`https://wa.me/${onlyDigits(sede.whatsapp)}`} target="_blank" rel="noreferrer">
          WhatsApp{sede.whatsapp === sede.telefone ? '' : `: ${sede.whatsapp}`}
        </a></li>
      )}
      {sede.horario && <li><Clock size={14} /> {t('meus_dados.sede.hours', 'Atendimento')}: {sede.horario}</li>}
    </ul>
  );

  return (
    <div className="md-page">
      <header className="md-hero">
        <div>
          <span className="md-eyebrow">{t('meus_dados.eyebrow', 'Ficha cadastral')}</span>
          <h1>{t('meus_dados.title', 'Meus Dados')}</h1>
          <p>{t('meus_dados.subtitle', 'Confira as informações e documentos registrados pela Sede Regional no seu cadastro.')}</p>
        </div>
        <div className="md-hero-side">
          <span className="md-readonly-pill"><Eye size={14} /> {t('meus_dados.read_only', 'Somente visualização')}</span>
          <button className="md-report-btn" onClick={() => openReport(activeSection)}>
            <Flag size={16} /> {t('meus_dados.report.button', 'Notificar erro à Sede')}
          </button>
        </div>
      </header>

      {isLoading ? (
        <div className="md-loading"><Loader2 className="animate-spin" size={28} /></div>
      ) : !data ? (
        <div className="md-empty">{t('meus_dados.load_error', 'Não foi possível carregar seus dados.')}</div>
      ) : (
        <div className="md-layout">
          <aside className="md-aside">
            <nav className="md-nav" aria-label={t('meus_dados.title', 'Meus Dados')}>
              {sections.map(s => (
                <button
                  key={s.key}
                  className={`md-nav-item ${activeSection === s.key ? 'active' : ''}`}
                  onClick={() => setActiveSection(s.key)}
                >
                  {s.icon}
                  <span>{s.title}</span>
                  {s.key === 'documentos'
                    ? <em>{documentos.length}</em>
                    : s.count !== undefined && <em>{s.count}</em>}
                </button>
              ))}
            </nav>

            <section className="md-sede-card">
              <h3>{t('meus_dados.sede.title', 'Sede Regional')}</h3>
              <p>{t('meus_dados.sede.desc', 'Encontrou algum dado ou documento incorreto? Notifique a Sede Regional pelo botão abaixo ou pelos contatos.')}</p>
              {hasSedeContato ? renderSedeContatos() : (
                <p className="md-sede-pending">{t('meus_dados.sede.pending', 'Os contatos da Sede Regional serão disponibilizados em breve.')}</p>
              )}
              <button className="md-report-btn outline" onClick={() => openReport(activeSection)}>
                <Flag size={15} /> {t('meus_dados.report.button', 'Notificar erro à Sede')}
              </button>
            </section>
          </aside>

          <main className="md-content">
            <div className="md-content-head">
              <h2>{sectionTitle(activeSection)}</h2>
              <button className="md-link-btn" onClick={() => openReport(activeSection)}>
                <Flag size={14} /> {t('meus_dados.report.this_section', 'Algo errado nesta seção?')}
              </button>
            </div>
            {renderSection()}

            {solicitacoes.length > 0 && (
              <section className="md-requests">
                <h3 className="md-subtitle">{t('meus_dados.requests.title', 'Minhas notificações enviadas')}</h3>
                <ul>
                  {solicitacoes.map(s => (
                    <li key={s.id}>
                      <div>
                        <strong>{s.secao}</strong>
                        <span>{formatValue(s.created_at, locale)}</span>
                      </div>
                      {s.campos && s.campos.length > 0 && (
                        <div className="md-request-campos">
                          {s.campos.map(c => <em key={c}>{c}</em>)}
                        </div>
                      )}
                      <p>{s.descricao}</p>
                      <span className={`md-status ${s.status.toLowerCase()}`}>
                        {s.status === 'ABERTA' ? t('meus_dados.requests.open', 'Enviada') : t('meus_dados.requests.resolved', 'Resolvida')}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </main>
        </div>
      )}

      {reportOpen && (
        <div className="md-modal-backdrop" onClick={() => !isSending && setReportOpen(false)}>
          <div className="md-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
            <div className="md-modal-head">
              <h3><Flag size={18} /> {t('meus_dados.report.title', 'Notificar a Sede Regional')}</h3>
              <button className="md-icon-btn" onClick={() => setReportOpen(false)} disabled={isSending} aria-label={t('common.close', 'Fechar')}><X size={18} /></button>
            </div>
            <p className="md-modal-desc">{t('meus_dados.report.desc', 'Informe qual dado ou documento está incorreto. A Sede Regional será notificada para fazer a correção.')}</p>
            <label>
              {t('meus_dados.report.section', 'Seção')}
              <select value={reportSecao} onChange={e => { setReportSecao(e.target.value as SectionKey); setReportCampos([]); setCamposError(false); }}>
                {sections.map(s => <option key={s.key} value={s.key}>{s.title}</option>)}
              </select>
            </label>
            <fieldset className={`md-fields-picker ${camposError ? 'has-error' : ''}`}>
              <legend>
                {t('meus_dados.report.fields', 'Campos que precisam ser alterados')} <span className="md-required">*</span>
                <small>{t('meus_dados.report.fields_hint', 'Selecione um ou mais')}</small>
              </legend>
              <div className="md-chip-group">
                {fieldOptions(reportSecao).map(o => {
                  const checked = reportCampos.includes(o.id);
                  return (
                    <label key={o.id} className={`md-chip ${checked ? 'checked' : ''}`}>
                      <input type="checkbox" checked={checked} onChange={() => toggleCampo(o.id)} />
                      {o.label}
                    </label>
                  );
                })}
              </div>
              {camposError && <p className="md-field-error">{t('meus_dados.report.fields_required', 'Selecione ao menos um campo que precisa ser alterado.')}</p>}
            </fieldset>
            <label>
              {t('meus_dados.report.description', 'O que está incorreto?')}
              <textarea
                rows={5}
                value={reportTexto}
                onChange={e => setReportTexto(e.target.value)}
                placeholder={t('meus_dados.report.placeholder', 'Ex.: a data de nascimento está errada, o correto é 12/03/1985.')}
              />
            </label>
            {hasSedeContato && (
              <div className="md-modal-contact">
                <span>{t('meus_dados.sede.contact_also', 'Se preferir, fale diretamente com a Sede Regional:')}</span>
                {renderSedeContatos(true)}
              </div>
            )}
            <div className="md-modal-actions">
              <button className="md-btn-secondary" onClick={() => setReportOpen(false)} disabled={isSending}>{t('common.cancel', 'Cancelar')}</button>
              <button className="md-btn-primary" onClick={enviarSolicitacao} disabled={isSending}>
                {isSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                {t('meus_dados.report.send', 'Enviar notificação')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MeusDados;
