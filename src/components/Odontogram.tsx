import { useMemo, useRef, useState, type MouseEvent } from 'react';
import type { Exam, Procedure } from '../types';
import { archTeeth, toothInfo, type ToothKind } from '../teeth';
import { ExamImage } from './ExamImage';
import { fmtDate, STATE_LABEL, STATUS_LABEL, toothState, type ToothState } from '../utils';

const W = 820;
const H = 600;
const CX = W / 2;
const RX = 330;
const RY = 215;
const UPPER_CY = 268;
const LOWER_CY = 332;

const SIZE: Record<ToothKind, { w: number; h: number }> = {
  'incisivo-central': { w: 1.0, h: 0.62 },
  'incisivo-lateral': { w: 0.82, h: 0.6 },
  canino: { w: 0.9, h: 0.82 },
  'pre-molar': { w: 0.88, h: 0.95 },
  molar: { w: 1.22, h: 1.12 },
};

export const STATE_COLORS: Record<ToothState, { fill: string; stroke: string }> = {
  saudavel: { fill: 'var(--tooth-healthy)', stroke: 'var(--tooth-stroke)' },
  planejado: { fill: '#f87171', stroke: '#b91c1c' },
  em_andamento: { fill: '#fb923c', stroke: '#c2410c' },
  realizado: { fill: '#60a5fa', stroke: '#1d4ed8' },
  ausente: { fill: 'transparent', stroke: '#94a3b8' },
};

interface Placed {
  n: number;
  x: number;
  y: number;
  rot: number;
  w: number;
  h: number;
  lx: number;
  ly: number;
  kind: ToothKind;
}

