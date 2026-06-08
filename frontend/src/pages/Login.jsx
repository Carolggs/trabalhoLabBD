import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const [login, setLogin]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const { login: doLogin, error, loading } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await doLogin(login.trim(), password);
      navigate('/dashboard');
    } catch (_) {
      // erro já salvo no AuthContext
    }
  }

  return (
    <div className="login-root">
      <div className="login-stripe" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <span className="login-logo-f1">F1</span>
            <span className="login-logo-db">DataBase</span>
          </div>
          <p className="login-subtitle">Sistema de Gestão — Fórmula 1</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login">Usuário</label>
            <input
              id="login"
              type="text"
              placeholder="ex: hamilton_d"
              value={login}
              onChange={e => setLogin(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Senha</label>
            <div className="password-wrapper">
              <input
                id="password"
                type={showPass ? 'text' : 'password'}
                placeholder="Sua senha"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-pass"
                onClick={() => setShowPass(v => !v)}
                aria-label={showPass ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="login-hint">
          <p><strong>Admin:</strong> admin / admin</p>
          <p><strong>Escuderia:</strong> mclaren_c / mclaren</p>
          <p><strong>Piloto:</strong> hamilton_d / hamilton</p>
        </div>
      </div>

      <div className="login-stripe login-stripe-bottom" />
    </div>
  );
}
