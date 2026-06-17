-- Views e índices do projeto.
-- Os índices cobrem as colunas que aparecem em JOIN e WHERE nas queries
-- de dashboard e relatórios. Sem eles, cada consulta faria full scan
-- numa tabela de results com centenas de milhares de linhas.

-- =====================================================
-- Índices
-- =====================================================

-- results é a tabela mais consultada do projeto.
-- Quase todo relatório filtra por driver, constructor ou race,
-- então índice em cada uma dessas colunas faz diferença real.
CREATE INDEX IF NOT EXISTS idx_results_constructor ON results(constructor_id);
CREATE INDEX IF NOT EXISTS idx_results_driver      ON results(driver_id);
CREATE INDEX IF NOT EXISTS idx_results_status      ON results(status_id);
CREATE INDEX IF NOT EXISTS idx_results_race        ON results(race_id);

-- races aparece em JOIN com seasons e circuits em praticamente todo relatório
CREATE INDEX IF NOT EXISTS idx_races_circuit ON races(circuit_id);
CREATE INDEX IF NOT EXISTS idx_races_season  ON races(season_id);

-- Índices geográficos para o R2 (aeroportos próximos a cidades brasileiras).
-- A query usa um bounding box antes de calcular a distância Haversine,
-- então o índice composto em (latitude, longitude) ajuda a descartar
-- rapidamente os aeroportos que estão fora da região de interesse.
CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(latitude_deg, longitude_deg);
CREATE INDEX IF NOT EXISTS idx_cities_coords   ON cities(latitude, longitude);
-- country_id aparece no WHERE pra filtrar só cidades brasileiras (BR)
CREATE INDEX IF NOT EXISTS idx_cities_country  ON cities(country_id);

-- =====================================================
-- Views
-- =====================================================

-- Corridas da temporada mais recente com dados do circuito.
-- Criamos essa view porque a subquery (SELECT MAX(year) FROM seasons)
-- aparecia repetida em vários lugares e ficava feio ficar copiando.
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

-- View "desnormalizada" de resultados: já traz nome do piloto, da escuderia,
-- da corrida, do circuito e o status em texto — tudo junto numa linha só.
-- Os relatórios R4-R7 consultam isso sem precisar refazer todos os JOINs.
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
    ra.circuit_id,
    s.year,
    c.name        AS circuit_name,
    st.status     AS status_nome
FROM results res
JOIN drivers      d   ON res.driver_id     = d.id
JOIN constructors con ON res.constructor_id = con.id
JOIN races        ra  ON res.race_id       = ra.id
JOIN seasons      s   ON ra.season_id      = s.id
JOIN circuits     c   ON ra.circuit_id     = c.id
JOIN status       st  ON res.status_id     = st.id;
