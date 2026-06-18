'use client';
import { useEffect, useRef, useState, useCallback } from 'react';

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL ?? 'http://localhost:3001';
const WS_URL = AGENT_URL.replace('http', 'ws');

export type AgentState = {
  status: 'RUNNING' | 'PAUSED' | 'STOPPED';
  portfolioUsd: number;
  bnbUsd: number;
  tokenUsd: number;
  bnbBalance: number;
  holdings: { symbol: string; amount: number; valueUsd: number }[];
  startingUsd: number;
  pnlPct: number;
  drawdownPct: number;
  lastUpdated: number;
};

export type Trade = {
  id: number;
  timestamp: number;
  token: string;
  side: 'BUY' | 'SELL';
  amount_bnb: number;
  price_usd: number;
  tx_hash: string | null;
  signal: string | null;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED';
};

export type PnlPoint = {
  timestamp: number;
  pnl_pct: number;
  portfolio_usd: number;
};

export type Signal = {
  id: number;
  timestamp: number;
  fear_greed: number | null;
  sentiment: string | null;
  regime: string;
  action: string;
};

export type AgentRun = {
  id: number;
  timestamp: number;
  action: string;
  token: string;
  analyst_brief: {
    regime: string;
    fearGreed: number;
    fearGreedLabel: string;
    sentiment: string | null;
    summary: string;
    topOpportunities: string[];
    keyRisks: string[];
  } | null;
  pm_reasoning: string | null;
  risk_reasoning: string | null;
  trade_id: number | null;
};

export type Position = {
  id: number;
  token: string;
  bnb_spent: number;
  amount_token: number;
  entry_price_usd: number;
  opened_at: number;
  status: 'OPEN' | 'CLOSED';
  closed_at: number | null;
  exit_price_usd: number | null;
  exit_reason: string | null;
  realized_pnl_pct: number | null;
};

export type PipelineStep = 'analyst' | 'portfolioManager' | 'riskOfficer' | null;

export function useAgent() {
  const [state, setState] = useState<AgentState | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pnlHistory, setPnlHistory] = useState<PnlPoint[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRun[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeAgent, setActiveAgent] = useState<PipelineStep>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(1000);
  const destroyed = useRef(false);

  const loadPositions = useCallback(() => {
    fetch(`${AGENT_URL}/api/positions`).then(r => r.json()).then(setPositions).catch(() => {});
  }, []);

  const loadRest = useCallback(() => {
    Promise.all([
      fetch(`${AGENT_URL}/api/state`).then(r => r.json()),
      fetch(`${AGENT_URL}/api/trades`).then(r => r.json()),
      fetch(`${AGENT_URL}/api/pnl`).then(r => r.json()),
      fetch(`${AGENT_URL}/api/signals`).then(r => r.json()),
      fetch(`${AGENT_URL}/api/runs`).then(r => r.json()),
      fetch(`${AGENT_URL}/api/positions`).then(r => r.json()),
    ]).then(([s, t, p, sig, runs, pos]) => {
      setState(s);
      setTrades(t);
      setPnlHistory(p.slice().reverse());
      setSignals(sig);
      setAgentRuns(runs);
      setPositions(pos);
    }).catch(() => {});
  }, []);

  const connect = useCallback(() => {
    if (destroyed.current) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retryDelay.current = 1000;
      loadRest();
    };

    ws.onclose = () => {
      setConnected(false);
      setActiveAgent(null);
      if (!destroyed.current) {
        retryRef.current = setTimeout(() => {
          retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
          connect();
        }, retryDelay.current);
      }
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'state') setState(msg.data);
      if (msg.type === 'trade') {
        setTrades(prev => [msg.data, ...prev].slice(0, 50));
        loadPositions(); // a trade opened or closed a position
      }
      if (msg.type === 'signal') setSignals(prev => [msg.data, ...prev].slice(0, 20));
      if (msg.type === 'run') {
        setAgentRuns(prev => [msg.data, ...prev].slice(0, 50));
        setActiveAgent(null);
      }
      if (msg.type === 'agent') {
        setActiveAgent(msg.agent as PipelineStep);
      }
    };
  }, [loadRest, loadPositions]);

  useEffect(() => {
    destroyed.current = false;
    loadRest();
    connect();

    return () => {
      destroyed.current = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect, loadRest]);

  return { state, trades, pnlHistory, signals, agentRuns, positions, activeAgent, connected };
}
