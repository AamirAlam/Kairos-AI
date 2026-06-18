'use client';
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, ReferenceLine,
} from 'recharts';
import { PnlPoint } from '../hooks/useAgent';

type Props = { data: PnlPoint[] };

export function PnlChart({ data }: Props) {
  const chartData = data.map(p => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    pnl: +(p.pnl_pct * 100).toFixed(2),
  }));

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 h-56">
      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-3">PnL %</p>
      {chartData.length === 0 ? (
        <div className="flex items-center justify-center h-36 text-zinc-600 text-sm">No data yet</div>
      ) : (
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="time" tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fill: '#52525b', fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip
              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#a1a1aa' }}
              formatter={(v) => [`${v}%`, 'PnL']}
            />
            <ReferenceLine y={0} stroke="#3f3f46" strokeDasharray="3 3" />
            <Area type="monotone" dataKey="pnl" stroke="#22c55e" strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
