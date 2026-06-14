# 📚 Funções Armazenadas — Resumo Executado

Data: 2026-06-08  
Banco: PostgreSQL (f1)  
Arquivo: `sql/04_functions.sql`

---

## 5️⃣ Funções Criadas

### 1. `fn_escuderia_vitories(constructor_id INTEGER) → INTEGER`

**O que faz:** Conta quantas vitórias uma escuderia teve (posição = '1')

**Exemplo:**
```sql
SELECT fn_escuderia_vitories(20);  -- McLaren
-- Resultado: 59
```

**Como é usado no backend:**
```javascript
const result = await pool.query(
  `SELECT fn_escuderia_vitories($1) AS vitories`,
  [constructor_id]
);
```

---

### 2. `fn_escuderia_pilots_count(constructor_id INTEGER) → INTEGER`

**O que faz:** Conta quantos pilotos DIFERENTES já correram por essa escuderia

**Exemplo:**
```sql
SELECT fn_escuderia_pilots_count(20);  -- McLaren
-- Resultado: 42
```

---

### 3. `fn_escuderia_years(constructor_id INTEGER) → TABLE(first_year, last_year)`

**O que faz:** Retorna o primeiro e último ano que a escuderia participou

**Exemplo:**
```sql
SELECT * FROM fn_escuderia_years(20);
-- Resultado: 1971 | 2025
```

---

### 4. `fn_driver_years(driver_id INTEGER) → TABLE(first_year, last_year)`

**O que faz:** Retorna o primeiro e último ano que um piloto participou

**Exemplo:**
```sql
SELECT * FROM fn_driver_years(83);  -- Hamilton
-- Resultado: 2007 | 2025
```

---

### 5. `fn_driver_performance(driver_id INTEGER) → TABLE(year, circuit_name, total_points, victories, races)`

**O que faz:** Retorna desempenho do piloto por ano E por circuito

**Exemplo:**
```sql
SELECT * FROM fn_driver_performance(83) LIMIT 5;
-- Resultado: múltiplas linhas com:
-- 2025 | Bahrain International Circuit | 10.00 | 0 | 1
-- 2025 | Shanghai International Circuit | 0.00 | 0 | 1
-- ...
```

---

## 🔌 Endpoints que Usam as Funções

| Endpoint | Funções Usadas |
|---|---|
| `GET /api/escuderia/dashboard/:constructor_id` | `fn_escuderia_vitories`, `fn_escuderia_pilots_count`, `fn_escuderia_years` |
| `GET /api/piloto/dashboard/:driver_id` | `fn_driver_years`, `fn_driver_performance` |

---

## 💡 Por Que Usar Funções Armazenadas?

### ✅ Vantagens

1. **Performance:** Queries ficam no banco, executam mais rápido
2. **Reutilização:** Mesma função usada por múltiplos endpoints
3. **Manutenção:** Se a lógica muda, altera-se em um único lugar
4. **Segurança:** Lógica complexa fica protegida no banco

### ❌ Antes (sem funções)

```javascript
// Backend código sujo com múltiplas queries
const victoriesResult = await pool.query(`
  SELECT COUNT(*) FROM results WHERE constructor_id = $1 AND position = '1'
`);
const pilotsResult = await pool.query(`
  SELECT COUNT(DISTINCT driver_id) FROM results WHERE constructor_id = $1
`);
const yearsResult = await pool.query(`
  SELECT MIN(s.year), MAX(s.year) FROM results r
  JOIN races ra ON r.race_id = ra.id
  ...
`);
```

### ✅ Depois (com funções)

```javascript
// Backend limpo e elegante
const victories = await pool.query(`SELECT fn_escuderia_vitories($1)`, [id]);
const pilots = await pool.query(`SELECT fn_escuderia_pilots_count($1)`, [id]);
const years = await pool.query(`SELECT * FROM fn_escuderia_years($1)`, [id]);
```

---

## 📊 Testes Executados

✅ `fn_escuderia_vitories(20)` → 59  
✅ `fn_escuderia_pilots_count(20)` → 42  
✅ `fn_escuderia_years(20)` → 1971 | 2025  
✅ `fn_driver_years(83)` → 2007 | 2025  
✅ `fn_driver_performance(83)` → 10+ linhas de desempenho  

---

## 🚀 Status Final

| Componente | Status |
|---|---|
| 5 Stored Functions criadas | ✅ |
| Endpoints integrados com funções | ✅ |
| Backend testado | ✅ |
| Frontend + Backend sincronizados | ✅ |

---

## 📝 Próximos Passos

**Dia 3 (Relatórios):**
- Criar 7 relatórios (Admin: 3, Escuderia: 2, Piloto: 2)
- Cada relatório será um endpoint + componente React
- Alguns podem usar novas stored functions

---

**Sistema pronto para Dia 3!** 🎉
