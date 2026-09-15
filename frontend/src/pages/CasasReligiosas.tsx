import React, { useState, useMemo, useEffect } from 'react';
import {
  Edit2, X, Loader2, AlertCircle, Plus, Trash2, Download,
  Home as HomeIcon, Save, Eye, Search, DollarSign, ChevronLeft,
  ChevronRight, Printer
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { formatCNPJ, validateCNPJ, cleanCNPJ } from '../utils/cnpjHelper';
import { formatCEP, cleanCEP, isValidCEP, extractCidadeUf } from '../utils/addressHelper';
import '../styles/CasasReligiosas.css';

interface ReligiousHouse {
  id: number;
  nome: string;
  cnpj?: string;
  endereco: string;
  cidade?: string;
  cep?: string;
  pais?: string;
  status: 'ATIVO' | 'INATIVO';
  missionarios_count: number;
  regional?: string;
  data_referencia_casa?: string;
  paroco?: string;
  vigario_paroquial?: string;
  tipo?: string;
  pm_code?: string;
}

const NOMENCLATURES = [
  { code: 'CI', label: 'Casas de Idosos – CI' },
  { code: 'CR', label: 'Casas Religiosas – CR' },
  { code: 'M', label: 'Obras – M' },
  { code: 'P', label: 'Paróquia – P' },
  { code: 'PV', label: 'Pastoral Vocacional - PV' },
  { code: 'CS', label: 'Seminário - CS' },
];

const CasasReligiosas: React.FC = () => {
  const { t } = useTranslation();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [houses, setHouses] = useState<ReligiousHouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterName, setFilterName] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');

  const [editingHouse, setEditingHouse] = useState<ReligiousHouse | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    fetchHouses();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterName, filterCity, filterCountry, filterStatus]);

  const fetchHouses = async () => {
    setIsLoading(true);
    try {
      const response = await api.post('/casas-religiosas/get');
      setHouses(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching houses:', err);
      setError(t('casas.error_loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHouses = useMemo(() => {
    return houses.filter((house) => {
      const matchesName = house.nome.toLowerCase().includes(filterName.toLowerCase());
      const houseCity = extractCidadeUf(house.cidade, house.endereco).toLowerCase();
      const rawAddress = (house.endereco || '').toLowerCase();
      const matchesCity = houseCity.includes(filterCity.toLowerCase()) || rawAddress.includes(filterCity.toLowerCase());
      const matchesCountry = (house.regional || house.pais || '').toLowerCase().includes(filterCountry.toLowerCase());
      const matchesStatus = filterStatus === 'Todos' || house.status === filterStatus;
      return matchesName && matchesCity && matchesCountry && matchesStatus;
    });
  }, [houses, filterName, filterCity, filterCountry, filterStatus]);

  const totalPages = Math.ceil(filteredHouses.length / itemsPerPage);
  const paginatedHouses = useMemo(() => {
    return filteredHouses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredHouses, currentPage]);

  const handleClearFilters = () => {
    setFilterName('');
    setFilterCity('');
    setFilterCountry('');
    setFilterStatus('Todos');
  };

  const handleExportExcel = () => {
    if (filteredHouses.length === 0) {
      alert('Nenhum registro para exportar.');
      return;
    }

    const exportData = filteredHouses.map(h => ({
      'ID': `#${h.id}`,
      'PM': h.pm_code || '',
      'Presença Missionária': h.nome,
      'Tipo': NOMENCLATURES.find(n => n.code === h.tipo)?.label || h.tipo || '',
      'CNPJ': h.cnpj || '',
      'Cidade/UF': extractCidadeUf(h.cidade, h.endereco),
      'País': h.regional || h.pais || 'Brasil',
      'Status': h.status,
      'Endereço Completo': h.endereco || '',
      'Total Missionários': h.missionarios_count || 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Presenças Missionárias');
    XLSX.writeFile(wb, `Presencas_Missionarias_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handlePrintHouses = () => {
    if (filteredHouses.length === 0) {
      alert('Nenhum registro para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, autorize popups no seu navegador para imprimir a listagem.');
      return;
    }

    const now = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const rowsHtml = filteredHouses.map((h) => `
      <tr>
        <td style="text-align: center; font-weight: bold; width: 45px;">#${h.id}</td>
        <td style="text-align: center; font-weight: bold; white-space: nowrap; width: 75px;">${h.pm_code || '---'}</td>
        <td style="font-weight: 600;">${h.nome}</td>
        <td style="white-space: nowrap; font-weight: 500;">${extractCidadeUf(h.cidade, h.endereco)}</td>
        <td style="white-space: nowrap;">${h.regional || h.pais || '---'}</td>
        <td style="text-align: center; font-weight: bold; width: 75px;">${h.status}</td>
        <td style="font-size: 11px; color: #475569;">${h.endereco || '---'}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="utf-8">
        <title>Relatório de Presenças Missionárias - Scalabrianos</title>
        <style>
          @page { size: A4 landscape; margin: 12mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 20px;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #032b57;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }
          .title h1 {
            margin: 0;
            font-size: 20px;
            color: #032b57;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .title p {
            margin: 4px 0 0;
            font-size: 12px;
            color: #64748b;
          }
          .meta {
            text-align: right;
            font-size: 11px;
            color: #64748b;
            line-height: 1.5;
          }
          .summary-bar {
            margin-bottom: 14px;
            font-size: 12px;
            background: #f8fafc;
            padding: 8px 12px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            display: flex;
            justify-content: space-between;
            font-weight: 600;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          th {
            background-color: #032b57;
            color: #ffffff;
            text-align: left;
            padding: 8px 10px;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
          }
          th.center, td.center { text-align: center; }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
            vertical-align: middle;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          .footer {
            margin-top: 20px;
            text-align: right;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">
            <h1>Relatório de Presenças Missionárias</h1>
            <p>Congregação dos Missionários de São Carlos – Scalabrinianos</p>
          </div>
          <div class="meta">
            <div><strong>Emissão:</strong> ${now}</div>
            <div><strong>Total de Registros:</strong> ${filteredHouses.length}</div>
          </div>
        </div>
        <div class="summary-bar">
          <span>Listagem Completa de Presenças Missionárias Registradas</span>
          <span>Filtro de Status: ${filterStatus}</span>
        </div>
        <table>
          <thead>
            <tr>
              <th style="text-align: center; width: 45px;">ID</th>
              <th style="text-align: center; width: 75px;">PM</th>
              <th>Presença Missionária</th>
              <th>Cidade/UF</th>
              <th>País</th>
              <th style="text-align: center; width: 75px;">Status</th>
              <th>Endereço Completo</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
        <div class="footer">
          Documento oficial gerado pelo Sistema Scalabrinianos em ${now}
        </div>
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleOpenEdit = (house: ReligiousHouse) => {
    const cleanAddressCity = extractCidadeUf(house.cidade, house.endereco);
    setEditingHouse({
      ...house,
      cidade: house.cidade || (cleanAddressCity !== '---' ? cleanAddressCity : '')
    });
    setCepStatus(house.cep && isValidCEP(house.cep) ? 'valid' : 'idle');
    setIsModalOpen(true);
  };

  const handleCepChange = async (rawVal: string) => {
    const formatted = formatCEP(rawVal);
    setEditingHouse(prev => prev ? { ...prev, cep: formatted } : null);

    const clean = cleanCEP(rawVal);
    if (clean.length === 8) {
      if (!isValidCEP(clean)) {
        setCepStatus('invalid');
        return;
      }
      setCepStatus('loading');
      try {
        const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepStatus('invalid');
        } else {
          setCepStatus('valid');
          setEditingHouse(prev => {
            if (!prev) return null;
            const autoCity = `${data.localidade} / ${data.uf}`;
            const currentEnd = (prev.endereco || '').trim();
            const autoEnd = `${data.logradouro || ''}${data.bairro ? (data.logradouro ? ', ' : '') + data.bairro : ''}${data.complemento ? ' - ' + data.complemento : ''}`.trim();
            return {
              ...prev,
              cep: formatted,
              cidade: autoCity,
              endereco: currentEnd.length > 5 ? currentEnd : (autoEnd || currentEnd),
              regional: prev.regional || 'Brasil'
            };
          });
        }
      } catch {
        setCepStatus('invalid');
      }
    } else {
      setCepStatus('idle');
    }
  };

  const handleSaveHouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingHouse) return;

    if (editingHouse.cnpj) {
      const clean = cleanCNPJ(editingHouse.cnpj);
      if (clean && !validateCNPJ(editingHouse.cnpj)) {
        alert('O CNPJ digitado é inválido. Verifique os números/letras segundo o padrão da Receita Federal.');
        return;
      }
    }

    setSaveLoading(true);
    try {
      const payload = {
        ...editingHouse,
        cidade: editingHouse.cidade ? editingHouse.cidade.trim() : extractCidadeUf(undefined, editingHouse.endereco),
        cnpj: editingHouse.cnpj ? formatCNPJ(editingHouse.cnpj) : ''
      };
      if (editingHouse.id === 0) {
        await api.post('/casas-religiosas', payload);
      } else {
        await api.post(`/casas-religiosas/${editingHouse.id}/update`, payload);
      }
      await fetchHouses();
      setIsModalOpen(false);
      setEditingHouse(null);
    } catch (err) {
      console.error('Error saving house:', err);
      alert(t('common.error'));
    } finally {
      setSaveLoading(false);
    }
  };

  const handleNewHouse = () => {
    setEditingHouse({
      id: 0,
      nome: '',
      endereco: '',
      cidade: '',
      cep: '',
      regional: 'Brasil',
      status: 'ATIVO',
      missionarios_count: 0
    });
    setCepStatus('idle');
    setIsModalOpen(true);
  };

  const handleDeleteHouse = async (id: number) => {
    if (!window.confirm(t('common.confirm_delete') || 'Deseja excluir?')) return;
    try {
      await api.post(`/casas-religiosas/${id}/delete`);
      await fetchHouses();
    } catch (err) {
      console.error('Error deleting house:', err);
      alert(t('common.error'));
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <HomeIcon size={24} />
          <h2>{t('casas.title')}</h2>
        </div>
        <div className="header-actions">
          <button className="btn-print-report" onClick={handlePrintHouses} title="Imprimir listagem completa">
            <Printer size={18} /> Imprimir Relatório
          </button>
          <button className="btn-export" onClick={handleExportExcel} title="Exportar para Excel">
            <Download size={18} /> {t('financeiro.actions.export')}
          </button>
          {canEdit && (
            <button className="btn-new" onClick={handleNewHouse}>
              <Plus size={18} /> {t('casas.new_house')}
            </button>
          )}
        </div>
      </div>

      <div className="filters-card">
        <div className="filters-grid">
          <div className="filter-group">
            <label>PRESENÇA MISSIONÁRIA</label>
            <input
              type="text"
              placeholder="Filtrar por nome..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>CIDADE</label>
            <input
              type="text"
              placeholder="Filtrar por cidade..."
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>PAÍS</label>
            <input
              type="text"
              placeholder="Filtrar por país..."
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>STATUS</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="Todos">Todos</option>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>
        </div>

        <div className="filters-actions" style={{ display: 'flex', gap: '10px' }}>
          <button className="btn-clear" onClick={handleClearFilters} style={{ background: '#64748b', color: 'white', border: 'none' }}>
            Limpar
          </button>
          <button className="btn-filter-main" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#032b57', color: 'white', border: 'none' }}>
            <Search size={18} /> Filtrar
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="loading-container">
          <Loader2 className="animate-spin" size={40} />
          <p>{t('casas.loading')}</p>
        </div>
      ) : (
        <div className="data-table">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>PRESENÇA MISSIONÁRIA</th>
                <th>CIDADE/UF</th>
                <th>PAÍS</th>
                <th className="center">STATUS</th>
                <th className="center pm-cell">PM</th>
                <th className="center">AÇÕES</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHouses.map((house) => (
                <tr key={house.id}>
                  <td>#{house.id}</td>
                  <td className="bold">{house.nome}</td>
                  <td className="cidade-cell">{extractCidadeUf(house.cidade, house.endereco)}</td>
                  <td>{house.regional || house.pais || '---'}</td>
                  <td className="center">
                    <span className={`status-tag ${house.status.toLowerCase()}`}>
                      {house.status}
                    </span>
                  </td>
                  <td className="center pm-cell">
                    <span className="pm-code">{house.pm_code || '---'}</span>
                  </td>
                  <td className="center">
                    <div className="house-actions">
                      <button
                        className="btn-action-icon finance"
                        title={t('casas.cost_registration')}
                        onClick={() => navigate('/financeiro', { state: { house_id: house.id } })}
                      >
                        <DollarSign size={16} />
                      </button>
                      {canEdit && (
                        <>
                          <button
                            className="btn-action-icon edit"
                            title={t('common.edit')}
                            onClick={() => handleOpenEdit(house)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn-action-icon delete"
                            title={t('common.delete')}
                            onClick={() => handleDeleteHouse(house.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                      <button
                        className="btn-action-icon view"
                        title={t('common.view')}
                        onClick={() => navigate(`/casas-religiosas/${house.id}`)}
                      >
                        <Eye size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredHouses.length === 0 && (
            <div className="no-results" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              <p>{t('casas.no_houses_found')}</p>
            </div>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft size={18} />
          </button>
          <span className="pagination-info">
            Página {currentPage} de {totalPages}
          </span>
          <button
            className="pagination-btn"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}

      {isModalOpen && editingHouse && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{editingHouse.id === 0 ? t('casas.new_house') : t('casas.edit_house')}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveHouse} className="house-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>{t('casas.tipo')}</label>
                  <select
                    value={editingHouse.tipo || ''}
                    onChange={(e) => setEditingHouse({ ...editingHouse, tipo: e.target.value })}
                  >
                    <option value="">Selecione...</option>
                    {NOMENCLATURES.map(n => <option key={n.code} value={n.code}>{n.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('casas.pm')}</label>
                  <input
                    type="text"
                    placeholder="Ex: CR 01"
                    value={editingHouse.pm_code || ''}
                    onChange={(e) => setEditingHouse({ ...editingHouse, pm_code: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>{t('casas.name')}</label>
                <input
                  type="text"
                  placeholder="Nome da presença..."
                  value={editingHouse.nome}
                  onChange={(e) => setEditingHouse({ ...editingHouse, nome: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>CNPJ (Alfanumérico ou Numérico)</label>
                <input
                  type="text"
                  placeholder="00.000.000/0000-00 ou 19.JA2.KO8/Z001-51"
                  value={editingHouse.cnpj || ''}
                  onChange={(e) => setEditingHouse({ ...editingHouse, cnpj: formatCNPJ(e.target.value) })}
                  maxLength={18}
                />
                {editingHouse.cnpj && cleanCNPJ(editingHouse.cnpj).length === 14 && (
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    marginTop: '4px',
                    color: validateCNPJ(editingHouse.cnpj) ? '#166534' : '#dc2626',
                    display: 'block'
                  }}>
                    {validateCNPJ(editingHouse.cnpj) ? '✓ CNPJ Válido (Padrão Receita Federal)' : '✕ CNPJ Inválido (Verifique o número/letras)'}
                  </span>
                )}
              </div>

              {/* CEP e CIDADE/UF */}
              <div className="form-row-2">
                <div className="form-group">
                  <label>CEP (Busca Automática)</label>
                  <input
                    type="text"
                    placeholder="00000-000"
                    value={editingHouse.cep || ''}
                    onChange={(e) => handleCepChange(e.target.value)}
                    maxLength={9}
                  />
                  {cepStatus === 'loading' && (
                    <span style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Loader2 className="animate-spin" size={12} /> Buscando endereço pelo CEP...
                    </span>
                  )}
                  {cepStatus === 'valid' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#166534', marginTop: '4px', display: 'block' }}>
                      ✓ CEP Válido
                    </span>
                  )}
                  {cepStatus === 'invalid' && (
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', marginTop: '4px', display: 'block' }}>
                      ✕ CEP Inválido ou não encontrado
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label>Cidade / UF</label>
                  <input
                    type="text"
                    placeholder="Ex: São Paulo / SP ou Buenos Aires"
                    value={editingHouse.cidade || ''}
                    onChange={(e) => setEditingHouse({ ...editingHouse, cidade: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Residência / Endereço Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Rua Doutor Mário Vicente, 1108, compl.: 03, Ipiranga"
                  value={editingHouse.endereco}
                  onChange={(e) => {
                    const newEnd = e.target.value;
                    setEditingHouse(prev => {
                      if (!prev) return null;
                      const extracted = !prev.cidade ? extractCidadeUf(undefined, newEnd) : prev.cidade;
                      return {
                        ...prev,
                        endereco: newEnd,
                        cidade: (!prev.cidade && extracted !== newEnd && extracted !== '---') ? extracted : prev.cidade
                      };
                    });
                  }}
                  required
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>{t('casas.country')}</label>
                  <input
                    type="text"
                    placeholder="Ex: Brasil"
                    value={editingHouse.regional || editingHouse.pais || ''}
                    onChange={(e) => setEditingHouse({ ...editingHouse, regional: e.target.value, pais: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>{t('casas.status')}</label>
                  <select
                    value={editingHouse.status}
                    onChange={(e) => setEditingHouse({ ...editingHouse, status: e.target.value as any })}
                  >
                    <option value="ATIVO">ATIVO</option>
                    <option value="INATIVO">INATIVO</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-cancel" onClick={() => setIsModalOpen(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn-save" disabled={saveLoading}>
                  {saveLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasasReligiosas;
