import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import api from '../api';
import PlanilhaMensal from '../components/Financeiro/PlanilhaMensal';
import PlanilhaComunidade from '../components/Financeiro/PlanilhaComunidade';
import ValidacoesOconomo from '../components/Financeiro/ValidacoesOconomo';
import PlanejamentoOrcamentario from '../components/Financeiro/PlanejamentoOrcamentario';
import PrestacaoContasAnual from '../components/Financeiro/PrestacaoContasAnual';
import { useAuth } from '../context/AuthContext';
import '../styles/Relatorios.css';
import '../styles/FinanceiroSpreadsheet.css';

interface Categoria {
  id: number;
  codigo: string;
  nome: string;
  tipo: 'CREDITO' | 'DEBITO';
  categoria_pai: 'PESSOAL' | 'CASA';
  perfil: 'PERFIL_1' | 'PERFIL_2' | 'ANUAL' | 'PLANEJAMENTO';
}

interface Casa {
  id: number;
  nome: string;
}

const Financeiro: React.FC = () => {
  const { t } = useTranslation();
  const { isAdminGeral, isOconomo, isSuperior, isPadre, user } = useAuth();
  const [searchParams] = useSearchParams();
  const queryMes = searchParams.get('mes') || undefined;
  const queryTab = searchParams.get('tab') || undefined;

  const [casas, setCasas] = useState<Casa[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  // Read is_oconomo and is_superior directly from the user object as a safety fallback
  // in case the derived boolean from AuthContext has a derivation issue.
  const rawIsOconomo = !!user?.is_oconomo;
  const rawIsSuperior = !!user?.is_superior;
  const effectiveIsOconomo = isOconomo || rawIsOconomo;
  const effectiveIsSuperior = isSuperior || rawIsSuperior;

  // Default tab: individual users land on their own spreadsheet;
  // admins (ADMIN_GERAL) go straight to the community/admin tab.
  const [activeTab, setActiveTab] = useState<'individual' | 'comunidade' | 'planejamento' | 'anual' | 'validacoes_pendentes' | 'historico_casa'>(
    isAdminGeral ? 'comunidade' : 'individual'
  );

  useEffect(() => {
    if (queryTab && queryTab !== 'historico_aprovacoes') {
      setActiveTab(queryTab as any);
    } else if (queryMes) {
      setActiveTab('individual');
    }
  }, [queryTab, queryMes]);

  useEffect(() => {
    // Common missionaries (no authority role) are forced to individual
    if (!isAdminGeral && !effectiveIsOconomo && !effectiveIsSuperior && isPadre) {
      setActiveTab('individual');
    }
  }, [isAdminGeral, effectiveIsOconomo, effectiveIsSuperior, isPadre]);

  const isCommonPadre = isPadre && !effectiveIsOconomo && !effectiveIsSuperior;
  const isLocalAuthority = effectiveIsOconomo || effectiveIsSuperior;

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [housesRes, catsRes] = await Promise.all([
          api.post('/casas-religiosas/get'),
          api.get('/categorias-financas')
        ]);
        setCasas(housesRes.data);
        setCategorias(catsRes.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchInitialData();
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="title-with-badge">
          <DollarSign size={24} />
          <h2>{t('financeiro.title')}</h2>
        </div>
      </div>

      {!isCommonPadre && (
        <>
          <div className="view-mode-tabs" style={{ margin: '0 auto 8px auto' }}>
            {/* Individual tab: all non-adminGeral priests (including oconomo) */}
            {!isAdminGeral && (
              <button
                className={`mode-btn ${activeTab === 'individual' ? 'active' : ''}`}
                onClick={() => setActiveTab('individual')}
              >
                {t('planilha.individual_title')}
              </button>
            )}
            <button
              className={`mode-btn ${activeTab === 'comunidade' ? 'active' : ''}`}
              onClick={() => setActiveTab('comunidade')}
            >
              {t('planilha.comunidade_title')}
            </button>
            {isOconomo && (
              <>
                <button
                  className={`mode-btn ${activeTab === 'validacoes_pendentes' ? 'active' : ''}`}
                  onClick={() => setActiveTab('validacoes_pendentes')}
                >
                  {t('financeiro.pending_validations', 'Validações Pendentes')}
                </button>
                {(user?.role === 'ECONOMO_REGIONAL' || user?.role === 'ADMIN_GERAL') && (
                  <button
                    className={`mode-btn ${activeTab === 'historico_casa' ? 'active' : ''}`}
                    onClick={() => setActiveTab('historico_casa')}
                  >
                    {t('financeiro.house_history', 'Histórico Casa Religiosa')}
                  </button>
                )}
              </>
            )}
            {isAdminGeral && (
              <>
                <button
                  className={`mode-btn ${activeTab === 'planejamento' ? 'active' : ''}`}
                  onClick={() => setActiveTab('planejamento')}
                >
                  {t('menu.finance')}
                </button>
                <button
                  className={`mode-btn ${activeTab === 'anual' ? 'active' : ''}`}
                  onClick={() => setActiveTab('anual')}
                >
                  {t('financeiro.annual', 'Anual')}
                </button>
              </>
            )}
          </div>

          {/* Contextual hint for the Economo Local */}
          {isOconomo && !isAdminGeral && (
            <div style={{
              marginBottom: '20px',
              padding: '10px 16px',
              borderRadius: '8px',
              background: activeTab === 'individual'
                ? 'linear-gradient(90deg,#eff6ff,#dbeafe)'
                : 'linear-gradient(90deg,#f0fdf4,#dcfce7)',
              border: `1px solid ${activeTab === 'individual' ? '#93c5fd' : '#86efac'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '13px',
              color: activeTab === 'individual' ? '#1e40af' : '#166534',
            }}>
              <span style={{ fontSize: '16px' }}>{activeTab === 'individual' ? '👤' : '🏠'}</span>
              {activeTab === 'individual' ? (
                <span>
                  <strong>{t('financeiro.hint_individual_title', 'Prestação de Contas — Missionário:')}</strong> {t('financeiro.hint_individual', 'sua planilha individual mensal. Após preencher, finalize e envie para conferência.')}
                </span>
              ) : (
                <span>
                  <strong>{t('financeiro.hint_comunidade_title', 'Planilha da Comunidade/Casa Religiosa:')}</strong> {t('financeiro.hint_comunidade', 'consolida os valores individuais dos missionários com os da casa. Preencha e encaminhe para aprovação do Ecônomo Regional (SEDE).')}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {/* Tab content */}
      <div className="tab-content" style={{ marginTop: '16px' }}>
        {activeTab === 'individual' && !isAdminGeral && <PlanilhaMensal casas={casas} categorias={categorias} externalMes={queryMes} />}
        {activeTab === 'comunidade' && (isAdminGeral || isLocalAuthority) && <PlanilhaComunidade casas={casas} categorias={categorias} />}
        {activeTab === 'planejamento' && isAdminGeral && <PlanejamentoOrcamentario casas={casas} categorias={categorias.filter(c => c.perfil === 'PLANEJAMENTO')} />}
        {activeTab === 'anual' && isAdminGeral && <PrestacaoContasAnual casas={casas} categorias={categorias.filter(c => c.perfil === 'ANUAL')} />}
        {activeTab === 'validacoes_pendentes' && isOconomo && <ValidacoesOconomo casas={casas} categorias={categorias} tipo="pendentes" />}
        {activeTab === 'historico_casa' && isOconomo && (user?.role === 'ECONOMO_REGIONAL' || user?.role === 'ADMIN_GERAL') && <ValidacoesOconomo casas={casas} categorias={categorias} tipo="historico_casa" />}
      </div>
    </div>
  );
};

export default Financeiro;
