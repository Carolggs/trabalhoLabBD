import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function ComingSoon({ title }) {
  return (
    <div style={{
      color: '#fff', padding: '3rem', fontFamily: 'sans-serif',
      background: '#15151e', minHeight: '100vh'
    }}>
      <h2 style={{ color: '#e10600' }}>{title}</h2>
      <p style={{ color: '#aaa' }}>Esta funcionalidade será implementada nos próximos dias.</p>
      <a href="/dashboard" style={{ color: '#ff8000' }}>← Voltar ao Dashboard</a>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          <Route path="/relatorios" element={
            <PrivateRoute><ComingSoon title="Relatórios" /></PrivateRoute>
          } />
          <Route path="/cadastrar-piloto" element={
            <PrivateRoute><ComingSoon title="Cadastrar Piloto" /></PrivateRoute>
          } />
          <Route path="/cadastrar-escuderia" element={
            <PrivateRoute><ComingSoon title="Cadastrar Escuderia" /></PrivateRoute>
          } />
          <Route path="/buscar-piloto" element={
            <PrivateRoute><ComingSoon title="Buscar Piloto" /></PrivateRoute>
          } />
          <Route path="/inserir-pilotos-arquivo" element={
            <PrivateRoute><ComingSoon title="Importar Pilotos por Arquivo" /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
