import React, { useState, useMemo, useRef } from "react";
import { 
  Fuel, 
  Truck, 
  Target, 
  Download, 
  Calendar, 
  ChevronDown, 
  Filter, 
  Sparkles, 
  Layers, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Info, 
  Eye, 
  EyeOff,
  RefreshCw,
  Copy,
  Check
} from "lucide-react";
import html2canvas from "html2canvas-pro";
import { FuelRecord, EgyPlanMap, UnitRegistryMap } from "../types";
import { DEFAULT_EGY_PLANS, deriveEgy, cleanEgyName } from "../lib/egyPlanService";

interface FuelBurnEvaluationViewProps {
  records: FuelRecord[];
  egyPlans?: EgyPlanMap;
  unitPlans?: UnitRegistryMap;
  initialMonth?: string;
  onBackToDashboard?: () => void;
}

interface UnitBurnStat {
  idAlat: string;
  typeAlat: string;
  egy: string;
  totalFuel: number;
  totalHm: number;
  burnRate: number;
  targetPlan: number;
  isEfficient: boolean;
  status: "EFISIEN" | "OVER PLAN";
}

interface EgyEvaluationData {
  egy: string;
  targetPlan: number;
  totalUnits: number;
  efisienCount: number;
  efisienPct: number;
  overPlanCount: number;
  overPlanPct: number;
  mean: number;
  q1: number;
  median: number;
  q3: number;
  min: number;
  max: number;
  totalFuel: number;
  totalHm: number;
  units: UnitBurnStat[];
}

