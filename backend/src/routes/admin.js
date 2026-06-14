// Rotas de Administrador
import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Total de pilotos, escuderias, temporadas
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM drivers) AS total_drivers,
        (SELECT COUNT(*) FROM constructors) AS total_constructors,
        (SELECT COUNT(*) FROM seasons) AS total_seasons
    `);

    // Corridas da temporada mais recente
    const racesResult = await pool.query(`
      SELECT
        r.id, r.race_name, c.name AS circuit, r.race_date, r.race_time,
        COUNT(DISTINCT res.driver_id) AS participantes
      FROM races r
      JOIN circuits c ON r.circuit_id = c.id
      JOIN seasons s ON r.season_id = s.id
      LEFT JOIN results res ON r.id = res.race_id
      WHERE s.year = (SELECT MAX(year) FROM seasons)
      GROUP BY r.id, r.race_name, c.name, r.race_date, r.race_time
      ORDER BY r.race_date
    `);

    // Escuderias com pontos (temporada mais recente)
    const constructorsResult = await pool.query(`
      SELECT
        c.id, c.name,
        SUM(res.points) AS total_pontos
      FROM constructors c
      JOIN results res ON c.id = res.constructor_id
      JOIN races r ON res.race_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE s.year = (SELECT MAX(year) FROM seasons)
      GROUP BY c.id, c.name
      ORDER BY total_pontos DESC
    `);

    // Pilotos com pontos (temporada mais recente)
    const driversResult = await pool.query(`
      SELECT
        d.id, d.given_name || ' ' || d.family_name AS nome,
        SUM(res.points) AS total_pontos
      FROM drivers d
      JOIN results res ON d.id = res.driver_id
      JOIN races r ON res.race_id = r.id
      JOIN seasons s ON r.season_id = s.id
      WHERE s.year = (SELECT MAX(year) FROM seasons)
      GROUP BY d.id
      ORDER BY total_pontos DESC
    `);

    res.json({
      ...statsResult.rows[0],
      recent_races: racesResult.rows,
      constructors_points: constructorsResult.rows,
      drivers_points: driversResult.rows,
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard admin:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// POST /api/admin/drivers - Cadastrar piloto
router.post('/drivers', async (req, res) => {
  const { driver_ref, given_name, family_name, date_of_birth, nationality } = req.body;

  if (!driver_ref || !given_name || !family_name) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  try {
    // Insere na tabela DRIVERS
    const result = await pool.query(
      `INSERT INTO drivers (driver_ref, given_name, family_name, date_of_birth, nationality)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [driver_ref, given_name, family_name, date_of_birth || null, nationality || 'Unknown']
    );

    const driver_id = result.rows[0].id;

    // Trigger automático vai criar o usuário em USERS
    // login: driver_ref_d, password: md5(driver_ref), tipo: Piloto

    res.status(201).json({
      message: 'Piloto cadastrado com sucesso',
      driver_id,
      login: `${driver_ref}_d`,
    });
  } catch (err) {
    console.error('Erro ao cadastrar piloto:', err);
    if (err.message.includes('já existe')) {
      res.status(400).json({ error: 'Piloto já existe ou login duplicado' });
    } else {
      res.status(500).json({ error: 'Erro ao cadastrar piloto' });
    }
  }
});

// POST /api/admin/constructors - Cadastrar escuderia
router.post('/constructors', async (req, res) => {
  const { constructor_ref, name, nationality, wikipedia_url } = req.body;

  if (!constructor_ref || !name) {
    return res.status(400).json({ error: 'constructor_ref e name são obrigatórios' });
  }

  try {
    // Insere na tabela CONSTRUCTORS
    const result = await pool.query(
      `INSERT INTO constructors (constructor_ref, name, nationality, wikipedia_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [constructor_ref, name, nationality || 'Unknown', wikipedia_url || null]
    );

    const constructor_id = result.rows[0].id;

    // Trigger automático vai criar o usuário em USERS
    // login: constructor_ref_c, password: md5(constructor_ref), tipo: Escuderia

    res.status(201).json({
      message: 'Escuderia cadastrada com sucesso',
      constructor_id,
      login: `${constructor_ref}_c`,
    });
  } catch (err) {
    console.error('Erro ao cadastrar escuderia:', err);
    if (err.message.includes('já existe')) {
      res.status(400).json({ error: 'Escuderia já existe ou login duplicado' });
    } else {
      res.status(500).json({ error: 'Erro ao cadastrar escuderia' });
    }
  }
});

// ── RELATÓRIOS ──────────────────────────────────────────────

// R1: quantidade de resultados por status (nome do status + contagem)
router.get('/relatorios/r1', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT st.status AS status_nome, COUNT(*) AS quantidade
      FROM results res
      JOIN status st ON res.status_id = st.id
      GROUP BY st.id, st.status
      ORDER BY quantidade DESC
    `);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R1:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R1' });
  }
});

