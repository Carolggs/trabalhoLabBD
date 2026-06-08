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
  login:  (login, password) =>
    request('/auth/login',  { method: 'POST', body: JSON.stringify({ login, password }) }),

  logout: (userid) =>
    request('/auth/logout', { method: 'POST', body: JSON.stringify({ userid }) }),
};
