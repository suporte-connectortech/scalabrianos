import React, { useState, useEffect, useMemo } from 'react';
import {
  Save, Loader2,
  Calendar, FileText, Download, TrendingUp, TrendingDown, Plus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from 'react-i18next';
import api, { getFileUrl } from '../../api';
import MonthPicker from '../Common/MonthPicker';

interface Categoria {
  id: number;
  codigo: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  perfil: string;
}

interface Item {
  categoria_id: number;
  valor: number;
}

interface EntryLog {
  id: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoriaId: number;
  categoriaNome: string;
  valor: number;
  obs: string;
  timestamp: Date;
}

const formatCurrencyMask = (raw: string): string => {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  const num = parseInt(digits, 10);
  return (num / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const parseMaskedCurrency = (masked: string): number => {
  const clean = masked.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const numToDigits = (n: number): string => {
  const cents = Math.round(n * 100);
  return cents > 0 ? cents.toString() : '';
};

interface PlanilhaData {
  id?: number;
  casa_id: number;
  mes_referencia: string;
  status: string;
  total_credito: number;
  total_debito: number;
  num_missas_superior: number;
  anexo_path: string | null;
  apontamentos_economo?: string;
  apontamentos_superior?: string;
  itens: Item[];
}

interface Props {
  casas: { id: number; nome: string }[];
  categorias: Categoria[];
  initialCasa?: string;
  initialMes?: string;
  externalUsuarioId?: number;
  onValidationComplete?: () => void;
}

const PlanilhaComunidade: React.FC<Props> = ({ casas, categorias, initialCasa, initialMes, externalUsuarioId, onValidationComplete }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [selectedMes, setSelectedMes] = useState(initialMes || new Date().toISOString().slice(0, 7));
  const [selectedCasa, setSelectedCasa] = useState(initialCasa || '');
  const [planilha, setPlanilha] = useState<PlanilhaData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, number>>({});
  const [numMissas, setNumMissas] = useState(0);
  const [anexoFile, setAnexoFile] = useState<File | null>(null);
  const [anexoUrl, setAnexoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [missionarySums, setMissionarySums] = useState<Record<number, number>>({});
  const [apontamentos, setApontamentos] = useState('');

  // Insertion form state
  const [tempReceitaCat, setTempReceitaCat] = useState('');
  const [tempReceitaVal, setTempReceitaVal] = useState('');
  const [tempDespesaCat, setTempDespesaCat] = useState('');
  const [tempDespesaVal, setTempDespesaVal] = useState('');
  const [obsReceita, setObsReceita] = useState('');
  const [obsDespesa, setObsDespesa] = useState('');
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

  useEffect(() => {
    if (user?.casa_id && !selectedCasa) {
      setSelectedCasa(user.casa_id.toString());
    }
  }, [user]);

  useEffect(() => {
    if (selectedCasa && selectedMes) {
      loadPlanilha();
    }
  }, [selectedCasa, selectedMes]);

  const isLocked = planilha?.status === 'APROVADO' || planilha?.status === 'ENVIADO_REGIONAL';

  const syncEditValuesFromLogs = (logs: EntryLog[]) => {
    const newVals: Record<number, number> = {};
    logs.forEach(log => {
      if (log.categoriaId) {
        newVals[log.categoriaId] = (newVals[log.categoriaId] || 0) + log.valor;
      }
    });
    setEditValues(newVals);
  };

  const isCategoryAllowed = (c: Categoria) => 
    c.codigo !== '35.1' && 
    !c.nome.toLowerCase().includes('remessas para a direção regional');

  const loadPlanilha = async () => {
    setIsLoading(true);
    try {
      const url = initialCasa && externalUsuarioId
        ? `/financas-comunidade/${selectedCasa}/${selectedMes}?usuario_id=${externalUsuarioId}`
        : `/financas-comunidade/${selectedCasa}/${selectedMes}`;
      const res = await api.get(url);
      if (res.data) {
        setPlanilha(res.data);
        const vals: Record<number, number> = {};
        const logs: EntryLog[] = [];
        (res.data.itens || []).forEach((it: any, idx: number) => {
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

        // Auto-import Saldo Anterior (Casa) from previous month if not already present in Casa draft
        const saldoAnteriorCat = categorias.find(c => 
          c.perfil === 'PERFIL_2' && 
          c.tipo === 'CREDITO' && 
          (c.codigo === '11.11' || c.nome.toLowerCase().includes('saldo anterior')) &&
          c.nome.toLowerCase().includes('saldo anterior')
        );

        const saldoCalc = parseFloat(res.data.saldo_anterior_calculado) || 0;
        const isLockedStatus = res.data.status === 'APROVADO' || res.data.status === 'ENVIADO_REGIONAL';
        if (saldoAnteriorCat && (!vals[saldoAnteriorCat.id] || vals[saldoAnteriorCat.id] === 0) && saldoCalc !== 0 && !isLockedStatus) {
          vals[saldoAnteriorCat.id] = saldoCalc;
          logs.unshift({
            id: `auto-saldo-anterior-casa-${Date.now()}`,
            tipo: 'CREDITO',
            categoriaId: saldoAnteriorCat.id,
            categoriaNome: saldoAnteriorCat.nome,
            valor: saldoCalc,
            obs: 'Saldo remanescente do mês anterior (Casa)',
            timestamp: new Date()
          });
        }

        setEditValues(vals);
        setEntryLogs(logs);
        setNumMissas(res.data.num_missas_superior || 0);
        setAnexoUrl(res.data.anexo_path || null);
        setMissionarySums(res.data.missionarySums || {});
        setApontamentos(res.data.apontamentos_economo || res.data.apontamentos_superior || '');
      } else {
        setPlanilha(null);
        setEditValues({});
        setEntryLogs([]);
        setNumMissas(0);
        setAnexoUrl(null);
        setMissionarySums({});
        setApontamentos('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateCommunity = async (newStatus: 'APROVADO' | 'DEVOLVIDO_SUPERIOR') => {
    if (!planilha?.id) return;
    try {
      await api.put(`/financas-comunidade/${planilha.id}/validar`, {
        status: newStatus,
        apontamentos: apontamentos
      });
      alert(newStatus === 'APROVADO' ? 'Prestação de contas aprovada com sucesso!' : 'Prestação de contas devolvida para ajustes!');
      if (onValidationComplete) {
        onValidationComplete();
      } else {
        loadPlanilha();
      }
    } catch (err: any) {
      alert('Erro ao processar validação: ' + (err.response?.data?.message || err.message));
    }
  };

  const calculateTotals = () => {
    let cre = 0;
    let deb = 0;
    categorias.filter(c => c.perfil === 'PERFIL_2' && isCategoryAllowed(c)).forEach(cat => {
      const houseVal = editValues[cat.id] || 0;
      const missVal = missionarySums[cat.id] || 0;
      const val = houseVal + missVal;
      if (cat.tipo === 'CREDITO') cre += val;
      else deb += val;
    });
    return { credito: cre, debito: deb, saldo: cre - deb };
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

    if (tipo === 'CREDITO') {
      setTempReceitaCat('');
      setTempReceitaVal('');
      setObsReceita('');
    } else {
      setTempDespesaCat('');
      setTempDespesaVal('');
      setObsDespesa('');
    }
  };

  const handleRemoveItem = (entryId: string) => {
    const updatedLogs = entryLogs.filter(e => e.id !== entryId);
    setEntryLogs(updatedLogs);
    syncEditValuesFromLogs(updatedLogs);
  };

  const handleSave = async () => {
    if (!selectedMes) {
      alert('Por favor, selecione o Mês/Ano de referência antes de salvar.');
      return;
    }
    if (!selectedCasa) return alert('Selecione uma casa.');
    setIsSaving(true);

    let finalAnexoPath = anexoUrl;
    if (anexoFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('arquivo', anexoFile);
      formData.append('descricao', `Recibo Comunidade ${selectedMes}`);
      try {
        const upRes = await api.post(`/usuarios/${user?.id}/documentos`, formData);
        finalAnexoPath = upRes.data.arquivo_path;
      } catch {
        alert('Erro no upload do anexo.');
      } finally {
        setIsUploading(false);
      }
    }

    const totals = calculateTotals();
    const payload = {
      casa_id: parseInt(selectedCasa),
      mes_referencia: selectedMes,
      total_credito: totals.credito,
      total_debito: totals.debito,
      num_missas_superior: numMissas,
      anexo_path: finalAnexoPath,
      status: planilha?.status || 'PENDENTE_ECÔNOMO',
      itens: entryLogs.map(log => ({
        categoria_id: log.categoriaId,
        valor: log.valor,
        observacao: log.obs
      }))
    };

    try {
      await api.post('/financas-comunidade', payload);
      alert(t('common.save') + '!');
      loadPlanilha();
    } catch (err) {
      alert(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendToRegional = async () => {
    if (!selectedMes) {
      alert('Por favor, selecione o Mês/Ano de referência antes de enviar.');
      return;
    }
    if (!window.confirm('Deseja enviar esta prestação de contas para o Ecônomo Regional? Após o envio, ela não poderá mais ser editada.')) {
      return;
    }
    setIsSaving(true);

    let finalAnexoPath = anexoUrl;

    if (anexoFile) {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('arquivo', anexoFile);
      formData.append('descricao', `Recibo Casa ${selectedMes}`);
      try {
        const upRes = await api.post(`/usuarios/${user?.id}/documentos`, formData);
        finalAnexoPath = upRes.data.arquivo_path;
      } catch {
        alert('Erro no upload do anexo. O envio será realizado sem o anexo.');
      } finally {
        setIsUploading(false);
      }
    }

    const totals = calculateTotals();
    const payload = {
      casa_id: parseInt(selectedCasa),
      mes_referencia: selectedMes,
      total_credito: totals.credito,
      total_debito: totals.debito,
      num_missas_superior: numMissas,
      anexo_path: finalAnexoPath,
      status: 'ENVIADO_REGIONAL',
      itens: entryLogs.map(log => ({
        categoria_id: log.categoriaId,
        valor: log.valor,
        observacao: log.obs
      }))
    };

    try {
      await api.post('/financas-comunidade', payload);
      alert('Prestação de contas enviada com sucesso para o Ecônomo Regional!');
      loadPlanilha();
    } catch (err) {
      alert(t('common.error'));
    } finally {
      setIsSaving(false);
    }
  };

  const exportToExcel = () => {
    const totals = calculateTotals();
    const casaNome = casas.find(c => String(c.id) === selectedCasa)?.nome || 'Comunidade';

    // Build the sheet data
    const rows: any[] = [];
    rows.push(['PRESTAÇÃO DE CONTAS MENSAL - COMUNIDADE']);
    rows.push([`Casa: ${casaNome}`]);
    rows.push([`Mês: ${selectedMes}`]);
    rows.push([]);

    // Headers
    rows.push(['CÓDIGO', 'RECEITAS', 'CASA (R$)', 'MISSIO. (R$)', 'TOTAL (R$)', '', 'CÓDIGO', 'DESPESAS', 'CASA (R$)', 'MISSIO. (R$)', 'TOTAL (R$)']);

    const receitas = categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c));
    const despesas = categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c));
    const maxLength = Math.max(receitas.length, despesas.length + 2); // +2 for totals/missas

    for (let i = 0; i < maxLength; i++) {
      const rec = receitas[i];
      const dep = despesas[i];

      const recHouse = rec ? (editValues[rec.id] || 0) : 0;
      const recMiss = rec ? (missionarySums[rec.id] || 0) : 0;
      const recTot = recHouse + recMiss;

      const depHouse = dep ? (editValues[dep.id] || 0) : 0;
      const depMiss = dep ? (missionarySums[dep.id] || 0) : 0;
      const depTot = depHouse + depMiss;

      const row = [
        rec ? String(rec.codigo || '') : '',
        rec ? String(rec.nome || '') : '',
        rec ? recHouse : '',
        rec ? recMiss : '',
        rec ? recTot : '',
        '',
        dep ? String(dep.codigo || '') : '',
        dep ? String(dep.nome || '') : '',
        dep ? depHouse : '',
        dep ? depMiss : '',
        dep ? depTot : ''
      ];

      // Add extra rows for totals/missas at the end of despesas column
      if (i === despesas.length) {
        row[6] = '50';
        row[7] = 'SUPERÁVIT / DÉFICIT';
        row[8] = '';
        row[9] = '';
        row[10] = totals.saldo;
      } else if (i === despesas.length + 1) {
        row[6] = '70';
        row[7] = 'MISSAS CELEBRADAS';
        row[8] = '';
        row[9] = '';
        row[10] = numMissas;
      }

      rows.push(row);
    }

    rows.push([]);
    rows.push(['', 'TOTAL RECEITAS:', '', '', totals.credito, '', '', 'TOTAL DESPESAS:', '', '', totals.debito]);
    rows.push(['', '', '', '', '', '', '', 'SALDO:', '', '', totals.saldo]);

    const ws = XLSX.utils.aoa_to_sheet(rows);

    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 5 }, { wch: 10 }, { wch: 32 }, { wch: 14 }, { wch: 14 }, { wch: 14 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Comunidade');
    XLSX.writeFile(wb, `Comunidade_${casaNome.replace(' ', '_')}_${selectedMes}.xlsx`);
  };

  const totals = calculateTotals();

  return (
    <div className="planilha-mensal-content">
      {!initialCasa && (
        <div className="filters-card">
          <div className="filters-grid-premium">
            <div className="filter-item">
              <label><Calendar size={14} /> {t('planilha.month_year', 'Mês/Ano')}</label>
              <MonthPicker value={selectedMes} onChange={setSelectedMes} />
            </div>
            <div className="filter-item">
              <label>{t('planilha.community', 'Comunidade Religiosa')}</label>
              <select value={selectedCasa} onChange={e => setSelectedCasa(e.target.value)}>
                <option value="">{t('planilha.select_house')}</option>
                {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="filter-item">
              <label>{t('planilha.actions', 'Ações')}</label>
              <button className="btn-export-small" onClick={exportToExcel} style={{ width: '100%', height: '40px', justifyContent: 'center' }}>
                <Download size={16} /> {t('financeiro.actions.export')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="spreedsheet-container card-lite" style={{ padding: '30px', marginTop: '20px' }}>
        <div className="spreedsheet-header" style={{ marginBottom: '30px', borderBottom: '2px solid #013375', paddingBottom: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div className="header-info">
            <h3 style={{ fontSize: '1.6rem', fontWeight: 900, color: '#013375', margin: 0 }}>Prestação de Contas MENSAL - Casa Religiosa</h3>
            <div style={{ display: 'flex', gap: '30px', marginTop: '10px', fontSize: '0.95rem', alignItems: 'center' }}>
              <p style={{ margin: 0, color: '#64748b', fontWeight: 500 }}>Preenchimento pelo ecônomo ou superior local.</p>
              {planilha && (
                <span className={`status-tag ${(planilha.status || '').toLowerCase()}`} style={{
                  padding: '4px 10px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  background: planilha.status === 'ENVIADO_REGIONAL' ? '#dbeafe' : planilha.status === 'APROVADO' ? '#d1fae5' : '#fef3c7',
                  color: planilha.status === 'ENVIADO_REGIONAL' ? '#1e40af' : planilha.status === 'APROVADO' ? '#065f46' : '#d97706',
                }}>
                  {planilha.status === 'ENVIADO_REGIONAL' ? 'Enviado ao Regional' : planilha.status?.replace('_', ' ') || 'PENDENTE ECÔNOMO'}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <button
              className="btn-export-small"
              onClick={exportToExcel}
              style={{
                background: '#10b981',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                border: 'none',
                fontSize: '13px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}
            >
              <Download size={18} /> Exportar Excel
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}><Loader2 className="animate-spin" size={40} /></div>
        ) : (
          <>
            {!isLocked && (
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
                      onChange={e => setTempReceitaCat(e.target.value)}
                    >
                      <option value="">Selecione a categoria...</option>
                      {categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c)).map(c => (
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
                      <Plus size={16} /> Adicionar Receita
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
                      onChange={e => setTempDespesaCat(e.target.value)}
                    >
                      <option value="">Selecione a categoria...</option>
                      {categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c)).map(c => (
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
                      <Plus size={16} /> Adicionar Despesa
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="spreadsheet-grid">
              {/* RECEITAS */}
              <div className="spreadsheet-column">
                <h4 className="column-title credito">
                  <TrendingUp size={18} /> {t('planilha.receitas')}
                </h4>
                <div className="spreadsheet-subtable-container">
                  <div className="spreadsheet-subtable">
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
                        <div style={{ width: '50px' }}>CÓD.</div>
                        <div style={{ flex: 1 }}>DESCRIÇÃO</div>
                        <div style={{ width: '90px', textAlign: 'right' }}>CASA (R$)</div>
                        <div style={{ width: '90px', textAlign: 'right' }}>MISSIO. (R$)</div>
                        <div style={{ width: '95px', textAlign: 'right' }}>TOTAL (R$)</div>
                      </div>
                    </div>
                    <div style={{ padding: '2px 0' }}>
                      {categorias.filter(c => c.tipo === 'CREDITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c)).map(cat => {
                        const houseVal = editValues[cat.id] || 0;
                        const missVal = missionarySums[cat.id] || 0;
                        const totalVal = houseVal + missVal;
                        return (
                          <div key={cat.id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#fff', fontSize: '12px', alignItems: 'center', padding: '6px 12px' }}>
                            <div style={{ width: '50px', fontWeight: 700, color: '#166534' }}>{cat.codigo}</div>
                            <div style={{ flex: 1, color: '#334155', paddingRight: '10px' }}>{cat.nome}</div>

                            {/* Casa */}
                            <div style={{ width: '90px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', width: '80px' }}>
                                <input
                                  type="text"
                                  placeholder="0,00"
                                  value={formatCurrencyMask(numToDigits(houseVal))}
                                  readOnly
                                  disabled
                                  style={{ textAlign: 'right', border: 'none', background: 'transparent', width: '100%', fontWeight: 600, fontSize: '11px', color: '#475569', cursor: 'not-allowed' }}
                                />
                              </div>
                            </div>

                            {/* Missionários */}
                            <div style={{ width: '90px', textAlign: 'right', color: '#64748b', fontWeight: 500, fontSize: '11px', paddingRight: '8px' }}>
                              {missVal > 0 ? `R$ ${missVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>

                            {/* Total */}
                            <div style={{ width: '95px', textAlign: 'right', fontWeight: 700, color: '#166534', fontSize: '11px' }}>
                              R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#f0fdf4', padding: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid #bcf0da', color: '#166534', marginTop: 'auto' }}>
                  <span>TOTAL RECEITAS</span>
                  <span>R$ {totals.credito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              {/* DESPESAS */}
              <div className="spreadsheet-column">
                <h4 className="column-title debito">
                  <TrendingDown size={18} /> {t('planilha.despesas')}
                </h4>
                <div className="spreadsheet-subtable-container">
                  <div className="spreadsheet-subtable">
                    <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <div style={{ display: 'flex', padding: '8px 12px', fontSize: '10px', fontWeight: 800, color: '#64748b' }}>
                        <div style={{ width: '50px' }}>CÓD.</div>
                        <div style={{ flex: 1 }}>DESCRIÇÃO</div>
                        <div style={{ width: '90px', textAlign: 'right' }}>CASA (R$)</div>
                        <div style={{ width: '90px', textAlign: 'right' }}>MISSIO. (R$)</div>
                        <div style={{ width: '95px', textAlign: 'right' }}>TOTAL (R$)</div>
                      </div>
                    </div>
                    <div style={{ padding: '2px 0' }}>
                      {categorias.filter(c => c.tipo === 'DEBITO' && c.perfil === 'PERFIL_2' && isCategoryAllowed(c)).map(cat => {
                        const houseVal = editValues[cat.id] || 0;
                        const missVal = missionarySums[cat.id] || 0;
                        const totalVal = houseVal + missVal;
                        return (
                          <div key={cat.id} style={{ display: 'flex', borderBottom: '1px solid #f1f5f9', background: '#fff', fontSize: '12px', alignItems: 'center', padding: '6px 12px' }}>
                            <div style={{ width: '50px', fontWeight: 700, color: '#991b1b' }}>{cat.codigo}</div>
                            <div style={{ flex: 1, color: '#334155', paddingRight: '10px' }}>{cat.nome}</div>

                            {/* Casa */}
                            <div style={{ width: '90px', textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '2px 6px', width: '80px' }}>
                                <input
                                  type="text"
                                  placeholder="0,00"
                                  value={formatCurrencyMask(numToDigits(houseVal))}
                                  readOnly
                                  disabled
                                  style={{ textAlign: 'right', border: 'none', background: 'transparent', width: '100%', fontWeight: 600, fontSize: '11px', color: '#475569', cursor: 'not-allowed' }}
                                />
                              </div>
                            </div>

                            {/* Missionários */}
                            <div style={{ width: '90px', textAlign: 'right', color: '#64748b', fontWeight: 500, fontSize: '11px', paddingRight: '8px' }}>
                              {missVal > 0 ? `R$ ${missVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                            </div>

                            {/* Total */}
                            <div style={{ width: '95px', textAlign: 'right', fontWeight: 700, color: '#991b1b', fontSize: '11px' }}>
                              R$ {totalVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div style={{ background: '#fef2f2', padding: '12px', display: 'flex', justifyContent: 'space-between', fontWeight: 800, borderTop: '2px solid #fecaca', color: '#991b1b', marginTop: 'auto' }}>
                  <span>TOTAL DESPESAS</span>
                  <span>R$ {totals.debito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>

                <div style={{ padding: '15px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 800, fontSize: '13px', color: '#334155' }}>SUPERÁVIT / DÉFICIT (= 30 - 40)</span>
                    <strong style={{ fontSize: '16px', color: totals.saldo >= 0 ? '#166534' : '#991b1b' }}>
                      R$ {totals.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: '#475569' }}>Missas celebradas ad mentem Superioris n.º</span>
                    <input
                      type="number"
                      value={numMissas}
                      onChange={e => setNumMissas(parseInt(e.target.value) || 0)}
                      style={{ width: '70px', padding: '6px', borderRadius: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 800, background: '#fff' }}
                      disabled={isLocked}
                    />
                  </div>
                </div>
              </div>
            </div>


            {!initialCasa ? (
              <div className="spreadsheet-summary" style={{ marginTop: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="file"
                    id="anexo-comunidade"
                    style={{ display: 'none' }}
                    onChange={e => setAnexoFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="anexo-comunidade" className="btn-save" style={{ cursor: isLocked ? 'not-allowed' : 'pointer', opacity: isLocked ? 0.5 : 1, pointerEvents: isLocked ? 'none' : 'auto', background: '#013375', color: 'white', border: 'none', height: '38px', padding: '0 20px', margin: 0, borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                    <FileText size={18} /> {anexoFile ? anexoFile.name : (anexoUrl ? t('planilha.replace_files') : t('planilha.attach_files'))}
                  </label>
                  {anexoUrl && (
                    <a href={getFileUrl(anexoUrl) || '#'} target="_blank" rel="noreferrer" className="btn-icon-view" title="Ver Anexo">
                      <FileText size={20} />
                    </a>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {(!planilha || (planilha.status !== 'APROVADO' && planilha.status !== 'ENVIADO_REGIONAL')) && (
                    <>
                      <button
                        className="btn-save"
                        onClick={handleSave}
                        disabled={isSaving || isUploading}
                        style={{ background: '#64748b', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar Rascunho
                      </button>
                      <button
                        className="btn-save"
                        onClick={handleSendToRegional}
                        disabled={isSaving || isUploading}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '10px 24px', borderRadius: '8px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.3)' }}
                      >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Enviar para o Regional
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {anexoUrl && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <a
                      href={getFileUrl(anexoUrl) || '#'}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-save"
                      style={{ background: '#013375', color: 'white', textDecoration: 'none', height: '38px', padding: '0 20px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}
                    >
                      <FileText size={18} /> Ver Recibos Anexados
                    </a>
                  </div>
                )}

                {planilha && planilha.status === 'ENVIADO_REGIONAL' ? (
                  <div className="validation-bar card-lite" style={{ padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 800, color: '#013375' }}>Feedback / Apontamentos para a Casa Religiosa</h4>
                    <textarea
                      placeholder="Descreva o motivo da devolução, caso haja correções a fazer..."
                      value={apontamentos}
                      onChange={e => setApontamentos(e.target.value)}
                      style={{ width: '100%', minHeight: '80px', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', marginBottom: '16px', fontSize: '13px', outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <button
                        onClick={() => handleValidateCommunity('APROVADO')}
                        style={{ background: '#10b981', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        Aprovar Prestação
                      </button>
                      <button
                        onClick={() => handleValidateCommunity('DEVOLVIDO_SUPERIOR')}
                        style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '12px 24px', borderRadius: '8px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                      >
                        Devolver para Ajustes
                      </button>
                    </div>
                  </div>
                ) : (
                  planilha && (
                    <div style={{ padding: '15px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#475569' }}>
                        Status da Prestação: <span style={{ textTransform: 'uppercase', color: planilha.status === 'APROVADO' ? '#10b981' : '#ef4444' }}>{planilha.status === 'DEVOLVIDO_SUPERIOR' ? 'DEVOLVIDO' : planilha.status}</span>
                      </p>
                      {apontamentos && (
                        <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#64748b' }}>
                          <strong>Apontamentos:</strong> {apontamentos}
                        </p>
                      )}
                    </div>
                  )
                )}
              </div>
            )}

            {/* ═══════════════ DEMONSTRATIVO DETALHADO ═══════════════ */}
            {(() => {
              const receitaMap: Record<string, number> = {};
              const despesaMap: Record<string, number> = {};

              // From individual logs (community values)
              entryLogs.filter(e => e.tipo === 'CREDITO').forEach(e => {
                receitaMap[e.categoriaNome] = (receitaMap[e.categoriaNome] || 0) + e.valor;
              });
              entryLogs.filter(e => e.tipo === 'DEBITO').forEach(e => {
                despesaMap[e.categoriaNome] = (despesaMap[e.categoriaNome] || 0) + e.valor;
              });

              // Plus Missionary sums (missionary values)
              categorias.filter(c => c.perfil === 'PERFIL_2').forEach(c => {
                const missVal = missionarySums[c.id] || 0;
                if (missVal > 0) {
                  if (c.tipo === 'CREDITO') {
                    receitaMap[c.nome] = (receitaMap[c.nome] || 0) + missVal;
                  } else {
                    despesaMap[c.nome] = (despesaMap[c.nome] || 0) + missVal;
                  }
                }
              });

              const totalRec = Object.values(receitaMap).reduce((s, v) => s + v, 0);
              const totalDep = Object.values(despesaMap).reduce((s, v) => s + v, 0);
              const totalSaldo = totalRec - totalDep;
              const hasData = entryLogs.length > 0 || Object.keys(missionarySums).some(id => missionarySums[parseInt(id)] > 0);

              if (!hasData) return null;
              return (
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
                        <div style={{ color: '#fff', fontSize: '16px', fontWeight: 800 }}>Demonstrativo da Comunidade</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '24px' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#a5f3c3', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Total Receitas</div>
                        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>R$ {totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#fca5a5', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Total Despesas</div>
                        <div style={{ color: '#fff', fontSize: '18px', fontWeight: 800 }}>R$ {totalDep.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                      <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#c7d2fe', fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>Saldo</div>
                        <div style={{ color: totalSaldo >= 0 ? '#a5f3c3' : '#fca5a5', fontSize: '18px', fontWeight: 800 }}>R$ {totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ padding: '24px' }}>

                    {/* ══ SEÇÃO 2 — Lançamentos Individuais ══ */}
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
                                <th style={{ padding: '10px 10px', textAlign: 'center', color: '#c7d2fe', fontWeight: 700, fontSize: '10px' }}></th>
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
                                  <td style={{ padding: '10px 10px', textAlign: 'center' }}>
                                    {!isLocked && (
                                      <button
                                        title="Remover lançamento"
                                        onClick={() => handleRemoveItem(entry.id)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a5b4fc', fontSize: '14px', lineHeight: 1, padding: '2px 4px', borderRadius: '4px' }}
                                      >✕</button>
                                    )}
                                  </td>
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

                    {/* Divisor */}
                    <div style={{ borderTop: '2px dashed #c7d2fe', marginBottom: '24px' }} />

                    {/* ══ Resumo consolidado (planilha + individuais) ══ */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                      <div style={{ width: '4px', height: '18px', background: 'linear-gradient(180deg,#059669,#dc2626)', borderRadius: '2px' }} />
                      <span style={{ fontWeight: 800, fontSize: '13px', color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resumo Consolidado</span>
                      <span style={{ marginLeft: '8px', fontSize: '10px', fontWeight: 600, color: '#94a3b8', fontStyle: 'italic' }}>— planilha + lançamentos individuais</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div style={{ border: '1px solid #a7f3d0', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg,#059669,#10b981)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TrendingUp size={14} color="#fff" />
                          <span style={{ fontWeight: 800, fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receitas da Casa</span>
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
                              <tr><td colSpan={2} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma receita lançada.</td></tr>
                            )}
                          </tbody>
                          <tfoot style={{ background: '#d1fae5', borderTop: '2px solid #a7f3d0' }}>
                            <tr>
                              <td style={{ padding: '8px 12px', fontWeight: 800, color: '#065f46', fontSize: '11px' }}>TOTAL</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#065f46' }}>R$ {totalRec.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div style={{ border: '1px solid #fecaca', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ background: 'linear-gradient(90deg,#dc2626,#ef4444)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <TrendingDown size={14} color="#fff" />
                          <span style={{ fontWeight: 800, fontSize: '11px', color: '#fff', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Despesas da Casa</span>
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', background: '#fff' }}>
                          <thead>
                            <tr style={{ background: '#fef2f2' }}>
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
                              <tr><td colSpan={2} style={{ padding: '10px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>Nenhuma despesa lançada.</td></tr>
                            )}
                          </tbody>
                          <tfoot style={{ background: '#fee2e2', borderTop: '2px solid #fecaca' }}>
                            <tr>
                              <td style={{ padding: '8px 12px', fontWeight: 800, color: '#991b1b', fontSize: '11px' }}>TOTAL</td>
                              <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 800, color: '#991b1b' }}>R$ {totalDep.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
};

export default PlanilhaComunidade;
