import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Loader2, CheckCircle, XCircle, AlertCircle,
  Calendar, FileText, Download, TrendingUp, TrendingDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api, { getFileUrl } from '../../api';

interface Categoria {
  id: number;
  codigo: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoria_pai: 'PESSOAL' | 'CASA';
  perfil: 'PERFIL_1' | 'PERFIL_2' | 'ANUAL' | 'PLANEJAMENTO';
}

interface PlanilhaItem {
  categoria_id: number;
  valor: number;
}

interface PlanilhaData {
  id?: number;
  usuario_id: number;
  casa_id: number;
  mes_referencia: string;
  status: 'PENDENTE' | 'VALIDADO' | 'DEVOLVIDO' | 'EM_VALIDACAO';
  total_credito: number;
  total_debito: number;
  num_missas_superior: number;
  anexo_path: string | null;
  apontamentos: string;
  obs_receita: string;
  obs_despesa: string;
  itens: PlanilhaItem[];
}

interface Props {
  casas: { id: number; nome: string }[];
  categorias: Categoria[];
  externalUsuarioId?: number;
  externalMes?: string;
  onValidationComplete?: () => void;
}

interface ConsolidatedRow {
  usuario_id: number;
  usuario_nome: string;
  mes_referencia: string;
  status: string;
  total_credito: number;
  total_debito: number;
  id?: number;
  apontamentos: string;
}

interface ConsolidatedStatus {
  status: 'PENDENTE_ECONOMO' | 'PENDENTE_SUPERIOR' | 'APROVADO' | 'DEVOLVIDO_SUPERIOR';
  apontamentos_economo: string;
  apontamentos_superior: string;
}

interface EntryLog {
  id: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoriaId?: number;
  categoriaNome: string;
  valor: number;
  obs: string;
  timestamp: Date;
}

