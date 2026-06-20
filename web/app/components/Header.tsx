'use client';
import { useEffect, useState } from 'react';
import { AgentState } from '../hooks/useAgent';

type Props = { state: AgentState | null; connected: boolean };

const AGENT_ADDRESS =
  process.env.NEXT_PUBLIC_AGENT_ADDRESS ?? '0x644ae63803121De0fF3628db0B3f588E65759a1d';

// Mirror of the agent's TRADING_WINDOWS default (UTC hour ranges).
const TRADING_WINDOWS: [number, number][] = [[0, 3], [13, 16]];

function windowStatus(now: Date): { open: boolean; label: string } {
  const h = now.getUTCHours();
  const inWin = TRADING_WINDOWS.find(([s, e]) => h >= s && h < e);
  if (inWin) {
    const closesIn = inWin[1] - h;
    return { open: true, label: `Trading window open · closes in ${closesIn}h` };
  }
  // hours until next window start
  const starts = TRADING_WINDOWS.map(([s]) => s).sort((a, b) => a - b);
  let next = starts.find(s => s > h);
  if (next === undefined) next = starts[0] + 24;
  return { open: false, label: `Next window in ${next - h}h` };
}

export function Header({ state, connected }: Props) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const win = now ? windowStatus(now) : null;
  const running = state?.status === 'RUNNING';

  return (
    <header className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        {/* Kairos mark */}
        <svg width="38" height="38" viewBox="0 0 100 100" className="shrink-0">
          <line x1="32" y1="80" x2="32" y2="20" stroke="#818cf8" strokeWidth="6" strokeLinecap="round" />
          <polyline points="24,32 32,18 40,32" fill="none" stroke="#c7d2fe" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <path d="M 32 48 C 48 44 60 32 76 18" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" />
          <path d="M 32 48 C 48 52 60 64 76 80" fill="none" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
          <circle cx="76" cy="18" r="4.5" fill="#34d399" />
          <circle cx="76" cy="80" r="4.5" fill="#38bdf8" />
          <circle cx="32" cy="48" r="7.5" fill="#3730a3" />
          <circle cx="32" cy="48" r="3" fill="#a5b4fc" />
        </svg>
        <div>
          <h1 className="text-lg font-bold tracking-tight leading-none">Kairos</h1>
          <p className="text-[11px] text-zinc-500 leading-none mt-1">Autonomous trading agent · BSC</p>
        </div>

        {/* Agent wallet */}
        <WalletPill address={AGENT_ADDRESS} />
      </div>

      <div className="flex items-center gap-3">
        {/* Trading window badge — hover to see all windows */}
        {win && (
          <div className="relative hidden sm:block group">
            <button
              type="button"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-mono border cursor-default ${
                win.open
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-800/60 text-zinc-400 border-zinc-700'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${win.open ? 'bg-emerald-400 animate-thinkpulse' : 'bg-zinc-500'}`} />
              {win.label}
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><path d="m6 9 6 6 6-6" /></svg>
            </button>

            {/* Popover */}
            <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity absolute right-0 mt-2 z-50 w-56 rounded-lg border border-zinc-700 bg-zinc-900 p-3 shadow-xl">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Trading windows (UTC)</p>
              <ul className="space-y-1.5">
                {TRADING_WINDOWS.map(([s, e], i) => {
                  const active = now != null && now.getUTCHours() >= s && now.getUTCHours() < e;
                  return (
                    <li key={i} className="flex items-center justify-between text-xs font-mono">
                      <span className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                        <span className={active ? 'text-emerald-300' : 'text-zinc-300'}>
                          {String(s).padStart(2, '0')}:00 – {String(e).padStart(2, '0')}:00
                        </span>
                      </span>
                      {active && <span className="text-[10px] text-emerald-400">live</span>}
                    </li>
                  );
                })}
              </ul>
              <p className="mt-2 pt-2 border-t border-zinc-800 text-[10px] text-zinc-600 leading-snug">
                New entries open only in these windows. Exits run 24/7.
              </p>
            </div>
          </div>
        )}

        {/* UTC clock */}
        <span className="hidden md:inline font-mono text-xs text-zinc-500 tabular-nums">
          {now ? now.toUTCString().slice(17, 25) : '--:--:--'} UTC
        </span>

        {/* Connection / status pill */}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-mono font-semibold border ${
            connected && running
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : connected
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-red-500/10 text-red-300 border-red-500/30'
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-400'} ${running ? 'animate-thinkpulse' : ''}`} />
          {connected ? (state?.status ?? 'RUNNING') : 'OFFLINE'}
        </span>
      </div>
    </header>
  );
}

function WalletPill({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* clipboard unavailable */ }
  };

  return (
    <div className="hidden sm:flex items-center gap-1.5 ml-2 rounded-full border border-zinc-700 bg-zinc-800/60 pl-3 pr-1.5 py-1">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
      <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0">Agent Wallet</span>
      <span className="h-3 w-px bg-zinc-700 shrink-0" />
      <a
        href={`https://bscscan.com/address/${address}`}
        target="_blank"
        rel="noreferrer"
        title={address}
        className="font-mono text-[11px] text-zinc-300 hover:text-indigo-300 transition-colors"
      >
        {short} ↗
      </a>
      <button
        onClick={copy}
        title={copied ? 'Copied!' : 'Copy address'}
        className="ml-0.5 flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
      >
        {copied ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  );
}
