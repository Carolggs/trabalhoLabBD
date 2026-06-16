const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

export const api = {
  // Auth
  login:  (login, password) =>
    request('/auth/login',  { method: 'POST', body: JSON.stringify({ login, password }) }),
  logout: (userid) =>
    request('/auth/logout', { method: 'POST', body: JSON.stringify({ userid }) }),

  // Dashboard
  getAdminDashboard: () =>
    request('/admin/dashboard'),
  getEscuderiaDashboard: (constructorId) =>
    request(`/escuderia/dashboard/${constructorId}`),
  getPilotoDashboard: (driverId) =>
    request(`/piloto/dashboard/${driverId}`),

  // Admin CRUD
  createDriver: (data) =>
    request('/admin/drivers', { method: 'POST', body: JSON.stringify(data) }),
  createConstructor: (data) =>
    request('/admin/constructors', { method: 'POST', body: JSON.stringify(data) }),

  // Escuderia Actions
  searchPiloto: (surname, constructorId) =>
    request(`/escuderia/pilotos/search?surname=${encodeURIComponent(surname)}&constructor_id=${constructorId}`),
  importPilotos: (formData) =>
    fetch(`${BASE_URL}/escuderia/pilotos/import`, {
      method: 'POST',
      body: formData,
    }).then(r => r.json()).then(d => {
      if (!d.ok) throw new Error(d.error);
      return d;
    }),

  // Relatórios Admin
  getRelatorioR1: () =>
    request('/admin/relatorios/r1'),
  getRelatorioR2: (cidade) =>
    request(`/admin/relatorios/r2?cidade=${encodeURIComponent(cidade)}`),
  getRelatorioR3: () =>
    request('/admin/relatorios/r3'),
  getRelatorioR3Circuitos: (constructorId) =>
    request(`/admin/relatorios/r3/${constructorId}`),
  getRelatorioR3Corridas: (constructorId, circuitId) =>
    request(`/admin/relatorios/r3/${constructorId}/${circuitId}`),

  // Relatórios Escuderia
  getRelatorioR4: (constructorId) =>
    request(`/escuderia/relatorios/r4/${constructorId}`),
  getRelatorioR5: (constructorId) =>
    request(`/escuderia/relatorios/r5/${constructorId}`),

  // Relatórios Piloto
  getRelatorioR6: (driverId) =>
    request(`/piloto/relatorios/r6/${driverId}`),
  getRelatorioR7: (driverId) =>
    request(`/piloto/relatorios/r7/${driverId}`),
};
