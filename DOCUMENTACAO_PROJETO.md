# SCC-541 — Laboratório de Bases de Dados
## Trabalho Final P4 — Base de Dados da Fórmula 1

**Entrega:** 17 de junho de 2026  
**Stack:** React + Vite · Node.js + Express · PostgreSQL  
**Banco:** `f1db` — schema da FIA com dados de 1950–2025

---

## Conceitos Gerais de Banco de Dados Utilizados

Antes de entrar no código, aqui está uma referência rápida dos conceitos usados no projeto:

### O que é uma Trigger?
Uma **trigger** (gatilho) é um procedimento que o próprio banco de dados executa **automaticamente** em resposta a um evento (INSERT, UPDATE, DELETE) em uma tabela. Não é chamada pelo código — o banco chama sozinho.

> **Analogia:** é como um "alarme" configurado na tabela. Quando algo acontece nela, o alarme dispara e executa uma ação automaticamente.

No projeto: usamos triggers para **sincronizar automaticamente** a tabela USERS toda vez que um piloto ou escuderia é inserido/atualizado em suas tabelas de origem.

### O que é uma Stored Function (Função Armazenada)?
Uma **função armazenada** é um bloco de código SQL escrito em PL/pgSQL (linguagem procedural do PostgreSQL) que fica **salvo no banco** e pode ser chamado como uma função normal. Recebe parâmetros e retorna valores.

> **Analogia:** é como uma função em qualquer linguagem de programação, mas que vive dentro do banco de dados e tem acesso direto às tabelas.

No projeto: usamos para encapsular cálculos complexos do dashboard (vitórias, anos de atividade, desempenho por circuito) que seriam feitos no backend — deixando o código Node.js mais limpo.

### O que é uma View?
Uma **view** (visão) é uma **query salva** no banco com um nome. Não armazena dados — quando consultada, executa a query subjacente. Serve para reutilizar queries complexas sem repetição de código.

> **Analogia:** é como um atalho ou apelido para uma query longa. Em vez de escrever 10 JOINs toda vez, você escreve `SELECT * FROM vw_resultados`.

### O que é um Índice?
Um **índice** é uma estrutura auxiliar criada pelo banco para **acelerar buscas**. Sem índice, o banco lê linha por linha (full scan). Com índice, vai direto ao registro.

> **Analogia:** é como o índice de um livro — em vez de ler todas as páginas para achar "Hamilton", você vai direto na letra H.

No projeto: criamos índices nas colunas mais usadas em JOINs e filtros (`driver_id`, `constructor_id`, `status_id`, coordenadas geográficas).

### O que é uma CTE (`WITH`)?
Uma **CTE** (Common Table Expression) é uma query temporária definida com `WITH nome AS (...)` que pode ser referenciada depois na query principal. Serve para dividir queries complexas em partes legíveis.

---

## 1 — Administrar Usuários

### 1.1 — Criação das tabelas USERS e USERS_LOG

> **Requisito:** *"Deve ser criada uma tabela chamada USERS, contendo, no mínimo: userid, login, password, tipo, id_original. O atributo login deve ser único. O atributo id_original deve armazenar o identificador do registro correspondente na tabela de origem. Para o usuário administrador, esse atributo pode ficar nulo."*

**Arquivo:** [`sql/01_create_tables.sql`](sql/01_create_tables.sql)

```sql
-- Criação da tabela principal de usuários do sistema.
-- IF NOT EXISTS: evita erro se o script for executado mais de uma vez.
CREATE TABLE IF NOT EXISTS USERS (

    -- SERIAL: o banco gera o id automaticamente (auto-incremento).
    -- PRIMARY KEY: garante que cada userid seja único e não nulo.
    userid      SERIAL PRIMARY KEY,

    -- NOT NULL: login é obrigatório.
    -- UNIQUE: o banco rejeita dois usuários com o mesmo login.
    --         Essa constraint é verificada a cada INSERT/UPDATE.
    login       VARCHAR(100) NOT NULL UNIQUE,

    -- Senha armazenada SEMPRE como hash MD5, nunca em texto puro.
    -- O hash é calculado antes de chegar aqui (via md5() no SQL).
    password    VARCHAR(255) NOT NULL,

    -- CHECK: o banco rejeita qualquer valor fora desses três.
    --        Não depende de validação no código — é garantia do banco.
    tipo        VARCHAR(20)  NOT NULL CHECK (tipo IN ('Admin', 'Escuderia', 'Piloto')),

    -- id_original aponta para o id na tabela de origem:
    --   tipo='Piloto'    → drivers.id
    --   tipo='Escuderia' → constructors.id
    --   tipo='Admin'     → NULL (não tem tabela de origem)
    id_original INTEGER NULL
);

-- Índice único reforça a unicidade do login a nível de estrutura de dados,
-- além da constraint UNIQUE da coluna — também acelera buscas por login
-- durante a autenticação (WHERE login = $1).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_login ON USERS(login);

-- Tabela de auditoria: registra cada LOGIN e LOGOUT do sistema.
CREATE TABLE IF NOT EXISTS USERS_LOG (

    logid     SERIAL PRIMARY KEY,

    -- FK para USERS: garante que o log nunca referencie um userid inexistente.
    -- Se um usuário for deletado, o banco impede que logs órfãos existam.
    userid    INTEGER     NOT NULL REFERENCES USERS(userid),

    -- CHECK restringe a apenas as duas ações possíveis.
    acao      VARCHAR(10) NOT NULL CHECK (acao IN ('LOGIN', 'LOGOUT')),

    -- DEFAULT NOW(): o banco preenche automaticamente com a hora atual,
    -- sem precisar que o código passe o timestamp.
    timestamp TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Índices na tabela de log para consultas de auditoria futuras.
CREATE INDEX IF NOT EXISTS idx_users_log_userid    ON USERS_LOG(userid);
CREATE INDEX IF NOT EXISTS idx_users_log_timestamp ON USERS_LOG(timestamp);

-- Inserção do único usuário Admin.
-- ON CONFLICT DO NOTHING: se já existir (reexecução do script), ignora silenciosamente.
-- md5('admin'): senha 'admin' armazenada como hash, nunca texto puro.
INSERT INTO USERS (login, password, tipo, id_original)
VALUES ('admin', md5('admin'), 'Admin', NULL)
ON CONFLICT (login) DO NOTHING;
```

**Por que foi feito assim:**
- A constraint `CHECK` no campo `tipo` é uma **garantia em nível de banco** — qualquer tentativa de inserir um tipo inválido é bloqueada antes mesmo de gravar, independente do código da aplicação.
- O campo `id_original` foi definido como `NULL` para permitir o usuário Admin sem referência a nenhuma tabela, conforme o enunciado.
- Dois mecanismos de unicidade no `login` (constraint `UNIQUE` + `UNIQUE INDEX`) garantem que mesmo em operações paralelas o banco nunca aceite duplicatas.