// ── Currency mask helper: treats every digit typed as centavos ──
const formatCurrencyMask = (raw: string): string => {
  // Strip everything except digits
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10); // value in cents
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMaskedCurrency = (masked: string): number => {
  const clean = masked.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

// Convert stored number (e.g. 1234.56) back to a digit string ("123456") for the mask
const numToDigits = (n: number): string => {
  const cents = Math.round(n * 100);
  return cents > 0 ? cents.toString() : '';
};

const PlanilhaMensal: React.FC<Props> = ({ casas, categorias, externalUsuarioId, externalMes, onValidationComplete }) => {
  const { t } = useTranslation();
  const { user, isAdminGeral } = useAuth();
  const blacklist = ['Congregação', 'Saúde/Medicamentos', 'Transporte', 'Vestuário', 'Água', 'Supermercado', 'Aluguel', 'Energia Elétrica', 'Internet'];
  const [selectedMes, setSelectedMes] = useState(externalMes || new Date().toISOString().slice(0, 7));
  useEffect(() => {
    if (externalMes) {
      setSelectedMes(externalMes);
    }
  }, [externalMes]);
  const [selectedCasa, setSelectedCasa] = useState('');
  const [planilha, setPlanilha] = useState<PlanilhaData | null>(null);
  const [, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, number>>({});
  const [apontamentos, setApontamentos] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUserName, setSelectedUserName] = useState('');
  const [numMissas, setNumMissas] = useState(0);
  const [obsReceita, setObsReceita] = useState('');
  const [obsDespesa, setObsDespesa] = useState('');
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [_isUploading, setIsUploading] = useState(false);

  // Consolidated view state
  const [viewMode, setViewMode] = useState<'individual' | 'consolidado'>('individual');
  const [consolidadoData, setConsolidadoData] = useState<ConsolidatedRow[]>([]);
  const [_isConsolidadoLoading, setIsConsolidadoLoading] = useState(false);
  const [consolidadoStatus, setConsolidadoStatus] = useState<ConsolidatedStatus | null>(null);
  const [isSavingConsolidado, setIsSavingConsolidado] = useState(false);

  // Insertion form state
  const [tempReceitaCat, setTempReceitaCat] = useState('');
  const [tempReceitaVal, setTempReceitaVal] = useState('');
  const [tempDespesaCat, setTempDespesaCat] = useState('');
  const [tempDespesaVal, setTempDespesaVal] = useState('');
  const [entryLogs, setEntryLogs] = useState<EntryLog[]>([]);

  const sortedEntryLogs = useMemo(() => {
    return [...entryLogs].sort((a, b) => {
      // 1. Receitas ('CREDITO') first, Despesas ('DEBITO') second
      if (a.tipo === 'CREDITO' && b.tipo !== 'CREDITO') return -1;
      if (a.tipo !== 'CREDITO' && b.tipo === 'CREDITO') return 1;
      // 2. Within same type, order by date/time (most recent first)
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }, [entryLogs]);

  const syncEditValuesFromLogs = (logs: EntryLog[]) => {
    const newVals: Record<number, number> = {};
    logs.forEach(log => {
      if (log.categoriaId) {
        newVals[log.categoriaId] = (newVals[log.categoriaId] || 0) + log.valor;
      }
    });
    setEditValues(newVals);
  };

  const handleAddItem = (tipo: 'CREDITO' | 'DEBITO') => {
    const catId = tipo === 'CREDITO' ? tempReceitaCat : tempDespesaCat;
    const valStr = tipo === 'CREDITO' ? tempReceitaVal : tempDespesaVal;

    if (!catId) { alert('Selecione uma categoria.'); return; }
    const num = parseMaskedCurrency(valStr);
    if (isNaN(num) || num <= 0) { alert('Informe um valor válido.'); return; }

    const id = parseInt(catId);
    const catObj = categorias.find(c => c.id === id);

    const obs = tipo === 'CREDITO' ? obsReceita : obsDespesa;
    const newEntry: EntryLog = {
      id: `${Date.now()}-${id}-${Math.random()}`,
      tipo,
      categoriaId: id,
      categoriaNome: catObj?.nome || '',
      valor: num,
      obs,
      timestamp: new Date()
    };

    const updatedLogs = [newEntry, ...entryLogs];
    setEntryLogs(updatedLogs);
    syncEditValuesFromLogs(updatedLogs);

    // Clear category, value AND observation
    if (tipo === 'CREDITO') { setTempReceitaCat(''); setTempReceitaVal(''); setObsReceita(''); }
    else { setTempDespesaCat(''); setTempDespesaVal(''); setObsDespesa(''); }
  };

  const handleRemoveItem = (entryId: string) => {
    const updatedLogs = entryLogs.filter(e => e.id !== entryId);
    setEntryLogs(updatedLogs);
    syncEditValuesFromLogs(updatedLogs);
  };

  const rawIsOconomo = !!user?.is_oconomo;
  const isOconomoUser = rawIsOconomo || user?.role === 'ECONOMO_LOCAL' || user?.role === 'ECONOMO_REGIONAL';
  const rawIsSuperior = !!user?.is_superior;
  const isSuperiorUser = rawIsSuperior || user?.role === 'SUPERIOR_LOCAL' || user?.role === 'SUPERIOR_REGIONAL';

  const canValidate = user?.role === 'ADMIN_GERAL' || isOconomoUser || isSuperiorUser;
  const isSuperior = user?.role === 'ADMIN_GERAL' || isSuperiorUser;

  const isOwner = !externalUsuarioId;
  const isLocked = isOwner 
    ? (planilha?.status === 'EM_VALIDACAO' || planilha?.status === 'VALIDADO')
    : (planilha?.status !== 'EM_VALIDACAO');

  useEffect(() => {
    if (user?.casa_id && !selectedCasa) {
      setSelectedCasa(user.casa_id.toString());
    }
  }, [user, selectedCasa]);

  useEffect(() => {
    if (selectedMes && user) {
      if (viewMode === 'individual') loadPlanilha(externalUsuarioId);
      else {
        loadConsolidado();
        loadConsolidadoStatus();
      }
    }
  }, [selectedMes, user, viewMode, selectedCasa, externalUsuarioId, categorias]);

  const loadPlanilha = async (targetUserId?: number) => {
    const uid = targetUserId || externalUsuarioId || user?.id;
    if (!uid) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/financas-mensais/usuario/${uid}/mes/${selectedMes}`);
      if (res.data) {
        setPlanilha(res.data);
        const vals: Record<number, number> = {};
        const logs: EntryLog[] = [];
        res.data.itens.forEach((it: any, idx: number) => {
          const val = parseFloat(it.valor);
          if (val > 0) {
            vals[it.categoria_id] = (vals[it.categoria_id] || 0) + val;
            const cat = categorias.find(c => c.id === it.categoria_id);
            if (cat) {
              logs.push({
                id: it.id ? `db-${it.id}` : `db-${it.categoria_id}-${idx}`,
                tipo: cat.tipo,
                categoriaId: cat.id,
                categoriaNome: cat.nome,
                valor: val,
                obs: it.observacao || '',
                timestamp: new Date(res.data.updated_at || res.data.created_at || Date.now())
              });
            }
          }
        });
        setEditValues(vals);
        setEntryLogs(logs);
        setNumMissas(res.data.num_missas_superior || 0);
        setObsReceita(res.data.obs_receita || '');
        setObsDespesa(res.data.obs_despesa || '');
        setAnexoUrl(res.data.anexo_path || null);
        if (res.data.casa_id) {
          setSelectedCasa(res.data.casa_id.toString());
        }
      } else {
        setPlanilha(null);
        setEditValues({});
        setEntryLogs([]);
        setApontamentos('');
        setNumMissas(0);
        setObsReceita('');
        setObsDespesa('');
        setAnexoUrl(null);
      }
    } catch (err) {
      console.error('Erro ao carregar planilha:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConsolidado = async () => {
    if (!selectedCasa) {
      setConsolidadoData([]);
      return;
    }
    setIsConsolidadoLoading(true);
    try {
      const res = await api.get(`/financas-mensais/consolidado/casa/${selectedCasa}/mes/${selectedMes}`);
      setConsolidadoData(res.data || []);
    } catch (err) {
      console.error('Erro ao carregar consolidado:', err);
    } finally {
      setIsConsolidadoLoading(false);
    }
  };

  const loadConsolidadoStatus = async () => {
    if (!selectedCasa) return;
    try {
      const res = await api.get(`/financas-casa/consolidado/status/${selectedCasa}/${selectedMes}`);
      setConsolidadoStatus(res.data);
    } catch (err) {
      console.error('Erro ao carregar status consolidado:', err);
    }
  };

  const calculateTotals = () => {
    let cre = 0;
    let deb = 0;
    categorias.forEach(cat => {
      const val = editValues[cat.id] || 0;
      if (cat.tipo === 'CREDITO') cre += val;
      else deb += val;
    });
    return { credito: cre, debito: deb, saldo: cre - deb };
  };

  const handleSave = async () => {
    if (!selectedMes) {
      alert('Por favor, selecione o Mês/Ano de referência antes de salvar.');
      return;
    }
    if (!user || !selectedCasa) {
      alert('Selecione uma casa religiosa.');
      return;
    }
    setIsSaving(true);

    let finalAnexoPath = anexoUrl;

    // 1. Upload file if exists
    if (anexoFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('arquivo', anexoFile);
      formData.append('descricao', `Recibo ${selectedMes} - ${user.nome}`);
      try {
        const upRes = await api.post(`/usuarios/${user.id}/documentos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        finalAnexoPath = upRes.data.arquivo_path;
      } catch (err) {
        alert('Erro ao enviar anexo. A planilha será salva sem o anexo.');
      } finally {
        setIsUploading(false);
      }
    }

    const totals = calculateTotals();
    const payload = {
      usuario_id: externalUsuarioId || user.id,
      casa_id: parseInt(selectedCasa),
      mes_referencia: selectedMes,
      total_credito: totals.credito,
      total_debito: totals.debito,
      num_missas_superior: numMissas,
      obs_receita: obsReceita,
      obs_despesa: obsDespesa,
      anexo_path: finalAnexoPath,
      status: 'PENDENTE',
      itens: entryLogs.map(log => ({
        categoria_id: log.categoriaId,
        valor: log.valor,
        observacao: log.obs
      }))
    };

    try {
      await api.post('/financas-mensais', payload);
      alert('Planilha salva como rascunho!');
      loadPlanilha();
    } catch (err: any) {
      alert('Erro ao salvar: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedMes) {
      alert('Por favor, selecione o Mês/Ano de referência antes de enviar.');
      return;
    }
    if (!user || !selectedCasa) {
      alert('Selecione uma casa religiosa.');
      return;
    }

    const isSuperiorSelf = isSuperior && (!selectedUserId || selectedUserId === user.id);
    const confirmMsg = isSuperiorSelf
      ? 'Deseja finalizar sua planilha? Ela será considerada validada automaticamente.'
      : 'Deseja finalizar e enviar esta planilha para o ecônomo? Após enviar, você não poderá mais editá-la.';

    if (!window.confirm(confirmMsg)) {
      return;
    }
    setIsSaving(true);
    const totals = calculateTotals();
    const payload = {
      usuario_id: externalUsuarioId || user.id,
      casa_id: parseInt(selectedCasa),
      mes_referencia: selectedMes,
      total_credito: totals.credito,
      total_debito: totals.debito,
      num_missas_superior: numMissas,
      obs_receita: obsReceita,
      obs_despesa: obsDespesa,
      anexo_path: anexoUrl,
      status: isSuperiorSelf ? 'VALIDADO' : 'EM_VALIDACAO',
      itens: entryLogs.map(log => ({
        categoria_id: log.categoriaId,
        valor: log.valor,
        observacao: log.obs
      }))
    };

    try {
      await api.post('/financas-mensais', payload);
      alert(isSuperiorSelf ? 'Sua planilha foi finalizada e validada!' : 'Planilha enviada para validação com sucesso!');
      loadPlanilha();
    } catch (err: any) {
      alert('Erro ao enviar: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidar = async (status: 'VALIDADO' | 'PENDENTE' | 'DEVOLVIDO') => {
    if (!planilha?.id) return;
    setIsValidating(true);
    try {
      await api.put(`/financas-mensais/${planilha.id}/validar`, { status, apontamentos });
      alert(`Planilha ${status === 'VALIDADO' ? 'validada com sucesso' : 'devolvida para revisão'}!`);
      loadPlanilha(externalUsuarioId);
      if (onValidationComplete) onValidationComplete();
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro desconhecido';
      alert('Erro ao validar planilha: ' + msg);
    } finally {
      setIsValidating(false);
    }
  };

  const handleUpdateConsolidadoStatus = async (newStatus: string) => {
    if (!selectedCasa) return;
    setIsSavingConsolidado(true);
    try {
      await api.put(`/financas-casa/consolidado/status/${selectedCasa}/${selectedMes}`, {
        status: newStatus,
        apontamentos_economo: consolidadoStatus?.apontamentos_economo,
        apontamentos_superior: consolidadoStatus?.apontamentos_superior
      });
      alert('Status consolidado atualizado!');
      loadConsolidadoStatus();
    } catch (err) {
      alert('Erro ao atualizar status consolidado');
    } finally {
      setIsSavingConsolidado(false);
    }
  };

  const totals = calculateTotals();

  const exportConsolidadoToExcel = () => {
    if (consolidadoData.length === 0) return;

    const casaNome = casas.find(c => String(c.id) === selectedCasa)?.nome || 'Casa';
    const data = consolidadoData.map(r => ({
      'Missionário': r.usuario_nome,
      'Mês': r.mes_referencia,
      'Status': r.status,
      'Total Créditos (R$)': r.total_credito,
      'Total Débitos (R$)': r.total_debito,
      'Saldo (R$)': r.total_credito - r.total_debito
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Consolidado');
    XLSX.writeFile(wb, `Consolidado_${casaNome}_${selectedMes}.xlsx`);
  };

  const exportIndividualToExcel = () => {
    if (!user || !planilha) return;

    const casaNome = casas.find(c => String(c.id) === selectedCasa)?.nome || 'Casa';
    const userName = selectedUserName || user.nome;

    // Build the sheet data
    const rows: any[] = [];
    rows.push(['RELATÓRIO FINANCEIRO INDIVIDUAL']);
    rows.push([`Missionário: ${userName}`]);
    rows.push([`Casa: ${casaNome}`]);
    rows.push([`Mês: ${selectedMes}`]);
    rows.push([]);

    // Headers
    rows.push(['CÓDIGO', 'CATEGORIA', 'RECEITA (R$)', '', 'CÓDIGO', 'CATEGORIA', 'DESPESA (R$)']);

    const receitas = categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_1');
    const despesas = categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_1');
    const maxLength = Math.max(receitas.length, despesas.length + 2); // +2 for totals/missas

    for (let i = 0; i < maxLength; i++) {
      const rec = receitas[i];
      const dep = despesas[i];

      const row = [
        rec ? String(rec.codigo || '') : '',
        rec ? String(rec.nome || '') : '',
        rec ? (editValues[rec.id] || 0) : '',
        '',
        dep ? String(dep.codigo || '') : '',
        dep ? String(dep.nome || '') : '',
        dep ? (editValues[dep.id] || 0) : ''
      ];

      // Add extra rows for totals/missas at the end of despesas column
      if (i === despesas.length) {
        row[4] = '50';
        row[5] = 'EXCEDENTE RETIDO';
        row[6] = totals.saldo;
      } else if (i === despesas.length + 1) {
        row[4] = '70';
        row[5] = 'MISSAS CELEBRADAS';
        row[6] = numMissas;
      }

      rows.push(row);
    }

    rows.push([]);
    rows.push(['', 'TOTAL RECEITAS:', totals.credito, '', '', 'TOTAL DESPESAS:', totals.debito]);
    rows.push(['', '', '', '', '', 'SALDO:', totals.saldo]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 15 }, { wch: 5 }, { wch: 10 }, { wch: 30 }, { wch: 15 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Financeiro');
    XLSX.writeFile(wb, `Financeiro_${userName.replace(' ', '_')}_${selectedMes}.xlsx`);
  };

  return (
    <div className="planilha-mensal-content">
      <div className="filters-card" style={{ marginBottom: '20px', display: 'block' }}>
        <div className="filters-grid-premium" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div className="filter-item">
            <label><Calendar size={14} /> {t('planilha.month_year', 'Mês/Ano')}</label>
            <input type="month" value={selectedMes} onChange={e => setSelectedMes(e.target.value)} />
          </div>
          {(isAdminGeral || user?.is_oconomo || user?.is_superior) && (
            <div className="filter-item">
              <label>{t('planilha.community', 'Casa Religiosa')}</label>
              <select value={selectedCasa} onChange={e => setSelectedCasa(e.target.value)} disabled={!isAdminGeral || !!planilha || !!externalUsuarioId}>
                <option value="">{t('planilha.select_house')}</option>
                {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
          )}
          {isAdminGeral && (
            <div className="filter-item">
              <label>{t('planilha.actions', 'Ações')}</label>
              <button className="btn-export-small" onClick={exportConsolidadoToExcel} disabled={consolidadoData.length === 0} style={{ height: '40px', width: '100%', justifyContent: 'center' }}>
                <Download size={14} /> {t('financeiro.actions.export')}
              </button>
            </div>
          )}
        </div>
      </div>

      {(canValidate || isSuperior) && selectedUserId && (
        <div className="view-mode-tabs">
          <button className="mode-btn active" style={{ marginLeft: 'auto' }}>
            {t('planilha.reviewing')}: {selectedUserName}
          </button>
        </div>
      )}

      {viewMode === 'consolidado' ? (
        <div className="consolidado-container">
          <div className="consolidado-approval-card card-lite" style={{ marginBottom: '20px', borderTop: '4px solid #6366f1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0 }}>{t('planilha.consolidado_title')}</h3>
                <p style={{ margin: '5px 0 0', opacity: 0.7 }}>{t('planilha.consolidado_desc')}</p>
              </div>
              <span className={`status-tag ${(consolidadoStatus?.status || '').toLowerCase()}`}>
                {consolidadoStatus?.status?.replace('_', ' ') || 'PENDENTE ECONOMO'}
              </span>
            </div>

            <div className="approval-workflow" style={{ marginTop: '20px', display: 'flex', gap: '15px' }}>
              {user?.is_oconomo && consolidadoStatus?.status === 'PENDENTE_ECONOMO' && (
                <button
                  className="btn-approve"
                  onClick={() => handleUpdateConsolidadoStatus('PENDENTE_SUPERIOR')}
                  disabled={isSavingConsolidado || !consolidadoData.every(r => r.status === 'VALIDADO')}
                  title={!consolidadoData.every(r => r.status === 'VALIDADO') ? "Todas as planilhas devem estar validadas." : ""}
                >
                  <CheckCircle size={18} /> Enviar para o Superior
                </button>
              )}

              {isSuperior && consolidadoStatus?.status === 'PENDENTE_SUPERIOR' && (
                <>
                  <button className="btn-approve" onClick={() => handleUpdateConsolidadoStatus('APROVADO')} disabled={isSavingConsolidado}>
                    <CheckCircle size={18} /> Aprovar Consolidado
                  </button>
                  <button className="btn-reject" onClick={() => handleUpdateConsolidadoStatus('DEVOLVIDO_SUPERIOR')} disabled={isSavingConsolidado}>
                    <XCircle size={18} /> Devolver para o Ecônomo
                  </button>
                </>
              )}
            </div>

            {(consolidadoStatus?.apontamentos_economo || consolidadoStatus?.apontamentos_superior) && (
              <div className="comments-area" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '8px' }}>
                {consolidadoStatus.apontamentos_economo && (
                  <div style={{ marginBottom: '10px' }}>
                    <strong>Notas do Ecônomo:</strong>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>{consolidadoStatus.apontamentos_economo}</p>
                  </div>
                )}
                {consolidadoStatus.apontamentos_superior && (
                  <div>
                    <strong>Notas do Superior:</strong>
                    <p style={{ margin: '5px 0', fontSize: '14px' }}>{consolidadoStatus.apontamentos_superior}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="data-table card-lite">
            <table>
              <thead>
                <tr>
                  <th>Missionário</th>
                  <th>Status</th>
                  <th className="right">Crédito</th>
                  <th className="right">Débito</th>
                  <th className="right">Saldo</th>
                  <th className="center">Ações</th>
                </tr>
              </thead>
              <tbody>
                {consolidadoData.map(row => (
                  <tr key={row.usuario_id}>
                    <td className="bold">{row.usuario_nome}</td>
                    <td><span className={`status-tag ${row.status.toLowerCase()}`}>{row.status}</span></td>
                    <td className="right val-credit">R$ {parseFloat(row.total_credito.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="right val-debit">R$ {parseFloat(row.total_debito.toString()).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className={`right bold ${row.total_credito - row.total_debito >= 0 ? 'val-credit' : 'val-debit'}`}>
                      R$ {(row.total_credito - row.total_debito).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="center">
                      <button
                        className="btn-icon-view"
                        title="Ver Detalhes"
                        onClick={() => {
                          setSelectedUserId(row.usuario_id);
                          setSelectedUserName(row.usuario_nome);
                          setViewMode('individual');
                          loadPlanilha(row.usuario_id);
                        }}
                      >
                        <FileText size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
                {consolidadoData.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                    {!selectedCasa ? 'Selecione uma casa para ver o consolidado.' : 'Nenhuma planilha encontrada para este mês nesta casa.'}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="spreedsheet-container card-lite" style={{ padding: '30px' }}>
            <div className="spreedsheet-header" style={{ marginBottom: '30px', borderBottom: '2px solid #013375', paddingBottom: '15px' }}>
              <div className="header-info">
                <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#013375', margin: 0 }}>Prestação de Contas Mensal - Missionário</h3>
                <div style={{ display: 'flex', gap: '30px', marginTop: '10px', fontSize: '0.95rem' }}>
                  <p style={{ margin: 0 }}>Missionário: <strong style={{ borderBottom: '1px dotted #000' }}>{selectedUserName || user?.nome}</strong></p>
                  <p style={{ margin: 0 }}>Data: <strong style={{ borderBottom: '1px dotted #000' }}>{selectedMes}</strong></p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                {planilha && (
                  <button className="btn-export-small" onClick={exportIndividualToExcel} style={{ background: '#10b981', color: 'white' }}>
                    <Download size={18} /> {t('financeiro.actions.export')}
                  </button>
                )}
                {(!planilha || planilha.status === 'PENDENTE' || planilha.status === 'DEVOLVIDO') && (
                  <button className="btn-save" onClick={handleSave} disabled={isSaving} style={{ background: '#64748b', height: '42px', padding: '0 20px' }}>
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                    {t('planilha.save_draft')}
                  </button>
                )}
              </div>
            </div>

            {/* AVISO / INFORMATIVO */}
            <div style={{
              marginBottom: '20px',
              padding: '16px 20px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              color: '#1e40af'
            }}>
              <AlertCircle size={22} style={{ flexShrink: 0, color: '#2563eb' }} />
              <div style={{ fontSize: '13px', lineHeight: '1.5' }}>
                <strong>Aviso Importante:</strong> Todos os valores devem ser cadastrados exclusivamente através dos campos de <strong>Lançamentos Individuais</strong> abaixo ⬇️, (selecionando a categoria, o valor e a observação).⚠️ A tabela em cinza, é mais para a visualização, ela exibe apenas os totais acumulados, não é possível editar nela. ⚠️
              </div>
            </div>

            {/* INSERTION FORM AREA */}
            {isOwner && !isLocked && (
              <div className="insertion-fields-card" style={{ marginBottom: '20px', padding: '24px', background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <div className="spreadsheet-insertion-grid">
                  {/* RECEITA COL */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontWeight: 800, color: '#166534', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={14} /> Receita
                    </span>
                    <select
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', outline: 'none' }}
                      value={tempReceitaCat}
                      onChange={e => { setTempReceitaCat(e.target.value); setTempReceitaVal(''); setObsReceita(''); }}
                    >
                      <option value="">Selecione a categoria...</option>
                      {categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_1' && !blacklist.includes(c.nome)).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ position: 'relative', flex: '0 0 120px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          style={{ width: '100%', padding: '12px 12px 12px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, outline: 'none' }}
                          value={tempReceitaVal}
                          onChange={e => setTempReceitaVal(formatCurrencyMask(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Observação da receita..."
                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                        value={obsReceita}
                        onChange={e => setObsReceita(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => handleAddItem('CREDITO')}
                      style={{ width: '100%', padding: '12px', background: '#166534', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      Adicionar Receita
                    </button>
                  </div>

                  {/* DESPESA COL */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <span style={{ fontWeight: 800, color: '#991b1b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingDown size={14} /> Despesa
                    </span>
                    <select
                      style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', background: '#fff', outline: 'none' }}
                      value={tempDespesaCat}
                      onChange={e => { setTempDespesaCat(e.target.value); setTempDespesaVal(''); setObsDespesa(''); }}
                    >
                      <option value="">Selecione a categoria...</option>
                      {categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_1' && !blacklist.includes(c.nome)).map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <div style={{ position: 'relative', flex: '0 0 120px' }}>
                        <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', fontWeight: 700, color: '#64748b' }}>R$</span>
                        <input
                          type="text"
                          placeholder="0,00"
                          style={{ width: '100%', padding: '12px 12px 12px 32px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', fontWeight: 700, outline: 'none' }}
                          value={tempDespesaVal}
                          onChange={e => setTempDespesaVal(formatCurrencyMask(e.target.value))}
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Observação da despesa..."
                        style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '13px', outline: 'none' }}
                        value={obsDespesa}
                        onChange={e => setObsDespesa(e.target.value)}
                      />
                    </div>
                    <button
                      onClick={() => handleAddItem('DEBITO')}
                      style={{ width: '100%', padding: '12px', background: '#991b1b', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                    >
                      Adicionar Despesa
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!isOwner && planilha && (planilha.obs_receita || planilha.obs_despesa) && (
              <div className="observations-display-card" style={{ marginBottom: '20px', padding: '18px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#013375', fontSize: '15px', fontWeight: 800 }}>Observações do Missionário</h4>
                {planilha.obs_receita && (
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#334155' }}>
                    <strong>Receitas:</strong> {planilha.obs_receita}
                  </p>
                )}
                {planilha.obs_despesa && (
                  <p style={{ margin: 0, fontSize: '13px', color: '#334155' }}>
                    <strong>Despesas:</strong> {planilha.obs_despesa}
                  </p>
                )}
              </div>
            )}

            {/* TABELA DE VISUALIZAÇÃO DOS VALORES (CINZA & BLOQUEADA) */}
            <div className="spreadsheet-grid">
              {/* RECEITAS */}
              <div className="spreadsheet-column">
                <h4 className="column-title credito" style={{ background: '#e2e8f0', color: '#475569' }}>
                  <TrendingUp size={18} color="#64748b" /> {t('planilha.receitas')} (Visualização)
                </h4>
                <div className="spreadsheet-subtable-container">
                  <div className="spreadsheet-subtable">
                    <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                        <div style={{ width: '40px' }}>CÓD.</div>
                        <div style={{ flex: 1 }}>DESCRIÇÃO</div>
                        <div style={{ width: '110px', textAlign: 'right' }}>VALOR (R$)</div>
                      </div>
                    </div>
                    <div style={{ padding: '2px 0' }}>
                      {categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_1' && !blacklist.includes(c.nome)).map(cat => (
                        <div key={cat.id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', fontSize: '12px', alignItems: 'center', padding: '4px 12px' }}>
                          <div style={{ width: '40px', fontWeight: 700, color: '#64748b' }}>{cat.codigo}</div>
                          <div style={{ flex: 1, color: '#475569' }}>{cat.nome}</div>
                          <div style={{ width: '110px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', width: '100px' }}>
                              <input
                                type="text"
                                placeholder="0,00"
                                value={formatCurrencyMask(numToDigits(editValues[cat.id] || 0))}
                                readOnly
                                disabled
                                style={{ textAlign: 'right', border: 'none', background: 'transparent', width: '100%', fontWeight: 600, fontSize: '12px', color: '#475569', cursor: 'not-allowed' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#f1f5f9', padding: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid #e2e8f0', color: '#334155', marginTop: 'auto' }}>
                  <span>{t('planilha.total_receitas')}</span>
                  <strong style={{ fontSize: '15px' }}>R$ {totals.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>
              </div>

              {/* DESPESAS */}
              <div className="spreadsheet-column">
                <h4 className="column-title debito" style={{ background: '#e2e8f0', color: '#475569' }}>
                  <TrendingDown size={18} color="#64748b" /> {t('planilha.despesas')} (Visualização)
                </h4>
                <div className="spreadsheet-subtable-container">
                  <div className="spreadsheet-subtable">
                    <div style={{ background: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', padding: '8px 12px', fontSize: '11px', fontWeight: 800, color: '#64748b' }}>
                        <div style={{ width: '40px' }}>CÓD.</div>
                        <div style={{ flex: 1 }}>DESCRIÇÃO</div>
                        <div style={{ width: '110px', textAlign: 'right' }}>VALOR (R$)</div>
                      </div>
                    </div>
                    <div style={{ padding: '2px 0' }}>
                      {categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_1' && !blacklist.includes(c.nome)).map(cat => (
                        <div key={cat.id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#f8fafc', fontSize: '12px', alignItems: 'center', padding: '4px 12px' }}>
                          <div style={{ width: '40px', fontWeight: 700, color: '#64748b' }}>{cat.codigo}</div>
                          <div style={{ flex: 1, color: '#475569' }}>{cat.nome}</div>
                          <div style={{ width: '110px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', background: '#e2e8f0', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '2px 8px', width: '100px' }}>
                              <input
                                type="text"
                                placeholder="0,00"
                                value={formatCurrencyMask(numToDigits(editValues[cat.id] || 0))}
                                readOnly
                                disabled
                                style={{ textAlign: 'right', border: 'none', background: 'transparent', width: '100%', fontWeight: 600, fontSize: '12px', color: '#475569', cursor: 'not-allowed' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#f1f5f9', padding: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid #e2e8f0', color: '#334155', marginTop: 'auto' }}>
                  <span>{t('planilha.total_despesas')}</span>
                  <strong style={{ fontSize: '15px' }}>R$ {totals.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                </div>

                <div style={{ padding: '15px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#64748b', fontSize: '11px', fontWeight: 700 }}>70</span>
                      <label style={{ fontWeight: 700, fontSize: '13px', color: '#475569' }}>Missas Celebradas (nº)</label>
                    </div>
                    <input
                      type="number"
                      value={numMissas}
                      onChange={e => setNumMissas(parseInt(e.target.value) || 0)}
                      style={{ width: '70px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 800, background: '#fff' }}
                      disabled={planilha?.status === 'VALIDADO'}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="spreadsheet-summary" style={{ marginTop: '30px', padding: '25px', background: '#f1f5f9', borderRadius: '16px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <input
                  type="file"
                  id="anexo-input"
                  style={{ display: 'none' }}
                  onChange={e => setAnexoFile(e.target.files?.[0] || null)}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                <label htmlFor="anexo-input" className="btn-save" style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto', background: '#013375', color: 'white', border: 'none', height: '46px', padding: '0 25px', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '8px', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 6px -1px rgba(1, 51, 117, 0.2)' }}>
                  <FileText size={20} /> {anexoFile ? anexoFile.name : (anexoUrl ? "Substituir Anexos" : "Anexar Comprovantes (PDF/IMG)")}
                </label>
                {anexoUrl && (
                  <a href={getFileUrl(anexoUrl) || '#'} target="_blank" rel="noreferrer" className="btn-icon-view" title="Ver Anexo" style={{ background: '#fff', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex' }}>
                    <FileText size={24} color="#013375" />
                  </a>
                )}
              </div>

              <div style={{ display: 'flex', gap: '15px' }}>
                {!isLocked && (
                  <>
                    <button className="btn-save" onClick={handleSave} disabled={isSaving} style={{ background: '#64748b', height: '46px', padding: '0 25px', borderRadius: '8px', fontWeight: 700, fontSize: '14px' }}>
                      {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                      {isOwner ? 'Salvar Rascunho' : 'Salvar Alterações'}
                    </button>
                    {isOwner && (
                      <button className="btn-save" onClick={handleFinalize} disabled={isSaving} style={{ background: '#10b981', height: '46px', padding: '0 35px', borderRadius: '8px', fontWeight: 800, fontSize: '15px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}>
                        <CheckCircle size={22} /> {isSuperior && (!selectedUserId || selectedUserId === user?.id) ? "Finalizar Prestação" : "Enviar para Conferência"}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>

            {(canValidate || isSuperior) && viewMode === 'individual' && planilha && (!isOwner || (isOwner && (isOconomoUser || isSuperiorUser || user?.role === 'ADMIN_GERAL') && planilha.status === 'EM_VALIDACAO')) && planilha.status !== 'VALIDADO' && (
              <div className="management-controls card-lite" style={{ marginTop: '30px', borderTop: '4px solid #013375' }}>
                <h3 style={{ marginBottom: '15px' }}>Revisão de Planilha: {selectedUserName || user?.nome}</h3>
                <div className="comment-box" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>Comentários / Apontamentos:</label>
                  <textarea
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '100px', fontSize: '14px', fontFamily: 'inherit' }}
                    value={apontamentos}
                    onChange={(e) => setApontamentos(e.target.value)}
                    placeholder="Descreva aqui o motivo da devolução ou observações de aprovação..."
                  />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button
                    className="btn-approve"
                    onClick={() => handleValidar('VALIDADO')}
                    disabled={isValidating}
                    style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    <CheckCircle size={18} /> Validar Planilha
                  </button>
                  <button
                    className="btn-reject"
                    onClick={() => {
                      if (!apontamentos) {
                        alert('Por favor, adicione um comentário explicando o motivo da devolução.');
                        return;
                      }
                      handleValidar('DEVOLVIDO');
                    }}
                    disabled={isValidating}
                    style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    <AlertCircle size={18} /> Devolver para Revisão
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Missionary Comments View - only when returned */}
          {!canValidate && !isSuperior && planilha?.status === 'DEVOLVIDO' && planilha.apontamentos && (
            <div className="validation-card card-lite" style={{ marginTop: '20px', borderLeft: '4px solid #ef4444' }}>
              <h3 style={{ fontSize: '16px', color: '#ef4444', marginBottom: '10px' }}>
                <AlertCircle size={18} /> Notas de Revisão do Ecônomo
              </h3>
              <p style={{ padding: '12px', background: '#fff1f2', borderRadius: '8px', fontSize: '14px', border: '1px solid #fecaca' }}>
                {planilha.apontamentos}
              </p>
            </div>
          )}
        </>
      )}

      {/* ═══════════════ DEMONSTRATIVO DETALHADO ═══════════════ */}
      {viewMode === 'individual' && (
        <div style={{
          marginTop: '32px',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid #c7d2fe',
          boxShadow: '0 8px 32px -4px rgba(99,102,241,0.12), 0 2px 8px -2px rgba(99,102,241,0.08)',
          background: 'linear-gradient(135deg, #f5f3ff 0%, #eef2ff 100%)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(90deg, #03077fff 0%, #453bf2ff 100%)',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px' }}>
                <FileText size={20} color="#fff" />
              </div>
              <div>
                <div style={{ color: '#c7d2fe', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Relatório de Lançamentos</div>
                <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>Demonstrativo Financeiro</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '24px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#a5f3c3', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Total Receitas</div>
                <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>R$ {totals.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Total Despesas</div>
                <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>R$ {totals.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#c7d2fe', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Saldo</div>
                <div style={{ color: totals.saldo >= 0 ? '#a5f3c3' : '#fca5a5', fontSize: '18px', fontWeight: 800 }}>R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              </div>
            </div>
          </div>

          <div style={{ padding: '24px' }}>

            {/* ══ SEÇÃO — Lançamentos Individuais ══ */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <div style={{ width: '4px', height: '18px', background: 'linear-gradient(180deg,#03077f,#453bf2)', borderRadius: '2px' }} />
                <span style={{ fontWeight: 800, fontSize: '13px', color: '#312e81', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Lançamentos Individuais ({entryLogs.length})
                </span>
                <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>
                  — inseridos via campos de Receita / Despesa
                </span>
              </div>
              {entryLogs.length > 0 ? (
                <div style={{ borderRadius: '10px', overflow: 'hidden', border: '1px solid #c7d2fe' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(90deg,#03077fff,#453bf2ff)' }}>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tipo</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Categoria</th>
                        <th style={{ padding: '10px 14px', textAlign: 'left', color: '#c7d2fe', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Observação</th>
                        <th style={{ padding: '10px 14px', textAlign: 'center', color: '#c7d2fe', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Data / Hora</th>
                        <th style={{ padding: '10px 14px', textAlign: 'right', color: '#c7d2fe', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Valor (R$)</th>
                        {!isLocked && <th style={{ padding: '10px 10px', textAlign: 'center', color: '#c7d2fe', fontWeight: 700, fontSize: '10px' }}>Ação</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedEntryLogs.map((entry, idx) => (
                        <tr key={entry.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f5f3ff', borderBottom: '1px solid #e0e7ff' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '4px',
                              padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: 700,
                              background: entry.tipo === 'CREDITO' ? '#d1fae5' : '#fee2e2',
                              color: entry.tipo === 'CREDITO' ? '#065f46' : '#991b1b',
                            }}>
                              {entry.tipo === 'CREDITO' ? '▲ Receita' : '▼ Despesa'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#312e81', fontWeight: 600 }}>{entry.categoriaNome}</td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontStyle: entry.obs ? 'normal' : 'italic', maxWidth: '220px', wordBreak: 'break-word' }}>
                            {entry.obs || <span style={{ color: '#cbd5e1' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-block', background: '#ede9fe', color: '#5b21b6', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                              {entry.timestamp.toLocaleDateString('pt-BR')}
                            </span>
                            <span style={{ display: 'inline-block', background: '#f1f5f9', color: '#475569', padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, marginLeft: '4px' }}>
                              {entry.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 800, fontSize: '13px', color: entry.tipo === 'CREDITO' ? '#065f46' : '#991b1b' }}>
                            {entry.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          {!isLocked && (
                            <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                              <button
                                title="Excluir lançamento"
                                onClick={() => handleRemoveItem(entry.id)}
                                style={{ background: '#fee2e2', border: 'none', cursor: 'pointer', color: '#ef4444', fontWeight: 700, fontSize: '13px', lineHeight: 1, padding: '4px 8px', borderRadius: '6px', transition: 'all 0.2s' }}
                              >✕</button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', background: '#f5f3ff', borderRadius: '10px', border: '1px dashed #c7d2fe', fontSize: '12px', fontStyle: 'italic' }}>
                  Nenhum lançamento individual. Use os campos "Adicionar Receita / Despesa" acima.
                </div>
              )}
            </div>

            {/* ══ Resumo consolidado por categoria ══ */}
            {(() => {
              const receitaMap: Record<string, number> = {};
              const despesaMap: Record<string, number> = {};

              entryLogs.forEach(entry => {
                if (entry.tipo === 'CREDITO') {
                  receitaMap[entry.categoriaNome] = (receitaMap[entry.categoriaNome] || 0) + entry.valor;
                } else {
                  despesaMap[entry.categoriaNome] = (despesaMap[entry.categoriaNome] || 0) + entry.valor;
                }
              });

              const totalRec = Object.values(receitaMap).reduce((s, v) => s + v, 0);
              const totalDep = Object.values(despesaMap).reduce((s, v) => s + v, 0);
              const hasData = Object.keys(receitaMap).length > 0 || Object.keys(despesaMap).length > 0;

              if (!hasData) return null;
              return (
                <>
                  <div style={{ borderTop: '2px dashed #c7d2fe', marginBottom: '20px' }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <div style={{ width: '4px', height: '18px', background: 'linear-gradient(180deg,#059669,#dc2626)', borderRadius: '2px' }} />
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo Consolidado</span>
                    <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>— total por categoria</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ border: '1px solid #a7f3d0', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(90deg,#059669,#10b981)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={14} color="#fff" />
                        <span style={{ fontWeight: 800, fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receitas por Categoria</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#ecfdf5' }}>
                            <th style={{ padding: '6px 12px', textAlign: 'left', color: '#065f46', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Categoria</th>
                            <th style={{ padding: '6px 12px', textAlign: 'right', color: '#065f46', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(receitaMap).map(([nome, val]) => (
                            <tr key={nome} style={{ borderBottom: '1px solid #f0fdf4' }}>
                              <td style={{ padding: '7px 12px', color: '#334155' }}>{nome}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#065f46' }}>R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                          {Object.keys(receitaMap).length === 0 && (
                            <tr><td colSpan={2} style={{ padding: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Sem receitas</td></tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#ecfdf5', borderTop: '2px solid #6ee7b7' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#065f46' }}>TOTAL</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#065f46' }}>R$ {totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div style={{ border: '1px solid #fca5a5', borderRadius: '10px', overflow: 'hidden' }}>
                      <div style={{ background: 'linear-gradient(90deg,#dc2626,#ef4444)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingDown size={14} color="#fff" />
                        <span style={{ fontWeight: 800, fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas por Categoria</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                        <thead>
                          <tr style={{ background: '#fff1f2' }}>
                            <th style={{ padding: '6px 12px', textAlign: 'left', color: '#991b1b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Categoria</th>
                            <th style={{ padding: '6px 12px', textAlign: 'right', color: '#991b1b', fontWeight: 700, fontSize: '10px', textTransform: 'uppercase' }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(despesaMap).map(([nome, val]) => (
                            <tr key={nome} style={{ borderBottom: '1px solid #fef2f2' }}>
                              <td style={{ padding: '7px 12px', color: '#334155' }}>{nome}</td>
                              <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#991b1b' }}>R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                          {Object.keys(despesaMap).length === 0 && (
                            <tr><td colSpan={2} style={{ padding: '12px', color: '#94a3b8', fontStyle: 'italic', textAlign: 'center' }}>Sem despesas</td></tr>
                          )}
                        </tbody>
                        <tfoot>
                          <tr style={{ background: '#fff1f2', borderTop: '2px solid #fca5a5' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 800, color: '#991b1b' }}>TOTAL</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#991b1b' }}>R$ {totalDep.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanilhaMensal;
