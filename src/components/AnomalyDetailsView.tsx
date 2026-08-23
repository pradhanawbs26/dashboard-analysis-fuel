import React, { useMemo } from "react";
import { 
  ArrowLeft, 
  AlertTriangle, 
  FileSpreadsheet, 
  Search, 
  Trash2, 
  Clock, 
  User, 
  Cpu,
  Database,
  Sparkles
} from "lucide-react";
import { FuelRecord } from "../types";

interface AnomalyDetailsViewProps {
  anomalousRecords: FuelRecord[];
  allRecordsCount: number;
  onBack: () => void;
  startDate: string;
  endDate: string;
  selectedEgy?: string;
  selectedType?: string;
  selectedStorage: string;
  isFiltered?: boolean;
  onClearFilters?: () => void;
  totalGlobalAnomaliesCount?: number;
}

export default function AnomalyDetailsView({
  anomalousRecords,
  allRecordsCount,
  onBack,
  startDate,
  endDate,
  selectedEgy,
  selectedType,
  selectedStorage,
  isFiltered = false,
  onClearFilters,
  totalGlobalAnomaliesCount = 0
}: AnomalyDetailsViewProps) {
  const activeFilterLabel = selectedEgy || selectedType || "SEMUA";

  // Statistics for anomalies
  const totalAnomalousBbm = useMemo(() => {
    return anomalousRecords.reduce((acc, r) => acc + (r.volumeFuel || 0), 0);
  }, [anomalousRecords]);

  const anomalyPercentage = useMemo(() => {
    if (allRecordsCount === 0) return 0;
    return Number(((anomalousRecords.length / allRecordsCount) * 100).toFixed(1));
  }, [anomalousRecords, allRecordsCount]);

  return (
    <div className="space-y-6 font-sans animate-fade-in bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
      {/* Top Action & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center justify-center p-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-medium text-xs gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard</span>
          </button>
          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>
          <div>
            <span className="text-[10px] bg-red-100 text-red-800 font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
              Halaman Khusus Audit
            </span>
            <h1 className="text-lg font-black text-slate-800 mt-1">Detail Temuan Data Anomali</h1>
          </div>
        </div>

        <div className="text-xs bg-slate-100 py-1 px-3 rounded-lg border border-slate-200 text-slate-500 font-mono">
          Periode: <span className="font-bold text-slate-800">{startDate}</span> s/d <span className="font-bold text-slate-800">{endDate}</span>
        </div>
      </div>

      {/* Audit KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Total Log Disaring</span>
          <span className="text-xl font-bold font-mono text-slate-800 mt-1 block">
            {allRecordsCount} <span className="text-xs font-semibold text-slate-400">Entri</span>
          </span>
          <span className="text-[10px] text-slate-500 mt-1 block">Jumlah seluruh data dalam filter aktif.</span>
        </div>

        <div className="bg-rose-50/50 border border-rose-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Kasus Anomali</span>
          <span className="text-xl font-bold font-mono text-rose-700 mt-1 block">
            {anomalousRecords.length} <span className="text-xs font-semibold text-rose-500">Log</span>
          </span>
          <span className="text-[10px] text-rose-600 mt-1 block">Telah dieliminasi dari statistik efisiensi.</span>
        </div>

        <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4 shadow-sm">
          <span className="text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Rasio Temuan Masalah</span>
          <span className="text-xl font-bold font-mono text-amber-700 mt-1 block">
            {anomalyPercentage}%
          </span>
          <span className="text-[10px] text-amber-600 mt-1 block">Dari keseluruhan data yang masuk.</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-white shadow-sm">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">BBM Terdampak Anomali</span>
          <span className="text-xl font-bold font-mono text-emerald-400 mt-1 block">
            {totalAnomalousBbm.toLocaleString("id-ID")} <span className="text-xs font-semibold text-slate-400">Liter</span>
          </span>
          <span className="text-[10px] text-slate-400 mt-1 block">Total volume solar dalam log anomali.</span>
        </div>
      </div>

      {/* Info Warning */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs text-amber-800">
        <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
        <div>
          <span className="font-bold text-amber-950">Fungsi Mesin Eliminator Otomatis:</span> Berkas log yang memiliki kejanggalan pengisian, seperti running hours nol/negatif atau angka fuel burn rate yang mustahil secara operasional (terlalu tinggi/rendah), disisihkan agar tidak mengacaukan perhitungan rata-rata normal (Daily, MTD, YTD) dan chart Pareto. Gunakan rincian di bawah ini untuk mengonfirmasi ulang input berkas laporan kepada operator bersangkutan.
        </div>
      </div>

      {/* Anomaly Table Area */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-rose-600 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-800">
                Rincian Log Transaksi dengan Anomali Teknis ({anomalousRecords.length} Baris Terdeteksi)
              </h3>
            </div>
            {isFiltered && (
              <span className="text-[10px] bg-amber-100 text-amber-850 font-bold px-2 py-0.5 rounded-full border border-amber-200 self-start sm:self-center">
                Terfilter
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-[11px] text-slate-500 bg-slate-100 font-bold px-2.5 py-1 rounded border border-slate-200">
              Egy Alat: {activeFilterLabel} • Lokasi Pengisian: {selectedStorage}
            </div>
            {isFiltered && onClearFilters && (
              <button
                onClick={onClearFilters}
                className="text-[10px] bg-[#4682B4] hover:bg-[#36648B] text-white font-extrabold px-2.5 py-1 rounded shadow-sm transition active:scale-95 cursor-pointer"
              >
                Tampilkan Semua ({totalGlobalAnomaliesCount})
              </button>
            )}
          </div>
        </div>

        {anomalousRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-lg border border-slate-150 p-4 text-center">
            <Sparkles className="w-8 h-8 opacity-60 mb-2 text-emerald-500 animate-bounce" />
            <p className="text-sm font-bold text-slate-700">Luar Biasa, Tidak Ada Anomali Terdeteksi!</p>
            <p className="text-xs text-slate-400 mt-1 max-w-md">Data pada filter Egy "{activeFilterLabel}" dan Lokasi "{selectedStorage}" ini 100% konsisten.</p>
            {isFiltered && onClearFilters && (
              <button
                onClick={onClearFilters}
                className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 font-bold text-xs text-white rounded-lg shadow transition active:scale-95 cursor-pointer"
              >
                Hapus Semua Filter untuk Melihat {totalGlobalAnomaliesCount} Anomali Global
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="py-3 px-3 text-slate-500 font-bold w-12 text-center">No</th>
                  <th className="py-3 px-3 text-slate-500 font-bold">Nomor Unit / ID</th>
                  <th className="py-3 px-3 text-slate-500 font-bold">Egy Alat (Kolom C)</th>
                  <th className="py-3 px-3 text-slate-500 font-bold">Tanggal</th>
                  <th className="py-3 px-3 text-slate-500 font-bold">Lokasi Pengisian</th>
                  <th className="py-3 px-3 text-slate-500 font-bold text-right font-mono">HM Awal</th>
                  <th className="py-3 px-3 text-slate-500 font-bold text-right font-mono">HM Akhir</th>
                  <th className="py-3 px-3 text-slate-500 font-bold text-right font-mono">Selisih HM</th>
                  <th className="py-3 px-3 text-slate-500 font-bold text-right font-mono">Volume Solar</th>
                  <th className="py-3 px-3 text-slate-500 font-bold text-center">Dampak Fuel Burn</th>
                  <th className="py-3 px-3 text-rose-700 font-extrabold">Alasan / Diagnosis Sistem</th>
                  <th className="py-3 px-3 text-slate-500 font-bold">Operator & Fuelman</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {anomalousRecords.map((r, index) => {
                  return (
                    <tr key={r.id || index} className="hover:bg-rose-50/15 transition-colors">
                      <td className="py-3 px-3 text-center font-bold text-slate-400">{index + 1}</td>
                      <td className="py-3 px-3 font-mono font-bold text-slate-800">{r.idAlat}</td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-mono text-[11px]">
                          {r.egy}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 font-mono whitespace-nowrap">{r.tanggal}</td>
                      <td className="py-3 px-3">
                        <span className="inline-block bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded">
                          {r.storage}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500 font-bold">{r.hmSebelum.toFixed(1)}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500 font-bold">{r.hmSaatIni.toFixed(1)}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${r.selisihHm <= 0 ? "text-rose-600" : "text-slate-600"}`}>
                        {r.selisihHm} J
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">{r.volumeFuel.toLocaleString("id-ID")} L</td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-mono text-xs font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                          {r.selisihHm > 0 ? `${(r.volumeFuel / r.selisihHm).toFixed(2)} L/Jam` : "N/A"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-block bg-rose-100 text-rose-800 font-bold px-2.5 py-1 rounded-md text-[10px] border border-rose-200">
                          {r.anomalyMessage || "Sistem mendeteksi deviasi tidak wajar"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="font-medium truncate max-w-[120px]">{r.operator || "-"}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-slate-400">
                          <Clock className="w-2.5 h-2.5 shrink-0" />
                          <span>FM: {r.fuelman || "-"}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Lower Back Button */}
      <div className="flex items-center justify-start">
        <button
          onClick={onBack}
          className="flex items-center justify-center p-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-650 font-bold text-xs gap-1.5 transition active:scale-95 shadow-sm cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Dashboard Utama</span>
        </button>
      </div>
    </div>
  );
}