---

### 1.2 — Popular USERS a partir da base F1 existente

> **Requisito:** *"Os pilotos e escuderias já cadastrados na base da Fórmula 1 deverão ser cadastrados também na tabela USERS, seguindo os padrões de login e senha definidos anteriormente."*

**Arquivo:** [`sql/02_populate_users.sql`](sql/02_populate_users.sql)

```sql
-- INSERT ... SELECT: em vez de inserir linha por linha,
-- esta sintaxe gera um INSERT para cada linha retornada pelo SELECT.
-- É equivalente a um loop, mas executado inteiramente dentro do banco,
-- sem precisar que o código externo faça nada além de rodar o script.

-- ── ESCUDERIAS ────────────────────────────────────────────────────────
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    -- Padrão de login definido no enunciado: <constructor_ref>_c
    -- O operador || concatena strings no PostgreSQL.
    -- Exemplo: 'mclaren' || '_c' → 'mclaren_c'
    c.constructor_ref || '_c'  AS login,

    -- md5() é uma função nativa do PostgreSQL que calcula o hash MD5.
    -- Exemplo: md5('mclaren') → 'dc9ac7d0....' (32 caracteres hex)
    -- A senha NUNCA é armazenada em texto puro.
    md5(c.constructor_ref)     AS password,

    'Escuderia'                AS tipo,

    -- id_original guarda o id da escuderia na tabela constructors,
    -- permitindo que depois o sistema saiba qual escuderia está logada.
    c.id                       AS id_original

FROM constructors c

-- ON CONFLICT: se o login já existir (script rodado duas vezes),
-- não gera erro — simplesmente ignora aquela linha.
ON CONFLICT (login) DO NOTHING;


-- ── PILOTOS ───────────────────────────────────────────────────────────
INSERT INTO USERS (login, password, tipo, id_original)
SELECT
    -- Padrão de login definido no enunciado: <driver_ref>_d
    -- Exemplo: 'hamilton' || '_d' → 'hamilton_d'
    d.driver_ref || '_d'       AS login,

    -- Exemplo: md5('hamilton') → senha hasheada
    md5(d.driver_ref)          AS password,

    'Piloto'                   AS tipo,

    -- id_original aponta para drivers.id do piloto correspondente.
    d.id                       AS id_original

FROM drivers d
ON CONFLICT (login) DO NOTHING;

-- Verificação após a carga: mostra quantos usuários de cada tipo foram criados.
SELECT tipo, COUNT(*) AS total
FROM USERS
GROUP BY tipo
ORDER BY tipo;
```

**Por que foi feito assim:**
- `INSERT ... SELECT` é muito mais eficiente do que inserir piloto por piloto no código — uma única instrução SQL processa todos os registros de uma vez.
- `md5()` chamado dentro do SQL garante que a senha nunca trafegue em texto puro entre a aplicação e o banco.
- `ON CONFLICT DO NOTHING` torna o script **idempotente**: pode ser executado múltiplas vezes sem efeito colateral.

---

### 1.3 — Triggers de sincronização automática

> **Requisito:** *"Deve-se assegurar que, sempre que um piloto ou escuderia for criado ou modificado na respectiva tabela, o registro correspondente na tabela USERS seja criado ou atualizado automaticamente. Caso já exista algum usuário com o login gerado, a trigger deve cancelar a operação e impedir a inserção inconsistente na tabela de origem."*

**Arquivo:** [`sql/03_triggers.sql`](sql/03_triggers.sql)

#### Como funciona uma trigger no PostgreSQL

Uma trigger é composta de duas partes:
1. **Função de trigger** — o código que será executado (escrito em PL/pgSQL)
2. **Trigger em si** — a associação entre a função e o evento (qual tabela, qual operação)

```sql
-- ════════════════════════════════════════════════════════
-- PARTE 1: FUNÇÃO DA TRIGGER para DRIVERS → USERS
-- ════════════════════════════════════════════════════════

-- CREATE OR REPLACE: cria a função ou a substitui se já existir.
-- RETURNS TRIGGER: tipo especial de retorno obrigatório para funções de trigger.
CREATE OR REPLACE FUNCTION fn_sync_driver_to_users()
RETURNS TRIGGER AS $$

-- Bloco DECLARE: declara variáveis locais usadas dentro da função.
DECLARE
    v_login    VARCHAR(100);  -- vai guardar o login gerado (ex: 'hamilton_d')
    v_password VARCHAR(255);  -- vai guardar o hash MD5 da senha

-- BEGIN/END: delimita o corpo da função.
BEGIN
    -- Monta o login e a senha seguindo os padrões do enunciado.
    -- NEW é uma variável especial do PostgreSQL disponível em triggers:
    --   NEW.driver_ref → valor do campo driver_ref da linha que está sendo
    --   inserida ou atualizada (a "nova" versão da linha).
    v_login    := NEW.driver_ref || '_d';
    v_password := md5(NEW.driver_ref);

    -- TG_OP é outra variável especial: contém 'INSERT', 'UPDATE' ou 'DELETE'
    -- indicando qual operação disparou a trigger.
    IF TG_OP = 'INSERT' THEN

        -- Antes de criar o usuário, verifica se o login já existe.
        -- Se existir, RAISE EXCEPTION cancela toda a operação:
        --   - O INSERT em drivers é revertido (não acontece).
        --   - A trigger não insere nada em USERS.
        --   - O erro chega ao backend, que retorna HTTP 400.
        IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login) THEN
            RAISE EXCEPTION 'Login "%" já existe em USERS. Inserção em DRIVERS cancelada.', v_login;
        END IF;

        -- Se o login não existe, cria o usuário em USERS.
        -- NEW.id: o id que o banco acabou de gerar para o novo driver (SERIAL).
        INSERT INTO USERS (login, password, tipo, id_original)
        VALUES (v_login, v_password, 'Piloto', NEW.id);

    ELSIF TG_OP = 'UPDATE' THEN

        -- No UPDATE, verifica se o driver_ref mudou.
        -- OLD é a versão anterior da linha (antes do UPDATE).
        IF OLD.driver_ref <> NEW.driver_ref THEN
            -- Se o novo login já pertence a outro usuário, cancela.
            IF EXISTS (SELECT 1 FROM USERS WHERE login = v_login AND id_original <> NEW.id) THEN
                RAISE EXCEPTION 'Login "%" já pertence a outro usuário. UPDATE em DRIVERS cancelado.', v_login;
            END IF;
        END IF;

        -- Atualiza o login e a senha do usuário existente em USERS.
        -- WHERE id_original = NEW.id AND tipo = 'Piloto':
        --   garante que só o usuário correspondente a este driver seja atualizado.
        UPDATE USERS
        SET login    = v_login,
            password = v_password
        WHERE id_original = NEW.id AND tipo = 'Piloto';

    END IF;

    -- RETURN NEW: obrigatório em triggers AFTER. Retorna a linha processada.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql; -- indica que o código está em PL/pgSQL


-- ════════════════════════════════════════════════════════
-- PARTE 2: ASSOCIAÇÃO DA TRIGGER À TABELA
-- ════════════════════════════════════════════════════════

-- Remove a trigger se já existir (para poder recriar sem erro).
DROP TRIGGER IF EXISTS trg_sync_driver_to_users ON drivers;

-- Cria a trigger que associa a função à tabela drivers.
CREATE TRIGGER trg_sync_driver_to_users

    -- AFTER: a função é chamada DEPOIS que a linha foi inserida/atualizada.
    -- Isso garante que NEW.id já existe (o SERIAL já foi gerado).
    -- INSERT OR UPDATE: dispara nos dois tipos de operação.
    AFTER INSERT OR UPDATE ON drivers

    -- FOR EACH ROW: a função é chamada UMA VEZ para cada linha afetada.
    -- (alternativa seria FOR EACH STATEMENT, que chama uma vez por comando)
    FOR EACH ROW

    EXECUTE FUNCTION fn_sync_driver_to_users();
```

