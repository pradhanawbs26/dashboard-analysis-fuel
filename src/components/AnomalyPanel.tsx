import { AlertTriangle, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { Anomaly } from '../types';
import { formatNumber } from '../utils/analytics';

interface AnomalyPanelProps {
  anomalies: Anomaly[];
}

export default function AnomalyPanel({ anomalies }: AnomalyPanelProps) {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const critical = anomalies.filter(a => a.severity === 'critical');
  const warning = anomalies.filter(a => a.severity === 'warning');
  const displayed = showAll ? anomalies : anomalies.slice(0, 8);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Deteksi Anomali</h3>
          <div className="flex gap-2">
            {critical.length > 0 && (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                {critical.length} kritis
              </span>
            )}
            {warning.length > 0 && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                {warning.length} peringatan
              </span>
            )}
          </div>
        </div>
        <p className="text-slate-400 text-xs mt-1">Berdasarkan analisis Z-score statistik</p>
      </div>

      {anomalies.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="bg-emerald-100 p-3 rounded-full mb-3">
            <AlertCircle className="w-6 h-6 text-emerald-600" />
          </div>
          <p className="font-semibold text-slate-700">Tidak ada anomali terdeteksi</p>
          <p className="text-slate-400 text-sm mt-1">Semua data berada dalam rentang normal</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto divide-y divide-slate-50 scrollbar-thin">
          {displayed.map((a, idx) => {
            const isOpen = expanded === idx;
            return (
              <div key={idx} className={`p-4 cursor-pointer hover:bg-slate-50/60 transition-colors ${a.severity === 'critical' ? 'border-l-4 border-red-500' : 'border-l-4 border-amber-400'}`}
                onClick={() => setExpanded(isOpen ? null : idx)}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 shrink-0 ${a.severity === 'critical' ? 'text-red-500' : 'text-amber-500'}`}>
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-slate-800 text-sm truncate">{a.record.namaUnit}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${a.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {a.severity === 'critical' ? 'Kritis' : 'Peringatan'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{a.message}</p>
                    {isOpen && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs bg-slate-50 rounded-lg p-3">
                        <div>
                          <span className="text-slate-400">Tanggal:</span>
                          <span className="ml-1 font-medium text-slate-700">{a.record.tanggal || '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Z-Score:</span>
                          <span className="ml-1 font-mono font-semibold text-red-600">{a.zScore.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Volume BBM:</span>
                          <span className="ml-1 font-mono font-semibold text-slate-700">{formatNumber(a.record.volumeBBM, 0)} L</span>
                        </div>
                        <div>
                          <span className="text-slate-400">HM Operasi:</span>
                          <span className="ml-1 font-mono text-slate-700">{a.record.hmOperasi > 0 ? formatNumber(a.record.hmOperasi, 1) : '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Fuel Ratio:</span>
                          <span className="ml-1 font-mono font-semibold text-amber-600">{a.record.fuelRatio > 0 ? `${a.record.fuelRatio.toFixed(2)} L/HM` : '-'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Area:</span>
                          <span className="ml-1 text-slate-700">{a.record.area || '-'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="text-slate-300 shrink-0">
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {anomalies.length > 8 && (
        <div className="px-5 py-3 border-t border-slate-100">
          <button
            onClick={() => setShowAll(v => !v)}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            {showAll ? `Tampilkan lebih sedikit ↑` : `Lihat semua ${anomalies.length} anomali ↓`}
          </button>
        </div>
      )}
    </div>
  );
}
