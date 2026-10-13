import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../styles/AppDialog.css';

// In-app replacement for window.alert / window.confirm: native dialogs show their
// buttons in the browser's language, so they can't follow the app's PT/ES setting.

interface DialogRequest {
  kind: 'alert' | 'confirm';
  message: string;
  resolve: (value: boolean) => void;
}

let enqueue: ((req: DialogRequest) => void) | null = null;

const open = (kind: DialogRequest['kind'], message: string): Promise<boolean> =>
  new Promise(resolve => {
    if (!enqueue) {
      // Host not mounted (should not happen): fall back to the native dialog
      resolve(kind === 'confirm' ? window.confirm(message) : (window.alert(message), true));
      return;
    }
    enqueue({ kind, message, resolve });
  });

export const appAlert = (message: string): Promise<boolean> => open('alert', message);
export const appConfirm = (message: string): Promise<boolean> => open('confirm', message);

export const AppDialogHost: React.FC = () => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const current = queue[0];

  useEffect(() => {
    enqueue = req => setQueue(prev => [...prev, req]);
    return () => { enqueue = null; };
  }, []);

  useEffect(() => {
    if (current) confirmBtnRef.current?.focus();
  }, [current]);

  if (!current) return null;

  const close = (value: boolean) => {
    current.resolve(value);
    setQueue(prev => prev.slice(1));
  };

  return (
    <div
      className="app-dialog-overlay"
      role="presentation"
      onKeyDown={e => { if (e.key === 'Escape') close(false); }}
    >
      <div className="app-dialog" role={current.kind === 'confirm' ? 'alertdialog' : 'dialog'} aria-modal="true">
        <p className="app-dialog-message">{current.message}</p>
        <div className="app-dialog-actions">
          {current.kind === 'confirm' && (
            <button type="button" className="app-dialog-btn secondary" onClick={() => close(false)}>
              {t('common.cancel', 'Cancelar')}
            </button>
          )}
          <button type="button" ref={confirmBtnRef} className="app-dialog-btn primary" onClick={() => close(true)}>
            {current.kind === 'confirm' ? t('common.confirm', 'Confirmar') : t('common.ok', 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
};
