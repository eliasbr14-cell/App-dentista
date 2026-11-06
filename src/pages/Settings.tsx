import { useState } from 'react';
import { DEFAULT_SETTINGS, useStore } from '../db';
import { demoData } from '../seed';
import type { Database, Settings as S } from '../types';
import { fillTemplate, nowLocalInput, todayISO } from '../utils';

const VARS = ['{nome}', '{nome_completo}', '{data}', '{hora}', '{dia_semana}', '{motivo}', '{clinica}', '{dentista}', '{telefone_clinica}', '{endereco}'];

export function Settings() {
  const { db, saveSettings, replaceAll } = useStore();
  const [f, setF] = useState<S>(db.settings);
  const [saved, setSaved] = useState(false);
  const s = (k: keyof S) => (e: { target: { value: string } }) => {
    setF({ ...f, [k]: e.target.value });
    setSaved(false);
  };

  const sample = { id: 'x', nome: 'Maria Silva', telefone: '', criadoEm: '' };
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 30);
  const preview = (tpl: string) => fillTemplate(tpl, { patient: sample, settings: f, dataHora: nowLocalInput(tomorrow), motivo: 'Limpeza' });

  const exportar = () => {
    const blob = new Blob([JSON.stringify(db)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-consultorio-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importar = (file?: File) => {
    if (!file) return;
    file.text().then((t) => {
      try {
        const data = JSON.parse(t) as Database;
        if (!Array.isArray(data.patients)) throw new Error();
        if (confirm(`Restaurar backup com ${data.patients.length} paciente(s)? Os dados atuais serão substituídos.`)) {
          replaceAll(data);
          setF({ ...DEFAULT_SETTINGS, ...data.settings });
        }
      } catch {
        alert('Arquivo de backup inválido.');
      }
    });
  };

  const tpl = (k: 'templateAniversario' | 'templateLembrete' | 'templateRetorno', title: string) => (
    <div className="tpl" key={k}>
      <label className="field full">
        <span>{title}</span>
        <textarea rows={4} value={f[k]} onChange={s(k)} />
      </label>
      <div className="bubble">{preview(f[k])}</div>
    </div>
  );

  return (
    <div className="page">
      <header className="page-head">
        <h1>Configurações</h1>
      </header>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          saveSettings(f);
          setSaved(true);
        }}
      >
        <h2>Consultório</h2>
        <div className="form-grid">
          <label className="field"><span>Nome do consultório</span><input value={f.nomeClinica} onChange={s('nomeClinica')} /></label>
          <label className="field"><span>Nome do dentista</span><input value={f.nomeDentista} onChange={s('nomeDentista')} /></label>
          <label className="field"><span>Telefone do consultório</span><input value={f.telefoneClinica} onChange={s('telefoneClinica')} /></label>
          <label className="field"><span>Endereço</span><input value={f.endereco} onChange={s('endereco')} /></label>
        </div>

        <h2>Mensagens de WhatsApp</h2>
        <p className="muted small">
          Variáveis que você pode usar: {VARS.map((v) => <code key={v}>{v}</code>)}
        </p>
        {tpl('templateAniversario', '🎂 Parabéns (aniversário)')}
        {tpl('templateLembrete', '⏰ Lembrete de consulta')}
        {tpl('templateRetorno', '🔁 Chamar para retorno')}

        <div className="form-actions">
          {saved && <span className="ok">✓ Salvo</span>}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={() => setF({ ...DEFAULT_SETTINGS, nomeClinica: f.nomeClinica, nomeDentista: f.nomeDentista, telefoneClinica: f.telefoneClinica, endereco: f.endereco })}>
            Restaurar textos padrão
          </button>
          <button className="btn primary">Salvar</button>
        </div>
      </form>

      <section className="card">
        <h2>Backup dos dados</h2>
        <p className="muted small">
          Os dados ficam salvos <b>neste navegador, neste computador</b>. Faça backup com frequência (ex.: toda sexta) e guarde o arquivo
          em local seguro — ele contém dados de saúde dos pacientes (LGPD).
        </p>
        <div className="row">
          <button className="btn primary" onClick={exportar}>⬇ Baixar backup</button>
          <label className="btn ghost">
            ⬆ Restaurar backup
            <input type="file" accept="application/json" hidden onChange={(e) => importar(e.target.files?.[0])} />
          </label>
          <span className="spacer" />
          <button className="btn ghost" onClick={() => confirm('Substituir tudo por dados de exemplo?') && replaceAll(demoData())}>Carregar exemplo</button>
          <button
            className="btn danger ghost"
            onClick={() => {
              if (confirm('Apagar TODOS os dados? Faça um backup antes!') && confirm('Tem certeza absoluta?'))
                replaceAll({ versao: 1, patients: [], procedures: [], exams: [], appointments: [], sent: [], settings: db.settings });
            }}
          >
            Apagar tudo
          </button>
        </div>
      </section>
    </div>
  );
}