// R2: aeroportos a ≤100 km de cidade brasileira
// Usa fórmula de Haversine; bounding-box pre-filtra os aeroportos candidatos
// para evitar CROSS JOIN completo (Brasil: lat -35..5, lon -74..-32)
router.get('/relatorios/r2', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH brazil_cities AS (
        SELECT c.id, c.name, c.latitude, c.longitude
        FROM cities c
        JOIN countries co ON c.country_id = co.id
        WHERE co.code = 'BR'
          AND c.latitude  IS NOT NULL
          AND c.longitude IS NOT NULL
      ),
      nearest AS (
        SELECT DISTINCT ON (a.id)
          a.iata_code,
          a.name          AS airport_nome,
          bc.name         AS cidade,
          at.type         AS tipo,
          ROUND((
            6371 * acos(
              GREATEST(-1, LEAST(1,
                cos(radians(bc.latitude))  * cos(radians(a.latitude_deg)) *
                cos(radians(a.longitude_deg) - radians(bc.longitude)) +
                sin(radians(bc.latitude))  * sin(radians(a.latitude_deg))
              ))
            )
          )::numeric, 2)  AS distancia_km
        FROM airports a
        JOIN airport_types at ON a.airport_type_id = at.id
        CROSS JOIN brazil_cities bc
        WHERE a.iata_code IS NOT NULL
          AND a.latitude_deg  BETWEEN -36 AND  6
          AND a.longitude_deg BETWEEN -75 AND -32
        ORDER BY a.id,
          (6371 * acos(
            GREATEST(-1, LEAST(1,
              cos(radians(bc.latitude))  * cos(radians(a.latitude_deg)) *
              cos(radians(a.longitude_deg) - radians(bc.longitude)) +
              sin(radians(bc.latitude))  * sin(radians(a.latitude_deg))
            ))
          )) ASC
      )
      SELECT iata_code, airport_nome, cidade, distancia_km, tipo
      FROM nearest
      WHERE distancia_km <= 100
      ORDER BY distancia_km
    `);
    res.json({ rows: result.rows });
  } catch (err) {
    console.error('R2:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R2' });
  }
});

// R3 nível 1+2: circuitos com total de corridas e min/avg/max voltas
router.get('/relatorios/r3', async (req, res) => {
  try {
    const totalResult = await pool.query(
      `SELECT COUNT(*) AS total_corridas FROM races`
    );

    const circuitsResult = await pool.query(`
      SELECT
        c.id            AS circuit_id,
        c.name          AS circuit_name,
        COUNT(r.id)     AS total_corridas,
        MIN(laps_agg.max_laps)                    AS min_voltas,
        ROUND(AVG(laps_agg.max_laps))::INTEGER    AS avg_voltas,
        MAX(laps_agg.max_laps)                    AS max_voltas
      FROM circuits c
      JOIN races r ON c.id = r.circuit_id
      JOIN (
        SELECT race_id, MAX(laps) AS max_laps
        FROM results
        WHERE laps IS NOT NULL
        GROUP BY race_id
      ) laps_agg ON r.id = laps_agg.race_id
      GROUP BY c.id, c.name
      ORDER BY total_corridas DESC
    `);

    res.json({
      total_corridas: parseInt(totalResult.rows[0].total_corridas),
      circuits: circuitsResult.rows,
    });
  } catch (err) {
    console.error('R3:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R3' });
  }
});

// R3 nível 3: corridas + pilotos de um circuito específico
router.get('/relatorios/r3/:circuit_id', async (req, res) => {
  const { circuit_id } = req.params;
  try {
    const racesResult = await pool.query(`
      SELECT
        r.id        AS race_id,
        r.race_name,
        r.race_date,
        s.year,
        COALESCE(MAX(res.laps), 0)          AS total_voltas,
        COUNT(DISTINCT res.driver_id)       AS num_pilotos
      FROM races r
      JOIN seasons s ON r.season_id = s.id
      LEFT JOIN results res ON r.id = res.race_id
      WHERE r.circuit_id = $1
      GROUP BY r.id, r.race_name, r.race_date, s.year
      ORDER BY r.race_date DESC
    `, [circuit_id]);

    // Para cada corrida, busca os pilotos (top 10 para não explodir a resposta)
    const races = await Promise.all(
      racesResult.rows.map(async race => {
        const pilotsResult = await pool.query(`
          SELECT
            d.given_name || ' ' || d.family_name AS driver_name,
            res.position,
            res.laps
          FROM results res
          JOIN drivers d ON res.driver_id = d.id
          WHERE res.race_id = $1
          ORDER BY res.position_order
          LIMIT 10
        `, [race.race_id]);
        return { ...race, pilotos: pilotsResult.rows };
      })
    );

    res.json({ races });
  } catch (err) {
    console.error('R3 detalhe:', err);
    res.status(500).json({ error: 'Erro ao carregar detalhe do circuito' });
  }
});

export default router;
