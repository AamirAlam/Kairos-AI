'use client';
import { useEffect, useState } from 'react';
import { AgentRun, PipelineStep } from '../hooks/useAgent';

type Props = { latestRun: AgentRun | null; activeAgent: PipelineStep };

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

type Stage = 'analyst' | 'portfolioManager' | 'riskOfficer';

function AgentCard({
  icon, name, role, active, done, preview, onOpen,
}: {
  icon: string; name: string; role: string; active: boolean; done: boolean;
  preview: React.ReactNode; onOpen?: () => void;
}) {
  const clickable = done && !!onOpen;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onOpen : undefined}
      onKeyDown={clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen!(); } } : undefined}
      className={`group flex-1 rounded-xl border p-4 transition-colors ${
        active
          ? 'border-indigo-500/50 bg-indigo-500/[0.07] shadow-[0_0_0_1px_rgba(99,102,241,0.2)]'
          : done
            ? 'border-zinc-800 bg-zinc-900'
            : 'border-zinc-800/60 bg-zinc-900/40'
      } ${clickable ? 'cursor-pointer hover:border-indigo-500/40 hover:bg-zinc-800/40' : ''}`}
    >
      <div className="flex items-center gap-2.5 mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={icon} alt={name} width={36} height={36}
          className={`h-9 w-9 rounded-lg ${active ? 'ring-2 ring-indigo-500/50 animate-thinkpulse' : ''}`} />
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-none truncate">{name}</p>
          <p className="text-[11px] text-zinc-500 leading-none mt-1">{role}</p>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-mono font-semibold ${
          active ? 'bg-indigo-500/20 text-indigo-300'
            : done ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-zinc-800 text-zinc-500'
        }`}>
          {active ? 'THINKING' : done ? 'DONE' : 'IDLE'}
        </span>
      </div>

      <div className="text-xs text-zinc-300 leading-relaxed min-h-[3.5rem]">
        {active && !done ? (
          <span className="inline-flex items-center gap-1.5 text-indigo-300/80 font-mono">
            <span className="animate-thinkpulse">analyzing…</span>
          </span>
        ) : preview}
      </div>

      {clickable && (
        <div className="mt-2 flex items-center gap-1 text-[11px] font-mono text-zinc-600 group-hover:text-indigo-400 transition-colors">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" />
          </svg>
          click to read full reasoning
        </div>
      )}
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="hidden lg:flex items-center px-1 shrink-0">
      <div className={`h-px w-8 rounded-full ${
        active
          ? 'animate-flow bg-gradient-to-r from-indigo-500/20 via-indigo-400 to-indigo-500/20'
          : 'bg-zinc-800'
      }`} />
      <span className={`-ml-1 text-xs ${active ? 'text-indigo-400' : 'text-zinc-700'}`}>›</span>
    </div>
  );
}

function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center gap-2.5 border-b border-zinc-800 bg-zinc-900/95 px-5 py-3.5 backdrop-blur">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={icon} alt={title} width={32} height={32} className="h-8 w-8 rounded-lg" />
          <p className="text-sm font-semibold">{title}</p>
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4 text-sm text-zinc-300 leading-relaxed space-y-3">
          {children}
        </div>
      </div>
    </div>
  );
}

export function AgentPipeline({ latestRun, activeAgent }: Props) {
  const [openStage, setOpenStage] = useState<Stage | null>(null);
  const brief = latestRun?.analyst_brief ?? null;

  const stageActive = (s: Stage) => activeAgent === s;
  const order: Stage[] = ['analyst', 'portfolioManager', 'riskOfficer'];
  const activeIdx = activeAgent ? order.indexOf(activeAgent as Stage) : -1;

  // ── Card previews (truncated) ──────────────────────────────────────────────
  const analystPreview = brief ? (
    <div className="space-y-1">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className={brief.regime === 'BULL' ? 'text-emerald-400' : brief.regime === 'BEAR' ? 'text-red-400' : 'text-zinc-400'}>{brief.regime}</span>
        <span className="text-zinc-600">·</span>
        <span className="text-zinc-400">F&G {brief.fearGreed} {brief.fearGreedLabel && `(${brief.fearGreedLabel})`}</span>
      </div>
      <p className="text-zinc-300 line-clamp-2">{brief.summary}</p>
    </div>
  ) : <span className="text-zinc-600">No analysis yet</span>;

  const pmPreview = latestRun?.pm_reasoning ? (
    <div className="space-y-1">
      <span className={`inline-block rounded border px-1.5 py-0.5 text-[11px] font-mono font-bold ${actionColor[latestRun.action] ?? 'text-zinc-400 border-zinc-700'}`}>
        {latestRun.action}{latestRun.token ? ` ${latestRun.token}` : ''}
      </span>
      <p className="text-zinc-300 line-clamp-2">{latestRun.pm_reasoning}</p>
    </div>
  ) : <span className="text-zinc-600">No proposal yet</span>;

  const riskPreview = latestRun?.risk_reasoning
    ? <p className="text-zinc-300 line-clamp-3">{latestRun.risk_reasoning}</p>
    : <span className="text-zinc-600">No review yet</span>;

  // ── Modal full content ──────────────────────────────────────────────────────
  const modalConfig: Record<Stage, { title: string; icon: string; content: React.ReactNode }> = {
    analyst: {
      title: 'Analyst — Market Brief', icon: '/agents/analyst.png',
      content: brief ? (
        <>
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className={`rounded border px-2 py-0.5 ${brief.regime === 'BULL' ? 'text-emerald-400 border-emerald-500/30' : brief.regime === 'BEAR' ? 'text-red-400 border-red-500/30' : 'text-zinc-400 border-zinc-700'}`}>{brief.regime}</span>
            <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-300">Fear &amp; Greed {brief.fearGreed} {brief.fearGreedLabel && `· ${brief.fearGreedLabel}`}</span>
            {brief.sentiment && <span className="rounded border border-zinc-700 px-2 py-0.5 text-zinc-400">{brief.sentiment}</span>}
          </div>
          <p className="text-zinc-200">{brief.summary}</p>
          {brief.topOpportunities?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Opportunities</p>
              <ul className="space-y-1">{brief.topOpportunities.map((o, i) => <li key={i} className="text-emerald-400/90 text-xs">+ {o}</li>)}</ul>
            </div>
          )}
          {brief.keyRisks?.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-1">Key Risks</p>
              <ul className="space-y-1">{brief.keyRisks.map((r, i) => <li key={i} className="text-red-400/90 text-xs">− {r}</li>)}</ul>
            </div>
          )}
        </>
      ) : <p className="text-zinc-500">No analysis recorded.</p>,
    },
    portfolioManager: {
      title: 'Portfolio Manager — Proposal', icon: '/agents/portfolio-manager.png',
      content: latestRun?.pm_reasoning ? (
        <>
          <span className={`inline-block rounded border px-2 py-0.5 text-xs font-mono font-bold ${actionColor[latestRun.action] ?? 'text-zinc-400 border-zinc-700'}`}>
            {latestRun.action}{latestRun.token ? ` ${latestRun.token}` : ''}
          </span>
          <p className="text-zinc-200 whitespace-pre-wrap">{latestRun.pm_reasoning}</p>
        </>
      ) : <p className="text-zinc-500">No proposal recorded.</p>,
    },
    riskOfficer: {
      title: 'Risk Officer — Decision', icon: '/agents/risk-officer.png',
      content: latestRun?.risk_reasoning ? (
        <>
          <p className="text-zinc-200 whitespace-pre-wrap">{latestRun.risk_reasoning}</p>
          {latestRun.trade_id && <p className="text-[11px] font-mono text-zinc-500">→ executed as trade #{latestRun.trade_id}</p>}
        </>
      ) : <p className="text-zinc-500">No review recorded.</p>,
    },
  };

  const open = openStage ? modalConfig[openStage] : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">Agent Pipeline</p>
        {latestRun && (
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-zinc-600">last decision</span>
            <span className={`rounded border px-2 py-0.5 font-bold ${actionColor[latestRun.action] ?? 'text-zinc-400 border-zinc-700'}`}>
              {latestRun.action}{latestRun.token ? ` ${latestRun.token}` : ''}
            </span>
            <span className="text-zinc-600">{new Date(latestRun.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-0">
        <AgentCard
          icon="/agents/analyst.png" name="Analyst" role="reads the market (CMC)"
          active={stageActive('analyst')} done={!!brief}
          preview={analystPreview} onOpen={() => setOpenStage('analyst')}
        />
        <Connector active={activeIdx >= 1} />
        <AgentCard
          icon="/agents/portfolio-manager.png" name="Portfolio Manager" role="decides the trade"
          active={stageActive('portfolioManager')} done={!!latestRun?.pm_reasoning}
          preview={pmPreview} onOpen={() => setOpenStage('portfolioManager')}
        />
        <Connector active={activeIdx >= 2} />
        <AgentCard
          icon="/agents/risk-officer.png" name="Risk Officer" role="approves or vetoes"
          active={stageActive('riskOfficer')} done={!!latestRun?.risk_reasoning}
          preview={riskPreview} onOpen={() => setOpenStage('riskOfficer')}
        />
      </div>

      {open && (
        <Modal title={open.title} icon={open.icon} onClose={() => setOpenStage(null)}>
          {open.content}
        </Modal>
      )}
    </div>
  );
}
