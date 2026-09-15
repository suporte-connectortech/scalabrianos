import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { Clock, FileText, ArrowRight, Calendar, Search, Home } from 'lucide-react';
import PlanilhaMensal from './PlanilhaMensal';
import PlanilhaComunidade from './PlanilhaComunidade';
import MonthPicker from '../Common/MonthPicker';
import '../../styles/Relatorios.css';

interface Categoria {
  id: number;
  codigo: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoria_pai: 'PESSOAL' | 'CASA';
  perfil: 'PERFIL_1' | 'PERFIL_2' | 'ANUAL' | 'PLANEJAMENTO';
}

interface ValidationItem {
  id: number;
  tipo_planilha: 'missionario' | 'comunidade';
  usuario_id?: number;
  casa_id?: number;
  nome_usuario_ou_casa: string;
  nome_casa?: string;
  mes_referencia: string;
  status: string;
  updated_at: string;
  nome_validador?: string;
  codigo_pm?: string;
}

interface Props {
  casas: { id: number; nome: string }[];
  categorias: Categoria[];
  tipo: 'pendentes' | 'historico_missionario' | 'historico_casa';
}

const ValidacoesOconomo: React.FC<Props> = ({ casas, categorias, tipo }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<ValidationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPlanilha, setSelectedPlanilha] = useState<ValidationItem | null>(null);

  // Filter states
  const [filtroNome, setFiltroNome] = useState('');
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroCasa, setFiltroCasa] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const cardsPerPage = 9;

  const isRegional = user?.role === 'ECONOMO_REGIONAL' || user?.role === 'SUPERIOR_REGIONAL' || user?.role === 'ADMIN_GERAL';

  const fetchItems = async () => {
    setIsLoading(true);
    try {
      let endpoint = '';
      if (tipo === 'pendentes') {
        endpoint = '/validacoes/pendentes';
      } else if (tipo === 'historico_missionario') {
        endpoint = '/validacoes/historico/missionario';
      } else {
        endpoint = '/validacoes/historico/casa';
      }
      const res = await api.get(endpoint);
      setItems(res.data);
    } catch (err) {
      console.error('Error fetching validations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
    setSelectedPlanilha(null);
  }, [tipo]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filtroNome, filtroMes, filtroCasa, tipo]);

  // Client-side filtering (approximate search by name, reference month & house)
  const filteredItems = items.filter(item => {
    const matchesNome = filtroNome
      ? item.nome_usuario_ou_casa.toLowerCase().includes(filtroNome.toLowerCase())
      : true;
    const matchesMes = filtroMes
      ? item.mes_referencia === filtroMes
      : true;
    const matchesCasa = filtroCasa
      ? item.casa_id?.toString() === filtroCasa
      : true;
    return matchesNome && matchesMes && matchesCasa;
  });

  // Paginated Items
  const totalPages = Math.ceil(filteredItems.length / cardsPerPage);
  const paginatedItems = filteredItems.slice((currentPage - 1) * cardsPerPage, currentPage * cardsPerPage);

  if (selectedPlanilha) {
    return (
      <div className="validation-review-container">
        {/* Info Banner showing House Name, Month/Year & PM Code */}
        <div style={{
          background: 'linear-gradient(135deg, #013375 0%, #1e40af 100%)',
          color: 'white',
          padding: '18px 24px',
          borderRadius: '12px',
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <div style={{ fontSize: '11px', opacity: 0.85, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              {selectedPlanilha.tipo_planilha === 'comunidade' ? 'Planilha da Casa Religiosa' : 'Planilha do Missionário'}
            </div>
            <div style={{ fontSize: '20px', fontWeight: 900, marginTop: '2px' }}>
              {selectedPlanilha.nome_usuario_ou_casa}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
            {selectedPlanilha.nome_casa && (
              <div>
                <span style={{ fontSize: '11px', opacity: 0.85, display: 'block', fontWeight: 600 }}>CASA RELIGIOSA</span>
                <strong style={{ fontSize: '15px' }}>{selectedPlanilha.nome_casa}</strong>
              </div>
            )}
            <div>
              <span style={{ fontSize: '11px', opacity: 0.85, display: 'block', fontWeight: 600 }}>MÊS / ANO</span>
              <strong style={{ fontSize: '15px' }}>{selectedPlanilha.mes_referencia}</strong>
            </div>
            <div>
              <span style={{ fontSize: '11px', opacity: 0.85, display: 'block', fontWeight: 600 }}>CÓDIGO PM (PRESENÇA)</span>
              <strong style={{ fontSize: '14px', background: 'rgba(255, 255, 255, 0.2)', padding: '4px 10px', borderRadius: '6px', display: 'inline-block' }}>
                {selectedPlanilha.codigo_pm || 'N/A'}
              </strong>
            </div>
          </div>
        </div>

        <button 
          onClick={() => setSelectedPlanilha(null)}
          style={{ 
            background: '#f1f5f9', 
            border: '1px solid #cbd5e1', 
            color: '#013375', 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '8px', 
            cursor: 'pointer', 
            marginBottom: '20px', 
            fontWeight: 700,
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            transition: 'all 0.2s',
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = '#e2e8f0';
            e.currentTarget.style.borderColor = '#94a3b8';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = '#f1f5f9';
            e.currentTarget.style.borderColor = '#cbd5e1';
          }}
        >
          <ArrowRight size={16} style={{ transform: 'rotate(180deg)', strokeWidth: 3 }} />
          Voltar para a lista
        </button>

        {selectedPlanilha.tipo_planilha === 'missionario' ? (
          <PlanilhaMensal 
            casas={casas} 
            categorias={categorias} 
            externalUsuarioId={selectedPlanilha.usuario_id}
            externalMes={selectedPlanilha.mes_referencia}
            onValidationComplete={() => {
              setSelectedPlanilha(null);
              fetchItems();
            }}
          />
        ) : (
          <PlanilhaComunidade 
            casas={casas} 
            categorias={categorias} 
            initialCasa={selectedPlanilha.casa_id?.toString()}
            initialMes={selectedPlanilha.mes_referencia}
            externalUsuarioId={selectedPlanilha.usuario_id}
            onValidationComplete={() => {
              setSelectedPlanilha(null);
              fetchItems();
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="validacoes-container">
      {/* Search Filters Section */}
      <div className="filters-card" style={{ marginBottom: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #cbd5e1' }}>
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '250px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#013375', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} /> Buscar por Nome
            </label>
            <input 
              type="text" 
              placeholder="Digite o nome..." 
              value={filtroNome}
              onChange={e => setFiltroNome(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', height: '38px', background: 'white' }}
            />
          </div>

          {isRegional && (
            <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 700, color: '#013375', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Home size={14} /> Casa Religiosa
              </label>
              <select
                value={filtroCasa}
                onChange={e => setFiltroCasa(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', height: '38px', background: 'white', fontWeight: 600 }}
              >
                <option value="">Todas as Casas</option>
                {casas.map(c => (
                  <option key={c.id} value={c.id.toString()}>{c.nome}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ width: '220px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 700, color: '#013375', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> Mês de Referência
            </label>
            <MonthPicker
              value={filtroMes}
              onChange={setFiltroMes}
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>Carregando dados...</div>
      ) : filteredItems.length === 0 ? (
        <div style={{ background: '#f8fafc', padding: '40px', borderRadius: '16px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
          {tipo === 'pendentes' ? <Clock size={40} color="#94a3b8" /> : <FileText size={40} color="#94a3b8" />}
          <h3 style={{ marginTop: '16px', color: '#475569' }}>
            {tipo === 'pendentes' ? 'Nenhuma planilha pendente de validação' : 'Nenhum histórico encontrado'}
          </h3>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {paginatedItems.map(item => (
              <div key={`${item.tipo_planilha}-${item.id}`} style={{
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '20px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} /> {item.mes_referencia}
                  </span>
                  <span style={{ 
                    background: item.tipo_planilha === 'comunidade' ? '#e0f2fe' : '#ccfbf1', 
                    color: item.tipo_planilha === 'comunidade' ? '#0369a1' : '#0f766e', 
                    padding: '4px 8px', 
                    borderRadius: '6px', 
                    fontSize: '11px', 
                    fontWeight: 700 
                  }}>
                    {item.tipo_planilha === 'comunidade' ? 'Casa Religiosa' : 'Missionário'}
                  </span>
                </div>
                
                <h4 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{item.nome_usuario_ou_casa}</h4>
                {item.nome_casa && (
                  <div style={{ fontSize: '13px', color: '#64748b', fontWeight: 600, marginTop: '-4px' }}>
                    Casa: <span style={{ color: '#0f172a' }}>{item.nome_casa}</span>
                  </div>
                )}

                {/* Código PM da Presença - exibido para Ecônomo Regional ou nas abas relevantes */}
                {(isRegional || tipo === 'pendentes') && (
                  <div style={{ fontSize: '12px', color: '#0369a1', fontWeight: 700, background: '#f0f9ff', border: '1px solid #bae6fd', padding: '4px 10px', borderRadius: '6px', width: 'fit-content' }}>
                    Código PM: {item.codigo_pm || 'N/A'}
                  </div>
                )}
                
                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Enviado em: {new Date(item.updated_at).toLocaleString('pt-BR')}</div>
                  {item.nome_validador && item.nome_validador !== 'N/A' && (
                    <div style={{ color: '#475569', fontWeight: 600 }}>
                      Aprovador/Devolvedor: <span style={{ color: '#0f172a' }}>{item.nome_validador}</span>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  {/* Individual Item Status tag */}
                  {(item.status === 'VALIDADO' || item.status === 'APROVADO') && (
                    <span style={{ background: '#d1fae5', color: '#065f46', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                      Aprovado
                    </span>
                  )}
                  {(item.status === 'DEVOLVIDO' || item.status === 'DEVOLVIDO_SUPERIOR') && (
                    <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                      Devolvido
                    </span>
                  )}
                  {(item.status === 'PENDENTE' || item.status === 'EM_VALIDACAO' || item.status === 'ENVIADO_REGIONAL') && (
                    <span style={{ background: '#fef3c7', color: '#92400e', padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700 }}>
                      Aguardando
                    </span>
                  )}

                  <button 
                    onClick={() => setSelectedPlanilha(item)}
                    style={{ 
                      background: '#013375',
                      color: 'white',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontSize: '13px'
                    }}
                  >
                    Visualizar Planilha
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls (after 9 cards) */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '15px', marginTop: '30px', padding: '15px 0' }}>
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', background: currentPage === 1 ? '#f1f5f9' : 'white', fontWeight: 600, color: '#475569' }}
              >
                Anterior
              </button>
              <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>
                Página {currentPage} de {totalPages}
              </span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', background: currentPage === totalPages ? '#f1f5f9' : 'white', fontWeight: 600, color: '#475569' }}
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ValidacoesOconomo;
