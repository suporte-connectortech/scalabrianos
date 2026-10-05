import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Home from './pages/Home';
import CasasReligiosas from './pages/CasasReligiosas';
import ItinerarioFormativo from './pages/ItinerarioFormativo';
import Seminario from './pages/Seminario';
import Propedeutico from './pages/Propedeutico';
import Filosofia from './pages/Filosofia';
import Postulado from './pages/Postulado';
import Perfis from './pages/Perfis';
import Administradores from './pages/Administradores';
import Missionarios from './pages/Missionarios';
import PerfilMissionario from './pages/PerfilMissionario';
import PerfilCasa from './pages/PerfilCasa';
import Logs from './pages/Logs';
import LogsAcesso from './pages/LogsAcesso';
import Relatorios from './pages/Relatorios';
import Financeiro from './pages/Financeiro';
import ExtratosMensais from './pages/ExtratosMensais';
import MeuPerfil from './pages/MeuPerfil';
import GestaoFinanceira from './pages/GestaoFinanceira';
import MapaRNSMM from './pages/MapaRNSMM';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import MainLayout from './components/Layout/MainLayout';
import { AuthProvider } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CurrencyProvider>
          <Router>
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
      </Router>
      </CurrencyProvider>
    </AuthProvider>
  </ErrorBoundary>
  );
}

export default App;
