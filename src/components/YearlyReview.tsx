import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  BarChart2, 
  TrendingUp, 
  Calendar, 
  Info, 
  Sparkles, 
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  CornerDownRight,
  Layers,
  Table, 
  FileText,
  Activity,
  DollarSign,
  Trash2,
  Cloud,
  Database,
  RefreshCw,
  SlidersHorizontal,
  Tag,
  Hash
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { 
  normalizeDateToYMD, 
  deriveEgy, 
  cleanEgyName, 
  saveJulyBenchmarkRegistry, 
  getJulyBenchmarkRegistry,
  MASTER_JULY_BENCHMARKS,
  MONTH_NAMES_IND,
  KNOWN_CANONICAL_EGY,
  INITIAL_FUEL_DATA,
  getCanonicalUnitId,
  getHistoricalLegacyUnitId,
  isHistoricalRenamedUnit
} from "../data/sampleData";
import UploadAnalysisModal, { 
  AnalyzedUploadResult, 
  AnalyzedEgySummary, 
  AnalyzedUnitDetail 
} from "./UploadAnalysisModal";
import EgyPlanManagerModal from "./EgyPlanManagerModal";
import { 
  subscribeToMonthlyReports, 
  fetchAllMonthlyReports,
  saveMonthlyReportToFirestore, 
  saveActiveDatasetToFirestore,
  deleteMonthlyReport, 
  testConnection 
} from "../lib/firebase";
import { getSyncLocalData, saveLocalData, removeLocalData } from "../lib/storage";
import { MonthlyReportData, EgyPlanMap, FuelRecord } from "../types";
import { processRecord, deriveEquipmentType } from "../data/sampleData";
import { getStoredEgyPlans, saveStoredEgyPlans, subscribeToEgyPlans, DEFAULT_EGY_PLANS } from "../lib/egyPlanService";

interface YearlyReviewProps {
  onBackToDashboard?: () => void;
  egyPlans?: EgyPlanMap;
  unitPlans?: Record<string, { idAlat: string; typeAlat?: string; egy?: string; planFuelBurn?: number }>;
  records?: FuelRecord[];
  onOpenPlanManager?: () => void;
  onSyncRecords?: (newRecords: FuelRecord[]) => void;
  onSelectMonthForDashboard?: (monthName: string) => void;
}

// Hardcoded standard plans for equipment types matching the July Benchmark (Jenis Egy)
const DEFAULT_TYPE_PLANS: Record<string, number> = {
  "DUMP TRUCK": 7.5,
  "FLAT DECK": 7.0,
  "EXCAVATOR": 18.0,
  "BULLDOZER": 28.0,
  "CRANE TRUCK": 6.5,
  "FUEL TRUCK": 7.0,
  "FORKLIFT": 6.0,
  "WATER TRUCK": 6.0,
  "REACH STACKER": 12.5,
  "TOWER LAMP": 3.0,
  "LIGHT VEHICLE": 4.0,
  "MOTOR GRADER": 10.0,
  "WHEEL LOADER": 24.0,
  "COMPACTOR": 8.0,
  "GENSET": 25.1,
  // Individual Models as secondary fallback
  "GENSET EX PT MAS": 25.1,
  "HINO 500 (FM260JD)": 7.5,
  "HINO 500 (FM280JD)": 6.5,
  "HYUNDAI PC 495": 30.0,
  "KOMATSU FD150E - 8": 6.0,
  "KOMATSU GD 535": 10.0,
  "KOMATSU PC 210": 13.0,
  "CAT 320 GC": 16.0,
  "CATERPILAR D8T": 28.0,
  "KONECRANE 45T": 12.5,
  "DUTRO 136 HD": 6.0,
  "TOYOTA INNOVA": 4.0,
  "KOMATSU D85SS": 25.0,
  "KOMATSU WA 500": 24.0,
  "CAT 980 NG": 24.0,
  "CATERPILAR CS 11 GC": 8.0,
};

// Helper to check if string contains Indonesian month names and return standard index
function getMonthFromText(text: string): number {
  const clean = text.toLowerCase();
  if (clean.includes("jan")) return 0;
  if (clean.includes("feb")) return 1;
  if (clean.includes("mar")) return 2;
  if (clean.includes("apr")) return 3;
  if (clean.includes("mei") || clean.includes("may")) return 4;
  if (clean.includes("jun")) return 5;
  if (clean.includes("jul")) return 6;
  if (clean.includes("agu") || clean.includes("aug")) return 7;
  if (clean.includes("sep")) return 8;
  if (clean.includes("okt") || clean.includes("oct")) return 9;
  if (clean.includes("nov")) return 10;
  if (clean.includes("des") || clean.includes("dec")) return 11;
  return -1;
}

// Built-in Year-round high-fidelity sample datasets strictly grouped by July Benchmark Egy (Januari - Juni)
const SAMPLE_YEARLY_DATA = [
  // Januari
  { bulan: "Januari", typeAlat: "DUMP TRUCK", totalVolume: 13400, totalHours: 2000, recordCount: 230 },
  { bulan: "Januari", typeAlat: "FLAT DECK", totalVolume: 11200, totalHours: 1600, recordCount: 190 },
  { bulan: "Januari", typeAlat: "EXCAVATOR", totalVolume: 14850, totalHours: 1100, recordCount: 165 },
  { bulan: "Januari", typeAlat: "BULLDOZER", totalVolume: 2450, totalHours: 100, recordCount: 20 },
  { bulan: "Januari", typeAlat: "CRANE TRUCK", totalVolume: 650, totalHours: 100, recordCount: 18 },
  { bulan: "Januari", typeAlat: "FUEL TRUCK", totalVolume: 1370, totalHours: 200, recordCount: 40 },
  { bulan: "Januari", typeAlat: "FORKLIFT", totalVolume: 840, totalHours: 140, recordCount: 25 },
  { bulan: "Januari", typeAlat: "WATER TRUCK", totalVolume: 600, totalHours: 100, recordCount: 15 },
  { bulan: "Januari", typeAlat: "REACH STACKER", totalVolume: 1300, totalHours: 100, recordCount: 35 },
  { bulan: "Januari", typeAlat: "TOWER LAMP", totalVolume: 300, totalHours: 100, recordCount: 12 },
  { bulan: "Januari", typeAlat: "LIGHT VEHICLE", totalVolume: 380, totalHours: 100, recordCount: 15 },
  { bulan: "Januari", typeAlat: "MOTOR GRADER", totalVolume: 890, totalHours: 100, recordCount: 25 },
  { bulan: "Januari", typeAlat: "WHEEL LOADER", totalVolume: 2400, totalHours: 100, recordCount: 22 },
  { bulan: "Januari", typeAlat: "COMPACTOR", totalVolume: 800, totalHours: 100, recordCount: 16 },
  { bulan: "Januari", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 },

  // Februari
  { bulan: "Februari", typeAlat: "DUMP TRUCK", totalVolume: 13800, totalHours: 2000, recordCount: 237 },
  { bulan: "Februari", typeAlat: "FLAT DECK", totalVolume: 11400, totalHours: 1600, recordCount: 195 },
  { bulan: "Februari", typeAlat: "EXCAVATOR", totalVolume: 15830, totalHours: 1100, recordCount: 166 },
  { bulan: "Februari", typeAlat: "BULLDOZER", totalVolume: 2500, totalHours: 100, recordCount: 21 },
  { bulan: "Februari", typeAlat: "CRANE TRUCK", totalVolume: 640, totalHours: 100, recordCount: 18 },
  { bulan: "Februari", typeAlat: "FUEL TRUCK", totalVolume: 1410, totalHours: 200, recordCount: 42 },
  { bulan: "Februari", typeAlat: "FORKLIFT", totalVolume: 850, totalHours: 142, recordCount: 26 },
  { bulan: "Februari", typeAlat: "WATER TRUCK", totalVolume: 610, totalHours: 100, recordCount: 16 },
  { bulan: "Februari", typeAlat: "REACH STACKER", totalVolume: 1230, totalHours: 100, recordCount: 32 },
  { bulan: "Februari", typeAlat: "TOWER LAMP", totalVolume: 310, totalHours: 100, recordCount: 13 },
  { bulan: "Februari", typeAlat: "LIGHT VEHICLE", totalVolume: 400, totalHours: 100, recordCount: 16 },
  { bulan: "Februari", typeAlat: "MOTOR GRADER", totalVolume: 1040, totalHours: 100, recordCount: 28 },
  { bulan: "Februari", typeAlat: "WHEEL LOADER", totalVolume: 2450, totalHours: 102, recordCount: 23 },
  { bulan: "Februari", typeAlat: "COMPACTOR", totalVolume: 810, totalHours: 101, recordCount: 17 },
  { bulan: "Februari", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 },

  // Maret
  { bulan: "Maret", typeAlat: "DUMP TRUCK", totalVolume: 14500, totalHours: 2000, recordCount: 243 },
  { bulan: "Maret", typeAlat: "FLAT DECK", totalVolume: 11800, totalHours: 1600, recordCount: 200 },
  { bulan: "Maret", typeAlat: "EXCAVATOR", totalVolume: 16820, totalHours: 1100, recordCount: 175 },
  { bulan: "Maret", typeAlat: "BULLDOZER", totalVolume: 2580, totalHours: 100, recordCount: 22 },
  { bulan: "Maret", typeAlat: "CRANE TRUCK", totalVolume: 660, totalHours: 100, recordCount: 19 },
  { bulan: "Maret", typeAlat: "FUEL TRUCK", totalVolume: 1420, totalHours: 200, recordCount: 42 },
  { bulan: "Maret", typeAlat: "FORKLIFT", totalVolume: 870, totalHours: 145, recordCount: 27 },
  { bulan: "Maret", typeAlat: "WATER TRUCK", totalVolume: 620, totalHours: 100, recordCount: 16 },
  { bulan: "Maret", typeAlat: "REACH STACKER", totalVolume: 1340, totalHours: 100, recordCount: 36 },
  { bulan: "Maret", typeAlat: "TOWER LAMP", totalVolume: 300, totalHours: 100, recordCount: 12 },
  { bulan: "Maret", typeAlat: "LIGHT VEHICLE", totalVolume: 420, totalHours: 100, recordCount: 18 },
  { bulan: "Maret", typeAlat: "MOTOR GRADER", totalVolume: 970, totalHours: 100, recordCount: 27 },
  { bulan: "Maret", typeAlat: "WHEEL LOADER", totalVolume: 2420, totalHours: 100, recordCount: 22 },
  { bulan: "Maret", typeAlat: "COMPACTOR", totalVolume: 790, totalHours: 98, recordCount: 15 },
  { bulan: "Maret", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 },

  // April
  { bulan: "April", typeAlat: "DUMP TRUCK", totalVolume: 14000, totalHours: 2000, recordCount: 232 },
  { bulan: "April", typeAlat: "FLAT DECK", totalVolume: 11500, totalHours: 1600, recordCount: 194 },
  { bulan: "April", typeAlat: "EXCAVATOR", totalVolume: 16200, totalHours: 1100, recordCount: 169 },
  { bulan: "April", typeAlat: "BULLDOZER", totalVolume: 2520, totalHours: 100, recordCount: 21 },
  { bulan: "April", typeAlat: "CRANE TRUCK", totalVolume: 650, totalHours: 100, recordCount: 18 },
  { bulan: "April", typeAlat: "FUEL TRUCK", totalVolume: 1390, totalHours: 200, recordCount: 41 },
  { bulan: "April", typeAlat: "FORKLIFT", totalVolume: 845, totalHours: 141, recordCount: 25 },
  { bulan: "April", typeAlat: "WATER TRUCK", totalVolume: 590, totalHours: 100, recordCount: 15 },
  { bulan: "April", typeAlat: "REACH STACKER", totalVolume: 1280, totalHours: 100, recordCount: 34 },
  { bulan: "April", typeAlat: "TOWER LAMP", totalVolume: 310, totalHours: 100, recordCount: 13 },
  { bulan: "April", typeAlat: "LIGHT VEHICLE", totalVolume: 390, totalHours: 100, recordCount: 16 },
  { bulan: "April", typeAlat: "MOTOR GRADER", totalVolume: 1010, totalHours: 100, recordCount: 26 },
  { bulan: "April", typeAlat: "WHEEL LOADER", totalVolume: 2410, totalHours: 100, recordCount: 22 },
  { bulan: "April", typeAlat: "COMPACTOR", totalVolume: 805, totalHours: 100, recordCount: 16 },
  { bulan: "April", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 },

  // Mei
  { bulan: "Mei", typeAlat: "DUMP TRUCK", totalVolume: 13700, totalHours: 2000, recordCount: 235 },
  { bulan: "Mei", typeAlat: "FLAT DECK", totalVolume: 11300, totalHours: 1600, recordCount: 192 },
  { bulan: "Mei", typeAlat: "EXCAVATOR", totalVolume: 15850, totalHours: 1100, recordCount: 165 },
  { bulan: "Mei", typeAlat: "BULLDOZER", totalVolume: 2490, totalHours: 100, recordCount: 20 },
  { bulan: "Mei", typeAlat: "CRANE TRUCK", totalVolume: 650, totalHours: 100, recordCount: 18 },
  { bulan: "Mei", typeAlat: "FUEL TRUCK", totalVolume: 1400, totalHours: 200, recordCount: 42 },
  { bulan: "Mei", typeAlat: "FORKLIFT", totalVolume: 855, totalHours: 142, recordCount: 26 },
  { bulan: "Mei", typeAlat: "WATER TRUCK", totalVolume: 600, totalHours: 100, recordCount: 15 },
  { bulan: "Mei", typeAlat: "REACH STACKER", totalVolume: 1250, totalHours: 100, recordCount: 33 },
  { bulan: "Mei", typeAlat: "TOWER LAMP", totalVolume: 300, totalHours: 100, recordCount: 12 },
  { bulan: "Mei", typeAlat: "LIGHT VEHICLE", totalVolume: 410, totalHours: 100, recordCount: 17 },
  { bulan: "Mei", typeAlat: "MOTOR GRADER", totalVolume: 980, totalHours: 100, recordCount: 25 },
  { bulan: "Mei", typeAlat: "WHEEL LOADER", totalVolume: 2440, totalHours: 101, recordCount: 23 },
  { bulan: "Mei", typeAlat: "COMPACTOR", totalVolume: 795, totalHours: 99, recordCount: 16 },
  { bulan: "Mei", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 },

  // Juni
  { bulan: "Juni", typeAlat: "DUMP TRUCK", totalVolume: 14200, totalHours: 2000, recordCount: 240 },
  { bulan: "Juni", typeAlat: "FLAT DECK", totalVolume: 11600, totalHours: 1600, recordCount: 196 },
  { bulan: "Juni", typeAlat: "EXCAVATOR", totalVolume: 16410, totalHours: 1100, recordCount: 173 },
  { bulan: "Juni", typeAlat: "BULLDOZER", totalVolume: 2550, totalHours: 100, recordCount: 22 },
  { bulan: "Juni", typeAlat: "CRANE TRUCK", totalVolume: 660, totalHours: 100, recordCount: 19 },
  { bulan: "Juni", typeAlat: "FUEL TRUCK", totalVolume: 1430, totalHours: 200, recordCount: 43 },
  { bulan: "Juni", typeAlat: "FORKLIFT", totalVolume: 865, totalHours: 144, recordCount: 26 },
  { bulan: "Juni", typeAlat: "WATER TRUCK", totalVolume: 610, totalHours: 100, recordCount: 16 },
  { bulan: "Juni", typeAlat: "REACH STACKER", totalVolume: 1300, totalHours: 100, recordCount: 35 },
  { bulan: "Juni", typeAlat: "TOWER LAMP", totalVolume: 310, totalHours: 100, recordCount: 13 },
  { bulan: "Juni", typeAlat: "LIGHT VEHICLE", totalVolume: 400, totalHours: 100, recordCount: 16 },
  { bulan: "Juni", typeAlat: "MOTOR GRADER", totalVolume: 1020, totalHours: 100, recordCount: 27 },
  { bulan: "Juni", typeAlat: "WHEEL LOADER", totalVolume: 2460, totalHours: 102, recordCount: 23 },
  { bulan: "Juni", typeAlat: "COMPACTOR", totalVolume: 815, totalHours: 102, recordCount: 17 },
  { bulan: "Juni", typeAlat: "GENSET", totalVolume: 2510, totalHours: 100, recordCount: 15 }
];

