-- =============================================================
-- SCC-541 Projeto Final — Dia 2: Views e Índices
-- Conceitos: Views para reutilização de queries, Índices para
--   otimização de JOINs e filtros frequentes
-- =============================================================

-- =====================================================
-- ÍNDICES — tabelas de F1
-- =====================================================

-- results: filtros por construtor, piloto, status e corrida
-- Justificativa: as queries de dashboard e relatórios filtram
-- ou agrupam por essas colunas constantemente
CREATE INDEX IF NOT EXISTS idx_results_constructor ON results(constructor_id);
CREATE INDEX IF NOT EXISTS idx_results_driver      ON results(driver_id);
CREATE INDEX IF NOT EXISTS idx_results_status      ON results(status_id);
CREATE INDEX IF NOT EXISTS idx_results_race        ON results(race_id);

-- races: JOIN frequente com circuits e seasons
CREATE INDEX IF NOT EXISTS idx_races_circuit ON races(circuit_id);
CREATE INDEX IF NOT EXISTS idx_races_season  ON races(season_id);

-- Índices geográficos para R2 (aeroportos próximos a cidades brasileiras)
-- Justificativa: bounding-box pre-filter antes do cálculo Haversine
CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(latitude_deg, longitude_deg);
CREATE INDEX IF NOT EXISTS idx_cities_coords   ON cities(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_cities_country  ON cities(country_id);

-- =====================================================
-- VIEWS
-- =====================================================

-- View 1: temporada mais recente com circuito
-- Evita repetir a subquery MAX(year) em todo lugar
CREATE OR REPLACE VIEW vw_season_recente AS
SELECT
    r.id          AS race_id,
    r.race_name,
    r.race_date,
    r.race_time,
    s.year,
    c.id          AS circuit_id,
    c.name        AS circuit_name
FROM races r
JOIN seasons  s ON r.season_id  = s.id
JOIN circuits c ON r.circuit_id = c.id
WHERE s.year = (SELECT MAX(year) FROM seasons);

-- View 2: resultados completos (piloto + escuderia + corrida + status)
-- Usada nos relatórios R4-R7 e em buscas gerais
CREATE OR REPLACE VIEW vw_resultados AS
SELECT
    res.id,
    res.race_id,
    res.driver_id,
    res.constructor_id,
    res.position,
    res.position_order,
    res.points,
    res.laps,
    res.status_id,
    d.given_name  || ' ' || d.family_name AS driver_name,
    con.name      AS constructor_name,
    ra.race_name,
    s.year,
    c.name        AS circuit_name,
    st.status     AS status_nome
FROM results res
JOIN drivers     d   ON res.driver_id     = d.id
JOIN constructors con ON res.constructor_id = con.id
JOIN races       ra  ON res.race_id       = ra.id
JOIN seasons     s   ON ra.season_id      = s.id
JOIN circuits    c   ON ra.circuit_id     = c.id
JOIN status      st  ON res.status_id     = st.id;
