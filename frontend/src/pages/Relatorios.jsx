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
  const [cidade, setCidade] = useState('');
  const { data, loading, error, load, reset } = useReport(() => api.getRelatorioR2(cidade));

  function handleReset() {
    reset();
    setCidade('');
  }

  return (
    <ReportSection title="R2 — Aeroportos Próximos a Cidade Brasileira" onClose={data ? handleReset : undefined}>
      <p className="report-desc">
        Informe o nome de uma cidade brasileira. Serão exibidos aeroportos do tipo
        <em> medium_airport</em> ou <em>large_airport</em> a no máximo 100 km,
        usando a fórmula de Haversine.
      </p>

      {!data && (
        <div className="report-input-row">
          <input
            className="report-input"
            type="text"
            placeholder="Ex: São Paulo, Campinas, Brasília..."
            value={cidade}
            onChange={e => setCidade(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && cidade.trim() && load()}
            disabled={loading}
          />
          <button
            className="btn-report"
            onClick={load}
            disabled={loading || !cidade.trim()}
          >
            {loading
              ? <><Loader size={14} className="icon-spin" /> Calculando...</>
              : 'Buscar Aeroportos'}
          </button>
        </div>
      )}

      {error && <p className="report-error">{error}</p>}

      {data && (
        <>
          <p className="report-count">
            {data.rows.length} aeroporto(s) encontrado(s) próximo(s) a <strong>{data.cidade_buscada}</strong>.
          </p>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Nova Busca</button>
          <ReportTable
            columns={[
              { key: 'cidade_pesquisada',  label: 'Cidade Pesquisada' },
              { key: 'iata_code',          label: 'IATA' },
              { key: 'airport_nome',       label: 'Aeroporto' },
              { key: 'cidade_aeroporto',   label: 'Cidade do Aeroporto' },
              { key: 'distancia_km',       label: 'Distância (km)', align: 'right' },
              { key: 'tipo',               label: 'Tipo' },
            ]}
            rows={data.rows}
            emptyMsg="Nenhum aeroporto medium/large encontrado a ≤100 km dessa cidade."
          />
        </>
      )}
    </ReportSection>
  );
}

