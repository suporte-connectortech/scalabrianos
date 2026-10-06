import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  MapPin, Users, ArrowLeft, Loader2, AlertCircle, 
  Globe, Building2, User, UserCheck, Info, Star, DollarSign,
  Phone, Mail, PhoneCall, Calendar, FileText, Upload, Trash2,
  Download, Printer, File, ExternalLink
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import api, { getFileUrl } from '../api';
import '../styles/CasasReligiosas.css';

interface CasaDocumento {
  id: number;
  casa_id: number;
  nome: string;
  arquivo_url: string;
  tipo?: string;
  tamanho?: number;
  created_at: string;
}

interface ResponsavelItem {
  cargo: string;
  nome: string;
  nomes?: string[];
}

interface Missionary {
  id: number;
  nome: string;
  login: string;
  situacao: string;
  funcao?: string;
  is_superior?: boolean;
  is_oconomo?: boolean;
}

interface ReligiousHouse {
  id: number;
  nome: string;
  cnpj?: string;
  endereco: string;
  cidade?: string;
  pais?: string;
  cep?: string;
  telefone?: string;
  celular?: string;
  email?: string;
  data_inicio?: string;
  data_entrega?: string;
  data_encerramento?: string;
  observacao?: string;
  status: 'ATIVO' | 'INATIVO' | 'ENTREGUE';
  regional?: string;
  paroco?: string;
  vigario_paroquial?: string;
  tipo?: string;
  pm_code?: string;
  responsaveis?: ResponsavelItem[];
  missionarios?: Missionary[];
  documentos?: CasaDocumento[];
}

const TIPO_LABELS: Record<string, string> = {
  CI: 'Casas de Idosos – CI',
  CR: 'Casas Religiosas – CR',
  M: 'Obras – M',
  P: 'Paróquia – P',
  PV: 'Pastoral Vocacional – PV',
  CS: 'Seminário – CS',
};

