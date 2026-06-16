import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { UserPlus, Building2, X, Loader, CheckCircle } from 'lucide-react';
import './Forms.css';

export function CadastrarPiloto() {
  const [formData, setFormData] = useState({
    driver_ref: '',
    given_name: '',
    family_name: '',
    date_of_birth: '',
    nationality: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.driver_ref || !formData.given_name || !formData.family_name || !formData.date_of_birth) {
      setError('Todos os campos obrigatórios devem ser preenchidos.');
      return;
    }

    try {
      setLoading(true);
      await api.createDriver(formData);
      setSuccess('Piloto cadastrado com sucesso!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-page">
      <div className="form-container">
        <h1 className="form-title">Cadastrar Piloto</h1>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="driver_ref">Referência do Piloto *</label>
            <input
              id="driver_ref"
              type="text"
              name="driver_ref"
              placeholder="ex: hamilton"
              value={formData.driver_ref}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="given_name">Primeiro Nome *</label>
              <input
                id="given_name"
                type="text"
                name="given_name"
                placeholder="ex: Lewis"
                value={formData.given_name}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="family_name">Sobrenome *</label>
              <input
                id="family_name"
                type="text"
                name="family_name"
                placeholder="ex: Hamilton"
                value={formData.family_name}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="date_of_birth">Data de Nascimento *</label>
              <input
                id="date_of_birth"
                type="date"
                name="date_of_birth"
                value={formData.date_of_birth}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="nationality">Nacionalidade</label>
              <input
                id="nationality"
                type="text"
                name="nationality"
                placeholder="ex: British"
                value={formData.nationality}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading
                ? <><Loader size={15} className="icon-spin" /> Cadastrando…</>
                : <><UserPlus size={15} /> Cadastrar Piloto</>}
            </button>
            <button type="button" className="btn-cancel" onClick={() => navigate('/dashboard')}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CadastrarEscuderia() {
  const [formData, setFormData] = useState({
    constructor_ref: '',
    name: '',
    nationality: '',
    wikipedia_url: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.constructor_ref || !formData.name) {
      setError('Constructor_ref e name são obrigatórios.');
      return;
    }

    try {
      setLoading(true);
      await api.createConstructor(formData);
      setSuccess('Escuderia cadastrada com sucesso!');
      setTimeout(() => navigate('/dashboard'), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="form-page">
      <div className="form-container">
        <h1 className="form-title">Cadastrar Escuderia</h1>

        <form onSubmit={handleSubmit} className="form">
          <div className="form-group">
            <label htmlFor="constructor_ref">Referência da Escuderia *</label>
            <input
              id="constructor_ref"
              type="text"
              name="constructor_ref"
              placeholder="ex: mclaren"
              value={formData.constructor_ref}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="name">Nome da Escuderia *</label>
            <input
              id="name"
              type="text"
              name="name"
              placeholder="ex: McLaren"
              value={formData.name}
              onChange={handleChange}
              disabled={loading}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="nationality">Nacionalidade</label>
              <input
                id="nationality"
                type="text"
                name="nationality"
                placeholder="ex: British"
                value={formData.nationality}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
            <div className="form-group">
              <label htmlFor="wikipedia_url">URL Wikipedia</label>
              <input
                id="wikipedia_url"
                type="url"
                name="wikipedia_url"
                placeholder="https://..."
                value={formData.wikipedia_url}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          </div>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={loading}>
              {loading
                ? <><Loader size={15} className="icon-spin" /> Cadastrando…</>
                : <><Building2 size={15} /> Cadastrar Escuderia</>}
            </button>
            <button type="button" className="btn-cancel" onClick={() => navigate('/dashboard')}>
              <X size={15} /> Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
