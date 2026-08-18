import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Intercept global fetch to automatically inject user identification headers (X-User-Id, X-User-Name, X-User-Role)
const originalFetch = window.fetch;
window.fetch = async function (url, config = {}) {
  try {
    const rawUser = localStorage.getItem('unms_user') || localStorage.getItem('fiber_user');
    if (rawUser) {
      const user = JSON.parse(rawUser);
      if (user && user.name) {
        config = config || {};
        config.headers = {
          ...(config.headers || {}),
          'X-User-Id': String(user.id || ''),
          'X-User-Name': String(user.name || ''),
          'X-User-Role': String(user.role || ''),
        };
      }
    }
  } catch (e) {
    // Ignore JSON parse errors
  }

  const response = await originalFetch.call(this, url, config);

  try {
    const method = String(config?.method || 'GET').toUpperCase();
    if (response.ok && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const urlStr = String(url);
      // Kecualikan endpoint tes koneksi / polling murni
      if (!urlStr.includes('/test') && !urlStr.includes('/auth/me')) {
        window.dispatchEvent(new CustomEvent('unms:data-mutated', {
          detail: { url: urlStr, method, timestamp: Date.now() }
        }));
      }
    }
  } catch (e) {
    // Ignore mutation event error
  }

  return response;
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  handleReset = () => {
    localStorage.removeItem('fiber_user');
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          fontFamily: "'Segoe UI', Roboto, sans-serif",
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '48px',
            marginBottom: '16px'
          }}>⚠️</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>
            Terjadi Kesalahan Aplikasi
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px', maxWidth: '450px', marginBottom: '16px' }}>
            Sistem mendeteksi kendala pada sesi atau tampilan. Coba muat ulang halaman atau reset sesi login Anda.
          </p>

          {this.state.error?.message && (
            <div style={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              padding: '10px 16px',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#f87171',
              maxWidth: '500px',
              marginBottom: '20px',
              wordBreak: 'break-all'
            }}>
              {this.state.error.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={this.handleReload}
              style={{
                padding: '10px 20px',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔄 Muat Ulang Halaman
            </button>

            <button
              onClick={this.handleReset}
              style={{
                padding: '10px 20px',
                backgroundColor: '#2563eb',
                color: 'white',
                border: 'none',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
              }}
            >
              🔑 Reset Sesi &amp; Kembali Login
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
