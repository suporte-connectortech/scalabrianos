import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flag, X, Loader2, ArrowRight, CheckCircle, User, Mail, Calendar, ListChecks } from 'lucide-react';
import api from '../../api';
import { appAlert } from './AppDialog';
import '../../styles/CorrecaoModal.css';

export interface CorrecaoDetalhe {
  id: number;
  usuario_id: number;
  missionario_nome: string;
  missionario_email: string;
  secao: string;
  campos: string[];
  descricao: string;
  status: string;
  created_at: string;
  resolvido_em?: string | null;
  resolvido_por_nome?: string | null;
  tab: string;
  link_path: string;
}

interface Props {
  correcaoId: number;
  onClose: () => void;
  /** Esconde o botão "Ir para a seção" quando já se está no perfil do missionário */
  hideGoToSection?: boolean;
  onResolved?: () => void;
}

// Extrai o id da solicitação de um link de notificação (…?tab=x&correcao=ID)
export const getCorrecaoIdFromLink = (link?: string | null): number | null => {
  if (!link) return null;
  const m = link.match(/[?&]correcao=(\d+)/);
  return m ? Number(m[1]) : null;
};

const CorrecaoModal: React.FC<Props> = ({ correcaoId, onClose, hideGoToSection, onResolved }) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [data, setData] = useState<CorrecaoDetalhe | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResolving, setIsResolving] = useState(false);
  const locale = i18n.language?.startsWith('es') ? 'es-ES' : 'pt-BR';

  const load = () => {
    setIsLoading(true);
    api.get(`/correcoes/${correcaoId}`)
      .then(res => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [correcaoId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const goToSection = () => {
    if (!data) return;
    onClose();
    navigate(data.link_path);
  };

  const resolver = async () => {
    if (!data) return;
    setIsResolving(true);
    try {
      await api.put(`/correcoes/${data.id}/resolver`);
      load();
      onResolved?.();
    } catch (err: any) {
      await appAlert(err?.response?.data?.message || t('correcao.resolve_error', 'Não foi possível marcar como resolvida.'));
    } finally {
      setIsResolving(false);
    }
  };

  const resolvida = data?.status === 'RESOLVIDA';

  return createPortal(
    <div className="cm-backdrop" onClick={onClose}>
      <div className="cm-modal" role="dialog" aria-modal="true" onClick={e => e.stopPropagation()}>
        <div className="cm-head">
          <h3><Flag size={18} /> {t('correcao.title', 'Solicitação de correção de dados')}</h3>
          <button className="cm-icon-btn" onClick={onClose} aria-label={t('common.close', 'Fechar')}><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="cm-loading"><Loader2 className="animate-spin" size={26} /></div>
        ) : !data ? (
          <p className="cm-empty">{t('correcao.not_found', 'Não foi possível carregar esta solicitação.')}</p>
        ) : (
          <>
            <span className={`cm-status ${resolvida ? 'resolvida' : 'aberta'}`}>
              {resolvida ? t('correcao.status_resolved', 'Resolvida') : t('correcao.status_open', 'Aguardando ajuste')}
            </span>

            <dl className="cm-meta">
              <div><dt><User size={13} /> {t('correcao.missionary', 'Missionário')}</dt><dd>{data.missionario_nome}</dd></div>
              <div><dt><Mail size={13} /> {t('correcao.email', 'E-mail')}</dt><dd>{data.missionario_email || '—'}</dd></div>
              <div><dt><Calendar size={13} /> {t('correcao.sent_at', 'Enviado em')}</dt><dd>{new Date(data.created_at).toLocaleString(locale)}</dd></div>
            </dl>

            <div className="cm-where">
              <span className="cm-label">{t('correcao.where', 'Onde ajustar')}</span>
              <div className="cm-path">
                <strong>{t('correcao.profile_of', 'Perfil de')} {data.missionario_nome}</strong>
                <ArrowRight size={14} />
                <strong>{data.secao}</strong>
              </div>
            </div>

            <div className="cm-block">
              <span className="cm-label"><ListChecks size={14} /> {t('correcao.fields', 'Campos a alterar')}</span>
              {data.campos.length > 0 ? (
                <ul className="cm-campos">
                  {data.campos.map(c => <li key={c}>{c}</li>)}
                </ul>
              ) : <p className="cm-empty">—</p>}
            </div>

            <div className="cm-block">
              <span className="cm-label">{t('correcao.note', 'Observação do missionário')}</span>
              <p className="cm-note">{data.descricao}</p>
            </div>

            {resolvida && (
              <p className="cm-resolved-info">
                <CheckCircle size={14} /> {t('correcao.resolved_by', 'Resolvida por')} {data.resolvido_por_nome || '—'}
                {data.resolvido_em ? ` · ${new Date(data.resolvido_em).toLocaleString(locale)}` : ''}
              </p>
            )}

            <div className="cm-actions">
              {!resolvida && (
                <button className="cm-btn-secondary" onClick={resolver} disabled={isResolving}>
                  {isResolving ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle size={16} />}
                  {t('correcao.mark_resolved', 'Marcar como resolvida')}
                </button>
              )}
              {!hideGoToSection && (
                <button className="cm-btn-primary" onClick={goToSection}>
                  {t('correcao.go_to_section', 'Ir para a seção')} <ArrowRight size={16} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CorrecaoModal;
