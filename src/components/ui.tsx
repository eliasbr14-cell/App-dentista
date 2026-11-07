import type { ReactNode } from 'react';

export const initials = (nome: string) => {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  const a = parts[0][0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
};

export function Status({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`status ${kind}`}>{children}</span>;
}

export function Panel({
  title,
  count,
  actions,
  children,
  flush,
  className = '',
}: {
  title?: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <header className="panel-head">
          <h2>
            {title}
            {count != null && <span className="count">{count}</span>}
          </h2>
          {actions}
        </header>
      )}
      <div className={`panel-body ${flush ? 'flush' : ''}`}>{children}</div>
    </section>
  );
}
