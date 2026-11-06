import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './db';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Agenda } from './pages/Agenda';
import { Settings } from './pages/Settings';
import './styles.css';

function Shell() {
  const { loaded, db } = useStore();
  if (!loaded) return <div className="loading">Carregando…</div>;
  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <span>🦷</span>
          <div>
            <b>{db.settings.nomeClinica}</b>
            <small>{db.settings.nomeDentista}</small>
          </div>
        </div>
        <NavLink to="/" end>🏠 <span>Painel</span></NavLink>
        <NavLink to="/agenda">📅 <span>Agenda</span></NavLink>
        <NavLink to="/pacientes">👥 <span>Pacientes</span></NavLink>
        <NavLink to="/config">⚙️ <span>Configurações</span></NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/pacientes" element={<Patients />} />
          <Route path="/pacientes/:id" element={<PatientDetail />} />
          <Route path="/config" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
