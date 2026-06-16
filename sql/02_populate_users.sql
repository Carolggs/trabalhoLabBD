-- Popula a tabela USERS com todos os pilotos e escuderias já existentes na base.
-- A ideia é usar INSERT ... SELECT pra aproveitar os dados que já estão em
-- constructors e drivers, sem precisar inserir um por um manualmente.
--
-- Padrão de login:
--   escuderia → constructor_ref + "_c"   (ex: mclaren_c)
--   piloto    → driver_ref    + "_d"     (ex: hamilton_d)
--
-- A senha inicial é o próprio ref hasheado com MD5.
-- ON CONFLICT DO NOTHING garante que rodar esse script duas vezes não duplica nada.

-- -------------------------------------------------------------
-- Escuderias
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    c.constructor_ref || '_c',  -- login único por convenção
    md5(c.constructor_ref),     -- senha = hash do ref, nunca texto puro
    'Escuderia',
    c.id
FROM constructors c
ON CONFLICT (login) DO NOTHING;

-- -------------------------------------------------------------
-- Pilotos
-- Mesmo padrão, só muda o sufixo (_d) e a tabela de origem.
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    d.driver_ref || '_d',
    md5(d.driver_ref),
    'Piloto',
    d.id
FROM drivers d
ON CONFLICT (login) DO NOTHING;

-- Conferência rápida depois da carga pra ver se os números batem
SELECT tipo, COUNT(*) AS total
FROM USERS
GROUP BY tipo
ORDER BY tipo;
