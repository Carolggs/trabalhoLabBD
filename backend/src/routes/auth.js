// Login e logout — toda autenticação passa por aqui.
// A senha nunca chega no banco em texto puro: o md5() é aplicado
// direto no WHERE, então o banco só compara hashes.
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: 'Login e senha são obrigatórios.' });
  }

  try {
    // md5($2) roda no próprio banco — a senha em texto puro nunca
    // sai do corpo da requisição e nunca fica logada em lugar nenhum.
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

    // Registra o acesso em USERS_LOG independente de qualquer outra coisa.
    // NOW() vem do banco pra não depender do relógio do servidor Node.
    await pool.query(
      `INSERT INTO USERS_LOG (userid, acao, timestamp)
       VALUES ($1, 'LOGIN', NOW())`,
      [user.userid]
    );

    // O frontend precisa de um nome pra mostrar na tela.
    // Admin não tem registro em drivers/constructors, então trata separado.
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
router.post('/logout', async (req, res) => {
  const { userid } = req.body;

  if (!userid) {
    return res.status(400).json({ error: 'userid é obrigatório.' });
  }

  try {
    // Só registra o LOGOUT no log — sem invalidar sessão no banco
    // porque a sessão é controlada pelo sessionStorage no frontend.
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
