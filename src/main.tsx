import { StrictMode, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Link, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronsUpDown, Crown, LayoutDashboard, Menu, Search, Settings2, ShieldCheck, Users as UsersIcon } from 'lucide-react';
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
import { initials } from './components/ui';
import { fmtPhone, onlyDigits } from './utils';
import './styles.css';

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  return (
    <nav className="nav" onClick={onNavigate}>
      <NavLink to="/" end><LayoutDashboard /> Painel</NavLink>
      <NavLink to="/agenda"><CalendarDays /> Agenda</NavLink>
      <NavLink to="/pacientes"><UsersIcon /> Pacientes</NavLink>
      {can.admin && (
        <>
          <div className="nav-group">Consultório</div>
          <NavLink to="/usuarios"><ShieldCheck /> Equipe e acessos</NavLink>
          <NavLink to="/config"><Settings2 /> Configurações</NavLink>
        </>
      )}
      {can.master && (
        <>
          <div className="nav-group">Sistema</div>
          <NavLink to="/consultorios"><Crown /> Consultórios</NavLink>
        </>
      )}
    </nav>
  );
}

/** Busca rápida de pacientes (atalho: tecla /) */
function GlobalSearch() {
  const { db } = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hl, setHl] = useState(0);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const results = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const t = norm(q.trim());
    if (!t) return [];
    const d = onlyDigits(q);
    return db.patients
      .filter((p) => norm(p.nome).includes(t) || (d.length >= 3 && (onlyDigits(p.telefone).includes(d) || onlyDigits(p.cpf ?? '').includes(d))))
      .slice(0, 7);
  }, [q, db.patients]);

  const go = (id: string) => {
    setQ('');
    setOpen(false);
    ref.current?.blur();
    nav(`/pacientes/${id}`);
  };

  return (
    <div className="gsearch">
      <Search />
      <input
        ref={ref}
        placeholder="Buscar paciente"
        aria-label="Buscar paciente por nome, telefone ou CPF"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHl(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, results.length - 1)); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)); }
          if (e.key === 'Enter' && results[hl]) go(results[hl].id);
          if (e.key === 'Escape') { setQ(''); ref.current?.blur(); }
        }}
      />
      <kbd>/</kbd>
      {open && q.trim() && (
        <div className="gsearch-results" role="listbox">
          {results.length === 0 && <div className="empty">Nenhum paciente encontrado.</div>}
          {results.map((p, i) => (
            <a key={p.id} href={`#/pacientes/${p.id}`} className={i === hl ? 'hl' : ''} onMouseDown={(e) => { e.preventDefault(); go(p.id); }}>
              <span className="avatar-s">{initials(p.nome)}</span>
              <span className="grow">
                <span className="truncate" style={{ display: 'block', fontWeight: 500 }}>{p.nome}</span>
                <span className="muted small">{fmtPhone(p.telefone)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

function Shell() {
  const { loaded, saving } = useStore();
  const { profile, can, clinic, clinics, setClinicId, signOut } = useAuth();
  const [account, setAccount] = useState(false);
  const [sheet, setSheet] = useState(false);
  const loc = useLocation();
  useEffect(() => {
    setSheet(false);
    window.scrollTo(0, 0);
  }, [loc.pathname]);

  if (!loaded) return <div className="loading"><img src="./simbolo.png" alt="Carregando" /></div>;

  const me = (
    <button className="me-btn" onClick={() => setAccount(true)}>
      <span className="avatar-s" style={{ background: 'var(--ink-3)', color: 'var(--gold)' }}>{initials(profile?.nome ?? '')}</span>
      <span className="me-info">
        <b>{profile?.nome}</b>
        <small>{profile && ROLE_LABEL[profile.role]}</small>
      </span>
      <ChevronsUpDown />
    </button>
  );

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="./simbolo.png" alt="" />
          <div>
            <div className="brand-name">{clinic?.nome}</div>
            <div className="brand-sub">Clínica odontológica</div>
          </div>
        </div>
        {can.master && clinics.length > 1 && (
          <select className="clinic-switch" value={clinic?.id} onChange={(e) => setClinicId(e.target.value)} aria-label="Consultório">
            {clinics.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        )}
        <NavItems />
        <div className="me">{me}</div>
      </aside>

      <main>
        <div className="topbar">
          <Link to="/" className="mobile-brand"><img src="./simbolo.png" alt="" />{clinic?.nome}</Link>
          <GlobalSearch />
        </div>
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

      <nav className="mobile-tabs" aria-label="Navegação">
        <NavLink to="/" end><LayoutDashboard />Painel</NavLink>
        <NavLink to="/agenda"><CalendarDays />Agenda</NavLink>
        <NavLink to="/pacientes"><UsersIcon />Pacientes</NavLink>
        <button onClick={() => setSheet(true)}><Menu />Mais</button>
      </nav>
      {sheet && (
        <div className="sheet-bg" onClick={() => setSheet(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <NavItems onNavigate={() => setSheet(false)} />
            <div className="me">{me}</div>
          </div>
        </div>
      )}

      {saving && <div className="saving" role="status">Salvando</div>}

      {account && (
        <Modal title="Minha conta" onClose={() => setAccount(false)}>
          <div className="row" style={{ gap: 14, marginBottom: 6 }}>
            <span className="avatar" style={{ width: 48, height: 48, fontSize: '1.3rem' }}>{initials(profile?.nome ?? '')}</span>
            <div>
              <b>{profile?.nome}</b>
              <div className="muted small">{profile && ROLE_LABEL[profile.role]}, {profile?.email}</div>
            </div>
          </div>
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
  if (loading) return <div className="loading"><img src="./simbolo.png" alt="Carregando" /></div>;
  if (recovering) return <RecoveryScreen />;
  if (!session) return <Login />;
  if (!profile) return <NoAccess reason="Este usuário não tem acesso ao sistema. Peça ao administrador do consultório para liberar." />;
  if (!profile.ativo) return <NoAccess reason="Este usuário foi desativado. Fale com o administrador do consultório." />;
  if (!clinic) {
    if (can.master) return <Clinics />;
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
