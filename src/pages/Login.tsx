import { useEffect, useState, type FormEvent } from 'react';
import { callUsersFn, supabase } from '../supabase';
import { useAuth } from '../auth';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="login-bg">
      <div className="login-card">
        <img src="./logo.png" alt="Imperium Odonto — Clínica Odontológica" className="login-logo" />
        {children}
      </div>
    </div>
  );
}

const translate = (m: string) =>
  m.includes('Invalid login credentials')
    ? 'E-mail ou senha incorretos.'
    : m.includes('banned')
      ? 'Usuário desativado. Fale com o administrador.'
      : m.includes('Email not confirmed')
        ? 'E-mail ainda não confirmado.'
        : m;

export function Login() {
  const [mode, setMode] = useState<'loading' | 'setup' | 'login' | 'forgot'>('loading');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; m: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.rpc('sistema_inicializado').then(({ data, error }) => setMode(error || data ? 'login' : 'setup'));
  }, []);

  const run = (fn: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (err) {
      setMsg({ t: 'err', m: translate((err as Error).message) });
    } finally {
      setBusy(false);
    }
  };

  const login = run(async () => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) throw error;
  });

  const setup = run(async () => {
    await callUsersFn({ action: 'bootstrap', nome, email: email.trim(), password: senha });
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    if (error) throw error;
  });

  const forgot = run(async () => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + window.location.pathname });
    if (error) throw error;
    setMsg({ t: 'ok', m: 'Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.' });
  });

  if (mode === 'loading') return <Shell><p className="muted center">Carregando…</p></Shell>;

  return (
    <Shell>
      {mode === 'setup' && (
        <form onSubmit={setup} className="login-form">
          <h1>Configuração inicial</h1>
          <p className="muted small">Crie a conta <b>Admin Master</b> (dono do sistema). Isso só aparece uma vez.</p>
          <input placeholder="Seu nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          <input type="email" placeholder="E-mail" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Senha (mínimo 8 caracteres)" minLength={8} required autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          {msg && <p className={msg.t}>{msg.m}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Criando…' : 'Criar conta Master'}</button>
        </form>
      )}

      {mode === 'login' && (
        <form onSubmit={login} className="login-form">
          <input type="email" placeholder="E-mail" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Senha" required autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          {msg && <p className={msg.t}>{msg.m}</p>}
          <button className="btn primary block" disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
          <button type="button" className="link center" onClick={() => { setMode('forgot'); setMsg(null); }}>Esqueci minha senha</button>
        </form>
      )}

      {mode === 'forgot' && (
        <form onSubmit={forgot} className="login-form">
          <p className="muted small">Informe seu e-mail para receber o link de nova senha. Se não chegar, peça ao administrador para redefinir sua senha.</p>
          <input type="email" placeholder="E-mail" required value={email} onChange={(e) => setEmail(e.target.value)} />
          {msg && <p className={msg.t}>{msg.m}</p>}
          <button className="btn primary block" disabled={busy}>Enviar link</button>
          <button type="button" className="link center" onClick={() => { setMode('login'); setMsg(null); }}>Voltar</button>
        </form>
      )}
    </Shell>
  );
}

/** Tela de nova senha (link do e-mail ou troca pelo próprio usuário). */
export function NewPassword({ onDone }: { onDone?: () => void }) {
  const { setRecovering } = useAuth();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (a !== b) return setMsg('As senhas não conferem.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: a });
    setBusy(false);
    if (error) return setMsg(error.message);
    setRecovering(false);
    onDone?.();
    alert('Senha alterada!');
  };
  return (
    <form onSubmit={submit} className="login-form">
      <input type="password" placeholder="Nova senha (mínimo 8)" minLength={8} required autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} />
      <input type="password" placeholder="Repita a nova senha" minLength={8} required autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} />
      {msg && <p className="err">{msg}</p>}
      <button className="btn primary block" disabled={busy}>Salvar nova senha</button>
    </form>
  );
}

export function RecoveryScreen() {
  return (
    <Shell>
      <h1>Criar nova senha</h1>
      <NewPassword />
    </Shell>
  );
}

export function NoAccess({ reason }: { reason: string }) {
  const { signOut } = useAuth();
  return (
    <Shell>
      <p className="center">{reason}</p>
      <button className="btn ghost block" onClick={signOut}>Sair</button>
    </Shell>
  );
}
