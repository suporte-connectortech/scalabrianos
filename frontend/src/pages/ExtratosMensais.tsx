import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api';
import { FileText, Calendar, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, X, Eye, Printer } from 'lucide-react';
import MonthPicker, { formatMonthLabel } from '../components/Common/MonthPicker';
import { openPrintReport, buildPrintTable, buildPrintSummary, formatIssuedAt, type PrintCell } from '../utils/printReport';
import '../styles/FinanceiroSpreadsheet.css';

interface ExtratoMes {
  id: number;
  mes_referencia: string;
  total_credito: number;
  total_debito: number;
  saldo: number;
  data_validacao: string;
  nome_missionario?: string;
  nome_casa?: string;
  casa_id?: number;
  usuario_id?: number;
}

interface Categoria {
  id: number;
  codigo?: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  perfil: string;
}

interface DetalhesPlanilha {
  id: number;
  mes_referencia: string;
  itens: {
    categoria_id: number;
    valor: number;
  }[];
  // Somente na Casa Religiosa: valores das prestações validadas dos missionários, por categoria
  missionarySums?: Record<number, number>;
}

// Linha do detalhe: total por categoria (vários lançamentos da mesma categoria são somados)
interface DetalheLinha {
  categoria_id: number;
  codigo: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  casa: number;
  missionarios: number;
  total: number;
}

