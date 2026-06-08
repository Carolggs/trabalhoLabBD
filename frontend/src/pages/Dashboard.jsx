import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
        <div className="dash-brand">
          <span className="dash-brand-f1">F1</span>
          <span className="dash-brand-db">DataBase</span>
        </div>

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

        {user.tipo === 'Admin'     && <AdminDash />}
        {user.tipo === 'Escuderia' && <EscuderiaDash user={user} />}
        {user.tipo === 'Piloto'    && <PilotoDash user={user} />}

        {/* Navegação — botões para Telas 2 e 3 */}
        <div className="dash-nav-cards">
          <button className="nav-card" onClick={() => navigate('/relatorios')}>
            <span className="nav-card-icon">📊</span>
            <span>Relatórios</span>
          </button>

          {user.tipo === 'Admin' && (
            <>
              <button className="nav-card" onClick={() => navigate('/cadastrar-piloto')}>
                <span className="nav-card-icon">🏎️</span>
                <span>Cadastrar Piloto</span>
              </button>
              <button className="nav-card" onClick={() => navigate('/cadastrar-escuderia')}>
                <span className="nav-card-icon">🏁</span>
                <span>Cadastrar Escuderia</span>
              </button>
            </>
          )}

          {user.tipo === 'Escuderia' && (
            <>
              <button className="nav-card" onClick={() => navigate('/buscar-piloto')}>
                <span className="nav-card-icon">🔍</span>
                <span>Buscar Piloto</span>
              </button>
              <button className="nav-card" onClick={() => navigate('/inserir-pilotos-arquivo')}>
                <span className="nav-card-icon">📂</span>
                <span>Importar Pilotos</span>
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function AdminDash() {
  return (
    <div className="dash-info-card">
      <h2>Painel Administrativo</h2>
      <p className="dash-info-text">
        Acesso completo à base de dados da Fórmula 1.
        As estatísticas da temporada mais recente serão carregadas aqui.
      </p>
      <div className="dash-placeholder">[Estatísticas — Dia 2]</div>
    </div>
  );
}

function EscuderiaDash({ user }) {
  return (
    <div className="dash-info-card">
      <h2>{user.displayName}</h2>
      <p className="dash-info-text">
        Visualize o desempenho da sua escuderia, pilotos associados e histórico de corridas.
      </p>
      <div className="dash-placeholder">[Estatísticas da escuderia — Dia 2]</div>
    </div>
  );
}

function PilotoDash({ user }) {
  return (
    <div className="dash-info-card">
      <h2>{user.displayName}</h2>
      <p className="dash-info-text">
        Acompanhe seu desempenho, pontos por temporada e histórico em circuitos.
      </p>
      <div className="dash-placeholder">[Estatísticas do piloto — Dia 2]</div>
    </div>
  );
}
