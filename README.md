# F1 Database App — SCC-541 Lab BD

Aplicação web full-stack para consulta e gestão de dados históricos da Fórmula 1, desenvolvida como projeto final da disciplina SCC-541 (Laboratório de Bases de Dados — ICMC/USP).

O sistema possui três perfis de acesso — **Admin**, **Escuderia** e **Piloto** — cada um com dashboard e relatórios específicos. Toda a lógica de negócio sensível (funções, triggers, views) está implementada diretamente no PostgreSQL.

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18 + Vite 4, react-router-dom, CSS puro temático F1 |
| Backend | Node.js (ESM) + Express 4 |
| Banco de dados | PostgreSQL (banco `f1`) |
| Comunicação | REST API (JSON) |

---

## Estrutura do projeto

```
trabalhoLabBD/
├── sql/
│   ├── 01_create_tables.sql     # Tabelas USERS e USERS_LOG + usuário admin
│   ├── 02_populate_users.sql    # Popula USERS a partir de drivers e constructors
│   ├── 03_triggers.sql          # Sincronização automática drivers/constructors → USERS
│   ├── 04_functions.sql         # 5 stored functions chamadas pelo backend
│   └── 05_views_indexes.sql     # Views vw_season_recente e vw_resultados + 9 índices
├── backend/
│   └── src/
│       ├── index.js             # Servidor Express (porta 3001)
│       ├── db.js                # Pool de conexão pg
│       └── routes/
│           ├── auth.js          # POST /api/auth/login e /logout
│           ├── admin.js         # Dashboard admin + relatórios R1, R2, R3
│           ├── escuderia.js     # Dashboard escuderia + relatórios R4, R5
│           └── piloto.js        # Dashboard piloto + relatórios R6, R7
└── frontend/
    └── src/
        ├── App.jsx              # Roteamento + PrivateRoute
        ├── contexts/
        │   └── AuthContext.jsx  # Estado de autenticação (sessionStorage)
        ├── services/
        │   └── api.js           # Wrapper de fetch para a API
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx        # Redireciona para o dash do perfil correto
            ├── Dashboard/           # DashboardContent por perfil
            ├── EscuderiaPages.jsx   # Busca e importação de pilotos
            ├── CadastrarPiloto.jsx  # Formulário de cadastro (admin)
            └── Relatorios.jsx       # Página unificada de relatórios
```

---

## Pré-requisitos

- **Node.js** 20.x (Vite 4 não é compatível com Node < 18 nem com Vite 7+)
- **PostgreSQL** 14+
- `psql` disponível no PATH

---

## Configuração do banco de dados

### 1. Criar o banco e carregar o schema base

```bash
psql -U postgres -c "CREATE DATABASE f1;"
psql -U postgres -d f1 -f schema.sql      # schema original da disciplina
psql -U postgres -d f1 -f cargaf1.sql     # carga de dados históricos
```

### 2. Executar os scripts do projeto (em ordem)

```bash
psql -U postgres -d f1 -f sql/01_create_tables.sql
psql -U postgres -d f1 -f sql/02_populate_users.sql
psql -U postgres -d f1 -f sql/03_triggers.sql
psql -U postgres -d f1 -f sql/04_functions.sql
psql -U postgres -d f1 -f sql/05_views_indexes.sql
```

---

## Rodando o projeto

### Backend

```bash
cd backend
npm install
npm run dev      # hot-reload com --watch
# ou
npm start        # produção
```

O servidor sobe em `http://localhost:3001`.

**Variáveis de ambiente** (opcionais — os padrões funcionam para instalação local padrão):

| Variável | Padrão |
|----------|--------|
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `f1` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `1234` |

Para sobrescrever, exporte antes de rodar:

```bash
DB_PASSWORD=minha_senha npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

O app abre em `http://localhost:5173`.

---

## Usuários de acesso

As senhas são armazenadas como hash MD5.

| Perfil | Login | Senha |
|--------|-------|-------|
| Admin | `admin` | `admin` |
| Escuderia | `<constructor_ref>_c` | `<constructor_ref>` |
| Piloto | `<driver_ref>_d` | `<driver_ref>` |

Exemplos de login de escuderia: `ferrari_c` / `ferrari` — de piloto: `hamilton_d` / `hamilton`.

---

## Funcionalidades por perfil

### Admin
- Dashboard com totais globais (pilotos, escuderias, temporadas)
- Corridas da temporada mais recente com circuito e total de voltas
- Ranking de pilotos e escuderias por pontos na temporada mais recente
- Cadastro de novos pilotos e escuderias
- **R1** — distribuição de resultados por status (Finished, Accident, etc.)
- **R2** — aeroportos medium/large em até 100 km de uma cidade brasileira (fórmula de Haversine)
- **R3** — drill-down: escuderias → circuitos → corridas com estatísticas de voltas

### Escuderia
- Dashboard com vitórias, número de pilotos e período de atividade (via stored functions)
- Busca de pilotos que já correram pela escuderia
- Importação em lote de pilotos via arquivo `.txt` (CSV simples)
- **R4** — pilotos da escuderia e quantas vezes cada um largou em 1º lugar
- **R5** — distribuição de resultados por status para a escuderia

### Piloto
- Dashboard com primeiro e último ano na F1, escuderia mais recente e desempenho por temporada/circuito (via stored functions)
- **R6** — corridas em que o piloto marcou pontos, agrupadas por ano
- **R7** — distribuição de resultados por status para o piloto

---

## Objetos de banco criados pelo projeto

| Tipo | Nome | Descrição |
|------|------|-----------|
| Tabela | `USERS` | Usuários do sistema (Admin / Escuderia / Piloto) |
| Tabela | `USERS_LOG` | Log de login e logout |
| Trigger | `trg_sync_driver_to_users` | Cria usuário em USERS ao inserir em `drivers` |
| Trigger | `trg_sync_constructor_to_users` | Cria usuário em USERS ao inserir em `constructors` |
| Function | `fn_escuderia_vitories(id)` | Total de vitórias de uma escuderia |
| Function | `fn_escuderia_pilots_count(id)` | Número de pilotos distintos de uma escuderia |
| Function | `fn_escuderia_years(id)` | Primeiro e último ano de atividade de uma escuderia |
| Function | `fn_driver_years(id)` | Primeiro e último ano de atividade de um piloto |
| Function | `fn_driver_performance(id)` | Desempenho do piloto por ano e circuito |
| View | `vw_season_recente` | Corridas e circuitos da temporada mais recente |
| View | `vw_resultados` | Resultados enriquecidos (piloto, escuderia, status, pontos) |
| Índices | 9 índices | Em `results`, `races`, `airports` e `cities` |

---

## API — Endpoints principais

```
POST   /api/auth/login
POST   /api/auth/logout

GET    /api/admin/dashboard
POST   /api/admin/drivers
POST   /api/admin/constructors
GET    /api/admin/relatorios/r1
GET    /api/admin/relatorios/r2?cidade=<nome>
GET    /api/admin/relatorios/r3
GET    /api/admin/relatorios/r3/:constructor_id
GET    /api/admin/relatorios/r3/:constructor_id/:circuit_id

GET    /api/escuderia/dashboard/:constructor_id
GET    /api/escuderia/pilotos/search?surname=X&constructor_id=Y
POST   /api/escuderia/pilotos/import           (multipart/form-data)
GET    /api/escuderia/relatorios/r4/:constructor_id
GET    /api/escuderia/relatorios/r5/:constructor_id

GET    /api/piloto/dashboard/:driver_id
GET    /api/piloto/relatorios/r6/:driver_id
GET    /api/piloto/relatorios/r7/:driver_id
```
