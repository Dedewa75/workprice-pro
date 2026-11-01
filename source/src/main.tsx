import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

class Boundary extends React.Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui', color: '#eef1f6', background: '#0b0d12', minHeight: '100vh' }}>
        <h1 style={{ fontSize: 20 }}>Une erreur est survenue</h1>
        <p style={{ color: '#9aa3b2' }}>Tes données sont toujours enregistrées dans le navigateur. Recharge la page ; si le problème persiste, exporte une sauvegarde depuis Paramètres.</p>
        <pre style={{ whiteSpace: 'pre-wrap', color: '#fb7185', fontSize: 12 }}>{String(this.state.err?.message)}</pre>
        <button onClick={() => { location.hash = '#/dashboard'; location.reload(); }} style={{ marginTop: 12, padding: '8px 14px', borderRadius: 10, background: '#7c5cff', color: '#fff', border: 0 }}>Recharger</button>
      </div>
    );
  }
}

createRoot(document.getElementById('root')!).render(<Boundary><App /></Boundary>);
