import { lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import MainLayout from './components/Layout/MainLayout';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import { AppDialogHost } from './components/Common/AppDialog';

// Pages are loaded on demand so the first load (login) stays light on mobile
const Home = lazy(() => import('./pages/Home'));
const CasasReligiosas = lazy(() => import('./pages/CasasReligiosas'));
const ItinerarioFormativo = lazy(() => import('./pages/ItinerarioFormativo'));
const Seminario = lazy(() => import('./pages/Seminario'));
const Propedeutico = lazy(() => import('./pages/Propedeutico'));
const Filosofia = lazy(() => import('./pages/Filosofia'));
const Postulado = lazy(() => import('./pages/Postulado'));
const Perfis = lazy(() => import('./pages/Perfis'));
const Administradores = lazy(() => import('./pages/Administradores'));
const Missionarios = lazy(() => import('./pages/Missionarios'));
const PerfilMissionario = lazy(() => import('./pages/PerfilMissionario'));
const PerfilCasa = lazy(() => import('./pages/PerfilCasa'));
const Logs = lazy(() => import('./pages/Logs'));
const LogsAcesso = lazy(() => import('./pages/LogsAcesso'));
const Relatorios = lazy(() => import('./pages/Relatorios'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const ExtratosMensais = lazy(() => import('./pages/ExtratosMensais'));
const MeuPerfil = lazy(() => import('./pages/MeuPerfil'));
const MeusDados = lazy(() => import('./pages/MeusDados'));
const GestaoFinanceira = lazy(() => import('./pages/GestaoFinanceira'));
const MapaRNSMM = lazy(() => import('./pages/MapaRNSMM'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoader = () => (
  <div className="page-loader" role="status" aria-label="Carregando">
    <div className="page-loader-spinner" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
          <Suspense fallback={<PageLoader />}>
          <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          <Route path="/home" element={
            <ProtectedRoute>
              <MainLayout><Home /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Admin routes — requireAdmin check */}
          <Route path="/administradores" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><Administradores /></MainLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/perfis" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><Perfis /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/missionarios" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><Missionarios /></MainLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/logs" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><Logs /></MainLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/logs-acesso" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><LogsAcesso /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Management routes — requireManagement (Admin, Oconomo or Superior) */}
          <Route path="/casas-religiosas" element={
            <ProtectedRoute requireManagement>
              <MainLayout><CasasReligiosas /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/casas-religiosas/:id" element={
            <ProtectedRoute requireManagement>
              <MainLayout><PerfilCasa /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/missionarios/:id" element={
            <ProtectedRoute requireManagement>
              <MainLayout><PerfilMissionario /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Itinerary subroutes — requireAdmin */}
          <Route path="/itinerario-formativo" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><ItinerarioFormativo /></MainLayout>
            </ProtectedRoute>
          } />
          <Route path="/itinerario/seminarios" element={<ProtectedRoute requireAdmin><MainLayout><Seminario /></MainLayout></ProtectedRoute>} />
          <Route path="/itinerario/propedeutico" element={<ProtectedRoute requireAdmin><MainLayout><Propedeutico /></MainLayout></ProtectedRoute>} />
          <Route path="/itinerario/filosofia" element={<ProtectedRoute requireAdmin><MainLayout><Filosofia /></MainLayout></ProtectedRoute>} />
          <Route path="/itinerario/postulado" element={<ProtectedRoute requireAdmin><MainLayout><Postulado /></MainLayout></ProtectedRoute>} />

          {/* Financeiro — for missionaries and all roles who fill in the spreadsheet */}
          <Route path="/financeiro" element={
            <ProtectedRoute>
              <MainLayout><Financeiro /></MainLayout>
            </ProtectedRoute>
          } />
          
          <Route path="/extratos-mensais" element={
            <ProtectedRoute>
              <MainLayout><ExtratosMensais /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Gestão Financeira — only for admins, oconomo, superior */}
          <Route path="/gestao-financeira" element={
            <ProtectedRoute requireManagement>
              <MainLayout><GestaoFinanceira /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/mapa" element={
            <ProtectedRoute>
              <MainLayout><MapaRNSMM /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/relatorios" element={
            <ProtectedRoute requireAdmin>
              <MainLayout><Relatorios /></MainLayout>
            </ProtectedRoute>
          } />

          {/* Meus Dados — visualização somente leitura para missionários comuns */}
          <Route path="/meus-dados" element={
            <ProtectedRoute>
              <MainLayout><MeusDados /></MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/meu-perfil" element={
            <ProtectedRoute>
              <MainLayout>
                <MeuPerfil />
              </MainLayout>
            </ProtectedRoute>
          } />

          <Route path="/home" element={<Navigate to="/mapa" replace />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
          </Suspense>
          <AppDialogHost />
      </Router>
      </CurrencyProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}

export default App;
