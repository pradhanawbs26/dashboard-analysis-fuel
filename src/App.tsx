import { useState, useCallback } from 'react';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import MetricsCards from './components/MetricsCards';
import ParetoChart from './components/ParetoChart';
import DataTable from './components/DataTable';
import AnomalyPanel from './components/AnomalyPanel';
import AiInsights from './components/AiInsights';
import { FuelRecord, AnalyticsResult } from './types';
import { parseFile } from './utils/parser';
import { computeAnalytics } from './utils/analytics';

export default function App() {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const parsed = await parseFile(file);
      if (parsed.length === 0) {
        setError('File tidak berisi data yang dapat dibaca. Pastikan file memiliki header kolom yang sesuai.');
        setLoading(false);
        return;
      }
      const result = computeAnalytics(parsed);
      setRecords(parsed);
      setAnalytics(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan saat memproses file.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = () => {
    setRecords([]);
    setAnalytics(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <Header hasData={analytics !== null} onReset={handleReset} />

      {!analytics ? (
        <FileUpload onFileParsed={handleFile} isLoading={loading} error={error} />
      ) : (
        <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
          {/* Date range info */}
          {analytics.dateRange && (
            <div className="text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2 inline-flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              Periode data: <span className="font-medium text-slate-700">{analytics.dateRange.start}</span>
              {analytics.dateRange.start !== analytics.dateRange.end && (
                <> — <span className="font-medium text-slate-700">{analytics.dateRange.end}</span></>
              )}
            </div>
          )}

          {/* Metric cards */}
          <MetricsCards analytics={analytics} />

          {/* AI insights */}
          <AiInsights analytics={analytics} />

          {/* Pareto chart */}
          <ParetoChart unitSummaries={analytics.unitSummaries} totalFuel={analytics.totalFuel} />

          {/* Pareto + Anomaly side by side on large screens */}
          {analytics.anomalies.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-1">
                <AnomalyPanel anomalies={analytics.anomalies} />
              </div>
              <div className="xl:col-span-2">
                <DataTable records={records} />
              </div>
            </div>
          )}

          {analytics.anomalies.length === 0 && (
            <DataTable records={records} />
          )}
        </main>
      )}
    </div>
  );
}
