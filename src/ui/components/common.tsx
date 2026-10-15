import type { ReactNode } from 'react';
import type { Quantity } from '../../engine/actions';
import { formatDuration, formatMoney, type Money } from '../../engine/money';
import type { OfflineReport } from '../../engine/simulation';
import { EVENT_BY_ID } from '../../engine/config/events';
import { useGame } from '../context';

export function Section({ title, hint, children, right }: { title: string; hint?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {right ?? (hint && <span className="hint">{hint}</span>)}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, tone }: { label: string; value: ReactNode; tone?: 'pos' | 'neg' }) {
  return (
    <div className="stat">
      <div className="label">{label}</div>
      <div className={`value num ${tone ?? ''}`}>{value}</div>
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
      <div style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Money({ value, sign, colored }: { value: Money; sign?: boolean; colored?: boolean }) {
  const cls = colored ? (value > 0n ? 'pos' : value < 0n ? 'neg' : '') : '';
  return <span className={`num ${cls}`}>{formatMoney(value, { sign, compact: true })}</span>;
}

const QTY_OPTIONS: Quantity[] = [1, 10, 'max'];

/** Seletor de quantidade para compras em lote (evita cliques repetitivos). */
export function QtySelector({ value, onChange }: { value: Quantity; onChange: (q: Quantity) => void }) {
  return (
    <div className="seg" role="group" aria-label="Quantidade por compra">
      {QTY_OPTIONS.map((q) => (
        <button key={String(q)} aria-pressed={value === q} onClick={() => onChange(q)}>
          {q === 'max' ? 'Máx' : `×${q}`}
        </button>
      ))}
    </div>
  );
}

export function Toasts() {
  const { store } = useGame();
  return (
    <div className="toasts" aria-live="polite">
      {store.toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <div className="grow">
            <div className="t-title">{t.title}</div>
            {t.detail && <div className="t-detail">{t.detail}</div>}
          </div>
          <button className="close" aria-label="Fechar notificação" onClick={() => store.dismissToast(t.id)}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function Modal({ children, onClose, label }: { children: ReactNode; onClose: () => void; label: string }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function OfflineModal({ report, onClose }: { report: OfflineReport; onClose: () => void }) {
  const delta = report.netWorthAfter - report.netWorthBefore;
  return (
    <Modal onClose={onClose} label="Resumo do período offline">
      <h2>Bem-vindo de volta! 👋</h2>
      {report.clockWentBack ? (
        <p className="muted small">
          O relógio do dispositivo está atrás do último horário registrado no jogo. Nada foi creditado agora; a renda offline volta a contar
          quando o horário passar do último registro.
        </p>
      ) : (
        <p className="muted small">
          Você ficou fora por {formatDuration(report.elapsedMs / 1000)}.
          {report.capped && ` Foram creditadas ${formatDuration(report.creditedMs / 1000)} (limite offline).`} Seus negócios seguiram as mesmas
          regras do jogo ativo.
        </p>
      )}
      <div className="list" style={{ marginTop: 12 }}>
        <div className="row between">
          <span>Receitas</span>
          <Money value={report.income} />
        </div>
        <div className="row between">
          <span>Despesas</span>
          <span className="num neg">-{formatMoney(report.expenses, { compact: true })}</span>
        </div>
        <div className="row between">
          <strong>Resultado no caixa</strong>
          <strong>
            <Money value={report.net} sign colored />
          </strong>
        </div>
        {report.dividends > 0n && (
          <div className="row between">
            <span>Dividendos recebidos</span>
            <Money value={report.dividends} sign colored />
          </div>
        )}
        <div className="row between">
          <span>Variação do patrimônio</span>
          <Money value={delta} sign colored />
        </div>
        <p className="tiny muted" style={{ margin: 0 }}>
          A variação do patrimônio inclui oscilações de preço de ações, criptomoedas e imóveis no período.
        </p>
        {report.events.length > 0 && (
          <div className="small">
            <span className="muted">Eventos no período: </span>
            {report.events.map((id) => `${EVENT_BY_ID[id]?.icon ?? ''} ${EVENT_BY_ID[id]?.name ?? id}`).join(', ')}
          </div>
        )}
      </div>
      <button className="btn primary block" style={{ marginTop: 16 }} onClick={onClose} autoFocus>
        Continuar
      </button>
    </Modal>
  );
}
