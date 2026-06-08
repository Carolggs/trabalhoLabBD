// Conexão com PostgreSQL usando pg (node-postgres)
// Os comandos SQL ficam explícitos nas rotas — sem ORM que oculte os scripts
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'f1',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '1234',
});

export default pool;
