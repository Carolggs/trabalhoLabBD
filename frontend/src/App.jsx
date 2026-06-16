import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { CadastrarPiloto, CadastrarEscuderia } from './pages/CadastrarPiloto';
import { BuscarPiloto, ImportarPilotos } from './pages/EscuderiaPages';
import Relatorios from './pages/Relatorios';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
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

          <Route path="/cadastrar-piloto" element={
            <PrivateRoute><CadastrarPiloto /></PrivateRoute>
          } />

          <Route path="/cadastrar-escuderia" element={
            <PrivateRoute><CadastrarEscuderia /></PrivateRoute>
          } />

          <Route path="/buscar-piloto" element={
            <PrivateRoute><BuscarPiloto /></PrivateRoute>
          } />

          <Route path="/inserir-pilotos-arquivo" element={
            <PrivateRoute><ImportarPilotos /></PrivateRoute>
          } />

          <Route path="/relatorios" element={
            <PrivateRoute><Relatorios /></PrivateRoute>
          } />

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
