import React, { useState } from "react";
import {
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Calendar,
  X,
  Layers,
  Activity,
  Fuel,
  TrendingUp,
  Search,
  Check,
  ChevronDown
} from "lucide-react";
import { MASTER_JULY_BENCHMARKS, MONTH_NAMES_IND } from "../data/sampleData";

export interface AnalyzedEgySummary {
  egy: string;
  unitCount: number;
  units: string[];
  totalVolume: number;
  totalHours: number;
  burnRate: number;
  benchmarkRate: number;
  status: "optimal" | "warning" | "high" | "info";
  statusText: string;
}

export interface AnalyzedUnitDetail {
  idAlat: string;
  egy: string;
  typeAlat: string;
  totalVolume: number;
  totalHours: number;
  burnRate: number;
  recordCount: number;
  isKnownBenchmark: boolean;
}

export interface AnalyzedUploadResult {
  fileName: string;
  fileSize?: number;
  sheetCount: number;
  sheetNames: string[];
  detectedMonth: string;
  detectedYear: number;
  totalRecords: number;
  validRecords: number;
  anomalyRecords: number;
  totalVolume: number;
  totalHours: number;
  avgBurnRate: number;
  egySummaries: AnalyzedEgySummary[];
  unitDetails: AnalyzedUnitDetail[];
  multiMonthMap?: Record<string, { totalVolume: number; totalHours: number; count: number }>;
  rawPayload?: any;
}

interface UploadAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (confirmedMonth: string, confirmedData: AnalyzedUploadResult) => void;
  analysisData: AnalyzedUploadResult | null;
  targetContext: "yearly" | "dashboard";
  isApplying?: boolean;
}