export default function FuelBurnEvaluationView({
  records,
  egyPlans = DEFAULT_EGY_PLANS,
  unitPlans = {},
  initialMonth
}: FuelBurnEvaluationViewProps) {
  // 12-Month Presets for 2026
  const monthPresets = useMemo(() => [
    { label: "Januari 2026", shortLabel: "Jan", yearMonth: "2026-01", start: "2026-01-01", end: "2026-01-31" },
    { label: "Februari 2026", shortLabel: "Feb", yearMonth: "2026-02", start: "2026-02-01", end: "2026-02-28" },
    { label: "Maret 2026", shortLabel: "Mar", yearMonth: "2026-03", start: "2026-03-01", end: "2026-03-31" },
    { label: "April 2026", shortLabel: "Apr", yearMonth: "2026-04", start: "2026-04-01", end: "2026-04-30" },
    { label: "Mei 2026", shortLabel: "Mei", yearMonth: "2026-05", start: "2026-05-01", end: "2026-05-31" },
    { label: "Juni 2026", shortLabel: "Jun", yearMonth: "2026-06", start: "2026-06-01", end: "2026-06-30" },
    { label: "Juli 2026", shortLabel: "Jul", yearMonth: "2026-07", start: "2026-07-01", end: "2026-07-31" },
    { label: "Agustus 2026", shortLabel: "Agt", yearMonth: "2026-08", start: "2026-08-01", end: "2026-08-31" },
    { label: "September 2026", shortLabel: "Sep", yearMonth: "2026-09", start: "2026-09-01", end: "2026-09-30" },
    { label: "Oktober 2026", shortLabel: "Okt", yearMonth: "2026-10", start: "2026-10-01", end: "2026-10-31" },
    { label: "November 2026", shortLabel: "Nov", yearMonth: "2026-11", start: "2026-11-01", end: "2026-11-30" },
    { label: "Desember 2026", shortLabel: "Des", yearMonth: "2026-12", start: "2026-12-01", end: "2026-12-31" },
  ], []);

  // Determine initial selected month (default to September 2026 as per user benchmark or latest record month)
  const defaultMonth = useMemo(() => {
    if (initialMonth && monthPresets.some(m => m.yearMonth === initialMonth)) {
      return initialMonth;
    }
    // Check if records have September 2026
    const hasSep = records.some(r => r.tanggal.startsWith("2026-09"));
    if (hasSep) return "2026-09";
    const hasOct = records.some(r => r.tanggal.startsWith("2026-10"));
    if (hasOct) return "2026-10";
    return "2026-09";
  }, [records, initialMonth, monthPresets]);

  const [selectedMonth, setSelectedMonth] = useState<string>(defaultMonth);
  const [selectedEgyFilter, setSelectedEgyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedDetails, setExpandedDetails] = useState<Record<string, boolean>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState<boolean>(false);

  // Active month object
  const activeMonthPreset = useMemo(() => {
    return monthPresets.find(m => m.yearMonth === selectedMonth) || monthPresets[8]; // Fallback to September
  }, [monthPresets, selectedMonth]);

  // Formatted period text matching user's design: "01 - 30 September 2026"
  const formattedPeriodText = useMemo(() => {
    if (!activeMonthPreset) return "Periode Terpilih";
    const [startYear, startMonth, startDay] = activeMonthPreset.start.split("-");
    const [endYear, endMonth, endDay] = activeMonthPreset.end.split("-");
    const monthNames = [
      "Januari", "Februari", "Maret", "April", "Mei", "Juni", 
      "Juli", "Agustus", "September", "Oktober", "November", "Desember"
    ];
    const mName = monthNames[parseInt(startMonth, 10) - 1] || "Bulan";
    return `${startDay} - ${endDay} ${mName} ${startYear}`;
  }, [activeMonthPreset]);

  // Filter records within active selected month
  // Supporting rollover: record on 1st of next month can attribute to last day of current month if applicable
  const periodRecords = useMemo(() => {
    if (!activeMonthPreset) return [];
    const start = activeMonthPreset.start;
    const end = activeMonthPreset.end;
    return records.filter(r => r.tanggal >= start && r.tanggal <= end);
  }, [records, activeMonthPreset]);

  // Compute Evaluation Statistics for each EGY
  const evaluationList = useMemo<EgyEvaluationData[]>(() => {
    if (!periodRecords || periodRecords.length === 0) return [];

    // Group records by unit ID
    const unitMap = new Map<string, {
      idAlat: string;
      typeAlat: string;
      egy: string;
      totalFuel: number;
      totalHm: number;
    }>();

    periodRecords.forEach(r => {
      const uId = (r.idAlat || "").trim();
      if (!uId) return;

      const rawEgy = r.egy || deriveEgy(uId, r.typeAlat);
      const cleanEgy = cleanEgyName(rawEgy);
      const typeAlat = r.typeAlat || "Alat Berat";

      const effectiveHm = r.selisihHm > 0 
        ? r.selisihHm 
        : (r.hmSaatIni > r.hmSebelum ? Number((r.hmSaatIni - r.hmSebelum).toFixed(1)) : 0);

      const fuel = r.volumeFuel > 0 ? r.volumeFuel : 0;

      if (!unitMap.has(uId)) {
        unitMap.set(uId, {
          idAlat: uId,
          typeAlat,
          egy: cleanEgy,
          totalFuel: fuel,
          totalHm: effectiveHm
        });
      } else {
        const existing = unitMap.get(uId)!;
        existing.totalFuel += fuel;
        existing.totalHm += effectiveHm;
        if (!existing.typeAlat || existing.typeAlat === "Alat Berat") {
          existing.typeAlat = typeAlat;
        }
      }
    });

    // Group units by EGY
    const egyUnitsMap = new Map<string, UnitBurnStat[]>();

    unitMap.forEach(unit => {
      // Only include operational units that ran (HM > 0 and Fuel > 0)
      if (unit.totalHm <= 0 || unit.totalFuel <= 0) return;

      const burnRate = Number((unit.totalFuel / unit.totalHm).toFixed(2));
      const targetPlan = egyPlans[unit.egy] || DEFAULT_EGY_PLANS[unit.egy] || 7.00;
      const isEfficient = burnRate <= targetPlan;

      const stat: UnitBurnStat = {
        idAlat: unit.idAlat,
        typeAlat: unit.typeAlat,
        egy: unit.egy,
        totalFuel: Number(unit.totalFuel.toFixed(1)),
        totalHm: Number(unit.totalHm.toFixed(1)),
        burnRate,
        targetPlan,
        isEfficient,
        status: isEfficient ? "EFISIEN" : "OVER PLAN"
      };

      if (!egyUnitsMap.has(unit.egy)) {
        egyUnitsMap.set(unit.egy, []);
      }
      egyUnitsMap.get(unit.egy)!.push(stat);
    });

    // Percentile calculation helper
    const getPercentile = (sorted: number[], p: number): number => {
      if (sorted.length === 0) return 0;
      if (sorted.length === 1) return sorted[0];
      const index = p * (sorted.length - 1);
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
    };

    // Build Evaluation Data per EGY
    const results: EgyEvaluationData[] = [];

    egyUnitsMap.forEach((units, egyName) => {
      if (units.length === 0) return;

      // Sort burn rates ascending
      const rates = units.map(u => u.burnRate).sort((a, b) => a - b);
      const totalUnits = units.length;
      const targetPlan = egyPlans[egyName] || DEFAULT_EGY_PLANS[egyName] || 7.00;

      const efisienCount = units.filter(u => u.isEfficient).length;
      const overPlanCount = totalUnits - efisienCount;
      const efisienPct = Math.round((efisienCount / totalUnits) * 100);
      const overPlanPct = Math.round((overPlanCount / totalUnits) * 100);

      const sumFuel = units.reduce((acc, u) => acc + u.totalFuel, 0);
      const sumHm = units.reduce((acc, u) => acc + u.totalHm, 0);
      const mean = Number((rates.reduce((a, b) => a + b, 0) / totalUnits).toFixed(2));

      const min = rates[0];
      const max = rates[rates.length - 1];
      const q1 = getPercentile(rates, 0.25);
      const median = getPercentile(rates, 0.50);
      const q3 = getPercentile(rates, 0.75);

      results.push({
        egy: egyName,
        targetPlan,
        totalUnits,
        efisienCount,
        efisienPct,
        overPlanCount,
        overPlanPct,
        mean,
        q1,
        median,
        q3,
        min,
        max,
        totalFuel: sumFuel,
        totalHm: sumHm,
        units: units.sort((a, b) => b.burnRate - a.burnRate) // Sorted highest burn rate to lowest for review
      });
    });

    // Sort EGYs with most units first or alphabetical
    return results.sort((a, b) => b.totalUnits - a.totalUnits);
  }, [periodRecords, egyPlans]);

  // Available unique EGY names for filtering dropdown
  const availableEgyList = useMemo(() => {
    return evaluationList.map(e => e.egy).sort();
  }, [evaluationList]);

  // Filtered evaluation items based on dropdown and search
  const filteredEvaluations = useMemo(() => {
    return evaluationList.filter(item => {
      const matchesEgy = selectedEgyFilter === "ALL" || item.egy === selectedEgyFilter;
      const matchesSearch = !searchQuery.trim() || 
        item.egy.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.units.some(u => u.idAlat.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesEgy && matchesSearch;
    });
  }, [evaluationList, selectedEgyFilter, searchQuery]);

  // Toggle unit breakdown table for an EGY
  const toggleDetails = (egy: string) => {
    setExpandedDetails(prev => ({
      ...prev,
      [egy]: !prev[egy]
    }));
  };

  // Export specific card as high-res PNG
  const handleDownloadCard = async (egy: string) => {
    const cardEl = document.getElementById(`eval-card-${egy.replace(/\s+/g, "-")}`);
    if (!cardEl) return;

    try {
      setDownloadingId(egy);
      const canvas = await html2canvas(cardEl, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: "#FFFFFF",
        logging: false
      });

      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      const safeEgy = egy.replace(/[^a-zA-Z0-9]/g, "_");
      const safeMonth = (activeMonthPreset?.label || selectedMonth).replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `Evaluasi_Fuel_Burn_${safeEgy}_${safeMonth}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("Gagal mendownload gambar evaluasi:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  // Copy card image to clipboard
  const handleCopyCard = async (egy: string) => {
    const cardEl = document.getElementById(`eval-card-${egy.replace(/\s+/g, "-")}`);
    if (!cardEl) return;

    try {
      setCopiedId(egy);
      const canvas = await html2canvas(cardEl, {
        scale: 2.0,
        useCORS: true,
        backgroundColor: "#FFFFFF",
        logging: false
      });

      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          // @ts-ignore
          await navigator.clipboard.write([
            // @ts-ignore
            new ClipboardItem({ "image/png": blob })
          ]);
          setTimeout(() => setCopiedId(null), 2500);
        } catch (clipErr) {
          console.warn("Clipboard write failed:", clipErr);
          setCopiedId(null);
        }
      });
    } catch (err) {
      console.error("Gagal menyalin gambar:", err);
      setCopiedId(null);
    }
  };

  // Download all cards sequentially
  const handleDownloadAllCards = async () => {
    if (filteredEvaluations.length === 0) return;
    setIsBatchDownloading(true);

    try {
      for (const item of filteredEvaluations) {
        await handleDownloadCard(item.egy);
        // Small pause to prevent browser throttling downloads
        await new Promise(res => setTimeout(res, 600));
      }
    } finally {
      setIsBatchDownloading(false);
    }
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in pb-16">
      
      {/* TOP CONTROLS & FILTER BAR */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
        
        {/* Title & Description */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-[#0B2545] text-white rounded-xl shadow-xs">
                <Target className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <span>Evaluasi Konsumsi Bahan Bakar (Fuel Burn)</span>
                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold">
                    P25 Benchmark
                  </span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Analisis sebaran konsumsi bahan bakar, target efektivitas (Kuartil 1 / P25), dan kurva distribusi per kategori EGY
                </p>
              </div>
            </div>
          </div>

          {/* Batch Download Button */}
          {filteredEvaluations.length > 0 && (
            <button
              onClick={handleDownloadAllCards}
              disabled={isBatchDownloading}
              className="text-xs bg-[#0B2545] hover:bg-[#1E3A8A] disabled:opacity-50 text-white px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-95 transition"
            >
              {isBatchDownloading ? (
                <RefreshCw className="w-4 h-4 animate-spin text-emerald-400" />
              ) : (
                <Download className="w-4 h-4 text-emerald-400" />
              )}
              <span>{isBatchDownloading ? "Mengunduh Semua..." : `Unduh Semua Gambar (${filteredEvaluations.length})`}</span>
            </button>
          )}
        </div>

        {/* Filter Selection Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          <div className="flex flex-wrap items-center gap-3">
            
            {/* MONTH DROPDOWN SELECTOR */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3 h-3 text-[#0B2545]" />
                <span>PILIH PERIODE BULAN</span>
              </label>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-xl px-3.5 py-2.5 bg-slate-50 text-slate-800 focus:border-[#0B2545] focus:bg-white focus:outline-none cursor-pointer pr-9 appearance-none shadow-2xs hover:bg-white transition"
                >
                  {monthPresets.map(mp => {
                    const hasRecords = records.some(r => r.tanggal.startsWith(mp.yearMonth));
                    return (
                      <option key={mp.yearMonth} value={mp.yearMonth}>
                        {mp.label} {hasRecords ? "(Tersedia Data)" : ""}
                      </option>
                    );
                  })}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* EGY CATEGORY SELECTOR */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Filter className="w-3 h-3 text-[#0B2545]" />
                <span>KATEGORI EGY</span>
              </label>
              <div className="relative">
                <select
                  value={selectedEgyFilter}
                  onChange={(e) => setSelectedEgyFilter(e.target.value)}
                  className="text-xs font-bold border border-slate-300 rounded-xl px-3.5 py-2.5 bg-slate-50 text-slate-800 focus:border-[#0B2545] focus:bg-white focus:outline-none cursor-pointer pr-9 appearance-none shadow-2xs hover:bg-white transition"
                >
                  <option value="ALL">Semua Kategori EGY ({availableEgyList.length} Kategori)</option>
                  {availableEgyList.map(egy => (
                    <option key={egy} value={egy}>
                      {egy}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3 top-3 pointer-events-none" />
              </div>
            </div>

            {/* Quick Search */}
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Search className="w-3 h-3 text-[#0B2545]" />
                <span>CARI EGY / UNIT</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ketik nama alat/EGY..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs border border-slate-300 rounded-xl pl-8 pr-3 py-2.5 bg-slate-50 text-slate-800 focus:border-[#0B2545] focus:bg-white focus:outline-none shadow-2xs w-48 sm:w-56"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3.5" />
              </div>
            </div>
          </div>

          {/* Quick info counter */}
          <div className="flex items-center gap-2 bg-slate-100/80 px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 self-start lg:self-center">
            <Layers className="w-4 h-4 text-[#0B2545]" />
            <span>Menampilkan {filteredEvaluations.length} Gambar Evaluasi EGY</span>
          </div>

        </div>

        {/* Quick EGY Tabs Bar if ALL is selected */}
        {selectedEgyFilter === "ALL" && availableEgyList.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-2 border-t border-slate-100 scrollbar-none">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
              Lompat Ke:
            </span>
            {availableEgyList.map(egy => (
              <a
                key={egy}
                href={`#eval-card-${egy.replace(/\s+/g, "-")}`}
                className="text-[11px] font-extrabold px-3 py-1 rounded-lg bg-slate-100 hover:bg-[#0B2545] hover:text-white text-slate-650 transition shrink-0 whitespace-nowrap border border-slate-200"
              >
                {egy}
              </a>
            ))}
          </div>
        )}

      </div>

      {/* NO DATA EMPTY STATE */}
      {filteredEvaluations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            Tidak Ada Data Operasional untuk Periode Ini
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Tidak ditemukan unit alat berat dengan jam operasional (HM &gt; 0) pada periode <strong>{activeMonthPreset?.label || selectedMonth}</strong>.
            Silakan pilih bulan lain yang memiliki rekaman transaksi fuel.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setSelectedMonth("2026-09")}
              className="text-xs font-bold bg-[#0B2545] text-white px-4 py-2 rounded-xl shadow-xs hover:bg-[#1E3A8A] transition cursor-pointer"
            >
              Buka Periode September 2026
            </button>
          </div>
        </div>
      ) : (
        /* EVALUATION CARDS LIST ("Gambar-gambar terpisah") */
        <div className="space-y-8">
          {filteredEvaluations.map((item) => (
            <EgyEvaluationCard
              key={item.egy}
              data={item}
              periodText={formattedPeriodText}
              isExpanded={!!expandedDetails[item.egy]}
              onToggleDetails={() => toggleDetails(item.egy)}
              onDownload={() => handleDownloadCard(item.egy)}
              onCopy={() => handleCopyCard(item.egy)}
              isDownloading={downloadingId === item.egy}
              isCopied={copiedId === item.egy}
            />
          ))}
        </div>
      )}

    </div>
  );
}

