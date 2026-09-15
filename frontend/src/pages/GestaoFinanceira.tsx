import React, { useState, useEffect } from 'react';
import { BarChart3, Download, CheckCircle, XCircle, FileText, AlertCircle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../api';
import { isHiddenTestUser } from '../utils/userFilter';
import { useAuth } from '../context/AuthContext';
import MonthPicker from '../components/Common/MonthPicker';
import '../styles/Relatorios.css';
import '../styles/FinanceiroSpreadsheet.css';

interface Casa {
  id: number;
  nome: string;
}

interface Missionario {
  id?: number;
  usuario_id: number;
  usuario_nome: string;
  total_credito: number;
  total_debito: number;
  mes_referencia: string;
  status: string;
}

interface MissionarioOption {
  id: number;
  nome: string;
}

interface ConsolidadoStatus {
  status: string;
  apontamentos_economo?: string;
  apontamentos_superior?: string;
}

const GestaoFinanceira: React.FC = () => {
  const { user, isAdminGeral, isOconomo, isSuperior, userRole, canEdit } = useAuth();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMes, setSelectedMes] = useState(currentMonth);
  const [selectedCasa, setSelectedCasa] = useState('');
  const [casas, setCasas] = useState<Casa[]>([]);
  const [missionarios, setMissionarios] = useState<Missionario[]>([]);
  const [filteredMissionarios, setFilteredMissionarios] = useState<Missionario[]>([]);
  const [consolidadoStatus, setConsolidadoStatus] = useState<ConsolidadoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  // Missionary autocomplete
  const [allMissionarios, setAllMissionarios] = useState<MissionarioOption[]>([]);
  const [searchMissionario, setSearchMissionario] = useState('');
  const [selectedMissionarioId, setSelectedMissionarioId] = useState<number | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownOptions, setDropdownOptions] = useState<MissionarioOption[]>([]);

  const [showDetails, setShowDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [categorias, setCategorias] = useState<any[]>([]);

  const [apontamentosEconomo, setApontamentosEconomo] = useState('');
  const [apontamentosSuperior, setApontamentosSuperior] = useState('');

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [casasRes, misRes, catsRes] = await Promise.all([
          api.post('/casas-religiosas/get'),
          api.get('/usuarios'),
          api.get('/categorias-financas')
        ]);
        setCasas(casasRes.data);
        setCategorias(catsRes.data);
        // Only active missionaries (PADRE role, status ATIVO)
        const ativos: MissionarioOption[] = (misRes.data || [])
          .filter((u: any) => u.role === 'PADRE' && u.status === 'ATIVO' && !isHiddenTestUser(u.login))
          .map((u: any) => ({ id: u.id, nome: u.nome }))
          .sort((a: MissionarioOption, b: MissionarioOption) => a.nome.localeCompare(b.nome));
        setAllMissionarios(ativos);
        if (user?.casa_id && !isAdminGeral) {
          setSelectedCasa(user.casa_id.toString());
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadInitialData();
  }, [user, isAdminGeral]);

  useEffect(() => {
    if (selectedCasa && selectedMes) {
      loadConsolidado();
      loadConsolidadoStatus();
    } else {
      setMissionarios([]);
      setFilteredMissionarios([]);
    }
  }, [selectedCasa, selectedMes]);

  // When table data changes, re-apply missionary filter
  useEffect(() => {
    const isCommon = !isAdminGeral && !isOconomo && !isSuperior;
    if (isCommon && user?.id) {
      setFilteredMissionarios(missionarios.filter(m => m.usuario_id === user.id));
    } else if (selectedMissionarioId) {
      const target = allMissionarios.find(m => m.id === selectedMissionarioId);
      setFilteredMissionarios(
        missionarios.filter(m => m.usuario_id === selectedMissionarioId)
      );
      setSearchMissionario(target?.nome || '');
    } else {
      setFilteredMissionarios(missionarios);
    }
  }, [missionarios, selectedMissionarioId, isAdminGeral, isOconomo, isSuperior, user]);

  // Autocomplete dropdown filtering
  const handleSearchChange = (val: string) => {
    setSearchMissionario(val);
    setSelectedMissionarioId(null);
    if (val.trim() === '') {
      setShowDropdown(false);
      setDropdownOptions([]);
      setFilteredMissionarios(missionarios);
      return;
    }
    const term = val.toLowerCase();
    const matches = allMissionarios.filter(m =>
      m.nome.toLowerCase().includes(term)
    );
    setDropdownOptions(matches);
    setShowDropdown(true);
    // Also filter the table loosely while typing
    setFilteredMissionarios(
      missionarios.filter(m => (m.usuario_nome || '').toLowerCase().includes(term))
    );
  };

  const handleSelectMissionario = (m: MissionarioOption) => {
    setSearchMissionario(m.nome);
    setSelectedMissionarioId(m.id);
    setShowDropdown(false);
    setFilteredMissionarios(
      missionarios.filter(row => row.usuario_id === m.id)
    );
  };

  const handleClearMissionario = () => {
    setSearchMissionario('');
    setSelectedMissionarioId(null);
    setShowDropdown(false);
    setFilteredMissionarios(missionarios);
  };

  const loadConsolidado = async () => {
    const isCommon = !isAdminGeral && !isOconomo && !isSuperior;
    setIsLoading(true);
    try {
      if (isCommon) {
        // Common missionary history
        const res = await api.get(`/financas-mensais/usuario/${user?.id}/historico`);
        setMissionarios(res.data || []);
      } else {
        if (!selectedCasa) return;
        const res = await api.get(`/financas-mensais/consolidado/casa/${selectedCasa}/mes/${selectedMes}`);
        setMissionarios(res.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConsolidadoStatus = async () => {
    try {
      const res = await api.get(`/financas-casa/consolidado/status/${selectedCasa}/${selectedMes}`);
      setConsolidadoStatus(res.data);
      setApontamentosEconomo(res.data?.apontamentos_economo || '');
      setApontamentosSuperior(res.data?.apontamentos_superior || '');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedCasa) return;
    setIsSavingStatus(true);
    try {
      await api.put(`/financas-casa/consolidado/status/${selectedCasa}/${selectedMes}`, {
        status: newStatus,
        apontamentos_economo: apontamentosEconomo || undefined,
        apontamentos_superior: apontamentosSuperior || undefined
      });
      alert('Status atualizado com sucesso!');
      loadConsolidadoStatus();
    } catch (err) {
      alert('Erro ao atualizar status.');
    } finally {
      setIsSavingStatus(true);
      loadConsolidado(); // Refresh table to get spreadsheet IDs
      setIsSavingStatus(false);
    }
  };

  const handleValidarIndividual = async (spreadsheetId: number, status: 'VALIDADO' | 'DEVOLVIDO') => {
    let msg = '';
    if (status === 'DEVOLVIDO') {
      msg = prompt('Por favor, descreva o motivo da devolução:') || '';
      if (!msg) return alert('É necessário um motivo para devolver a planilha.');
    } else {
      if (!window.confirm('Confirmar validação desta planilha?')) return;
    }

    try {
      await api.put(`/financas-mensais/${spreadsheetId}/validar`, { status, apontamentos: msg });
      alert(`Planilha ${status === 'VALIDADO' ? 'validada' : 'devolvida'} com sucesso!`);
      loadConsolidado();
    } catch (err: any) {
      alert('Erro ao validar: ' + (err.response?.data?.message || err.message));
    }
  };

  // Debug roles (internal only)
  useEffect(() => {
    console.log('GestaoFinanceira Roles:', { isAdminGeral, isOconomo, isSuperior, userRole, canEdit });
  }, [isAdminGeral, isOconomo, isSuperior, userRole, canEdit]);

  const canValidate = isAdminGeral || isOconomo || isSuperior || (userRole === 'ADMINISTRADOR');

  const loadDetails = async (m: Missionario) => {
    if (!m.id && !m.usuario_id) return;
    setDetailsLoading(true);
    try {
      const res = await api.get(`/financas-mensais/usuario/${m.usuario_id}/mes/${m.mes_referencia}`);
      setShowDetails(res.data);
    } catch {
      alert('Erro ao carregar detalhes');
    } finally {
      setDetailsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (filteredMissionarios.length === 0) return;
    const casaNome = casas.find(c => String(c.id) === selectedCasa)?.nome || 'Casa';
    const data = filteredMissionarios.map(m => ({
      'Missionário': m.usuario_nome,
      'Mês': m.mes_referencia,
      'Status': m.status,
      'Total Créditos (R$)': m.total_credito,
      'Total Débitos (R$)': m.total_debito,
      'Saldo (R$)': m.total_credito - m.total_debito
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Gestão Financeira');
    XLSX.writeFile(wb, `Gestao_${casaNome}_${selectedMes}.xlsx`);
  };

  const totalCredito = filteredMissionarios.reduce((s, m) => s + Number(m.total_credito), 0);
  const totalDebito = filteredMissionarios.reduce((s, m) => s + Number(m.total_debito), 0);
  const totalSaldo = totalCredito - totalDebito;

  const statusLabel = (s: string) => s?.replace(/_/g, ' ') || 'PENDENTE ECÔNOMO';
  const allValidated = missionarios.length > 0 && missionarios.every(m => (m.status || '').trim().toUpperCase() === 'VALIDADO');

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <BarChart3 size={24} />
          <h2>Registros Financeiros</h2>
        </div>
        <div className="header-actions">
          <button className="btn-export" onClick={exportToExcel} disabled={filteredMissionarios.length === 0}>
            <Download size={18} /> Exportar Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-card-simple">
        <div className="filters-row">
          <div className="filter-field">
            <label>Mês de Referência</label>
            <MonthPicker value={selectedMes} onChange={setSelectedMes} />
          </div>
          <div className="filter-field">
            <label>Casa Religiosa</label>
            <select
              value={selectedCasa}
              onChange={e => setSelectedCasa(e.target.value)}
              disabled={!isAdminGeral && !!user?.casa_id}
            >
              <option value="">Selecione...</option>
              {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
          <div className="filter-field search-missionary-field">
            <label>Missionário</label>
            <div className="autocomplete-wrapper">
              <input
                type="text"
                placeholder="Pesquisar missionário..."
                value={searchMissionario}
                onChange={e => handleSearchChange(e.target.value)}
                onFocus={() => {
                  if (searchMissionario.trim() === '') {
                    setDropdownOptions(allMissionarios);
                    setShowDropdown(true);
                  }
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                autoComplete="off"
              />
              {searchMissionario && <button className="clear-search" onClick={handleClearMissionario}>✕</button>}
              {showDropdown && dropdownOptions.length > 0 && (
                <div className="autocomplete-dropdown">
                  {dropdownOptions.map(m => (
                    <div key={m.id} className="dropdown-item" onMouseDown={() => handleSelectMissionario(m)}>
                      {m.nome}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Consolidado Status Card - Hide for common missionaries */}
      {selectedCasa && (isAdminGeral || isOconomo || isSuperior) && (
        <div className="card-lite" style={{ marginBottom: '20px', borderTop: '4px solid #6366f1', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
            <div>
              <h3 style={{ margin: 0 }}>Fechamento Mensal da Casa</h3>
              <p style={{ margin: '5px 0 0', opacity: 0.7, fontSize: '14px' }}>
                {casas.find(c => String(c.id) === selectedCasa)?.nome} — {selectedMes}
              </p>
            </div>
            <span className={`status-tag ${(consolidadoStatus?.status || '').toLowerCase()}`}>
              {statusLabel(consolidadoStatus?.status || '')}
            </span>
          </div>

          {/* Workflow actions */}
          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {isOconomo && consolidadoStatus?.status === 'PENDENTE_ECONOMO' && (
              <>
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>
                    Notas do Ecônomo (opcional):
                  </label>
                  <textarea
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    value={apontamentosEconomo}
                    onChange={e => setApontamentosEconomo(e.target.value)}
                    placeholder="Observações do ecônomo..."
                  />
                </div>
                <button
                  className="btn-approve"
                  onClick={() => handleUpdateStatus('PENDENTE_SUPERIOR')}
                  disabled={isSavingStatus || !allValidated}
                  title={!allValidated ? 'Todas as planilhas devem estar validadas.' : ''}
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', opacity: !allValidated ? 0.5 : 1 }}
                >
                  <CheckCircle size={18} /> Enviar para o Superior
                </button>
              </>
            )}

            {isSuperior && consolidadoStatus?.status === 'PENDENTE_SUPERIOR' && (
              <>
                <div style={{ width: '100%' }}>
                  <label style={{ display: 'block', fontWeight: 600, marginBottom: '6px', fontSize: '14px' }}>
                    Notas do Superior (opcional):
                  </label>
                  <textarea
                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #ddd', minHeight: '80px', fontSize: '14px', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    value={apontamentosSuperior}
                    onChange={e => setApontamentosSuperior(e.target.value)}
                    placeholder="Observações do superior..."
                  />
                </div>
                <button
                  className="btn-approve"
                  onClick={() => handleUpdateStatus('APROVADO')}
                  disabled={isSavingStatus}
                  style={{ background: '#10b981', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <CheckCircle size={18} /> Aprovar Consolidado
                </button>
                <button
                  className="btn-reject"
                  onClick={() => handleUpdateStatus('DEVOLVIDO_SUPERIOR')}
                  disabled={isSavingStatus}
                  style={{ background: '#ef4444', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                >
                  <XCircle size={18} /> Devolver para o Ecônomo
                </button>
              </>
            )}
          </div>

          {/* Notes display */}
          {(consolidadoStatus?.apontamentos_economo || consolidadoStatus?.apontamentos_superior) && (
            <div style={{ marginTop: '16px', padding: '15px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              {consolidadoStatus.apontamentos_economo && (
                <div style={{ marginBottom: '10px' }}>
                  <strong style={{ fontSize: '13px' }}>Notas do Ecônomo:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{consolidadoStatus.apontamentos_economo}</p>
                </div>
              )}
              {consolidadoStatus.apontamentos_superior && (
                <div>
                  <strong style={{ fontSize: '13px' }}>Notas do Superior:</strong>
                  <p style={{ margin: '4px 0 0', fontSize: '14px' }}>{consolidadoStatus.apontamentos_superior}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Summary cards */}
      {selectedCasa && filteredMissionarios.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '20px' }}>
          <div className="card-lite" style={{ padding: '16px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Total Créditos</p>
            <h3 style={{ margin: '6px 0 0', color: '#10b981' }}>R$ {totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="card-lite" style={{ padding: '16px', textAlign: 'center', borderTop: '3px solid #ef4444' }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Total Débitos</p>
            <h3 style={{ margin: '6px 0 0', color: '#ef4444' }}>R$ {totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
          <div className="card-lite" style={{ padding: '16px', textAlign: 'center', borderTop: `3px solid ${totalSaldo >= 0 ? '#6366f1' : '#f59e0b'}` }}>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Saldo do Mês</p>
            <h3 style={{ margin: '6px 0 0', color: totalSaldo >= 0 ? '#6366f1' : '#f59e0b' }}>R$ {totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
          </div>
        </div>
      )}

      {/* Missionaries table */}
      <div className="data-table card-lite">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>Carregando...</div>
        ) : !selectedCasa ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <AlertCircle size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p>Selecione uma casa religiosa e um mês para ver os dados.</p>
          </div>
        ) : filteredMissionarios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
            <FileText size={40} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.4 }} />
            <p>Nenhuma planilha encontrada para este mês nesta casa.</p>
          </div>
        ) : (
          <table className="excel-style">
            <thead>
              <tr>
                <th>Missionário</th>
                <th>Status</th>
                <th className="right">Créditos</th>
                <th className="right">Débitos</th>
                <th className="right">Saldo</th>
                <th className="center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredMissionarios.map(m => {
                const saldo = Number(m.total_credito) - Number(m.total_debito);
                return (
                  <tr key={m.usuario_id}>
                    <td className="bold">{m.usuario_nome}</td>
                    <td><span className={`status-tag ${(m.status || '').toLowerCase()}`}>{m.status}</span></td>
                    <td className="right val-credit">R$ {Number(m.total_credito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className="right val-debit">R$ {Number(m.total_debito).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    <td className={`right bold ${saldo >= 0 ? 'val-credit' : 'val-debit'}`}>
                      R$ {saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="center">
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button className="btn-icon-view" onClick={() => loadDetails(m)} title="Ver Detalhes">
                          <FileText size={16} />
                        </button>
                        {canValidate && m.id && (
                          <>
                            {(m.status || '').trim().toUpperCase() !== 'VALIDADO' && (
                              <button className="btn-ok" onClick={() => handleValidarIndividual(m.id!, 'VALIDADO')} title="Validar">
                                <CheckCircle size={14} />
                              </button>
                            )}
                            <button className="btn-no" onClick={() => handleValidarIndividual(m.id!, 'DEVOLVIDO')} title="Devolver para Ajuste">
                              <XCircle size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="row-total-geral" style={{ background: '#013375', color: '#fff', fontWeight: 800, borderTop: '2px solid rgba(255,255,255,0.3)' }}>
                <td colSpan={2} style={{ color: '#fff', fontSize: '15px' }}>TOTAL GERAL</td>
                <td className="right" style={{ color: '#6ee7b7', fontSize: '15px' }}>R$ {totalCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="right" style={{ color: '#fca5a5', fontSize: '15px' }}>R$ {totalDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="right" style={{ color: totalSaldo >= 0 ? '#6ee7b7' : '#fca5a5', fontWeight: 900, fontSize: '16px' }}>
                  R$ {totalSaldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {showDetails && (
        <div className="modal-overlay" onClick={() => setShowDetails(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90%' }}>
            <div className="modal-header">
              <h3>Detalhes Financeiros - {showDetails.usuario_nome || 'Missionário'}</h3>
              <button onClick={() => setShowDetails(null)} className="btn-close">✕</button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div>
                  <h4 style={{ color: '#10b981', borderBottom: '1px solid #dcfce7', paddingBottom: '8px', marginBottom: '12px' }}>Créditos</h4>
                  {categorias.filter(c => c.tipo === 'CREDITO').map(cat => {
                    const item = showDetails.itens?.find((i: any) => i.categoria_id === cat.id);
                    if (!item || parseFloat(item.valor) === 0) return null;
                    return (
                      <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                        <span>{cat.codigo && <b style={{ color: '#ef4444', marginRight: '8px' }}>{cat.codigo}</b>}{cat.nome}</span>
                        <span className="bold">R$ {parseFloat(item.valor).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Total</strong>
                    <strong style={{ color: '#10b981' }}>R$ {parseFloat(showDetails.total_credito).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
                <div>
                  <h4 style={{ color: '#ef4444', borderBottom: '1px solid #fee2e2', paddingBottom: '8px', marginBottom: '12px' }}>Débitos</h4>
                  {categorias.filter(c => c.tipo === 'DEBITO').map(cat => {
                    const item = showDetails.itens?.find((i: any) => i.categoria_id === cat.id);
                    if (!item || parseFloat(item.valor) === 0) return null;
                    return (
                      <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '8px' }}>
                        <span>{cat.codigo && <b style={{ color: '#ef4444', marginRight: '8px' }}>{cat.codigo}</b>}{cat.nome}</span>
                        <span className="bold">R$ {parseFloat(item.valor).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                      </div>
                    );
                  })}
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '2px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
                    <strong>Total</strong>
                    <strong style={{ color: '#ef4444' }}>R$ {parseFloat(showDetails.total_debito).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                  </div>
                </div>
              </div>
              {showDetails.apontamentos && (
                <div style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <strong>Observações:</strong>
                  <p style={{ margin: '5px 0 0', fontSize: '14px' }}>{showDetails.apontamentos}</p>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
              <button className="btn-back" onClick={() => setShowDetails(null)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {detailsLoading && (
        <div className="modal-overlay" style={{ background: 'rgba(255,255,255,0.7)' }}>
          <Loader2 className="animate-spin" size={40} color="#013375" />
        </div>
      )}
    </div>
  );
};

export default GestaoFinanceira;
