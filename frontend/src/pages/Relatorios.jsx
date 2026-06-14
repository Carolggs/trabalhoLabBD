import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { ArrowLeft, ChevronDown, ChevronRight, RefreshCw, Loader, X } from 'lucide-react';
import F1Brand from '../components/F1Brand';
import './Relatorios.css';

// ─── Utilitários ────────────────────────────────────────────────────────────

function ReportSection({ title, onClose, children }) {
  return (
    <section className="report-section">
      <div className="report-section-header">
        <h2 className="report-section-title">{title}</h2>
        {onClose && (
          <button className="btn-close-report" onClick={onClose} title="Fechar relatório">
            <X size={16} />
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function ReportTable({ columns, rows, emptyMsg = 'Nenhum resultado.' }) {
  if (!rows || rows.length === 0) return <p className="report-empty">{emptyMsg}</p>;
  return (
    <div className="report-table-wrapper">
      <table className="report-table">
        <thead>
          <tr>{columns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map(c => (
                <td key={c.key} className={c.align === 'right' ? 'text-right' : ''}>
                  {row[c.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useReport(fetchFn) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function load() {
    try {
      setLoading(true);
      setError('');
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setData(null);
    setError('');
  }

  return { data, loading, error, load, reset };
}

// ─── RELATÓRIOS ADMIN ───────────────────────────────────────────────────────

function R1_StatusResultados() {
  const { data, loading, error, load, reset } = useReport(() => api.getRelatorioR1());
  return (
    <ReportSection title="R1 — Resultados por Status" onClose={data ? reset : undefined}>
      <p className="report-desc">Contagem de todos os resultados agrupada por tipo de status.</p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <ReportTable
            columns={[
              { key: 'status_nome', label: 'Status' },
              { key: 'quantidade',  label: 'Quantidade', align: 'right' },
            ]}
            rows={data.rows}
          />
        </>
      )}
    </ReportSection>
  );
}

function R2_AeroportosBrasil() {
  const { data, loading, error, load, reset } = useReport(() => api.getRelatorioR2());
  return (
    <ReportSection title="R2 — Aeroportos a ≤100 km de Cidade Brasileira" onClose={data ? reset : undefined}>
      <p className="report-desc">
        Aeroportos (com código IATA) localizados a no máximo 100 km de alguma cidade brasileira.
        Distância calculada com a fórmula de Haversine.
      </p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Calculando distâncias... (pode demorar alguns segundos)</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <p className="report-count">{data.rows.length} aeroportos encontrados.</p>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <ReportTable
            columns={[
              { key: 'iata_code',    label: 'IATA' },
              { key: 'airport_nome', label: 'Aeroporto' },
              { key: 'cidade',       label: 'Cidade Brasileira Mais Próxima' },
              { key: 'distancia_km', label: 'Distância (km)', align: 'right' },
              { key: 'tipo',         label: 'Tipo' },
            ]}
            rows={data.rows}
          />
        </>
      )}
    </ReportSection>
  );
}

function R3_HierarquiaCorridas() {
  const { data, loading, error, load, reset } = useReport(() => api.getRelatorioR3());
  const [expanded, setExpanded]               = useState(null);
  const [detail, setDetail]                   = useState({});
  const [loadingDetail, setLoadingDetail]     = useState(null);

  function handleReset() {
    reset();
    setExpanded(null);
    setDetail({});
  }

  async function toggleCircuit(circuit_id) {
    if (expanded === circuit_id) { setExpanded(null); return; }
    setExpanded(circuit_id);
    if (detail[circuit_id]) return;
    try {
      setLoadingDetail(circuit_id);
      const result = await api.getRelatorioR3Detalhe(circuit_id);
      setDetail(prev => ({ ...prev, [circuit_id]: result.races }));
    } catch {
      setDetail(prev => ({ ...prev, [circuit_id]: [] }));
    } finally {
      setLoadingDetail(null);
    }
  }

  return (
    <ReportSection title="R3 — Hierarquia de Corridas por Circuito" onClose={data ? handleReset : undefined}>
      <p className="report-desc">
        Nível 1: total geral de corridas. Nível 2: por circuito (min/avg/max voltas).
        Nível 3: clique em um circuito para ver corridas e top 10 pilotos.
      </p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <div className="report-stat-banner">
            Total geral de corridas na base: <strong>{data.total_corridas}</strong>
          </div>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>

          <div className="report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Circuito</th>
                  <th className="text-right">Corridas</th>
                  <th className="text-right">Min Voltas</th>
                  <th className="text-right">Avg Voltas</th>
                  <th className="text-right">Max Voltas</th>
                </tr>
              </thead>
              <tbody>
                {data.circuits.map(c => (
                  <>
                    <tr
                      key={c.circuit_id}
                      className={`circuit-row ${expanded === c.circuit_id ? 'expanded' : ''}`}
                      onClick={() => toggleCircuit(c.circuit_id)}
                    >
                      <td className="expand-icon">
                        {expanded === c.circuit_id
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </td>
                      <td>{c.circuit_name}</td>
                      <td className="text-right">{c.total_corridas}</td>
                      <td className="text-right">{c.min_voltas ?? '—'}</td>
                      <td className="text-right">{c.avg_voltas ?? '—'}</td>
                      <td className="text-right">{c.max_voltas ?? '—'}</td>
                    </tr>

                    {expanded === c.circuit_id && (
                      <tr key={`detail-${c.circuit_id}`} className="detail-row">
                        <td colSpan={6}>
                          {loadingDetail === c.circuit_id && (
                            <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando corridas...</p>
                          )}
                          {detail[c.circuit_id] && (
                            <div className="races-detail">
                              {detail[c.circuit_id].length === 0 ? (
                                <p className="report-empty">Sem dados detalhados.</p>
                              ) : (
                                detail[c.circuit_id].map(race => (
                                  <div key={race.race_id} className="race-block">
                                    <div className="race-header">
                                      <span className="race-name">{race.race_name}</span>
                                      <span className="race-meta">
                                        {race.year} · {race.total_voltas} voltas · {race.num_pilotos} pilotos
                                      </span>
                                    </div>
                                    {race.pilotos && race.pilotos.length > 0 && (
                                      <table className="pilots-table">
                                        <thead>
                                          <tr>
                                            <th>Pos.</th>
                                            <th>Piloto</th>
                                            <th className="text-right">Voltas</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {race.pilotos.map((p, i) => (
                                            <tr key={i}>
                                              <td>{p.position ?? '—'}</td>
                                              <td>{p.driver_name}</td>
                                              <td className="text-right">{p.laps ?? '—'}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ReportSection>
  );
}

// ─── RELATÓRIOS ESCUDERIA ────────────────────────────────────────────────────

function R4_PilotosVitorias({ constructorId }) {
  const { data, loading, error, load, reset } = useReport(
    () => api.getRelatorioR4(constructorId)
  );
  return (
    <ReportSection title="R4 — Pilotos e Quantidade de 1ª Posição" onClose={data ? reset : undefined}>
      <p className="report-desc">Todos os pilotos que já correram pela escuderia e quantas vezes terminaram em 1º lugar.</p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <ReportTable
            columns={[
              { key: 'driver_name',        label: 'Piloto' },
              { key: 'primeiras_posicoes', label: '1ª Posições', align: 'right' },
            ]}
            rows={data.rows}
          />
        </>
      )}
    </ReportSection>
  );
}

function R5_StatusEscuderia({ constructorId }) {
  const { data, loading, error, load, reset } = useReport(
    () => api.getRelatorioR5(constructorId)
  );
  return (
    <ReportSection title="R5 — Resultados por Status (Escuderia)" onClose={data ? reset : undefined}>
      <p className="report-desc">Distribuição dos resultados da escuderia por tipo de status.</p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <ReportTable
            columns={[
              { key: 'status_nome', label: 'Status' },
              { key: 'quantidade',  label: 'Quantidade', align: 'right' },
            ]}
            rows={data.rows}
          />
        </>
      )}
    </ReportSection>
  );
}

// ─── RELATÓRIOS PILOTO ───────────────────────────────────────────────────────

function R6_PontosPorAno({ driverId }) {
  const { data, loading, error, load, reset } = useReport(
    () => api.getRelatorioR6(driverId)
  );

  function groupByYear(rows) {
    const map = {};
    for (const row of rows) {
      if (!map[row.ano]) map[row.ano] = [];
      map[row.ano].push(row);
    }
    return map;
  }

  return (
    <ReportSection title="R6 — Pontos por Ano e Corridas" onClose={data ? reset : undefined}>
      <p className="report-desc">Corridas onde o piloto marcou pontos, agrupadas por temporada.</p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && data.rows.length === 0 && (
        <p className="report-empty">Nenhuma corrida com pontos encontrada.</p>
      )}
      {data && data.rows.length > 0 && (() => {
        const grouped = groupByYear(data.rows);
        return (
          <>
            <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
            {Object.keys(grouped).sort((a, b) => b - a).map(ano => {
              const corridas = grouped[ano];
              const totalAno = corridas.reduce((s, r) => s + parseFloat(r.pontos), 0);
              return (
                <div key={ano} className="year-block">
                  <div className="year-header">
                    <span className="year-label">{ano}</span>
                    <span className="year-total">{totalAno.toFixed(0)} pts</span>
                  </div>
                  <table className="report-table">
                    <thead>
                      <tr>
                        <th>Corrida</th>
                        <th className="text-right">Pontos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corridas.map((c, i) => (
                        <tr key={i}>
                          <td>{c.corrida}</td>
                          <td className="text-right">{c.pontos}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </>
        );
      })()}
    </ReportSection>
  );
}

function R7_StatusPiloto({ driverId }) {
  const { data, loading, error, load, reset } = useReport(
    () => api.getRelatorioR7(driverId)
  );
  return (
    <ReportSection title="R7 — Resultados por Status (Piloto)" onClose={data ? reset : undefined}>
      <p className="report-desc">Distribuição de todos os resultados do piloto por tipo de status.</p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <ReportTable
            columns={[
              { key: 'status_nome', label: 'Status' },
              { key: 'quantidade',  label: 'Quantidade', align: 'right' },
            ]}
            rows={data.rows}
          />
        </>
      )}
    </ReportSection>
  );
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────

export default function Relatorios() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <div className="relatorios-page">
      <header className="relatorios-header">
        <F1Brand size="sm" />
        <div className="relatorios-nav">
          <button className="btn-back" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} /> Dashboard
          </button>
        </div>
      </header>

      <main className="relatorios-main">
        <h1 className="relatorios-title">Relatórios</h1>

        {user.tipo === 'Admin' && (
          <>
            <R1_StatusResultados />
            <R2_AeroportosBrasil />
            <R3_HierarquiaCorridas />
          </>
        )}

        {user.tipo === 'Escuderia' && (
          <>
            <R4_PilotosVitorias constructorId={user.id_original} />
            <R5_StatusEscuderia constructorId={user.id_original} />
          </>
        )}

        {user.tipo === 'Piloto' && (
          <>
            <R6_PontosPorAno driverId={user.id_original} />
            <R7_StatusPiloto driverId={user.id_original} />
          </>
        )}
      </main>
    </div>
  );
}
