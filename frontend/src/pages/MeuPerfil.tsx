import React, { useState, useEffect, useRef } from 'react';
import { Camera, ChevronRight, User, MapPin, Lock, CreditCard, X, Trash2, Edit2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import type { Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import api, { getFileUrl } from '../api';
import '../styles/MeuPerfil.css';

function centerAspectCrop(mediaWidth: number, mediaHeight: number, aspect: number) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  )
}

const MeuPerfil: React.FC = () => {
  const { user } = useAuth();
  const [perfil, setPerfil] = useState<any>(null);
  const [endereco, setEndereco] = useState<any>(null);
  const [contaBancaria, setContaBancaria] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal states
  const [activeModal, setActiveModal] = useState<'info' | 'endereco' | 'seguranca' | 'banco' | null>(null);
  
  // Form states
  const [formData, setFormData] = useState<any>({});
  const [passwordData, setPasswordData] = useState({ password: '', confirmPassword: '' });

  // Photo / Crop states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [showCropModal, setShowCropModal] = useState(false);
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const res = await api.get('/meu-perfil');
      setPerfil(res.data.perfil);
      setEndereco(res.data.endereco || {});
      setContaBancaria(res.data.contaBancaria || {});
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.substring(0, 2).toUpperCase();
  };

  function onSelectFile(e: React.ChangeEvent<HTMLInputElement>) {
    setShowPhotoOptions(false);
    if (e.target.files && e.target.files.length > 0) {
      setCrop(undefined); // Makes crop preview update between images.
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImgSrc(reader.result?.toString() || '');
        setShowCropModal(true);
      });
      reader.readAsDataURL(e.target.files[0]);
    }
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  }

  const getCroppedImg = async (image: HTMLImageElement, crop: PixelCrop): Promise<Blob | null> => {
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    canvas.width = crop.width;
    canvas.height = crop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      crop.width,
      crop.height,
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.95);
    });
  };

  const handleUploadCropped = async () => {
    if (!completedCrop || !imgRef.current) return;
    
    const blob = await getCroppedImg(imgRef.current, completedCrop);
    if (!blob) return;

    const formData = new FormData();
    formData.append('foto', blob, 'profile.jpg');

    try {
      const res = await api.post('/meu-perfil/foto', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setShowCropModal(false);
        setImgSrc('');
        fetchData();
        if (user) {
          const updatedUser = { ...user, foto_perfil: res.data.foto_perfil };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          window.location.reload();
        }
      }
    } catch (err: any) {
      console.error('Erro ao enviar foto:', err);
      const message = err.response?.data?.message || 'Erro ao enviar foto';
      alert(message);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Tem certeza que deseja remover sua foto de perfil?')) return;
    try {
      await api.delete('/meu-perfil/foto');
      setShowPhotoOptions(false);
      fetchData();
      if (user) {
        const updatedUser = { ...user, foto_perfil: undefined };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      }
    } catch (err) {
      alert('Erro ao excluir foto');
    }
  };

  const handleAvatarClick = () => {
    if (perfil?.foto_perfil) {
      setShowPhotoOptions(!showPhotoOptions);
    } else {
      fileInputRef.current?.click();
    }
  };

  const openModal = (type: 'info' | 'endereco' | 'seguranca' | 'banco') => {
    setActiveModal(type);
    if (type === 'info') setFormData({ nome: perfil?.nome || '' });
    else if (type === 'endereco') setFormData({ ...endereco });
    else if (type === 'banco') setFormData({ ...contaBancaria });
    else if (type === 'seguranca') setPasswordData({ password: '', confirmPassword: '' });
  };

  const handleSave = async () => {
    try {
      if (activeModal === 'info') {
        await api.put('/meu-perfil', { nome: formData.nome });
      } else if (activeModal === 'endereco') {
        await api.put('/meu-perfil/endereco', formData);
      } else if (activeModal === 'banco') {
        await api.put('/meu-perfil/conta', formData);
      } else if (activeModal === 'seguranca') {
        if (passwordData.password !== passwordData.confirmPassword) {
          alert('As senhas não coincidem');
          return;
        }
        if (passwordData.password.length < 6) {
          alert('A senha deve ter pelo menos 6 caracteres');
          return;
        }
        await api.put(`/usuarios/${user?.id}/password`, { password: passwordData.password });
        alert('Senha atualizada com sucesso!');
      }
      
      setActiveModal(null);
      fetchData();
    } catch (err) {
      alert('Erro ao salvar os dados');
    }
  };

  if (isLoading) return <div style={{ padding: '40px', textAlign: 'center' }}>Carregando...</div>;

  return (
    <div className="meu-perfil-page">
      <div className="meu-perfil-container">
        
        <div className="meu-perfil-header" style={{ position: 'relative' }}>
          <div className="avatar-wrapper" onClick={handleAvatarClick}>
            {perfil?.foto_perfil ? (
              <img src={getFileUrl(perfil.foto_perfil) || perfil.foto_perfil} alt="Perfil" className="avatar-img" />
            ) : (
              <span>{getInitials(perfil?.nome || user?.nome || '')}</span>
            )}
            <div className="avatar-overlay">
              <Camera size={16} color="white" />
            </div>
          </div>
          
          {showPhotoOptions && (
            <div style={{
              position: 'absolute', top: '120px', background: 'white', color: '#333', 
              borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 10,
              display: 'flex', flexDirection: 'column', overflow: 'hidden'
            }}>
              <button onClick={() => fileInputRef.current?.click()} style={{ padding: '10px 16px', background: 'none', border: 'none', borderBottom: '1px solid #eee', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={16} /> Trocar Foto
              </button>
              <button onClick={handleDeletePhoto} style={{ padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trash2 size={16} /> Excluir Foto
              </button>
            </div>
          )}

          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept="image/*" onChange={onSelectFile} />
          
          <h2>{perfil?.nome || user?.nome}</h2>
          <p>{perfil?.email || user?.email}</p>
        </div>

        <div className="meu-perfil-menu">
          <div className="menu-item" onClick={() => openModal('info')}>
            <div className="menu-item-left">
              <div className="menu-icon-wrapper"><User size={20} /></div>
              <div className="menu-item-text">
                <span className="menu-item-title">Informações do seu perfil</span>
                <span className="menu-item-subtitle">{perfil?.nome}</span>
              </div>
            </div>
            <div className="menu-item-right"><ChevronRight size={20} /></div>
          </div>

          <div className="menu-item" onClick={() => openModal('endereco')}>
            <div className="menu-item-left">
              <div className="menu-icon-wrapper"><MapPin size={20} /></div>
              <div className="menu-item-text">
                <span className="menu-item-title">Endereços</span>
                <span className="menu-item-subtitle">
                  {endereco?.cidade_estado ? `${endereco.cidade_estado}` : 'Não informado'}
                </span>
              </div>
            </div>
            <div className="menu-item-right"><ChevronRight size={20} /></div>
          </div>

          <div className="menu-item" onClick={() => openModal('seguranca')}>
            <div className="menu-item-left">
              <div className="menu-icon-wrapper"><Lock size={20} /></div>
              <div className="menu-item-text">
                <span className="menu-item-title">Segurança</span>
                <span className="menu-item-subtitle">Login e senha</span>
              </div>
            </div>
            <div className="menu-item-right"><ChevronRight size={20} /></div>
          </div>

          <div className="menu-item" onClick={() => openModal('banco')}>
            <div className="menu-item-left">
              <div className="menu-icon-wrapper"><CreditCard size={20} /></div>
              <div className="menu-item-text">
                <span className="menu-item-title">Dados Bancários</span>
                <span className="menu-item-subtitle">
                  {contaBancaria?.agencia ? `Ag ${contaBancaria.agencia} / CC ${contaBancaria.numero}` : 'Não informado'}
                </span>
              </div>
            </div>
            <div className="menu-item-right"><ChevronRight size={20} /></div>
          </div>
        </div>

      </div>

      {showCropModal && (
        <div className="perfil-modal-overlay">
          <div className="perfil-modal-content" style={{ maxWidth: '600px' }}>
            <div className="perfil-modal-header">
              <h3>Ajustar Foto</h3>
              <button className="perfil-modal-close" onClick={() => { setShowCropModal(false); setImgSrc(''); }}><X size={24} /></button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#f1f5f9', maxHeight: '400px', overflow: 'auto' }}>
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                onComplete={(c) => setCompletedCrop(c)}
                aspect={1}
                circularCrop
              >
                <img
                  ref={imgRef}
                  alt="Crop preview"
                  src={imgSrc}
                  onLoad={onImageLoad}
                  style={{ maxHeight: '400px' }}
                />
              </ReactCrop>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="perfil-btn-save" style={{ background: '#64748b' }} onClick={() => { setShowCropModal(false); setImgSrc(''); }}>
                Cancelar
              </button>
              <button className="perfil-btn-save" onClick={handleUploadCropped}>
                Confirmar e Enviar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeModal && (
        <div className="perfil-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setActiveModal(null); }}>
          <div className="perfil-modal-content">
            <div className="perfil-modal-header">
              <h3>
                {activeModal === 'info' && 'Editar Informações'}
                {activeModal === 'endereco' && 'Endereço e Contato'}
                {activeModal === 'seguranca' && 'Segurança'}
                {activeModal === 'banco' && 'Dados Bancários'}
              </h3>
              <button className="perfil-modal-close" onClick={() => setActiveModal(null)}><X size={24} /></button>
            </div>

            <div className="perfil-modal-body">
              {activeModal === 'info' && (
                <>
                  <div className="perfil-form-group">
                    <label>Nome Completo</label>
                    <input type="text" value={formData.nome || ''} onChange={e => setFormData({...formData, nome: e.target.value})} />
                  </div>
                  <div className="perfil-form-group">
                    <label>Email (Login)</label>
                    <input type="text" value={perfil?.email || user?.email || ''} disabled style={{ background: '#f1f5f9', color: '#94a3b8' }} />
                  </div>
                </>
              )}

              {activeModal === 'endereco' && (
                <>
                  <div className="perfil-form-group">
                    <label>Logradouro / Rua</label>
                    <input type="text" value={formData.logradouro || ''} onChange={e => setFormData({...formData, logradouro: e.target.value})} />
                  </div>
                  <div className="perfil-form-row">
                    <div className="perfil-form-group" style={{ flex: 1 }}>
                      <label>Bairro</label>
                      <input type="text" value={formData.bairro || ''} onChange={e => setFormData({...formData, bairro: e.target.value})} />
                    </div>
                    <div className="perfil-form-group" style={{ flex: 1 }}>
                      <label>CEP</label>
                      <input type="text" value={formData.cep || ''} onChange={e => setFormData({...formData, cep: e.target.value})} />
                    </div>
                  </div>
                  <div className="perfil-form-group">
                    <label>Cidade / Estado</label>
                    <input type="text" value={formData.cidade_estado || ''} onChange={e => setFormData({...formData, cidade_estado: e.target.value})} />
                  </div>
                  <div className="perfil-form-group">
                    <label>Celular / WhatsApp</label>
                    <input type="text" value={formData.celular_whatsapp || ''} onChange={e => setFormData({...formData, celular_whatsapp: e.target.value})} />
                  </div>
                </>
              )}

              {activeModal === 'banco' && (
                <>
                  <div className="perfil-form-group">
                    <label>Tipo de Conta</label>
                    <input type="text" placeholder="Ex: Conta Corrente - Banco do Brasil" value={formData.tipo_conta || ''} onChange={e => setFormData({...formData, tipo_conta: e.target.value})} />
                  </div>
                  <div className="perfil-form-group">
                    <label>Titularidade</label>
                    <input type="text" value={formData.titularidade || ''} onChange={e => setFormData({...formData, titularidade: e.target.value})} />
                  </div>
                  <div className="perfil-form-row">
                    <div className="perfil-form-group" style={{ flex: 1 }}>
                      <label>Agência</label>
                      <input type="text" value={formData.agencia || ''} onChange={e => setFormData({...formData, agencia: e.target.value})} />
                    </div>
                    <div className="perfil-form-group" style={{ flex: 1 }}>
                      <label>Número da Conta</label>
                      <input type="text" value={formData.numero || ''} onChange={e => setFormData({...formData, numero: e.target.value})} />
                    </div>
                  </div>
                </>
              )}

              {activeModal === 'seguranca' && (
                <>
                  <div className="perfil-form-group">
                    <label>Nova Senha</label>
                    <input type="password" value={passwordData.password} onChange={e => setPasswordData({...passwordData, password: e.target.value})} />
                  </div>
                  <div className="perfil-form-group">
                    <label>Confirmar Nova Senha</label>
                    <input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})} />
                  </div>
                </>
              )}

              <button className="perfil-btn-save" onClick={handleSave}>
                Salvar Alterações
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MeuPerfil;
