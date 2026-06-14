import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, LogIn, Loader } from 'lucide-react';
import F1Brand from '../components/F1Brand';
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
          <F1Brand size="lg" />
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
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="login-error" role="alert">
              {error}
            </div>
          )}

          <button type="submit" className="btn-login" disabled={loading}>
            {loading
              ? <><Loader size={15} className="icon-spin" /> Entrando…</>
              : <><LogIn size={15} /> Entrar</>}
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
