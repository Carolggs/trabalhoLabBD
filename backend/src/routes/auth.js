// Rotas de autenticação — Login e Logout
// Conceito: autenticação por tabela USERS com senha hasheada em MD5 (req. 2)
//           auditoria via USERS_LOG (req. 6)
// Os SQL estão explícitos aqui para avaliação (sem ORM)
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// POST /api/auth/login
// Verifica credenciais na tabela USERS e registra LOGIN em USERS_LOG
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
  }

  try {
    // SQL explícito: busca usuário comparando senha com md5()
    // Conceito: autenticação via hash — nunca comparamos texto puro
    const result = await pool.query(
      `SELECT userid, login, tipo, id_original
       FROM USERS
       WHERE login = $1
         AND password = md5($2)`,
      [login, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Login ou senha inválidos.' });
    }

    const user = result.rows[0];

    // Registra LOGIN no log de auditoria (req. 6)
    // Conceito: INSERT com NOW() para timestamp automático
    await pool.query(
      `INSERT INTO USERS_LOG (userid, acao, timestamp)
       VALUES ($1, 'LOGIN', NOW())`,
      [user.userid]
    );

    // Busca nome de exibição conforme o tipo de usuário
    let displayName = user.login;
    if (user.tipo === 'Piloto' && user.id_original) {
      const dr = await pool.query(
        `SELECT given_name || ' ' || family_name AS nome FROM drivers WHERE id = $1`,
        [user.id_original]
      );
      if (dr.rows.length > 0) displayName = dr.rows[0].nome;
    } else if (user.tipo === 'Escuderia' && user.id_original) {
      const co = await pool.query(
        `SELECT name AS nome FROM constructors WHERE id = $1`,
        [user.id_original]
      );
      if (co.rows.length > 0) displayName = co.rows[0].nome;
    } else if (user.tipo === 'Admin') {
      displayName = 'Administrador';
    }

    return res.json({
      userid:      user.userid,
      login:       user.login,
      tipo:        user.tipo,
      id_original: user.id_original,
      displayName,
    });
  } catch (err) {
    console.error('Erro no login:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

// POST /api/auth/logout
// Registra LOGOUT em USERS_LOG e encerra a sessão
router.post('/logout', async (req, res) => {
  const { userid } = req.body;

  if (!userid) {
    return res.status(400).json({ error: 'userid é obrigatório.' });
  }

  try {
    // SQL explícito: INSERT no log de auditoria para LOGOUT (req. 6)
    await pool.query(
      `INSERT INTO USERS_LOG (userid, acao, timestamp)
       VALUES ($1, 'LOGOUT', NOW())`,
      [userid]
    );

    return res.json({ message: 'Logout registrado com sucesso.' });
  } catch (err) {
    console.error('Erro no logout:', err);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
});

export default router;
