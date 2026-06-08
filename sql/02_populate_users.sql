-- =============================================================
-- SCC-541 Projeto Final — Dia 1: Popular USERS a partir da base F1
-- Conceito: INSERT com SELECT (conjunto), md5() para hash seguro,
--           ON CONFLICT para idempotência
-- =============================================================

-- -------------------------------------------------------------
-- Inserir usuário para cada ESCUDERIA (padrão: <constructor_ref>_c)
-- Senha = constructor_ref (hasheada com MD5)
-- id_original = constructors.id
-- Conceito: junção implícita entre CONSTRUCTORS e USERS via INSERT SELECT
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    c.constructor_ref || '_c'     AS login,
    md5(c.constructor_ref)        AS password,   -- hash MD5 da senha
    'Escuderia'                   AS tipo,
    c.id                          AS id_original
FROM constructors c
ON CONFLICT (login) DO NOTHING;

-- -------------------------------------------------------------
-- Inserir usuário para cada PILOTO (padrão: <driver_ref>_d)
-- Senha = driver_ref (hasheada com MD5)
-- id_original = drivers.id
-- Conceito: mesmo padrão de INSERT SELECT, garantindo unicidade
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    d.driver_ref || '_d'          AS login,
    md5(d.driver_ref)             AS password,   -- hash MD5 da senha
    'Piloto'                      AS tipo,
    d.id                          AS id_original
FROM drivers d
ON CONFLICT (login) DO NOTHING;

-- Verificação rápida após carga
SELECT tipo, COUNT(*) AS total
FROM USERS
GROUP BY tipo
ORDER BY tipo;