export default function UploadAnalysisModal({
  isOpen,
  onClose,
  onConfirm,
  analysisData,
  targetContext,
  isApplying = false
}: UploadAnalysisModalProps) {
  if (!isOpen || !analysisData) return null;

  const [selectedMonth, setSelectedMonth] = useState<string>(analysisData.detectedMonth || "Juli");
  const [activeTab, setActiveTab] = useState<"egy" | "units" | "anomalies">("egy");
  const [unitSearch, setUnitSearch] = useState<string>("");
  const [selectedEgyFilter, setSelectedEgyFilter] = useState<string>("SEMUA");

  const filteredUnits = (analysisData.unitDetails || []).filter((u) => {
    const matchSearch =
      u.idAlat.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.typeAlat.toLowerCase().includes(unitSearch.toLowerCase()) ||
      u.egy.toLowerCase().includes(unitSearch.toLowerCase());
    const matchEgy = selectedEgyFilter === "SEMUA" || u.egy === selectedEgyFilter;
    return matchSearch && matchEgy;
  });

  const availableEgys = Array.from(new Set((analysisData.unitDetails || []).map((u) => u.egy))).sort();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fade-in">
      <div
        className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-gradient-to-r from-[#1E293B] via-[#24334A] to-[#0F172A] text-white p-5 sm:p-6 flex items-start justify-between border-b border-slate-800 relative">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-[10px] uppercase font-black tracking-widest text-[#4682B4] bg-[#2E4A62] px-2.5 py-1 rounded-full border border-blue-500/20">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>Tahap Analisa & Validasi Unggahan</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                <Check className="w-3 h-3" />
                <span>Target: {targetContext === "yearly" ? "Yearly Review" : "Dashboard Utama"}</span>
              </span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-[#4682B4]" />
              Pemeriksaan Data: {analysisData.fileName}
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              Sistem telah memetakan data nomor unit ke <strong>Kategori Egy Master Juli</strong>. Silakan periksa hasil analisa, sesuaikan bulan sasaran, lalu konfirmasi untuk menerapkan.
            </p>
          </div>

          <button
            onClick={onClose}
            disabled={isApplying}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition cursor-pointer"
            title="Tutup & Batal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (Scrollable) */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 bg-slate-50/50 flex-1">
          {/* TARGET MONTH SELECTION & SUMMARY BAR */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-50 text-[#4682B4] rounded-lg">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <label className="text-[10px] font-black tracking-wider text-slate-400 uppercase block">
                  Bulan Sasaran Data
                </label>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="relative">
                    <select
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-300 text-slate-800 font-extrabold pl-3 pr-8 py-2 rounded-lg cursor-pointer transition focus:ring-2 focus:ring-[#4682B4] focus:outline-none appearance-none min-w-[150px]"
                    >
                      {MONTH_NAMES_IND.map((m) => (
                        <option key={m} value={m}>
                          Bulan {m}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-450">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {analysisData.multiMonthMap && Object.keys(analysisData.multiMonthMap).length > 1 ? (
                      <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {Object.keys(analysisData.multiMonthMap).length} Bulan: {Object.keys(analysisData.multiMonthMap).join(", ")}
                      </span>
                    ) : (
                      <>(Terdeteksi otomatis dari isi data: <strong>{analysisData.detectedMonth}</strong>)</>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-mono bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200">
              <div>
                <span className="text-slate-400 text-[10px] block font-sans font-bold">JUMLAH LEMBAR</span>
                <span className="font-extrabold text-slate-700">{analysisData.sheetCount} Sheet</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[10px] block font-sans font-bold">TOTAL TRANSAKSI</span>
                <span className="font-extrabold text-slate-700">{analysisData.validRecords.toLocaleString("id-ID")} Baris</span>
              </div>
              <div className="w-px h-6 bg-slate-200" />
              <div>
                <span className="text-slate-400 text-[10px] block font-sans font-bold">UNIT TERPETAKAN</span>
                <span className="font-extrabold text-emerald-600">{analysisData.unitDetails?.length || 0} Unit</span>
              </div>
            </div>
          </div>

          {/* METRICS CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL VOLUME</span>
                <Fuel className="w-4 h-4 text-blue-500" />
              </div>
              <p className="text-lg font-black text-slate-800">
                {analysisData.totalVolume.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-slate-500">L</span>
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">TOTAL HM (RUNNING)</span>
                <Activity className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-lg font-black text-slate-800">
                {analysisData.totalHours.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-slate-500">Jam</span>
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">RATA-RATA BURN RATE</span>
                <TrendingUp className="w-4 h-4 text-[#4682B4]" />
              </div>
              <p className="text-lg font-black text-[#4682B4]">
                {analysisData.avgBurnRate} <span className="text-[10px] font-normal text-slate-500">L/Jam</span>
              </p>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-[10px] font-black uppercase tracking-wider">KATEGORI EGY</span>
                <Layers className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-lg font-black text-purple-700">
                {analysisData.egySummaries?.length || 0} <span className="text-[10px] font-normal text-slate-500">Tipe</span>
              </p>
            </div>
          </div>

          {/* TAB CONTROLS */}
          <div className="flex border-b border-slate-200 gap-4">
            <button
              onClick={() => setActiveTab("egy")}
              className={`pb-2.5 text-xs font-black tracking-wide border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "egy"
                  ? "border-[#4682B4] text-[#4682B4]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Layers className="w-4 h-4" />
              Analisis Per Kategori Egy ({analysisData.egySummaries?.length || 0})
            </button>

            <button
              onClick={() => setActiveTab("units")}
              className={`pb-2.5 text-xs font-black tracking-wide border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === "units"
                  ? "border-[#4682B4] text-[#4682B4]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Rincian Unit Terpetakan ({analysisData.unitDetails?.length || 0})
            </button>

            {analysisData.anomalyRecords > 0 && (
              <button
                onClick={() => setActiveTab("anomalies")}
                className={`pb-2.5 text-xs font-black tracking-wide border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                  activeTab === "anomalies"
                    ? "border-rose-500 text-rose-600"
                    : "border-transparent text-rose-500 hover:text-rose-700"
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
                Catatan Anomali ({analysisData.anomalyRecords})
              </button>
            )}
          </div>

          {/* TAB 1: EGY CATEGORY SUMMARY TABLE */}
          {activeTab === "egy" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">Kategori Egy (Patokan Juli)</th>
                      <th className="py-3 px-4 text-center">Jumlah Unit</th>
                      <th className="py-3 px-4 text-right">Volume (Liter)</th>
                      <th className="py-3 px-4 text-right">HM (Jam)</th>
                      <th className="py-3 px-4 text-right">Burn Rate</th>
                      <th className="py-3 px-4 text-right">Target Juli</th>
                      <th className="py-3 px-4 text-center">Status Keselarasan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {analysisData.egySummaries.map((egyItem) => {
                      const diff = egyItem.burnRate - egyItem.benchmarkRate;
                      const isNormal = Math.abs(diff) <= 2.5 || egyItem.burnRate <= egyItem.benchmarkRate;

                      return (
                        <tr key={egyItem.egy} className="hover:bg-slate-50/80 transition">
                          <td className="py-3 px-4">
                            <div className="font-extrabold text-slate-900">{egyItem.egy}</div>
                            <div className="text-[10px] text-slate-400 font-mono truncate max-w-xs">
                              {egyItem.units.slice(0, 4).join(", ")}
                              {egyItem.units.length > 4 && ` +${egyItem.units.length - 4} unit lainnya`}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="bg-slate-100 text-slate-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              {egyItem.unitCount} unit
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                            {egyItem.totalVolume.toLocaleString("id-ID")} L
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">
                            {egyItem.totalHours.toLocaleString("id-ID")} Jam
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-black text-[#4682B4]">
                            {egyItem.burnRate} L/Jam
                          </td>
                          <td className="py-3 px-4 text-right font-mono text-slate-500 font-bold">
                            {egyItem.benchmarkRate} L/Jam
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                                isNormal
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {isNormal ? (
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                              )}
                              {egyItem.statusText || (isNormal ? "Sesuai Patokan" : "Cek Rasio")}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: UNIT DETAILS TABLE */}
          {activeTab === "units" && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm space-y-3 p-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Cari ID Alat, Kategori..."
                    value={unitSearch}
                    onChange={(e) => setUnitSearch(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4682B4]"
                  />
                </div>

                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase">Filter Egy:</span>
                  <select
                    value={selectedEgyFilter}
                    onChange={(e) => setSelectedEgyFilter(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 font-bold focus:outline-none focus:ring-2 focus:ring-[#4682B4]"
                  >
                    <option value="SEMUA">Semua Kategori ({analysisData.unitDetails?.length || 0})</option>
                    {availableEgys.map((egy) => (
                      <option key={egy} value={egy}>
                        {egy}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto max-h-72 border border-slate-100 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Nomor Unit (ID Alat)</th>
                      <th className="py-2.5 px-3">Kategori Terpetakan (Egy)</th>
                      <th className="py-2.5 px-3">Model / Tipe Asli</th>
                      <th className="py-2.5 px-3 text-right">Total Volume (L)</th>
                      <th className="py-2.5 px-3 text-right">HM Running (Jam)</th>
                      <th className="py-2.5 px-3 text-right">Burn Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {filteredUnits.map((unit) => (
                      <tr key={unit.idAlat} className="hover:bg-slate-50 transition">
                        <td className="py-2 px-3 font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          {unit.idAlat}
                        </td>
                        <td className="py-2 px-3">
                          <span className="bg-blue-50 text-[#4682B4] font-bold px-2 py-0.5 rounded text-[10px] border border-blue-100">
                            {unit.egy}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-slate-600 text-[11px] truncate max-w-[180px]">
                          {unit.typeAlat}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {unit.totalVolume.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                          {unit.totalHours.toLocaleString("id-ID")}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-extrabold text-[#4682B4]">
                          {unit.burnRate} L/Jam
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: ANOMALY NOTES */}
          {activeTab === "anomalies" && (
            <div className="bg-rose-50/50 rounded-xl border border-rose-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                Catatan Anomali yang Dikesampingkan dari Kalkulasi Jam:
              </div>
              <p className="text-xs text-rose-700 leading-relaxed">
                Terdapat <strong>{analysisData.anomalyRecords}</strong> baris transaksi dengan selisih HM 0 (atau tidak terbaca). Transaksi ini tetap dihitung volume bahan bakarnya, namun running hours-nya divalidasi agar tidak merusak rata-rata efisiensi burn rate.
              </p>
            </div>
          )}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {analysisData.multiMonthMap && Object.keys(analysisData.multiMonthMap).length > 1 ? (
              <>Menerapkan data ini akan memperbarui dan menyinkronkan <strong>{Object.keys(analysisData.multiMonthMap).length} Bulan ({Object.keys(analysisData.multiMonthMap).join(", ")})</strong> langsung ke Monthly Review dan Cloud Firestore.</>
            ) : (
              <>Menerapkan data ini akan memperbarui tinjauan tahunan untuk <strong>Bulan {selectedMonth}</strong> dan menyimpannya ke Cloud Firestore.</>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              disabled={isApplying}
              className="text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-bold px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>

            <button
              onClick={() => onConfirm(selectedMonth, analysisData)}
              disabled={isApplying}
              className="text-xs bg-[#4682B4] hover:bg-[#386b94] disabled:opacity-50 text-white font-extrabold px-5 py-2.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{isApplying ? "Menerapkan & Menyimpan..." : "Konfirmasi & Terapkan Data"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
