import { UnitSummary } from '../types';
import { formatNumber } from '../utils/analytics';

interface ParetoChartProps {
  unitSummaries: UnitSummary[];
  totalFuel: number;
}

const CHART_WIDTH = 800;
const CHART_HEIGHT = 320;
const PADDING = { top: 20, right: 60, bottom: 80, left: 70 };

const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

export default function ParetoChart({ unitSummaries, totalFuel }: ParetoChartProps) {
  // Show top 20 units max
  const units = unitSummaries.slice(0, 20);
  if (units.length === 0) return null;

  const maxFuel = units[0].totalFuel;
  const barW = INNER_W / units.length;
  const barPad = Math.max(2, barW * 0.12);

  const yScale = (v: number) => INNER_H - (v / maxFuel) * INNER_H;
  const linePoints = units
    .map((u, i) => `${PADDING.left + i * barW + barW / 2},${PADDING.top + (INNER_H - (u.cumulative / 100) * INNER_H)}`)
    .join(' ');

  const paretoIdx = units.findIndex(u => u.cumulative >= 80);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-slate-800">Analisis Pareto — Top Konsumsi BBM</h3>
          <p className="text-slate-400 text-xs mt-0.5">
            {paretoIdx >= 0 ? `${paretoIdx + 1} unit teratas menyumbang ≥80% total pemakaian` : 'Distribusi konsumsi BBM per unit'}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-blue-600 inline-block" />
            Konsumsi BBM
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-amber-500 inline-block" />
            Kumulatif %
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-5 border-t-2 border-dashed border-red-400 inline-block" />
            80% threshold
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          width="100%"
          style={{ minWidth: Math.max(400, units.length * 36) }}
        >
          {/* Y-axis gridlines */}
          {[0, 25, 50, 75, 100].map(pct => {
            const y = PADDING.top + INNER_H - (pct / 100) * INNER_H;
            return (
              <g key={pct}>
                <line
                  x1={PADDING.left} x2={PADDING.left + INNER_W}
                  y1={y} y2={y}
                  stroke="#f1f5f9" strokeWidth="1"
                />
                <text x={PADDING.left + INNER_W + 6} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="start">
                  {pct}%
                </text>
              </g>
            );
          })}

          {/* Bars */}
          {units.map((u, i) => {
            const x = PADDING.left + i * barW + barPad;
            const bw = barW - barPad * 2;
            const bh = (u.totalFuel / maxFuel) * INNER_H;
            const y = PADDING.top + INNER_H - bh;
            const inPareto = u.isInPareto80;
            return (
              <g key={u.namaUnit}>
                <rect
                  x={x} y={y} width={bw} height={bh}
                  fill={inPareto ? '#1d4ed8' : '#93c5fd'}
                  rx="3"
                />
                {/* Label value on bar (only if bar is tall enough) */}
                {bh > 20 && (
                  <text
                    x={x + bw / 2} y={y + 12}
                    fontSize="8" fill="white" textAnchor="middle" fontWeight="bold"
                  >
                    {formatNumber(u.totalFuel, 0)}
                  </text>
                )}
                {/* X-axis unit name */}
                <text
                  transform={`translate(${x + bw / 2}, ${PADDING.top + INNER_H + 10}) rotate(45)`}
                  fontSize="9" fill="#475569" textAnchor="start"
                >
                  {u.namaUnit.length > 12 ? u.namaUnit.slice(0, 11) + '…' : u.namaUnit}
                </text>
              </g>
            );
          })}

          {/* 80% threshold line */}
          {(() => {
            const y80 = PADDING.top + INNER_H - 0.8 * INNER_H;
            return (
              <line
                x1={PADDING.left} x2={PADDING.left + INNER_W}
                y1={y80} y2={y80}
                stroke="#f87171" strokeWidth="1.5" strokeDasharray="6,4"
              />
            );
          })()}

          {/* Cumulative line */}
          <polyline
            points={linePoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="2"
          />
          {units.map((u, i) => (
            <circle
              key={`dot-${i}`}
              cx={PADDING.left + i * barW + barW / 2}
              cy={PADDING.top + INNER_H - (u.cumulative / 100) * INNER_H}
              r="3"
              fill="#f59e0b"
              stroke="white"
              strokeWidth="1.5"
            />
          ))}

          {/* Left Y-axis label */}
          <text
            transform={`translate(14, ${PADDING.top + INNER_H / 2}) rotate(-90)`}
            fontSize="10" fill="#64748b" textAnchor="middle"
          >
            Volume BBM (Liter)
          </text>

          {/* Axes */}
          <line
            x1={PADDING.left} x2={PADDING.left}
            y1={PADDING.top} y2={PADDING.top + INNER_H}
            stroke="#cbd5e1" strokeWidth="1"
          />
          <line
            x1={PADDING.left} x2={PADDING.left + INNER_W}
            y1={PADDING.top + INNER_H} y2={PADDING.top + INNER_H}
            stroke="#cbd5e1" strokeWidth="1"
          />

          {/* Y-axis ticks */}
          {[0, maxFuel * 0.25, maxFuel * 0.5, maxFuel * 0.75, maxFuel].map((v, idx) => (
            <text key={idx} x={PADDING.left - 6} y={PADDING.top + INNER_H - (v / maxFuel) * INNER_H + 4} fontSize="9" fill="#94a3b8" textAnchor="end">
              {formatNumber(v, 0)}
            </text>
          ))}
        </svg>
      </div>

      {/* Summary table below chart */}
      <div className="mt-4 border-t border-slate-100 pt-4">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400 uppercase tracking-wide">
                <th className="text-left pb-2 font-medium">#</th>
                <th className="text-left pb-2 font-medium">Unit</th>
                <th className="text-left pb-2 font-medium">Jenis</th>
                <th className="text-right pb-2 font-medium">Total BBM (L)</th>
                <th className="text-right pb-2 font-medium">% dari Total</th>
                <th className="text-right pb-2 font-medium">Kumulatif %</th>
                <th className="text-right pb-2 font-medium">Avg FR (L/HM)</th>
              </tr>
            </thead>
            <tbody>
              {units.slice(0, 10).map((u, i) => (
                <tr key={u.namaUnit} className={`border-t border-slate-50 ${u.isInPareto80 ? 'bg-blue-50/50' : ''}`}>
                  <td className="py-1.5 text-slate-400">{i + 1}</td>
                  <td className="py-1.5 font-medium text-slate-700">{u.namaUnit}</td>
                  <td className="py-1.5 text-slate-500">{u.jenisUnit || '-'}</td>
                  <td className="py-1.5 text-right font-mono text-slate-700">{formatNumber(u.totalFuel, 0)}</td>
                  <td className="py-1.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(u.percentage, 100)}%` }} />
                      </div>
                      <span className="font-mono text-slate-600 w-10 text-right">{u.percentage.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${u.cumulative <= 80 ? 'text-blue-700' : 'text-slate-500'}`}>
                    {u.cumulative.toFixed(1)}%
                  </td>
                  <td className="py-1.5 text-right font-mono text-slate-600">{u.avgFuelRatio.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