const PerfilCasa: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { canEdit } = useAuth();
  const navigate = useNavigate();
  const [house, setHouse] = useState<ReligiousHouse | null>(null);
  const [documentos, setDocumentos] = useState<CasaDocumento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHouseDetails();
  }, [id]);

  const fetchHouseDetails = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/casas-religiosas/${id}`);
      setHouse(response.data);
      setDocumentos(response.data.documentos || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching house details:', err);
      setError(t('casas.error_loading') || 'Erro ao carregar detalhes da presença.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !id) return;
    setIsUploading(true);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('arquivo', file);
        formData.append('nome', file.name);
        const res = await api.post(`/casas-religiosas/${id}/documentos`, formData);
        setDocumentos(prev => [res.data, ...prev]);
      }
    } catch (uploadErr) {
      console.error('Error uploading document:', uploadErr);
      alert('Erro ao enviar documento.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: number) => {
    if (!window.confirm('Deseja excluir este documento?')) return;
    try {
      await api.delete(`/casas-religiosas/${id}/documentos/${docId}`);
      setDocumentos(prev => prev.filter(d => d.id !== docId));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erro ao excluir documento.');
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '---';
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  };

  const handlePrintReport = () => {
    if (!house) return;
    const now = new Date();
    const dataAtual = now.toLocaleDateString('pt-BR');
    const horaAtual = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const tipoLabel = house.tipo ? (TIPO_LABELS[house.tipo] || house.tipo) : '---';

    const statusLabel = house.status === 'ATIVO' ? 'ATIVA' : house.status === 'ENTREGUE' ? 'ENTREGUE' : 'INATIVA';
    const statusColor = house.status === 'ATIVO' ? '#166534' : house.status === 'ENTREGUE' ? '#d97706' : '#dc2626';

    let responsaveisHtml = '';
    if (house.responsaveis && house.responsaveis.length > 0) {
      responsaveisHtml = `
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 40%;">Cargo / Função</th>
              <th>Nome do(s) Responsável(is)</th>
            </tr>
          </thead>
          <tbody>
            ${house.responsaveis.map(r => `
              <tr>
                <td style="font-weight: 600;">${r.cargo}</td>
                <td>${r.nomes && r.nomes.length > 0 ? r.nomes.join(', ') : (r.nome || '---')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    let missionariosHtml = '';
    if (house.missionarios && house.missionarios.length > 0) {
      missionariosHtml = `
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 50%;">Nome do Missionário</th>
              <th style="width: 30%;">Função</th>
              <th style="width: 20%;">Situação</th>
            </tr>
          </thead>
          <tbody>
            ${house.missionarios.map(m => `
              <tr>
                <td style="font-weight: 600;">${m.nome}</td>
                <td>${m.funcao || (m.is_superior ? 'Superior Local' : m.is_oconomo ? 'Ecônomo Local' : 'Missionário')}</td>
                <td>${m.situacao || 'Ativo'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }

    if (!responsaveisHtml && !missionariosHtml) {
      missionariosHtml = '<p class="empty-note">Nenhum missionário ou responsável vinculado a esta presença no momento.</p>';
    }

    let docsHtml = '';
    if (documentos && documentos.length > 0) {
      docsHtml = `
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 45px; text-align: center;">Nº</th>
              <th>Nome do Arquivo</th>
              <th style="width: 140px;">Tipo</th>
              <th style="width: 90px; text-align: right;">Tamanho</th>
              <th style="width: 110px; text-align: center;">Data de Envio</th>
            </tr>
          </thead>
          <tbody>
            ${documentos.map((d, idx) => `
              <tr>
                <td style="text-align: center;">${idx + 1}</td>
                <td style="font-weight: 600;">${d.nome}</td>
                <td>${(d.tipo || d.arquivo_url.split('.').pop() || 'DOCUMENTO').toUpperCase()}</td>
                <td style="text-align: right;">${formatFileSize(d.tamanho)}</td>
                <td style="text-align: center;">${d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '---'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      docsHtml = '<p class="empty-note">Nenhum documento anexado a esta presença missionária.</p>';
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Ficha da Presença Missionária - ${house.nome}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 15mm 15mm 15mm 15mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
            padding: 0;
            font-size: 11pt;
            line-height: 1.45;
          }
          .report-header {
            border-bottom: 2px solid #032b57;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .org-title {
            font-size: 10pt;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.8px;
            margin: 0 0 2px 0;
          }
          .region-title {
            font-size: 11pt;
            font-weight: 800;
            color: #032b57;
            text-transform: uppercase;
            margin: 0 0 8px 0;
          }
          .doc-main-title {
            font-size: 16pt;
            font-weight: 900;
            color: #0f172a;
            margin: 0 0 10px 0;
          }
          .header-meta-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 9pt;
            color: #334155;
          }
          .status-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-weight: 800;
            font-size: 8.5pt;
            color: #fff;
            background: ${statusColor};
            text-transform: uppercase;
          }
          .section-block {
            margin-bottom: 16px;
            page-break-inside: avoid;
          }
          .section-title {
            font-size: 11pt;
            font-weight: 800;
            color: #032b57;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 4px;
            margin: 0 0 8px 0;
          }
          .data-grid-2 {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 16px;
          }
          .data-grid-3 {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 8px 16px;
          }
          .data-field {
            margin-bottom: 4px;
          }
          .field-label {
            font-size: 8.5pt;
            font-weight: 700;
            color: #64748b;
            text-transform: uppercase;
            display: block;
            margin-bottom: 2px;
          }
          .field-value {
            font-size: 10pt;
            font-weight: 500;
            color: #0f172a;
          }
          .field-value.bold {
            font-weight: 700;
          }
          .report-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9.5pt;
            margin-top: 6px;
          }
          .report-table th {
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-align: left;
            padding: 6px 10px;
            border: 1px solid #cbd5e1;
            font-size: 8.5pt;
            text-transform: uppercase;
          }
          .report-table td {
            padding: 6px 10px;
            border: 1px solid #cbd5e1;
            vertical-align: middle;
          }
          .obs-box {
            background: #f8fafc;
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            border-radius: 4px;
            font-size: 9.5pt;
            line-height: 1.5;
            white-space: pre-wrap;
          }
          .empty-note {
            font-size: 9pt;
            font-style: italic;
            color: #64748b;
            margin: 4px 0;
          }
          .signatures-container {
            margin-top: 36px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
          }
          .signature-box {
            text-align: center;
          }
          .signature-line {
            border-top: 1px solid #0f172a;
            margin-bottom: 6px;
          }
          .signature-title {
            font-size: 9pt;
            font-weight: 700;
            color: #0f172a;
          }
          .signature-role {
            font-size: 8pt;
            color: #64748b;
          }
          .report-footer {
            margin-top: 24px;
            padding-top: 8px;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 8pt;
            color: #64748b;
          }
        </style>
      </head>
      <body>
        <div class="report-header">
          <div class="org-title">Congregação dos Missionários de São Carlos – Scalabrinianos</div>
          <div class="region-title">Região Nossa Senhora Mãe dos Migrantes (RNSMM)</div>
          <div class="doc-main-title">Ficha Cadastral da Presença Missionária</div>
          <div class="header-meta-bar">
            <span><strong>Presença:</strong> ${house.nome}</span>
            <span><strong>Código PM:</strong> ${house.pm_code || '---'}</span>
            <span><strong>Emissão:</strong> ${dataAtual} às ${horaAtual}</span>
            <span><strong>Status:</strong> <span class="status-badge">${statusLabel}</span></span>
          </div>
        </div>

        <!-- 1. DADOS DE IDENTIFICAÇÃO -->
        <div class="section-block">
          <div class="section-title">1. Dados de Identificação</div>
          <div class="data-grid-2">
            <div class="data-field">
              <span class="field-label">Nome Oficial da Presença</span>
              <span class="field-value bold">${house.nome}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Código PM</span>
              <span class="field-value">${house.pm_code || '---'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Classificação / Tipo</span>
              <span class="field-value">${tipoLabel}</span>
            </div>
            <div class="data-field">
              <span class="field-label">CNPJ</span>
              <span class="field-value">${house.cnpj || 'Não informado'}</span>
            </div>
          </div>
        </div>

        <!-- 2. LOCALIZAÇÃO E CONTATOS -->
        <div class="section-block">
          <div class="section-title">2. Localização e Contatos</div>
          <div class="data-grid-2">
            <div class="data-field" style="grid-column: span 2;">
              <span class="field-label">Endereço Completo</span>
              <span class="field-value">${house.endereco || '---'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Cidade / UF</span>
              <span class="field-value">${house.cidade || '---'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">CEP</span>
              <span class="field-value">${house.cep || '---'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">País / Regional</span>
              <span class="field-value">${house.regional || house.pais || 'Brasil'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Telefone Fixo</span>
              <span class="field-value">${house.telefone || 'Não informado'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Celular / WhatsApp</span>
              <span class="field-value">${house.celular || 'Não informado'}</span>
            </div>
            <div class="data-field">
              <span class="field-label">E-mail de Contato</span>
              <span class="field-value">${house.email || 'Não informado'}</span>
            </div>
          </div>
        </div>

        <!-- 3. CRONOGRAMA & VIGÊNCIA -->
        <div class="section-block">
          <div class="section-title">3. Cronograma e Vigência</div>
          <div class="data-grid-3">
            <div class="data-field">
              <span class="field-label">Data de Início</span>
              <span class="field-value bold">${formatDate(house.data_inicio)}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Data de Entrega</span>
              <span class="field-value bold">${formatDate(house.data_entrega)}</span>
            </div>
            <div class="data-field">
              <span class="field-label">Data de Encerramento</span>
              <span class="field-value bold">${formatDate(house.data_encerramento)}</span>
            </div>
          </div>
        </div>

        <!-- 4. CORPO MISSIONÁRIO E RESPONSÁVEIS -->
        <div class="section-block">
          <div class="section-title">4. Responsáveis e Corpo Missionário Vinculado</div>
          ${responsaveisHtml}
          ${missionariosHtml}
        </div>

        <!-- 5. OBSERVAÇÕES -->
        <div class="section-block">
          <div class="section-title">5. Observações e Histórico</div>
          ${house.observacao ? `<div class="obs-box">${house.observacao}</div>` : '<p class="empty-note">Nenhuma observação registrada.</p>'}
        </div>

        <!-- 6. DOCUMENTOS ANEXADOS -->
        <div class="section-block">
          <div class="section-title">6. Registro de Documentos Anexados (${documentos.length})</div>
          ${docsHtml}
        </div>

        <!-- 7. ASSINATURAS -->
        <div class="signatures-container">
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">Superior Regional / Ecônomo Regional</div>
            <div class="signature-role">Direção Regional RNSMM</div>
          </div>
          <div class="signature-box">
            <div class="signature-line"></div>
            <div class="signature-title">Responsável pela Presença Missionária</div>
            <div class="signature-role">${house.nome}</div>
          </div>
        </div>

        <div class="report-footer">
          <span>Portal Scalabrinianos — Sistema Integrado de Gestão RNSMM</span>
          <span>Documento emitido em ${dataAtual} às ${horaAtual}</span>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (isLoading) {
    return (
      <div className="loading-state" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
        <Loader2 className="animate-spin" size={48} color="#032b57" />
        <p style={{ color: '#64748b', fontWeight: 600 }}>{t('common.loading')}</p>
      </div>
    );
  }

  if (error || !house) {
    return (
      <div className="error-state" style={{ height: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <AlertCircle size={48} color="#dc2626" />
        <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#1e293b' }}>{error || 'Presença não encontrada.'}</p>
        <button className="btn-back-casa" onClick={() => navigate('/casas-religiosas')}>
          <ArrowLeft size={18} /> Voltar para Presenças
        </button>
      </div>
    );
  }

  const tipoLabel = house.tipo ? (TIPO_LABELS[house.tipo] || house.tipo) : null;

  return (
    <div className="page-container">
      {/* Header */}
      <div className="casa-detail-header">
        <div className="casa-detail-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <button className="btn-back-casa" onClick={() => navigate('/casas-religiosas')}>
            <ArrowLeft size={18} /> Voltar para Presenças
          </button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button 
              className="btn-export" 
              onClick={handlePrintReport} 
              style={{ height: '36px', padding: '0 14px', fontSize: '0.85rem' }}
              title="Imprimir relatório oficial padronizado"
            >
              <Printer size={16} /> Imprimir Relatório
            </button>
            <span className={`status-tag ${house.status.toLowerCase()}`}>
              {t(`status.${house.status.toLowerCase()}`, house.status)}
            </span>
          </div>
        </div>

        <div className="casa-detail-title-wrapper" style={{ marginTop: '12px' }}>
          <div className="casa-detail-icon">
            <Building2 size={26} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="casa-detail-title">{house.nome}</h2>
            <div className="casa-detail-meta">
              {house.pm_code && <span className="pm-code">{house.pm_code}</span>}
              {tipoLabel && <span className="casa-tipo-pill">{tipoLabel}</span>}
              {house.cnpj && <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>CNPJ: {house.cnpj}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="profile-grid">
        {/* Left Column: Info Cards */}
        <div className="profile-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Informações Gerais */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Building2 size={18} /> Informações Gerais
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Endereço
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'flex-start', gap: '8px', lineHeight: 1.4 }}>
                  <MapPin size={16} style={{ color: '#032b57', flexShrink: 0, marginTop: '2px' }} /> 
                  <span>{house.endereco || '---'}</span>
                </p>
                {house.cep && (
                  <span style={{ fontSize: '12px', color: '#64748b', marginTop: '2px', display: 'block' }}>
                    CEP: {house.cep}
                  </span>
                )}
              </div>
              
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  País / Regional
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={16} style={{ color: '#032b57', flexShrink: 0 }} /> 
                  <span>{house.regional || house.pais || 'Brasil'}</span>
                </p>
              </div>

              {/* Responsáveis */}
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Responsáveis
                </label>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {house.responsaveis && house.responsaveis.length > 0 ? (
                    house.responsaveis.map((resp, idx) => (
                      <div key={idx} className="responsavel-card-item">
                        <div className="responsavel-role">
                          <UserCheck size={14} />
                          <span>{resp.cargo}</span>
                        </div>
                        <div className="responsavel-name">{resp.nome}</div>
                      </div>
                    ))
                  ) : (house.missionarios && house.missionarios.length > 0) ? (
                    <div className="sem-responsaveis-box">
                      <Info size={16} />
                      <span>Somente missionários vinculados (sem Superior, Ecônomo Local ou Pároco atribuído).</span>
                    </div>
                  ) : (
                    <div className="sem-responsaveis-box">
                      <Info size={16} />
                      <span>Nenhum missionário vinculado a esta presença no momento.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Vigência & Datas */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Calendar size={18} /> Vigência & Datas
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Data de Início
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                  {formatDate(house.data_inicio)}
                </p>
              </div>

              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Data de Entrega
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                  {formatDate(house.data_entrega)}
                </p>
              </div>

              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Data de Encerramento
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 600, color: '#1e293b' }}>
                  {formatDate(house.data_encerramento)}
                </p>
              </div>
            </div>
          </div>

          {/* Contatos da Presença */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Phone size={18} /> Contatos da Presença
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Telefone Fixo
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b' }}>
                  {house.telefone ? (
                    <a href={`tel:${house.telefone}`} style={{ color: '#0284c7', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={14} /> {house.telefone}
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Não informado</span>
                  )}
                </p>
              </div>

              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Celular / WhatsApp
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b' }}>
                  {house.celular ? (
                    <a href={`tel:${house.celular}`} style={{ color: '#16a34a', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <PhoneCall size={14} /> {house.celular}
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Não informado</span>
                  )}
                </p>
              </div>

              <div className="info-item">
                <label style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  E-mail
                </label>
                <p style={{ margin: '4px 0 0', fontSize: '13.5px', fontWeight: 500, color: '#1e293b' }}>
                  {house.email ? (
                    <a href={`mailto:${house.email}`} style={{ color: '#2563eb', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', wordBreak: 'break-all' }}>
                      <Mail size={14} /> {house.email}
                    </a>
                  ) : (
                    <span style={{ color: '#94a3b8' }}>Não informado</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Missionaries, Observações & Documentos */}
        <div className="profile-main" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Missionários Vinculados */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <Users size={18} /> Missionários Vinculados ({house.missionarios?.length || 0})
            </h4>
            
            <div className="data-table" style={{ boxShadow: 'none', border: '1px solid #f1f5f9' }}>
              <table style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Função / Atribuição</th>
                    <th>Email</th>
                    <th className="center">Status</th>
                    <th className="center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {(house.missionarios || []).length > 0 ? (
                    house.missionarios?.map(m => (
                      <tr key={m.id}>
                        <td className="bold">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{m.nome}</span>
                            {m.is_superior && (
                              <span title="Superior" style={{ color: '#eab308', display: 'inline-flex' }}>
                                <Star size={14} fill="#eab308" />
                              </span>
                            )}
                            {m.is_oconomo && (
                              <span title="Ecônomo Local" style={{ color: '#16a34a', display: 'inline-flex' }}>
                                <DollarSign size={14} />
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {m.funcao ? (
                            <span className="role-badge-table">{m.funcao}</span>
                          ) : m.is_superior ? (
                            <span className="role-badge-table">Superior Local</span>
                          ) : m.is_oconomo ? (
                            <span className="role-badge-table">Ecônomo Local</span>
                          ) : (
                            <span style={{ color: '#94a3b8', fontSize: '12px' }}>Missionário</span>
                          )}
                        </td>
                        <td>{m.login}</td>
                        <td className="center">
                          <span className={`status-tag ${m.situacao?.toLowerCase()}`}>
                            {m.situacao}
                          </span>
                        </td>
                        <td className="center">
                          <button 
                            className="btn-action-icon view" 
                            title="Ver perfil do missionário"
                            onClick={() => navigate(`/missionarios/${m.id}`)}
                          >
                            <User size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '2.5rem', color: '#94a3b8' }}>
                        Nenhum missionário vinculado a esta presença no momento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Observações da Presença */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
              <FileText size={18} /> Observações da Presença
            </h4>
            {house.observacao ? (
              <div style={{
                background: '#f8fafc',
                padding: '16px 20px',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '14px',
                lineHeight: '1.7',
                color: '#334155',
                whiteSpace: 'pre-wrap'
              }}>
                {house.observacao}
              </div>
            ) : (
              <p style={{ color: '#94a3b8', fontStyle: 'italic', margin: 0, fontSize: '13.5px' }}>
                Nenhuma observação registrada para esta presença.
              </p>
            )}
          </div>

          {/* Documentos Anexados */}
          <div className="card-lite" style={{ padding: '1.5rem', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0, color: '#032b57', fontSize: '1rem', fontWeight: 700 }}>
                <File size={18} /> Documentos Anexados ({documentos.length})
              </h4>
              {canEdit && (
                <div>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    multiple
                    style={{ display: 'none' }}
                  />
                  <button
                    className="btn-new"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    style={{ height: '36px', padding: '0 14px', fontSize: '0.85rem' }}
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    {isUploading ? 'Enviando...' : 'Anexar Documento'}
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {documentos.length > 0 ? (
                documentos.map(doc => {
                  const url = getFileUrl(doc.arquivo_url) || doc.arquivo_url;
                  return (
                    <div key={doc.id} className="doc-attachment-item">
                      <div className="doc-attachment-info">
                        <FileText size={20} style={{ color: '#0284c7', flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b' }}>
                            {doc.nome}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            {formatFileSize(doc.tamanho)} • {formatDate(doc.created_at)}
                          </div>
                        </div>
                      </div>

                      <div className="doc-attachment-actions">
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-action-icon view"
                          title="Visualizar documento em nova aba"
                        >
                          <ExternalLink size={16} />
                        </a>
                        <a
                          href={url}
                          download={doc.nome}
                          className="btn-action-icon"
                          title="Baixar documento"
                          style={{ color: '#059669', background: '#ecfdf5' }}
                        >
                          <Download size={16} />
                        </a>
                        {canEdit && (
                          <button
                            className="btn-action-icon delete"
                            title="Excluir documento"
                            onClick={() => handleDeleteDocument(doc.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', border: '1px dashed #cbd5e1', borderRadius: '12px', color: '#94a3b8', fontSize: '13.5px' }}>
                  Nenhum documento anexado a esta presença.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerfilCasa;
