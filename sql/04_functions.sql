-- Funções armazenadas usadas nas telas de dashboard de escuderia e piloto.
-- Cada função encapsula uma query que seria repetida em vários lugares
-- se ficasse só no backend.

-- =====================================================
-- Funções de Escuderia
-- =====================================================

-- Conta quantas vezes a escuderia terminou em 1º lugar.
-- position fica como VARCHAR no schema (pode ser "1", "R", "D"...),
-- por isso comparamos com a string '1' e não com inteiro.
CREATE OR REPLACE FUNCTION fn_escuderia_vitories(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*) FROM results
    WHERE constructor_id = p_constructor_id AND position = '1'
  );
END;
$$ LANGUAGE plpgsql;

-- Conta quantos pilotos distintos já correram pela escuderia.
-- DISTINCT porque o mesmo piloto pode ter corrido várias temporadas pela mesma equipe.
CREATE OR REPLACE FUNCTION fn_escuderia_pilots_count(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(DISTINCT driver_id) FROM results
    WHERE constructor_id = p_constructor_id
  );
END;
$$ LANGUAGE plpgsql;

-- Retorna o primeiro e o último ano em que a escuderia aparece nos resultados.
-- RETURNS TABLE porque precisamos devolver duas colunas de uma vez.
-- O ::INTEGER é necessário porque MIN/MAX sobre INTEGER já devolve INTEGER,
-- mas o cast explícito evita problemas de tipo na hora de serializar no backend.
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
-- Funções de Piloto
-- =====================================================

-- Mesma ideia de fn_escuderia_years, mas para pilotos.
-- Vai no dashboard pra mostrar "ativo entre X e Y".
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

-- Retorna o desempenho do piloto agrupado por ano e circuito:
-- pontos totais, vitórias e número de corridas em cada combinação.
-- ORDER BY dentro da função já entrega ordenado pro frontend sem precisar re-ordenar.
CREATE OR REPLACE FUNCTION fn_driver_performance(p_driver_id INTEGER)
RETURNS TABLE(
  year        INTEGER,
  circuit_name TEXT,
  total_points NUMERIC,
  victories    INTEGER,
  races        INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.year,
    c.name,
    SUM(r.points)::NUMERIC,
    -- CASE dentro do COUNT é o jeito padrão de contar só as linhas que satisfazem uma condição
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
-- Testes manuais — rodar pra conferir se as funções estão ok
-- =====================================================

-- McLaren tem constructor_id = 20 na base
SELECT fn_escuderia_vitories(20)   AS vitorias_mclaren;
SELECT fn_escuderia_pilots_count(20) AS pilotos_mclaren;
SELECT * FROM fn_escuderia_years(20);

-- Hamilton tem driver_id = 83 na base
SELECT * FROM fn_driver_years(83);
SELECT * FROM fn_driver_performance(83) LIMIT 10;