function R3_HierarquiaCorridas() {
  const { data, loading, error, load, reset } = useReport(() => api.getRelatorioR3());

  // expandedCon: constructor_id expandido (um por vez)
  const [expandedCon, setExpandedCon]     = useState(null);
  const [conData, setConData]             = useState({});   // { [con_id]: { loading, circuits } }
  // expandedCir: circuit_id expandido dentro do constructor atual (um por vez)
  const [expandedCir, setExpandedCir]     = useState(null);
  const [cirData, setCirData]             = useState({});   // { [cir_id]: { loading, races } }

  function handleReset() {
    reset();
    setExpandedCon(null);
    setConData({});
    setExpandedCir(null);
    setCirData({});
  }

  async function toggleConstructor(constructor_id) {
    if (expandedCon === constructor_id) {
      setExpandedCon(null);
      setExpandedCir(null);
      return;
    }
    setExpandedCon(constructor_id);
    setExpandedCir(null);
    if (conData[constructor_id]) return;
    setConData(prev => ({ ...prev, [constructor_id]: { loading: true, circuits: null } }));
    try {
      const result = await api.getRelatorioR3Circuitos(constructor_id);
      setConData(prev => ({ ...prev, [constructor_id]: { loading: false, circuits: result.circuits } }));
    } catch {
      setConData(prev => ({ ...prev, [constructor_id]: { loading: false, circuits: [] } }));
    }
  }

  async function toggleCircuit(constructor_id, circuit_id) {
    if (expandedCir === circuit_id) { setExpandedCir(null); return; }
    setExpandedCir(circuit_id);
    if (cirData[circuit_id]) return;
    setCirData(prev => ({ ...prev, [circuit_id]: { loading: true, races: null } }));
    try {
      const result = await api.getRelatorioR3Corridas(constructor_id, circuit_id);
      setCirData(prev => ({ ...prev, [circuit_id]: { loading: false, races: result.races } }));
    } catch {
      setCirData(prev => ({ ...prev, [circuit_id]: { loading: false, races: [] } }));
    }
  }

  return (
    <ReportSection title="R3 — Escuderias e Hierarquia de Corridas" onClose={data ? handleReset : undefined}>
      <p className="report-desc">
        Escuderias com qtd de pilotos. Clique numa escuderia para ver o nível 1 (total de corridas)
        e nível 2 (circuitos com min/avg/max voltas). Clique num circuito para ver o nível 3
        (cada corrida com voltas registradas e pilotos participantes).
      </p>
      {!data && !loading && (
        <button className="btn-report" onClick={load}>Gerar Relatório</button>
      )}
      {loading && <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando...</p>}
      {error && <p className="report-error">{error}</p>}
      {data && (
        <>
          <button className="btn-report btn-reload" onClick={load}><RefreshCw size={14} /> Atualizar</button>
          <div className="report-table-wrapper">
            <table className="report-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Escuderia</th>
                  <th className="text-right">Pilotos</th>
                  <th className="text-right">Corridas</th>
                </tr>
              </thead>
              <tbody>
                {data.constructors.map(con => (
                  <>
                    {/* Nível 0: linha da escuderia */}
                    <tr
                      key={con.constructor_id}
                      className={`circuit-row ${expandedCon === con.constructor_id ? 'expanded' : ''}`}
                      onClick={() => toggleConstructor(con.constructor_id)}
                    >
                      <td className="expand-icon">
                        {expandedCon === con.constructor_id
                          ? <ChevronDown size={14} />
                          : <ChevronRight size={14} />}
                      </td>
                      <td>{con.constructor_name}</td>
                      <td className="text-right">{con.num_pilotos}</td>
                      <td className="text-right">{con.total_corridas}</td>
                    </tr>

                    {/* Níveis 1+2+3: expandido sob a escuderia */}
                    {expandedCon === con.constructor_id && (
                      <tr key={`con-detail-${con.constructor_id}`} className="detail-row">
                        <td colSpan={4}>
                          {conData[con.constructor_id]?.loading && (
                            <p className="report-loading"><Loader size={14} className="icon-spin" /> Carregando circuitos...</p>
                          )}
                          {conData[con.constructor_id]?.circuits && (() => {
                            const circuits = conData[con.constructor_id].circuits;
                            const totalCorridas = circuits.reduce((s, c) => s + parseInt(c.total_corridas), 0);
                            return (
                              <div className="races-detail">
                                {/* Nível 1: total de corridas da escuderia */}
                                <div className="report-stat-banner" style={{ marginBottom: '0.75rem' }}>
                                  Total de corridas desta escuderia: <strong>{totalCorridas}</strong>
                                </div>
                                {/* Nível 2: tabela de circuitos */}
                                {circuits.length === 0 ? (
                                  <p className="report-empty">Nenhuma corrida registrada.</p>
                                ) : (
                                  <table className="pilots-table">
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
                                      {circuits.map(cir => (
                                        <>
                                          <tr
                                            key={cir.circuit_id}
                                            className={`circuit-row ${expandedCir === cir.circuit_id ? 'expanded' : ''}`}
                                            onClick={() => toggleCircuit(con.constructor_id, cir.circuit_id)}
                                          >
                                            <td className="expand-icon">
                                              {expandedCir === cir.circuit_id
                                                ? <ChevronDown size={12} />
                                                : <ChevronRight size={12} />}
                                            </td>
                                            <td>{cir.circuit_name}</td>
                                            <td className="text-right">{cir.total_corridas}</td>
                                            <td className="text-right">{cir.min_voltas ?? '—'}</td>
                                            <td className="text-right">{cir.avg_voltas ?? '—'}</td>
                                            <td className="text-right">{cir.max_voltas ?? '—'}</td>
                                          </tr>
                                          {/* Nível 3: corridas do circuito desta escuderia */}
                                          {expandedCir === cir.circuit_id && (
                                            <tr key={`cir-detail-${cir.circuit_id}`} className="detail-row">
                                              <td colSpan={6} style={{ paddingLeft: '2rem' }}>
                                                {cirData[cir.circuit_id]?.loading && (
                                                  <p className="report-loading"><Loader size={12} className="icon-spin" /> Carregando corridas...</p>
                                                )}
                                                {cirData[cir.circuit_id]?.races && (
                                                  cirData[cir.circuit_id].races.length === 0
                                                    ? <p className="report-empty">Sem corridas.</p>
                                                    : <table className="pilots-table">
                                                        <thead>
                                                          <tr>
                                                            <th>Ano</th>
                                                            <th>Corrida</th>
                                                            <th className="text-right">Voltas</th>
                                                            <th className="text-right">Pilotos</th>
                                                          </tr>
                                                        </thead>
                                                        <tbody>
                                                          {cirData[cir.circuit_id].races.map((race, i) => (
                                                            <tr key={i}>
                                                              <td>{race.year}</td>
                                                              <td>{race.race_name}</td>
                                                              <td className="text-right">{race.total_voltas}</td>
                                                              <td className="text-right">{race.num_pilotos}</td>
                                                            </tr>
                                                          ))}
                                                        </tbody>
                                                      </table>
                                                )}
                                              </td>
                                            </tr>
                                          )}
                                        </>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            );
                          })()}
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
