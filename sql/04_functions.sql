-- =============================================================
-- SCC-541 Projeto Final — Dia 2: Funções Armazenadas
-- Conceitos: Stored Functions, RETURNS TABLE, plpgsql
-- =============================================================

-- =====================================================
-- ESCUDERIA FUNCTIONS
-- =====================================================

-- Função 1: Contar vitórias de uma escuderia
-- Conceito: Função simples que retorna INTEGER
CREATE OR REPLACE FUNCTION fn_escuderia_vitories(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM results
    WHERE constructor_id = p_constructor_id AND position = '1'
  );
END;
$$ LANGUAGE plpgsql;

-- Função 2: Contar pilotos diferentes de uma escuderia
-- Conceito: DISTINCT para contar valores únicos
CREATE OR REPLACE FUNCTION fn_escuderia_pilots_count(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT driver_id) FROM results
    WHERE constructor_id = p_constructor_id
  );
END;
$$ LANGUAGE plpgsql;

-- Função 3: Primeiro e último ano de uma escuderia
-- Conceito: RETURNS TABLE para retornar múltiplas colunas
CREATE OR REPLACE FUNCTION fn_escuderia_years(p_constructor_id INTEGER)
RETURNS TABLE(first_year INTEGER, last_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT MIN(s.year)::INTEGER, MAX(s.year)::INTEGER
  FROM results r
  JOIN races ra ON r.race_id = ra.id
  JOIN seasons s ON ra.season_id = s.id
  WHERE r.constructor_id = p_constructor_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DRIVER (PILOTO) FUNCTIONS
-- =====================================================

-- Função 4: Primeiro e último ano de um piloto
-- Conceito: Similar à fn_escuderia_years, mas para drivers
CREATE OR REPLACE FUNCTION fn_driver_years(p_driver_id INTEGER)
RETURNS TABLE(first_year INTEGER, last_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT MIN(s.year)::INTEGER, MAX(s.year)::INTEGER
  FROM results r
  JOIN races ra ON r.race_id = ra.id
  JOIN seasons s ON ra.season_id = s.id
  WHERE r.driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql;

-- Função 5: Desempenho de um piloto por ano e circuito
-- Conceito: RETURNS TABLE com múltiplas linhas (agregação por ano/circuito)
CREATE OR REPLACE FUNCTION fn_driver_performance(p_driver_id INTEGER)
RETURNS TABLE(
  year INTEGER,
  circuit_name TEXT,
  total_points NUMERIC,
  victories INTEGER,
  races INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.year,
    c.name,
    SUM(r.points)::NUMERIC,
    COUNT(CASE WHEN r.position = '1' THEN 1 END)::INTEGER,
    COUNT(*)::INTEGER
  FROM results r
  JOIN races ra ON r.race_id = ra.id
  JOIN seasons s ON ra.season_id = s.id
  JOIN circuits c ON ra.circuit_id = c.id
  WHERE r.driver_id = p_driver_id
  GROUP BY s.year, c.id, c.name
  ORDER BY s.year DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TESTES DAS FUNÇÕES
-- =====================================================

-- Teste 1: Vitórias da McLaren (constructor_id = 20)
SELECT fn_escuderia_vitories(20) AS mclaren_vitories;

-- Teste 2: Pilotos da McLaren
SELECT fn_escuderia_pilots_count(20) AS mclaren_pilots;

-- Teste 3: Anos da McLaren
SELECT * FROM fn_escuderia_years(20);

-- Teste 4: Anos do Hamilton (driver_id = 83)
SELECT * FROM fn_driver_years(83);

-- Teste 5: Desempenho do Hamilton (primeiros 10 registros)
SELECT * FROM fn_driver_performance(83) LIMIT 10;