O mesmo padrão é repetido para `constructors` com `fn_sync_constructor_to_users` / `trg_sync_constructor_to_users`, usando `'_c'` e `'Escuderia'` nos valores.

**Por que foi feito assim:**
- Usar trigger garante que a sincronização acontece **independente de onde** o INSERT/UPDATE veio — pelo backend, por um script SQL direto, ou por qualquer outra ferramenta.
- `AFTER INSERT` é usado em vez de `BEFORE INSERT` para ter acesso ao `NEW.id` gerado pelo SERIAL.
- `RAISE EXCEPTION` dentro da trigger garante que o INSERT em `drivers` seja revertido atomicamente se o login já existir — nenhum dado inconsistente é gravado.

---

## 2 — Fluxo de Telas

### Tela 1 — Login

> **Requisito:** *"Solicita a identificação do usuário e sua senha. Após a confirmação do login, deve ser apresentada a Tela 2."*

**Arquivo backend:** [`backend/src/routes/auth.js`](backend/src/routes/auth.js)

```sql
-- ── AUTENTICAÇÃO ──────────────────────────────────────────────────────
-- Busca o usuário comparando login e senha.
-- $1 = login digitado pelo usuário (ex: 'hamilton_d')
-- $2 = senha digitada em texto puro (ex: 'hamilton')
-- md5($2): o PostgreSQL calcula o hash MD5 da senha AQUI,
--          no momento da comparação. Nunca a senha em texto puro
--          é armazenada ou comparada diretamente.
SELECT userid, login, tipo, id_original
FROM USERS
WHERE login    = $1
  AND password = md5($2);
-- Se nenhuma linha for retornada → credenciais inválidas → HTTP 401.
-- Se uma linha for retornada → usuário autenticado → continua.


-- ── REGISTRO DE LOGIN NO LOG ─────────────────────────────────────────
-- Após autenticação bem-sucedida, registra o acesso.
-- NOW() é uma função do PostgreSQL que retorna o timestamp atual.
-- O campo timestamp tem DEFAULT NOW(), mas passamos explicitamente
-- para clareza no código.
INSERT INTO USERS_LOG (userid, acao, timestamp)
VALUES ($1, 'LOGIN', NOW());


-- ── BUSCA DO NOME DE EXIBIÇÃO ─────────────────────────────────────────
-- O nome do usuário não está em USERS (evitar redundância).
-- Buscamos na tabela de origem usando id_original.

-- Se tipo = 'Piloto': busca nome completo em drivers
SELECT given_name || ' ' || family_name AS nome
FROM drivers
WHERE id = $1;  -- $1 = id_original do usuário logado

-- Se tipo = 'Escuderia': busca nome da escuderia em constructors
SELECT name AS nome
FROM constructors
WHERE id = $1;  -- $1 = id_original do usuário logado

-- Se tipo = 'Admin': displayName = 'Administrador' (fixo no código)


-- ── REGISTRO DE LOGOUT ────────────────────────────────────────────────
INSERT INTO USERS_LOG (userid, acao, timestamp)
VALUES ($1, 'LOGOUT', NOW());
```

**Por que foi feito assim:**
- `md5($2)` calculado pelo PostgreSQL no momento da query — a senha nunca trafega em texto puro entre o frontend e o banco.
- O `displayName` é buscado nas tabelas de origem (`drivers`/`constructors`) usando `id_original`, não armazenado em USERS — evita redundância e mantém consistência se o nome for atualizado na tabela de origem.
- Tanto login quanto logout são registrados em `USERS_LOG`, garantindo rastreabilidade completa de acesso.

---

### Tela 2 — Dashboard

**Arquivos:** [`frontend/src/pages/Dashboard.jsx`](frontend/src/pages/Dashboard.jsx) · [`frontend/src/pages/Dashboard/DashboardContent.jsx`](frontend/src/pages/Dashboard/DashboardContent.jsx)

O Dashboard é a tela central da aplicação. Exibe:
- Nome e badge do tipo de usuário (filtrado por `user.tipo`)
- Informações específicas por tipo (carregadas do backend via stored functions ou queries diretas)
- Botões de navegação filtrados por tipo:
  - **Admin:** Cadastrar Piloto, Cadastrar Escuderia, Relatórios
  - **Escuderia:** Buscar Piloto, Importar Pilotos, Relatórios
  - **Piloto:** apenas Relatórios

---

### Tela 3 — Relatórios

**Arquivo:** [`frontend/src/pages/Relatorios.jsx`](frontend/src/pages/Relatorios.jsx)

Exibe apenas os relatórios correspondentes ao tipo do usuário logado:
- Admin → R1, R2, R3
- Escuderia → R4, R5
- Piloto → R6, R7

Cada relatório tem botão "Gerar Relatório", resultado exibido inline e botão "Fechar" que limpa o resultado mas mantém o usuário na Tela 3 — conforme o enunciado.

---

## 3 — Ações Disponibilizadas aos Usuários

### Admin — Cadastrar Piloto

> **Requisito:** *"Exibe um formulário para adicionar um novo piloto na tabela DRIVERS. Quando houver novo cadastro, o sistema deverá inserir automaticamente o respectivo usuário em USERS utilizando triggers. Caso já exista usuário com o login gerado, a trigger deve cancelar a operação."*

**Arquivos:** [`backend/src/routes/admin.js`](backend/src/routes/admin.js) · [`frontend/src/pages/CadastrarPiloto.jsx`](frontend/src/pages/CadastrarPiloto.jsx)

