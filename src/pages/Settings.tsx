import { useState } from 'react';
import { Download } from 'lucide-react';
import { DEFAULT_SETTINGS, useStore } from '../db';
import type { Settings as S } from '../types';
import { fillTemplate, nowLocalInput, todayISO } from '../utils';

const VARS = ['{nome}', '{nome_completo}', '{data}', '{hora}', '{dia_semana}', '{motivo}', '{clinica}', '{dentista}', '{telefone_clinica}', '{endereco}'];

export function Settings() {
  const { db, saveSettings } = useStore();
  const [f, setF] = useState<S>(db.settings);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const s = (k: keyof S) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value });
    setState('idle');
  };

  const sample = { id: 'x', nome: 'Maria Silva', telefone: '', criadoEm: '' };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 30);
  const preview = (tpl: string) => fillTemplate(tpl, { patient: sample, settings: f, dataHora: nowLocalInput(tomorrow), motivo: 'Limpeza' });

  const exportar = () => {
    const blob = new Blob([JSON.stringify({ exportadoEm: new Date().toISOString(), ...db }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-imperium-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tpl = (k: 'templateAniversario' | 'templateLembrete' | 'templateRetorno', title: string) => (
    <div className="tpl" key={k}>
      <label className="field full">
        <span>{title}</span>
        <textarea rows={4} value={f[k]} onChange={s(k)} />
      </label>
      <div className="bubble"><div>{preview(f[k])}</div></div>
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Configurações</h1>
      </header>

      <form
        className="panel panel-body"
        onSubmit={async (e) => {
          e.preventDefault();
          setState('saving');
          try {
            await saveSettings(f);
            setState('saved');
          } catch (err) {
            alert('Erro ao salvar: ' + (err as Error).message);
            setState('idle');
          }
        }}
      >
        <h2 style={{ marginBottom: 16 }}>Consultório</h2>
        <div className="form-grid">
          <label className="field"><span>Nome do consultório</span><input required value={f.nomeClinica} onChange={s('nomeClinica')} /></label>
          <label className="field"><span>Assinatura das mensagens (dentista)</span><input placeholder="Ex.: Dr. Fulano — Implantodontista" value={f.nomeDentista} onChange={s('nomeDentista')} /></label>
          <label className="field"><span>Telefone do consultório</span><input value={f.telefoneClinica} onChange={s('telefoneClinica')} /></label>
          <label className="field"><span>Endereço</span><input value={f.endereco} onChange={s('endereco')} /></label>
        </div>

        <h2 className="mt">Mensagens de WhatsApp</h2>
        <p className="muted small" style={{ margin: '4px 0 8px' }}>À direita, uma prévia de como o paciente recebe.</p>
        <p className="muted small">
          Campos automáticos: {VARS.map((v) => <code key={v}>{v}</code>)}
        </p>
        {tpl('templateAniversario', 'Aniversário')}
        {tpl('templateLembrete', 'Lembrete de consulta')}
        {tpl('templateRetorno', 'Convite para retorno')}

        <div className="form-actions">
          {state === 'saved' && <span className="ok">Configurações salvas</span>}
          <span className="spacer" />
          <button
            type="button"
            className="btn ghost"
            onClick={() => setF({ ...f, templateAniversario: DEFAULT_SETTINGS.templateAniversario, templateLembrete: DEFAULT_SETTINGS.templateLembrete, templateRetorno: DEFAULT_SETTINGS.templateRetorno })}
          >
            Restaurar textos padrão
          </button>
          <button className="btn primary" disabled={state === 'saving'}>{state === 'saving' ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </form>

      <section className="panel panel-body">
        <h2 style={{ marginBottom: 6 }}>Cópia dos dados</h2>
        <p className="muted small">
          Os dados ficam guardados no servidor. Para ter uma cópia extra, baixe o arquivo abaixo e guarde em local seguro:
          ele contém dados de saúde dos pacientes, protegidos pela LGPD.
        </p>
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={exportar}><Download /> Baixar cópia dos dados</button>
      </section>
    </div>
  );
}
