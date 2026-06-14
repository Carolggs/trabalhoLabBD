import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import './DashboardContent.css';

export function AdminDash() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const data = await api.getAdminDashboard();
      setStats(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="dash-loading">Carregando dados...</div>;
  if (error) return <div className="dash-error">{error}</div>;
  if (!stats) return null;

  return (
    <div className="dash-content">
      <h2 className="section-title">Painel Administrativo</h2>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total_drivers || 0}</div>
          <div className="stat-label">Pilotos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_constructors || 0}</div>
          <div className="stat-label">Escuderias</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.total_seasons || 0}</div>
          <div className="stat-label">Temporadas</div>
        </div>
      </div>

      {/* Corridas da temporada */}
      <section className="dash-section">
        <h3>Corridas da Temporada Recente</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Corrida</th>
              <th>Circuito</th>
              <th>Data</th>
              <th>Hora</th>
              <th>Participantes</th>
            </tr>
          </thead>
          <tbody>
            {(stats.recent_races || []).map(r => (
              <tr key={r.id}>
                <td>{r.race_name}</td>
                <td>{r.circuit}</td>
                <td>{new Date(r.race_date).toLocaleDateString('pt-BR')}</td>
                <td>{r.race_time || '—'}</td>
                <td>{r.participantes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Escuderias com pontos */}
      <section className="dash-section">
        <h3>Escuderias — Pontos (Temporada Recente)</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Escuderia</th>
              <th>Pontos</th>
            </tr>
          </thead>
          <tbody>
            {(stats.constructors_points || []).map((c, i) => (
              <tr key={i}>
                <td>{c.name}</td>
                <td className="text-right">{parseFloat(c.total_pontos).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Pilotos com pontos */}
      <section className="dash-section">
        <h3>Pilotos — Pontos (Temporada Recente)</h3>
        <table className="dash-table">
          <thead>
            <tr>
              <th>Piloto</th>
              <th>Pontos</th>
            </tr>
          </thead>
          <tbody>
            {(stats.drivers_points || []).map((d, i) => (
              <tr key={i}>
                <td>{d.nome}</td>
                <td className="text-right">{parseFloat(d.total_pontos).toFixed(0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function EscuderiaDash({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await api.getEscuderiaDashboard(user.id_original);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="dash-loading">Carregando dados...</div>;
  if (error) return <div className="dash-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="dash-content">
      <h2 className="section-title">{user.displayName}</h2>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{data.vitories || 0}</div>
          <div className="stat-label">Vitórias</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.pilots_count || 0}</div>
          <div className="stat-label">Pilotos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {data.first_year ? `${data.first_year}–${data.last_year}` : '—'}
          </div>
          <div className="stat-label">Anos na F1</div>
        </div>
      </div>
    </div>
  );
}

export function PilotoDash({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  async function loadData() {
    try {
      setLoading(true);
      const result = await api.getPilotoDashboard(user.id_original);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="dash-loading">Carregando dados...</div>;
  if (error) return <div className="dash-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="dash-content">
      <h2 className="section-title">{user.displayName}</h2>
      {data.team_name && (
        <p className="dash-team-name">Escuderia atual: <strong>{data.team_name}</strong></p>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">
            {data.first_year ? `${data.first_year}–${data.last_year}` : '—'}
          </div>
          <div className="stat-label">Anos na F1</div>
        </div>
      </div>

      {data.performance && data.performance.length > 0 && (
        <section className="dash-section">
          <h3>Desempenho por Ano e Circuito</h3>
          <table className="dash-table">
            <thead>
              <tr>
                <th>Ano</th>
                <th>Circuito</th>
                <th>Pontos</th>
                <th>Vitórias</th>
                <th>Corridas</th>
              </tr>
            </thead>
            <tbody>
              {data.performance.map((p, i) => (
                <tr key={i}>
                  <td>{p.year}</td>
                  <td>{p.circuit_name}</td>
                  <td className="text-right">{p.total_points}</td>
                  <td className="text-right">{p.victories}</td>
                  <td className="text-right">{p.races}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