```sql
-- Insere um novo piloto na tabela drivers.
-- RETURNING id: após o INSERT, retorna o id gerado pelo SERIAL —
--              o backend usa esse id para confirmar o cadastro.
-- Após este INSERT, a trigger trg_sync_driver_to_users dispara
-- automaticamente e cria o usuário em USERS com:
--   login    = driver_ref || '_d'
--   password = md5(driver_ref)
--   tipo     = 'Piloto'
--   id_original = o id retornado aqui
INSERT INTO drivers (driver_ref, given_name, family_name, date_of_birth, nationality)
VALUES ($1, $2, $3, $4, $5)
RETURNING id;
```

> **Observação sobre `country_id`:** o enunciado pede `country_id` nos campos do formulário, mas o schema real da base F1 utilizada na disciplina não possui essa coluna em `drivers` nem em `constructors` — usa `nationality` (string de texto). A adaptação ao schema real foi a decisão adotada e deve ser mencionada no relatório PDF.

---

### Admin — Cadastrar Escuderia

```sql
-- Mesmo padrão do Cadastrar Piloto, mas para a tabela constructors.
-- A trigger trg_sync_constructor_to_users cria automaticamente o usuário em USERS.
INSERT INTO constructors (constructor_ref, name, nationality, wikipedia_url)
VALUES ($1, $2, $3, $4)
RETURNING id;
```

---

### Escuderia — Consultar Piloto por Sobrenome

> **Requisito:** *"Verificar se há algum piloto com esse sobrenome que já tenha corrido pela escuderia logada. Caso exista, apresentar o nome completo, a data de nascimento e a nacionalidade. Dica: para verificar se um piloto já correu por uma escuderia, consulte a tabela RESULTS."*

**Arquivo:** [`backend/src/routes/escuderia.js`](backend/src/routes/escuderia.js)

```sql
-- $1 = sobrenome digitado pelo usuário (ex: '%hamilton%')
-- $2 = id_original da escuderia logada (vem da sessão)
SELECT
    -- Concatena primeiro nome e sobrenome para exibição.
    d.given_name || ' ' || d.family_name AS full_name,
    d.date_of_birth,
    d.nationality

FROM drivers d

WHERE
    -- LOWER() + LIKE: busca case-insensitive e parcial no sobrenome.
    -- Ex: buscar 'ham' encontra 'Hamilton'.
    LOWER(d.family_name) LIKE LOWER($1)

    -- EXISTS com subquery correlacionada:
    -- Para cada driver encontrado acima, verifica na tabela RESULTS
    -- se existe PELO MENOS UMA corrida onde:
    --   driver_id    = o id deste driver (correlação com a query externa)
    --   constructor_id = o id da escuderia logada ($2)
    -- Isso implementa a dica do enunciado: verificar via tabela RESULTS.
    AND EXISTS (
        SELECT 1  -- SELECT 1 é convencional em EXISTS: não importa o valor,
                  -- apenas se existe alguma linha.
        FROM results
        WHERE driver_id     = d.id   -- correlaciona com o driver da query externa
          AND constructor_id = $2    -- filtra pela escuderia logada
    )

ORDER BY d.given_name, d.family_name;
```

**Por que foi feito assim:**
- `EXISTS (subquery correlacionada)` é mais eficiente que um JOIN quando só precisamos verificar existência — o banco para na primeira linha encontrada.
- `constructor_id = $2` garante que só apareçam pilotos que efetivamente correram **por esta escuderia** (não por qualquer escuderia), conforme o enunciado.
- A subquery usa `SELECT 1` por convenção — o valor retornado não importa, apenas se existe linha.

---

### Escuderia — Inserir Pilotos por Arquivo

> **Requisito:** *"Permite indicar um arquivo com informações de um ou mais pilotos. Antes da inserção, verificar se não existe outro piloto com o mesmo nome e sobrenome."*

**Arquivo:** [`backend/src/routes/escuderia.js`](backend/src/routes/escuderia.js)

```sql
-- PASSO 1: verificação de duplicata por nome completo.
-- LOWER() nos dois lados garante comparação case-insensitive.
-- Se retornar alguma linha, o piloto já existe → inserção cancelada.
SELECT id FROM drivers
WHERE LOWER(given_name) = LOWER($1)   -- $1 = given_name do arquivo
  AND LOWER(family_name) = LOWER($2); -- $2 = family_name do arquivo


-- PASSO 2: inserção se não houver duplicata.
-- O trigger trg_sync_driver_to_users cria o usuário em USERS automaticamente.
INSERT INTO drivers (driver_ref, given_name, family_name, date_of_birth, nationality)
VALUES ($1, $2, $3, $4, $5);
```

O arquivo enviado é um CSV com uma linha por piloto no formato:
```
driver_ref,given_name,family_name,date_of_birth,nationality
hamilton,Lewis,Hamilton,1985-01-07,British
```

---

### Piloto

> **Requisito:** *"Usuários do tipo Piloto não podem alterar dados da base. Eles podem apenas visualizar os relatórios e o dashboard referentes ao próprio piloto."*

Implementado por controle de navegação no frontend: o Dashboard do tipo Piloto não exibe nenhum botão de cadastro ou alteração. Não há endpoints de escrita expostos para pilotos.

---

## 4 — Definição da Tela de Dashboard

### Admin — Dashboard

> **Requisito:** *"1. Quantidade total de pilotos, escuderias e temporadas. 2. Lista das corridas da temporada mais recente (circuito, data, horário, voltas). 3. Escuderias com total de pontos. 4. Pilotos com total de pontos."*

**Arquivo:** [`backend/src/routes/admin.js`](backend/src/routes/admin.js)

