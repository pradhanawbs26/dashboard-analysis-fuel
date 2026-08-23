import React, { useState, useMemo } from "react";
import { 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Sliders, 
  Fuel, 
  ChevronDown, 
  ChevronRight, 
  Award, 
  ShieldCheck, 
  AlertCircle,
  Filter,
  BarChart3,
  Layers,
  Sparkles,
  Info
} from "lucide-react";
import { FuelRecord, EgyPlanMap, EgyAssessmentItem } from "../types";
import { evaluateEgyPlanVsActual } from "../lib/egyPlanService";

interface PlanVsActualAssessmentProps {
  records: FuelRecord[];
  egyPlans: EgyPlanMap;
  unitPlans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
  onOpenPlanManager: () => void;
  selectedEgyFilter?: string;
}

export default function PlanVsActualAssessment({
  records,
  egyPlans,
  unitPlans,
  onOpenPlanManager,
  selectedEgyFilter = "SEMUA"
}: PlanVsActualAssessmentProps) {
  const [expandedEgy, setExpandedEgy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OVER" | "EFFICIENT">("ALL");

  // Perform full mathematical assessment
  const { egyAssessments, overallSummary } = useMemo(() => {
    return evaluateEgyPlanVsActual(records, egyPlans, unitPlans);
  }, [records, egyPlans, unitPlans]);

  // Filter assessments based on selectedEgyFilter and statusFilter
  const filteredAssessments = useMemo(() => {
    return egyAssessments.filter(item => {
      // 1. Egy filter
      if (selectedEgyFilter !== "SEMUA" && item.egy !== selectedEgyFilter) {
        return false;
      }
      // 2. Status filter
      if (statusFilter === "OVER" && !item.isOver) {
        return false;
      }
      if (statusFilter === "EFFICIENT" && item.isOver) {
        return false;
      }
      return true;
    });
  }, [egyAssessments, selectedEgyFilter, statusFilter]);

  const toggleExpand = (egy: string) => {
    setExpandedEgy(prev => (prev === egy ? null : egy));
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6 font-sans space-y-6">
      
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#4682B4]/10 text-[#4682B4] flex items-center justify-center font-bold">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <span>Penilaian Fuel Burn (Plan vs Actual) per Jenis Egy</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Evaluasi performa efisiensi bahan bakar aktual terhadap <strong>Target Plan Egy</strong> yang telah diinput & disetujui.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button to Open Plan Manager Modal */}
        <div className="flex items-center gap-2.5 self-start lg:self-center">
          <button
            onClick={onOpenPlanManager}
            className="flex items-center gap-2 text-xs bg-slate-900 hover:bg-slate-800 text-white font-extrabold px-4 py-2.5 rounded-xl transition shadow-sm cursor-pointer active:scale-95 border border-slate-800"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>Kelola Target Plan Egy</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Overall Efficiency Grade */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Indeks Efisiensi Armada</span>
            <span className={`text-xs font-black px-2 py-0.5 rounded font-mono ${
              overallSummary.overallGrade === "A+" || overallSummary.overallGrade === "A"
                ? "bg-emerald-100 text-emerald-800"
                : overallSummary.overallGrade === "B"
                ? "bg-blue-100 text-blue-800"
                : overallSummary.overallGrade === "C"
                ? "bg-amber-100 text-amber-800"
                : "bg-rose-100 text-rose-800"
            }`}>
              GRADE {overallSummary.overallGrade}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800 font-mono">
              {overallSummary.overallEfficiencyPct.toFixed(1)}%
            </span>
            <span className="text-xs text-slate-500 font-semibold">Kesesuaian Plan</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {overallSummary.overallDeviation <= 0 
              ? "Armada bekerja secara efisien di bawah batas plan target."
              : `Terjadi deviasi kumulatif +${overallSummary.overallDeviation.toFixed(2)} L/Jam di atas plan.`}
          </p>
        </div>

        {/* Card 2: Actual vs Weighted Plan */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Rerata Aktual vs Plan</span>
            <Fuel className="w-4 h-4 text-[#4682B4]" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-800 font-mono">
              {overallSummary.overallActualRate.toFixed(2)}
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">
              / {overallSummary.overallWeightedPlan.toFixed(2)} L/Jam
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-xs">
            <span className="text-slate-500">Deviasi:</span>
            <span className={`font-extrabold font-mono ${
              overallSummary.overallDeviation > 0.01 ? "text-rose-600" : "text-emerald-600"
            }`}>
              {overallSummary.overallDeviation > 0 ? `+${overallSummary.overallDeviation.toFixed(2)}` : overallSummary.overallDeviation.toFixed(2)} L/Jam
            </span>
          </div>
        </div>

        {/* Card 3: Egy Compliance Distribution */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Distribusi Kategori Egy</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">
              {overallSummary.efficientEgys}
            </span>
            <span className="text-xs text-slate-400 font-medium font-mono">
              Efisien / <strong className="text-rose-600">{overallSummary.overPlanEgys}</strong> Over Plan
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden flex">
            <div 
              className="bg-emerald-500 h-full"
              style={{ width: `${(overallSummary.efficientEgys / Math.max(overallSummary.totalEgys, 1)) * 100}%` }}
            />
            <div 
              className="bg-rose-500 h-full"
              style={{ width: `${(overallSummary.overPlanEgys / Math.max(overallSummary.totalEgys, 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Card 4: Fuel Volume Impact */}
        <div className={`p-4 rounded-xl border ${
          overallSummary.totalOverLiters > 0 
            ? "bg-rose-50/70 border-rose-200 text-rose-900" 
            : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">
              {overallSummary.totalOverLiters > 0 ? "Potensi Boros (Over Plan)" : "Penghematan Bahan Bakar"}
            </span>
            <AlertTriangle className={`w-4 h-4 ${overallSummary.totalOverLiters > 0 ? "text-rose-600" : "text-emerald-600"}`} />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black font-mono">
              {overallSummary.totalOverLiters > 0 
                ? `+${overallSummary.totalOverLiters.toLocaleString("id-ID")}` 
                : `-${overallSummary.totalSavedLiters.toLocaleString("id-ID")}`}
            </span>
            <span className="text-xs font-bold">Liter</span>
          </div>
          <p className="text-[11px] opacity-80 mt-1">
            {overallSummary.totalOverLiters > 0 
              ? "Estimasi kelebihan konsumsi liter solar dari seluruh unit over plan."
              : "Seluruh kategori bekerja lebih hemat dari target plan yang ditentukan."}
          </p>
        </div>

      </div>

      {/* Filter Tabs for Assessment Table */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === "ALL" 
                ? "bg-white text-slate-900 shadow-xs" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Semua Egy ({egyAssessments.length})
          </button>
          <button
            onClick={() => setStatusFilter("OVER")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === "OVER" 
                ? "bg-rose-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-rose-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span>Over Plan ({overallSummary.overPlanEgys})</span>
          </button>
          <button
            onClick={() => setStatusFilter("EFFICIENT")}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition cursor-pointer ${
              statusFilter === "EFFICIENT" 
                ? "bg-emerald-600 text-white shadow-xs" 
                : "text-slate-600 hover:text-emerald-700"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Efisien ({overallSummary.efficientEgys})</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 font-medium">
          Klik baris Egy untuk melihat rincian unit alat berat di dalamnya.
        </div>
      </div>

      {/* Main Assessment Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
            <tr>
              <th className="py-3 px-3 w-8"></th>
              <th className="py-3 px-3">Jenis Egy (Equipment Group)</th>
              <th className="py-3 px-3 text-center">Unit / HM</th>
              <th className="py-3 px-3 text-right">Total Fuel</th>
              <th className="py-3 px-3 text-right font-mono">Aktual Fuel Burn</th>
              <th className="py-3 px-3 text-right font-mono bg-amber-50/50">Target Plan (Input)</th>
              <th className="py-3 px-3 text-right font-mono">Deviasi</th>
              <th className="py-3 px-3 text-center">Status Efisiensi</th>
              <th className="py-3 px-3 text-center">Skor</th>
              <th className="py-3 px-3 text-right">Dampak Liter</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium">
            {filteredAssessments.map((item, idx) => {
              const isExpanded = expandedEgy === item.egy;

              return (
                <React.Fragment key={item.egy}>
                  <tr 
                    onClick={() => toggleExpand(item.egy)}
                    className={`hover:bg-slate-50 transition-colors cursor-pointer ${
                      item.isOver ? "bg-rose-50/20" : item.totalHours > 0 ? "bg-emerald-50/15" : "opacity-60"
                    }`}
                  >
                    {/* Expand Arrow */}
                    <td className="py-3.5 px-3 text-slate-400">
                      {item.unitCount > 0 && (
                        isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-slate-700" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        )
                      )}
                    </td>

                    {/* Egy Name */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-slate-850 font-mono text-xs">
                          {item.egy}
                        </span>
                      </div>
                    </td>

                    {/* Unit Count and Hours */}
                    <td className="py-3.5 px-3 text-center">
                      <span className="font-bold text-slate-700">{item.unitCount} Unit</span>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {item.totalHours.toLocaleString("id-ID")} Jam
                      </span>
                    </td>

                    {/* Total Fuel */}
                    <td className="py-3.5 px-3 text-right font-mono text-slate-700 font-bold">
                      {item.totalVolume.toLocaleString("id-ID")} L
                    </td>

                    {/* Actual Burn Rate */}
                    <td className="py-3.5 px-3 text-right font-mono">
                      <span className={`font-black text-xs ${
                        item.isOver ? "text-rose-700" : "text-emerald-700"
                      }`}>
                        {item.totalHours > 0 ? `${item.actualBurnRate.toFixed(2)}` : "-"}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-1">L/J</span>
                    </td>

                    {/* Target Plan Input */}
                    <td className="py-3.5 px-3 text-right font-mono font-black text-amber-900 bg-amber-50/50">
                      <span>{item.planBurnRate.toFixed(1)}</span>
                      <span className="text-[10px] text-amber-700/70 ml-1">L/J</span>
                    </td>

                    {/* Deviation */}
                    <td className="py-3.5 px-3 text-right font-mono font-black">
                      {item.totalHours > 0 ? (
                        <span className={`px-1.5 py-0.5 rounded text-[11px] ${
                          item.isOver 
                            ? "text-rose-700 bg-rose-100" 
                            : item.deviation < -0.05 
                            ? "text-emerald-700 bg-emerald-100" 
                            : "text-slate-600 bg-slate-100"
                        }`}>
                          {item.deviation > 0 ? `+${item.deviation.toFixed(2)}` : item.deviation.toFixed(2)}
                          <span className="text-[9px] ml-1 font-bold">
                            ({item.deviationPct > 0 ? `+${item.deviationPct.toFixed(0)}%` : `${item.deviationPct.toFixed(0)}%`})
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-3 text-center">
                      {item.totalHours === 0 ? (
                        <span className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                          Tidak Aktif
                        </span>
                      ) : item.status === "EFISIEN" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-extrabold">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Efisien</span>
                        </span>
                      ) : item.status === "OVER_PLAN" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-full font-extrabold">
                          <AlertTriangle className="w-3 h-3 text-amber-600" />
                          <span>Over Plan</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-800 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full font-extrabold">
                          <AlertTriangle className="w-3 h-3 text-rose-600" />
                          <span>Kritis (Boros)</span>
                        </span>
                      )}
                    </td>

                    {/* Grade */}
                    <td className="py-3.5 px-3 text-center">
                      <span className={`inline-block font-mono font-black text-xs px-2 py-0.5 rounded ${
                        item.grade === "A+" || item.grade === "A"
                          ? "bg-emerald-600 text-white"
                          : item.grade === "B"
                          ? "bg-blue-600 text-white"
                          : item.grade === "C"
                          ? "bg-amber-500 text-white"
                          : "bg-rose-600 text-white"
                      }`}>
                        {item.grade}
                      </span>
                    </td>

                    {/* Fuel Impact */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold">
                      {item.totalHours > 0 ? (
                        <span className={item.fuelImpactLiters > 0 ? "text-rose-600" : "text-emerald-600"}>
                          {item.fuelImpactLiters > 0 ? `+${item.fuelImpactLiters.toLocaleString("id-ID")}` : item.fuelImpactLiters.toLocaleString("id-ID")} L
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded Sub-table for Units inside this Egy */}
                  {isExpanded && item.units.length > 0 && (
                    <tr>
                      <td colSpan={10} className="p-0 bg-slate-900/5">
                        <div className="p-4 sm:p-5 bg-slate-50 border-y border-slate-200 space-y-3 animate-fade-in">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-black text-slate-800 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-[#4682B4]"></span>
                              <span>Rincian Unit Alat Berat dalam Egy "{item.egy}"</span>
                            </h5>
                            <span className="text-[11px] text-slate-500">
                              Target Acuan Egy: <strong className="font-mono text-slate-800">{item.planBurnRate.toFixed(1)} L/Jam</strong>
                            </span>
                          </div>

                          <div className="overflow-x-auto border border-slate-200 rounded-lg bg-white">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[9px] border-b border-slate-200">
                                <tr>
                                  <th className="py-2 px-3">Nomor Unit (ID Alat)</th>
                                  <th className="py-2 px-3">Tipe / Model Alat</th>
                                  <th className="py-2 px-3 text-right">Jam Kerja (HM)</th>
                                  <th className="py-2 px-3 text-right">Total Liter</th>
                                  <th className="py-2 px-3 text-right font-mono">Aktual (L/J)</th>
                                  <th className="py-2 px-3 text-right font-mono">Target Plan</th>
                                  <th className="py-2 px-3 text-right font-mono">Deviasi</th>
                                  <th className="py-2 px-3 text-center">Status Unit</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 font-medium">
                                {item.units.map(u => (
                                  <tr key={u.idAlat} className={`hover:bg-slate-50 ${u.isOver ? "bg-rose-50/30" : ""}`}>
                                    <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{u.idAlat}</td>
                                    <td className="py-2.5 px-3 text-slate-500">{u.typeAlat}</td>
                                    <td className="py-2.5 px-3 text-right font-mono">{u.totalHours.toLocaleString("id-ID")} J</td>
                                    <td className="py-2.5 px-3 text-right font-mono">{u.totalVolume.toLocaleString("id-ID")} L</td>
                                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${u.isOver ? "text-rose-600" : "text-blue-600"}`}>
                                      {u.actual.toFixed(2)}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                                      {u.plan.toFixed(1)}
                                    </td>
                                    <td className={`py-2.5 px-3 text-right font-mono font-black ${
                                      u.isOver ? "text-rose-600" : u.deviation < -0.05 ? "text-emerald-600" : "text-slate-400"
                                    }`}>
                                      {u.deviation > 0 ? `+${u.deviation.toFixed(2)}` : u.deviation.toFixed(2)}
                                      <span className="text-[9px] ml-1">({u.deviationPct > 0 ? `+${u.deviationPct.toFixed(0)}%` : `${u.deviationPct.toFixed(0)}%`})</span>
                                    </td>
                                    <td className="py-2.5 px-3 text-center">
                                      {u.isOver ? (
                                        <span className="text-[9px] bg-rose-100 text-rose-800 font-black px-2 py-0.5 rounded-full">
                                          Over Plan
                                        </span>
                                      ) : (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                                          Efisien
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
}
