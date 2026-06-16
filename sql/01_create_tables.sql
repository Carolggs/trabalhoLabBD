-- Tabelas de autenticação do sistema.
-- Optamos por uma tabela própria em vez de usar roles do PostgreSQL
-- porque precisamos de um tipo de usuário (Admin/Escuderia/Piloto)
-- e de vincular cada login ao registro original na base F1.

-- -------------------------------------------------------------
-- USERS
-- Guarda o login, senha e tipo de cada usuário do sistema.
-- id_original aponta pro driver ou constructor correspondente;
-- no caso do Admin fica NULL mesmo, já que ele não é nem piloto nem escuderia.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USERS (
    userid      SERIAL PRIMARY KEY,
    login       VARCHAR(100)  NOT NULL UNIQUE,
    password    VARCHAR(255)  NOT NULL,  -- sempre MD5, nunca texto puro
    tipo        VARCHAR(20)   NOT NULL CHECK (tipo IN ('Admin', 'Escuderia', 'Piloto')),
    id_original INTEGER       NULL
);

-- O login é a coluna mais consultada no momento do login,
-- então faz sentido ter um índice aqui pra não varrer a tabela inteira toda vez.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON USERS(login);

-- -------------------------------------------------------------
-- USERS_LOG
-- Registra cada entrada e saída do sistema.
-- Simples mas suficiente: sabemos quem entrou, quando e se saiu.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS USERS_LOG (
    logid       SERIAL PRIMARY KEY,
    userid      INTEGER      NOT NULL REFERENCES USERS(userid),
    acao        VARCHAR(10)  NOT NULL CHECK (acao IN ('LOGIN', 'LOGOUT')),
    timestamp   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Dois índices que cobrem os dois jeitos mais comuns de consultar o log:
-- "quais acessos desse usuário?" e "quem estava logado nessa data?"
CREATE INDEX IF NOT EXISTS idx_users_log_userid    ON USERS_LOG(userid);
CREATE INDEX IF NOT EXISTS idx_users_log_timestamp ON USERS_LOG(timestamp);

-- -------------------------------------------------------------
-- Admin padrão do sistema.
-- ON CONFLICT DO NOTHING porque esse script pode rodar mais de uma vez
-- durante o desenvolvimento sem quebrar tudo.
-- -------------------------------------------------------------
INSERT INTO USERS (login, password, tipo, id_original)
VALUES ('admin', md5('admin'), 'Admin', NULL)
ON CONFLICT (login) DO NOTHING;