```sql
-- ── ITEM 1: totais ────────────────────────────────────────────────────
-- Subqueries escalares dentro do SELECT: cada uma retorna um único valor.
-- Executadas em uma única query para evitar múltiplas viagens ao banco.
SELECT
    (SELECT COUNT(*) FROM drivers)       AS total_drivers,
    (SELECT COUNT(*) FROM constructors)  AS total_constructors,
    (SELECT COUNT(*) FROM seasons)       AS total_seasons;


-- ── ITEM 2: corridas da temporada mais recente ────────────────────────
SELECT
    r.race_name,
    c.name      AS circuit,      -- nome do circuito (via JOIN)
    r.race_date,
    r.race_time,
    -- MAX(res.laps): maior número de voltas registrado nos resultados
    --               daquela corrida (representa as voltas da corrida).
    -- COALESCE(..., 0): se não houver resultados para a corrida, retorna 0
    --                   em vez de NULL.
    COALESCE(MAX(res.laps), 0) AS total_voltas

FROM races r
-- JOIN para pegar o nome do circuito
JOIN circuits c  ON r.circuit_id = c.id
-- JOIN para filtrar pela temporada
JOIN seasons s   ON r.season_id  = s.id
-- LEFT JOIN: inclui corridas mesmo sem resultados registrados
LEFT JOIN results res ON r.id = res.race_id

-- Subquery: descobre qual é o ano mais recente nas seasons e filtra por ele.
-- Garante que os 3 blocos (corridas, escuderias, pilotos) usem o mesmo ano.
WHERE s.year = (SELECT MAX(year) FROM seasons)

-- GROUP BY necessário pelo MAX(res.laps) — agrupa por corrida
GROUP BY r.id, r.race_name, c.name, r.race_date, r.race_time
ORDER BY r.race_date;


-- ── ITEM 3: escuderias com pontos ────────────────────────────────────
SELECT
    c.name,
    -- SUM(points): soma todos os pontos obtidos pela escuderia
    --              em todas as corridas da temporada mais recente.
    SUM(res.points) AS total_pontos
FROM constructors c
JOIN results res ON c.id  = res.constructor_id
JOIN races r     ON res.race_id   = r.id
JOIN seasons s   ON r.season_id   = s.id
WHERE s.year = (SELECT MAX(year) FROM seasons)
GROUP BY c.id, c.name
ORDER BY total_pontos DESC;  -- ordenado para mostrar os líderes primeiro


-- ── ITEM 4: pilotos com pontos ────────────────────────────────────────
-- Mesmo padrão do item 3, mas para drivers.
SELECT
    d.given_name || ' ' || d.family_name AS nome,
    SUM(res.points) AS total_pontos
FROM drivers d
JOIN results res ON d.id  = res.driver_id
JOIN races r     ON res.race_id  = r.id
JOIN seasons s   ON r.season_id  = s.id
WHERE s.year = (SELECT MAX(year) FROM seasons)
GROUP BY d.id
ORDER BY total_pontos DESC;
```

---

### Escuderia — Funções Armazenadas

> **Requisito:** *"Devem ser criadas funções ou procedimentos armazenados que recebam dados da escuderia como parâmetro e retornem: (1) vitórias, (2) pilotos diferentes, (3) primeiro e último ano."*

**Arquivo:** [`sql/04_functions.sql`](sql/04_functions.sql) · chamadas em [`backend/src/routes/escuderia.js`](backend/src/routes/escuderia.js)

```sql
-- ════════════════════════════════════════════════════════
-- FUNÇÃO 1: quantidade de vitórias da escuderia
-- ════════════════════════════════════════════════════════

-- CREATE OR REPLACE: cria ou substitui sem precisar dropar antes.
-- p_constructor_id: parâmetro de entrada (prefixo p_ por convenção).
-- RETURNS INTEGER: retorna um único número inteiro.
CREATE OR REPLACE FUNCTION fn_escuderia_vitories(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  -- RETURN com subquery: calcula e retorna diretamente.
  -- Vitória = resultado com position = '1' (campo VARCHAR no schema).
  -- COUNT(*): conta todas as linhas que batem com a condição.
  RETURN (
    SELECT COUNT(*)
    FROM results
    WHERE constructor_id = p_constructor_id
      AND position = '1'   -- position é VARCHAR, por isso comparamos com '1' (string)
  );
END;
$$ LANGUAGE plpgsql;

-- Como o backend chama essa função:
-- SELECT fn_escuderia_vitories($1) AS vitories  → retorna ex: 183


-- ════════════════════════════════════════════════════════
-- FUNÇÃO 2: quantidade de pilotos diferentes
-- ════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION fn_escuderia_pilots_count(p_constructor_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    -- COUNT(DISTINCT driver_id): conta quantos driver_id ÚNICOS aparecem
    -- nos resultados desta escuderia. Um piloto que correu 200 corridas
    -- pela escuderia é contado apenas uma vez.
    SELECT COUNT(DISTINCT driver_id)
    FROM results
    WHERE constructor_id = p_constructor_id
  );
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════
-- FUNÇÃO 3: primeiro e último ano na base
-- ════════════════════════════════════════════════════════

-- RETURNS TABLE: quando a função precisa retornar MÚLTIPLAS COLUNAS,
-- usamos RETURNS TABLE em vez de RETURNS INTEGER.
-- Isso permite que o chamador faça: SELECT * FROM fn_escuderia_years($1)
CREATE OR REPLACE FUNCTION fn_escuderia_years(p_constructor_id INTEGER)
RETURNS TABLE(first_year INTEGER, last_year INTEGER) AS $$
BEGIN
  -- RETURN QUERY: executa a query e retorna as linhas como resultado da função.
  RETURN QUERY
  SELECT
    -- MIN e MAX nos anos: encontram o primeiro e último ano de atividade.
    -- ::INTEGER: cast explícito pois MIN/MAX podem retornar NUMERIC.
    MIN(s.year)::INTEGER AS first_year,
    MAX(s.year)::INTEGER AS last_year
  FROM results r
  -- Precisa de JOIN com races e seasons para chegar ao ano (year está em seasons).
  JOIN races ra   ON r.race_id    = ra.id
  JOIN seasons s  ON ra.season_id = s.id
  -- Filtra apenas os resultados desta escuderia.
  -- Usa RESULTS (não seasons) para anos com participação REAL.
  WHERE r.constructor_id = p_constructor_id;
END;
$$ LANGUAGE plpgsql;
```

---

### Piloto — Funções Armazenadas

> **Requisito:** *"Devem ser criadas funções que retornem: (1) primeiro e último ano; (2) para cada ano e circuito: pontos, vitórias e total de corridas."*

**Arquivo:** [`sql/04_functions.sql`](sql/04_functions.sql) · chamadas em [`backend/src/routes/piloto.js`](backend/src/routes/piloto.js)

