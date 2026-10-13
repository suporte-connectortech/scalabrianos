import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Translated replacement for a visible <input type="file">, whose
// "Choose file / No file chosen" texts come from the browser's language.
interface FileInputButtonProps {
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  accept?: string;
  disabled?: boolean;
}

const FileInputButton: React.FC<FileInputButtonProps> = ({ onChange, accept, disabled }) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={e => {
          setFileName(e.target.files?.[0]?.name || '');
          onChange(e);
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#3b82f6', color: '#fff', padding: '8px 16px', borderRadius: '8px', fontWeight: 600, fontSize: '0.85rem', minHeight: '38px' }}
      >
        <Upload size={15} /> {t('common.choose_file', 'Escolher arquivo')}
      </button>
      <span style={{ fontSize: '0.85rem', color: fileName ? '#166534' : '#64748b', overflowWrap: 'anywhere' }}>
        {fileName || t('common.no_file_chosen', 'Nenhum arquivo selecionado')}
      </span>
    </div>
  );
};

export default FileInputButton;
