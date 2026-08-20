import React from "react";
import { Fuel, Clock, Gauge, AlertCircle } from "lucide-react";
import { motion } from "motion/react";

interface MetricCardProps {
  title: string;
  value: number;
  subValue?: string;
  totalFuel: number;
  totalHours: number;
  recordCount: number;
  anomalyCount: number;
  periodText: string;
  themeColor: "blue" | "emerald" | "amber";
  helpText: string;
}

export default function MetricCard({
  title,
  value,
  subValue,
  totalFuel,
  totalHours,
  recordCount,
  anomalyCount,
  periodText,
  themeColor,
  helpText
}: MetricCardProps) {
  const colorMap = {
    blue: {
      bg: "bg-white border-slate-200/90 hover:border-[#4682B4]",
      iconBg: "bg-[#4682B4]/10 text-[#4682B4]",
      accent: "text-[#4682B4]",
      ring: "focus-within:ring-[#4682B4]",
      glow: "hover:shadow-md",
      border: "border-l-4 border-l-[#4682B4]"
    },
    emerald: {
      bg: "bg-white border-slate-200/90 hover:border-emerald-500",
      iconBg: "bg-emerald-50 text-emerald-600",
      accent: "text-emerald-700",
      ring: "focus-within:ring-emerald-500",
      glow: "hover:shadow-md",
      border: "border-l-4 border-l-emerald-600"
    },
    amber: {
      bg: "bg-[#1E293B] text-white border-slate-700 hover:border-slate-500",
      iconBg: "bg-slate-800 text-slate-300",
      accent: "text-amber-400",
      ring: "focus-within:ring-slate-400",
      glow: "hover:shadow-md",
      border: "border-l-4 border-l-amber-500"
    }
  };

  const style = colorMap[themeColor];

  const isDark = themeColor === "amber";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={`relative p-5 rounded-xl border ${style.bg} ${style.border} ${style.glow} transition-all duration-300 flex flex-col justify-between h-full`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-semibold tracking-wider uppercase ${isDark ? "text-slate-450" : "text-slate-500"}`}>
            {title}
          </span>
          <div className={`p-2 rounded-lg ${style.iconBg}`}>
            <Gauge className="w-4 h-4" />
          </div>
        </div>

        <div className="flex items-baseline space-x-2">
          <span className={`text-3xl font-extrabold tracking-tight font-sans ${isDark ? "text-white" : "text-slate-800"}`}>
            {value > 0 ? value.toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0,00"}
          </span>
          <span className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-slate-500"}`}>L/Jam</span>
        </div>
        
        {subValue && (
          <p className={`mt-1 text-xs italic ${isDark ? "text-slate-400/90" : "text-slate-400"}`}>
            {subValue}
          </p>
        )}

        <div className={`mt-2 text-xs font-medium flex items-center gap-1 py-1 px-2.5 rounded-full w-fit ${isDark ? "bg-slate-800 text-slate-350" : "bg-slate-100 text-slate-500"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isDark ? "bg-slate-500" : "bg-slate-400"}`}></span>
          Periode: <strong className={isDark ? "text-white" : "text-slate-700"}>{periodText}</strong>
        </div>
      </div>

      <div className={`mt-5 pt-4 border-t grid grid-cols-2 gap-y-2 gap-x-1 text-xs ${isDark ? "border-slate-800 text-slate-400" : "border-slate-100 text-slate-500"}`}>
        <div className="flex items-center gap-1.5" title="Total akumulasi bahan bakar dalam range">
          <Fuel className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{totalFuel.toLocaleString("id-ID")}</strong> Liter
          </span>
        </div>
        <div className="flex items-center gap-1.5" title="Total Hour Meter (run hours) terakumulasi">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="truncate">
            <strong className={isDark ? "text-slate-200" : "text-slate-700"}>{totalHours.toLocaleString("id-ID", { maximumFractionDigits: 1 })}</strong> Jam
          </span>
        </div>
        <div className={`col-span-2 flex items-center justify-between mt-1 text-[11px] border-t pt-2 ${isDark ? "border-slate-800/80 text-slate-450" : "border-slate-50 text-slate-400"}`}>
          <span>{recordCount} Log Pengisian</span>
          {anomalyCount > 0 ? (
            <span className={`flex items-center gap-1 font-medium ${isDark ? "text-amber-400" : "text-amber-600"}`}>
              <AlertCircle className="w-3 h-3" />
              {anomalyCount} Anomali
            </span>
          ) : (
            <span className={`font-semibold font-mono text-[9px] px-1.5 py-0.5 rounded ${isDark ? "bg-emerald-950 text-emerald-400" : "bg-emerald-50 text-emerald-600"}`}>DATA SEHAT</span>
          )}
        </div>
      </div>

      {/* Tooltip help indicator */}
      <div className="absolute top-2 right-2 opacity-0 hover:opacity-100 transition-opacity duration-200 cursor-help" title={helpText}>
        <div className="absolute right-0 bg-slate-800 text-white text-[10px] w-48 p-2 rounded shadow-xl leading-relaxed z-10 font-normal">
          {helpText}
        </div>
      </div>
    </motion.div>
  );
}