```sql
-- ════════════════════════════════════════════════════════
-- FUNÇÃO 4: primeiro e último ano do piloto
-- ════════════════════════════════════════════════════════
-- Mesmo padrão da fn_escuderia_years, mas para drivers.
CREATE OR REPLACE FUNCTION fn_driver_years(p_driver_id INTEGER)
RETURNS TABLE(first_year INTEGER, last_year INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT MIN(s.year)::INTEGER, MAX(s.year)::INTEGER
  FROM results r
  JOIN races ra  ON r.race_id    = ra.id
  JOIN seasons s ON ra.season_id = s.id
  WHERE r.driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql;


-- ════════════════════════════════════════════════════════
-- FUNÇÃO 5: desempenho do piloto por ano e circuito
-- ════════════════════════════════════════════════════════

-- RETURNS TABLE com 5 colunas: retorna uma linha para cada
-- combinação (ano, circuito) em que o piloto competiu.
CREATE OR REPLACE FUNCTION fn_driver_performance(p_driver_id INTEGER)
RETURNS TABLE(
  year         INTEGER,
  circuit_name TEXT,
  total_points NUMERIC,
  victories    INTEGER,
  races        INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.year,
    c.name,  -- nome do circuito (via JOIN com circuits)

    -- SUM(points): soma todos os pontos do piloto neste circuito neste ano.
    -- ::NUMERIC: mantém casas decimais (pontos podem ser 0.5 em casos especiais).
    SUM(r.points)::NUMERIC,

    -- COUNT(CASE WHEN ...): conta vitórias sem subquery adicional.
    -- CASE WHEN position = '1' THEN 1 END retorna:
    --   1  → se o piloto ganhou essa corrida
    --   NULL → nos outros casos
    -- COUNT ignora NULL, então conta apenas as corridas vencidas.
    -- ::INTEGER: converte o resultado para inteiro.
    COUNT(CASE WHEN r.position = '1' THEN 1 END)::INTEGER,

    -- COUNT(*): conta TODAS as corridas do piloto neste circuito neste ano,
    -- independente do resultado.
    COUNT(*)::INTEGER

  FROM results r
  JOIN races ra   ON r.race_id    = ra.id   -- para chegar em season_id e circuit_id
  JOIN seasons s  ON ra.season_id = s.id    -- para pegar o ano
  JOIN circuits c ON ra.circuit_id = c.id   -- para pegar o nome do circuito

  WHERE r.driver_id = p_driver_id

  -- GROUP BY: para cada combinação única de (ano, circuito), agrega os resultados.
  -- c.id incluído no GROUP BY para evitar ambiguidade quando dois circuitos
  -- têm o mesmo nome.
  GROUP BY s.year, c.id, c.name

  ORDER BY s.year DESC, total_points DESC;
END;
$$ LANGUAGE plpgsql;
```

---

## 5 — Relatórios

### Views e Índices

> **Requisito:** *"Os índices criados para auxiliar os relatórios devem ser indicados no código e justificados brevemente."*

**Arquivo:** [`sql/05_views_indexes.sql`](sql/05_views_indexes.sql)

```sql
-- ════════════════════════════════════════════════════════
-- ÍNDICES
-- ════════════════════════════════════════════════════════
-- Um índice B-Tree (padrão do PostgreSQL) organiza os valores de uma coluna
-- em uma estrutura de árvore que permite buscas em O(log n) em vez de O(n).

-- results(constructor_id): usado em R3, R4, R5, dashboard da escuderia
-- e na busca de pilotos. Evita full scan de milhões de linhas de results.
CREATE INDEX IF NOT EXISTS idx_results_constructor ON results(constructor_id);

-- results(driver_id): usado em R6, R7, dashboard do piloto.
CREATE INDEX IF NOT EXISTS idx_results_driver      ON results(driver_id);

-- results(status_id): usado em R1, R5, R7 (JOIN com tabela status).
CREATE INDEX IF NOT EXISTS idx_results_status      ON results(status_id);

-- results(race_id): usado em todos os JOINs results → races.
CREATE INDEX IF NOT EXISTS idx_results_race        ON results(race_id);

-- races(circuit_id) e races(season_id): usados em todos os JOINs
-- races → circuits e races → seasons.
CREATE INDEX IF NOT EXISTS idx_races_circuit ON races(circuit_id);
CREATE INDEX IF NOT EXISTS idx_races_season  ON races(season_id);

-- Índices geográficos para R2 (bounding box + Haversine):
-- airports(lat, lon): permite filtrar aeroportos pelo bounding box do Brasil
--                     sem full scan da tabela inteira de aeroportos.
CREATE INDEX IF NOT EXISTS idx_airports_coords ON airports(latitude_deg, longitude_deg);
-- cities(lat, lon): mesma lógica para cidades.
CREATE INDEX IF NOT EXISTS idx_cities_coords   ON cities(latitude, longitude);
-- cities(country_id): JOIN cities → countries para filtrar Brasil (code='BR').
CREATE INDEX IF NOT EXISTS idx_cities_country  ON cities(country_id);


-- ════════════════════════════════════════════════════════
-- VIEWS
-- ════════════════════════════════════════════════════════

-- View 1: corridas da temporada mais recente com dados do circuito.
-- Encapsula a subquery MAX(year) e os JOINs com seasons e circuits,
-- evitando repeti-los em todo lugar que precise desses dados.
CREATE OR REPLACE VIEW vw_season_recente AS
SELECT
    r.id       AS race_id,
    r.race_name,
    r.race_date,
    r.race_time,
    s.year,
    c.id       AS circuit_id,
    c.name     AS circuit_name
FROM races r
JOIN seasons  s ON r.season_id  = s.id
JOIN circuits c ON r.circuit_id = c.id
-- Filtra apenas a temporada mais recente.
WHERE s.year = (SELECT MAX(year) FROM seasons);


-- View 2: resultados completos — todos os JOINs necessários em um só lugar.
-- Usada como base para relatórios e consultas que precisem de dados
-- de driver, constructor, race, season, circuit e status ao mesmo tempo.
CREATE OR REPLACE VIEW vw_resultados AS
SELECT
    res.*,   -- todos os campos de results
    d.given_name  || ' ' || d.family_name AS driver_name,
    con.name      AS constructor_name,
    ra.race_name,
    s.year,
    c.name        AS circuit_name,
    st.status     AS status_nome
FROM results res
JOIN drivers      d   ON res.driver_id      = d.id
JOIN constructors con ON res.constructor_id = con.id
JOIN races        ra  ON res.race_id        = ra.id
JOIN seasons      s   ON ra.season_id       = s.id
JOIN circuits     c   ON ra.circuit_id      = c.id
JOIN status       st  ON res.status_id      = st.id;
```

---

### Relatório 1 — Admin

> *"Indica a quantidade de resultados por status, apresentando o nome do status e sua respectiva contagem."*

**Arquivo:** [`backend/src/routes/admin.js`](backend/src/routes/admin.js) → `GET /api/admin/relatorios/r1`

```sql
-- JOIN entre results e status para pegar o nome do status.
-- A tabela results guarda apenas status_id (chave estrangeira);
-- o nome legível está na tabela status.
SELECT
    st.status  AS status_nome,  -- nome do status (ex: 'Finished', 'Accident')
    COUNT(*)   AS quantidade    -- quantos resultados têm esse status
FROM results res
JOIN status st ON res.status_id = st.id   -- liga resultado ao seu status
GROUP BY st.id, st.status   -- agrupa por status (GROUP BY id evita problemas se dois
                             -- status tiverem o mesmo nome)
ORDER BY quantidade DESC;    -- mais frequente primeiro
```

