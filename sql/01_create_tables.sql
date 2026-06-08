-- =============================================================
-- SCC-541 Projeto Final — Dia 1: Tabelas de autenticação
-- Conceitos: DDL, constraints, controle de acesso, índices
-- =============================================================

-- -------------------------------------------------------------
-- Tabela USERS
-- Armazena credenciais de todos os usuários do sistema.
-- Conceito: controle de acesso centralizado via tabela própria
-- (não depende de roles/usuários nativos do PostgreSQL).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USERS (
    userid      SERIAL PRIMARY KEY,
    login       VARCHAR(100)  NOT NULL UNIQUE,
    -- Senha armazenada como hash MD5 — nunca em texto puro (req. 2 do enunciado)
    password    VARCHAR(255)  NOT NULL,
    tipo        VARCHAR(20)   NOT NULL CHECK (tipo IN ('Admin', 'Escuderia', 'Piloto')),
    -- id_original: driverid ou constructorid; NULL para Admin (req. 1)
    id_original INTEGER       NULL
);

-- Índice para acelerar o lookup por login no momento da autenticação
-- Conceito: índice em coluna de alta seletividade usada em WHERE de autenticação
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON USERS(login);

-- -------------------------------------------------------------
-- Tabela USERS_LOG
-- Auditoria de todos os acessos (LOGIN e LOGOUT).
-- Conceito: rastreabilidade — req. 6 do enunciado
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USERS_LOG (
    logid       SERIAL PRIMARY KEY,
    userid      INTEGER      NOT NULL REFERENCES USERS(userid),
    acao        VARCHAR(10)  NOT NULL CHECK (acao IN ('LOGIN', 'LOGOUT')),
    timestamp   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Índices para consultas de auditoria por usuário e por período
CREATE INDEX IF NOT EXISTS idx_users_log_userid    ON USERS_LOG(userid);
CREATE INDEX IF NOT EXISTS idx_users_log_timestamp ON USERS_LOG(timestamp);

-- -------------------------------------------------------------
-- Usuário administrador — único, fixo
-- Senha 'admin' armazenada como MD5 (sem texto puro)
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
VALUES ('admin', md5('admin'), 'Admin', NULL)
ON CONFLICT (login) DO NOTHING;
