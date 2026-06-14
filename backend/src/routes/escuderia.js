// Rotas de Escuderia
import { Router } from 'express';
import pool from '../db.js';
import multer from 'multer';
import { Readable } from 'stream';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// GET /api/escuderia/dashboard/:constructor_id
router.get('/dashboard/:constructor_id', async (req, res) => {
  const { constructor_id } = req.params;

  try {
    // Usando funções armazenadas do banco para melhor performance
    // Conceito: Stored functions encapsulam lógica no banco, não no backend

    const victoriesResult = await pool.query(
      `SELECT fn_escuderia_vitories($1) AS vitories`,
      [constructor_id]
    );

    const pilotsResult = await pool.query(
      `SELECT fn_escuderia_pilots_count($1) AS pilots_count`,
      [constructor_id]
    );

    const yearsResult = await pool.query(
      `SELECT first_year, last_year FROM fn_escuderia_years($1)`,
      [constructor_id]
    );

    const data = {
      vitories: parseInt(victoriesResult.rows[0]?.vitories || 0),
      pilots_count: parseInt(pilotsResult.rows[0]?.pilots_count || 0),
      first_year: yearsResult.rows[0]?.first_year || null,
      last_year: yearsResult.rows[0]?.last_year || null,
    };

    res.json(data);
  } catch (err) {
    console.error('Erro ao carregar dashboard escuderia:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// GET /api/escuderia/pilotos/search?surname=X
router.get('/pilotos/search', async (req, res) => {
  const { surname } = req.query;

  if (!surname) {
    return res.status(400).json({ error: 'Parâmetro surname é obrigatório' });
  }

  try {
    // Buscar pilotos por sobrenome que já correram
    const result = await pool.query(
      `SELECT
         d.id, d.driver_ref,
         d.given_name || ' ' || d.family_name AS full_name,
         d.date_of_birth, d.nationality
       FROM drivers d
       WHERE LOWER(d.family_name) LIKE LOWER($1)
       AND EXISTS (SELECT 1 FROM results WHERE driver_id = d.id)
       ORDER BY d.given_name, d.family_name`,
      [`%${surname}%`]
    );

    res.json({ pilotos: result.rows });
  } catch (err) {
    console.error('Erro ao buscar pilotos:', err);
    res.status(500).json({ error: 'Erro ao buscar pilotos' });
  }
});

// POST /api/escuderia/pilotos/import
router.post('/pilotos/import', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Arquivo é obrigatório' });
  }

  try {
    // Converte buffer para string
    const content = req.file.buffer.toString('utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    let imported = 0;
    let duplicates = 0;
    const errors = [];

    for (const line of lines) {
      const [driver_ref, given_name, family_name, date_of_birth, nationality] = line
        .split(',')
        .map(v => v.trim());

      if (!driver_ref || !given_name || !family_name) {
        errors.push(`Linha inválida: ${line}`);
        continue;
      }

      try {
        // Verifica duplicata (mesmo nome e sobrenome)
        const existsResult = await pool.query(
          `SELECT id FROM drivers
           WHERE LOWER(given_name) = LOWER($1) AND LOWER(family_name) = LOWER($2)`,
          [given_name, family_name]
        );

        if (existsResult.rows.length > 0) {
          duplicates++;
          continue;
        }

        // Insere piloto
        await pool.query(
          `INSERT INTO drivers (driver_ref, given_name, family_name, date_of_birth, nationality)
           VALUES ($1, $2, $3, $4, $5)`,
          [driver_ref, given_name, family_name, date_of_birth || null, nationality || 'Unknown']
        );

        // Trigger automático cria o usuário em USERS
        imported++;
      } catch (err) {
        if (err.message.includes('já existe')) {
          duplicates++;
        } else {
          errors.push(`Erro ao inserir ${given_name} ${family_name}: ${err.message}`);
        }
      }
    }

    res.json({
      ok: true,
      imported,
      duplicates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Erro ao importar pilotos:', err);
    res.status(500).json({ error: 'Erro ao processar arquivo' });
  }
});

// ── RELATÓRIOS ──────────────────────────────────────────────

// R4: pilotos da escuderia + quantidade de 1ª posições
router.get('/relatorios/r4/:constructor_id', async (req, res) => {
  const { constructor_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        d.given_name || ' ' || d.family_name  AS driver_name,
        COUNT(CASE WHEN res.position = '1' THEN 1 END)::INTEGER AS primeiras_posicoes
      FROM results res
      JOIN drivers d ON res.driver_id = d.id
      WHERE res.constructor_id = $1
      GROUP BY d.id, d.given_name, d.family_name
      ORDER BY primeiras_posicoes DESC, driver_name
    `, [constructor_id]);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R4:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R4' });
  }
});

// R5: resultados por status filtrado à escuderia
router.get('/relatorios/r5/:constructor_id', async (req, res) => {
  const { constructor_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        st.status   AS status_nome,
        COUNT(*)    AS quantidade
      FROM results res
      JOIN status st ON res.status_id = st.id
      WHERE res.constructor_id = $1
      GROUP BY st.id, st.status
      ORDER BY quantidade DESC
    `, [constructor_id]);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R5:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R5' });
  }
});

export default router;