**Índice utilizado:** `idx_results_status` (no JOIN `res.status_id = st.id`).

---

### Relatório 2 — Admin

> *"Recebe o nome de uma cidade e apresenta aeroportos brasileiros a no máximo 100 km, dos tipos 'medium_airport' ou 'large_airport'. Deve ser criado um índice que auxilie essa consulta."*

**Arquivo:** [`backend/src/routes/admin.js`](backend/src/routes/admin.js) → `GET /api/admin/relatorios/r2?cidade=X`

```sql
-- CTEs (Common Table Expressions): dividem a query em etapas nomeadas
-- para melhorar legibilidade e permitir reutilização dentro da mesma query.

WITH

-- CTE 1: busca as cidades brasileiras com o nome digitado.
-- Pode retornar múltiplas cidades (ex: várias "Campinas" no Brasil).
input_cities AS (
    SELECT c.id, c.name, c.latitude, c.longitude
    FROM cities c
    JOIN countries co ON c.country_id = co.id
    WHERE co.code = 'BR'        -- apenas cidades do Brasil
      AND c.name ILIKE $1       -- ILIKE: LIKE case-insensitive (PostgreSQL)
                                -- $1 = nome da cidade (ex: 'São Paulo')
      AND c.latitude  IS NOT NULL   -- precisa de coordenadas para calcular distância
      AND c.longitude IS NOT NULL
),

-- CTE 2: pré-filtra aeroportos usando bounding box do Brasil.
-- Bounding box é uma caixa retangular de coordenadas que contém o Brasil.
-- Isso evita aplicar a fórmula de Haversine (cara) em aeroportos do mundo todo.
-- Os índices idx_airports_coords e idx_cities_country são usados aqui.
bounding AS (
    SELECT
        a.id, a.iata_code,
        a.name        AS airport_nome,
        a.latitude_deg, a.longitude_deg,
        at.type       AS tipo,
        ci.name       AS cidade_aeroporto
    FROM airports a
    JOIN airport_types at ON a.airport_type_id = at.id
    LEFT JOIN cities ci   ON a.city_id = ci.id
    WHERE a.iata_code IS NOT NULL  -- apenas aeroportos com código IATA
      AND at.type IN ('medium_airport', 'large_airport')  -- tipos do enunciado
      -- Bounding box aproximado do Brasil (lat/lon em graus decimais):
      AND a.latitude_deg  BETWEEN -36 AND  6
      AND a.longitude_deg BETWEEN -75 AND -32
),

-- CTE 3: calcula a distância real usando a Fórmula de Haversine.
-- Haversine leva em conta a curvatura da Terra e calcula a distância
-- entre dois pontos dados por (lat1, lon1) e (lat2, lon2) em km.
-- Fórmula: d = 2R * arcsin(sqrt(sin²(Δlat/2) + cos(lat1)*cos(lat2)*sin²(Δlon/2)))
-- Versão com acos: d = R * acos(cos(lat1)*cos(lat2)*cos(lon2-lon1) + sin(lat1)*sin(lat2))
distances AS (
    SELECT
        ic.name        AS cidade_pesquisada,
        b.iata_code,
        b.airport_nome,
        b.cidade_aeroporto,
        b.tipo,
        ROUND((
            6371 * acos(          -- 6371 = raio médio da Terra em km
                GREATEST(-1, LEAST(1,   -- clamp entre -1 e 1 para evitar erro
                                        -- numérico no acos (domínio [-1,1])
                    cos(radians(ic.latitude))  * cos(radians(b.latitude_deg)) *
                    cos(radians(b.longitude_deg) - radians(ic.longitude)) +
                    sin(radians(ic.latitude))  * sin(radians(b.latitude_deg))
                ))
            )
        )::numeric, 2) AS distancia_km   -- arredonda para 2 casas decimais

    -- CROSS JOIN: combina cada cidade de input com cada aeroporto do bounding.
    -- O bounding box já reduziu muito o número de aeroportos, tornando isso viável.
    FROM input_cities ic CROSS JOIN bounding b
)

-- Query final: filtra os que estão dentro do raio de 100 km.
SELECT cidade_pesquisada, iata_code, airport_nome,
       cidade_aeroporto, distancia_km, tipo
FROM distances
WHERE distancia_km <= 100
ORDER BY distancia_km;   -- mais próximo primeiro
```

**Índices utilizados:** `idx_airports_coords` (bounding box), `idx_cities_coords`, `idx_cities_country` (JOIN com countries).

---

### Relatório 3 — Admin

> *"Lista todas as escuderias com quantidade de pilotos e gera hierarquia em 3 níveis: (1) total de corridas; (2) corridas por circuito com min/avg/max de voltas; (3) para cada corrida: voltas e pilotos participantes."*

**Arquivo:** [`backend/src/routes/admin.js`](backend/src/routes/admin.js) → 3 endpoints encadeados

```sql
-- ── NÍVEL 0: escuderias com pilotos e total de corridas ───────────────
SELECT
    c.id, c.name,
    -- COUNT(DISTINCT driver_id): pilotos únicos que correram pela escuderia.
    COUNT(DISTINCT res.driver_id) AS num_pilotos,
    -- COUNT(DISTINCT race_id): corridas únicas em que a escuderia participou.
    COUNT(DISTINCT res.race_id)   AS total_corridas
FROM constructors c
-- LEFT JOIN: inclui escuderias sem resultados (total_corridas = 0).
LEFT JOIN results res ON c.id = res.constructor_id
GROUP BY c.id, c.name
ORDER BY num_pilotos DESC;


-- ── NÍVEL 2: circuitos de uma escuderia (carregado ao clicar) ─────────
SELECT
    ci.id, ci.name AS circuit_name,
    COUNT(DISTINCT ra.id) AS total_corridas,
    -- Subquery lp: calcula MAX(laps) por corrida DENTRO da escuderia.
    -- MAX(laps) representa as voltas completadas naquela corrida.
    MIN(lp.max_laps)                   AS min_voltas,
    ROUND(AVG(lp.max_laps))::INTEGER   AS avg_voltas,
    MAX(lp.max_laps)                   AS max_voltas
FROM results res
JOIN races ra    ON res.race_id   = ra.id
JOIN circuits ci ON ra.circuit_id = ci.id
JOIN (
    -- Subquery: para cada corrida, pega o máximo de voltas da escuderia.
    -- WHERE laps IS NOT NULL: ignora resultados sem dado de voltas.
    SELECT race_id, MAX(laps) AS max_laps
    FROM results
    WHERE laps IS NOT NULL AND constructor_id = $1
    GROUP BY race_id
) lp ON ra.id = lp.race_id
WHERE res.constructor_id = $1
GROUP BY ci.id, ci.name;


-- ── NÍVEL 3: corridas de um circuito (carregado ao clicar) ───────────
SELECT
    ra.race_name, s.year,
    COALESCE(MAX(res.laps), 0)    AS total_voltas,
    COUNT(DISTINCT res.driver_id) AS num_pilotos
FROM results res
JOIN races ra  ON res.race_id  = ra.id
JOIN seasons s ON ra.season_id = s.id
WHERE res.constructor_id = $1   -- escuderia
  AND ra.circuit_id      = $2   -- circuito
GROUP BY ra.id, ra.race_name, s.year
ORDER BY s.year DESC;
```