const ExtratosMensais: React.FC = () => {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const { formatCurrency } = useCurrency();
  
  const isOconomo = user?.role === 'ECONOMO_LOCAL' || user?.role === 'ECONOMO_REGIONAL' || !!user?.is_oconomo;
  
  const [extratos, setExtratos] = useState<ExtratoMes[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [casas, setCasas] = useState<{ id: number; nome: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterMes, setFilterMes] = useState('');
  const [filterCasa, setFilterCasa] = useState('');
  const [activeTab, setActiveTab] = useState<'missionario' | 'comunidade'>('missionario');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modal states
  const [selectedExtrato, setSelectedExtrato] = useState<ExtratoMes | null>(null);
  const [detalhes, setDetalhes] = useState<DetalhesPlanilha | null>(null);
  const [isModalLoading, setIsModalLoading] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
    setFilterCasa('');
  }, [filterMes, activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      let extratosUrl = `/financas-mensais/usuario/${user?.id}/extratos`;
      if (isOconomo) {
        extratosUrl = activeTab === 'missionario' ? '/extratos/missionarios' : '/extratos/casas';
      }
      const [extratosRes, catRes, casasRes] = await Promise.all([
        api.get(extratosUrl),
        api.get('/categorias-financas'),
        api.get('/casas-religiosas')
      ]);
      setExtratos(extratosRes.data || []);
      setCategorias(catRes.data || []);
      setCasas(casasRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, activeTab]);

  const handleOpenDetails = async (extrato: ExtratoMes) => {
    setSelectedExtrato(extrato);
    setIsModalLoading(true);
    setDetalhes(null);
    try {
      let url = '';
      if (isOconomo && activeTab === 'comunidade') {
        url = `/financas-comunidade/${extrato.casa_id}/${extrato.mes_referencia}?usuario_id=${extrato.usuario_id}`;
      } else {
        // A listagem do próprio missionário não traz usuario_id: usa o usuário logado
        const uid = extrato.usuario_id || user?.id;
        url = `/financas-mensais/usuario/${uid}/mes/${extrato.mes_referencia}`;
      }
      const res = await api.get(url);
      setDetalhes(res.data);
    } catch (err) {
      console.error('Error fetching details:', err);
    } finally {
      setIsModalLoading(false);
    }
  };

  const isDetalheCasa = isOconomo && activeTab === 'comunidade';

  // Consolida o detalhe por categoria. Na Casa Religiosa soma os lançamentos da casa
  // com os valores das prestações validadas dos missionários (mesma regra da planilha da casa).
  const detalheLinhas: DetalheLinha[] = (() => {
    if (!detalhes) return [];
    const map = new Map<number, DetalheLinha>();
    const add = (categoriaId: number, valor: number, origem: 'casa' | 'missionarios') => {
      const v = parseFloat(String(valor)) || 0;
      if (v <= 0) return;
      const cat = categorias.find(c => c.id === categoriaId);
      if (!cat) return;
      const linha = map.get(categoriaId) || {
        categoria_id: categoriaId, codigo: cat.codigo || '', nome: cat.nome, tipo: cat.tipo, casa: 0, missionarios: 0, total: 0
      };
      linha[origem] += v;
      linha.total += v;
      map.set(categoriaId, linha);
    };
    (detalhes.itens || []).forEach(it => add(it.categoria_id, it.valor, 'casa'));
    if (isDetalheCasa && detalhes.missionarySums) {
      Object.entries(detalhes.missionarySums).forEach(([id, v]) => add(Number(id), v, 'missionarios'));
    }
    return Array.from(map.values());
  })();
  const detalheReceitas = detalheLinhas.filter(l => l.tipo === 'CREDITO');
  const detalheDespesas = detalheLinhas.filter(l => l.tipo === 'DEBITO');

  const dateLocale = i18n.language.startsWith('es') ? 'es-ES' : 'pt-BR';
  const printCommon = () => ({
    lang: dateLocale,
    orgName: t('profile.print.org_name', 'Congregação dos Missionários de São Carlos – Scalabrinianos'),
    regionName: t('financeiro.print.region', 'Região Nossa Senhora Mãe dos Migrantes (RNSMM)'),
    issuedLabel: t('profile.print.issued', 'Emissão'),
    issuedAt: formatIssuedAt(dateLocale, t('profile.print.at', 'às')),
    footerLeft: t('profile.print.footer_system', 'Portal Scalabrinianos — Sistema de Gestão'),
    popupBlockedMessage: t('financeiro.print.popup_blocked', 'Autorize pop-ups no navegador para imprimir o relatório.'),
  });

  // Impressão condensada do extrato aberto no modal
  const handlePrintDetalhe = () => {
    if (!selectedExtrato) return;
    const money = (v: number) => formatCurrency(v, { hideSymbol: true });
    const linhasToRows = (linhas: DetalheLinha[]): PrintCell[][] => linhas.map(l => isDetalheCasa
      ? [{ v: l.codigo, cls: 'c' }, l.nome, { v: l.casa ? money(l.casa) : '–', cls: l.casa ? 'n' : 'n z' }, { v: l.missionarios ? money(l.missionarios) : '–', cls: l.missionarios ? 'n' : 'n z' }, { v: money(l.total), cls: 'n b' }]
      : [{ v: l.codigo, cls: 'c' }, l.nome, { v: money(l.total), cls: 'n' }]);
    const cols = (titulo: string) => isDetalheCasa
      ? [{ header: t('planilha.col_code', 'CÓD.'), cls: 'c' }, { header: titulo }, { header: t('planilha.col_house', 'CASA'), cls: 'n' }, { header: t('planilha.col_missio', 'MISSIO.'), cls: 'n' }, { header: t('planilha.col_total', 'TOTAL'), cls: 'n' }]
      : [{ header: t('planilha.col_code', 'CÓD.'), cls: 'c' }, { header: titulo }, { header: t('financeiro.table.value', 'Valor'), cls: 'n' }];
    const span = isDetalheCasa ? 4 : 2;
    const totalRec = detalheReceitas.reduce((s, l) => s + l.total, 0);
    const totalDep = detalheDespesas.reduce((s, l) => s + l.total, 0);
    const titulo = isDetalheCasa
      ? t('financeiro.print.title_extrato_casa', 'Extrato Mensal — Casa Religiosa')
      : t('financeiro.print.title_extrato_missionario', 'Extrato Mensal — Missionário');

    openPrintReport({
      ...printCommon(),
      docTitle: `${titulo} - ${selectedExtrato.nome_missionario || selectedExtrato.nome_casa || user?.nome || ''} - ${selectedExtrato.mes_referencia}`,
      title: titulo,
      status: { label: isDetalheCasa ? t('financeiro.print.status_aprovado', 'Aprovado') : t('financeiro.print.status_validado', 'Validado'), tone: 'ok' },
      meta: [
        ...(!isDetalheCasa ? [{ label: t('financeiro.print.missionary', 'Missionário'), value: selectedExtrato.nome_missionario || user?.nome || '' }] : []),
        { label: t('financeiro.print.community', 'Comunidade Religiosa'), value: selectedExtrato.nome_casa || '' },
        { label: t('financeiro.print.month', 'Mês/Ano'), value: formatMonthLabel(selectedExtrato.mes_referencia) },
        { label: t('extratos.table.validation_date', 'Data Validação'), value: selectedExtrato.data_validacao ? new Date(selectedExtrato.data_validacao).toLocaleDateString(dateLocale) : '' },
      ],
      bodyHtml: `<div class="rp-cols"><div>${buildPrintTable({
          className: 'cred', columns: cols(t('planilha.receitas', 'RECEITAS')), rows: linhasToRows(detalheReceitas),
          footer: [[{ v: t('planilha.total_receitas', 'TOTAL RECEITAS'), colspan: span }, { v: money(totalRec), cls: 'n' }]],
          emptyText: t('extratos.details_modal.no_incomes', 'Nenhuma receita registrada.'),
        })}</div><div>${buildPrintTable({
          className: 'deb', columns: cols(t('planilha.despesas', 'DESPESAS')), rows: linhasToRows(detalheDespesas),
          footer: [[{ v: t('planilha.total_despesas', 'TOTAL DESPESAS'), colspan: span }, { v: money(totalDep), cls: 'n' }]],
          emptyText: t('extratos.details_modal.no_expenses', 'Nenhuma despesa registrada.'),
        })}</div></div>`
        + buildPrintSummary([
          { label: t('planilha.total_receitas', 'Total Receitas'), value: formatCurrency(selectedExtrato.total_credito), tone: 'pos' },
          { label: t('planilha.total_despesas', 'Total Despesas'), value: formatCurrency(selectedExtrato.total_debito), tone: 'neg' },
          { label: t('extratos.table.balance', 'Saldo'), value: formatCurrency(selectedExtrato.saldo), tone: Number(selectedExtrato.saldo) >= 0 ? 'pos' : 'neg' },
        ]),
      footerRight: `${t('financeiro.print.month', 'Mês/Ano')}: ${formatMonthLabel(selectedExtrato.mes_referencia)}`,
      orientation: isDetalheCasa ? 'landscape' : 'portrait',
    });
  };

  // Filtering Logic
  const filteredExtratos = extratos.filter(ext => {
    const matchesMes = filterMes ? ext.mes_referencia === filterMes : true;
    const matchesCasa = filterCasa ? ext.casa_id?.toString() === filterCasa : true;
    return matchesMes && matchesCasa;
  });

  // Impressão condensada da listagem filtrada (todas as páginas)
  const handlePrintLista = () => {
    if (filteredExtratos.length === 0) return;
    const money = (v: number) => formatCurrency(v, { hideSymbol: true });
    const showCasa = isOconomo;
    const showMiss = isOconomo && activeTab === 'missionario';
    const titulo = activeTab === 'comunidade' && isOconomo
      ? t('extratos.tab_community', 'Extratos da Casa Religiosa')
      : isOconomo ? t('extratos.tab_missionary', 'Extratos dos Missionários') : t('extratos.title', 'Extratos Mensais');
    const totCre = filteredExtratos.reduce((s, e) => s + (Number(e.total_credito) || 0), 0);
    const totDeb = filteredExtratos.reduce((s, e) => s + (Number(e.total_debito) || 0), 0);
    const colsAntes = 2 + (showCasa ? 1 : 0) + (showMiss ? 1 : 0);

    openPrintReport({
      ...printCommon(),
      docTitle: titulo,
      title: titulo,
      meta: [
        ...(!isOconomo ? [{ label: t('financeiro.print.missionary', 'Missionário'), value: user?.nome || '' }] : []),
        { label: t('financeiro.print.month', 'Mês/Ano'), value: filterMes ? formatMonthLabel(filterMes) : t('financeiro.print.all_months', 'Todos') },
        ...(filterCasa ? [{ label: t('financeiro.print.community', 'Comunidade Religiosa'), value: casas.find(c => String(c.id) === filterCasa)?.nome || '' }] : []),
        { label: t('financeiro.print.records', 'Registros'), value: String(filteredExtratos.length) },
      ],
      bodyHtml: buildPrintTable({
        columns: [
          { header: t('extratos.table.month', 'Mês Referência'), cls: 'c' },
          ...(showCasa ? [{ header: t('extratos.table.house', 'Casa Religiosa') }] : []),
          ...(showMiss ? [{ header: t('extratos.table.missionary', 'Missionário') }] : []),
          { header: t('extratos.table.validation_date', 'Data Validação'), cls: 'c' },
          { header: t('extratos.table.incomes', 'Receitas'), cls: 'n' },
          { header: t('extratos.table.expenses', 'Despesas'), cls: 'n' },
          { header: t('extratos.table.balance', 'Saldo'), cls: 'n' },
        ],
        rows: filteredExtratos.map(e => [
          { v: formatMonthLabel(e.mes_referencia), cls: 'c' },
          ...(showCasa ? [e.nome_casa || 'SEDE'] : []),
          ...(showMiss ? [e.nome_missionario || '—'] : []),
          { v: e.data_validacao ? new Date(e.data_validacao).toLocaleDateString(dateLocale) : '—', cls: 'c' },
          { v: money(Number(e.total_credito) || 0), cls: 'n' },
          { v: money(Number(e.total_debito) || 0), cls: 'n' },
          { v: money(Number(e.saldo) || 0), cls: `n ${Number(e.saldo) >= 0 ? 'pos' : 'neg'}` },
        ]),
        footer: [[
          { v: t('planilha.col_total', 'TOTAL'), colspan: colsAntes },
          { v: money(totCre), cls: 'n' },
          { v: money(totDeb), cls: 'n' },
          { v: money(totCre - totDeb), cls: `n ${totCre - totDeb >= 0 ? 'pos' : 'neg'}` },
        ]],
      }),
    });
  };

  // Pagination Logic
  const totalPages = Math.ceil(filteredExtratos.length / itemsPerPage);
  const paginatedExtratos = filteredExtratos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '40px' }}>
        <span style={{ color: '#64748b', fontSize: '16px' }}>{t('common.loading', 'Carregando extratos...')}</span>
      </div>
    );
  }

  return (
    <div className="extratos-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
        <div style={{ background: '#eef2ff', padding: '12px', borderRadius: '12px', color: '#4f46e5' }}>
          <FileText size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1e293b', margin: 0 }}>
            {t('extratos.title', 'Extratos Mensais')}
          </h1>
          <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
            {isOconomo 
              ? t('extratos.subtitle_admin', 'Histórico consolidado das prestações de contas validadas.')
              : t('extratos.subtitle_user', 'Histórico consolidado das suas prestações de contas validadas.')}
          </p>
        </div>
      </div>

      {/* Tab Switcher for Economists */}
      {isOconomo && (
        <div className="tab-menu extratos-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('missionario')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'missionario' ? '#013375' : 'transparent',
              color: activeTab === 'missionario' ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {t('extratos.tab_missionary', 'Extratos dos Missionários')}
          </button>
          <button
            onClick={() => setActiveTab('comunidade')}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              fontWeight: 700,
              fontSize: '14px',
              cursor: 'pointer',
              background: activeTab === 'comunidade' ? '#013375' : 'transparent',
              color: activeTab === 'comunidade' ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            {t('extratos.tab_community', 'Extratos da Casa Religiosa')}
          </button>
        </div>
      )}

      {extratos.length === 0 ? (
        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
          <Calendar size={48} color="#94a3b8" style={{ marginBottom: '16px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#475569', margin: '0 0 8px 0' }}>
            {t('extratos.no_statements', 'Nenhum extrato validado')}
          </h3>
          <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
            {t('extratos.no_statements_desc', 'Não há prestações de contas validadas correspondentes para visualização do extrato.')}
          </p>
        </div>
      ) : (
        <>
          {/* Filtro por Mês de Referência */}
          <div style={{ 
            background: '#fff', 
            padding: '16px 20px', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0', 
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)',
            flexWrap: 'wrap'
          }}>
            <div className="extratos-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={14} color="#64748b" /> {t('extratos.filter_month', 'Buscar por Mês/Ano:')}
              </label>
              <div className="extratos-month-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px' }}>
                <MonthPicker 
                  value={filterMes} 
                  onChange={setFilterMes} 
                />
                {filterMes && (
                  <button 
                    onClick={() => setFilterMes('')}
                    style={{ 
                      background: '#f1f5f9', 
                      border: '1px solid #cbd5e1', 
                      color: '#475569', 
                      padding: '8px 12px', 
                      borderRadius: '8px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    {t('common.clear', 'Limpar')}
                  </button>
                )}
              </div>
            </div>

            <button
              onClick={handlePrintLista}
              disabled={filteredExtratos.length === 0}
              title={t('financeiro.print.button_title', 'Imprimir em layout condensado (A4)')}
              style={{ order: 99, marginLeft: 'auto', alignSelf: 'flex-end', background: '#013375', color: '#fff', border: 'none', padding: '9px 16px', borderRadius: '8px', cursor: filteredExtratos.length === 0 ? 'not-allowed' : 'pointer', opacity: filteredExtratos.length === 0 ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '13px' }}
            >
              <Printer size={16} /> {t('extratos.print_list', 'Imprimir listagem')}
            </button>

            {isOconomo && (user?.role === 'ECONOMO_REGIONAL' || user?.role === 'ADMIN_GERAL') && (
              <div className="extratos-filter-field" style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>
                  {t('extratos.filter_house', 'Casa Religiosa:')}
                </label>
                <select
                  value={filterCasa}
                  onChange={e => setFilterCasa(e.target.value)}
                  style={{ 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1', 
                    fontSize: '14px', 
                    color: '#1e293b',
                    outline: 'none',
                    background: '#fff',
                    fontWeight: 600,
                    height: '38px'
                  }}
                >
                  <option value="">{t('extratos.all_houses', 'Todas as Casas')}</option>
                  {casas.map(c => (
                    <option key={c.id} value={c.id.toString()}>{c.nome}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {filteredExtratos.length === 0 ? (
            <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '16px', padding: '32px', textAlign: 'center' }}>
              <p style={{ color: '#64748b', margin: 0, fontSize: '14px', fontWeight: 600 }}>
                {t('missionaries.empty', 'Nenhum extrato encontrado para o mês selecionado.')}
              </p>
            </div>
          ) : (
            <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="extratos-table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.month', 'Mês Referência')}</th>
                      {isOconomo && (
                        <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.house', 'Casa Religiosa')}</th>
                      )}
                      {isOconomo && activeTab === 'missionario' && (
                        <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.missionary', 'Missionário')}</th>
                      )}
                      <th style={{ padding: '16px 20px', color: '#475569', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.validation_date', 'Data Validação')}</th>
                      <th style={{ padding: '16px 20px', color: '#059669', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.incomes', 'Receitas')}</th>
                      <th style={{ padding: '16px 20px', color: '#dc2626', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.expenses', 'Despesas')}</th>
                      <th style={{ padding: '16px 20px', color: '#0f172a', fontWeight: 700, fontSize: '14px' }}>{t('extratos.table.balance', 'Saldo')}</th>
                      <th style={{ padding: '16px 20px', textAlign: 'center', color: '#475569', fontWeight: 600, fontSize: '14px' }}>{t('extratos.table.actions', 'Ações')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExtratos.map(ext => (
                      <tr key={`${activeTab}-${ext.id}`} style={{ borderBottom: '1px solid #e2e8f0', transition: 'background 0.2s' }}>
                        <td style={{ padding: '16px 20px', fontWeight: 600, color: '#1e293b', textTransform: 'capitalize' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Calendar size={16} color="#64748b" />
                            {ext.mes_referencia}
                          </div>
                        </td>
                        {isOconomo && (
                          <td style={{ padding: '16px 20px', color: '#1e293b', fontWeight: 500 }}>
                            {ext.nome_casa || 'SEDE'}
                          </td>
                        )}
                        {isOconomo && activeTab === 'missionario' && (
                          <td style={{ padding: '16px 20px', color: '#334155', fontWeight: 600 }}>
                            {ext.nome_missionario || 'N/A'}
                          </td>
                        )}
                        <td style={{ padding: '16px 20px', color: '#64748b', fontSize: '14px' }}>
                          {ext.data_validacao ? new Date(ext.data_validacao).toLocaleDateString(i18n.language.startsWith('es') ? 'es-ES' : 'pt-BR') : '-'}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#059669', fontWeight: 600 }}>
                          {formatCurrency(ext.total_credito)}
                        </td>
                        <td style={{ padding: '16px 20px', color: '#dc2626', fontWeight: 600 }}>
                          {formatCurrency(ext.total_debito)}
                        </td>
                        <td style={{ padding: '16px 20px', color: Number(ext.saldo) >= 0 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                          {formatCurrency(ext.saldo)}
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                          <button 
                            onClick={() => handleOpenDetails(ext)}
                            style={{ background: '#eef2ff', color: '#4f46e5', border: 'none', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, fontSize: '13px', transition: 'background 0.2s' }}
                          >
                            <Eye size={16} /> {t('extratos.table.view_details', 'Ver Detalhes')}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="extratos-pagination" style={{ padding: '16px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>
                    {t('common.page', 'Página')} {currentPage} / {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      style={{ background: currentPage === 1 ? '#e2e8f0' : 'white', border: '1px solid #cbd5e1', color: '#475569', padding: '6px 12px', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center' }}
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button 
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
        </>
      )}

      {/* Detalhes Modal */}
      {selectedExtrato && (
        <div className="extratos-modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedExtrato(null); }}>
          <div className="extratos-modal" style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '600px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div className="extratos-modal-header" style={{ padding: '24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', background: '#f8fafc', borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={20} color="#4f46e5" />
                  {t('extratos.details_modal.title', 'Detalhes do Extrato')}
                </h3>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px', textTransform: 'capitalize' }}>{selectedExtrato.mes_referencia}</p>
              </div>
              <button onClick={() => setSelectedExtrato(null)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '8px', flexShrink: 0 }}>
                <X size={24} />
              </button>
            </div>
            
            <div className="extratos-modal-body" style={{ padding: '24px', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
              {isModalLoading ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>{t('common.loading', 'Carregando detalhes...')}</div>
              ) : detalheLinhas.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {([
                    { tipo: 'CREDITO', linhas: detalheReceitas, cor: '#059669', borda: '#d1fae5', Icone: TrendingUp, titulo: t('extratos.details_modal.incomes_title', 'Receitas Detalhadas'), vazio: t('extratos.details_modal.no_incomes', 'Nenhuma receita registrada.') },
                    { tipo: 'DEBITO', linhas: detalheDespesas, cor: '#dc2626', borda: '#fee2e2', Icone: TrendingDown, titulo: t('extratos.details_modal.expenses_title', 'Despesas Detalhadas'), vazio: t('extratos.details_modal.no_expenses', 'Nenhuma despesa registrada.') },
                  ] as const).map(grupo => (
                    <div key={grupo.tipo}>
                      <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: grupo.cor, margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: `2px solid ${grupo.borda}` }}>
                        <grupo.Icone size={18} /> {grupo.titulo}
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {grupo.linhas.length > 0 ? grupo.linhas.map(linha => (
                          <div key={linha.categoria_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
                            <span style={{ color: '#475569' }}>
                              {linha.nome}
                              {isDetalheCasa && linha.missionarios > 0 && (
                                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                                  {t('planilha.col_house', 'Casa')}: {formatCurrency(linha.casa)} · {t('extratos.details_modal.missionaries_part', 'Missionários')}: {formatCurrency(linha.missionarios)}
                                </span>
                              )}
                            </span>
                            <span style={{ fontWeight: 600, color: grupo.cor, whiteSpace: 'nowrap' }}>{formatCurrency(linha.total)}</span>
                          </div>
                        )) : (
                          <span style={{ fontSize: '14px', color: '#94a3b8' }}>{grupo.vazio}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>{t('extratos.details_modal.no_details', 'Nenhum detalhe encontrado para este mês.')}</div>
              )}
            </div>
            
            <div className="extratos-modal-footer" style={{ padding: '20px 24px', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px' }}>
              <button
                onClick={handlePrintDetalhe}
                disabled={isModalLoading}
                style={{ background: '#013375', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: isModalLoading ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} /> {t('financeiro.actions.print', 'Imprimir')}
              </button>
              <button onClick={() => setSelectedExtrato(null)} style={{ background: '#e2e8f0', color: '#475569', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>
                {t('common.close', 'Fechar')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtratosMensais;