/** Distribui os dentes ao longo de meia elipse proporcionalmente ao tamanho de cada um. */
function placeArch(teeth: number[], cy: number, upper: boolean, decidua: boolean): Placed[] {
  const N = 600;
  const pts: { x: number; y: number; th: number }[] = [];
  const span = decidua ? 0.78 : 0.94; // decídua ocupa uma arcada menor
  for (let i = 0; i <= N; i++) {
    const th = Math.PI - (Math.PI * i) / N;
    pts.push({ x: CX + RX * span * Math.cos(th), y: cy + (upper ? -1 : 1) * RY * span * Math.sin(th), th });
  }
  const cum = [0];
  for (let i = 1; i <= N; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[N];

  const kinds = teeth.map((n) => toothInfo(n).kind);
  const gap = 0.06;
  const total = kinds.reduce((s, k) => s + SIZE[k].w, 0) + gap * (teeth.length - 1);
  const unit = (L * 0.985) / total;

  let s = (L - total * unit) / 2;
  return teeth.map((n, i) => {
    const k = kinds[i];
    const w = SIZE[k].w * unit;
    const h = SIZE[k].h * unit;
    const target = s + w / 2;
    s += w + gap * unit;
    let j = cum.findIndex((c) => c >= target);
    if (j < 0) j = N;
    const p = pts[j];
    const nx = Math.cos(p.th) / RX;
    const ny = (upper ? -1 : 1) * Math.sin(p.th) / RY;
    const len = Math.hypot(nx, ny);
    const ux = nx / len;
    const uy = ny / len;
    const rot = (Math.atan2(ux, -uy) * 180) / Math.PI;
    const off = h / 2 + 15;
    return { n, x: p.x, y: p.y, rot, w, h, lx: p.x + ux * off, ly: p.y + uy * off, kind: k };
  });
}

/** Desenho do dente visto de cima (oclusal), centrado em (0,0). "Cima" local = lado de fora da arcada. */
function ToothShape({ kind, w, h }: { kind: ToothKind; w: number; h: number }) {
  const hw = w / 2;
  const hh = h / 2;
  switch (kind) {
    case 'molar':
      return (
        <>
          <rect className="tooth-body" x={-hw} y={-hh} width={w} height={h} rx={w * 0.32} />
          <path className="tooth-detail" d={`M${-hw * 0.55},0 Q0,${hh * 0.25} ${hw * 0.55},0 M0,${-hh * 0.6} Q${-hw * 0.12},0 0,${hh * 0.6}`} />
        </>
      );
    case 'pre-molar':
      return (
        <>
          <ellipse className="tooth-body" cx={0} cy={0} rx={hw} ry={hh} />
          <path className="tooth-detail" d={`M${-hw * 0.5},0 Q0,${hh * 0.2} ${hw * 0.5},0`} />
        </>
      );
    case 'canino':
      return (
        <path
          className="tooth-body"
          d={`M0,${-hh} C${hw * 0.9},${-hh * 0.7} ${hw},${hh * 0.4} ${hw * 0.55},${hh * 0.8} Q0,${hh * 1.1} ${-hw * 0.55},${hh * 0.8} C${-hw},${hh * 0.4} ${-hw * 0.9},${-hh * 0.7} 0,${-hh}Z`}
        />
      );
    default:
      return (
        <path
          className="tooth-body"
          d={`M${-hw},${-hh * 0.6} Q0,${-hh * 1.25} ${hw},${-hh * 0.6} Q${hw * 1.02},${hh * 0.5} ${hw * 0.6},${hh} Q0,${hh * 0.7} ${-hw * 0.6},${hh} Q${-hw * 1.02},${hh * 0.5} ${-hw},${-hh * 0.6}Z`}
        />
      );
  }
}

interface Props {
  procedures: Procedure[];
  exams: Exam[];
  selected: number | null;
  onSelect: (n: number) => void;
  decidua: boolean;
}

export function Odontogram({ procedures, exams, selected, onSelect, decidua }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ n: number; x: number; y: number } | null>(null);

  const placed = useMemo(() => {
    const { superior, inferior } = archTeeth(decidua);
    return [...placeArch(superior, UPPER_CY, true, decidua), ...placeArch(inferior, LOWER_CY, false, decidua)];
  }, [decidua]);

  const byTooth = useMemo(() => {
    const m = new Map<number, { procs: Procedure[]; exams: Exam[] }>();
    const g = (n: number) => m.get(n) ?? (m.set(n, { procs: [], exams: [] }), m.get(n)!);
    procedures.forEach((p) => p.dente != null && g(p.dente).procs.push(p));
    exams.forEach((e) => e.dentes.forEach((n) => g(n).exams.push(e)));
    m.forEach((v) => {
      v.procs.sort((a, b) => b.data.localeCompare(a.data));
      v.exams.sort((a, b) => b.data.localeCompare(a.data));
    });
    return m;
  }, [procedures, exams]);

  const move = (n: number) => (e: MouseEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    setHover({ n, x: e.clientX - r.left, y: e.clientY - r.top });
  };

  const hv = hover ? byTooth.get(hover.n) : undefined;
  const hoverInfo = hover ? toothInfo(hover.n) : null;

  return (
    <div className="odontogram" ref={wrap} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Odontograma">
        <text className="arch-label" x={CX} y={UPPER_CY - 40}>ARCADA SUPERIOR</text>
        <text className="arch-label" x={CX} y={LOWER_CY + 52}>ARCADA INFERIOR</text>
        <text className="side-label" x={28} y={H / 2 + 5}>Direito</text>
        <text className="side-label" x={W - 28} y={H / 2 + 5}>Esquerdo</text>
        <line className="midline" x1={CX} x2={CX} y1={20} y2={H - 20} />
        <line className="midline" x1={60} x2={W - 60} y1={H / 2} y2={H / 2} />

        {placed.map((t) => {
          const data = byTooth.get(t.n);
          const st = toothState(data?.procs ?? []);
          const c = STATE_COLORS[st];
          const hasExam = (data?.exams.length ?? 0) > 0;
          const isSel = selected === t.n;
          return (
            <g
              key={t.n}
              className={`tooth ${st} ${isSel ? 'selected' : ''}`}
              onClick={() => onSelect(t.n)}
              onMouseMove={move(t.n)}
              tabIndex={0}
              role="button"
              aria-label={`Dente ${t.n}: ${toothInfo(t.n).completo} — ${STATE_LABEL[st]}`}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelect(t.n)}
            >
              <g transform={`translate(${t.x},${t.y}) rotate(${t.rot})`} style={{ fill: c.fill, stroke: c.stroke }}>
                <ToothShape kind={t.kind} w={t.w} h={t.h} />
                {st === 'ausente' && (
                  <path className="tooth-x" d={`M${-t.w * 0.3},${-t.h * 0.3} L${t.w * 0.3},${t.h * 0.3} M${t.w * 0.3},${-t.h * 0.3} L${-t.w * 0.3},${t.h * 0.3}`} />
                )}
                {hasExam && <circle className="exam-dot" cx={t.w * 0.36} cy={-t.h * 0.36} r={5.5} />}
              </g>
              <text className="tooth-num" x={t.lx} y={t.ly + 4}>{t.n}</text>
            </g>
          );
        })}
      </svg>

      {hover && hoverInfo && (
        <div
          className="tooth-tooltip"
          style={{
            left: Math.min(hover.x + 16, (wrap.current?.clientWidth ?? 600) - 270),
            top: hover.y + 16,
          }}
        >
          <div className="tt-title">
            Dente {hover.n} <span>— {hoverInfo.completo}</span>
          </div>
          <div className="tt-state">
            <i style={{ background: STATE_COLORS[toothState(hv?.procs ?? [])].fill }} />
            {STATE_LABEL[toothState(hv?.procs ?? [])]}
          </div>
          {hv?.procs.length ? (
            <ul>
              {hv.procs.slice(0, 3).map((p) => (
                <li key={p.id}>
                  <b>{p.tipo}</b> · {STATUS_LABEL[p.status]} · {fmtDate(p.data)}
                </li>
              ))}
              {hv.procs.length > 3 && <li className="muted">+{hv.procs.length - 3} registros</li>}
            </ul>
          ) : (
            <p className="muted">Nenhum procedimento registrado.</p>
          )}
          {hv?.exams.length ? (
            <div className="tt-exams">
              {hv.exams[0].imagens[0] && <ExamImage path={hv.exams[0].imagens[0]} alt="" />}
              <span>
                {hv.exams.length} exame(s)<br />
                <small>{hv.exams[0].tipo} · {fmtDate(hv.exams[0].data)}</small>
              </span>
            </div>
          ) : null}
          <div className="tt-hint">Clique para ver tudo</div>
        </div>
      )}
    </div>
  );
}

export function Legend() {
  return (
    <div className="legend">
      {(Object.keys(STATE_LABEL) as ToothState[]).map((s) => (
        <span key={s}>
          <i className={s} style={{ background: STATE_COLORS[s].fill, borderColor: STATE_COLORS[s].stroke }} />
          {STATE_LABEL[s]}
        </span>
      ))}
      <span>
        <i className="dot" /> Tem exame / raio-X
      </span>
    </div>
  );
}