**Por que 3 endpoints separados:** lazy loading — os dados de circuitos e corridas só são buscados quando o usuário clica para expandir, evitando carregar todos os dados de todas as escuderias de uma vez.

---

### Relatório 4 — Escuderia

> *"Lista os pilotos da escuderia e a quantidade de vezes em que cada um alcançou a primeira posição."*

**Arquivo:** [`backend/src/routes/escuderia.js`](backend/src/routes/escuderia.js) → `GET /api/escuderia/relatorios/r4/:constructor_id`

```sql
SELECT
    d.given_name || ' ' || d.family_name AS driver_name,

    -- COUNT com CASE: conta vitórias sem precisar de subquery.
    -- Para cada resultado: se position='1', retorna 1; senão retorna NULL.
    -- COUNT ignora NULL, então só conta as linhas onde houve vitória.
    COUNT(CASE WHEN res.position = '1' THEN 1 END)::INTEGER AS primeiras_posicoes

FROM results res
JOIN drivers d ON res.driver_id = d.id
WHERE res.constructor_id = $1   -- filtra pela escuderia logada
GROUP BY d.id, d.given_name, d.family_name
ORDER BY primeiras_posicoes DESC, driver_name;
```

**Índice utilizado:** `idx_results_constructor`.

---

### Relatório 5 — Escuderia

> *"Lista a quantidade de resultados por status, limitado ao escopo da escuderia logada."*

**Arquivo:** [`backend/src/routes/escuderia.js`](backend/src/routes/escuderia.js) → `GET /api/escuderia/relatorios/r5/:constructor_id`

```sql
-- Mesmo padrão do R1 do Admin, mas com WHERE constructor_id = $1
-- restringindo ao escopo da escuderia logada.
SELECT
    st.status AS status_nome,
    COUNT(*)  AS quantidade
FROM results res
JOIN status st ON res.status_id = st.id
WHERE res.constructor_id = $1   -- apenas resultados desta escuderia
GROUP BY st.id, st.status
ORDER BY quantidade DESC;
```

---

### Relatório 6 — Piloto

> *"Consulta a quantidade total de pontos obtidos por ano, apresentando as corridas em que os pontos foram obtidos. Informações restritas ao piloto logado."*

**Arquivo:** [`backend/src/routes/piloto.js`](backend/src/routes/piloto.js) → `GET /api/piloto/relatorios/r6/:driver_id`

```sql
SELECT
    s.year      AS ano,
    ra.race_name AS corrida,
    res.points  AS pontos
FROM results res
JOIN races   ra ON res.race_id  = ra.id    -- para pegar o nome da corrida
JOIN seasons s  ON ra.season_id = s.id     -- para pegar o ano
WHERE res.driver_id = $1   -- apenas resultados deste piloto
  AND res.points > 0       -- apenas corridas onde marcou pontos
ORDER BY s.year DESC, res.points DESC;
-- O frontend recebe as linhas e agrupa por ano para calcular
-- o total de pontos por temporada.
```

**Índice utilizado:** `idx_results_driver`.

---

### Relatório 7 — Piloto

> *"Lista a quantidade de resultados por status nas corridas em que o piloto participou, limitado ao escopo do piloto logado."*

**Arquivo:** [`backend/src/routes/piloto.js`](backend/src/routes/piloto.js) → `GET /api/piloto/relatorios/r7/:driver_id`

```sql
-- Mesmo padrão do R5 da Escuderia, mas filtrado por driver_id.
-- Mostra o histórico de status: Finished, Accident, Engine, etc.
SELECT
    st.status AS status_nome,
    COUNT(*)  AS quantidade
FROM results res
JOIN status st ON res.status_id = st.id
WHERE res.driver_id = $1   -- apenas resultados deste piloto
GROUP BY st.id, st.status
ORDER BY quantidade DESC;
```

---

## Resumo dos Conceitos de BD Utilizados

| Conceito | O que é | Onde no projeto |
|---|---|---|
| DDL (CREATE TABLE) | Define estrutura das tabelas | `sql/01_create_tables.sql` |
| Constraints (UNIQUE, CHECK, FK) | Regras de integridade no banco | `sql/01_create_tables.sql` |
| INSERT SELECT | Insere múltiplas linhas de uma query | `sql/02_populate_users.sql` |
| Triggers AFTER INSERT/UPDATE | Executam automaticamente ao modificar tabela | `sql/03_triggers.sql` |
| Stored Functions RETURNS INTEGER | Função que retorna um valor escalar | `sql/04_functions.sql` |
| Stored Functions RETURNS TABLE | Função que retorna múltiplas linhas/colunas | `sql/04_functions.sql` |
| Views | Query salva reutilizável | `sql/05_views_indexes.sql` |
| Índices B-Tree | Aceleram buscas e JOINs | `sql/05_views_indexes.sql` |
| CTEs (`WITH`) | Dividem queries complexas em etapas | R2 — `admin.js` |
| Agregações (COUNT, SUM, MIN, MAX, AVG) | Calculam valores sobre grupos de linhas | todos os relatórios |
| COUNT(DISTINCT) | Conta valores únicos | R3, R4, funções de escuderia |
| COUNT(CASE WHEN) | Conta condicionalmente sem subquery | R4, fn_driver_performance |
| JOINs (INNER, LEFT, CROSS) | Combinam dados de múltiplas tabelas | todos os endpoints |
| Subqueries correlacionadas (EXISTS) | Verificam existência com referência externa | BuscarPiloto, triggers |
| RAISE EXCEPTION em trigger | Cancela operação e reverte transação | `sql/03_triggers.sql` |
| Hash MD5 para senhas | Armazena senha de forma protegida | todos os INSERT em USERS |
| Fórmula de Haversine em SQL | Distância geográfica entre coordenadas | R2 — `admin.js` |
| Bounding Box geográfico | Pré-filtro eficiente antes de cálculo caro | R2 — `admin.js` |
| TG_OP, NEW, OLD (variáveis de trigger) | Acessam contexto dentro de uma trigger | `sql/03_triggers.sql` |
| ON CONFLICT DO NOTHING | Idempotência em INSERTs | `sql/02_populate_users.sql` |
| RETURNING | Retorna dados da linha após INSERT | `admin.js` cadastros |
