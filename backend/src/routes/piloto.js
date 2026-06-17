import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/piloto/dashboard/:driver_id
router.get('/dashboard/:driver_id', async (req, res) => {
  const { driver_id } = req.params;

  try {
    // Primeiro e último ano do piloto na base — vem de função armazenada
    const yearsResult = await pool.query(
      `SELECT first_year, last_year FROM fn_driver_years($1)`,
      [driver_id]
    );

    // Desempenho por ano e circuito — outra função armazenada
    const performanceResult = await pool.query(
      `SELECT * FROM fn_driver_performance($1)`,
      [driver_id]
    );

    // Escuderia mais recente do piloto.
    // Ordenamos por ano e round decrescentes e pegamos só a primeira linha —
    // assim sempre mostramos a equipe mais recente, não a primeira da carreira.
    const teamResult = await pool.query(
      `SELECT c.name AS team_name
       FROM results r
       JOIN constructors c ON r.constructor_id = c.id
       JOIN races ra       ON r.race_id        = ra.id
       JOIN seasons s      ON ra.season_id     = s.id
       WHERE r.driver_id = $1
       ORDER BY s.year DESC, ra.round DESC
       LIMIT 1`,
      [driver_id]
    );

    res.json({
      first_year:  yearsResult.rows[0]?.first_year  || null,
      last_year:   yearsResult.rows[0]?.last_year   || null,
      team_name:   teamResult.rows[0]?.team_name    || null,
      performance: performanceResult.rows,
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard piloto:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// ── RELATÓRIOS ──────────────────────────────────────────────

// R6: corridas em que o piloto marcou pontos, agrupadas por ano
router.get('/relatorios/r6/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT year AS ano, race_name AS corrida, points AS pontos
      FROM vw_resultados
      WHERE driver_id = $1
        AND points > 0
      ORDER BY year DESC, points DESC
    `, [driver_id]);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R6:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R6' });
  }
});

// R7: distribuição de resultados por status para o piloto
// (quantas vezes terminou a corrida, abandonou, foi punido, etc.)
router.get('/relatorios/r7/:driver_id', async (req, res) => {
  const { driver_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT status_nome, COUNT(*) AS quantidade
      FROM vw_resultados
      WHERE driver_id = $1
      GROUP BY status_nome
      ORDER BY quantidade DESC
    `, [driver_id]);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R7:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R7' });
  }
});

export default router;
