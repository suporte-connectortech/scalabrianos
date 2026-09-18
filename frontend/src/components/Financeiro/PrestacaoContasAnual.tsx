import React, { useState, useEffect } from 'react';
import { Save, Loader2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

interface Categoria {
  id: number;
  codigo: string;
  nome: string;
}

interface Props {
  casas: { id: number; nome: string }[];
  categorias: Categoria[];
}

const PrestacaoContasAnual: React.FC<Props> = ({ casas, categorias }) => {
  const { user } = useAuth();
  const [selectedAno, setSelectedAno] = useState((new Date().getFullYear() - 1).toString());
  const [selectedCasa, setSelectedCasa] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, number>>({});

  useEffect(() => {
    if (user?.casa_id && !selectedCasa) setSelectedCasa(user.casa_id.toString());
  }, [user]);

  useEffect(() => {
    if (selectedCasa && selectedAno) loadPrestacao();
  }, [selectedCasa, selectedAno]);

  const loadPrestacao = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/prestacao-anual/${selectedCasa}/${selectedAno}`);
      if (res.data) {
        const vals: Record<number, number> = {};
        res.data.itens.forEach((it: any) => {
          vals[it.categoria_id] = parseFloat(it.valor);
        });
        setEditValues(vals);
      } else {
        setEditValues({});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedCasa) return alert('Selecione uma casa.');
    setIsSaving(true);
    const payload = {
      casa_id: parseInt(selectedCasa),
      ano: parseInt(selectedAno),
      itens: Object.entries(editValues).map(([id, val]) => ({
        categoria_id: parseInt(id),
        valor: val
      }))
    };
    try {
      await api.post('/api/prestacao-anual', payload);
      alert('Prestação de contas anual salva!');
    } catch (err) {
      alert('Erro ao salvar.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="planilha-mensal-content">
      <div className="filters-card">
        <div className="filters-grid-premium">
          <div className="filter-item">
            <label><Calendar size={14} /> Ano de Referência</label>
            <select value={selectedAno} onChange={e => setSelectedAno(e.target.value)}>
               {[-2,-1,0].map(i => <option key={i} value={new Date().getFullYear() + i}>{new Date().getFullYear() + i}</option>)}
            </select>
          </div>
          <div className="filter-item">
            <label>Casa Religiosa</label>
            <select value={selectedCasa} onChange={e => setSelectedCasa(e.target.value)}>
              <option value="">Selecione...</option>
              {casas.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="spreedsheet-container card-lite" style={{ marginTop: '20px' }}>
        <div className="spreedsheet-header">
           <div>
              <h3>Prestação de Contas ANUAL</h3>
              <p>Relatório consolidado do exercício anterior.</p>
           </div>
           <button className="btn-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Prestação Anual
           </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}><Loader2 className="animate-spin" size={40} /></div>
        ) : (
          <div className="data-table">
            <table className="excel-style">
              <thead>
                <tr>
                  <th style={{ width: '100px' }}>Código</th>
                  <th>Categoria</th>
                  <th className="right" style={{ width: '200px' }}>Valor Total (R$)</th>
                </tr>
              </thead>
              <tbody>
                {categorias.map(cat => (
                  <tr key={cat.id}>
                    <td className="bold">{cat.codigo}</td>
                    <td>{cat.nome}</td>
                    <td className="right">
                       <input 
                         type="number" 
                         step="0.01"
                         value={editValues[cat.id] || ''} 
                         onChange={e => setEditValues({ ...editValues, [cat.id]: parseFloat(e.target.value) || 0 })}
                         className="clean-input right"
                       />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PrestacaoContasAnual;