export default function YearlyReview({ 
  onBackToDashboard, 
  egyPlans: propEgyPlans, 
  unitPlans: propUnitPlans,
  records: propRecords,
  onOpenPlanManager,
  onSyncRecords,
  onSelectMonthForDashboard
}: YearlyReviewProps) {
  // Local fallback / synced egyPlans
  const [internalEgyPlans, setInternalEgyPlans] = useState<EgyPlanMap>(() => getStoredEgyPlans());
  const [isInternalPlanModalOpen, setIsInternalPlanModalOpen] = useState(false);

  // Expandable EGY rows state (stores set of expanded EGY names)
  const [expandedEgys, setExpandedEgys] = useState<Set<string>>(new Set());

  // Sorting state: defaults to "worst_achievement" (EGYs with highest over-plan first)
  type SortOption = "worst_achievement" | "best_achievement" | "name_asc" | "name_desc" | "volume_desc" | "hours_desc";
  const [sortOption, setSortOption] = useState<SortOption>("worst_achievement");
  const [activeMonthSort, setActiveMonthSort] = useState<{ month: string; direction: "desc" | "asc" } | null>(null);

  const toggleExpandEgy = (egyName: string) => {
    setExpandedEgys(prev => {
      const next = new Set(prev);
      if (next.has(egyName)) {
        next.delete(egyName);
      } else {
        next.add(egyName);
      }
      return next;
    });
  };

  const expandAllEgys = () => {
    setExpandedEgys(new Set(uniqueEquipmentTypes));
  };

  const collapseAllEgys = () => {
    setExpandedEgys(new Set());
  };

  useEffect(() => {
    const unsub = subscribeToEgyPlans((latest) => {
      setInternalEgyPlans(latest);
    });
    return () => unsub();
  }, []);

  const activeEgyPlans = propEgyPlans || internalEgyPlans;

  const handleOpenPlanManager = () => {
    if (onOpenPlanManager) {
      onOpenPlanManager();
    } else {
      setIsInternalPlanModalOpen(true);
    }
  };

  // Parsed records grouped by month and typeAlat - initialize from local storage cache for 0ms refresh flicker
  const [dataPoints, setDataPoints] = useState<Array<{
    bulan: string;      // Month name
    typeAlat: string;   // Canonical July Egy name
    totalVolume: number;
    totalHours: number;
    recordCount: number;
  }>>(() => {
    const cached = getSyncLocalData<Array<{
      bulan: string;
      typeAlat: string;
      totalVolume: number;
      totalHours: number;
      recordCount: number;
    }>>("yearly_data_points", []);

    if (cached && cached.length > 0) {
      // Re-map cached items through deriveEgy & cleanEgyName to guarantee July benchmark alignment
      const aggMap: Record<string, { bulan: string; typeAlat: string; totalVolume: number; totalHours: number; recordCount: number }> = {};
      cached.forEach(pt => {
        const canonicalEgy = cleanEgyName(deriveEgy(pt.typeAlat, pt.typeAlat));
        const key = `${pt.bulan}___${canonicalEgy}`;
        if (!aggMap[key]) {
          aggMap[key] = {
            bulan: pt.bulan,
            typeAlat: canonicalEgy,
            totalVolume: pt.totalVolume,
            totalHours: pt.totalHours,
            recordCount: pt.recordCount
          };
        } else {
          aggMap[key].totalVolume += pt.totalVolume;
          aggMap[key].totalHours += pt.totalHours;
          aggMap[key].recordCount += pt.recordCount;
        }
      });
      return Object.values(aggMap);
    }
    return SAMPLE_YEARLY_DATA;
  });

  const [activeAnalysisMetric, setActiveAnalysisMetric] = useState<"burnRate" | "volume" | "hours">("burnRate");
  const [showChartLabels, setShowChartLabels] = useState<boolean>(true);
  const [selectedHighlightType, setSelectedHighlightType] = useState<string>("SEMUA");
  const [startEvalMonth, setStartEvalMonth] = useState<string>("Januari");
  const [endEvalMonth, setEndEvalMonth] = useState<string>("Desember");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | null; message: string }>({
    type: "success",
    message: "Data historis telah diselaraskan dengan patokan Egy Bulan Juli. Silakan unggah file Excel bulanan untuk memperbarui slot."
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedMonthForUpload, setSelectedMonthForUpload] = useState<string | null>(null);
  const [uploadedMonths, setUploadedMonths] = useState<string[]>(() => getSyncLocalData("yearly_uploaded_months", []));
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Staging Analysis Modal State for Pre-Commit Review & Verification
  const [analysisStagingData, setAnalysisStagingData] = useState<AnalyzedUploadResult | null>(null);
  const [isAnalysisModalOpen, setIsAnalysisModalOpen] = useState<boolean>(false);
  const [isApplyingAnalysis, setIsApplyingAnalysis] = useState<boolean>(false);

  // Helper to parse MonthlyReportData array into data points with July Egy normalization
  const processReportsIntoPoints = (reports: MonthlyReportData[]) => {
    if (!reports || reports.length === 0) return;
    const allPts: Array<{
      bulan: string;
      typeAlat: string;
      totalVolume: number;
      totalHours: number;
      recordCount: number;
    }> = [];
    const cloudMonths: string[] = [];

    reports.forEach((rep) => {
      if (!cloudMonths.includes(rep.bulan)) {
        cloudMonths.push(rep.bulan);
      }
      if (rep.unitSummaries && rep.unitSummaries.length > 0) {
        rep.unitSummaries.forEach((us) => {
          const canonicalEgy = cleanEgyName(deriveEgy(us.idAlat, us.typeAlat || us.egy));
          allPts.push({
            bulan: rep.bulan,
            typeAlat: canonicalEgy,
            totalVolume: us.totalVolume,
            totalHours: us.totalHours,
            recordCount: us.recordCount || 1
          });
        });
      } else if (rep.typeSummaries && rep.typeSummaries.length > 0) {
        rep.typeSummaries.forEach((ts) => {
          // Normalize to July benchmark Egy
          const canonicalEgy = cleanEgyName(deriveEgy(ts.typeAlat, ts.egy || ts.typeAlat));
          allPts.push({
            bulan: rep.bulan,
            typeAlat: canonicalEgy,
            totalVolume: ts.totalVolume,
            totalHours: ts.totalHours,
            recordCount: ts.recordCount
          });
        });
      }
    });

    if (allPts.length > 0) {
      // Group by (bulan, typeAlat)
      const aggMap: Record<string, { bulan: string; typeAlat: string; totalVolume: number; totalHours: number; recordCount: number }> = {};
      allPts.forEach(p => {
        const k = `${p.bulan}___${p.typeAlat}`;
        if (!aggMap[k]) {
          aggMap[k] = { ...p };
        } else {
          aggMap[k].totalVolume += p.totalVolume;
          aggMap[k].totalHours += p.totalHours;
          aggMap[k].recordCount += p.recordCount;
        }
      });
      const unifiedPts = Object.values(aggMap).map(p => ({
        ...p,
        totalVolume: Number(p.totalVolume.toFixed(1)),
        totalHours: Number(p.totalHours.toFixed(1))
      }));

      setDataPoints(unifiedPts);
      setUploadedMonths(cloudMonths);
      saveLocalData("yearly_data_points", unifiedPts);
      saveLocalData("yearly_uploaded_months", cloudMonths);
    }
  };

  // One-click Re-synchronizer to align all historical data (Jan-Jun) to July Egy Benchmark
  const handleSyncToJulyBenchmark = async () => {
    setIsProcessing(true);
    setFeedback({ type: null, message: "" });
    try {
      // 1. Fetch latest Cloud Reports if available to re-aggregate completely from units
      let cloudReports: MonthlyReportData[] = [];
      try {
        cloudReports = await fetchAllMonthlyReports();
      } catch (e) {
        console.warn("Could not fetch cloud reports during sync:", e);
      }

      if (cloudReports && cloudReports.length > 0) {
        for (const rep of cloudReports) {
          let updatedSummaries = rep.typeSummaries || [];
          if (rep.unitSummaries && rep.unitSummaries.length > 0) {
            const egyAgg: Record<string, { totalVolume: number; totalHours: number; recordCount: number }> = {};
            rep.unitSummaries.forEach(us => {
              const canon = cleanEgyName(deriveEgy(us.idAlat, us.typeAlat || us.egy));
              if (!egyAgg[canon]) {
                egyAgg[canon] = { totalVolume: 0, totalHours: 0, recordCount: 0 };
              }
              egyAgg[canon].totalVolume += us.totalVolume;
              egyAgg[canon].totalHours += us.totalHours;
              egyAgg[canon].recordCount += us.recordCount || 1;
            });
            updatedSummaries = Object.entries(egyAgg).map(([egy, val]) => ({
              egy,
              typeAlat: egy,
              totalVolume: Number(val.totalVolume.toFixed(1)),
              totalHours: Number(val.totalHours.toFixed(1)),
              recordCount: val.recordCount,
              burnRate: val.totalHours > 0 ? Number((val.totalVolume / val.totalHours).toFixed(2)) : 0
            }));
          } else {
            updatedSummaries = (rep.typeSummaries || []).map(ts => {
              const canon = cleanEgyName(deriveEgy(ts.typeAlat, ts.egy || ts.typeAlat));
              return {
                ...ts,
                egy: canon,
                typeAlat: canon,
              };
            });
          }

          try {
            await saveMonthlyReportToFirestore({
              ...rep,
              typeSummaries: updatedSummaries
            });
          } catch (err) {
            console.warn("Firestore save update notice:", err);
          }
        }
        processReportsIntoPoints(cloudReports);
      } else {
        // Fallback: Re-map current state dataPoints
        const currentPoints = dataPoints.length > 0 ? dataPoints : SAMPLE_YEARLY_DATA;
        const remapped: Array<{
          bulan: string;
          typeAlat: string;
          totalVolume: number;
          totalHours: number;
          recordCount: number;
        }> = [];

        currentPoints.forEach(pt => {
          const canonicalEgy = cleanEgyName(deriveEgy(pt.typeAlat, pt.typeAlat));
          remapped.push({
            bulan: pt.bulan,
            typeAlat: canonicalEgy,
            totalVolume: pt.totalVolume,
            totalHours: pt.totalHours,
            recordCount: pt.recordCount
          });
        });

        // Group by (bulan, typeAlat)
        const aggMap: Record<string, { bulan: string; typeAlat: string; totalVolume: number; totalHours: number; recordCount: number }> = {};
        remapped.forEach(p => {
          const k = `${p.bulan}___${p.typeAlat}`;
          if (!aggMap[k]) {
            aggMap[k] = { ...p };
          } else {
            aggMap[k].totalVolume += p.totalVolume;
            aggMap[k].totalHours += p.totalHours;
            aggMap[k].recordCount += p.recordCount;
          }
        });
        const unifiedPts = Object.values(aggMap).map(p => ({
          ...p,
          totalVolume: Number(p.totalVolume.toFixed(1)),
          totalHours: Number(p.totalHours.toFixed(1))
        }));

        setDataPoints(unifiedPts);
        saveLocalData("yearly_data_points", unifiedPts);
      }

      setIsProcessing(false);
      setFeedback({
        type: "success",
        message: `Data berhasil diselaraskan ke patokan Egy Juli.`
      });
    } catch (e: any) {
      setIsProcessing(false);
      setFeedback({
        type: "error",
        message: `Gagal menyelaraskan data: ${e.message}`
      });
    }
  };

  // Manual cloud refresh
  const handleManualCloudRefresh = async () => {
    setIsSyncingCloud(true);
    try {
      const reports = await fetchAllMonthlyReports();
      setIsSyncingCloud(false);
      setIsCloudConnected(true);
      if (reports && reports.length > 0) {
        processReportsIntoPoints(reports);
        setFeedback({
          type: "success",
          message: `Berhasil sinkron ${reports.length} bulan dari Firestore.`
        });
      } else {
        setFeedback({
          type: "success",
          message: "Koneksi Firestore aktif (belum ada data tersimpan)."
        });
      }
    } catch (err: any) {
      setIsSyncingCloud(false);
      setIsCloudConnected(false);
      setFeedback({
        type: "error",
        message: `Gagal sinkron Firestore: ${err.message || "Koneksi terputus."}`
      });
    }
  };

  // Subscribe to Firebase Firestore real-time updates for uploaded monthly data
  useEffect(() => {
    testConnection();

    setIsSyncingCloud(true);

    // Initial direct fetch
    fetchAllMonthlyReports()
      .then((reports) => {
        setIsSyncingCloud(false);
        setIsCloudConnected(true);
        if (reports && reports.length > 0) {
          processReportsIntoPoints(reports);
        }
      })
      .catch((err) => {
        console.warn("Direct fetch monthly reports note:", err);
      });

    // Real-time listener
    const unsubscribe = subscribeToMonthlyReports(
      (reports: MonthlyReportData[]) => {
        setIsSyncingCloud(false);
        setIsCloudConnected(true);
        if (reports && reports.length > 0) {
          processReportsIntoPoints(reports);
        }
      },
      (err) => {
        setIsSyncingCloud(false);
        setIsCloudConnected(false);
        console.warn("Firestore listener note:", err);
      }
    );

    return () => unsubscribe();
  }, []);

  // Clear all data to let the user start completely fresh and remove from Firebase
  const handleClearAllData = async () => {
    const monthsToDelete = [...uploadedMonths];
    setDataPoints([]);
    setUploadedMonths([]);
    setSelectedHighlightType("SEMUA");
    setStartEvalMonth("Januari");
    setEndEvalMonth("Desember");
    removeLocalData("yearly_data_points");
    removeLocalData("yearly_uploaded_months");
    
    // Remove all documents from Firestore
    for (const mName of monthsToDelete) {
      try {
        await deleteMonthlyReport(`2026_${mName}`);
      } catch (err) {
        console.warn("Gagal menghapus dokumen Firestore:", err);
      }
    }

    setFeedback({
      type: "success",
      message: "Database lokal dan cloud Firebase (fuel-wbs) berhasil dibersihkan. Silakan upload file Excel untuk slot yang diinginkan."
    });
  };

  // Delete data for a specific single month from local state and Firebase
  const handleClearMonthData = async (monthName: string) => {
    const nextPts = dataPoints.filter(d => d.bulan !== monthName);
    const nextMonths = uploadedMonths.filter(m => m !== monthName);
    setDataPoints(nextPts);
    setUploadedMonths(nextMonths);
    saveLocalData("yearly_data_points", nextPts);
    saveLocalData("yearly_uploaded_months", nextMonths);
    
    try {
      await deleteMonthlyReport(`2026_${monthName}`);
    } catch (err) {
      console.warn("Gagal menghapus bulan dari Firestore:", err);
    }

    setFeedback({
      type: "success",
      message: `Data untuk bulan ${monthName} berhasil dihapus dari sistem dan cloud Firebase.`
    });
  };


  // Trigger file upload for a specific month
  const triggerUploadForMonth = (monthName: string) => {
    setSelectedMonthForUpload(monthName);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Trigger file upload for multi-month master file
  const triggerGlobalUpload = () => {
    setSelectedMonthForUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  // Export Entire Yearly Review Module to PDF via html2canvas-pro & jsPDF
  const exportToPdf = async () => {
    setIsExportingPdf(true);
    setFeedback({ type: null, message: "" });
    try {
      const element = document.getElementById("yearly-review-to-export");
      if (!element) {
        throw new Error("Elemen analisis tidak ditemukan.");
      }
      
      const canvas = await html2canvas(element, {
        scale: 2, // super crisp resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#F8F9FA",
        onclone: (clonedDoc) => {
          // Native oklch color converter helper
          const canvasConvert = clonedDoc.createElement("canvas");
          canvasConvert.width = 1;
          canvasConvert.height = 1;
          const ctxConvert = canvasConvert.getContext("2d");

          const convertColor = (colorStr: string): string => {
            if (!colorStr || !colorStr.includes("oklch") || !ctxConvert) return colorStr;
            ctxConvert.fillStyle = colorStr;
            return ctxConvert.fillStyle;
          };

          const allElements = clonedDoc.getElementsByTagName("*");
          for (let i = 0; i < allElements.length; i++) {
            const el = allElements[i] as HTMLElement;
            const computed = window.getComputedStyle(el);
            
            const bg = computed.backgroundColor;
            const color = computed.color;
            const borderTopColor = computed.borderTopColor;
            const borderBottomColor = computed.borderBottomColor;
            const borderLeftColor = computed.borderLeftColor;
            const borderRightColor = computed.borderRightColor;
            const fill = computed.fill;
            const stroke = computed.stroke;

            if (bg && bg.includes("oklch")) {
              el.style.backgroundColor = convertColor(bg);
            }
            if (color && color.includes("oklch")) {
              el.style.color = convertColor(color);
            }
            if (borderTopColor && borderTopColor.includes("oklch")) {
              el.style.borderTopColor = convertColor(borderTopColor);
            }
            if (borderBottomColor && borderBottomColor.includes("oklch")) {
              el.style.borderBottomColor = convertColor(borderBottomColor);
            }
            if (borderLeftColor && borderLeftColor.includes("oklch")) {
              el.style.borderLeftColor = convertColor(borderLeftColor);
            }
            if (borderRightColor && borderRightColor.includes("oklch")) {
              el.style.borderRightColor = convertColor(borderRightColor);
            }
            if (fill && fill.includes("oklch")) {
              el.style.fill = convertColor(fill);
            }
            if (stroke && stroke.includes("oklch")) {
              el.style.stroke = convertColor(stroke);
            }
          }
        }
      });
      
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      
      const imgWidth = 210; // A4 standard width (mm)
      const pageHeight = 297; // A4 standard height (mm)
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;
      
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      pdf.save(`YEARLY_REVIEW_FUEL_ANALYSIS_PT_WBS_${new Date().toISOString().split('T')[0]}.pdf`);
      setFeedback({
        type: "success",
        message: "Laporan PDF Analisis Tahunan WBS successfully generated!"
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `Gagal mengekspor PDF: ${err.message || "Kesalahan internal."}`
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Clear data back to sample
  const handleLoadSampleData = () => {
    setDataPoints(SAMPLE_YEARLY_DATA);
    setUploadedMonths([]);
    setSelectedMonthForUpload(null);
    setSelectedHighlightType("SEMUA");
    setStartEvalMonth("Januari");
    setEndEvalMonth("Juni");
    setFeedback({
      type: "success",
      message: "Mengembalikan database ke dataset Lintas Bulan (Januari - Juni) milik PT. WAHANA BARA SENTOSA."
    });
  };

  const currentMonths = useMemo(() => {
    const list = Array.from(new Set(dataPoints.map(d => d.bulan))) as string[];
    // Sort chronologically using known month indices helper
    const sorted = list.sort((a, b) => {
      const idxA = getMonthFromText(a);
      const idxB = getMonthFromText(b);
      if (idxA !== -1 && idxB !== -1) {
        return idxA - idxB;
      }
      return a.localeCompare(b);
    });

    const minIdx = getMonthFromText(startEvalMonth);
    const maxIdx = getMonthFromText(endEvalMonth);

    return sorted.filter(m => {
      const idxM = getMonthFromText(m);
      if (idxM === -1) return true;
      const startLimit = minIdx !== -1 ? minIdx : 0;
      const endLimit = maxIdx !== -1 ? maxIdx : 11;
      return idxM >= startLimit && idxM <= endLimit;
    });
  }, [dataPoints, startEvalMonth, endEvalMonth]);

  const uniqueEquipmentTypes = useMemo(() => {
    const types = new Set<string>();
    const currentMonthsSet = new Set(currentMonths);
    dataPoints.forEach(d => {
      if (d.typeAlat && currentMonthsSet.has(d.bulan)) {
        types.add(d.typeAlat);
      }
    });
    return Array.from(types).sort();
  }, [dataPoints, currentMonths]);

  // Aggregate global metrics (Total Volume, Hours, General Burn Rate, etc.)
  const aggregatedMetrics = useMemo(() => {
    let totalVolume = 0;
    let totalHours = 0;
    let totalRecords = 0;

    const currentMonthsSet = new Set(currentMonths);
    const filteredPoints = dataPoints.filter(d => 
      currentMonthsSet.has(d.bulan) &&
      (selectedHighlightType === "SEMUA" || d.typeAlat === selectedHighlightType)
    );

    filteredPoints.forEach(d => {
      totalVolume += d.totalVolume;
      totalHours += d.totalHours;
      totalRecords += d.recordCount;
    });

    const averageBurnRate = totalHours > 0 ? Number((totalVolume / totalHours).toFixed(2)) : 0;

    // Discover equipment type with highest burn rate
    const typeAggs: Record<string, { vol: number; hrs: number }> = {};
    filteredPoints.forEach(d => {
      if (!typeAggs[d.typeAlat]) {
        typeAggs[d.typeAlat] = { vol: 0, hrs: 0 };
      }
      typeAggs[d.typeAlat].vol += d.totalVolume;
      typeAggs[d.typeAlat].hrs += d.totalHours;
    });

    let highestBurnType = "N/A";
    let highestBurnValue = 0;

    Object.entries(typeAggs).forEach(([type, val]) => {
      const rate = val.hrs > 0 ? val.vol / val.hrs : 0;
      if (rate > highestBurnValue) {
        highestBurnValue = rate;
        highestBurnType = type;
      }
    });

    return {
      totalVolume,
      totalHours,
      totalRecords,
      averageBurnRate,
      highestBurnType,
      highestBurnValue: Number(highestBurnValue.toFixed(2))
    };
  }, [dataPoints, currentMonths, selectedHighlightType]);

  // Core parser for incoming Excel data.
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFeedback({ type: null, message: "" });
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const dataArr = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: "array" });

        if (workbook.SheetNames.length === 0) {
          throw new Error("Buku kerja Excel tidak didukung atau kosong.");
        }

        const parsedEntries: Array<{
          bulan: string;
          typeAlat: string;
          totalVolume: number;
          totalHours: number;
          recordCount: number;
        }> = [];

        // Parse and detect any Benchmark sheet / "List & FC" / July table (Column C: Equipment, Column D: Egy, Column E: Type)
        const egyLookup: Record<string, string> = {};
        workbook.SheetNames.forEach(sName => {
          const sLower = sName.toLowerCase();
          const sObj = workbook.Sheets[sName];
          const rows = XLSX.utils.sheet_to_json<any[]>(sObj, { header: 1 });
          if (!rows || rows.length < 2) return;
          
          rows.forEach((row) => {
            if (!row || !Array.isArray(row)) return;

            // Case A: List & FC sheet (Col A: Unit, Col B: Type, Col C: Egy)
            if (sLower.includes("list") || sLower.includes("fc")) {
              const unitCell = row[0];
              const typeCell = row[1];
              const egyCell = row[2];
              if (unitCell) {
                const uId = String(unitCell).trim().toUpperCase();
                const typeStr = typeCell ? String(typeCell).trim() : "";
                let egyVal = egyCell !== undefined && egyCell !== null ? String(egyCell).trim() : "";
                const cleanVal = cleanEgyName(egyVal);
                if (!cleanVal || !KNOWN_CANONICAL_EGY.includes(cleanVal)) {
                  egyVal = deriveEgy(uId, typeStr);
                } else {
                  egyVal = cleanVal;
                }
                if (uId && uId !== "NOMOR UNIT" && uId !== "UNIT" && !uId.includes("TANGGAL")) {
                  egyLookup[uId] = egyVal;
                  saveJulyBenchmarkRegistry({ [uId]: { egy: egyVal, type: typeStr } });
                }
              }
            }

            // Case B: ONLY in explicit Benchmark / Master / Patokan sheets (Col C: Equipment, Col D: Egy, Col E: Type)
            // Strictly exclude transaction log sheets (like Issued, Log, Juni, Mei, dll)
            const isExplicitBenchmarkSheet = sLower.includes("benchmark") || sLower.includes("master") || sLower.includes("patokan") || (sLower.includes("juli") && sLower.includes("plan"));
            if (isExplicitBenchmarkSheet) {
              const eqCell = row[2];  // Column C
              const egyCell = row[3]; // Column D
              const typeCell = row[4];// Column E
              if (eqCell && egyCell) {
                const eqStr = String(eqCell).trim().toUpperCase();
                const egyStr = String(egyCell).trim();
                const typeStr = typeCell ? String(typeCell).trim() : "";
                if (
                  eqStr && 
                  !eqStr.includes("EQUIPMENT") && 
                  !eqStr.includes("UNIT") && 
                  !eqStr.includes("NO") && 
                  !eqStr.includes("TANGGAL") &&
                  egyStr &&
                  !egyStr.includes("EGY") &&
                  isNaN(parseFloat(egyStr))
                ) {
                  const cleanEgy = cleanEgyName(egyStr);
                  if (cleanEgy && KNOWN_CANONICAL_EGY.includes(cleanEgy)) {
                    egyLookup[eqStr] = cleanEgy;
                    saveJulyBenchmarkRegistry({ [eqStr]: { egy: cleanEgy, type: typeStr } });
                  }
                }
              }
            }
          });
        });

        // Track how many sheets were parsed successfully
        let sheetsCountParsed = 0;
        const allUnitAggregates: Record<string, { idAlat: string; egy: string; typeAlat: string; totalVolume: number; totalHours: number; count: number; detectedMonthFromDates: Record<string, number> }> = {};
        const parsedRawFuelRecords: FuelRecord[] = [];

        // Find sheet "Issued" specifically if present
        const issuedSheetName = workbook.SheetNames.find(
          s => s.trim().toLowerCase() === "issued" || s.trim().toLowerCase().includes("issue")
        );

        // Process ONLY the "Issued" sheet when available, or valid transaction sheets
        const sheetsToProcess = issuedSheetName
          ? [issuedSheetName]
          : workbook.SheetNames.filter(s => {
              const lower = s.trim().toLowerCase();
              return !lower.includes("list") && !lower.includes("fc") && !lower.includes("legend") && !lower.includes("meta") && !lower.includes("pivot") && !lower.includes("chart") && !lower.includes("summary") && !lower.includes("rekap");
            });

        // Loop target sheets
        for (let i = 0; i < sheetsToProcess.length; i++) {
          const sheetName = sheetsToProcess[i];
          const sheet = workbook.Sheets[sheetName];
          if (!sheet) continue;

          const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
          if (rawRows.length < 2) continue; // too empty

          // Scrape month from sheetName
          let monthIdentifier = sheetName; // fallback sheet name
          const matchMonthIdx = getMonthFromText(sheetName);
          if (matchMonthIdx !== -1) {
            monthIdentifier = MONTH_NAMES_IND[matchMonthIdx];
          }

          // Use SAME mapping format as daily & monthly review
          const isIssuedSheet = sheetName.toLowerCase() === "issued" || sheetName.toLowerCase().includes("issue");
          
          const currentMonthName = selectedMonthForUpload || monthIdentifier;
          const currentMonthIdx = getMonthFromText(currentMonthName);
          const isJuneOrLater = currentMonthIdx >= 5; // 5 = Juni, 6 = Juli, etc.

          let colMap = {
            tanggal: 6,                                                 // Column G (index 6)
            storage: 7,                                                 // Column H (index 7)
            idAlat: 8,                                                  // Column I (index 8) - Nomor Equipment
            typeAlat: isJuneOrLater ? 10 : 9,                           // Column K (index 10) or Column J (index 9)
            hmSebelum: isJuneOrLater ? 11 : 10,                         // Column L (index 11) or Column K (index 10)
            hmSaatIni: isJuneOrLater ? 12 : 11,                         // Column M (index 12) or Column L (index 11)
            volumeFuel: isJuneOrLater ? 14 : 13,                        // Column O (index 14) or Column N (index 13)
            operator: isJuneOrLater ? 18 : 17,                          // Column S or R
            fuelman: isJuneOrLater ? 21 : 20,                           // Column V or U
            shift: isJuneOrLater ? 22 : 21,                             // Column W or V
            jam: isJuneOrLater ? 23 : 22                                // Column X or W
          };

          let detectedHeaderRowIdx = -1;

          if (isIssuedSheet) {
            // Header is around row 107-109, data strictly starts at row 110 (index 109)
            detectedHeaderRowIdx = 108;
          } else {
            // Fallback parser dynamic scanner matching EXACT patterns in App.tsx
            let bestHeaderRowIdx = -1;
            const scanRowsLimit = Math.min(rawRows.length, 30);
            let maxMatches = 0;
            let bestRowColMap = { ...colMap };

            for (let r = 0; r < scanRowsLimit; r++) {
              const row = rawRows[r];
              if (!row || !Array.isArray(row)) continue;
              
              let matches = 0;
              let tempMap = { ...colMap };
              
              row.forEach((cell, cIdx) => {
                if (cell === undefined || cell === null) return;
                const str = String(cell).toLowerCase().trim();
                if (!str) return;
                
                if (str === "tanggal" || str === "tgl" || str === "date") {
                  tempMap.tanggal = cIdx;
                  matches++;
                } else if (
                  str === "tempat" || 
                  str === "storage" || 
                  str === "fuel storage" || 
                  str === "lokasi" || 
                  str === "gate" || 
                  str.includes("storage") || 
                  str.includes("tempat") || 
                  str.includes("gate") ||
                  str.includes("lokasi")
                ) {
                  tempMap.storage = cIdx;
                  matches++;
                } else if (
                  str === "unit" || 
                  str === "nomor unit" || 
                  str === "no unit" || 
                  str === "id alat" || 
                  str === "id_alat" || 
                  str === "unit id" || 
                  str === "no. unit" || 
                  str === "unit_id" || 
                  str.includes("nomor unit") ||
                  str === "no_unit"
                ) {
                  tempMap.idAlat = cIdx;
                  matches++;
                } else if (
                  str === "kategori" || 
                  str === "type" || 
                  str === "type alat" || 
                  str === "type alat berat" || 
                  str === "jenis alat" || 
                  str === "jenis" || 
                  str === "type_alat" || 
                  str === "type_alat_berat" ||
                  str.includes("kategori") ||
                  str.includes("type alat") ||
                  str === "type alat berat / kategori"
                ) {
                  tempMap.typeAlat = cIdx;
                  matches++;
                } else if (
                  str.includes("hm sebelum") || 
                  str.includes("hm sblm") || 
                  str.includes("hm awal") || 
                  str.includes("previous hm") || 
                  str.includes("prev hm") || 
                  str === "hm_sebelumnya" ||
                  str === "hm sbl"
                ) {
                  tempMap.hmSebelum = cIdx;
                  matches++;
                } else if (
                  str.includes("hm saat ini") || 
                  str.includes("hm sesudah") || 
                  str.includes("hm akhir") || 
                  str.includes("hm_saat_ini") || 
                  str.includes("hm_sesudah") || 
                  str.includes("hm sesdh") || 
                  str.includes("hm kini") ||
                  str === "hm ses" ||
                  str === "hm_saat_ini"
                ) {
                  tempMap.hmSaatIni = cIdx;
                  matches++;
                } else if (
                  str.includes("volume") || 
                  str.includes("fuel") || 
                  str.includes("liter") || 
                  str === "vol_fuel" || 
                  str === "qty" || 
                  str === "vol" || 
                  str === "volume fuel (liter)" ||
                  str === "jumlah" ||
                  str === "jumlah (liter)" ||
                  str === "liter"
                ) {
                  tempMap.volumeFuel = cIdx;
                  matches++;
                }
              });

              if (matches > maxMatches) {
                maxMatches = matches;
                bestHeaderRowIdx = r;
                bestRowColMap = tempMap;
              }
            }

            if (maxMatches >= 2) {
              colMap = bestRowColMap;
              detectedHeaderRowIdx = bestHeaderRowIdx;
            }
          }

          // Start reading sheet row by row: For "Issued" sheet, strictly start at row 110 (index 109)
          const startIdx = isIssuedSheet ? 109 : (detectedHeaderRowIdx !== -1 ? detectedHeaderRowIdx + 1 : 0);
          if (colMap.volumeFuel !== -1) {
            sheetsCountParsed++;
            // Aggregate values for this sheet by Egy Alat and Individual Unit
            const sheetAggregates: Record<string, { totalVolume: number; totalHours: number; count: number; detectedMonthFromDates: Record<string, number> }> = {};
            const unitAggregates: Record<string, { idAlat: string; egy: string; typeAlat: string; totalVolume: number; totalHours: number; count: number; detectedMonthFromDates: Record<string, number> }> = {};

            for (let r = startIdx; r < rawRows.length; r++) {
              const row = rawRows[r];
              if (!row || row.length < 2) continue;

              // Check for header repetition or skip row
              const isHeaderRow = row.some(cell => {
                if (typeof cell !== "string") return false;
                const low = cell.toLowerCase();
                return low.includes("tanggal") || low.includes("previous hh") || low.includes("operator");
              });
              if (isHeaderRow) continue;

              // Extract vehicle ID strictly from Column I (index 8) as requested
              let idAlat = "";
              if (row.length > 8 && row[8] !== undefined && row[8] !== null) {
                const rawColI = String(row[8]).trim();
                if (rawColI) {
                  idAlat = rawColI.toUpperCase();
                }
              }
              if (!idAlat && colMap.idAlat !== -1 && colMap.idAlat < row.length && row[colMap.idAlat] !== undefined && row[colMap.idAlat] !== null) {
                const rawId = String(row[colMap.idAlat]).trim();
                if (rawId) {
                  idAlat = rawId.toUpperCase();
                }
              }

              // REJECT INVALID UNIT IDS (Decimal numbers, formulas, totals, single chars, dates)
              if (!idAlat || idAlat.length < 2) continue;
              if (!isNaN(Number(idAlat))) continue; // Exclude numeric decimals like 0.1226313908
              if (idAlat.includes(".") && !isNaN(parseFloat(idAlat))) continue;
              if (idAlat === "C" || idAlat === "A" || idAlat === "B" || idAlat === "D" || idAlat === "TOTAL" || idAlat === "N/A" || idAlat.includes("#REF") || idAlat.includes("DIV/0")) continue;
              if (idAlat.toLowerCase().includes("tanggal") || idAlat.toLowerCase().includes("unit") || idAlat.toLowerCase().includes("nomor") || idAlat.toLowerCase().includes("operator")) continue;

              const typeRaw = colMap.typeAlat !== -1 && colMap.typeAlat < row.length ? row[colMap.typeAlat] : "";
              const typeAlat = typeRaw ? String(typeRaw).trim() : "";
              if (typeAlat.toLowerCase().includes("tanggal") || typeAlat.toLowerCase().includes("operator")) continue;

              // Primary Parameter: Egy Alat derived strictly from Equipment ID (Kolom I) prefix patterns
              const egyAlat = deriveEgy(idAlat, typeAlat);
              if (!egyAlat || egyAlat === "C" || egyAlat.length < 2) continue;

              // Extract volumes and HM
              const volVal = colMap.volumeFuel !== -1 ? parseFloat(row[colMap.volumeFuel]) : 0;
              const prevHmVal = colMap.hmSebelum !== -1 ? parseFloat(row[colMap.hmSebelum]) : 0;
              const currHmVal = colMap.hmSaatIni !== -1 ? parseFloat(row[colMap.hmSaatIni]) : 0;
              
              let hoursVal = currHmVal - prevHmVal;
              let isAnomalyRow = false;

              // Validate HM values and running hours
              // RENTAL UNIT FILTER:
              // 1. If prevHmVal is 0 and currHmVal > 100 (odometer dump like 21903 jam), this is a rental unit without previous HM.
              // 2. If hoursVal > 744 jam (impossible for 1 month / shift) or hoursVal <= 0, it's a rental unit / invalid log.
              // 3. If ID Alat is FD23252 or rental unit, exclude completely.
              const cleanIdUpper = idAlat.toUpperCase();
              if (
                cleanIdUpper === "FD23252" ||
                isNaN(prevHmVal) ||
                isNaN(currHmVal) ||
                prevHmVal < 0 ||
                currHmVal < 0 ||
                hoursVal <= 0 ||
                hoursVal > 744 ||
                (prevHmVal === 0 && currHmVal > 100)
              ) {
                hoursVal = 0;
                isAnomalyRow = true;
              }
              const validVol = isNaN(volVal) || volVal <= 0 ? 0 : volVal;
              if (validVol <= 0 || hoursVal <= 0) {
                isAnomalyRow = true;
              }

              // Scrape exact date from date cell
              let normalizedYmd = "";
              if (colMap.tanggal !== -1 && colMap.tanggal < row.length && row[colMap.tanggal] !== undefined && row[colMap.tanggal] !== null) {
                normalizedYmd = normalizeDateToYMD(row[colMap.tanggal]);
              }

              let rowMonthName = selectedMonthForUpload || monthIdentifier;
              if (normalizedYmd) {
                const parts = normalizedYmd.split("-");
                if (parts.length === 3) {
                  const mIdx = parseInt(parts[1], 10) - 1;
                  if (mIdx >= 0 && mIdx < 12) {
                    if (!selectedMonthForUpload) {
                      rowMonthName = MONTH_NAMES_IND[mIdx];
                    }
                  }
                }
              }

              // Full transaction record date preservation: prioritize exact date extracted from Excel row!
              const fallbackTanggal = normalizedYmd || (rowMonthName ? (() => {
                const mIdx = getMonthFromText(rowMonthName);
                const mPad = mIdx !== -1 ? String(mIdx + 1).padStart(2, "0") : "08";
                return `2026-${mPad}-15`;
              })() : "2026-08-15");

              const rowStorage = colMap.storage !== -1 && colMap.storage < row.length && row[colMap.storage] ? String(row[colMap.storage]).trim() : "Storage Utama Central";
              const rowOperator = colMap.operator !== -1 && colMap.operator < row.length && row[colMap.operator] ? String(row[colMap.operator]).trim() : "Operator Lapangan";
              const rowFuelman = colMap.fuelman !== -1 && colMap.fuelman < row.length && row[colMap.fuelman] ? String(row[colMap.fuelman]).trim() : "Fuelman Onsite";
              const rowShift = colMap.shift !== -1 && colMap.shift < row.length && row[colMap.shift] ? String(row[colMap.shift]).trim() : "Shift 1 - Siang";
              const rowJam = colMap.jam !== -1 && colMap.jam < row.length && row[colMap.jam] ? String(row[colMap.jam]).trim() : "12:00";

              const processedLogItem = processRecord({
                id: `yr-rec-${sheetName}-${r}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
                tanggal: fallbackTanggal,
                storage: rowStorage,
                idAlat: cleanIdUpper,
                typeAlat: typeAlat || deriveEquipmentType(cleanIdUpper),
                egy: egyAlat,
                hmSebelum: isNaN(prevHmVal) ? 0 : prevHmVal,
                hmSaatIni: isNaN(currHmVal) ? 0 : currHmVal,
                volumeFuel: validVol,
                operator: rowOperator,
                fuelman: rowFuelman,
                shift: rowShift,
                jam: rowJam
              });

              parsedRawFuelRecords.push(processedLogItem);

              const groupKey = egyAlat;
              if (!sheetAggregates[groupKey]) {
                sheetAggregates[groupKey] = { totalVolume: 0, totalHours: 0, count: 0, detectedMonthFromDates: {} };
              }

              const unitKey = idAlat || `ANON_${egyAlat}`;
              if (!unitAggregates[unitKey]) {
                unitAggregates[unitKey] = { idAlat: unitKey, egy: egyAlat, typeAlat: typeAlat || egyAlat, totalVolume: 0, totalHours: 0, count: 0, detectedMonthFromDates: {} };
              }

              // Aggregate valid operational fuel transactions (exclude rental units with 0 HM)
              if (!isAnomalyRow && hoursVal > 0) {
                sheetAggregates[groupKey].totalVolume += validVol;
                sheetAggregates[groupKey].totalHours += hoursVal;
                sheetAggregates[groupKey].count += 1;
                sheetAggregates[groupKey].detectedMonthFromDates[rowMonthName] = (sheetAggregates[groupKey].detectedMonthFromDates[rowMonthName] || 0) + 1;

                unitAggregates[unitKey].totalVolume += validVol;
                unitAggregates[unitKey].totalHours += hoursVal;
                unitAggregates[unitKey].count += 1;
                unitAggregates[unitKey].detectedMonthFromDates[rowMonthName] = (unitAggregates[unitKey].detectedMonthFromDates[rowMonthName] || 0) + 1;

                if (!allUnitAggregates[unitKey]) {
                  allUnitAggregates[unitKey] = { idAlat: unitKey, egy: egyAlat, typeAlat: typeAlat || egyAlat, totalVolume: 0, totalHours: 0, count: 0, detectedMonthFromDates: {} };
                }
                allUnitAggregates[unitKey].totalVolume += validVol;
                allUnitAggregates[unitKey].totalHours += hoursVal;
                allUnitAggregates[unitKey].count += 1;
                allUnitAggregates[unitKey].detectedMonthFromDates[rowMonthName] = (allUnitAggregates[unitKey].detectedMonthFromDates[rowMonthName] || 0) + 1;
              }
            }

            // Convert sheetAggregates to data points
            Object.entries(sheetAggregates).forEach(([egyAlatKey, val]) => {
              if (val.totalVolume === 0 && val.totalHours === 0) return; // skip silent items

              // Determine the final dominant month name for this sheet group
              let bestMonth = selectedMonthForUpload || monthIdentifier;
              if (!selectedMonthForUpload) {
                let maxCount = 0;
                Object.entries(val.detectedMonthFromDates).forEach(([mName, count]) => {
                  if (count > maxCount) {
                    maxCount = count;
                    bestMonth = mName;
                  }
                });
              }

              parsedEntries.push({
                bulan: bestMonth,
                typeAlat: egyAlatKey, // Primary parameter is Egy
                totalVolume: Number(val.totalVolume.toFixed(1)),
                totalHours: Number(val.totalHours.toFixed(1)),
                recordCount: val.count
              });
            });
          }
        }

        if (parsedEntries.length === 0) {
          throw new Error("Sistem gagal mengidentifikasi kolom data (Tanggal, Type Alat, Volume, HM) di lembar kerja Anda.");
        }

        // Calculate overall analytics and summaries for pre-commit review
        const totalValidVol = parsedEntries.reduce((sum, p) => sum + p.totalVolume, 0);
        const totalValidHrs = parsedEntries.reduce((sum, p) => sum + p.totalHours, 0);
        const totalValidRecCount = parsedEntries.reduce((sum, p) => sum + p.recordCount, 0);
        const overallBurn = totalValidHrs > 0 ? Number((totalValidVol / totalValidHrs).toFixed(2)) : 0;

        // Group by Canonical Egy for Master Juli Benchmarking Breakdown
        const egyGroupMap: Record<string, { totalVol: number; totalHrs: number; count: number; units: Set<string> }> = {};
        Object.values(allUnitAggregates).forEach(u => {
          const canonEgy = cleanEgyName(deriveEgy(u.idAlat, u.typeAlat || u.egy));
          if (!egyGroupMap[canonEgy]) {
            egyGroupMap[canonEgy] = { totalVol: 0, totalHrs: 0, count: 0, units: new Set() };
          }
          egyGroupMap[canonEgy].totalVol += u.totalVolume;
          egyGroupMap[canonEgy].totalHrs += u.totalHours;
          egyGroupMap[canonEgy].count += u.count;
          if (u.idAlat && !u.idAlat.startsWith("ANON_")) {
            egyGroupMap[canonEgy].units.add(u.idAlat);
          }
        });

        const egySummaries: AnalyzedEgySummary[] = Object.entries(egyGroupMap).map(([egyName, val]) => {
          const burn = val.totalHrs > 0 ? Number((val.totalVol / val.totalHrs).toFixed(2)) : 0;
          const benchmark = activeEgyPlans[egyName] || MASTER_JULY_BENCHMARKS[egyName] || 15.0;
          const diff = burn - benchmark;
          let status: "optimal" | "warning" | "high" | "info" = "optimal";
          let statusText = "Sesuai Patokan";

          if (burn === 0) {
            status = "info";
            statusText = "HM/Volume 0";
          } else if (diff > 5.0) {
            status = "high";
            statusText = "Di Atas Target";
          } else if (diff > 2.0) {
            status = "warning";
            statusText = "Perlu Perhatian";
          } else {
            status = "optimal";
            statusText = "Efisiensi Normal";
          }

          return {
            egy: egyName,
            unitCount: val.units.size > 0 ? val.units.size : 1,
            units: Array.from(val.units),
            totalVolume: Number(val.totalVol.toFixed(1)),
            totalHours: Number(val.totalHrs.toFixed(1)),
            burnRate: burn,
            benchmarkRate: benchmark,
            status,
            statusText
          };
        }).sort((a, b) => b.totalVolume - a.totalVolume);

        // Map Unit-Level Details (strictly operational units with totalHours > 0)
        const unitDetails: AnalyzedUnitDetail[] = Object.values(allUnitAggregates)
          .filter(u => u.totalHours > 0)
          .map(u => {
            const canonEgy = cleanEgyName(deriveEgy(u.idAlat, u.typeAlat || u.egy));
            const burn = u.totalHours > 0 ? Number((u.totalVolume / u.totalHours).toFixed(2)) : 0;
            return {
              idAlat: u.idAlat,
              egy: canonEgy,
              typeAlat: u.typeAlat,
              totalVolume: Number(u.totalVolume.toFixed(1)),
              totalHours: Number(u.totalHours.toFixed(1)),
              burnRate: burn,
              recordCount: u.count,
              isKnownBenchmark: !!MASTER_JULY_BENCHMARKS[canonEgy]
            };
          }).sort((a, b) => b.totalVolume - a.totalVolume);

        // Find dominant month and multi-month breakdown from entries
        const monthBreakdown: Record<string, { totalVolume: number; totalHours: number; count: number }> = {};
        parsedEntries.forEach(p => {
          if (!monthBreakdown[p.bulan]) {
            monthBreakdown[p.bulan] = { totalVolume: 0, totalHours: 0, count: 0 };
          }
          monthBreakdown[p.bulan].totalVolume += p.totalVolume;
          monthBreakdown[p.bulan].totalHours += p.totalHours;
          monthBreakdown[p.bulan].count += p.recordCount;
        });

        let dominantMonth = selectedMonthForUpload || "Juli";
        if (!selectedMonthForUpload) {
          let maxFreq = 0;
          Object.entries(monthBreakdown).forEach(([mName, stat]) => {
            if (stat.count > maxFreq) {
              maxFreq = stat.count;
              dominantMonth = mName;
            }
          });
        }

        const anomalyRecCount = parsedRawFuelRecords.filter(r => r.isAnomaly).length;

        const stagingResult: AnalyzedUploadResult = {
          fileName: file.name,
          fileSize: file.size,
          sheetCount: sheetsCountParsed || workbook.SheetNames.length,
          sheetNames: workbook.SheetNames,
          detectedMonth: dominantMonth,
          detectedYear: 2026,
          totalRecords: parsedRawFuelRecords.length,
          validRecords: totalValidRecCount,
          anomalyRecords: anomalyRecCount,
          totalVolume: Number(totalValidVol.toFixed(1)),
          totalHours: Number(totalValidHrs.toFixed(1)),
          avgBurnRate: overallBurn,
          egySummaries,
          unitDetails,
          multiMonthMap: monthBreakdown,
          rawPayload: {
            parsedEntries,
            unitAggregates: Object.values(allUnitAggregates),
            rawFuelRecords: parsedRawFuelRecords
          }
        };

        // Open Analysis Modal for verification before committing
        setAnalysisStagingData(stagingResult);
        setIsAnalysisModalOpen(true);
        setFeedback({
          type: "success",
          message: `File "${file.name}" berhasil dianalisa (${unitDetails.length} unit terdeteksi)! Silakan periksa hasil validasi pada pop-up sebelum diterapkan ke Yearly Review.`
        });
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: `Gagal membaca file Yearly Review: ${err.message || "Periksa kesesuaian data."}`
        });
      } finally {
        setIsProcessing(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Callback to commit and apply the staged analyzed data once user confirms
  const handleConfirmAnalysis = async (confirmedMonth: string, stagingData: AnalyzedUploadResult) => {
    setIsApplyingAnalysis(true);
    try {
      const rawPayload = stagingData.rawPayload;
      if (!rawPayload) return;

      const rawEntries = (rawPayload.parsedEntries || []) as Array<{
        bulan: string;
        typeAlat: string;
        totalVolume: number;
        totalHours: number;
        recordCount: number;
      }>;

      // Group entries by month. If the file has multiple months detected from row dates, keep them separate;
      // If user selected a specific month override or single month, use confirmedMonth.
      const distinctMonths = Array.from(new Set(rawEntries.map(e => e.bulan))).filter(Boolean);
      const isMultiMonthFile = !selectedMonthForUpload && distinctMonths.length > 1;

      const entriesToProcess = rawEntries.map(p => ({
        ...p,
        bulan: isMultiMonthFile ? p.bulan : confirmedMonth
      }));

      // Group and aggregate entries by (bulan, typeAlat)
      const map: Record<string, typeof entriesToProcess[0]> = {};
      entriesToProcess.forEach(p => {
        const k = `${p.bulan}__${p.typeAlat}`;
        if (!map[k]) {
          map[k] = { ...p };
        } else {
          map[k].totalVolume += p.totalVolume;
          map[k].totalHours += p.totalHours;
          map[k].recordCount += p.recordCount;
        }
      });

      const aggregatedParsed = Object.values(map).map(p => ({
        ...p,
        totalVolume: Number(p.totalVolume.toFixed(1)),
        totalHours: Number(p.totalHours.toFixed(1))
      }));

      // Extract all months that are affected
      const affectedMonths = isMultiMonthFile ? distinctMonths : [confirmedMonth];

      const rawLogs = (rawPayload.rawFuelRecords && Array.isArray(rawPayload.rawFuelRecords))
        ? (rawPayload.rawFuelRecords as FuelRecord[])
        : [];

      // If not a multi-month file, ensure all logs match the confirmed month
      const alignedLogs = rawLogs.map(r => {
        if (!isMultiMonthFile) {
          const targetMonthIndex = getMonthFromText(confirmedMonth);
          const targetMonthPad = targetMonthIndex !== -1 ? String(targetMonthIndex + 1).padStart(2, "0") : "08";
          if (!r.tanggal.includes(`-${targetMonthPad}-`)) {
            const parts = r.tanggal.split("-");
            const dayPart = parts.length === 3 ? parts[2] : "15";
            return { ...r, tanggal: `2026-${targetMonthPad}-${dayPart}` };
          }
        }
        return r;
      });

      // Save each affected month to Cloud Firestore
      for (const mName of affectedMonths) {
        const monthEntries = aggregatedParsed.filter(p => p.bulan === mName);
        const mTotalVol = monthEntries.reduce((sum, p) => sum + p.totalVolume, 0);
        const mTotalHrs = monthEntries.reduce((sum, p) => sum + p.totalHours, 0);
        const mRecordCount = monthEntries.reduce((sum, p) => sum + p.recordCount, 0);
        const mIdx = getMonthFromText(mName);
        const mPad = mIdx !== -1 ? String(mIdx + 1).padStart(2, "0") : "";

        // Extract transaction records specific to this month
        const monthRecords = alignedLogs.filter(r => mPad && r.tanggal.startsWith(`2026-${mPad}`));

        const unitSummaries = (stagingData.unitDetails || []).map(u => ({
          idAlat: u.idAlat,
          egy: u.egy,
          typeAlat: u.typeAlat,
          totalVolume: u.totalVolume,
          totalHours: u.totalHours,
          burnRate: u.burnRate,
          recordCount: u.recordCount
        }));

        const reportPayload: MonthlyReportData = {
          id: `2026_${mName}`,
          bulan: mName,
          monthIndex: mIdx !== -1 ? mIdx : 0,
          year: 2026,
          fileName: stagingData.fileName,
          uploadedAt: new Date().toISOString(),
          totalVolume: Number(mTotalVol.toFixed(1)),
          totalHours: Number(mTotalHrs.toFixed(1)),
          recordCount: mRecordCount,
          avgBurnRate: mTotalHrs > 0 ? Number((mTotalVol / mTotalHrs).toFixed(2)) : 0,
          typeSummaries: monthEntries.map(p => ({
            egy: p.typeAlat,
            typeAlat: p.typeAlat,
            totalVolume: p.totalVolume,
            totalHours: p.totalHours,
            recordCount: p.recordCount,
            burnRate: p.totalHours > 0 ? Number((p.totalVolume / p.totalHours).toFixed(2)) : 0
          })),
          unitSummaries,
          records: monthRecords.length > 0 ? monthRecords : undefined
        };

        try {
          await saveMonthlyReportToFirestore(reportPayload);
        } catch (cloudErr) {
          console.warn(`Penyimpanan Firestore backend notice untuk ${mName}:`, cloudErr);
        }
      }

      // Update benchmark registry for all detected equipment IDs to synchronize all months (Jan-Jul & onwards)
      if (stagingData.unitDetails && stagingData.unitDetails.length > 0) {
        const newRegistryEntries: Record<string, { egy: string; type?: string }> = {};
        stagingData.unitDetails.forEach(u => {
          if (u.idAlat && u.egy) {
            newRegistryEntries[u.idAlat] = { egy: u.egy, type: u.typeAlat };
          }
        });
        saveJulyBenchmarkRegistry(newRegistryEntries);
      }

      // Merge into local state & storage for Yearly Review
      const clean = dataPoints.filter(d => !affectedMonths.includes(d.bulan));
      const nextPts = [...clean, ...aggregatedParsed];
      const nextMonths = Array.from(new Set([...uploadedMonths, ...affectedMonths]));

      setDataPoints(nextPts);
      setUploadedMonths(nextMonths);
      saveLocalData("yearly_data_points", nextPts);
      saveLocalData("yearly_uploaded_months", nextMonths);

      // Merge raw transaction logs into global fuel_records so Monthly Review can analyze ANY and ALL months immediately
      if (alignedLogs.length > 0) {
        const currentSavedRecords = getSyncLocalData<FuelRecord[]>("fuel_records", []);

        // Filter out existing logs for affected months to prevent duplicate stacking
        const existingFiltered = currentSavedRecords.filter(r => {
          if (!r.tanggal) return true;
          return !affectedMonths.some(mName => {
            const mIdx = getMonthFromText(mName);
            const mPad = mIdx !== -1 ? String(mIdx + 1).padStart(2, "0") : "";
            return mPad && r.tanggal.startsWith(`2026-${mPad}`);
          });
        });

        const mergedRecords = [...existingFiltered, ...alignedLogs];
        saveLocalData("fuel_records", mergedRecords);
        if (onSyncRecords) {
          onSyncRecords(mergedRecords);
        }

        // Persist the combined multi-month dataset directly into Firestore
        saveActiveDatasetToFirestore({
          records: mergedRecords,
          plans: {},
          startDate: "2026-01-01",
          endDate: "2026-12-31",
          fileName: stagingData.fileName
        }).catch(cloudErr => console.warn("Firestore active dataset sync notice:", cloudErr));
      }

      setIsAnalysisModalOpen(false);
      setAnalysisStagingData(null);
      setSelectedMonthForUpload(null);

      setFeedback({
        type: "success",
        message: isMultiMonthFile
          ? `Data ${affectedMonths.length} bulan (${affectedMonths.join(", ")}) berhasil divalidasi dan disinkronkan langsung ke Monthly Review dan Yearly Review!`
          : `Data bulan ${confirmedMonth} berhasil divalidasi dan diterapkan ke Yearly Review! (${aggregatedParsed.length} kategori tipe alat tersimpan di Cloud Firestore).`
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: `Gagal menerapkan data hasil analisa: ${err.message || "Periksa kesesuaian data."}`
      });
    } finally {
      setIsApplyingAnalysis(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUploadFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Organize dataset into a grid helper representing MONTH over EQUIPMENT_TYPE
  const pivotTableData = useMemo(() => {
    // Generate a map structure
    const map: Record<string, Record<string, { vol: number; hrs: number; count: number }>> = {};

    uniqueEquipmentTypes.forEach(t => {
      map[t] = {};
      currentMonths.forEach(m => {
        map[t][m] = { vol: 0, hrs: 0, count: 0 };
      });
    });

    dataPoints.forEach(d => {
      if (map[d.typeAlat] && map[d.typeAlat][d.bulan]) {
        map[d.typeAlat][d.bulan].vol += d.totalVolume;
        map[d.typeAlat][d.bulan].hrs += d.totalHours;
        map[d.typeAlat][d.bulan].count += d.recordCount;
      }
    });

    return map;
  }, [uniqueEquipmentTypes, currentMonths, dataPoints]);

  // Unit Level Aggregator for drilldown month-by-month
  interface UnitMonthlyAgg {
    idAlat: string;
    legacyId: string;
    hasRenamedPattern: boolean;
    egy: string;
    typeAlat: string;
    monthly: Record<string, { vol: number; hrs: number; count: number; burnRate: number | null }>;
    totalVol: number;
    totalHrs: number;
    overallBurnRate: number;
    unitPlan: number;
  }

  const unitMonthlyMap = useMemo(() => {
    const map: Record<string, UnitMonthlyAgg> = {};

    // 1. Gather all raw/historical fuel records from props, storage, or initial template
    const allRecords = (propRecords && propRecords.length > 0)
      ? propRecords 
      : getSyncLocalData<FuelRecord[]>("fuel_records", INITIAL_FUEL_DATA);

    allRecords.forEach(r => {
      if (!r.idAlat) return;
      const rawId = r.idAlat.trim().toUpperCase();
      // Resolve to canonical 23xxx unit id (e.g. RS15001 -> RS23001, FD15001 -> FD23001)
      const canonicalId = getCanonicalUnitId(rawId).toUpperCase();
      const legacyId = getHistoricalLegacyUnitId(canonicalId).toUpperCase();
      const hasRenamedPattern = canonicalId !== legacyId;

      const canonEgy = cleanEgyName(r.egy || deriveEgy(canonicalId, r.typeAlat)).toUpperCase();
      const modelType = r.typeAlat || deriveEquipmentType(canonicalId);

      let monthName = "";
      if (r.tanggal) {
        const ymd = normalizeDateToYMD(r.tanggal);
        if (ymd) {
          const parts = ymd.split("-");
          if (parts.length === 3) {
            const mIdx = parseInt(parts[1], 10) - 1;
            if (mIdx >= 0 && mIdx < 12) {
              monthName = MONTH_NAMES_IND[mIdx];
            }
          }
        }
      }
      if (!monthName) return;

      if (!map[canonicalId]) {
        const unitSpecificPlan = propUnitPlans?.[canonicalId]?.planFuelBurn 
          || propUnitPlans?.[rawId]?.planFuelBurn
          || activeEgyPlans[canonEgy] 
          || DEFAULT_TYPE_PLANS[canonEgy] 
          || DEFAULT_TYPE_PLANS[modelType] 
          || 0;

        map[canonicalId] = {
          idAlat: canonicalId,
          legacyId: legacyId,
          hasRenamedPattern: hasRenamedPattern,
          egy: canonEgy,
          typeAlat: modelType,
          monthly: {},
          totalVol: 0,
          totalHrs: 0,
          overallBurnRate: 0,
          unitPlan: unitSpecificPlan
        };
      }

      if (!map[canonicalId].monthly[monthName]) {
        map[canonicalId].monthly[monthName] = { vol: 0, hrs: 0, count: 0, burnRate: null };
      }

      if (!r.isAnomaly && r.selisihHm > 0 && r.volumeFuel > 0) {
        map[canonicalId].monthly[monthName].vol += r.volumeFuel;
        map[canonicalId].monthly[monthName].hrs += r.selisihHm;
        map[canonicalId].monthly[monthName].count += 1;
        map[canonicalId].totalVol += r.volumeFuel;
        map[canonicalId].totalHrs += r.selisihHm;
      }
    });

    // Calculate rates for each unit
    Object.values(map).forEach(u => {
      Object.keys(u.monthly).forEach(m => {
        const mEntry = u.monthly[m];
        if (mEntry.hrs > 0) {
          mEntry.burnRate = Number((mEntry.vol / mEntry.hrs).toFixed(1));
        } else {
          mEntry.burnRate = null;
        }
      });
      u.overallBurnRate = u.totalHrs > 0 ? Number((u.totalVol / u.totalHrs).toFixed(1)) : 0;
    });

    return map;
  }, [propRecords, propUnitPlans, activeEgyPlans]);

  // Group units by clean canonical EGY name
  const unitsByEgy = useMemo(() => {
    const groups: Record<string, UnitMonthlyAgg[]> = {};
    Object.values(unitMonthlyMap).forEach((unit: UnitMonthlyAgg) => {
      const egyKey = cleanEgyName(unit.egy).toUpperCase();
      if (!groups[egyKey]) {
        groups[egyKey] = [];
      }
      groups[egyKey].push(unit);
    });

    // Sort units within each EGY naturally by Unit ID
    Object.keys(groups).forEach(k => {
      groups[k].sort((a, b) => a.idAlat.localeCompare(b.idAlat, undefined, { numeric: true }));
    });

    return groups;
  }, [unitMonthlyMap]);

  // Sort EGY categories (Bulldozer, Excavator, etc.) by worst achievement / over plan by default
  const sortedEquipmentTypes = useMemo(() => {
    const types = uniqueEquipmentTypes.filter((t) => selectedHighlightType === "SEMUA" || selectedHighlightType === t);

    // Calculate comprehensive stats for each EGY
    const typeStats = types.map(type => {
      const cleanType = cleanEgyName(type).toUpperCase();
      const planValue = activeEgyPlans[cleanType] || activeEgyPlans[type] || DEFAULT_TYPE_PLANS[cleanType] || DEFAULT_TYPE_PLANS[type] || 0;
      
      let totalVol = 0;
      let totalHrs = 0;
      let activeMonthsCount = 0;
      
      currentMonths.forEach(m => {
        const cell = pivotTableData[type]?.[m];
        if (cell && cell.count > 0) {
          totalVol += cell.vol;
          totalHrs += cell.hrs;
          activeMonthsCount++;
        }
      });

      const actualRate = totalHrs > 0 ? totalVol / totalHrs : 0;
      const variance = planValue > 0 ? (actualRate - planValue) : 0;
      const pctOver = planValue > 0 ? ((actualRate - planValue) / planValue) * 100 : 0;
      const isOver = planValue > 0 && actualRate > (planValue + 0.05);

      return {
        type,
        cleanType,
        planValue,
        actualRate,
        variance,
        pctOver,
        isOver,
        totalVol,
        totalHrs,
        activeMonthsCount
      };
    });

    if (activeMonthSort) {
      const { month, direction } = activeMonthSort;
      typeStats.sort((a, b) => {
        const cellA = pivotTableData[a.type]?.[month];
        const cellB = pivotTableData[b.type]?.[month];
        const valA = cellA && cellA.hrs > 0 ? cellA.vol / cellA.hrs : (direction === "desc" ? -9999 : 9999);
        const valB = cellB && cellB.hrs > 0 ? cellB.vol / cellB.hrs : (direction === "desc" ? -9999 : 9999);
        return direction === "desc" ? valB - valA : valA - valB;
      });
      return typeStats.map(s => s.type);
    }

    switch (sortOption) {
      case "worst_achievement": // Default: Over-plan highest first (worst achievement)
        typeStats.sort((a, b) => {
          if (a.planValue > 0 && b.planValue > 0) {
            return b.variance - a.variance;
          }
          if (a.planValue > 0) return a.variance > 0 ? -1 : 1;
          if (b.planValue > 0) return b.variance > 0 ? 1 : -1;
          return b.actualRate - a.actualRate;
        });
        break;

      case "best_achievement": // Under-plan / most fuel-efficient first
        typeStats.sort((a, b) => {
          if (a.planValue > 0 && b.planValue > 0) {
            return a.variance - b.variance;
          }
          if (a.planValue > 0) return a.variance <= 0 ? -1 : 1;
          if (b.planValue > 0) return b.variance <= 0 ? 1 : -1;
          return a.actualRate - b.actualRate;
        });
        break;

      case "name_asc":
        typeStats.sort((a, b) => a.type.localeCompare(b.type));
        break;

      case "name_desc":
        typeStats.sort((a, b) => b.type.localeCompare(a.type));
        break;

      case "volume_desc":
        typeStats.sort((a, b) => b.totalVol - a.totalVol);
        break;

      case "hours_desc":
        typeStats.sort((a, b) => b.totalHrs - a.totalHrs);
        break;
    }

    return typeStats.map(s => s.type);
  }, [uniqueEquipmentTypes, selectedHighlightType, activeEgyPlans, currentMonths, pivotTableData, sortOption, activeMonthSort]);

  // Compute Maximum Metrics for scaling our custom SVG Graph
  const chartMaxVal = useMemo(() => {
    let max = 1;
    const typesToEvaluate = selectedHighlightType === "SEMUA"
      ? uniqueEquipmentTypes
      : [selectedHighlightType];

    typesToEvaluate.forEach(t => {
      currentMonths.forEach(m => {
        const entry = pivotTableData[t]?.[m];
        if (!entry) return;

        let val = 0;
        if (activeAnalysisMetric === "burnRate") {
          val = entry.hrs > 0 ? entry.vol / entry.hrs : 0;
        } else if (activeAnalysisMetric === "volume") {
          val = entry.vol;
        } else {
          val = entry.hrs;
        }

        if (val > max) max = val;
      });
    });

    if (selectedHighlightType !== "SEMUA" && activeAnalysisMetric === "burnRate") {
      const cleanType = cleanEgyName(selectedHighlightType).toUpperCase();
      const planVal = activeEgyPlans[cleanType] || DEFAULT_TYPE_PLANS[cleanType] || 0;
      if (planVal > max) max = planVal;
    }

    return max * 1.22; // Give 22% padding at top for labels
  }, [uniqueEquipmentTypes, currentMonths, pivotTableData, activeAnalysisMetric, selectedHighlightType, activeEgyPlans]);

  // Modern soft distinctive colors for lines/areas of types
  const typeColors: Record<string, string> = {
    "Excavator PC200": "#4682B4",       // Steel Blue
    "Dump Truck HD785": "#E11D48",      // Rose/Red
    "Bulldozer D85SS": "#D97706",       // Amber
    "Motor Grader GD511": "#10B981",    // Emerald
    "Wheel Loader WA500": "#8B5CF6",    // Purple
  };

  const getColorFor = (type: string, idx: number) => {
    if (typeColors[type]) return typeColors[type];
    const defaultColors = ["#F59E0B", "#14B8A6", "#EC4899", "#3B82F6", "#6366F1"];
    return defaultColors[idx % defaultColors.length];
  };

  return (
    <div className="space-y-6 font-sans animate-fade-in" id="yearly-review-to-export">
      {/* EVALUATION PERIOD FILTER DECK */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Calendar className="w-6 h-6 text-[#4682B4] shrink-0" />
          <div>
            <h4 className="text-sm font-black text-slate-800">Periode Evaluasi</h4>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Mulai:</span>
            <div className="relative">
              <select
                value={startEvalMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  setStartEvalMonth(val);
                  const startIdx = getMonthFromText(val);
                  const endIdx = getMonthFromText(endEvalMonth);
                  if (startIdx > endIdx) {
                    setEndEvalMonth(val);
                  }
                }}
                className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold pl-3 pr-8 py-2 rounded-lg cursor-pointer transition focus:ring-2 focus:ring-[#4682B4] focus:outline-none appearance-none min-w-[120px]"
              >
                {MONTH_NAMES_IND.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-450">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Sampai:</span>
            <div className="relative">
              <select
                value={endEvalMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  setEndEvalMonth(val);
                  const startIdx = getMonthFromText(startEvalMonth);
                  const endIdx = getMonthFromText(val);
                  if (endIdx < startIdx) {
                    setStartEvalMonth(val);
                  }
                }}
                className="text-xs bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-mono font-bold pl-3 pr-8 py-2 rounded-lg cursor-pointer transition focus:ring-2 focus:ring-[#4682B4] focus:outline-none appearance-none min-w-[120px]"
              >
                {MONTH_NAMES_IND.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-450">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setStartEvalMonth("Januari");
              setEndEvalMonth("Desember");
              setFeedback({
                type: "success",
                message: "Saringan rentang evaluasi diatur ulang ke Januari - Desember."
              });
            }}
            className="text-[10px] font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-2.5 rounded-lg border border-slate-250 transition active:scale-95 cursor-pointer"
          >
            Reset filter
          </button>
        </div>
      </div>

      {/* Dynamic Calculated Metrik Year-Round */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">VOLUME FUEL</p>
            <p className="text-xl font-black text-slate-800">
              {aggregatedMetrics.totalVolume.toLocaleString("id-ID")} <span className="text-xs font-semibold text-slate-500">Liter</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold">Total volume fuel lintas bulan terdaftar</p>
          </div>
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">TOTAL HOUR METER</p>
            <p className="text-xl font-black text-slate-800">
              {aggregatedMetrics.totalHours.toLocaleString("id-ID")} <span className="text-xs font-semibold text-slate-500">Jam</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold">Total jam running dikalkulasikan</p>
          </div>
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">FUEL BURN MONTHLY</p>
            <p className="text-xl font-black text-[#4682B4]">
              {aggregatedMetrics.averageBurnRate} <span className="text-xs font-semibold text-slate-500">L / Jam</span>
            </p>
            <p className="text-[10px] text-slate-500 font-bold">Rata-rata fuel burn rate gabungan</p>
          </div>
          <div className="p-2.5 bg-slate-50 text-slate-600 rounded-lg">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">UNIT ALAT TERBOROS</p>
            <p className="text-sm font-extrabold text-[#E11D48] leading-tight truncate max-w-[160px]">
              {aggregatedMetrics.highestBurnType}
            </p>
            <p className="text-[11px] font-bold text-slate-600">
              Rasio: {aggregatedMetrics.highestBurnValue} L/Jam
            </p>
          </div>
          <div className="p-2.5 bg-rose-50 text-[#E11D48] rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Stacked Layout: Graphic Dashboard (Top) & Highlight Pivot Grid (Bottom) */}
      <div className="space-y-6">
        
        {/* CHART CARD (Full-Width) */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#4682B4]" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Grafik Fuel Burn</h3>
                <p className="text-[10px] text-slate-400 font-bold">Gunakan menu pilihan tipe alat di bawah untuk memfilter grafik secara dinamis</p>
              </div>
            </div>
 
            {/* Metric switches & Label Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 p-1.5 rounded-lg border border-slate-200/50 self-start sm:self-center">
                <button
                  onClick={() => setActiveAnalysisMetric("burnRate")}
                  className={`text-[10px] font-extrabold px-3 py-1.5 rounded transition active:scale-95 cursor-pointer ${
                    activeAnalysisMetric === "burnRate"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  L/Jam
                </button>
                <button
                  onClick={() => setActiveAnalysisMetric("volume")}
                  className={`text-[10px] font-extrabold px-3 py-1.5 rounded transition active:scale-95 cursor-pointer ${
                    activeAnalysisMetric === "volume"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  Volume (L)
                </button>
                <button
                  onClick={() => setActiveAnalysisMetric("hours")}
                  className={`text-[10px] font-extrabold px-3 py-1.5 rounded transition active:scale-95 cursor-pointer ${
                    activeAnalysisMetric === "hours"
                      ? "bg-white text-slate-800 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  HM (Jam)
                </button>
              </div>

              <button
                onClick={() => setShowChartLabels(prev => !prev)}
                className={`flex items-center gap-1.5 text-[10px] font-extrabold px-3 py-2 rounded-lg border transition active:scale-95 cursor-pointer ${
                  showChartLabels
                    ? "bg-blue-50 border-blue-200 text-[#4682B4] shadow-2xs"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600"
                }`}
                title={showChartLabels ? "Sembunyikan angka visual di grafik" : "Tampilkan angka visual di grafik"}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>{showChartLabels ? "Angka: Tampil" : "Angka: Sembunyi"}</span>
              </button>
            </div>
          </div>

          {/* Interactive Legend Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kategori Tipe Alat Berat:</span>
            <div className="relative">
              <select
                id="equipment-type-dropdown"
                value={selectedHighlightType}
                onChange={(e) => setSelectedHighlightType(e.target.value)}
                className="text-xs bg-white border border-slate-250 text-slate-700 px-3.5 py-2 pr-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4] font-bold cursor-pointer transition appearance-none min-w-[200px]"
              >
                <option value="SEMUA">★ Tampilkan Semua Kategori</option>
                {uniqueEquipmentTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
            {selectedHighlightType !== "SEMUA" && (
              <span className="text-[10px] bg-[#4682B4]/10 text-[#4682B4] px-2.5 py-1 rounded-lg font-extrabold">
                Menampilkan Hanya: {selectedHighlightType}
              </span>
            )}
          </div>

          {/* CUSTOM HIGH-FIDELITY RESPONSIVE SVG GRAPH PLOTTER */}
          <div className="relative py-2 bg-slate-50/50 rounded-xl border border-slate-100 p-4">
            {currentMonths.length < 2 ? (
              <div className="h-[250px] flex flex-col items-center justify-center text-center text-slate-400">
                <Info className="w-8 h-8 opacity-40 mb-1 text-slate-600" />
                <p className="text-xs font-bold">Data tidak cukup untuk menggambar tren.</p>
                <p className="text-[10px] text-slate-400 mt-1">Harap pastikan workbook Excel Anda berisi minimal 2 bulan/sheet pengisian.</p>
              </div>
            ) : (
              <svg viewBox="0 0 850 305" className="w-full h-auto overflow-visible select-none">
                {/* Horizontal Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => {
                  const yVal = 250 - p * 200;
                  const labelValue = (activeAnalysisMetric === "burnRate")
                    ? (chartMaxVal * p).toFixed(1)
                    : Math.round(chartMaxVal * p).toLocaleString("id-ID");

                  return (
                    <g key={i}>
                      <line
                        x1="55"
                        y1={yVal}
                        x2="820"
                        y2={yVal}
                        stroke="#E2E8F0"
                        strokeWidth="1"
                        strokeDasharray="4,4"
                      />
                      <text
                        x="45"
                        y={yVal + 3}
                        className="text-[9px] font-semibold text-slate-400 text-right uppercase"
                        textAnchor="end"
                      >
                        {labelValue}
                      </text>
                    </g>
                  );
                })}

                {/* Plan Benchmark Reference Line when a specific type is selected in L/Jam mode */}
                {selectedHighlightType !== "SEMUA" && activeAnalysisMetric === "burnRate" && (() => {
                  const cleanType = cleanEgyName(selectedHighlightType).toUpperCase();
                  const planVal = activeEgyPlans[cleanType] || DEFAULT_TYPE_PLANS[cleanType] || 0;
                  if (planVal <= 0) return null;
                  const planY = 250 - (planVal / chartMaxVal) * 200;

                  return (
                    <g key="plan-benchmark-line">
                      <line
                        x1="55"
                        y1={planY}
                        x2="820"
                        y2={planY}
                        stroke="#EF4444"
                        strokeWidth="1.5"
                        strokeDasharray="6,4"
                      />
                      <rect
                        x="715"
                        y={Math.max(6, planY - 18)}
                        width="105"
                        height="16"
                        rx="4"
                        fill="#FFE4E6"
                        stroke="#FDA4AF"
                        strokeWidth="1"
                        className="filter drop-shadow-xs"
                      />
                      <text
                        x="767"
                        y={Math.max(6, planY - 18) + 11.5}
                        textAnchor="middle"
                        className="text-[9px] font-mono font-black fill-[#E11D48]"
                      >
                        Target: {planVal.toFixed(1)} L/Jam
                      </text>
                    </g>
                  );
                })()}

                {/* X Axis Month Labels */}
                {currentMonths.map((m, mIdx) => {
                  const xVal = 80 + mIdx * ((820 - 80) / (currentMonths.length - 1));
                  return (
                    <g key={m}>
                      {/* Vertical line helper */}
                      <line
                        x1={xVal}
                        y1="40"
                        x2={xVal}
                        y2="250"
                        stroke="#F1F5F9"
                        strokeWidth="1"
                      />
                      {/* Tick label */}
                      <text
                        x={xVal}
                        y="270"
                        className="text-[10px] font-black text-slate-500 fill-current"
                        textAnchor="middle"
                      >
                        {m}
                      </text>
                    </g>
                  );
                })}

                {/* Draw Curves / Polylines is highly dependent on selectedTypes */}
                {uniqueEquipmentTypes.map((t, tIdx) => {
                  const isHighlighted = selectedHighlightType === "SEMUA" || selectedHighlightType === t;
                  const strokeColor = getColorFor(t, tIdx);

                  // Extract points for this type
                  const points = currentMonths.map((m, mIdx) => {
                    const entry = pivotTableData[t]?.[m];
                    const xVal = 80 + mIdx * ((820 - 80) / (currentMonths.length - 1));

                    let val = 0;
                    if (entry) {
                      if (activeAnalysisMetric === "burnRate") {
                        val = entry.hrs > 0 ? entry.vol / entry.hrs : 0;
                      } else if (activeAnalysisMetric === "volume") {
                        val = entry.vol;
                      } else {
                        val = entry.hrs;
                      }
                    }

                    const yVal = 250 - (val / chartMaxVal) * 200;
                    return { x: xVal, y: yVal, val };
                  });

                  const pathString = points.reduce((acc, p, pIdx) => {
                    return acc + `${pIdx === 0 ? "M" : "L"} ${p.x} ${p.y} `;
                  }, "");

                  return (
                    <g key={t} className="transition-opacity duration-300" style={{ opacity: isHighlighted ? 1 : 0 }}>
                      {/* Transparent wider line for easy hovering hover effects */}
                      <path
                        d={pathString}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="12"
                        className="cursor-pointer"
                      />
                      {/* Solid Line plotting */}
                      <path
                        d={pathString}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth={selectedHighlightType === t ? "4.5" : "2.5"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="transition-all"
                      />

                      {/* Accent Area under curve if this is the ONLY highlighted path */}
                      {selectedHighlightType === t && points.length > 0 && (
                        <path
                          d={`${pathString} L ${points[points.length - 1].x} 250 L ${points[0].x} 250 Z`}
                          fill={`${strokeColor}10`} // super translucent representation of line theme
                          className="transition-all"
                        />
                      )}

                      {/* Points Circles and Visual Data Labels */}
                      {points.map((p, pIdx) => {
                        const formattedVal = (activeAnalysisMetric === "burnRate")
                          ? `${p.val.toFixed(2)} L/Jam`
                          : `${Math.round(p.val).toLocaleString("id-ID")} ${activeAnalysisMetric === "volume" ? "Liter" : "Jam"}`;

                        const cleanType = cleanEgyName(t).toUpperCase();
                        const egyPlan = activeEgyPlans[cleanType] || DEFAULT_TYPE_PLANS[cleanType] || 0;
                        const isOverPlan = activeAnalysisMetric === "burnRate" && egyPlan > 0 && p.val > (egyPlan + 0.1);

                        // Short number to display on visual badge
                        const shortNumber = activeAnalysisMetric === "burnRate"
                          ? p.val.toFixed(1)
                          : activeAnalysisMetric === "volume"
                          ? Math.round(p.val) >= 100000
                            ? `${(p.val / 1000).toFixed(0)}k`
                            : Math.round(p.val).toLocaleString("id-ID")
                          : Math.round(p.val).toLocaleString("id-ID");

                        const shouldShowLabel = showChartLabels && p.val > 0 && (selectedHighlightType === t || selectedHighlightType === "SEMUA");

                        return (
                          <g key={pIdx} className="group/dot">
                            {/* Visual Value Badge Directly Above Point */}
                            {shouldShowLabel && (
                              <g className="transition-all select-none">
                                {/* Pill background */}
                                <rect
                                  x={p.x - 23}
                                  y={Math.max(6, p.y - 30)}
                                  width="46"
                                  height="18"
                                  rx="5"
                                  fill={isOverPlan ? "#FFF1F2" : "#FFFFFF"}
                                  stroke={isOverPlan ? "#E11D48" : strokeColor}
                                  strokeWidth={selectedHighlightType === t ? "1.8" : "1.2"}
                                  className="filter drop-shadow-xs"
                                />
                                {/* Indicator pointer notch */}
                                <polygon
                                  points={`${p.x - 3.5},${Math.max(6, p.y - 30) + 18} ${p.x + 3.5},${Math.max(6, p.y - 30) + 18} ${p.x},${Math.max(6, p.y - 30) + 22.5}`}
                                  fill={isOverPlan ? "#E11D48" : strokeColor}
                                />
                                {/* Number text inside badge */}
                                <text
                                  x={p.x}
                                  y={Math.max(6, p.y - 30) + 12.5}
                                  textAnchor="middle"
                                  fill={isOverPlan ? "#BE123C" : (selectedHighlightType === t ? "#0F172A" : strokeColor)}
                                  className="text-[10.5px] font-mono font-black"
                                >
                                  {shortNumber}
                                </text>
                              </g>
                            )}

                            {/* Circle Dot on curve */}
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={selectedHighlightType === t ? "6" : "4.5"}
                              fill={strokeColor}
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              className="transition-transform duration-100 hover:scale-150 cursor-pointer"
                            />

                            {/* Detailed Hover Tooltip */}
                            <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none">
                              <rect
                                x={p.x - 70}
                                y={Math.max(4, p.y - 60)}
                                width="140"
                                height="28"
                                rx="6"
                                fill="#1E293B"
                                className="shadow-lg"
                              />
                              <text
                                x={p.x}
                                y={Math.max(4, p.y - 60) + 17}
                                fill="#FFFFFF"
                                className="text-[9px] font-extrabold"
                                textAnchor="middle"
                              >
                                {t}: {formattedVal}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        </div>

        {/* COMPARISON PIVOT GRID CARD (Full-Width, placed below chart) */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Table className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-extrabold text-slate-800">Tabel Fuel Burn</h3>
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Klik baris alat berat untuk melihat rincian nomor unit individual beserta data fuel burn bulan per bulan
              </p>
            </div>

            {/* Table Action & Sorting Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-250 px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[11px] text-slate-500 font-normal">Urutkan:</span>
                <select
                  value={activeMonthSort ? `month_${activeMonthSort.month}` : sortOption}
                  onChange={(e) => {
                    const val = e.target.value;
                    setActiveMonthSort(null);
                    setSortOption(val as SortOption);
                  }}
                  className="bg-transparent font-bold text-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="worst_achievement">🔴 Pencapaian Terburuk (Over Plan Tertinggi)</option>
                  <option value="best_achievement">🟢 Pencapaian Terbaik (Paling Hemat / Di Bawah Plan)</option>
                  <option value="name_asc">🔤 Nama Egy Alat (A - Z)</option>
                  <option value="name_desc">🔤 Nama Egy Alat (Z - A)</option>
                  <option value="volume_desc">📊 Konsumsi Solar Tertinggi (Liter)</option>
                  <option value="hours_desc">⏱️ Jam Operasi Terbanyak (HM)</option>
                </select>
              </div>

              {/* Bulk Expand / Collapse Toggle Buttons */}
              <button
                type="button"
                onClick={expandedEgys.size === uniqueEquipmentTypes.length ? collapseAllEgys : expandAllEgys}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {expandedEgys.size === uniqueEquipmentTypes.length ? "Tutup Semua Unit" : "Buka Semua Unit"}
                </span>
              </button>
            </div>
          </div>

          {/* Table container */}
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-xs font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                  <th 
                    onClick={() => {
                      setActiveMonthSort(null);
                      setSortOption(prev => prev === "name_asc" ? "name_desc" : "name_asc");
                    }}
                    className="p-3 font-extrabold sticky left-0 bg-slate-50 border-r border-slate-100 cursor-pointer hover:bg-slate-100/80 transition"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Egy Alat (Equipment)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                  {currentMonths.map(m => {
                    const isSortedThisMonth = activeMonthSort?.month === m;
                    return (
                      <th 
                        key={m} 
                        onClick={() => {
                          setActiveMonthSort(prev => {
                            if (prev?.month === m) {
                              return prev.direction === "desc" ? { month: m, direction: "asc" } : null;
                            }
                            return { month: m, direction: "desc" };
                          });
                        }}
                        className={`p-3 text-center font-extrabold whitespace-nowrap min-w-[85px] cursor-pointer hover:bg-slate-100 transition ${
                          isSortedThisMonth ? "bg-blue-50 text-blue-800" : ""
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          <span>{m}</span>
                          {isSortedThisMonth && (
                            <span className="text-[10px]">{activeMonthSort.direction === "desc" ? "↓" : "↑"}</span>
                          )}
                        </div>
                      </th>
                    );
                  })}
                  <th 
                    onClick={() => {
                      setActiveMonthSort(null);
                      setSortOption(prev => prev === "worst_achievement" ? "best_achievement" : "worst_achievement");
                    }}
                    className="p-3 text-center font-extrabold bg-slate-100/50 min-w-[80px] cursor-pointer hover:bg-slate-200/60 transition"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Plan</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-400" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {sortedEquipmentTypes.map((type) => {
                  const cleanType = cleanEgyName(type).toUpperCase();
                  const planValue = activeEgyPlans[cleanType] || activeEgyPlans[type] || DEFAULT_TYPE_PLANS[cleanType] || DEFAULT_TYPE_PLANS[type] || 0;
                  const isExpanded = expandedEgys.has(type);
                  const unitsInThisEgy = unitsByEgy[cleanType] || unitsByEgy[type.toUpperCase()] || [];

                  return (
                    <React.Fragment key={type}>
                      {/* PARENT EGY ROW (Clickable to expand individual units) */}
                      <tr 
                        onClick={() => toggleExpandEgy(type)}
                        className={`group cursor-pointer transition-colors ${
                          isExpanded 
                            ? "bg-slate-50/90" 
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        {/* Name Col with Expand Indicator & Unit Count */}
                        <td className="p-3 font-bold text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50/80 transition-colors border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <span className={`p-1 rounded text-slate-400 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all ${
                                isExpanded ? "rotate-90 text-blue-600 bg-blue-100/70" : ""
                              }`}>
                                <ChevronRight className="w-3.5 h-3.5 transition-transform" />
                              </span>
                              <span className="font-extrabold text-xs text-slate-900 tracking-tight">{type}</span>
                            </div>
                            {unitsInThisEgy.length > 0 && (
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                                isExpanded 
                                  ? "bg-blue-100 text-blue-800" 
                                  : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                              }`}>
                                {unitsInThisEgy.length} Unit
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Monthly Value Cells */}
                        {currentMonths.map(month => {
                          const cell = pivotTableData[type]?.[month];
                          let content = "-";
                          let isOverPlan = false;

                          if (cell && cell.count > 0) {
                            if (activeAnalysisMetric === "burnRate") {
                              const rate = cell.hrs > 0 ? cell.vol / cell.hrs : 0;
                              content = rate.toFixed(1);
                              isOverPlan = planValue > 0 && rate > (planValue + 0.1);
                            } else if (activeAnalysisMetric === "volume") {
                              content = Math.round(cell.vol).toLocaleString("id-ID");
                            } else {
                              content = Math.round(cell.hrs).toLocaleString("id-ID");
                            }
                          }

                          return (
                            <td
                              key={month}
                              className={`p-3 text-center font-mono ${
                                isOverPlan 
                                  ? "bg-rose-50 text-rose-600 font-extrabold" 
                                  : cell && cell.count > 0 && activeAnalysisMetric === "burnRate"
                                  ? "bg-emerald-50 text-emerald-700 font-semibold"
                                  : ""
                              }`}
                            >
                              {content}
                            </td>
                          );
                        })}

                        {/* Plan Col */}
                        <td className="p-3 text-center font-mono font-bold bg-slate-100/30 text-slate-600">
                          {planValue > 0 ? planValue : "-"}
                        </td>
                      </tr>

                      {/* EXPANDED SUB-ROWS: INDIVIDUAL UNITS */}
                      {isExpanded && (
                        <>
                          {unitsInThisEgy.length > 0 ? (
                            unitsInThisEgy.map((unit, uIdx) => {
                              const unitPlan = unit.unitPlan > 0 ? unit.unitPlan : planValue;
                              const isLastUnit = uIdx === unitsInThisEgy.length - 1;

                              return (
                                <tr 
                                  key={unit.idAlat} 
                                  className={`bg-slate-50/70 hover:bg-blue-50/40 transition-colors ${
                                    isLastUnit ? "border-b-2 border-slate-200" : "border-b border-slate-100/80"
                                  }`}
                                >
                                  {/* Sub-row Unit ID column */}
                                  <td className="py-2.5 px-3 pl-8 font-medium text-slate-700 sticky left-0 bg-slate-50/95 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                                    <div className="flex items-center gap-2 font-mono text-[11px] flex-wrap">
                                      <CornerDownRight className="w-3.5 h-3.5 text-blue-400 shrink-0 select-none" />
                                      <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-250 shadow-2xs">
                                        {unit.idAlat}
                                      </span>
                                      {unit.hasRenamedPattern && (
                                        <span 
                                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                                          title={`Unit ${unit.idAlat} tercatat sebagai ${unit.legacyId} pada bulan Januari - April 2026`}
                                        >
                                          ex: {unit.legacyId}
                                        </span>
                                      )}
                                      {unit.typeAlat && (
                                        <span className="text-[10px] text-slate-500 font-sans truncate max-w-[150px]" title={unit.typeAlat}>
                                          {unit.typeAlat}
                                        </span>
                                      )}
                                    </div>
                                  </td>

                                  {/* Unit Monthly Fuel Burn Cells */}
                                  {currentMonths.map(month => {
                                    const cell = unit.monthly[month];
                                    let content = "-";
                                    let isUnitOverPlan = false;
                                    let hasData = false;

                                    if (cell && cell.hrs > 0 && cell.burnRate !== null) {
                                      content = cell.burnRate.toFixed(1);
                                      hasData = true;
                                      isUnitOverPlan = unitPlan > 0 && cell.burnRate > (unitPlan + 0.1);
                                    }

                                    const isJanApr = ["Januari", "Februari", "Maret", "April"].includes(month);
                                    const cellTooltip = hasData
                                      ? `${unit.idAlat} | ${month}: ${content} L/Jam (${Math.round(cell.vol).toLocaleString("id-ID")} L / ${Math.round(cell.hrs).toLocaleString("id-ID")} Jam)${
                                          unit.hasRenamedPattern && isJanApr ? ` [Unit terdata: ${unit.legacyId}]` : ""
                                        }`
                                      : `Tidak ada data operasi ${unit.idAlat} pada bulan ${month}`;

                                    return (
                                      <td
                                        key={month}
                                        title={cellTooltip}
                                        className={`py-2 px-3 text-center font-mono text-[11px] ${
                                          hasData
                                            ? isUnitOverPlan
                                              ? "bg-rose-50/90 text-rose-600 font-bold"
                                              : "bg-emerald-50/90 text-emerald-700 font-semibold"
                                            : "text-slate-300"
                                        }`}
                                      >
                                        {content}
                                      </td>
                                    );
                                  })}

                                  {/* Unit Plan Column */}
                                  <td className="py-2 px-3 text-center font-mono text-[11px] font-bold bg-slate-100/40 text-slate-500">
                                    {unitPlan > 0 ? unitPlan : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                              <td colSpan={currentMonths.length + 2} className="p-4 text-center text-xs text-slate-400 italic">
                                Belum ada log nomor unit individual untuk kategori {type} pada periode ini.
                              </td>
                            </tr>
                          )}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Feedback Toast Notification Banner */}
      {feedback.message && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 border shadow-sm ${
          feedback.type === "success" 
            ? "bg-emerald-50 border-emerald-200 text-emerald-800"
            : "bg-rose-50 border-rose-200 text-rose-800"
        }`}>
          <div className="flex items-center gap-2.5">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <p className="font-semibold text-xs leading-normal">{feedback.message}</p>
          </div>
          <button 
            onClick={() => setFeedback({ type: null, message: "" })} 
            className="text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 12 MONTHLY UPLOAD DECK */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#4682B4]" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Detail Report Fuel Monthly</h3>
              <p className="text-[10px] text-slate-400 font-bold">Upload file log pengisian BBM terpisah untuk tiap-tiap bulan atau unggah file rekapan komprehensif.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={triggerGlobalUpload}
              disabled={isProcessing}
              className="text-[10px] font-extrabold bg-[#4682B4] hover:bg-[#36648B] text-white px-3.5 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Unggah file Excel rekapan / multi-bulan"
            >
              <Upload className="w-3.5 h-3.5 text-blue-100" />
              <span>{isProcessing ? "Menganalisa..." : "Upload File Excel"}</span>
            </button>

            <button
              onClick={handleClearAllData}
              className="text-[10px] font-extrabold bg-rose-50 hover:bg-rose-100 text-rose-600 px-3.5 py-2 rounded-lg border border-rose-250 transition active:scale-95 cursor-pointer flex items-center gap-1.5"
              title="Bersihkan semua data agar Anda bisa upload dari awal"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Semua File Upload</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {MONTH_NAMES_IND.map((monthName) => {
            const mPts = dataPoints.filter((d) => d.bulan === monthName);
            const isUploaded = uploadedMonths.includes(monthName);
            const hasData = mPts.length > 0;
            const mTotalVol = mPts.reduce((sum, p) => sum + p.totalVolume, 0);
            const mTotalHrs = mPts.reduce((sum, p) => sum + p.totalHours, 0);
            const mBurnRate = mTotalHrs > 0 ? mTotalVol / mTotalHrs : 0;

            return (
              <div
                key={monthName}
                className={`border rounded-xl p-3.5 transition duration-200 flex flex-col justify-between relative overflow-hidden h-40 ${
                  isUploaded
                    ? "bg-emerald-50/45 border-emerald-200 hover:border-emerald-400"
                    : hasData
                    ? "bg-[#4682B4]/5 border-blue-100 hover:border-[#4682B4]"
                    : "bg-slate-50 border-slate-200 hover:border-slate-350"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-black text-slate-800">{monthName}</span>
                    {isUploaded ? (
                      <span className="text-[8px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Diunggah khusus untuk bulan ini">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        <span>RIIL</span>
                      </span>
                    ) : hasData ? (
                      <span className="text-[8px] font-black uppercase bg-slate-200/50 text-slate-500 px-1.5 py-0.5 rounded" title="Data simulasi bawaan PT. WBS">
                        SAMPLE
                      </span>
                    ) : (
                      <span className="text-[8px] font-black uppercase bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded">
                        KOSONG
                      </span>
                    )}
                  </div>

                  {hasData ? (
                    <div className="space-y-0.5 mt-2">
                      <p className="text-[10px] text-slate-500 font-bold flex justify-between">
                        <span>Total Vol:</span>
                        <span className="font-mono text-slate-700 font-black">{Math.round(mTotalVol).toLocaleString("id-ID")} L</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold flex justify-between">
                        <span>Running:</span>
                        <span className="font-mono text-slate-700 font-black">{Math.round(mTotalHrs).toLocaleString("id-ID")} Jam</span>
                      </p>
                      <p className="text-[10px] text-slate-500 font-black border-t border-slate-200/40 pt-0.5 mt-1 flex justify-between">
                        <span>Rerata Burn:</span>
                        <span className="font-mono text-[#4682B4] font-black">{mBurnRate.toFixed(1)} L/Jam</span>
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center mt-4.5 py-1 space-y-1">
                      <FileSpreadsheet className="w-6 h-6 text-slate-300 stroke-[1.5]" />
                      <span className="text-[9px] font-bold text-slate-400">Belum ada data</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => triggerUploadForMonth(monthName)}
                      className={`text-[9px] font-black py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition active:scale-95 flex-1 ${
                        isUploaded
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : hasData
                          ? "bg-slate-800 hover:bg-slate-700 text-white"
                          : "bg-white border border-slate-250 hover:bg-slate-100 text-slate-600 shadow-sm"
                      }`}
                    >
                      <Upload className="w-2.5 h-2.5" />
                      <span>{hasData ? "Ganti File" : "Upload"}</span>
                    </button>

                    {hasData && (
                      <button
                        onClick={() => handleClearMonthData(monthName)}
                        className="p-1 px-2 rounded-lg border border-rose-100 bg-white hover:bg-rose-55 hover:border-rose-200 text-rose-500 hover:text-rose-700 transition cursor-pointer active:scale-95 flex items-center gap-1"
                        title={`Hapus data log pengisian untuk bulan ${monthName}`}
                      >
                        <Trash2 className="w-3 h-3" />
                        <span className="text-[10px] font-bold">Hapus</span>
                      </button>
                    )}
                  </div>

                  {hasData && onSelectMonthForDashboard && (
                    <button
                      onClick={() => onSelectMonthForDashboard(monthName)}
                      className="text-[9px] font-extrabold py-1 px-2 rounded-md bg-[#4682B4]/10 hover:bg-[#4682B4]/20 text-[#2F4F4F] border border-[#4682B4]/30 transition cursor-pointer flex items-center justify-center gap-1"
                      title={`Buka & analisa rincian transaksi bulan ${monthName} di Monthly Review`}
                    >
                      <BarChart2 className="w-2.5 h-2.5 text-[#4682B4]" />
                      <span>Buka Monthly Review</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* DETAILED MONTH BREAKDOWN EXPANSION LIST */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Calendar className="w-5 h-5 text-slate-700" />
          <h3 className="text-sm font-extrabold text-slate-800">Detail Fuel Usage Monthly</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {currentMonths.map(month => {
            // Find datapoints of this month
            const mPts = dataPoints.filter(d => 
              d.bulan === month && 
              (selectedHighlightType === "SEMUA" || d.typeAlat === selectedHighlightType)
            );
            const mTotalVol = mPts.reduce((sum, p) => sum + p.totalVolume, 0);
            const mTotalHrs = mPts.reduce((sum, p) => sum + p.totalHours, 0);
            const mBurn = mTotalHrs > 0 ? mTotalVol / mTotalHrs : 0;

            return (
              <div key={month} className="border border-slate-150 rounded-xl p-4 hover:border-[#4682B4] hover:shadow-sm transition duration-250 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200/50 pb-2 mb-3">
                    <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 bg-[#4682B4] rounded-full inline-block"></span>
                      <span>Periode: {month}</span>
                    </span>
                    <span className="text-[10px] bg-slate-200/60 font-black px-2 py-0.5 rounded text-slate-600">
                      {mPts.length} Kategori Alat
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between font-bold">
                      <span>Total Volume:</span>
                      <span className="font-mono text-slate-800">{Math.round(mTotalVol).toLocaleString("id-ID")} Liter</span>
                    </div>
                    <div className="flex justify-between font-bold">
                      <span>Total Running (HM):</span>
                      <span className="font-mono text-slate-800">{Math.round(mTotalHrs).toLocaleString("id-ID")} Jam</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-slate-100 pt-1.5 mt-1">
                      <span>Rata-Rata Burn Rate:</span>
                      <span className="font-mono font-extrabold text-[#4682B4]">{mBurn.toFixed(2)} L/Jam</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-slate-200/50 space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">Kecukupan Data:</span>
                  <div className="grid grid-cols-2 gap-2">
                    {mPts.map(p => {
                      const rate = p.totalHours > 0 ? p.totalVolume / p.totalHours : 0;
                      return (
                        <div key={p.typeAlat} className="text-[10px] bg-white rounded border border-slate-150 p-1.5 text-center">
                          <p className="font-bold text-slate-700 truncate" title={p.typeAlat}>{p.typeAlat}</p>
                          <p className="font-mono text-[9px] mt-0.5 text-[#4682B4] font-black">{rate.toFixed(1)} L/Jam</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL ANALISA & VALIDASI PRA-UNGGAH (PRE-COMMIT ANALYSIS MODAL) */}
      <UploadAnalysisModal
        isOpen={isAnalysisModalOpen}
        analysisData={analysisStagingData}
        targetContext="yearly"
        isApplying={isApplyingAnalysis}
        onClose={() => {
          setIsAnalysisModalOpen(false);
          setAnalysisStagingData(null);
          setSelectedMonthForUpload(null);
        }}
        onConfirm={handleConfirmAnalysis}
      />

      {/* MODAL PENGATURAN TARGET PLAN FUEL BURN PER EGY */}
      <EgyPlanManagerModal
        isOpen={isInternalPlanModalOpen}
        onClose={() => setIsInternalPlanModalOpen(false)}
        currentPlans={activeEgyPlans}
        onSavePlans={async (updated) => {
          setInternalEgyPlans(updated);
          await saveStoredEgyPlans(updated);
          setFeedback({
            type: "success",
            message: "Target Plan Fuel Burn per Jenis Egy berhasil diperbarui dan disinkronkan!"
          });
        }}
        availableEgysInDataset={uniqueEquipmentTypes}
      />

      {/* Hidden File Input for Monthly Uploads & Re-uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple={false}
        onChange={handleFileChange}
        className="hidden"
      />

    </div>
  );
}
