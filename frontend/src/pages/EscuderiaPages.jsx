import { useState } from 'react';
import { api } from '../services/api';
import { Search, Upload, Folder, CheckCircle, AlertTriangle, Loader } from 'lucide-react';
import './EscuderiaPages.css';

export function BuscarPiloto() {
  const [surname, setSurname] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!surname.trim()) {
      setError('Digite um sobrenome.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = await api.searchPiloto(surname);
      setResults(data.pilotos || []);
      setSearched(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="escuderia-page">
      <div className="escuderia-container">
        <h1 className="page-title">Buscar Piloto</h1>

        <form onSubmit={handleSearch} className="search-form">
          <div className="search-input-group">
            <input
              type="text"
              placeholder="Digite o sobrenome do piloto"
              value={surname}
              onChange={e => setSurname(e.target.value)}
              disabled={loading}
            />
            <button type="submit" disabled={loading} className="btn-search">
              {loading
                ? <><Loader size={15} className="icon-spin" /> Buscando…</>
                : <><Search size={15} /> Buscar</>}
            </button>
          </div>
        </form>

        {error && <div className="escuderia-error">{error}</div>}

        {searched && (
          <>
            {results.length === 0 && !error && (
              <div className="escuderia-no-results">
                Nenhum piloto encontrado com esse sobrenome.
              </div>
            )}

            {results.length > 0 && (
              <div className="results-list">
                <h2>Pilotos Encontrados</h2>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>Nome Completo</th>
                      <th>Data de Nascimento</th>
                      <th>Nacionalidade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((p, i) => (
                      <tr key={i}>
                        <td>{p.full_name}</td>
                        <td>{new Date(p.date_of_birth).toLocaleDateString('pt-BR')}</td>
                        <td>{p.nationality}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function ImportarPilotos() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Selecione um arquivo.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const formData = new FormData();
      formData.append('file', file);

      const result = await api.importPilotos(formData);
      setSuccess(
        `${result.imported || 0} pilotos importados.` +
        (result.duplicates ? ` ${result.duplicates} duplicados ignorados.` : '')
      );
      setFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="escuderia-page">
      <div className="escuderia-container">
        <h1 className="page-title">Importar Pilotos</h1>

        <div className="import-info">
          <h3>Formato do Arquivo</h3>
          <p>CSV ou TXT com uma linha por piloto. Colunas (separadas por vírgula):</p>
          <code className="code-block">
            driver_ref,given_name,family_name,date_of_birth,nationality
          </code>
          <p className="example">
            <strong>Exemplo:</strong><br />
            hamilton,Lewis,Hamilton,1985-01-07,British<br />
            max_verstappen,Max,Verstappen,1997-12-01,Dutch
          </p>
        </div>

        <form onSubmit={handleSubmit} className="import-form">
          <div className="file-input-wrapper">
            <label htmlFor="file" className="file-label">
              <Folder size={16} /> {file ? file.name : 'Clique para selecionar arquivo'}
            </label>
            <input
              id="file"
              type="file"
              accept=".csv,.txt"
              onChange={e => setFile(e.target.files[0])}
              disabled={loading}
              className="file-input"
            />
          </div>

          {error && <div className="escuderia-error">{error}</div>}
          {success && <div className="escuderia-success">{success}</div>}

          <button type="submit" disabled={loading || !file} className="btn-import">
            {loading
              ? <><Loader size={15} className="icon-spin" /> Importando…</>
              : <><Upload size={15} /> Importar Pilotos</>}
          </button>
        </form>
      </div>
    </div>
  );
}
