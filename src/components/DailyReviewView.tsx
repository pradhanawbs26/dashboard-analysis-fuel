import React, { useState, useMemo } from "react";
import { 
  FileSpreadsheet, 
  Calendar, 
  Filter, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  HelpCircle,
  Download,
  Flame,
  Fuel,
  Clock,
  ChevronRight,
  ArrowUpDown
} from "lucide-react";
import * as XLSX from "xlsx";
import { FuelRecord, EgyPlanMap } from "../types";
import { resolvePlanForUnit } from "../lib/egyPlanService";
import { getCanonicalUnitId, deriveEgy, cleanEgyName } from "../data/sampleData";

interface DailyReviewViewProps {
  records: FuelRecord[];
  initialStartDate?: string;
  initialEndDate?: string;
  initialEgy?: string;
  egyPlans: EgyPlanMap;
  unitPlans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
}

/**
 * Standard utility to subtract 1 day in UTC:
 * E.g. "2026-09-02" -> "2026-09-01" (Full-to-Full accounting)
 */
function getPreviousDay(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;

  const d = new Date(Date.UTC(year, month, day));
  d.setUTCDate(d.getUTCDate() - 1);

  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dt = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dt}`;
}

/**
 * Format YYYY-MM-DD to DD-Mmm (e.g. 2026-09-01 -> "01-Sep") matching uploaded screenshot
 */
function formatColHeaderDate(ymd: string): string {
  if (!ymd || !ymd.includes("-")) return ymd;
  const parts = ymd.split("-");
  if (parts.length !== 3) return ymd;
  const day = parts[2];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
  const m = months[monthIdx] || parts[1];
  return `${day}-${m}`;
}

/**
 * Generate all dates between start and end inclusive
 */
function generateDatesBetween(start: string, end: string): string[] {
  if (!start || !end) return [];
  const list: string[] = [];
  const cur = new Date(start + "T00:00:00Z");
  const stop = new Date(end + "T00:00:00Z");

  if (isNaN(cur.getTime()) || isNaN(stop.getTime()) || cur > stop) {
    return [start];
  }

  // Safety limit to max 90 days to avoid performance strain
  let count = 0;
  while (cur <= stop && count < 120) {
    const y = cur.getUTCFullYear();
    const m = String(cur.getUTCMonth() + 1).padStart(2, "0");
    const d = String(cur.getUTCDate()).padStart(2, "0");
    list.push(`${y}-${m}-${d}`);
    cur.setUTCDate(cur.getUTCDate() + 1);
    count++;
  }
  return list;
}

export interface DayAggCell {
  date: string;
  volumeFuel: number;
  selisihHm: number;
  fuelBurn: number | null; // null if no HM
  hasFuel: boolean;
  hasOperation: boolean;
  isOverPlan: boolean;
  isHmZero: boolean;
  isHmMundur: boolean;
  notes: string[];
}

export interface UnitDailySummary {
  idAlat: string;
  canonicalId: string;
  egy: string;
  typeAlat: string;
  targetPlan: number;
  dailyMap: Map<string, DayAggCell>;
  totalVolume: number;
  totalHm: number;
  avgFuelBurn: number | null;
  overPlanDaysCount: number;
  anomaliesCount: number;
}

export interface AnomalyNoteItem {
  tanggal: string;
  idAlat: string;
  egy: string;
  hmSebelum: number;
  hmSaatIni: number;
  selisihHm: number;
  volumeFuel: number;
  tipeAnomali: "HM_NOL" | "HM_MUNDUR";
  keterangan: string;
}

export default function DailyReviewView({
  records,
  initialStartDate = "",
  initialEndDate = "",
  initialEgy = "SEMUA",
  egyPlans,
  unitPlans
}: DailyReviewViewProps) {
  // Available EGYs from records
  const availableEgys = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      const e = cleanEgyName(r.egy || deriveEgy(r.idAlat, r.typeAlat));
      if (e) set.add(e);
    });
    return Array.from(set).sort();
  }, [records]);

  // Filters State
  const [selectedEgy, setSelectedEgy] = useState<string>(() => {
    if (initialEgy && initialEgy !== "SEMUA") return cleanEgyName(initialEgy);
    // Prioritize Flat Deck if available like in the user's uploaded sample
    if (availableEgys.includes("Flat Deck")) return "Flat Deck";
    return availableEgys[0] || "SEMUA";
  });

  // Determine min & max available date
  const minMaxDates = useMemo(() => {
    let min = "2026-08-01";
    let max = "2026-08-31";
    if (records.length > 0) {
      const sorted = [...records].map(r => r.tanggal).filter(Boolean).sort();
      if (sorted.length > 0) {
        min = sorted[0];
        max = sorted[sorted.length - 1];
      }
    }
    return { min, max };
  }, [records]);

  const [startDate, setStartDate] = useState<string>(() => initialStartDate || minMaxDates.min);
  const [endDate, setEndDate] = useState<string>(() => initialEndDate || minMaxDates.max);

  // Accounting Mode: H-1 (Full-to-Full) vs H (Log Date)
  const [useHMinusOne, setUseHMinusOne] = useState<boolean>(true);

  // Active view table mode: ALL, FUEL_BURN, VOLUME, HOURMETER
  const [activeViewTable, setActiveViewTable] = useState<"ALL" | "FUEL_BURN" | "VOLUME" | "HOURMETER">("ALL");

  // Active dates array
  const dateColumns = useMemo(() => {
    return generateDatesBetween(startDate, endDate);
  }, [startDate, endDate]);

  // Process data per unit across the selected dates
  const { unitSummaries, anomalyList, totalPeriodFuel, totalPeriodHm } = useMemo(() => {
    // 1. Group records by unit
    const unitMap = new Map<string, FuelRecord[]>();
    const allUnits = new Set<string>();

    records.forEach(r => {
      if (!r.idAlat) return;
      const unitEgy = cleanEgyName(r.egy || deriveEgy(r.idAlat, r.typeAlat));
      if (selectedEgy !== "SEMUA" && unitEgy !== selectedEgy) {
        return;
      }
      const canon = getCanonicalUnitId(r.idAlat).toUpperCase();
      allUnits.add(canon);
      if (!unitMap.has(canon)) {
        unitMap.set(canon, []);
      }
      unitMap.get(canon)!.push(r);
    });

    const anomalies: AnomalyNoteItem[] = [];
    const summaries: UnitDailySummary[] = [];
    let periodFuel = 0;
    let periodHm = 0;

    // 2. Compute daily matrix for each unit
    allUnits.forEach(canonId => {
      const unitRecs = unitMap.get(canonId) || [];
      const sampleRec = unitRecs[0];
      const rawId = canonId;
      const rawType = sampleRec?.typeAlat || "";
      const rawEgy = cleanEgyName(sampleRec?.egy || deriveEgy(rawId, rawType));
      const planRes = resolvePlanForUnit(rawId, rawEgy, rawType, unitPlans, egyPlans);

      const dailyMap = new Map<string, DayAggCell>();
      // Initialize map for all date columns
      dateColumns.forEach(d => {
        dailyMap.set(d, {
          date: d,
          volumeFuel: 0,
          selisihHm: 0,
          fuelBurn: null,
          hasFuel: false,
          hasOperation: false,
          isOverPlan: false,
          isHmZero: false,
          isHmMundur: false,
          notes: []
        });
      });

      // Aggregate records into corresponding date
      unitRecs.forEach(r => {
        if (!r.tanggal) return;
        // Determine the target date based on accounting mode
        const targetDate = useHMinusOne ? getPreviousDay(r.tanggal) : r.tanggal;
        
        // Only include if date falls in active range
        if (dailyMap.has(targetDate)) {
          const cell = dailyMap.get(targetDate)!;
          cell.volumeFuel += r.volumeFuel;
          cell.hasFuel = cell.volumeFuel > 0;

          // Check HM Anomaly (Nol / Mundur)
          const selisih = r.hmSaatIni - r.hmSebelum;
          if (selisih < 0) {
            cell.isHmMundur = true;
            cell.notes.push(`HM Mundur: ${r.hmSebelum} -> ${r.hmSaatIni} (${selisih.toFixed(1)} Jam)`);
            anomalies.push({
              tanggal: targetDate,
              idAlat: rawId,
              egy: rawEgy,
              hmSebelum: r.hmSebelum,
              hmSaatIni: r.hmSaatIni,
              selisihHm: selisih,
              volumeFuel: r.volumeFuel,
              tipeAnomali: "HM_MUNDUR",
              keterangan: `HM Mundur sebesar ${selisih.toFixed(1)} Jam. HM tercatat mundur dari ${r.hmSebelum} menjadi ${r.hmSaatIni}.`
            });
          } else if (selisih === 0 && r.volumeFuel > 0) {
            cell.isHmZero = true;
            cell.notes.push(`HM Nol: ${r.hmSebelum} (0 Jam, Solar: ${r.volumeFuel} L)`);
            anomalies.push({
              tanggal: targetDate,
              idAlat: rawId,
              egy: rawEgy,
              hmSebelum: r.hmSebelum,
              hmSaatIni: r.hmSaatIni,
              selisihHm: 0,
              volumeFuel: r.volumeFuel,
              tipeAnomali: "HM_NOL",
              keterangan: `HM Nol (0.0 Jam Operasi). Solar terisi ${r.volumeFuel} L tanpa adanya pergerakan HM.`
            });
          }

          // Accumulate valid HM
          if (!r.isAnomaly && r.selisihHm > 0) {
            cell.selisihHm += r.selisihHm;
            cell.hasOperation = true;
          }
        }
      });

      // Compute fuel burn and over plan for each day
      let unitTotalVol = 0;
      let unitTotalHm = 0;
      let overDays = 0;
      let unitAnomCount = 0;

      dailyMap.forEach(cell => {
        if (cell.selisihHm > 0) {
          cell.fuelBurn = Number((cell.volumeFuel / cell.selisihHm).toFixed(2));
          if (planRes.planFuelBurn > 0 && cell.fuelBurn > planRes.planFuelBurn) {
            cell.isOverPlan = true;
            overDays++;
          }
        }
        if (cell.isHmZero || cell.isHmMundur) {
          unitAnomCount++;
        }
        unitTotalVol += cell.volumeFuel;
        unitTotalHm += cell.selisihHm;
      });

      const avgFuelBurn = unitTotalHm > 0 ? Number((unitTotalVol / unitTotalHm).toFixed(2)) : null;
      periodFuel += unitTotalVol;
      periodHm += unitTotalHm;

      summaries.push({
        idAlat: rawId,
        canonicalId: canonId,
        egy: rawEgy,
        typeAlat: rawType,
        targetPlan: planRes.planFuelBurn,
        dailyMap,
        totalVolume: unitTotalVol,
        totalHm: unitTotalHm,
        avgFuelBurn,
        overPlanDaysCount: overDays,
        anomaliesCount: unitAnomCount
      });
    });

    // Sort naturally by unit id (e.g. FD23001, FD23002...)
    summaries.sort((a, b) => a.idAlat.localeCompare(b.idAlat, undefined, { numeric: true }));
    anomalies.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.idAlat.localeCompare(b.idAlat));

    return {
      unitSummaries: summaries,
      anomalyList: anomalies,
      totalPeriodFuel: periodFuel,
      totalPeriodHm: periodHm
    };
  }, [records, selectedEgy, startDate, endDate, dateColumns, useHMinusOne, unitPlans, egyPlans]);

  // Export Daily Review to Excel (Multi-Sheet: Fuel Burn, Volume Fuel, Hour Meter)
  const handleExportExcel = () => {
    if (unitSummaries.length === 0) {
      alert("Tidak ada data untuk diekspor pada filter ini.");
      return;
    }

    const wb = XLSX.utils.book_new();
    const headersDate = dateColumns.map(d => formatColHeaderDate(d));

    // SHEET 1: FUEL BURN (LITER/HOUR)
    const fuelBurnRows: any[][] = [
      ["PILIHAN EGY", selectedEgy],
      ["PERIODE", `${startDate} s/d ${endDate}`],
      ["METODE TANGGAL", useHMinusOne ? "Konsumsi H-1 (Standar Full-to-Full)" : "Tanggal Pengisian Log (H)"],
      [],
      ["FUEL BURN (LITER/HOUR)"],
      ["NOMOR UNIT", ...headersDate, "RATA-RATA (L/JAM)", "PLAN (L/JAM)", "STATUS"]
    ];

    unitSummaries.forEach(u => {
      const rowVals: any[] = [u.idAlat];
      dateColumns.forEach(d => {
        const cell = u.dailyMap.get(d);
        if (cell && cell.fuelBurn !== null) {
          rowVals.push(cell.fuelBurn);
        } else if (cell && (cell.isHmZero || cell.isHmMundur)) {
          rowVals.push("HM Anomali");
        } else {
          rowVals.push("-");
        }
      });
      rowVals.push(u.avgFuelBurn !== null ? u.avgFuelBurn : "-");
      rowVals.push(u.targetPlan > 0 ? u.targetPlan : "-");
      rowVals.push(
        u.avgFuelBurn !== null && u.targetPlan > 0 
          ? (u.avgFuelBurn > u.targetPlan ? "OVER PLAN" : "EFISIEN")
          : "-"
      );
      fuelBurnRows.push(rowVals);
    });

    const wsFuelBurn = XLSX.utils.aoa_to_sheet(fuelBurnRows);
    XLSX.utils.book_append_sheet(wb, wsFuelBurn, "Fuel Burn");

    // SHEET 2: VOLUME FUEL (LITER)
    const volumeRows: any[][] = [
      ["PILIHAN EGY", selectedEgy],
      ["PERIODE", `${startDate} s/d ${endDate}`],
      ["METODE TANGGAL", useHMinusOne ? "Konsumsi H-1 (Standar Full-to-Full)" : "Tanggal Pengisian Log (H)"],
      [],
      ["VOLUME FUEL (LITER)"],
      ["NOMOR UNIT", ...headersDate, "TOTAL VOLUME (LITER)"]
    ];

    unitSummaries.forEach(u => {
      const rowVals: any[] = [u.idAlat];
      dateColumns.forEach(d => {
        const cell = u.dailyMap.get(d);
        if (cell && cell.volumeFuel > 0) {
          rowVals.push(cell.volumeFuel);
        } else {
          rowVals.push("-");
        }
      });
      rowVals.push(u.totalVolume > 0 ? u.totalVolume : 0);
      volumeRows.push(rowVals);
    });

    const wsVolume = XLSX.utils.aoa_to_sheet(volumeRows);
    XLSX.utils.book_append_sheet(wb, wsVolume, "Volume Fuel");

    // SHEET 3: HOUR METER (HOUR)
    const hmRows: any[][] = [
      ["PILIHAN EGY", selectedEgy],
      ["PERIODE", `${startDate} s/d ${endDate}`],
      ["METODE TANGGAL", useHMinusOne ? "Konsumsi H-1 (Standar Full-to-Full)" : "Tanggal Pengisian Log (H)"],
      [],
      ["HOUR METER (HOUR)"],
      ["NOMOR UNIT", ...headersDate, "TOTAL HM (JAM)", "CATATAN ANOMALI HM"]
    ];

    unitSummaries.forEach(u => {
      const rowVals: any[] = [u.idAlat];
      const unitNotes: string[] = [];

      dateColumns.forEach(d => {
        const cell = u.dailyMap.get(d);
        if (cell) {
          if (cell.isHmMundur) {
            rowVals.push(`${cell.selisihHm} (MUNDUR)`);
            unitNotes.push(`${formatColHeaderDate(d)}: HM Mundur`);
          } else if (cell.isHmZero && cell.volumeFuel > 0) {
            rowVals.push("0.0 (NOL)");
            unitNotes.push(`${formatColHeaderDate(d)}: HM 0`);
          } else if (cell.selisihHm > 0) {
            rowVals.push(cell.selisihHm);
          } else {
            rowVals.push("-");
          }
        } else {
          rowVals.push("-");
        }
      });

      rowVals.push(u.totalHm > 0 ? Number(u.totalHm.toFixed(1)) : 0);
      rowVals.push(unitNotes.length > 0 ? unitNotes.join("; ") : "Normal");
      hmRows.push(rowVals);
    });

    // Add Anomaly Footnotes in Sheet 3
    if (anomalyList.length > 0) {
      hmRows.push([]);
      hmRows.push(["DAFTAR CATATAN KHUSUS ANOMALI HOUR METER (HM NOL / MUNDUR):"]);
      hmRows.push(["Tanggal", "Nomor Unit", "Egy Alat", "HM Sebelum", "HM Saat Ini", "Selisih HM", "Volume Solar (L)", "Keterangan"]);
      anomalyList.forEach(an => {
        hmRows.push([
          an.tanggal,
          an.idAlat,
          an.egy,
          an.hmSebelum,
          an.hmSaatIni,
          an.selisihHm,
          an.volumeFuel,
          an.keterangan
        ]);
      });
    }

    const wsHm = XLSX.utils.aoa_to_sheet(hmRows);
    XLSX.utils.book_append_sheet(wb, wsHm, "Hour Meter");

    // Write multi-sheet excel file
    const cleanEgyFile = (selectedEgy || "ALL").replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `Daily_Review_Fuel_${cleanEgyFile}_${startDate}_sd_${endDate}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  return (
    <div className="space-y-6 font-sans">

      {/* TOP CONTROL PANEL & FILTER BAR */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* PILIHAN EGY & PERIODE WAKTU */}
          <div className="flex flex-wrap items-center gap-4">
            
            {/* PILIHAN EGY (Yellow badge style matching user's uploaded spreadsheet) */}
            <div className="flex flex-col">
              <label className="text-[11px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-1">
                <span className="bg-[#FFFF00] text-slate-950 px-2 py-0.5 rounded font-black border border-amber-400 text-xs shadow-2xs">
                  PILIHAN EGY
                </span>
              </label>
              <select
                value={selectedEgy}
                onChange={(e) => setSelectedEgy(e.target.value)}
                className="text-xs font-bold border border-slate-300 rounded-lg px-3 py-2 bg-slate-50 focus:border-[#4682B4] focus:outline-none cursor-pointer shadow-2xs min-w-[180px]"
              >
                <option value="SEMUA">Semua EGY Alat</option>
                {availableEgys.map((egy) => (
                  <option key={egy} value={egy}>
                    {egy}
                  </option>
                ))}
              </select>
            </div>

            {/* PERIODE WAKTU (DARI TANGGAL - SAMPAI TANGGAL) */}
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                <Calendar className="w-3.5 h-3.5 text-[#4682B4]" />
                <span>PERIODE WAKTU (TANGGAL)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-mono font-medium focus:border-[#4682B4] focus:outline-none"
                />
                <span className="text-xs text-slate-400 font-bold">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-slate-50 font-mono font-medium focus:border-[#4682B4] focus:outline-none"
                />
              </div>
            </div>

            {/* METODE PERHITUNGAN TANGGAL: FULL-TO-FULL (H-1) VS LOG DATE */}
            <div className="flex flex-col justify-end">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <span>METODE TANGGAL</span>
                <span 
                  title="Standar Tambang Full-to-Full: Pengisian solar di tgl 2 September merupakan konsumsi bahan bakar pada operasional tgl 1 September (H-1)."
                  className="cursor-help"
                >
                  <HelpCircle className="w-3 h-3 text-slate-400" />
                </span>
              </label>
              <button
                type="button"
                onClick={() => setUseHMinusOne(!useHMinusOne)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-bold flex items-center gap-1.5 transition cursor-pointer shadow-2xs ${
                  useHMinusOne
                    ? "bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100"
                    : "bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200"
                }`}
                title="Klik untuk beralih antara Tanggal Konsumsi H-1 (Full-to-Full) dan Tanggal Pengisian Asli"
              >
                <span className="w-2 h-2 rounded-full bg-[#4682B4]"></span>
                <span>{useHMinusOne ? "Konsumsi H-1 (Full-to-Full)" : "Tanggal Log Asli (H)"}</span>
              </button>
            </div>

          </div>

          {/* EXCEL EXPORT BUTTON (MULTI-SHEET) */}
          <div className="flex items-center gap-2 self-end lg:self-center">
            <button
              type="button"
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
              title="Unduh tabel data Fuel Burn, Volume Fuel, dan Hour Meter dalam satu file Excel (.xlsx) dengan 3 sheet terpisah"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
              <span>Ekspor Excel (Multi-Sheet)</span>
              <Download className="w-3.5 h-3.5 text-emerald-200" />
            </button>
          </div>

        </div>

        {/* Quick Info & Anomaly Counter Bar */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Menampilkan: <strong className="text-slate-900 font-bold">{unitSummaries.length} unit</strong> ({selectedEgy === "SEMUA" ? "Semua Egy" : selectedEgy})
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Total Hari: <strong className="text-slate-900 font-mono font-bold">{dateColumns.length} tanggal</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Total Solar: <strong className="text-slate-900 font-mono font-bold">{totalPeriodFuel.toLocaleString("id-ID")} L</strong>
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Total Jam: <strong className="text-slate-900 font-mono font-bold">{totalPeriodHm.toFixed(1)} HM</strong>
            </span>
          </div>

          {/* Anomaly Badge */}
          {anomalyList.length > 0 ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1 rounded-lg">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>Ditemukan {anomalyList.length} catatan HM Nol atau Mundur</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-lg">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Semua Hourmeter Normal (Tidak ada HM nol / mundur)</span>
            </div>
          )}
        </div>

      </div>

      {/* QUICK HEADER MENU TABS FOR DAILY REVIEW */}
      <div id="daily-table-selector" className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => setActiveViewTable("ALL")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeViewTable === "ALL"
                ? "bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            <span>Semua Tabel</span>
            <span className="text-[10px] bg-slate-700/60 text-slate-200 px-1.5 py-0.5 rounded font-mono font-bold">
              3
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTable("FUEL_BURN")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeViewTable === "FUEL_BURN"
                ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30"
                : "bg-amber-50 text-amber-900 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-amber-500" />
            <span>Daily Fuel Burn</span>
            <span className="text-[10px] opacity-80 font-mono">(L/Jam)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTable("VOLUME")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeViewTable === "VOLUME"
                ? "bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/30"
                : "bg-blue-50 text-blue-900 hover:bg-blue-100 border border-blue-200"
            }`}
          >
            <Fuel className="w-3.5 h-3.5 text-blue-500" />
            <span>Daily Volume Fuel</span>
            <span className="text-[10px] opacity-80 font-mono">(Liter)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTable("HOURMETER")}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
              activeViewTable === "HOURMETER"
                ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30"
                : "bg-indigo-50 text-indigo-900 hover:bg-indigo-100 border border-indigo-200"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-indigo-500" />
            <span>Daily Hourmeter</span>
            <span className="text-[10px] opacity-80 font-mono">(Jam)</span>
            {anomalyList.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400 text-slate-950">
                {anomalyList.length} Catatan
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-500 font-semibold px-1">
          {activeViewTable === "ALL" && "Menampilkan seluruh tabel: Fuel Burn, Volume Fuel, & Hourmeter"}
          {activeViewTable === "FUEL_BURN" && "Tabel Evaluasi Daily Fuel Burn (Liter/Jam)"}
          {activeViewTable === "VOLUME" && "Tabel Agregasi Daily Volume Pengisian Solar (Liter)"}
          {activeViewTable === "HOURMETER" && "Tabel Catatan Daily Hourmeter & Anomali Operasi (Jam)"}
        </div>
      </div>

      {unitSummaries.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-xs space-y-3">
          <Info className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Data Ditemukan</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tidak ada unit atau catatan bahan bakar untuk kategori EGY <strong>"{selectedEgy}"</strong> pada rentang tanggal terpilih. Silakan ubah filter EGY atau periode waktu di atas.
          </p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ========================================================================= */}
          {/* TABEL 1: FUEL BURN (LITER/HOUR) */}
          {/* ========================================================================= */}
          {(activeViewTable === "ALL" || activeViewTable === "FUEL_BURN") && (
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-400/30">
                  <Flame className="w-4 h-4 text-amber-400" />
                </div>
                <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                  <span>DAILY FUEL BURN (LITER/HOUR)</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-mono font-bold border border-amber-400/30">
                    L/JAM
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-red-600 inline-block"></span>
                  <span className="text-slate-300 text-[11px]">Over Plan (&gt; Plan)</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600 inline-block"></span>
                  <span className="text-slate-300 text-[11px]">Sesuai Plan</span>
                </span>
              </div>
            </div>

            {/* Horizontal Scroll Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-800">
                    <th className="sticky left-0 z-20 bg-slate-200 px-3.5 py-2.5 border-r-2 border-slate-300 min-w-[120px] shadow-xs uppercase tracking-wider text-[11px]">
                      NOMOR UNIT
                    </th>
                    {dateColumns.map(d => (
                      <th 
                        key={d} 
                        className="px-2.5 py-2.5 text-center font-mono font-bold text-[11px] border-r border-slate-200 min-w-[62px] whitespace-nowrap"
                        title={d}
                      >
                        {formatColHeaderDate(d)}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-center font-mono font-black text-[11px] bg-slate-200 text-slate-900 border-l-2 border-slate-300 min-w-[85px]">
                      RATA-RATA
                    </th>
                    <th className="px-3 py-2.5 text-center font-mono font-black text-[11px] bg-slate-100 text-slate-700 border-l border-slate-200 min-w-[80px]">
                      PLAN
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {unitSummaries.map((u) => {
                    const isOverAverage = u.avgFuelBurn !== null && u.targetPlan > 0 && u.avgFuelBurn > u.targetPlan;
                    return (
                      <tr key={u.canonicalId} className="hover:bg-slate-50/80 transition-colors">
                        {/* Sticky Unit ID Column */}
                        <td className="sticky left-0 z-10 bg-slate-50 px-3.5 py-2 font-bold text-slate-900 border-r-2 border-slate-300 shadow-2xs whitespace-nowrap">
                          <span>{u.idAlat}</span>
                        </td>

                        {/* Date Columns */}
                        {dateColumns.map(d => {
                          const cell = u.dailyMap.get(d);
                          const hasBurn = cell && cell.fuelBurn !== null;
                          const isOver = cell?.isOverPlan;
                          const hasAnomaly = cell && (cell.isHmZero || cell.isHmMundur);

                          return (
                            <td
                              key={d}
                              className={`px-2 py-2 text-center text-[11px] border-r border-slate-200 transition-colors ${
                                isOver
                                  ? "bg-red-600 text-white font-black shadow-inner"
                                  : hasAnomaly
                                  ? "bg-amber-100 text-amber-900 font-bold"
                                  : hasBurn
                                  ? "text-slate-800 font-bold bg-emerald-50/40"
                                  : "text-slate-300 font-normal"
                              }`}
                              title={
                                hasBurn
                                  ? `${u.idAlat} (${d}): Fuel Burn ${cell.fuelBurn} L/Jam (Plan: ${u.targetPlan})`
                                  : hasAnomaly
                                  ? cell.notes.join(" | ")
                                  : "Tidak beroperasi"
                              }
                            >
                              {hasBurn ? (
                                cell.fuelBurn?.toFixed(2)
                              ) : hasAnomaly ? (
                                <span className="text-[10px] text-amber-700 font-black">HM ⚠️</span>
                              ) : (
                                "-"
                              )}
                            </td>
                          );
                        })}

                        {/* Rata-rata Column */}
                        <td className={`px-3 py-2 text-center font-black text-xs border-l-2 border-slate-300 ${
                          isOverAverage
                            ? "bg-red-600 text-white font-black"
                            : u.avgFuelBurn !== null
                            ? "bg-emerald-100 text-emerald-900"
                            : "text-slate-400"
                        }`}>
                          {u.avgFuelBurn !== null ? u.avgFuelBurn.toFixed(2) : "-"}
                        </td>

                        {/* Target Plan Column */}
                        <td className="px-3 py-2 text-center font-bold text-xs text-slate-600 border-l border-slate-200 bg-slate-50">
                          {u.targetPlan > 0 ? u.targetPlan.toFixed(1) : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          )}


          {/* ========================================================================= */}
          {/* TABEL 2: VOLUME FUEL (LITER) */}
          {/* ========================================================================= */}
          {(activeViewTable === "ALL" || activeViewTable === "VOLUME") && (
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-500/20 flex items-center justify-center border border-blue-400/30">
                  <Fuel className="w-4 h-4 text-blue-400" />
                </div>
                <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                  <span>DAILY VOLUME FUEL (LITER)</span>
                  <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono font-bold border border-blue-400/30">
                    LITER
                  </span>
                </h3>
              </div>
              <div className="text-xs text-slate-300 bg-slate-800/90 px-3 py-1 rounded-lg border border-slate-700">
                Total Periode: <strong className="text-white font-mono">{totalPeriodFuel.toLocaleString("id-ID")} Liter</strong>
              </div>
            </div>

            {/* Horizontal Scroll Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-800">
                    <th className="sticky left-0 z-20 bg-slate-200 px-3.5 py-2.5 border-r-2 border-slate-300 min-w-[120px] shadow-xs uppercase tracking-wider text-[11px]">
                      NOMOR UNIT
                    </th>
                    {dateColumns.map(d => (
                      <th 
                        key={d} 
                        className="px-2.5 py-2.5 text-center font-mono font-bold text-[11px] border-r border-slate-200 min-w-[62px] whitespace-nowrap"
                        title={d}
                      >
                        {formatColHeaderDate(d)}
                      </th>
                    ))}
                    <th className="px-3.5 py-2.5 text-center font-mono font-black text-[11px] bg-slate-200 text-slate-900 border-l-2 border-slate-300 min-w-[100px]">
                      TOTAL (LITER)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {unitSummaries.map((u) => (
                    <tr key={u.canonicalId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Unit ID Column */}
                      <td className="sticky left-0 z-10 bg-slate-50 px-3.5 py-2 font-bold text-slate-900 border-r-2 border-slate-300 shadow-2xs whitespace-nowrap">
                        <span>{u.idAlat}</span>
                      </td>

                      {/* Date Columns */}
                      {dateColumns.map(d => {
                        const cell = u.dailyMap.get(d);
                        const vol = cell?.volumeFuel || 0;

                        return (
                          <td
                            key={d}
                            className={`px-2 py-2 text-center text-[11px] border-r border-slate-200 ${
                              vol > 0 ? "text-slate-800 font-bold bg-blue-50/30" : "text-slate-300 font-normal"
                            }`}
                            title={vol > 0 ? `${u.idAlat} (${d}): ${vol.toLocaleString("id-ID")} Liter` : "-"}
                          >
                            {vol > 0 ? vol.toLocaleString("id-ID") : "-"}
                          </td>
                        );
                      })}

                      {/* Total Volume Column */}
                      <td className="px-3.5 py-2 text-center font-black text-xs text-blue-900 bg-blue-50/70 border-l-2 border-slate-300">
                        {u.totalVolume > 0 ? u.totalVolume.toLocaleString("id-ID") : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}


          {/* ========================================================================= */}
          {/* TABEL 3: HOUR METER (HOUR) */}
          {/* ========================================================================= */}
          {(activeViewTable === "ALL" || activeViewTable === "HOURMETER") && (
          <div className="bg-white rounded-2xl border border-slate-300 shadow-sm overflow-hidden">
            {/* Header Section */}
            <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-400/30">
                  <Clock className="w-4 h-4 text-indigo-400" />
                </div>
                <h3 className="text-sm font-black tracking-wider uppercase text-white flex items-center gap-2">
                  <span>DAILY HOURMETER (HOUR)</span>
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono font-bold border border-indigo-400/30">
                    JAM
                  </span>
                </h3>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1.5 bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs">
                  <span className="w-3 h-3 rounded bg-amber-500 inline-block shadow-xs"></span>
                  <span className="text-amber-200 text-[11px] font-bold">HM Nol / Mundur (Catatan)</span>
                </span>
                <span className="text-slate-300 text-xs font-mono bg-slate-800/90 px-2.5 py-1 rounded-lg border border-slate-700 shadow-2xs">
                  Total HM: <strong className="text-white font-bold">{totalPeriodHm.toFixed(1)} Jam</strong>
                </span>
              </div>
            </div>

            {/* Horizontal Scroll Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 border-b-2 border-slate-300 font-black text-slate-800">
                    <th className="sticky left-0 z-20 bg-slate-200 px-3.5 py-2.5 border-r-2 border-slate-300 min-w-[120px] shadow-xs uppercase tracking-wider text-[11px]">
                      NOMOR UNIT
                    </th>
                    {dateColumns.map(d => (
                      <th 
                        key={d} 
                        className="px-2.5 py-2.5 text-center font-mono font-bold text-[11px] border-r border-slate-200 min-w-[62px] whitespace-nowrap"
                        title={d}
                      >
                        {formatColHeaderDate(d)}
                      </th>
                    ))}
                    <th className="px-3.5 py-2.5 text-center font-mono font-black text-[11px] bg-slate-200 text-slate-900 border-l-2 border-slate-300 min-w-[95px]">
                      TOTAL HM
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono">
                  {unitSummaries.map((u) => (
                    <tr key={u.canonicalId} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Unit ID Column */}
                      <td className="sticky left-0 z-10 bg-slate-50 px-3.5 py-2 font-bold text-slate-900 border-r-2 border-slate-300 shadow-2xs whitespace-nowrap">
                        <span>{u.idAlat}</span>
                      </td>

                      {/* Date Columns */}
                      {dateColumns.map(d => {
                        const cell = u.dailyMap.get(d);
                        const hm = cell?.selisihHm || 0;
                        const isMundur = cell?.isHmMundur;
                        const isZero = cell?.isHmZero;

                        return (
                          <td
                            key={d}
                            className={`px-2 py-2 text-center text-[11px] border-r border-slate-200 ${
                              isMundur
                                ? "bg-red-700 text-white font-black shadow-inner"
                                : isZero
                                ? "bg-amber-400 text-slate-950 font-black"
                                : hm > 0
                                ? "text-slate-800 font-bold bg-indigo-50/30"
                                : "text-slate-300 font-normal"
                            }`}
                            title={
                              isMundur
                                ? `Catatan: ${cell?.notes.join(" | ")}`
                                : isZero
                                ? `Catatan: ${cell?.notes.join(" | ")}`
                                : hm > 0
                                ? `${u.idAlat} (${d}): ${hm.toFixed(1)} Jam Kerja`
                                : "Tidak beroperasi"
                            }
                          >
                            {isMundur ? (
                              <span className="flex items-center justify-center gap-0.5">
                                <span>{cell?.selisihHm.toFixed(1)}</span>
                                <span className="text-[10px]">⚠️</span>
                              </span>
                            ) : isZero ? (
                              <span className="flex items-center justify-center gap-0.5">
                                <span>0.0</span>
                                <span className="text-[10px]">⚠️</span>
                              </span>
                            ) : hm > 0 ? (
                              hm.toFixed(1)
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}

                      {/* Total HM Column */}
                      <td className="px-3.5 py-2 text-center font-black text-xs text-indigo-950 bg-indigo-50/70 border-l-2 border-slate-300">
                        {u.totalHm > 0 ? u.totalHm.toFixed(1) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          )}


          {/* ========================================================================= */}
          {/* DAFTAR CATATAN KHUSUS ANOMALI HOUR METER (NOL ATAU MUNDUR) */}
          {/* ========================================================================= */}
          {(activeViewTable === "ALL" || activeViewTable === "HOURMETER") && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${anomalyList.length > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    Catatan Anomali Hour Meter (Nol / Mundur)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Daftar tanggal dan nomor unit dengan jam operasi (HM) bernilai 0 atau bergerak mundur saat pengisian solar
                  </p>
                </div>
              </div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                anomalyList.length > 0 ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"
              }`}>
                {anomalyList.length} Temuan
              </span>
            </div>

            {anomalyList.length === 0 ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>Bagus Sekali!</strong> Tidak ditemukan catatan Hourmeter Nol ataupun Mundur pada kategori unit <strong>{selectedEgy}</strong> dalam periode tanggal terpilih.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">Tanggal</th>
                      <th className="py-2.5 px-3">Nomor Unit</th>
                      <th className="py-2.5 px-3">Egy Alat</th>
                      <th className="py-2.5 px-3 font-mono">HM Awal</th>
                      <th className="py-2.5 px-3 font-mono">HM Akhir</th>
                      <th className="py-2.5 px-3 font-mono">Selisih HM</th>
                      <th className="py-2.5 px-3 font-mono">Volume Solar</th>
                      <th className="py-2.5 px-3">Tipe Anomali</th>
                      <th className="py-2.5 px-3">Keterangan / Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {anomalyList.map((an, idx) => (
                      <tr key={idx} className="hover:bg-amber-50/40 transition">
                        <td className="py-2 px-3 font-mono font-bold text-slate-800">{an.tanggal}</td>
                        <td className="py-2 px-3 font-mono font-black text-slate-900 bg-slate-50">{an.idAlat}</td>
                        <td className="py-2 px-3 font-medium text-slate-600">{an.egy}</td>
                        <td className="py-2 px-3 font-mono">{an.hmSebelum}</td>
                        <td className="py-2 px-3 font-mono">{an.hmSaatIni}</td>
                        <td className="py-2 px-3 font-mono font-black text-rose-700">
                          {an.selisihHm} Jam
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-blue-700">
                          {an.volumeFuel.toLocaleString("id-ID")} L
                        </td>
                        <td className="py-2 px-3">
                          {an.tipeAnomali === "HM_MUNDUR" ? (
                            <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold text-[10px] border border-rose-200">
                              HM MUNDUR
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                              HM NOL (0 Jam)
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">
                          {an.keterangan}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          )}

        </div>
      )}

    </div>
  );
}
