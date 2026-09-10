import { StrictMode, Component, ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const APP_VERSION_KEY = 'app_version';
const APP_VERSION = '20260910a';

function checkAppVersion() {
  try {
    const stored = localStorage.getItem(APP_VERSION_KEY);
    if (stored !== APP_VERSION) {
      localStorage.setItem(APP_VERSION_KEY, APP_VERSION);
      if ('caches' in window) {
        caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
      }
      window.location.reload();
    }
  } catch { /* ignore */ }
}

interface EBState { hasError: boolean; message: string }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  state: EBState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): EBState {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, backgroundColor: '#F8FAFC', fontFamily: 'sans-serif' }}>
          <p style={{ fontSize: 18, fontWeight: 600, color: '#0F172A' }}>Se ha producido un error inesperado</p>
          <p style={{ fontSize: 13, color: '#64748B', maxWidth: 400, textAlign: 'center' }}>{this.state.message}</p>
          <button
            onClick={() => { this.setState({ hasError: false, message: '' }); window.location.reload(); }}
            style={{ padding: '8px 20px', borderRadius: 8, backgroundColor: '#0369A1', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontSize: 14 }}
          >
            Recargar pagina
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

checkAppVersion();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