/**
 * Single EGY Evaluation Card Component
 * Formatted precisely to match the user's provided specification & reference layout
 */
interface EgyEvaluationCardProps {
  key?: React.Key;
  data: EgyEvaluationData;
  periodText: string;
  isExpanded: boolean;
  onToggleDetails: () => void;
  onDownload: () => void;
  onCopy: () => void;
  isDownloading: boolean;
  isCopied: boolean;
}

function EgyEvaluationCard({
  data,
  periodText,
  isExpanded,
  onToggleDetails,
  onDownload,
  onCopy,
  isDownloading,
  isCopied
}: EgyEvaluationCardProps) {
  const cardId = `eval-card-${data.egy.replace(/\s+/g, "-")}`;

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-6 sm:p-8 space-y-6 relative overflow-hidden group">
      
      {/* Top Action Bar for each individual Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 -mt-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-widest">
            Kategori: {data.egy}
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-[11px] font-bold text-slate-400">
            {data.totalUnits} Unit Terdata
          </span>
        </div>

        {/* Action buttons: Download PNG, Copy Image, View Unit Details */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className="text-xs font-bold text-slate-650 hover:text-slate-850 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
            title="Salin gambar ke papan klip (clipboard)"
          >
            {isCopied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Salin Gambar</span>
              </>
            )}
          </button>

          <button
            onClick={onDownload}
            disabled={isDownloading}
            className="text-xs font-bold text-white bg-[#0B2545] hover:bg-[#1E3A8A] px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-50"
            title="Unduh gambar card ini dalam format PNG berkualitas tinggi"
          >
            {isDownloading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <Download className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{isDownloading ? "Mengunduh..." : "Download Gambar (PNG)"}</span>
          </button>

          <button
            onClick={onToggleDetails}
            className="text-xs font-bold text-slate-650 hover:text-slate-850 border border-slate-200 bg-white hover:bg-slate-50 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
          >
            {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{isExpanded ? "Tutup Detail Unit" : "Detail Unit"}</span>
          </button>
        </div>
      </div>

      {/* CAPTURE WRAPPER: Matches image layout exactly */}
      <div id={cardId} className="bg-white p-4 sm:p-6 rounded-2xl space-y-6">
        
        {/* HEADER OF THE EVALUATION CARD */}
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-black text-[#0B2545] tracking-tight uppercase">
            EVALUASI KONSUMSI BAHAN BAKAR (FUEL BURN)
          </h1>
          <p className="text-xs sm:text-sm font-bold text-slate-700">
            Kategori Unit: <span className="uppercase font-black text-[#0B2545]">{data.egy}</span> | Periode: {periodText}
          </p>
        </div>

        {/* 3-COLUMN DASHBOARD GRID */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
          
          {/* COLUMN 1: STATUS ARMADA (DONUT CHART) */}
          <div className="md:col-span-4 flex flex-col">
            <div className="bg-[#0B2545] text-white px-4 py-3 rounded-t-2xl flex items-center justify-center gap-2 font-black text-xs sm:text-sm tracking-wider uppercase shadow-xs">
              <Truck className="w-4 h-4 text-emerald-400" />
              <span>STATUS ARMADA</span>
            </div>
            
            <div className="bg-white border-x border-b border-slate-200 rounded-b-2xl p-5 flex-1 flex flex-col items-center justify-between shadow-2xs space-y-4">
              
              {/* DONUT CHART */}
              <div className="relative py-2 flex items-center justify-center">
                <DonutChartSvg 
                  efisienPct={data.efisienPct} 
                  overPlanPct={data.overPlanPct} 
                />
              </div>

              {/* LEGEND & COUNTERS */}
              <div className="w-full space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-around gap-2 text-center">
                  
                  {/* OVER PLAN */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#EA4335] shrink-0"></span>
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">OVER PLAN</span>
                    </div>
                    <p className="text-xs font-bold text-slate-650 mt-1">
                      <strong className="text-slate-900 font-black">{data.overPlanCount} Unit</strong>
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      ({data.overPlanPct}%)
                    </p>
                  </div>

                  {/* EFISIEN */}
                  <div className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-[#0E9F6E] shrink-0"></span>
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-tight">EFISIEN</span>
                    </div>
                    <p className="text-xs font-bold text-slate-650 mt-1">
                      <strong className="text-slate-900 font-black">{data.efisienCount} Unit</strong>
                    </p>
                    <p className="text-[11px] font-semibold text-slate-400">
                      ({data.efisienPct}%)
                    </p>
                  </div>

                </div>

                {/* TARGET PLAN NOTE */}
                <div className="text-center pt-2 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-700">
                    Target Plan: <span className="font-black text-[#0B2545]">{data.targetPlan.toFixed(2)} L/Jam</span>
                  </p>
                </div>
              </div>

            </div>
          </div>

          {/* COLUMN 2: RATA-RATA KONSUMSI & MEDIAN (Q2) WITH BELL CURVE */}
          <div className="md:col-span-4 flex flex-col gap-4">
            
            {/* Rata-Rata Konsumsi */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-[#0B2545]" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Rata-Rata Konsumsi
                </span>
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-3xl sm:text-4xl font-black text-[#0B2545] tracking-tight">
                  {data.mean.toFixed(2)}
                </span>
                <span className="text-sm sm:text-base font-extrabold text-slate-600">
                  L/Jam
                </span>
              </div>
            </div>

            {/* Median (Q2) with Bell Curve SVG */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs flex-1 flex flex-col justify-between">
              <div className="flex items-center gap-2 mb-2">
                <Fuel className="w-4 h-4 text-[#0B2545]" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Median (Q2)
                </span>
              </div>

              {/* BELL CURVE NORMAL DISTRIBUTION SVG */}
              <div className="my-auto py-1">
                <BellCurveSvg 
                  q1={data.q1} 
                  median={data.median} 
                  q3={data.q3} 
                />
              </div>

              {/* Bottom statistics subline */}
              <div className="text-[10px] text-slate-400 font-semibold text-center border-t border-slate-100 pt-2 mt-1">
                Distribusi Sebaran Konsumsi Bahan Bakar Unit
              </div>
            </div>

          </div>

          {/* COLUMN 3: TARGET EFEKTIVITAS (P25), KUARTIL 3 (Q3), RENTANG DATA */}
          <div className="md:col-span-4 flex flex-col gap-3.5">
            
            {/* Target Efektivitas (Q1 / P25) - Highlighted Green Block */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-2">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Target Efektivitas (Q1 / P25)
                </span>
              </div>
              
              {/* Vivid Green Value Banner matching user's image */}
              <div className="bg-[#0E9F6E] text-white rounded-xl py-3 px-4 flex items-baseline justify-center gap-1.5 shadow-xs">
                <span className="text-3xl sm:text-4xl font-black tracking-tight">
                  {data.q1.toFixed(2)}
                </span>
                <span className="text-base sm:text-lg font-bold">
                  L/Jam
                </span>
              </div>
            </div>

            {/* Kuartil 3 (Q3) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs">
              <div className="flex items-center gap-2 mb-1.5">
                <Fuel className="w-4 h-4 text-[#0B2545]" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Kuartil 3 (Q3)
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl sm:text-3xl font-black text-[#0B2545] tracking-tight">
                  {data.q3.toFixed(2)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-600">
                  L/Jam
                </span>
              </div>
            </div>

            {/* Rentang Data */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-2 mb-1.5">
                <Fuel className="w-4 h-4 text-[#0B2545]" />
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">
                  Rentang Data
                </span>
              </div>
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xl sm:text-2xl font-black text-[#0B2545] tracking-tight">
                  {data.min.toFixed(2)}
                </span>
                <span className="text-xs font-bold text-slate-400">
                  s/d
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0B2545] tracking-tight">
                  {data.max.toFixed(2)}
                </span>
                <span className="text-xs sm:text-sm font-bold text-slate-600">
                  L/Jam
                </span>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* EXPANDABLE UNIT BREAKDOWN TABLE */}
      {isExpanded && (
        <div className="pt-4 border-t border-slate-200 animate-fade-in space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-[#0B2545]" />
              <span>Daftar Rincian Konsumsi Unit ({data.units.length} Unit)</span>
            </h4>
            <span className="text-[11px] text-slate-400 font-semibold">
              Total Volume: {data.totalFuel.toLocaleString("id-ID")} L | Total HM: {data.totalHm.toLocaleString("id-ID")} Jam
            </span>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80 overflow-y-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#0B2545] text-white font-extrabold sticky top-0 uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">No</th>
                  <th className="py-2.5 px-3">Nomor Unit</th>
                  <th className="py-2.5 px-3">Tipe Alat</th>
                  <th className="py-2.5 px-3 text-right">Volume (L)</th>
                  <th className="py-2.5 px-3 text-right">Running (HM)</th>
                  <th className="py-2.5 px-3 text-right">Burn Rate (L/Jam)</th>
                  <th className="py-2.5 px-3 text-right">Target Plan</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {data.units.map((u, idx) => (
                  <tr key={u.idAlat} className="hover:bg-slate-50 transition">
                    <td className="py-2 px-3 text-slate-400 text-center">{idx + 1}</td>
                    <td className="py-2 px-3 font-extrabold text-slate-900">{u.idAlat}</td>
                    <td className="py-2 px-3 text-slate-500">{u.typeAlat}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{u.totalFuel.toLocaleString("id-ID")}</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">{u.totalHm.toLocaleString("id-ID")}</td>
                    <td className="py-2 px-3 text-right font-mono font-extrabold">
                      <span className={u.isEfficient ? "text-emerald-700 font-black" : "text-rose-600 font-black"}>
                        {u.burnRate.toFixed(2)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500">
                      {u.targetPlan.toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black ${
                        u.isEfficient 
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}

/**
 * Donut Chart SVG Component
 * Generates exact red and green donut proportions matching the reference visual
 */
function DonutChartSvg({ efisienPct, overPlanPct }: { efisienPct: number; overPlanPct: number }) {
  const size = 160;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  // Proportions
  const safeOverPlan = Math.max(0, Math.min(100, overPlanPct));
  const safeEfisien = Math.max(0, Math.min(100, efisienPct));

  // Stroke Dash arrays
  const overPlanStroke = (safeOverPlan / 100) * circumference;
  const efisienStroke = (safeEfisien / 100) * circumference;

  // Small tolerance gap if both are present
  const gap = safeOverPlan > 0 && safeEfisien > 0 ? 3 : 0;
  const adjustedOver = Math.max(0, overPlanStroke - gap);
  const adjustedEfisien = Math.max(0, efisienStroke - gap);

  // Offset rotation: start from top (-90 deg)
  const overOffset = 0;
  const efisienOffset = -overPlanStroke;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      {/* Background circle track */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="transparent"
        stroke="#F1F5F9"
        strokeWidth={strokeWidth}
      />
      
      {/* OVER PLAN Slice (Red) */}
      {adjustedOver > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="#EA4335"
          strokeWidth={strokeWidth}
          strokeDasharray={`${adjustedOver} ${circumference}`}
          strokeDashoffset={overOffset}
          strokeLinecap="butt"
        />
      )}

      {/* EFISIEN Slice (Green) */}
      {adjustedEfisien > 0 && (
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="transparent"
          stroke="#0E9F6E"
          strokeWidth={strokeWidth}
          strokeDasharray={`${adjustedEfisien} ${circumference}`}
          strokeDashoffset={efisienOffset}
          strokeLinecap="butt"
        />
      )}
    </svg>
  );
}

/**
 * Normal Distribution Bell Curve SVG Component
 * Accurately plots Gaussian curve with drop dashed lines for Q1, Median, and Q3
 */
function BellCurveSvg({ q1, median, q3 }: { q1: number; median: number; q3: number }) {
  // Dimensions
  const width = 280;
  const height = 120;
  const baseY = 95;
  const peakY = 20;

  // Points for Gaussian Curve
  // Center median at x = 140
  const xMedian = 140;
  const xQ1 = 100;
  const xQ3 = 180;

  // Construct a smooth bell curve SVG path
  // Standard Gaussian formula sampled across 20 points
  const points: { x: number; y: number }[] = [];
  const startX = 20;
  const endX = 260;
  const sigma = 38;

  for (let x = startX; x <= endX; x += 5) {
    const exponent = -Math.pow(x - xMedian, 2) / (2 * Math.pow(sigma, 2));
    const normalizedY = Math.exp(exponent);
    const y = baseY - normalizedY * (baseY - peakY);
    points.push({ x, y });
  }

  const pathD = points.reduce((acc, pt, i) => {
    return i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
  }, "");

  // Area under curve for subtle gradient
  const areaD = `${pathD} L ${endX} ${baseY} L ${startX} ${baseY} Z`;

  // Height at Q1, Median, Q3
  const getY = (targetX: number) => {
    const exponent = -Math.pow(targetX - xMedian, 2) / (2 * Math.pow(sigma, 2));
    return baseY - Math.exp(exponent) * (baseY - peakY);
  };

  const yQ1 = getY(xQ1);
  const yMedian = getY(xMedian);
  const yQ3 = getY(xQ3);

  return (
    <div className="w-full flex justify-center overflow-visible">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <defs>
          <linearGradient id="bellGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1E3A8A" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.00" />
          </linearGradient>
        </defs>

        {/* Shaded area under curve */}
        <path d={areaD} fill="url(#bellGradient)" />

        {/* The smooth Bell Curve stroke */}
        <path
          d={pathD}
          fill="none"
          stroke="#0B2545"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Horizontal Baseline */}
        <line
          x1={startX - 5}
          y1={baseY}
          x2={endX + 5}
          y2={baseY}
          stroke="#0B2545"
          strokeWidth="1.5"
        />

        {/* Q1 Dashed Vertical Line */}
        <line
          x1={xQ1}
          y1={yQ1}
          x2={xQ1}
          y2={baseY}
          stroke="#0B2545"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />

        {/* Median Dashed Vertical Line */}
        <line
          x1={xMedian}
          y1={yMedian}
          x2={xMedian}
          y2={baseY}
          stroke="#0B2545"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />

        {/* Q3 Dashed Vertical Line */}
        <line
          x1={xQ3}
          y1={yQ3}
          x2={xQ3}
          y2={baseY}
          stroke="#0B2545"
          strokeWidth="1.2"
          strokeDasharray="3 3"
        />

        {/* Labels below baseline: Q1, Median, Q3 */}
        {/* Q1 Labels */}
        <text x={xQ1} y={baseY + 12} textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
          Q1
        </text>
        <text x={xQ1} y={baseY + 23} textAnchor="middle" className="text-[10px] font-black fill-[#0B2545] font-sans">
          {q1.toFixed(2)}
        </text>

        {/* Median Labels */}
        <text x={xMedian} y={baseY + 12} textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
          Median
        </text>
        <text x={xMedian} y={baseY + 23} textAnchor="middle" className="text-[10px] font-black fill-[#0B2545] font-sans">
          {median.toFixed(2)}
        </text>

        {/* Q3 Labels */}
        <text x={xQ3} y={baseY + 12} textAnchor="middle" className="text-[10px] font-bold fill-slate-700 font-sans">
          Q3
        </text>
        <text x={xQ3} y={baseY + 23} textAnchor="middle" className="text-[10px] font-black fill-[#0B2545] font-sans">
          {q3.toFixed(2)}
        </text>
      </svg>
    </div>
  );
}
