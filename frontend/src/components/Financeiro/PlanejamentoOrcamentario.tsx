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

const PlanejamentoOrcamentario: React.FC<Props> = ({ casas, categorias }) => {
  const { user } = useAuth();
  const [selectedAno, setSelectedAno] = useState(new Date().getFullYear().toString());
  const [selectedCasa, setSelectedCasa] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<number, { m1: number; m2: number; m3: number }>>({});

  useEffect(() => {
    if (user?.casa_id && !selectedCasa) setSelectedCasa(user.casa_id.toString());
  }, [user]);

  useEffect(() => {
    if (selectedCasa && selectedAno) loadPlanejamento();
  }, [selectedCasa, selectedAno]);

  const loadPlanejamento = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/api/planejamento/${selectedCasa}/${selectedAno}`);
      if (res.data) {
        const vals: Record<number, { m1: number; m2: number; m3: number }> = {};
        res.data.itens.forEach((it: any) => {
          vals[it.categoria_id] = { m1: it.mes_1, m2: it.mes_2, m3: it.mes_3 };
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
      itens: Object.entries(editValues).map(([id, vals]) => ({
        categoria_id: parseInt(id),
        mes_1: vals.m1,
        mes_2: vals.m2,
        mes_3: vals.m3
      }))
    };
    try {
      await api.post('/api/planejamento', payload);
      alert('Planejamento orçamentário salvo!');
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
            <label><Calendar size={14} /> Ano do Planejamento</label>
            <select value={selectedAno} onChange={e => setSelectedAno(e.target.value)}>
               {[0,1,2].map(i => <option key={i} value={new Date().getFullYear() + i}>{new Date().getFullYear() + i}</option>)}
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
              <h3>Planejamento Orçamentário</h3>
              <p>Projeção para os próximos meses.</p>
           </div>
           <button className="btn-save" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Planejamento
           </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '50px', textAlign: 'center' }}><Loader2 className="animate-spin" size={40} /></div>
        ) : (
          <div className="data-table">
            <table className="excel-style">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Código</th>
                  <th>Categoria</th>
                  <th className="right">Mês 1</th>
                  <th className="right">Mês 2</th>
                  <th className="right">Mês 3</th>
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
                         value={editValues[cat.id]?.m1 || ''} 
                         onChange={e => setEditValues({ ...editValues, [cat.id]: { ...editValues[cat.id], m1: parseFloat(e.target.value) || 0 }})}
                         className="clean-input right"
                       />
                    </td>
                    <td className="right">
                       <input 
                         type="number" 
                         value={editValues[cat.id]?.m2 || ''} 
                         onChange={e => setEditValues({ ...editValues, [cat.id]: { ...editValues[cat.id], m2: parseFloat(e.target.value) || 0 }})}
                         className="clean-input right"
                       />
                    </td>
                    <td className="right">
                       <input 
                         type="number" 
                         value={editValues[cat.id]?.m3 || ''} 
                         onChange={e => setEditValues({ ...editValues, [cat.id]: { ...editValues[cat.id], m3: parseFloat(e.target.value) || 0 }})}
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

export default PlanejamentoOrcamentario;
