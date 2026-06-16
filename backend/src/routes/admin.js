import { Router } from 'express';
import pool from '../db.js';

const router = Router();

// GET /api/admin/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    // Três subqueries numa tacada só pra não fazer três round-trips pro banco
    const statsResult = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM drivers)      AS total_drivers,
        (SELECT COUNT(*) FROM constructors) AS total_constructors,
        (SELECT COUNT(*) FROM seasons)      AS total_seasons
    `);

    // Corridas da temporada mais recente com o circuito e total de voltas.
    // MAX(res.laps) porque cada piloto tem uma linha em results — pegamos
    // o maior valor de voltas completadas como proxy do total da corrida.
    const racesResult = await pool.query(`
      SELECT
        r.id, r.race_name, c.name AS circuit, r.race_date, r.race_time,
        COALESCE(MAX(res.laps), 0) AS total_voltas
      FROM races r
      JOIN circuits c  ON r.circuit_id = c.id
      JOIN seasons s   ON r.season_id  = s.id
      LEFT JOIN results res ON r.id = res.race_id
      WHERE s.year = (SELECT MAX(year) FROM seasons)
      GROUP BY r.id, r.race_name, c.name, r.race_date, r.race_time
      ORDER BY r.race_date
    `);

    // Ranking de escuderias por pontos na temporada mais recente.
    //
    // O problema de consultar driver_standings diretamente é que ela tem
    // uma linha por rodada — se buscarmos sem filtro, o mesmo piloto/escuderia
    // aparece várias vezes (uma por corrida disputada).
    //
    // Solução: DISTINCT ON (c.id) com ORDER BY round DESC pega apenas
    // a linha mais recente de cada escuderia (o acumulado final).
    // O ORDER BY externo (fora da subquery) aí sim ordena por pontos.
    const constructorsResult = await pool.query(`
      SELECT * FROM (
        SELECT DISTINCT ON (c.id)
          c.id, c.name,
          st.points AS total_pontos
        FROM constructor_standings cs
        JOIN standings st   ON cs.standing_id   = st.id
        JOIN constructors c ON cs.constructor_id = c.id
        JOIN seasons s      ON st.season_id      = s.id
        WHERE s.year = (SELECT MAX(year) FROM seasons)
        ORDER BY c.id, st.round DESC
      ) sub
      ORDER BY total_pontos DESC
    `);

    // Mesmo padrão das escuderias — DISTINCT ON para eliminar duplicatas
    // e pegar o acumulado do último round de cada piloto.
    const driversResult = await pool.query(`
      SELECT * FROM (
        SELECT DISTINCT ON (d.id)
          d.id, d.given_name || ' ' || d.family_name AS nome,
          st.points AS total_pontos
        FROM driver_standings ds
        JOIN standings st ON ds.standing_id = st.id
        JOIN drivers d    ON ds.driver_id   = d.id
        JOIN seasons s    ON st.season_id   = s.id
        WHERE s.year = (SELECT MAX(year) FROM seasons)
        ORDER BY d.id, st.round DESC
      ) sub
      ORDER BY total_pontos DESC
    `);

    res.json({
      ...statsResult.rows[0],
      recent_races:        racesResult.rows,
      constructors_points: constructorsResult.rows,
      drivers_points:      driversResult.rows,
    });
  } catch (err) {
    console.error('Erro ao carregar dashboard admin:', err);
    res.status(500).json({ error: 'Erro ao carregar dashboard' });
  }
});

// POST /api/admin/drivers — cadastra um piloto novo
router.post('/drivers', async (req, res) => {
  const { driver_ref, given_name, family_name, date_of_birth, nationality } = req.body;

  if (!driver_ref || !given_name || !family_name) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  try {
    // RETURNING id evita um SELECT separado depois do INSERT
    // pra saber qual id foi gerado pelo SERIAL.
    // O trigger trg_sync_driver_to_users cria o usuário em USERS automaticamente.
    const result = await pool.query(
      `INSERT INTO drivers (driver_ref, given_name, family_name, date_of_birth, nationality)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [driver_ref, given_name, family_name, date_of_birth || null, nationality || 'Unknown']
    );

    const driver_id = result.rows[0].id;

    res.status(201).json({
      message:   'Piloto cadastrado com sucesso',
      driver_id,
      login:     `${driver_ref}_d`,
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

// POST /api/admin/constructors — cadastra uma escuderia nova
router.post('/constructors', async (req, res) => {
  const { constructor_ref, name, nationality, wikipedia_url } = req.body;

  if (!constructor_ref || !name) {
    return res.status(400).json({ error: 'constructor_ref e name são obrigatórios' });
  }

  try {
    // Mesmo padrão do cadastro de piloto: RETURNING id + trigger automático
    // que cria o usuário em USERS com tipo 'Escuderia'.
    const result = await pool.query(
      `INSERT INTO constructors (constructor_ref, name, nationality, wikipedia_url)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [constructor_ref, name, nationality || 'Unknown', wikipedia_url || null]
    );

    const constructor_id = result.rows[0].id;

    res.status(201).json({
      message:        'Escuderia cadastrada com sucesso',
      constructor_id,
      login:          `${constructor_ref}_c`,
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

// R1: quantos resultados existem pra cada status (Finished, Accident, etc.)
// Útil pra ter uma visão geral de como as corridas terminam na base toda.
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

// R2: aeroportos medium/large num raio de 100 km de uma cidade brasileira
router.get('/relatorios/r2', async (req, res) => {
  const { cidade } = req.query;
  if (!cidade || cidade.trim() === '') {
    return res.status(400).json({ error: 'Parâmetro "cidade" é obrigatório.' });
  }
  try {
    const result = await pool.query(`
      WITH input_cities AS (
        -- Pega todas as cidades brasileiras que batem com o nome digitado.
        -- ILIKE faz a comparação case-insensitive sem precisar de LOWER nos dois lados.
        SELECT c.id, c.name, c.latitude, c.longitude
        FROM cities c
        JOIN countries co ON c.country_id = co.id
        WHERE co.code = 'BR'
          AND c.name ILIKE $1
          AND c.latitude  IS NOT NULL
          AND c.longitude IS NOT NULL
      ),
      bounding AS (
        -- Pré-filtra aeroportos pelo bounding box do Brasil antes de calcular distância.
        -- Sem isso, o CROSS JOIN com todas as cidades seria pesado demais.
        SELECT
          a.id, a.iata_code, a.name AS airport_nome,
          a.latitude_deg, a.longitude_deg,
          at.type AS tipo,
          ci.name AS cidade_aeroporto
        FROM airports a
        JOIN airport_types at ON a.airport_type_id = at.id
        LEFT JOIN cities ci ON a.city_id = ci.id
        WHERE a.iata_code IS NOT NULL
          AND at.type IN ('medium_airport', 'large_airport')
          AND a.latitude_deg  BETWEEN -36 AND  6
          AND a.longitude_deg BETWEEN -75 AND -32
      ),
      distances AS (
        -- Fórmula de Haversine: calcula distância em km entre dois pontos na superfície da Terra.
        -- GREATEST/LEAST evitam erros de domínio no acos() quando os pontos são muito próximos
        -- e arredondamento de ponto flutuante empurra o valor pra fora do intervalo [-1, 1].
        SELECT
          ic.name AS cidade_pesquisada,
          b.iata_code,
          b.airport_nome,
          b.cidade_aeroporto,
          b.tipo,
          ROUND((
            6371 * acos(
              GREATEST(-1, LEAST(1,
                cos(radians(ic.latitude))  * cos(radians(b.latitude_deg)) *
                cos(radians(b.longitude_deg) - radians(ic.longitude)) +
                sin(radians(ic.latitude))  * sin(radians(b.latitude_deg))
              ))
            )
          )::numeric, 2) AS distancia_km
        FROM input_cities ic
        CROSS JOIN bounding b
      )
      SELECT cidade_pesquisada, iata_code, airport_nome, cidade_aeroporto, distancia_km, tipo
      FROM distances
      WHERE distancia_km <= 100
      ORDER BY distancia_km
    `, [cidade.trim()]);
    res.json({ rows: result.rows, cidade_buscada: cidade.trim() });
  } catch (err) {
    console.error('R2:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R2' });
  }
});

// R3 — nível 0: todas as escuderias com total de pilotos e corridas disputadas
router.get('/relatorios/r3', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        c.id                          AS constructor_id,
        c.name                        AS constructor_name,
        -- DISTINCT porque o mesmo piloto aparece várias vezes em results (uma por corrida)
        COUNT(DISTINCT res.driver_id) AS num_pilotos,
        COUNT(DISTINCT res.race_id)   AS total_corridas
      FROM constructors c
      LEFT JOIN results res ON c.id = res.constructor_id
      GROUP BY c.id, c.name
      ORDER BY num_pilotos DESC
    `);
    res.json({ constructors: result.rows });
  } catch (err) {
    console.error('R3:', err);
    res.status(500).json({ error: 'Erro ao gerar relatório R3' });
  }
});

// R3 — nível 1: circuitos em que a escuderia correu, com min/avg/max de voltas
router.get('/relatorios/r3/:constructor_id', async (req, res) => {
  const { constructor_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        ci.id                            AS circuit_id,
        ci.name                          AS circuit_name,
        COUNT(DISTINCT ra.id)            AS total_corridas,
        MIN(lp.max_laps)                 AS min_voltas,
        ROUND(AVG(lp.max_laps))::INTEGER AS avg_voltas,
        MAX(lp.max_laps)                 AS max_voltas
      FROM results res
      JOIN races ra    ON res.race_id    = ra.id
      JOIN circuits ci ON ra.circuit_id  = ci.id
      JOIN (
        -- Subquery que pega o maior número de voltas completadas pela escuderia em cada corrida.
        -- Cada piloto tem sua própria linha em results, então precisamos do MAX por corrida.
        SELECT race_id, MAX(laps) AS max_laps
        FROM results
        WHERE laps IS NOT NULL AND constructor_id = $1
        GROUP BY race_id
      ) lp ON ra.id = lp.race_id
      WHERE res.constructor_id = $1
      GROUP BY ci.id, ci.name
      ORDER BY total_corridas DESC
    `, [constructor_id]);
    res.json({ circuits: result.rows });
  } catch (err) {
    console.error('R3 circuitos:', err);
    res.status(500).json({ error: 'Erro ao carregar circuitos da escuderia' });
  }
});

// R3 — nível 2: corridas de uma escuderia num circuito específico
router.get('/relatorios/r3/:constructor_id/:circuit_id', async (req, res) => {
  const { constructor_id, circuit_id } = req.params;
  try {
    const result = await pool.query(`
      SELECT
        ra.race_name,
        s.year,
        COALESCE(MAX(res.laps), 0)    AS total_voltas,
        COUNT(DISTINCT res.driver_id) AS num_pilotos
      FROM results res
      JOIN races ra  ON res.race_id   = ra.id
      JOIN seasons s ON ra.season_id  = s.id
      WHERE res.constructor_id = $1
        AND ra.circuit_id      = $2
      GROUP BY ra.id, ra.race_name, s.year
      ORDER BY s.year DESC
    `, [constructor_id, circuit_id]);
    res.json({ races: result.rows });
  } catch (err) {
    console.error('R3 corridas:', err);
    res.status(500).json({ error: 'Erro ao carregar corridas do circuito' });
  }
});

export default router;
