import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { AuthProvider, ROLE_LABEL, useAuth } from './auth';
import { StoreProvider, useStore } from './db';
import { Dashboard } from './pages/Dashboard';
import { Patients } from './pages/Patients';
import { PatientDetail } from './pages/PatientDetail';
import { Agenda } from './pages/Agenda';
import { Settings } from './pages/Settings';
import { Users } from './pages/Users';
import { Clinics } from './pages/Clinics';
import { Login, NewPassword, NoAccess, RecoveryScreen } from './pages/Login';
import { Modal } from './components/Modal';
import './styles.css';

function Shell() {
  const { loaded, saving } = useStore();
  const { profile, can, clinic, clinics, setClinicId, signOut } = useAuth();
  const [account, setAccount] = useState(false);
  if (!loaded) return <div className="loading"><img src="./simbolo.png" alt="" /></div>;

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="brand">
          <img src="./simbolo.png" alt="" />
          <div>
            <b>{clinic?.nome}</b>
            <small>Clínica Odontológica</small>
          </div>
        </div>
        {can.master && clinics.length > 1 && (
          <select className="clinic-switch" value={clinic?.id} onChange={(e) => setClinicId(e.target.value)} aria-label="Consultório">
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <NavLink to="/" end>🏠 <span>Painel</span></NavLink>
        <NavLink to="/agenda">📅 <span>Agenda</span></NavLink>
        <NavLink to="/pacientes">👥 <span>Pacientes</span></NavLink>
        {can.admin && <NavLink to="/usuarios">🔐 <span>Usuários</span></NavLink>}
        {can.admin && <NavLink to="/config">⚙️ <span>Ajustes</span></NavLink>}
        {can.master && <NavLink to="/consultorios">👑 <span>Master</span></NavLink>}
        <div className="me">
          <button className="me-btn" onClick={() => setAccount(true)}>
            <span className="me-avatar">{profile?.nome.trim()[0]?.toUpperCase()}</span>
            <span className="me-info">
              <b>{profile?.nome}</b>
              <small>{profile && ROLE_LABEL[profile.role]}</small>
            </span>
          </button>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/agenda" element={<Agenda />} />
          <Route path="/pacientes" element={<Patients />} />
          <Route path="/pacientes/:id" element={<PatientDetail />} />
          {can.admin && <Route path="/config" element={<Settings />} />}
          {can.admin && <Route path="/usuarios" element={<Users />} />}
          {can.master && <Route path="/consultorios" element={<Clinics />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {saving && <div className="saving">Salvando…</div>}
      {account && (
        <Modal title="Minha conta" onClose={() => setAccount(false)}>
          <p>
            <b>{profile?.nome}</b> · {profile && ROLE_LABEL[profile.role]}
            <br />
            <span className="muted small">{profile?.email}</span>
          </p>
          <h4>Trocar minha senha</h4>
          <NewPassword onDone={() => setAccount(false)} />
          <hr />
          <button className="btn ghost danger block" onClick={signOut}>Sair do sistema</button>
        </Modal>
      )}
    </div>
  );
}

function Gate() {
  const { loading, session, profile, clinic, can, recovering } = useAuth();
  if (loading) return <div className="loading"><img src="./simbolo.png" alt="" /></div>;
  if (recovering) return <RecoveryScreen />;
  if (!session) return <Login />;
  if (!profile) return <NoAccess reason="Seu usuário não tem acesso a este sistema. Fale com o administrador." />;
  if (!profile.ativo) return <NoAccess reason="Seu usuário foi desativado. Fale com o administrador." />;
  if (!clinic) {
    if (can.master)
      return (
        <div className="page"><Clinics /></div>
      );
    return <NoAccess reason="O acesso deste consultório está suspenso. Fale com o administrador do sistema." />;
  }
  return (
    <StoreProvider key={clinic.id} clinicId={clinic.id}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Gate />
    </AuthProvider>
  </StrictMode>,
);
