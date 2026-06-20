'use client';
import { useEffect } from 'react';
import { AgentRun } from '../hooks/useAgent';

const actionColor: Record<string, string> = {
  BUY: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  SELL: 'text-red-400 bg-red-500/10 border-red-500/30',
  HOLD: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  VETOED: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  SKIPPED: 'text-zinc-400 bg-zinc-700/30 border-zinc-600',
  TAKE_PROFIT: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  TRAILING_STOP: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  STOP_LOSS: 'text-red-400 bg-red-500/10 border-red-500/30',
  TIME_STOP: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
};

const regimeColor: Record<string, string> = {
  BULL: 'text-emerald-400', BEAR: 'text-red-400', NEUTRAL: 'text-zinc-400',
};

function Stage({ icon, name, children }: { icon: string; name: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt={name} width={28} height={28} className="h-7 w-7 rounded-lg shrink-0" />
        <p className="text-xs font-semibold text-zinc-200">{name}</p>
      </div>
      <div className="text-xs text-zinc-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-0.5">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3f3f46" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
    </div>
  );
}

/** Modal showing the full Analyst → PM → Risk decision chain for one run. */
export function DecisionChainModal({ run, onClose }: { run: AgentRun | null; onClose: () => void }) {
  useEffect(() => {
    if (!run) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [run, onClose]);

  if (!run) return null;
  const brief = run.analyst_brief;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[88vh] sm:max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-950/95 px-5 py-3.5 backdrop-blur">
          <p className="text-sm font-semibold">Decision chain</p>
          <span className={`rounded border px-2 py-0.5 text-[11px] font-mono font-bold ${actionColor[run.action] ?? 'text-zinc-400 border-zinc-700'}`}>
            {run.action}{run.token ? ` ${run.token}` : ''}
          </span>
          <span className="text-[11px] font-mono text-zinc-500">
            {new Date(run.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Chain */}
        <div className="p-4 space-y-1">
          <Stage icon="/agents/analyst.png" name="Analyst">
            {brief ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                  <span className={`rounded border border-zinc-700 px-1.5 py-0.5 ${regimeColor[brief.regime] ?? 'text-zinc-400'}`}>{brief.regime}</span>
                  <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-zinc-300">F&G {brief.fearGreed}{brief.fearGreedLabel ? ` · ${brief.fearGreedLabel}` : ''}</span>
                </div>
                <p className="text-zinc-300">{brief.summary}</p>
                {brief.topOpportunities?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Opportunities</p>
                    <ul className="space-y-0.5">{brief.topOpportunities.map((o, i) => <li key={i} className="text-emerald-400/90">+ {o}</li>)}</ul>
                  </div>
                )}
                {brief.keyRisks?.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Key Risks</p>
                    <ul className="space-y-0.5">{brief.keyRisks.map((r, i) => <li key={i} className="text-red-400/90">− {r}</li>)}</ul>
                  </div>
                )}
              </div>
            ) : <span className="text-zinc-600">No market analysis for this decision.</span>}
          </Stage>

          <Connector />

          <Stage icon="/agents/portfolio-manager.png" name="Portfolio Manager">
            {run.pm_reasoning
              ? <p className="text-zinc-300 whitespace-pre-wrap">{run.pm_reasoning}</p>
              : <span className="text-zinc-600">No proposal recorded.</span>}
          </Stage>

          <Connector />

          <Stage icon="/agents/risk-officer.png" name="Risk Officer">
            {run.risk_reasoning
              ? <p className="text-zinc-300 whitespace-pre-wrap">{run.risk_reasoning}</p>
              : <span className="text-zinc-600">No review recorded.</span>}
            {run.trade_id && <p className="mt-2 text-[11px] font-mono text-zinc-500">→ executed as trade #{run.trade_id}</p>}
          </Stage>
        </div>
      </div>
    </div>
  );
}
