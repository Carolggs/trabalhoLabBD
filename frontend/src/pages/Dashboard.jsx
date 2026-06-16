import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AdminDash, EscuderiaDash, PilotoDash } from './Dashboard/DashboardContent';
import { BarChart2, Car, Flag, Search, FolderOpen } from 'lucide-react';
import F1Brand from '../components/F1Brand';
import './Dashboard.css';

const TYPE_LABELS = {
  Admin:     { label: 'Administrador', color: '#e10600' },
  Escuderia: { label: 'Escuderia',     color: '#ff8000' },
  Piloto:    { label: 'Piloto',        color: '#0067ff' },
};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  if (!user) return null;

  const badge = TYPE_LABELS[user.tipo] || { label: user.tipo, color: '#888' };

  return (
    <div className="dash-root">
      <header className="dash-header">
        <F1Brand size="sm" />

        <div className="dash-user-info">
          <span
            className="dash-badge"
            style={{ borderColor: badge.color, color: badge.color }}
          >
            {badge.label}
          </span>
          <span className="dash-username">{user.displayName}</span>
          <button className="btn-logout" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      <main className="dash-main">
        <h1 className="dash-title">Dashboard</h1>

        {/* Componentes de dashboard por tipo */}
        {user.tipo === 'Admin'     && <AdminDash />}
        {user.tipo === 'Escuderia' && <EscuderiaDash user={user} />}
        {user.tipo === 'Piloto'    && <PilotoDash user={user} />}

        {/* Cards de navegação */}
        <div className="dash-nav-cards">
          <button className="nav-card" onClick={() => navigate('/relatorios')}>
            <span className="nav-card-icon"><BarChart2 size={22} /></span>
            <span>Relatórios</span>
          </button>

          {user.tipo === 'Admin' && (
            <>
              <button className="nav-card" onClick={() => navigate('/cadastrar-piloto')}>
                <span className="nav-card-icon"><Car size={22} /></span>
                <span>Cadastrar Piloto</span>
              </button>
              <button className="nav-card" onClick={() => navigate('/cadastrar-escuderia')}>
                <span className="nav-card-icon"><Flag size={22} /></span>
                <span>Cadastrar Escuderia</span>
              </button>
            </>
          )}

          {user.tipo === 'Escuderia' && (
            <>
              <button className="nav-card" onClick={() => navigate('/buscar-piloto')}>
                <span className="nav-card-icon"><Search size={22} /></span>
                <span>Buscar Piloto</span>
              </button>
              <button className="nav-card" onClick={() => navigate('/inserir-pilotos-arquivo')}>
                <span className="nav-card-icon"><FolderOpen size={22} /></span>
                <span>Importar Pilotos</span>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
