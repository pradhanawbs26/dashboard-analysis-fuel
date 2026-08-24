import React, { useState, useMemo } from "react";
import { Fuel, TrendingUp, AlertTriangle, Info, BarChart2 } from "lucide-react";
import { FuelRecord, ParetoUnitItem, EgyPlanMap } from "../types";
import { resolvePlanForUnit } from "../lib/egyPlanService";

interface ParetoChartProps {
  records: FuelRecord[];
  selectedEgy?: string;
  selectedType?: string; // backwards compatibility
  plans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
  egyPlans?: EgyPlanMap;
  onViewAnomalies?: () => void;
  anomalyCount?: number;
}

export default function ParetoChart({ records, selectedEgy, selectedType = "SEMUA", plans = {}, egyPlans = {}, onViewAnomalies, anomalyCount }: ParetoChartProps) {
  const [hoveredUnit, setHoveredUnit] = useState<string | null>(null);
  const activeEgyFilter = selectedEgy || selectedType;

  // Group records by Unit ID (Id Alat) and filter by selected Egy Alat if chosen
  const paretoData: ParetoUnitItem[] = useMemo(() => {
    // 1. Filter records of valid run hours (strictly exclude rental units with HM <= 0)
    const filtered = records.filter(r => {
      const egyMatch = !activeEgyFilter || activeEgyFilter === "SEMUA" || r.egy === activeEgyFilter || r.typeAlat === activeEgyFilter;
      return egyMatch && !r.isAnomaly && r.selisihHm > 0;
    });

    // 2. Aggregate counts, hours, volumes per unit ID
    const aggregates: { [key: string]: { 
      idAlat: string; 
      egy: string;
      typeAlat: string;
      totalVolume: number; 
      totalHours: number; 
      recordsCount: number;
    }} = {};

    filtered.forEach(r => {
      if (!aggregates[r.idAlat]) {
        aggregates[r.idAlat] = {
          idAlat: r.idAlat,
          egy: r.egy || (plans && plans[r.idAlat.toUpperCase()]?.egy) || r.typeAlat,
          typeAlat: r.typeAlat,
          totalVolume: 0,
          totalHours: 0,
          recordsCount: 0
        };
      }
      aggregates[r.idAlat].totalVolume += r.volumeFuel;
      aggregates[r.idAlat].totalHours += r.selisihHm;
      aggregates[r.idAlat].recordsCount += 1;
    });

    // 3. Convert to list and calculate Average Fuel Burn (only operational units)
    const unitList = Object.values(aggregates)
      .filter(item => item.totalHours > 0)
      .map(item => {
        const averageFuelBurn = item.totalHours > 0 
          ? Number((item.totalVolume / item.totalHours).toFixed(2)) 
          : 0;

        return {
          idAlat: item.idAlat,
          egy: item.egy,
          typeAlat: item.typeAlat,
          totalVolume: Number(item.totalVolume.toFixed(1)),
          averageFuelBurn,
          runningHours: Number(item.totalHours.toFixed(1)),
          recordCount: item.recordsCount,
          cumulativePercent: 0,
          isAnomaly: false
        };
      });

    // 4. Sort from Highest Fuel Burn Rate to Lowest
    unitList.sort((a, b) => b.averageFuelBurn - a.averageFuelBurn);

    // 5. Calculate cumulative percentages based on overall fuel burn rates or total volume
    const sumAllVolumes = unitList.reduce((acc, u) => acc + u.totalVolume, 0);
    
    let runningVolumeSum = 0;
    const finalData = unitList.map(u => {
      runningVolumeSum += u.totalVolume;
      const cumulativePercent = sumAllVolumes > 0 
        ? Number(((runningVolumeSum / sumAllVolumes) * 100).toFixed(1)) 
        : 0;
      
      return {
        ...u,
        cumulativePercent
      };
    });

    return finalData;
  }, [records, activeEgyFilter, plans, egyPlans]);

  // Determine standard threshold for warnings (e.g., averages above 15% of the average of the selected type)
  const categoryAverage = useMemo(() => {
    if (paretoData.length === 0) return 0;
    const sum = paretoData.reduce((acc, curr) => acc + curr.averageFuelBurn, 0);
    return Number((sum / paretoData.length).toFixed(2));
  }, [paretoData]);

  const maxBurnRate = useMemo(() => {
    if (paretoData.length === 0) return 100;
    return Math.max(...paretoData.map(u => u.averageFuelBurn), 40);
  }, [paretoData]);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-5 h-5 text-slate-700" />
            <h3 className="text-lg font-bold text-slate-800">
              Grafik Fue Burn Per Unit
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Menampilkan ID Alat diurutkan dari pemakaian tertinggi (kiri) ke terendah (kanan). {activeEgyFilter !== "SEMUA" && `Egy khusus: ${activeEgyFilter}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {onViewAnomalies && (
            <button
              onClick={onViewAnomalies}
              className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 shadow-xs transition cursor-pointer"
              title="Periksa baris anomali teknis yang disaring dari grafik"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Cek Anomali ({(anomalyCount !== undefined && anomalyCount !== null) ? anomalyCount : 0})</span>
            </button>
          )}

          <div className="flex items-center gap-4 text-xs bg-slate-100 py-1.5 px-3 rounded-lg border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4682B4] block"></span>
              <span className="text-slate-600 font-bold">Fuel Burn Normal (L/Jam)</span>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-2.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 block"></span>
              <span className="text-slate-600 font-bold">Potensi Boros (Terboros)</span>
            </div>
          </div>
        </div>
      </div>

      {paretoData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 bg-slate-50 rounded-lg">
          <Info className="w-8 h-8 opacity-60 mb-2 text-slate-400" />
          <p className="text-sm font-medium">Tidak ada data untuk filter jenis kategori ini.</p>
          <p className="text-xs mt-1">Ganti filter tanggal atau tambah data transaksimu.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Scrollable Container with Sticky Y-Axis */}
          <div className="relative w-full h-80 bg-slate-50/50 p-4 rounded-lg border border-slate-100 flex overflow-hidden">
            {/* Sticky Y-Axis Labels */}
            <div className="w-14 h-full flex flex-col justify-between text-right pr-2 font-mono text-[10px] text-slate-400 select-none pb-8 pt-3 border-r border-slate-200/40 shrink-0">
              {[100, 75, 50, 25, 0].map((percent) => (
                <span key={percent}>
                  {Math.round((maxBurnRate * percent) / 100)} L/J
                </span>
              ))}
            </div>

            {/* Horizontal Scrollable Area */}
            <div className="flex-1 h-full overflow-x-auto pl-4 pb-2">
              <div 
                className="h-full relative flex items-end pb-8 pt-3"
                style={{ minWidth: paretoData.length > 12 ? `${paretoData.length * 52}px` : "100%" }}
              >
                {/* Horizontal Grid Lines */}
                <div className="absolute inset-x-0 top-3 bottom-0 flex flex-col justify-between pointer-events-none pb-8">
                  {[0, 25, 50, 75, 100].map((percent) => (
                    <div key={percent} className="w-full border-t border-dashed border-slate-200" />
                  ))}
                </div>

                {/* Vertical Bars */}
                <div className="absolute inset-x-0 top-3 bottom-0 flex justify-around items-end pb-8">
                  {paretoData.map((unit, index) => {
                    const barHeightPct = (unit.averageFuelBurn / maxBurnRate) * 100;
                    
                    // Check if this unit is abnormally high relative to standard average
                    const isOutlier = unit.averageFuelBurn > categoryAverage * 1.35;

                    return (
                      <div
                        key={unit.idAlat}
                        className="group relative flex flex-col items-center justify-end h-full flex-1 mx-1.5"
                        style={{ maxWidth: "60px", minWidth: "24px" }}
                        onMouseEnter={() => setHoveredUnit(unit.idAlat)}
                        onMouseLeave={() => setHoveredUnit(null)}
                      >
                        {/* Fuel Burn Bar */}
                        <div
                          className={`w-full rounded-t transition-all duration-300 relative ${
                            isOutlier 
                              ? "bg-rose-500/90 group-hover:bg-rose-600/100 shadow-md shadow-rose-200/50" 
                              : "bg-[#4682B4] group-hover:bg-[#36648B] shadow-sm"
                          }`}
                          style={{ height: `${Math.max(barHeightPct, 2)}%` }}
                        >
                          {/* Bar Value Tooltip */}
                          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] font-semibold px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
                            {unit.averageFuelBurn} L/J
                          </div>
                        </div>

                        {/* Unit ID Label */}
                        <div className="absolute -bottom-6 w-full text-center truncate px-0.5">
                          <span className="text-[10px] font-bold text-slate-600 font-mono" title={unit.idAlat}>
                            {unit.idAlat.replace(/(EXC|DT|BULL|GRAD|LOAD)-/, "")}
                          </span>
                        </div>

                        {/* Detailed Full Hover Cards */}
                        {hoveredUnit === unit.idAlat && (() => {
                          const resolved = resolvePlanForUnit(unit.idAlat, unit.egy, unit.typeAlat, plans, egyPlans);
                          const plValue = resolved.planFuelBurn;
                          const devia = plValue > 0 ? unit.averageFuelBurn - plValue : 0;
                          return (
                            <div className="absolute bottom-full mb-10 -left-12 sm:left-auto sm:right-auto bg-slate-900 border border-slate-750 p-3 rounded-lg shadow-2xl text-white text-xs w-52 z-40 space-y-1.5 pointer-events-none">
                              <div className="flex items-center justify-between border-b border-slate-700/60 pb-1 gap-1">
                                <span className="font-mono font-bold text-blue-200">{unit.idAlat}</span>
                                <span className="text-[9px] bg-emerald-900/80 text-emerald-300 font-mono px-1.5 py-0.5 rounded truncate font-bold">{unit.egy}</span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Parameter Egy:</span>
                                  <span className="font-bold text-emerald-300 font-mono text-[11px] truncate max-w-[110px]">{unit.egy}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Avg Fuel Burn:</span>
                                  <span className="font-bold text-amber-300 font-mono">{unit.averageFuelBurn} L/Jam</span>
                                </div>
                                {plValue > 0 && (
                                  <>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Target Plan:</span>
                                      <span className="font-bold text-slate-300 font-mono">{plValue.toFixed(1)} L/Jam</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Deviasi Plan:</span>
                                      <span className={`font-bold font-mono ${devia > 0.01 ? "text-rose-400" : "text-emerald-400"}`}>
                                        {devia > 0.01 ? `+${devia.toFixed(2)}` : devia.toFixed(2)} L/J
                                      </span>
                                    </div>
                                  </>
                                )}
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Total Fuel:</span>
                                  <span className="font-bold font-mono">{unit.totalVolume.toLocaleString("id-ID")} L</span>
                                </div>
                              </div>
                              {isOutlier && (
                                <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-[9px] px-1.5 py-0.5 rounded mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Batas Rerata Terlewati!</span>
                                </div>
                              )}
                              {plValue > 0 && devia > 0.01 && (
                                <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-[9px] px-1.5 py-0.5 rounded mt-1 flex items-center gap-1">
                                  <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                  <span>Over Plan (+{((devia/plValue)*100).toFixed(0)}%)!</span>
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="h-4"></div>

          {/* Table representation for analytical transparency */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-700">Analisa Fuel Burn per Unit</h4>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-100">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2.5 px-3 text-slate-500 font-bold">Peringkat</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold">Nomor Unit (ID Alat)</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold">Egy Alat (Kolom C)</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-right font-mono">Fuel Burn (Avg)</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-right font-mono pr-4">Target Plan</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-right font-mono pr-4">Deviasi Plan</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-right font-mono">Total Volume</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-right font-mono">Running Hrs</th>
                    <th className="py-2.5 px-3 text-slate-500 font-bold text-center">Status Audit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {paretoData.map((unit, index) => {
                    const isOutlier = unit.averageFuelBurn > categoryAverage * 1.35;
                    const ranksInTop80 = unit.cumulativePercent <= 80 || (index > 0 && paretoData[index - 1].cumulativePercent <= 80);
                    
                    const resolved = resolvePlanForUnit(unit.idAlat, unit.egy, unit.typeAlat, plans, egyPlans);
                    const planValue = resolved.planFuelBurn;
                    const devia = planValue > 0 ? unit.averageFuelBurn - planValue : 0;
                    const isOverP = devia > 0.01;

                    return (
                      <tr key={unit.idAlat} className={`hover:bg-slate-50/70 transition-colors ${ranksInTop80 ? "bg-slate-50/20" : ""}`}>
                        <td className="py-2.5 px-3">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md font-bold ${
                            index === 0 ? "bg-red-100 text-red-700" :
                            index === 1 ? "bg-amber-100 text-amber-700" :
                            index === 2 ? "bg-yellow-105 text-yellow-705" : "bg-slate-100 text-slate-600"
                          }`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{unit.idAlat}</td>
                        <td className="py-2.5 px-3">
                          <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 font-mono text-[11px]">
                            {unit.egy}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-800">
                          <span className={isOverP || isOutlier ? "text-rose-600 font-bold" : "text-blue-700"}>
                            {unit.averageFuelBurn.toFixed(2)} <span className="text-[10px] text-slate-400">L/Jam</span>
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-500 font-semibold">
                          {planValue > 0 ? `${planValue.toFixed(1)} L/Jam` : "-"}
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-black pr-4 ${isOverP ? "text-rose-600" : devia < -0.01 ? "text-emerald-600" : "text-slate-400"}`}>
                          {planValue > 0 ? (isOverP ? `+${devia.toFixed(2)}` : devia.toFixed(2)) : "-"}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-650">{unit.totalVolume.toLocaleString("id-ID")} L</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-650">{unit.runningHours} J</td>
                        <td className="py-2.5 px-3 text-center">
                          {isOverP ? (
                            <span className="inline-block bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] border border-rose-250">
                              Over Plan ({((devia/planValue)*100).toFixed(0)}%)
                            </span>
                          ) : ranksInTop80 ? (
                            <span className="inline-block bg-rose-55 text-rose-705 font-semibold px-2 py-0.5 rounded text-[10px] border border-rose-100">
                              Kontributor Utama
                            </span>
                          ) : (
                            <span className="inline-block bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded text-[10px]">
                              Efisien (Aman)
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
