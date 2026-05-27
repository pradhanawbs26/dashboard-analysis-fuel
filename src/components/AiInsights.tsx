import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { AnalyticsResult } from '../types';
import { formatNumber } from '../utils/analytics';

interface AiInsightsProps {
  analytics: AnalyticsResult;
}

export default function AiInsights({ analytics }: AiInsightsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsight = async () => {
    if (insight) { setIsOpen(v => !v); return; }
    setLoading(true);
    setError(null);
    setIsOpen(true);

    const summary = {
      totalFuel: analytics.totalFuel,
      totalHM: analytics.totalHM,
      avgFuelRatio: analytics.avgFuelRatio,
      maxFuelRatio: analytics.maxFuelRatio,
      unitCount: analytics.unitCount,
      recordCount: analytics.recordCount,
      anomalyCount: analytics.anomalies.length,
      criticalCount: analytics.anomalies.filter(a => a.severity === 'critical').length,
      topConsumers: analytics.unitSummaries.slice(0, 5).map(u => ({
        unit: u.namaUnit,
        totalFuel: u.totalFuel,
        avgFuelRatio: u.avgFuelRatio,
        percentage: u.percentage,
      })),
      paretoCount: analytics.paretoThreshold + 1,
      topAnomalies: analytics.anomalies.slice(0, 3).map(a => ({
        unit: a.record.namaUnit,
        message: a.message,
        severity: a.severity,
      })),
    };

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary }),
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const data = await res.json();
      setInsight(data.analysis ?? 'Tidak ada hasil analisis.');
    } catch (e) {
      setError(`Gagal menghubungi AI: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const top5Total = analytics.unitSummaries.slice(0, 5).reduce((s, u) => s + u.totalFuel, 0);
  const top5Pct = analytics.totalFuel > 0 ? (top5Total / analytics.totalFuel) * 100 : 0;

  return (
    <div className="bg-gradient-to-r from-violet-900 to-blue-900 rounded-2xl shadow-lg overflow-hidden text-white">
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
        onClick={fetchInsight}
      >
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-xl">
            <Sparkles className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <h3 className="font-bold">Analisis AI dengan Gemini</h3>
            <p className="text-violet-200 text-xs mt-0.5">
              {insight ? 'Lihat analisis lengkap' : 'Klik untuk mendapatkan rekomendasi otomatis'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <Loader2 className="w-4 h-4 animate-spin text-violet-200" />}
          {isOpen ? <ChevronUp className="w-5 h-5 text-violet-200" /> : <ChevronDown className="w-5 h-5 text-violet-200" />}
        </div>
      </div>

      {/* Quick stats always visible */}
      <div className="px-5 pb-4 grid grid-cols-3 gap-3">
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-amber-300">{formatNumber(analytics.totalFuel, 0)}</p>
          <p className="text-violet-200 text-xs mt-0.5">Total Liter</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-300">{analytics.paretoThreshold + 1}</p>
          <p className="text-violet-200 text-xs mt-0.5">Unit = 80% konsumsi</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-red-300">{analytics.anomalies.length}</p>
          <p className="text-violet-200 text-xs mt-0.5">Anomali Terdeteksi</p>
        </div>
      </div>

      {isOpen && (
        <div className="border-t border-white/10 px-5 py-4">
          {loading && (
            <div className="flex items-center gap-3 text-violet-200">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Menganalisis data dengan Gemini AI...</span>
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-400/30 rounded-xl p-3 text-red-200 text-sm">
              {error}
            </div>
          )}
          {insight && !loading && (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="text-violet-100 text-sm leading-relaxed whitespace-pre-wrap">{insight}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
