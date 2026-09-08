import React, { useMemo, useEffect, useState } from "react";
import { 
  X, 
  CalendarDays, 
  Fuel, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  Info
} from "lucide-react";
import { FuelRecord, EgyPlanMap } from "../types";
import { resolvePlanForUnit } from "../lib/egyPlanService";
import { getCanonicalUnitId, deriveEgy } from "../data/sampleData";

interface UnitDailyFuelBurnModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedUnitId: string | null;
  onSelectUnit?: (idAlat: string) => void;
  records: FuelRecord[];
  startDate?: string;
  endDate?: string;
  egyPlans: EgyPlanMap;
  unitPlans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
}

/**
 * Standard utility to subtract 1 day in UTC:
 * E.g. "2026-09-02" -> "2026-09-01" (Full-to-Full accounting)
 */
export function getPreviousDayString(dateStr: string): string {
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
 * Generate an array of YYYY-MM-DD date strings between start and end
 */
function generateDateRange(startStr: string, endStr: string): string[] {
  if (!startStr || !endStr) return [];
  const dates: string[] = [];
  const current = new Date(startStr + "T00:00:00Z");
  const end = new Date(endStr + "T00:00:00Z");

  // Prevent infinite loops if dates are invalid
  if (isNaN(current.getTime()) || isNaN(end.getTime()) || current > end) {
    return [startStr];
  }

  while (current <= end) {
    const y = current.getUTCFullYear();
    const m = String(current.getUTCMonth() + 1).padStart(2, "0");
    const d = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${y}-${m}-${d}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/**
 * Formats YYYY-MM-DD to short column header (e.g. "01/08")
 */
function formatShortColDate(dateStr: string): string {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return dateStr;
}

interface DayData {
  consumptionDate: string;
  refuelDates: string[];
  totalVolume: number;
  totalHours: number;
  burnRate: number;
  isOver: boolean;
  hasOperation: boolean;
}

export default function UnitDailyFuelBurnModal({
  isOpen,
  onClose,
  selectedUnitId,
  onSelectUnit,
  records,
  startDate,
  endDate,
  egyPlans,
  unitPlans
}: UnitDailyFuelBurnModalProps) {
  const [activeUnitId, setActiveUnitId] = useState<string>(selectedUnitId || "");
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  // Sync internal activeUnitId when prop changes
  useEffect(() => {
    if (selectedUnitId) {
      setActiveUnitId(selectedUnitId);
    }
  }, [selectedUnitId]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Canonical match for target unit
  const targetCanonical = useMemo(() => {
    return getCanonicalUnitId(activeUnitId).toUpperCase();
  }, [activeUnitId]);

  // All records for this unit
  const unitRawRecords = useMemo(() => {
    if (!targetCanonical) return [];
    return records.filter(r => getCanonicalUnitId(r.idAlat).toUpperCase() === targetCanonical);
  }, [records, targetCanonical]);

  // Metadata for the active unit
  const unitMeta = useMemo(() => {
    const sampleRec = unitRawRecords[0];
    const rawType = sampleRec?.typeAlat || "";
    const rawEgy = sampleRec?.egy || deriveEgy(activeUnitId, rawType);
    const resolved = resolvePlanForUnit(activeUnitId, rawEgy, rawType, unitPlans, egyPlans);

    return {
      idAlat: activeUnitId,
      typeAlat: rawType || rawEgy,
      egy: rawEgy,
      targetPlan: resolved.planFuelBurn
    };
  }, [activeUnitId, unitRawRecords, unitPlans, egyPlans]);

  // Determine effective start and end dates
  const effectiveRange = useMemo(() => {
    let start = startDate || "";
    let end = endDate || "";

    if (!start || !end) {
      if (unitRawRecords.length > 0) {
        const sortedDates = [...unitRawRecords]
          .map(r => getPreviousDayString(r.tanggal))
          .filter(Boolean)
          .sort();
        if (sortedDates.length > 0) {
          start = start || sortedDates[0];
          end = end || sortedDates[sortedDates.length - 1];
        }
      }
    }
    return { start, end };
  }, [startDate, endDate, unitRawRecords]);

  // List of all dates across the period
  const dateRangeList = useMemo(() => {
    if (!effectiveRange.start || !effectiveRange.end) return [];
    return generateDateRange(effectiveRange.start, effectiveRange.end);
  }, [effectiveRange.start, effectiveRange.end]);

  // Aggregate daily records using H-1 consumption logic (refuel on day H = consumption on day H-1)
  const dailyDataMap = useMemo(() => {
    const map = new Map<string, DayData>();

    unitRawRecords.forEach(r => {
      if (!r.tanggal) return;
      const consumptionDate = getPreviousDayString(r.tanggal);
      const refuelDate = r.tanggal;

      if (!map.has(consumptionDate)) {
        map.set(consumptionDate, {
          consumptionDate,
          refuelDates: [refuelDate],
          totalVolume: 0,
          totalHours: 0,
          burnRate: 0,
          isOver: false,
          hasOperation: false
        });
      }

      const day = map.get(consumptionDate)!;
      if (!day.refuelDates.includes(refuelDate)) {
        day.refuelDates.push(refuelDate);
      }
      day.totalVolume += r.volumeFuel;

      if (!r.isAnomaly && r.selisihHm > 0) {
        day.totalHours += r.selisihHm;
        day.hasOperation = true;
      }
    });

    const targetPlan = unitMeta.targetPlan;
    map.forEach(item => {
      if (item.totalHours > 0) {
        item.burnRate = Number((item.totalVolume / item.totalHours).toFixed(2));
        if (targetPlan > 0) {
          item.isOver = item.burnRate > targetPlan;
        }
      }
    });

    return map;
  }, [unitRawRecords, unitMeta.targetPlan]);

  // Calculate average fuel burn across all operational days in this period
  const averageStats = useMemo(() => {
    const days = (Array.from(dailyDataMap.values()) as DayData[]).filter(d => d.hasOperation && d.totalHours > 0);
    const totalVol = days.reduce((sum, d) => sum + d.totalVolume, 0);
    const totalHm = days.reduce((sum, d) => sum + d.totalHours, 0);
    const avgRate = totalHm > 0 ? Number((totalVol / totalHm).toFixed(2)) : 0;
    const isOver = unitMeta.targetPlan > 0 && avgRate > unitMeta.targetPlan;
    const overDaysCount = days.filter(d => d.isOver).length;

    return {
      avgRate,
      isOver,
      activeDays: days.length,
      overDaysCount
    };
  }, [dailyDataMap, unitMeta.targetPlan]);

  // List of all distinct units for easy prev/next switching
  const allUnitsList = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.idAlat) set.add(r.idAlat);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [records]);

  const currentIndex = allUnitsList.indexOf(activeUnitId);
  const handlePrevUnit = () => {
    if (currentIndex > 0) {
      const prevId = allUnitsList[currentIndex - 1];
      setActiveUnitId(prevId);
      if (onSelectUnit) onSelectUnit(prevId);
    }
  };
  const handleNextUnit = () => {
    if (currentIndex < allUnitsList.length - 1) {
      const nextId = allUnitsList[currentIndex + 1];
      setActiveUnitId(nextId);
      if (onSelectUnit) onSelectUnit(nextId);
    }
  };

  if (!isOpen || !activeUnitId) return null;

  const hoveredDayData = hoveredDate ? dailyDataMap.get(hoveredDate) : null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs font-sans animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl flex flex-col overflow-hidden text-slate-800 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4682B4] flex items-center justify-center text-white shadow-inner font-mono font-bold shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-lg font-black tracking-tight text-white bg-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-700">
                  {unitMeta.idAlat}
                </span>
                <span className="text-xs bg-slate-800 text-amber-300 font-extrabold px-2.5 py-1 rounded-full border border-slate-700">
                  {unitMeta.egy}
                </span>
                {unitMeta.typeAlat && unitMeta.typeAlat !== unitMeta.egy && (
                  <span className="text-xs text-slate-300 font-sans font-medium">
                    ({unitMeta.typeAlat})
                  </span>
                )}
                <span className="text-xs font-mono font-bold bg-blue-950 text-blue-300 px-2 py-0.5 rounded border border-blue-800">
                  Target Plan: {unitMeta.targetPlan.toFixed(1)} L/Jam
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Tabel Fuel Burn Harian • Full-to-Full (Pengisian H dialokasikan untuk operasional H-1)
              </p>
            </div>
          </div>

          {/* Unit Navigation & Close */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {allUnitsList.length > 1 && (
              <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                <button
                  type="button"
                  onClick={handlePrevUnit}
                  disabled={currentIndex <= 0}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Unit sebelumnya"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono font-bold px-2 text-slate-300">
                  {currentIndex + 1}/{allUnitsList.length}
                </span>
                <button
                  type="button"
                  onClick={handleNextUnit}
                  disabled={currentIndex >= allUnitsList.length - 1}
                  className="p-1 text-slate-300 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Unit selanjutnya"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Tutup (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SUB-HEADER: Legend & Info */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#4682B4] shrink-0" />
            <span>
              Periode: <strong className="font-mono text-slate-800">{effectiveRange.start || "-"}</strong> s/d <strong className="font-mono text-slate-800">{effectiveRange.end || "-"}</strong>
            </span>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-[11px] font-medium">
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-red-600 text-white font-black text-[9px] flex items-center justify-center shadow-xs">
                !
              </span>
              <span className="font-bold text-red-700">Melebihi Plan (&gt; {unitMeta.targetPlan.toFixed(1)} L/J)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300 inline-block"></span>
              <span className="text-emerald-800 font-semibold">Sesuai / Dibawah Plan</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
              <span className="text-slate-400">Tidak Ada Data / Libur</span>
            </span>
          </div>
        </div>

        {/* 2-ROW ELONGATED HORIZONTAL TABLE CONTAINER */}
        <div className="p-5 overflow-y-auto">
          <div className="relative border border-slate-300 rounded-xl overflow-x-auto shadow-sm bg-white">
            <table className="border-collapse text-xs select-none w-full min-w-max">
              <tbody>
                
                {/* ROW 1: TANGGAL */}
                <tr className="border-b-2 border-slate-300 bg-slate-100">
                  {/* Sticky Header Label */}
                  <th className="sticky left-0 z-20 bg-slate-200 text-slate-800 font-black text-left px-3.5 py-3 border-r-2 border-slate-300 uppercase tracking-wider text-[11px] shadow-xs whitespace-nowrap min-w-[140px]">
                    Tanggal
                  </th>

                  {/* Day Date Columns */}
                  {dateRangeList.map((dateStr) => {
                    const colLabel = formatShortColDate(dateStr);
                    const isHovered = hoveredDate === dateStr;
                    return (
                      <th
                        key={dateStr}
                        onMouseEnter={() => setHoveredDate(dateStr)}
                        onMouseLeave={() => setHoveredDate(null)}
                        className={`px-2.5 py-2.5 text-center font-mono font-bold text-[11px] border-r border-slate-200 whitespace-nowrap transition-colors min-w-[54px] ${
                          isHovered ? "bg-blue-100 text-blue-900 font-black" : "text-slate-700 hover:bg-slate-200/70"
                        }`}
                        title={`Tanggal Konsumsi: ${dateStr}`}
                      >
                        {colLabel}
                      </th>
                    );
                  })}

                  {/* Rata-rata Column Header */}
                  <th className="px-3.5 py-2.5 text-center font-black font-mono text-[11px] bg-slate-200 text-slate-900 whitespace-nowrap border-l-2 border-slate-300 min-w-[75px]">
                    Rata-rata
                  </th>
                </tr>

                {/* ROW 2: NILAI FUEL BURN */}
                <tr className="bg-white">
                  {/* Sticky Metric Label */}
                  <th className="sticky left-0 z-20 bg-slate-50 text-slate-800 font-black text-left px-3.5 py-3 border-r-2 border-slate-300 uppercase tracking-wider text-[11px] shadow-xs whitespace-nowrap min-w-[140px]">
                    Fuel Burn (L/Jam)
                  </th>

                  {/* Daily Fuel Burn Rate Values */}
                  {dateRangeList.map((dateStr) => {
                    const dayData = dailyDataMap.get(dateStr);
                    const isOperating = dayData && dayData.hasOperation && dayData.totalHours > 0;
                    const burnRate = isOperating ? dayData.burnRate : null;
                    const isOverPlan = isOperating && dayData.isOver;
                    const isHovered = hoveredDate === dateStr;

                    return (
                      <td
                        key={dateStr}
                        onMouseEnter={() => setHoveredDate(dateStr)}
                        onMouseLeave={() => setHoveredDate(null)}
                        className={`px-2 py-3 text-center font-mono text-xs border-r border-slate-200 transition-all cursor-default ${
                          isHovered ? "ring-2 ring-blue-500 z-10 scale-105 shadow-md" : ""
                        } ${
                          isOverPlan
                            ? "bg-red-600 text-white font-black shadow-inner"
                            : isOperating
                            ? "bg-emerald-50 text-emerald-900 font-bold hover:bg-emerald-100"
                            : "bg-slate-50 text-slate-300 font-normal"
                        }`}
                        title={
                          isOperating
                            ? `${dateStr}: Fuel Burn ${burnRate?.toFixed(2)} L/Jam (Plan: ${unitMeta.targetPlan.toFixed(1)} L/Jam)`
                            : `${dateStr}: Tidak beroperasi`
                        }
                      >
                        {isOperating && burnRate !== null ? (
                          <span>{burnRate.toFixed(2)}</span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    );
                  })}

                  {/* Rata-rata Column Value */}
                  <td 
                    className={`px-3.5 py-3 text-center font-mono font-black text-xs border-l-2 border-slate-300 whitespace-nowrap ${
                      averageStats.isOver
                        ? "bg-red-600 text-white shadow-inner"
                        : averageStats.avgRate > 0
                        ? "bg-emerald-100 text-emerald-900"
                        : "bg-slate-100 text-slate-400"
                    }`}
                    title={`Rata-rata periode: ${averageStats.avgRate} L/Jam (Plan: ${unitMeta.targetPlan.toFixed(1)})`}
                  >
                    {averageStats.avgRate > 0 ? averageStats.avgRate.toFixed(2) : "-"}
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* DYNAMIC TOOLTIP / DETAIL STRIP ON HOVER */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[52px] flex items-center justify-between text-xs text-slate-700">
            {hoveredDayData && hoveredDayData.hasOperation && hoveredDayData.totalHours > 0 ? (
              <div className="flex items-center gap-4 flex-wrap">
                <span className="font-bold text-slate-900 font-mono">
                  📅 Tanggal Konsumsi: <span className="text-blue-700">{hoveredDayData.consumptionDate}</span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-[#4682B4]" />
                  <span>Solar: <strong>{hoveredDayData.totalVolume.toLocaleString("id-ID")} L</strong></span>
                </span>
                <span className="text-slate-300">•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600" />
                  <span>HM Kerja: <strong>{hoveredDayData.totalHours.toFixed(1)} Jam</strong></span>
                </span>
                <span className="text-slate-300">•</span>
                <span>
                  Fuel Burn:{" "}
                  <strong className={`font-mono text-sm ${hoveredDayData.isOver ? "text-red-600" : "text-emerald-700"}`}>
                    {hoveredDayData.burnRate.toFixed(2)} L/Jam
                  </strong>
                  {unitMeta.targetPlan > 0 && (
                    <span className="ml-1 text-[11px] text-slate-500 font-mono">
                      ({hoveredDayData.burnRate > unitMeta.targetPlan 
                        ? `+${(hoveredDayData.burnRate - unitMeta.targetPlan).toFixed(2)} dari Plan` 
                        : `${(hoveredDayData.burnRate - unitMeta.targetPlan).toFixed(2)} dari Plan`})
                    </span>
                  )}
                </span>
                <span className="text-slate-300">•</span>
                <span className="text-[11px] text-slate-500">
                  (Pengisian BBM: {hoveredDayData.refuelDates.join(", ")})
                </span>
              </div>
            ) : hoveredDate ? (
              <div className="text-slate-400 font-medium">
                Tanggal <strong>{hoveredDate}</strong>: Tidak ada jam operasi atau pengisian BBM tercatat.
              </div>
            ) : (
              <div className="text-slate-400 font-medium flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-slate-400" />
                <span>Arahkan kursor ke tanggal tertentu untuk melihat rincian volume solar dan jam operasi (HM).</span>
              </div>
            )}

            {/* Quick Summary Pill on the Right */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="bg-white border border-slate-200 px-2 py-1 rounded font-semibold text-slate-600">
                {averageStats.activeDays} Hari Aktif
              </span>
              <span className={`px-2 py-1 rounded font-bold ${
                averageStats.overDaysCount > 0 
                  ? "bg-red-100 text-red-700 border border-red-200" 
                  : "bg-emerald-100 text-emerald-800 border border-emerald-200"
              }`}>
                {averageStats.overDaysCount} Hari Over Plan
              </span>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-slate-100 border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Gunakan scroll horizontal pada tabel untuk melihat seluruh tanggal dalam periode.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg transition cursor-pointer shadow-2xs"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
}
