import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  Fuel, 
  Calendar, 
  TrendingUp, 
  Filter, 
  PlusCircle, 
  Database, 
  AlertTriangle, 
  Info, 
  FileSpreadsheet, 
  Sparkles,
  ChevronDown,
  User,
  Clock,
  Upload,
  Download,
  RotateCcw,
  ArrowRight,
  ArrowLeft,
  Link as LinkIcon,
  LogOut,
  Globe,
  RefreshCw,
  FileText,
  Check
} from "lucide-react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas-pro";
import { jsPDF } from "jspdf";
import { FuelRecord } from "./types";
import { INITIAL_FUEL_DATA, processRecord, parsePastedData, normalizeDateToYMD } from "./data/sampleData";
import MetricCard from "./components/MetricCard";
import ParetoChart from "./components/ParetoChart";
import AnomalyDetailsView from "./components/AnomalyDetailsView";
import YearlyReview from "./components/YearlyReview";
import { saveMonthlyReportToFirestore } from "./lib/firebase";
import { saveLocalData, getLocalData, clearAllLocalData } from "./lib/storage";
import { MonthlyReportData } from "./types";
import { 
  initAuth, 
  googleSignIn, 
  logout, 
  extractSpreadsheetId, 
  fetchSpreadsheetMetadata, 
  fetchSheetValues 
} from "./lib/googleSheets";

const INITIAL_PLANS: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }> = {
  "EXC-PC200-01": { idAlat: "EXC-PC200-01", typeAlat: "Excavator PC200", planFuelBurn: 22.0 },
  "EXC-PC200-02": { idAlat: "EXC-PC200-02", typeAlat: "Excavator PC200", planFuelBurn: 22.0 },
  "EXC-PC200-03": { idAlat: "EXC-PC200-03", typeAlat: "Excavator PC200", planFuelBurn: 22.0 },
  "DT-HD785-05": { idAlat: "DT-HD785-05", typeAlat: "Dump Truck HD785", planFuelBurn: 72.0 },
  "DT-HD785-06": { idAlat: "DT-HD785-06", typeAlat: "Dump Truck HD785", planFuelBurn: 72.0 },
  "DT-HD785-07": { idAlat: "DT-HD785-07", typeAlat: "Dump Truck HD785", planFuelBurn: 72.0 },
  "BULL-D85-01": { idAlat: "BULL-D85-01", typeAlat: "Bulldozer D85SS", planFuelBurn: 25.0 },
  "BULL-D85-02": { idAlat: "BULL-D85-02", typeAlat: "Bulldozer D85SS", planFuelBurn: 25.0 },
  "GRAD-GD511-01": { idAlat: "GRAD-GD511-01", typeAlat: "Motor Grader GD511", planFuelBurn: 17.5 },
  "LOAD-WA500-02": { idAlat: "LOAD-WA500-02", typeAlat: "Wheel Loader WA500", planFuelBurn: 30.0 },
};

export default function App() {
  // Core fuel dataset state
  const [records, setRecords] = useState<FuelRecord[]>([]);

  // Plans from "List & FC" sheet (Column A: nomor unit, Column B: type alat, Column D: plan Fuel Burn)
  const [plans, setPlans] = useState<Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>>({});

  // States for processing Excel/CSV files directly
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [fileFeedback, setFileFeedback] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  const [isDragging, setIsDragging] = useState(false);

  // Dynamic user-triggered file stages before analysis
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileSheets, setFileSheets] = useState<string[]>([]);
  const [selectedLogSheet, setSelectedLogSheet] = useState<string>("");
  const [hasPlanSheetPresent, setHasPlanSheetPresent] = useState<boolean>(false);

  // Filter States
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("SEMUA");
  const [selectedStorageFilter, setSelectedStorageFilter] = useState("SEMUA");
  const [viewingAnomaliesPage, setViewingAnomaliesPage] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "yearly">("dashboard");

  // File Input and Dialog Reference
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Google Sheets Integration States
  const [isGoogleSheetsActive, setIsGoogleSheetsActive] = useState(false);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [sheetsAccessToken, setSheetsAccessToken] = useState<string | null>(null);
  const [spreadsheetUrl, setSpreadsheetUrl] = useState("");
  const [sheetsSpreadsheetId, setSheetsSpreadsheetId] = useState<string | null>(null);
  const [spreadsheetMetadata, setSpreadsheetMetadata] = useState<{ title: string; sheets: string[] } | null>(null);
  const [sheetsSelectedLogTab, setSheetsSelectedLogTab] = useState("");
  const [sheetsSelectedPlanTab, setSheetsSelectedPlanTab] = useState("");

  // Initialize Google Auth
  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setGoogleUser(user);
        setSheetsAccessToken(token);
      },
      () => {
        setGoogleUser(null);
        setSheetsAccessToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  // Restore saved session records automatically on page refresh
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedRecords = await getLocalData<FuelRecord[]>("fuel_records");
        const savedPlans = await getLocalData<Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>>("fuel_plans");
        const savedMeta = await getLocalData<{ startDate?: string; endDate?: string; fileName?: string; activeTab?: "dashboard" | "yearly" }>("fuel_meta");

        if (savedRecords && savedRecords.length > 0) {
          setRecords(savedRecords);
          if (savedPlans && Object.keys(savedPlans).length > 0) {
            setPlans(savedPlans);
          }
          if (savedMeta) {
            if (savedMeta.startDate) setStartDate(savedMeta.startDate);
            if (savedMeta.endDate) setEndDate(savedMeta.endDate);
            if (savedMeta.activeTab) setActiveTab(savedMeta.activeTab);
          }
          setFileFeedback({
            type: "success",
            message: `Memulihkan sesi aktif (${savedRecords.length} baris data${savedMeta?.fileName ? ` dari "${savedMeta.fileName}"` : ""}) secara otomatis.`
          });
        }
      } catch (err) {
        console.warn("Restore session note:", err);
      }
    };
    restoreSession();
  }, []);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setFileFeedback({ type: null, message: "" });
    try {
      const result = await googleSignIn();
      if (result) {
        setGoogleUser(result.user);
        setSheetsAccessToken(result.accessToken);
        setFileFeedback({
          type: "success",
          message: `Berhasil login! Akun Google terhubung sebagai: ${result.user.displayName || result.user.email}`
        });
      }
    } catch (err: any) {
      console.error("Gagal Google Login:", err);
      setFileFeedback({
        type: "error",
        message: `Gagal menghubungkan Google Account: ${err.message || 'Pemberian izin dibatalkan.'}`
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleGoogleLogout = async () => {
    setFileFeedback({ type: null, message: "" });
    try {
      await logout();
      setGoogleUser(null);
      setSheetsAccessToken(null);
      setSheetsSpreadsheetId(null);
      setSpreadsheetMetadata(null);
      setFileFeedback({
        type: "success",
        message: "Berhasil memutuskan tautan Google Account."
      });
    } catch (err: any) {
      console.error("Gagal Google Logout:", err);
    }
  };

  const handleLoadSpreadsheetMetadata = async () => {
    if (!spreadsheetUrl.trim()) {
      setFileFeedback({
        type: "error",
        message: "Masukkan tautan Google Spreadsheet terlebih dahulu."
      });
      return;
    }
    const sId = extractSpreadsheetId(spreadsheetUrl);
    if (!sId) {
      setFileFeedback({
        type: "error",
        message: "Format Link Google Spreadsheet tidak dikenali. Harap salin link lengkap dari browser Anda."
      });
      return;
    }
    
    if (!sheetsAccessToken) {
      setFileFeedback({
        type: "error",
        message: "Sesi Google Akun belum terhubung. Silakan klik hubungkan akun terlebih dahulu."
      });
      return;
    }

    setGoogleLoading(true);
    setFileFeedback({ type: null, message: "" });

    try {
      const meta = await fetchSpreadsheetMetadata(sId, sheetsAccessToken);
      setSheetsSpreadsheetId(sId);
      setSpreadsheetMetadata(meta);
      
      const sheetsList = meta.sheets || [];
      let logTab = "";
      if (sheetsList.includes("Issued")) {
        logTab = "Issued";
        setSheetsSelectedLogTab("Issued");
      } else {
        logTab = sheetsList.find(s => s !== "List & FC") || sheetsList[0] || "";
        setSheetsSelectedLogTab(logTab);
      }
      
      let planTab = "";
      if (sheetsList.includes("List & FC")) {
        planTab = "List & FC";
        setSheetsSelectedPlanTab("List & FC");
      } else {
        setSheetsSelectedPlanTab("");
      }

      // Automatically sync and import data without needing another click!
      await handleImportGoogleSheetData(logTab, planTab, sId);

    } catch (err: any) {
      console.error(err);
      const isFailedToFetch = err && (String(err.message || "").includes("Failed to fetch") || String(err || "").includes("Failed to fetch") || String(err.message || "").includes("fetch"));
      setFileFeedback({
        type: "error",
        message: isFailedToFetch 
          ? "Koneksi ke Google API terputus (Failed to fetch). Ini biasanya terjadi jika login Google akun Anda kedaluwarsa, belum menyetujui izin baca spreadsheet, atau diblokir oleh ekstensi browser AdBlock/Shields."
          : `Gagal menyinkronkan Spreadsheet: ${err.message || err}`
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleImportGoogleSheetData = async (
    overrideLogTab?: string,
    overridePlanTab?: string,
    overrideSId?: string
  ) => {
    const sId = overrideSId || sheetsSpreadsheetId;
    const logTab = overrideLogTab || sheetsSelectedLogTab;
    const planTab = overridePlanTab !== undefined ? overridePlanTab : sheetsSelectedPlanTab;
    const token = sheetsAccessToken;

    if (!sId || !logTab || !token) {
      setFileFeedback({
        type: "error",
        message: "Harap masukkan Spreadsheet dan hubungkan tab sheet terlebih dahulu."
      });
      return;
    }

    setIsProcessingFile(true);
    setFileFeedback({ type: null, message: "" });

    try {
      // 1. Fetch Plan Sheet values if chosen
      let plansExtracted: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }> = {};
      if (planTab) {
        try {
          const fcRows = await fetchSheetValues(sId, planTab, token);
          fcRows.forEach((row) => {
            if (!row || row.length < 4) return;
            const cellA = row[0];
            const cellB = row[1];
            const cellD = row[3];
            
            if (cellA && cellB && cellD !== undefined && cellD !== null) {
              const idAlatStr = String(cellA).trim().toUpperCase();
              const typeAlatStr = String(cellB).trim();
              const planValue = parseFloat(cellD);
              const isHeaderRow = idAlatStr === "NOMOR UNIT" || idAlatStr === "UNIT" || idAlatStr.includes("ALAT") || idAlatStr === "A";
              
              if (idAlatStr && !isHeaderRow && !isNaN(planValue)) {
                plansExtracted[idAlatStr] = {
                  idAlat: idAlatStr,
                  typeAlat: typeAlatStr,
                  planFuelBurn: planValue
                };
              }
            }
          });
        } catch (fcErr) {
          console.warn("Gagal mengekstrak data plan dari sheet:", fcErr);
        }
      }

      // 2. Fetch Log Sheet values
      const logRows = await fetchSheetValues(sId, logTab, token);
      if (logRows.length === 0) {
        throw new Error(`Sheet "${logTab}" tidak memiliki data apa pun.`);
      }

      // 3. Map values using exact colMap scanning logic
      const isIssuedSheet = logTab.toLowerCase() === "issued" || logTab.toLowerCase().includes("issue");
      
      let colMap = {
        tanggal: isIssuedSheet ? 6 : 0,      // Column G (index 6): tanggal
        storage: isIssuedSheet ? 7 : 1,      // Column H (index 7): storage pengisian fuel
        idAlat: isIssuedSheet ? 8 : 2,       // Column I (index 8): Unit
        typeAlat: isIssuedSheet ? 9 : 3,     // Column J (index 9): Kategori unit
        brandAlat: isIssuedSheet ? 10 : -1,  // Column K (index 10): Type.brand unit
        hmSebelum: isIssuedSheet ? 11 : 4,   // Column L (index 11): HM pengisian fuel sebelumnya
        hmSaatIni: isIssuedSheet ? 12 : 5,   // Column M (index 12): HM pengisian fuel pada tanggal itu
        volumeFuel: isIssuedSheet ? 14 : 6,  // Column O (index 14): jumlah fuel yang diisi
        operator: isIssuedSheet ? 18 : 7,    // Column S (index 18): nama operator unit
        fuelman: isIssuedSheet ? 20 : 8,     // Column U (index 20)
        shift: isIssuedSheet ? 21 : 9,       // Column V (index 21)
        jam: isIssuedSheet ? 22 : 10         // Column W (index 22)
      };

      let detectedHeaderRowIdx = -1;

      if (isIssuedSheet) {
        let foundHeaderIdx = -1;
        const scanRowsLimit = Math.min(logRows.length, 30);
        for (let r = 0; r < scanRowsLimit; r++) {
          const row = logRows[r];
          if (!row || !Array.isArray(row)) continue;
          let hits = 0;
          row.forEach((cell) => {
            if (cell === undefined || cell === null) return;
            const str = String(cell).toLowerCase().trim();
            if (
              str.includes("tanggal") || 
              str.includes("unit") || 
              str === "kategori" || 
              str.includes("hm") || 
              str.includes("fuel") ||
              str.includes("jam")
            ) {
              hits++;
            }
          });
          if (hits >= 3) {
            foundHeaderIdx = r;
            break;
          }
        }
        detectedHeaderRowIdx = foundHeaderIdx;
      } else {
        let bestHeaderRowIdx = -1;
        const scanRowsLimit = Math.min(logRows.length, 30);
        let maxMatches = 0;
        let bestRowColMap = { ...colMap };

        for (let r = 0; r < scanRowsLimit; r++) {
          const row = logRows[r];
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
            } else if (
              str === "operator" || 
              str === "nama operator" || 
              str === "driver" ||
              str.includes("operator") ||
              str.includes("driver")
            ) {
              tempMap.operator = cIdx;
              matches++;
            } else if (
              str === "fuelman" || 
              str === "pengisi" || 
              str === "petugas" || 
              str === "nama fuelman" ||
              str.includes("fuelman")
            ) {
              tempMap.fuelman = cIdx;
              matches++;
            } else if (
              str === "shift" || 
              str.includes("group") ||
              str === "regu"
            ) {
              tempMap.shift = cIdx;
              matches++;
            } else if (
              str === "jam" || 
              str === "waktu" || 
              str.includes("jam pengisian") || 
              str.includes("time") || 
              str === "jam pengisian fuel"
            ) {
              tempMap.jam = cIdx;
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

      const startRowIndex = isIssuedSheet ? 108 : (detectedHeaderRowIdx !== -1 ? detectedHeaderRowIdx + 1 : 0);
      const parsed: FuelRecord[] = [];

      logRows.forEach((row, index) => {
        if (index < startRowIndex) return;
        if (!row || row.length < Math.max(2, colMap.idAlat + 1)) return;
        
        const isHeader = row.some(cell => {
          if (typeof cell !== "string") return false;
          const low = cell.toLowerCase();
          return low.includes("tanggal") || low.includes("previous hh") || low.includes("operator");
        });
        if (isHeader) return;

        const getCell = (idx: number, def = "") => {
          if (idx === -1 || idx >= row.length) return def;
          return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : def;
        };

        const getFloatCell = (idx: number, def = 0) => {
          if (idx === -1 || idx >= row.length) return def;
          const val = parseFloat(row[idx]);
          return isNaN(val) ? def : val;
        };

        const dateCellIdx = colMap.tanggal;
        const tanggal = dateCellIdx !== -1 && dateCellIdx < row.length
          ? normalizeDateToYMD(row[dateCellIdx])
          : "";
        
        if (!tanggal) return;
        
        const idAlat = getCell(colMap.idAlat).toUpperCase();
        if (!idAlat) return;
        
        const storage = getCell(colMap.storage, "Storage Utama Central");
        
        // Map strictly to Kategori Unit (column J)
        const kategoriVal = getCell(colMap.typeAlat, "").trim();
        const typeAlat = kategoriVal || "Excavator PC200";

        const hmSebelum = getFloatCell(colMap.hmSebelum, 0);
        const hmSaatIni = getFloatCell(colMap.hmSaatIni, 0);
        const volumeFuel = getFloatCell(colMap.volumeFuel, 0);
        const operator = getCell(colMap.operator, "Operator Lapangan");
        const fuelman = getCell(colMap.fuelman, "Fuelman Onsite");
        const shift = getCell(colMap.shift, "Shift 1 - Siang");
        const jam = getCell(colMap.jam, "12:00");
        
        parsed.push(processRecord({
          id: `sheets-row-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          tanggal,
          storage,
          idAlat,
          typeAlat,
          hmSebelum,
          hmSaatIni,
          volumeFuel,
          operator,
          fuelman,
          shift,
          jam
        }));
      });

      if (parsed.length === 0) {
        throw new Error(`Tidak ada data pengisian diesel yang dapat dipetakan dari sheet "${logTab}".`);
      }

      if (Object.keys(plansExtracted).length > 0) {
        setPlans(plansExtracted);
      }
      setRecords(parsed);
      setSelectedTypeFilter("SEMUA");
      setSelectedStorageFilter("SEMUA");

      const hasPlansMsg = Object.keys(plansExtracted).length > 0 
        ? ` dan ${Object.keys(plansExtracted).length} pembanding target plan dari sheet "${planTab}"` 
        : "";
      
      setFileFeedback({
        type: "success",
        message: `Berhasil tersinkronisasi! Menarik ${parsed.length} data pengisian diesel dari Google Sheet "${logTab}"${hasPlansMsg} secara REAL-TIME!`
      });

      // Auto adjust date bounds
      const validDates = parsed.map(p => p.tanggal).filter(t => t);
      if (validDates.length > 0) {
        const sorted = [...validDates].sort();
        setStartDate(sorted[0]);
        setEndDate(sorted[sorted.length - 1]);

        saveLocalData("fuel_records", parsed);
        saveLocalData("fuel_plans", plansExtracted);
        saveLocalData("fuel_meta", {
          startDate: sorted[0],
          endDate: sorted[sorted.length - 1],
          fileName: `Google Sheet: ${logTab}`,
          activeTab: "dashboard"
        });
      }
    } catch (err: any) {
      console.error(err);
      const isFailedToFetch = err && (String(err.message || "").includes("Failed to fetch") || String(err || "").includes("Failed to fetch") || String(err.message || "").includes("fetch"));
      setFileFeedback({
        type: "error",
        message: isFailedToFetch
          ? "Koneksi ke Google API terputus (Failed to fetch). Ini biasanya terjadi jika login Google akun Anda kedaluwarsa, belum menyetujui izin baca spreadsheet, atau diblokir oleh ekstensi browser AdBlock/Shields."
          : `Gagal menarik data Google Sheet: ${err.message || 'Harap periksa pengaturan sheet dan format kolom.'}`
      });
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Extract unique values for filter dropdowns
  const uniqueEquipmentTypes = useMemo(() => {
    const types = new Set<string>();
    records.forEach(r => types.add(r.typeAlat));
    return Array.from(types).sort();
  }, [records]);

  const uniqueStorages = useMemo(() => {
    const storages = new Set<string>();
    records.forEach(r => storages.add(r.storage));
    return Array.from(storages).sort();
  }, [records]);

  // Apply filters to get ACTIVE working records for calculation
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // Date filter match
      const dateMatch = (!startDate || r.tanggal >= startDate) && (!endDate || r.tanggal <= endDate);
      
      // Equipment type filter match
      const typeMatch = selectedTypeFilter === "SEMUA" || r.typeAlat === selectedTypeFilter;

      // Storage match
      const storageMatch = selectedStorageFilter === "SEMUA" || r.storage === selectedStorageFilter;

      return dateMatch && typeMatch && storageMatch;
    });
  }, [records, startDate, endDate, selectedTypeFilter, selectedStorageFilter]);

  // Compare actual vs plan (List & FC)
  const unitComparisons = useMemo(() => {
    // 1. Group active records by Unit ID
    // We only use non-anomaly records within the filtered date range and type filters
    const aggregates: Record<string, { idAlat: string; typeAlat: string; totalVolume: number; totalHours: number; recordCount: number }> = {};
    
    filteredRecords.forEach(r => {
      if (r.isAnomaly) return;
      const key = r.idAlat.toUpperCase();
      if (!aggregates[key]) {
        aggregates[key] = {
          idAlat: r.idAlat,
          typeAlat: r.typeAlat,
          totalVolume: 0,
          totalHours: 0,
          recordCount: 0
        };
      }
      aggregates[key].totalVolume += r.volumeFuel;
      aggregates[key].totalHours += r.selisihHm;
      aggregates[key].recordCount += 1;
    });

    return Object.values(aggregates).map(item => {
      const avgActual = item.totalHours > 0 ? Number((item.totalVolume / item.totalHours).toFixed(2)) : 0;
      const planItem = plans[item.idAlat.toUpperCase()];
      const planValue = planItem ? planItem.planFuelBurn : 0;
      const deviation = planValue > 0 ? avgActual - planValue : 0;
      const deviationPct = planValue > 0 ? (deviation / planValue) * 100 : 0;
      const isOver = deviation > 0.01;

      return {
        idAlat: item.idAlat,
        typeAlat: item.typeAlat,
        actual: avgActual,
        plan: planValue,
        deviation,
        deviationPct,
        isOver,
        totalVolume: item.totalVolume,
        totalHours: item.totalHours,
        recordCount: item.recordCount
      };
    });
  }, [filteredRecords, plans]);

  // List of only over-plan units
  const overPlanUnits = useMemo(() => {
    return unitComparisons
      .filter(u => u.isOver)
      .sort((a, b) => b.deviation - a.deviation);
  }, [unitComparisons]);

  // Extract reference date from the selected range, normally latest in active records
  const referenceDate = useMemo(() => {
    if (filteredRecords.length === 0) {
      if (records.length === 0) return "";
      // Fallback: get absolute latest date in full database
      const sorted = [...records].sort((a,b) => b.tanggal.localeCompare(a.tanggal));
      return sorted[0].tanggal;
    }
    // Get latest date in filtered list
    const sorted = [...filteredRecords].sort((a,b) => b.tanggal.localeCompare(a.tanggal));
    return sorted[0].tanggal;
  }, [records, filteredRecords]);

  // Dynamic Metrics: Daily, Month to Date (MTD), Year to Date (YTD) based on referenceDate
  const metrics = useMemo(() => {
    if (!referenceDate) {
      return {
        daily: { average: 0, fuel: 0, hours: 0, count: 0, anomalies: 0 },
        mtd: { average: 0, fuel: 0, hours: 0, count: 0, anomalies: 0 },
        ytd: { average: 0, fuel: 0, hours: 0, count: 0, anomalies: 0 }
      };
    }

    const refYear = referenceDate.substring(0, 4);
    const refMonth = referenceDate.substring(5, 7); // MM
    
    // Grab corresponding subsets
    const dailySubset = records.filter(r => r.tanggal === referenceDate);
    const mtdSubset = records.filter(r => {
      const year = r.tanggal.substring(0, 4);
      const month = r.tanggal.substring(5, 7);
      return year === refYear && month === refMonth && r.tanggal <= referenceDate;
    });
    const ytdSubset = records.filter(r => {
      const year = r.tanggal.substring(0, 4);
      return year === refYear && r.tanggal <= referenceDate;
    });

    const calculateSubsetMetrics = (subset: FuelRecord[]) => {
      const valids = subset.filter(r => !r.isAnomaly);
      const anomalies = subset.filter(r => r.isAnomaly).length;

      const totalFuel = valids.reduce((acc, r) => acc + r.volumeFuel, 0);
      const totalHours = valids.reduce((acc, r) => acc + r.selisihHm, 0);
      const fuelBurnSum = valids.reduce((acc, r) => acc + r.fuelBurnRate, 0);
      
      // We calculate standard arithmetic average of the records' burn rates
      const averageRate = valids.length > 0 ? Number((fuelBurnSum / valids.length).toFixed(2)) : 0;

      return {
        average: averageRate,
        fuel: Number(totalFuel.toFixed(1)),
        hours: Number(totalHours.toFixed(1)),
        count: subset.length,
        anomalies
      };
    };

    return {
      daily: calculateSubsetMetrics(dailySubset),
      mtd: calculateSubsetMetrics(mtdSubset),
      ytd: calculateSubsetMetrics(ytdSubset)
    };
  }, [records, referenceDate]);

  const handleResetToSample = () => {
    clearAllLocalData();
    setRecords(INITIAL_FUEL_DATA);
    setPlans(INITIAL_PLANS);
    setStartDate("2026-04-01");
    setEndDate("2026-05-27");
    setSelectedTypeFilter("SEMUA");
    setSelectedStorageFilter("SEMUA");
    setFileFeedback({ type: "success", message: "Database kembali menggunakan 25 Log data contoh PT. WAHANA BARA SENTOSA." });
  };

  // Date Range Quick selection Presets
  const applyPreset = (preset: "all" | "today" | "last7" | "last30" | "mtd" | "ytd") => {
    // Determine bounds based on maximum date available (2026-05-27 in samples)
    const latestDateStr = records.length > 0 
      ? [...records].sort((a,b) => b.tanggal.localeCompare(a.tanggal))[0].tanggal
      : "2026-05-27";
    
    const latest = new Date(latestDateStr);

    if (preset === "all") {
      setStartDate("2026-04-01");
      setEndDate(latestDateStr);
    } else if (preset === "today") {
      setStartDate(latestDateStr);
      setEndDate(latestDateStr);
    } else if (preset === "last7") {
      const past = new Date(latest.getTime() - 7 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(latestDateStr);
    } else if (preset === "last30") {
      const past = new Date(latest.getTime() - 30 * 24 * 60 * 60 * 1000);
      setStartDate(past.toISOString().split('T')[0]);
      setEndDate(latestDateStr);
    } else if (preset === "mtd") {
      setStartDate(`${latestDateStr.substring(0, 8)}01`);
      setEndDate(latestDateStr);
    } else if (preset === "ytd") {
      setStartDate(`${latestDateStr.substring(0, 4)}-01-01`);
      setEndDate(latestDateStr);
    }
  };

  // Selection wrapper for two-stage file loading before manual analysis trigger
  const handleFileSelected = (file: File) => {
    setFileFeedback({ type: null, message: "" });
    setSelectedFile(file);
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    if (fileExtension === "csv" || fileExtension === "txt") {
      setFileSheets([]);
      setSelectedLogSheet("");
      setHasPlanSheetPresent(false);
      return;
    }

    // Read workbook sheets list to let player select which one they intend to calculate
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const dataArr = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: "array" });
        const sheets = workbook.SheetNames || [];
        setFileSheets(sheets);
        
        let defaultLogSheet = sheets[0] || "";
        const hasPlans = sheets.includes("List & FC");
        setHasPlanSheetPresent(hasPlans);
        
        // Auto-select 'Issued' if present, otherwise select the non-plan sheet
        if (sheets.includes("Issued")) {
          defaultLogSheet = "Issued";
        } else if (hasPlans && sheets.length > 1) {
          defaultLogSheet = sheets.find(s => s !== "List & FC") || defaultLogSheet;
        }
        
        setSelectedLogSheet(defaultLogSheet);
      } catch (err) {
        console.error("Gagal mendeteksi lembar kerja sheet:", err);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Upgraded custom parser with dynamic column keyword-sensing mapping
  const processUploadedFile = (file: File, targetSheetName: string) => {
    setIsProcessingFile(true);
    setFileFeedback({ type: null, message: "" });
    
    const reader = new FileReader();
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    
    // Process CSV or raw TXT values
    if (fileExtension === "csv" || fileExtension === "txt") {
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          if (!text) throw new Error("File kosong atau tidak dapat diakses.");
          
          const parsed = parsePastedData(text);
          if (parsed.length === 0) {
            throw new Error("Tidak menemukan baris data pengisian valid. Pastikan format kolom sesuai dengan template Excel.");
          }
          
          setRecords(parsed);
          setSelectedTypeFilter("SEMUA");
          setSelectedStorageFilter("SEMUA");
          setFileFeedback({
            type: "success",
            message: `Berhasil mengimpor & menganalisis ${parsed.length} baris data dari Google Sheets CSV "${file.name}" secara otomatis!`
          });
          
          // Auto-frame range tanggal
          const validDates = parsed.map(p => p.tanggal).filter(t => t);
          if (validDates.length > 0) {
            const sorted = [...validDates].sort();
            setStartDate(sorted[0]);
            setEndDate(sorted[sorted.length - 1]);

            saveLocalData("fuel_records", parsed);
            saveLocalData("fuel_plans", plans);
            saveLocalData("fuel_meta", {
              startDate: sorted[0],
              endDate: sorted[sorted.length - 1],
              fileName: file.name,
              activeTab: "dashboard"
            });
          }
        } catch (err: any) {
          setFileFeedback({
            type: "error",
            message: `Gagal membaca CSV: ${err.message || 'Harap periksa kecocokan data.'}`
          });
        } finally {
          setIsProcessingFile(false);
          setSelectedFile(null);
        }
      };
      reader.readAsText(file);
      return;
    }
    
    // Process native spreadsheet files via SheetJS (xlsx, xls)
    reader.onload = (event) => {
      try {
        const dataArr = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(dataArr, { type: "array" });
        
        if (workbook.SheetNames.length === 0) {
          throw new Error("Buku kerja Excel tidak memiliki lembar kerja apapun.");
        }
        
        // 1. Parse "List & FC" target values if it exists in workbook
        let plansExtracted: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }> = {};
        if (workbook.SheetNames.includes("List & FC")) {
          const fcSheet = workbook.Sheets["List & FC"];
          const fcJson = XLSX.utils.sheet_to_json<any[]>(fcSheet, { header: 1 });
          fcJson.forEach((row) => {
            if (!row || row.length < 4) return;
            const cellA = row[0];
            const cellB = row[1];
            const cellD = row[3];
            
            if (cellA && cellB && cellD !== undefined && cellD !== null) {
              const idAlatStr = String(cellA).trim().toUpperCase();
              const typeAlatStr = String(cellB).trim();
              const planValue = parseFloat(cellD);
              const isHeaderRow = idAlatStr === "NOMOR UNIT" || idAlatStr === "UNIT" || idAlatStr.includes("ALAT") || idAlatStr === "A";
              
              if (idAlatStr && !isHeaderRow && !isNaN(planValue)) {
                plansExtracted[idAlatStr] = {
                  idAlat: idAlatStr,
                  typeAlat: typeAlatStr,
                  planFuelBurn: planValue
                };
              }
            }
          });
        }

        // 2. Select sheet
        let logsSheetName = targetSheetName;
        if (workbook.SheetNames.includes("Issued") && (!logsSheetName || logsSheetName === "List & FC")) {
          logsSheetName = "Issued";
        }
        if (!logsSheetName) {
          logsSheetName = workbook.SheetNames[0];
        }

        const sheet = workbook.Sheets[logsSheetName];
        if (!sheet) {
          throw new Error(`Sheet "${logsSheetName}" tidak ditemukan di file Excel.`);
        }
        
        const rawJson = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        if (rawJson.length === 0) {
          throw new Error(`Lembar kerja "${logsSheetName}" kosong.`);
        }

        // --- CHOOSE AND SETUP MAPPING ENGINE ---
        const isIssuedSheet = logsSheetName.toLowerCase() === "issued" || logsSheetName.toLowerCase().includes("issue");
        
        let colMap = {
          tanggal: isIssuedSheet ? 6 : 0,      // Column G (index 6): tanggal
          storage: isIssuedSheet ? 7 : 1,      // Column H (index 7): storage pengisian fuel
          idAlat: isIssuedSheet ? 8 : 2,       // Column I (index 8): Unit
          typeAlat: isIssuedSheet ? 9 : 3,     // Column J (index 9): Kategori unit
          brandAlat: isIssuedSheet ? 10 : -1,  // Column K (index 10): Type.brand unit
          hmSebelum: isIssuedSheet ? 11 : 4,   // Column L (index 11): HM pengisian fuel sebelumnya
          hmSaatIni: isIssuedSheet ? 12 : 5,   // Column M (index 12): HM pengisian fuel pada tanggal itu
          volumeFuel: isIssuedSheet ? 14 : 6,  // Column O (index 14): jumlah fuel yang diisi
          operator: isIssuedSheet ? 18 : 7,    // Column S (index 18): nama operator unit
          fuelman: isIssuedSheet ? 20 : 8,     // Column U (index 20)
          shift: isIssuedSheet ? 21 : 9,       // Column V (index 21)
          jam: isIssuedSheet ? 22 : 10         // Column W (index 22)
        };

        let detectedHeaderRowIdx = -1;

        if (isIssuedSheet) {
          // Strictly lock indices for "Issued" sheet to prevent any header-scanning mismatch or overlaps!
          // We only need to find the header row index to skip the metadata headings properly.
          let foundHeaderIdx = -1;
          const scanRowsLimit = Math.min(rawJson.length, 30);
          for (let r = 0; r < scanRowsLimit; r++) {
            const row = rawJson[r];
            if (!row || !Array.isArray(row)) continue;
            let hits = 0;
            row.forEach((cell) => {
              if (cell === undefined || cell === null) return;
              const str = String(cell).toLowerCase().trim();
              if (
                str.includes("tanggal") || 
                str.includes("unit") || 
                str === "kategori" || 
                str.includes("hm") || 
                str.includes("fuel") ||
                str.includes("jam")
              ) {
                hits++;
              }
            });
            if (hits >= 3) {
              foundHeaderIdx = r;
              break;
            }
          }
          detectedHeaderRowIdx = foundHeaderIdx;
        } else {
          // Fallback parser dynamic scanner for any other formats
          let bestHeaderRowIdx = -1;
          const scanRowsLimit = Math.min(rawJson.length, 30);
          let maxMatches = 0;
          let bestRowColMap = { ...colMap };

          for (let r = 0; r < scanRowsLimit; r++) {
            const row = rawJson[r];
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
              } else if (
                str === "operator" || 
                str === "nama operator" || 
                str === "driver" ||
                str.includes("operator") ||
                str.includes("driver")
              ) {
                tempMap.operator = cIdx;
                matches++;
              } else if (
                str === "fuelman" || 
                str === "pengisi" || 
                str === "petugas" || 
                str === "nama fuelman" ||
                str.includes("fuelman")
              ) {
                tempMap.fuelman = cIdx;
                matches++;
              } else if (
                str === "shift" || 
                str.includes("group") ||
                str === "regu"
              ) {
                tempMap.shift = cIdx;
                matches++;
              } else if (
                str === "jam" || 
                str === "waktu" || 
                str.includes("jam pengisian") || 
                str.includes("time") || 
                str === "jam pengisian fuel"
              ) {
                tempMap.jam = cIdx;
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

        const startRowIndex = isIssuedSheet ? 108 : (detectedHeaderRowIdx !== -1 ? detectedHeaderRowIdx + 1 : 0);
        const parsed: FuelRecord[] = [];

        rawJson.forEach((row, index) => {
          if (index < startRowIndex) return; // skip headers
          if (!row || row.length < Math.max(2, colMap.idAlat + 1)) return;
          
          // Double check to make sure redundant labels are skipped
          const isHeader = row.some(cell => {
            if (typeof cell !== "string") return false;
            const low = cell.toLowerCase();
            return low.includes("tanggal") || low.includes("previous hh") || low.includes("operator");
          });
          if (isHeader) return;
          
          // Safe values extractor
          const getCell = (idx: number, def = "") => {
            if (idx === -1 || idx >= row.length) return def;
            return row[idx] !== undefined && row[idx] !== null ? String(row[idx]).trim() : def;
          };

          const getFloatCell = (idx: number, def = 0) => {
            if (idx === -1 || idx >= row.length) return def;
            const val = parseFloat(row[idx]);
            return isNaN(val) ? def : val;
          };

          // Parse date properly using highly robust shared normalizer
          const dateCellIdx = colMap.tanggal;
          const tanggal = dateCellIdx !== -1 && dateCellIdx < row.length
            ? normalizeDateToYMD(row[dateCellIdx])
            : "";
          
          if (!tanggal) return;
          
          const idAlat = getCell(colMap.idAlat).toUpperCase();
          if (!idAlat) return;
          
          const storage = getCell(colMap.storage, "Storage Utama Central");
          
          // Map strictly to Kategori Unit (column J)
          const kategoriVal = getCell(colMap.typeAlat, "").trim();
          const typeAlat = kategoriVal || "Excavator PC200";

          const hmSebelum = getFloatCell(colMap.hmSebelum, 0);
          const hmSaatIni = getFloatCell(colMap.hmSaatIni, 0);
          const volumeFuel = getFloatCell(colMap.volumeFuel, 0);
          const operator = getCell(colMap.operator, "Operator Lapangan");
          const fuelman = getCell(colMap.fuelman, "Fuelman Onsite");
          const shift = getCell(colMap.shift, "Shift 1 - Siang");
          const jam = getCell(colMap.jam, "12:00");
          
          parsed.push(processRecord({
            id: `excel-row-${index}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            tanggal,
            storage,
            idAlat,
            typeAlat,
            hmSebelum,
            hmSaatIni,
            volumeFuel,
            operator,
            fuelman,
            shift,
            jam
          }));
        });
        
        if (parsed.length === 0) {
          throw new Error(`Tidak ada data pengisian diesel yang dapat dipetakan dari sheet "${logsSheetName}".`);
        }
        
        if (Object.keys(plansExtracted).length > 0) {
          setPlans(plansExtracted);
        }
        setRecords(parsed);
        setSelectedTypeFilter("SEMUA");
        setSelectedStorageFilter("SEMUA");
        
        const validDates = parsed.map(p => p.tanggal).filter(t => t);
        if (validDates.length > 0) {
          const sorted = [...validDates].sort();
          setStartDate(sorted[0]);
          setEndDate(sorted[sorted.length - 1]);

          saveLocalData("fuel_records", parsed);
          saveLocalData("fuel_plans", plansExtracted);
          saveLocalData("fuel_meta", {
            startDate: sorted[0],
            endDate: sorted[sorted.length - 1],
            fileName: file.name,
            activeTab: "dashboard"
          });
        }

        // Auto-save summary to Firebase Firestore for cross-module synchronization
        try {
          const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
          let detectedMonthName = "";
          let detectedMonthIdx = 0;
          let detectedYear = 2026;

          if (validDates.length > 0) {
            const firstDateParts = validDates[0].split("-");
            if (firstDateParts.length >= 2) {
              const mNum = parseInt(firstDateParts[1], 10);
              if (!isNaN(mNum) && mNum >= 1 && mNum <= 12) {
                detectedMonthIdx = mNum - 1;
                detectedMonthName = monthNames[detectedMonthIdx];
              }
              const yNum = parseInt(firstDateParts[0], 10);
              if (!isNaN(yNum) && yNum > 2000) {
                detectedYear = yNum;
              }
            }
          }

          if (!detectedMonthName && file.name) {
            const clean = file.name.toLowerCase();
            for (let i = 0; i < monthNames.length; i++) {
              if (clean.includes(monthNames[i].toLowerCase())) {
                detectedMonthName = monthNames[i];
                detectedMonthIdx = i;
                break;
              }
            }
          }

          if (!detectedMonthName) {
            detectedMonthName = "Juni";
            detectedMonthIdx = 5;
          }

          const typeGroupMap: Record<string, { totalVolume: number; totalHours: number; recordCount: number }> = {};
          parsed.forEach(r => {
            const t = r.typeAlat || "Lainnya";
            if (!typeGroupMap[t]) {
              typeGroupMap[t] = { totalVolume: 0, totalHours: 0, recordCount: 0 };
            }
            typeGroupMap[t].totalVolume += r.volumeFuel;
            if (!r.isAnomaly && r.selisihHm > 0) {
              typeGroupMap[t].totalHours += r.selisihHm;
            }
            typeGroupMap[t].recordCount += 1;
          });

          const totalVol = parsed.reduce((sum, r) => sum + r.volumeFuel, 0);
          const totalHrs = parsed.reduce((sum, r) => (!r.isAnomaly && r.selisihHm > 0 ? sum + r.selisihHm : sum), 0);

          const monthlyReportPayload: MonthlyReportData = {
            id: `${detectedYear}_${detectedMonthName}`,
            bulan: detectedMonthName,
            monthIndex: detectedMonthIdx,
            year: detectedYear,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            totalVolume: Number(totalVol.toFixed(1)),
            totalHours: Number(totalHrs.toFixed(1)),
            recordCount: parsed.length,
            avgBurnRate: totalHrs > 0 ? Number((totalVol / totalHrs).toFixed(2)) : 0,
            typeSummaries: Object.entries(typeGroupMap).map(([typeAlat, val]) => ({
              typeAlat,
              totalVolume: Number(val.totalVolume.toFixed(1)),
              totalHours: Number(val.totalHours.toFixed(1)),
              recordCount: val.recordCount,
              burnRate: val.totalHours > 0 ? Number((val.totalVolume / val.totalHours).toFixed(2)) : 0
            }))
          };

          saveMonthlyReportToFirestore(monthlyReportPayload).catch(e => console.warn("Firestore autosave note:", e));
        } catch (syncErr) {
          console.warn("Sinkronisasi Firestore bulanan note:", syncErr);
        }
        
        const hasPlansMsg = Object.keys(plansExtracted).length > 0 
          ? ` dan ${Object.keys(plansExtracted).length} pembanding target plan dari sheet "List & FC"` 
          : "";
        
        setFileFeedback({
          type: "success",
          message: `Berhasil mengimpor & menganalisis ${parsed.length} baris data bahan bakar dari sheet "${logsSheetName}"${hasPlansMsg} dan tersimpan ke Firebase (fuel-wbs)!`
        });
      } catch (err: any) {
        setFileFeedback({
          type: "error",
          message: `Gagal membaca Excel: ${err.message || "Harap sesuaikan dengan susunan kolom template."}`
        });
      } finally {
        setIsProcessingFile(false);
        setSelectedFile(null);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelected(file);
    }
  };

  // Export Dashboard to PDF Function via html2canvas & jsPDF
  const exportToPdf = async () => {
    setIsExportingPdf(true);
    setFileFeedback({ type: null, message: "" });
    try {
      const element = document.getElementById("dashboard-to-export");
      if (!element) {
        throw new Error("Elemen analisis tidak ditemukan di draf halaman.");
      }
      
      const canvas = await html2canvas(element, {
        scale: 2, // super crisp presentation resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#F8F9FA",
        onclone: (clonedDoc) => {
          // Native oklch color converter helper using canvas
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
      
      const imgWidth = 210; // A4 layout width standard (mm)
      const pageHeight = 297; // A4 layout height standard (mm)
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
      
      pdf.save(`DASHBOARD_FUEL_ANALYSIS_PT_WBS_${new Date().toISOString().split('T')[0]}.pdf`);
      setFileFeedback({
        type: "success",
        message: "File PDF Analisis Pembakaran Diesel berhasil digenerasikan!"
      });
    } catch (err: any) {
      console.error(err);
      setFileFeedback({
        type: "error",
        message: `Gagal memproses file PDF: ${err.message || err}`
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const triggerFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Helpers to count global anomalies within filtered dataset
  const anomalousRecords = useMemo(() => {
    return filteredRecords.filter(r => r.isAnomaly);
  }, [filteredRecords]);

  const globalAnomaliesCount = useMemo(() => {
    return anomalousRecords.length;
  }, [anomalousRecords]);

  const totalGlobalAnomaliesCount = useMemo(() => {
    return records.filter(r => r.isAnomaly).length;
  }, [records]);

  const isAnomaliesFiltered = useMemo(() => {
    return selectedTypeFilter !== "SEMUA" || selectedStorageFilter !== "SEMUA";
  }, [selectedTypeFilter, selectedStorageFilter]);

  const handleClearFilters = () => {
    setSelectedTypeFilter("SEMUA");
    setSelectedStorageFilter("SEMUA");
    if (records.length > 0) {
      const validDates = records.map(p => p.tanggal).filter(t => t);
      if (validDates.length > 0) {
        const sorted = [...validDates].sort();
        setStartDate(sorted[0]);
        setEndDate(sorted[sorted.length - 1]);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col font-sans transition-colors duration-300">
      
      {/* Top Header - Professional Polish Theme */}
      <header className="bg-[#1E293B] border-b border-[#334155] shrink-0 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-inner overflow-hidden border border-[#334155] p-1 shrink-0">
              <img 
                src="https://res.cloudinary.com/dgjnlxf69/image/upload/f_auto,q_auto/Logo_WBS_akrioo" 
                alt="Logo WBS" 
                className="w-8 h-8 object-contain" 
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1 className="text-white font-extrabold tracking-tight text-md sm:text-lg flex items-center gap-2">
                DASHBOARD FUEL ANALYSIS
              </h1>
              <p className="text-[10px] text-[#94A3B8] font-bold tracking-widest uppercase">PT. WAHANA BARA SENTOSA</p>
            </div>
          </div>

          {/* Quick PDF & Upload Triggers in Header */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={exportToPdf}
              disabled={isExportingPdf || records.length === 0}
              className="flex items-center gap-2 text-xs bg-[#4682B4] hover:bg-[#36648B] disabled:opacity-50 font-bold text-white px-3 sm:px-4 py-2 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExportingPdf ? "Mencetak PDF..." : "Ekspor PDF"}</span>
            </button>
            <button
              onClick={triggerFileDialog}
              disabled={isProcessingFile}
              className="flex items-center gap-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 sm:px-4 py-2 rounded-lg font-bold transition active:scale-95 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>Impor Excel</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        
        {/* Navigation Tabs row below Header */}
        <div className="flex bg-slate-200/60 p-1 rounded-xl border border-slate-300/40 max-w-md shadow-sm">
          <button
            onClick={() => {
              setActiveTab("dashboard");
              setViewingAnomaliesPage(false);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-[#1E293B] text-white shadow"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>MONTHLY REVIEW</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("yearly");
              setViewingAnomaliesPage(false);
            }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeTab === "yearly"
                ? "bg-[#1E293B] text-white shadow"
                : "text-slate-600 hover:text-slate-800"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>YEARLY REVIEW</span>
          </button>
        </div>

        {activeTab === "yearly" ? (
          <YearlyReview onBackToDashboard={() => setActiveTab("dashboard")} />
        ) : viewingAnomaliesPage ? (
          <AnomalyDetailsView
            anomalousRecords={anomalousRecords}
            allRecordsCount={filteredRecords.length}
            onBack={() => setViewingAnomaliesPage(false)}
            startDate={startDate}
            endDate={endDate}
            selectedType={selectedTypeFilter}
            selectedStorage={selectedStorageFilter}
            isFiltered={isAnomaliesFiltered}
            onClearFilters={handleClearFilters}
            totalGlobalAnomaliesCount={totalGlobalAnomaliesCount}
          />
        ) : (
          <>
            {/* SOURCE SELECTOR TABS BETWEEN OFFLINE AND LIVE SHEET */}
            <div className="flex items-center gap-1.5 mb-4 bg-slate-100 p-1.5 rounded-xl w-fit border border-slate-200/80 font-sans">
              <button
                onClick={() => {
                  setIsGoogleSheetsActive(false);
                  setFileFeedback({ type: null, message: "" });
                }}
                className={`flex items-center gap-2 text-xs font-extrabold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  !isGoogleSheetsActive 
                    ? "bg-[#4682B4] text-white shadow-sm" 
                    : "text-slate-650 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload File Excel / CSV</span>
              </button>
              
              <button
                onClick={() => {
                  setIsGoogleSheetsActive(true);
                  setFileFeedback({ type: null, message: "" });
                }}
                className={`flex items-center gap-2 text-xs font-extrabold px-4 py-2 rounded-lg transition-all cursor-pointer ${
                  isGoogleSheetsActive 
                    ? "bg-[#4682B4] text-white shadow-sm" 
                    : "text-slate-650 hover:text-slate-800 hover:bg-slate-200/50"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Google Spreadsheet Live</span>
              </button>
            </div>

            {/* Step-by-Step File Preview and Manual Analysis Trigger */}
            {selectedFile ? (
              <div className="bg-white rounded-xl border-2 border-amber-400 p-5 shadow-sm font-sans relative overflow-hidden animate-fade-in">
                <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-amber-500"></div>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 pl-1.5">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                      <FileSpreadsheet className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600">File Report Terpilih, Siap Dianalisa</h4>
                      <h3 className="text-sm font-extrabold text-slate-800 mt-1 flex items-center flex-wrap gap-2">
                        {selectedFile.name}
                        <span className="text-xs font-medium text-slate-400">({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                      </h3>
                      
                      {/* Sheet Selection Selector for Excel workbooks */}
                      {fileSheets.length > 0 ? (
                        <div className="mt-3.5 flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <label className="text-xs text-slate-600 font-bold">Pilih Sheet Laporan Pengisian Fuel:</label>
                          <div className="relative inline-block">
                            <select
                              value={selectedLogSheet}
                              onChange={(e) => setSelectedLogSheet(e.target.value)}
                              className="text-xs border border-slate-300 rounded px-3 text-slate-700 bg-slate-50 font-bold py-1.5 focus:border-[#4682B4] focus:outline-none cursor-pointer pr-8 appearance-none shadow-sm"
                            >
                              {fileSheets.map((s) => (
                                <option key={s} value={s}>
                                  {s === "List & FC" ? `${s} (Target Plans)` : s}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-slate-600 absolute right-2 top-2 pointer-events-none" />
                          </div>
                          
                          {hasPlanSheetPresent && (
                            <span className="inline-flex items-center gap-1.5 text-[10px] text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full font-extrabold border border-emerald-200 mt-1 sm:mt-0">
                              <Sparkles className="w-3 h-3" />
                              <span>Mendeteksi Sheet Pembanding "List & FC"</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        <p className="text-[10px] text-slate-500 mt-1.5 font-medium">Laporan berformat CSV akan diproses baris per baris secara otomatis.</p>
                      )}
                    </div>
                  </div>

                  {/* ACTION EXECUTE BUTTONS */}
                  <div className="flex items-center gap-2 self-stretch md:self-auto justify-end border-t border-slate-100 md:border-t-0 pt-3 md:pt-0 mt-3 md:mt-0">
                    <button
                      onClick={() => setSelectedFile(null)}
                      disabled={isProcessingFile}
                      className="text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-lg transition active:scale-95 cursor-pointer bg-white"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => processUploadedFile(selectedFile, selectedLogSheet)}
                      disabled={isProcessingFile}
                      className="text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-slate-950 px-4.5 py-2.5 rounded-lg font-black tracking-tight transition shadow-sm cursor-pointer active:scale-95 flex items-center justify-center gap-2 relative group overflow-hidden"
                    >
                      <Sparkles className="w-4 h-4 text-slate-950 fill-slate-950" />
                      <span>{isProcessingFile ? "Sedang Menganalisis..." : "Mulai Analisa Data Excel"}</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : !isGoogleSheetsActive ? (
              /* Real-time File Drop Zone / Import Selector Bar */
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                className={`border-2 border-dashed rounded-xl p-5 transition-all text-center sm:text-left flex flex-col md:flex-row items-center justify-between gap-4 ${
                  isDragging 
                    ? "border-[#4682B4] bg-[#4682B4]/5 shadow" 
                    : "border-slate-200 hover:border-[#4682B4]/60 bg-white shadow-sm"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                  <div className="p-3 bg-[#4682B4]/10 text-[#4682B4] rounded-xl self-center shrink-0">
                    <FileSpreadsheet className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-slate-800 tracking-tight flex items-center gap-1.5 justify-center sm:justify-start">
                      <span>Upload File Report Fuel dalam bentuk excel</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-1 tracking-normal">
                      Seret report fuel kesini atau klik tombol untuk memilih lembar kerja Excel (.xlsx, .xls) untuk dianalisa.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center justify-center gap-2 shrink-0 font-sans">
                  <button 
                    onClick={triggerFileDialog}
                    disabled={isProcessingFile}
                    className="text-xs bg-[#4682B4] hover:bg-[#36648B] disabled:opacity-50 text-white px-4 py-2.5 rounded-lg font-bold transition shadow-sm cursor-pointer active:scale-95"
                  >
                    Pilih File Excel / CSV
                  </button>
                  <button 
                    onClick={handleResetToSample}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3.5 py-2.5 rounded-lg font-bold transition cursor-pointer"
                    title="Gunakan dataset standar default"
                  >
                    Reset Data Contoh
                  </button>
                  <input 
                    ref={fileInputRef}
                    type="file" 
                    accept=".xlsx,.xls,.csv,.txt" 
                    className="hidden" 
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            ) : (
              /* Google Spreadsheet Live Sync Connector Card */
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 font-sans space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-extrabold text-slate-800 tracking-tight">Koneksi Real-time Google Spreadsheet</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">Integrasikan data pengisian BBM bulanan PT. WBS dari Google Sheets secara live.</p>
                    </div>
                  </div>

                  {googleUser ? (
                    <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 p-1.5 rounded-lg text-xs font-medium">
                      <div className="w-6 h-6 rounded-full bg-[#4682B4] text-white flex items-center justify-center font-bold text-[10px] uppercase">
                        {googleUser.displayName ? googleUser.displayName.charAt(0) : (googleUser.email ? googleUser.email.charAt(0) : "U")}
                      </div>
                      <div className="text-left leading-tight hidden sm:block">
                        <p className="font-bold text-slate-705 text-[11px] truncate max-w-[120px]">{googleUser.displayName || "Google User"}</p>
                        <p className="text-[9px] text-slate-400 truncate max-w-[120px]">{googleUser.email}</p>
                      </div>
                      <button 
                        onClick={handleGoogleLogout}
                        className="text-slate-400 hover:text-rose-600 transition p-1 hover:bg-slate-100 rounded cursor-pointer"
                        title="Putuskan tautan akun"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button 
                      onClick={handleGoogleLogin}
                      disabled={googleLoading}
                      className="text-xs font-bold border border-slate-200 rounded-lg px-3.5 py-2 hover:bg-slate-50 transition flex items-center gap-2 cursor-pointer bg-white"
                    >
                      <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                        <path fill="none" d="M0 0h48v48H0z"></path>
                      </svg>
                      <span>Hubungkan Google Akun</span>
                    </button>
                  )}
                </div>

                {!sheetsAccessToken ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center text-slate-500">
                    <Globe className="w-10 h-10 text-slate-300 shrink-0 mb-2 animate-pulse" />
                    <p className="text-xs font-bold text-slate-700">Google Akun Belum Terhubung</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-sm">Hubungkan Google Akun Anda yang memiliki hak akses membaca file Spreadsheet tersebut untuk mulai sinkronisasi.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* URL Input Form */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      <div className="relative flex-1">
                        <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                        <input 
                          type="text"
                          placeholder="Paste link share / edit Google Spreadsheet PT. WBS di sini..."
                          className="w-full text-xs pl-9.5 pr-4 py-3 border border-slate-200 rounded-xl focus:border-[#4682B4] focus:outline-none focus:ring-1 focus:ring-[#4682B4]/40"
                          value={spreadsheetUrl}
                          onChange={(e) => setSpreadsheetUrl(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleLoadSpreadsheetMetadata}
                        disabled={googleLoading || !spreadsheetUrl.trim()}
                        className="text-xs bg-[#4682B4] hover:bg-[#36648B] disabled:opacity-40 text-white px-5 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap active:scale-95"
                      >
                        {googleLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>{googleLoading ? "Menghubungkan..." : "Hubungkan Sheet"}</span>
                      </button>
                    </div>

                    {/* Metadata & Controls Panel */}
                    {spreadsheetMetadata && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 animate-fade-in text-left">
                        <div className="flex items-center gap-2 pb-2.5 border-b border-slate-200">
                          <FileText className="w-4 h-4 text-[#4682B4]" />
                          <span className="text-xs font-extrabold text-slate-800">
                            Spreadsheet Aktif: <strong className="text-[#4682B4] ml-1">{spreadsheetMetadata.title}</strong>
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4">
                          {/* Log sheet dropdown */}
                          <div className="flex-1 space-y-1.5 text-left">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pilih Sheet Data Logs FUEL:</label>
                            <div className="relative inline-block w-full">
                              <select
                                value={sheetsSelectedLogTab}
                                onChange={(e) => setSheetsSelectedLogTab(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 text-slate-705 bg-white font-bold py-2 focus:border-[#4682B4] focus:outline-none cursor-pointer pr-10 appearance-none shadow-sm"
                              >
                                {spreadsheetMetadata.sheets.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3 top-2.5 pointer-events-none" />
                            </div>
                          </div>

                          {/* Plan sheet dropdown */}
                          <div className="flex-1 space-y-1.5 text-left">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Sheet Target Plans (Opsional):</label>
                            <div className="relative inline-block w-full">
                              <select
                                value={sheetsSelectedPlanTab}
                                onChange={(e) => setSheetsSelectedPlanTab(e.target.value)}
                                className="w-full text-xs border border-slate-300 rounded-xl px-3 text-slate-705 bg-white font-bold py-2 focus:border-[#4682B4] focus:outline-none cursor-pointer pr-10 appearance-none shadow-sm"
                              >
                                <option value="">-- Gunakan Target Standar --</option>
                                {spreadsheetMetadata.sheets.map((s) => (
                                  <option key={s} value={s}>
                                    {s === "List & FC" ? `${s} (Target Plans)` : s}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="w-4 h-4 text-slate-600 absolute right-3 top-2.5 pointer-events-none" />
                            </div>
                          </div>
                        </div>

                        {/* Start import button */}
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <button
                            onClick={handleImportGoogleSheetData}
                            disabled={isProcessingFile}
                            className="text-xs bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 transition duration-150"
                          >
                            <Sparkles className="w-4 h-4 text-emerald-100" />
                            <span>{isProcessingFile ? "Sedang Sinkronisasi..." : "Mulai Sinkronisasi & Analisa"}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

        {/* Dynamic Process Indicator and File Feedback Banner */}
        {fileFeedback.type && (
          <div className="space-y-3">
            <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all animate-fade-in ${
              fileFeedback.type === "success" 
                ? "bg-[#E6F4EA] border-[#B3E1C1] text-[#137333]" 
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}>
              {fileFeedback.type === "success" ? (
                <Sparkles className="w-5 h-5 shrink-0 text-[#137333] mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
              )}
              <div className="text-xs font-medium font-sans flex-1">
                <strong className="block font-bold mb-0.5 text-rose-900">
                  {fileFeedback.type === "success" ? "Proses Impor Sukses!" : "Kesalahan Pembacaan Berkas/Spreadsheet!"}
                </strong>
                <span>{fileFeedback.message}</span>
              </div>
            </div>

            {/* Check if this is the "Office file" Google API error and show interactive step-by-step conversion assistant */}
            {fileFeedback.type === "error" && (
              fileFeedback.message.toLowerCase().includes("office file") || 
              fileFeedback.message.toLowerCase().includes("not be an office file") ||
              fileFeedback.message.toLowerCase().includes("precondition")
            ) && (
              <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-5 sm:p-6 text-left font-sans text-slate-800 space-y-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-amber-200">
                  <div className="p-1 px-2.5 bg-amber-500 text-slate-950 font-black text-[10px] uppercase rounded-full tracking-wider shrink-0">
                    Solusi Cepat
                  </div>
                  <h4 className="font-extrabold text-sm text-yellow-950">Cara Konversi Excel (.xlsx) ke Google Spreadsheet Asli</h4>
                </div>
                
                <p className="text-xs text-slate-700 leading-relaxed">
                  <strong>Mengapa error ini muncul?</strong> Tautan yang Anda masukkan adalah berkas Microsoft Excel (.xlsx) yang diunggah ke Google Drive. Layanan resmi <strong>Google Sheets API</strong> hanya mendukung sinkronisasi data dari berkas berformat asli <strong>Google Spreadsheet</strong> (berikon hijau pekat), bukan berkas Excel (berikon hijau muda dengan huruf "X").
                </p>

                <div className="bg-white border border-amber-200 rounded-xl p-4 space-y-3.5">
                  <p className="text-xs font-bold text-slate-805">Ikuti 5 langkah mudah berikut (hanya butuh waktu sekitar 10 detik):</p>
                  
                  <div className="space-y-3 text-xs leading-relaxed text-slate-650 pl-0.5">
                    {/* Step 1 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0 border border-amber-200 mt-0.5">1</div>
                      <div>
                        {spreadsheetUrl ? (
                          <span>
                            Buka tautan Excel Anda sekarang dengan mengeklik tombol ini:{" "}
                            <a 
                              href={spreadsheetUrl} 
                              target="_blank" 
                              rel="noreferrer" 
                              className="inline-flex items-center gap-1 font-bold text-[#4682B4] hover:underline bg-sky-50 border border-sky-200 rounded-md px-1.5 py-0.5 text-[11px]"
                            >
                              <span>Buka File Spreadsheet</span>
                              <Globe className="w-3 h-3" />
                            </a>
                          </span>
                        ) : (
                          <span>Buka file Excel Anda di browser Google Sheets.</span>
                        )}
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0 border border-amber-200 mt-0.5">2</div>
                      <div>
                        Pada menu bar Google Sheets di bagian kiri atas, klik menu <strong>File (Berkas)</strong>.
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0 border border-amber-200 mt-0.5">3</div>
                      <div>
                        Pilih opsi <strong>Save as Google Sheets (Simpan sebagai Google Spreadsheet)</strong>.
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0 border border-amber-200 mt-0.5">4</div>
                      <div>
                        Google akan membuka tab baru berisi file Google Spreadsheet asli. <strong>Salin (copy) link URL baru tersebut seluruhnya</strong> yang ada di bilah alamat browser Anda.
                      </div>
                    </div>

                    {/* Step 5 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-800 shrink-0 border border-amber-200 mt-0.5">5</div>
                      <div>
                        Tempelkan (paste) link baru tersebut di kolom pencarian di atas, klik <strong>Hubungkan Sheet</strong>, lalu lakukan sinkronisasi data kembali. Sinkronisasi dijamin akan berjalan mulus 100%!
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-amber-900 bg-amber-100/50 p-2.5 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span><strong>Tip Cepat:</strong> Ikon format Microsoft Excel di Google Drive biasanya bertuliskan <span className="font-mono bg-white border border-amber-300 px-1 py-0.25 rounded text-[10px]">.XLSX</span> di sebelah nama dokumen. Konversi file di atas akan menghasilkan dokumen baru tanpa label tersebut yang sepenuhnya ramah API.</span>
                </div>
              </div>
            )}

            {/* Check if this is the "Failed to fetch" Google API error and show interactive step-by-step diagnostic guide */}
            {fileFeedback.type === "error" && (
              fileFeedback.message.toLowerCase().includes("failed to fetch") ||
              fileFeedback.message.toLowerCase().includes("credentials") ||
              fileFeedback.message.toLowerCase().includes("kedaluwarsa")
            ) && (
              <div className="bg-sky-50/70 border border-sky-300 rounded-2xl p-5 sm:p-6 text-left font-sans text-slate-800 space-y-4 shadow-sm animate-fade-in">
                <div className="flex items-center gap-2.5 pb-2.5 border-b border-sky-200">
                  <div className="p-1 px-2.5 bg-sky-600 text-white font-black text-[10px] uppercase rounded-full tracking-wider shrink-0">
                    Bantuan Koneksi
                  </div>
                  <h4 className="font-extrabold text-sm text-sky-950">Cara Mengatasi Koneksi Google Sheets Terputus (Failed to Fetch)</h4>
                </div>
                
                <p className="text-xs text-slate-705 leading-relaxed">
                  Pesan <strong>Failed to fetch</strong> adalah kendala umum peramban (browser) saat koneksi terhalang atau token akses kadaluarsa. Silakan ikuti 3 langkah mudah berikut untuk memulihkannya secara instan:
                </p>

                <div className="bg-white border border-sky-200 rounded-xl p-4 space-y-3.5">
                  <div className="space-y-3 text-xs leading-relaxed text-slate-650 pl-0.5">
                    {/* Step 1 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-800 shrink-0 border border-sky-200 mt-0.5">1</div>
                      <div>
                        <strong>Keluar Sesi & Hubungkan Ulang (Disarankan):</strong> Klik tombol <strong className="text-rose-600">Putuskan Google Akun</strong> di kanan bawah, lalu klik <strong className="text-emerald-700">Hubungkan Google Akun</strong> untuk menyegarkan sesi perizinan Anda secara bersih.
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-800 shrink-0 border border-sky-200 mt-0.5">2</div>
                      <div>
                        <strong>Matikan Pemblokir Konten / Brave Shields:</strong> Beberapa pelindung privasi agresif (seperti Brave Shields atau ekstensi AdBlock) sering salah mengenali request Google OAuth/API sebagai iklan. Matikan sementara pelindung tersebut khusus untuk website ini.
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex items-start gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-sky-100 flex items-center justify-center text-[10px] font-bold text-sky-800 shrink-0 border border-sky-200 mt-0.5">3</div>
                      <div>
                        <strong>Periksa Izin Spreadsheet:</strong> Pastikan spreadsheet tersebut tidak dalam kondisi pembatasan ketat privasi organisasi, atau coba buka kembali tabnya.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-sky-900 bg-sky-100/50 p-2.5 rounded-lg">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                  <span><strong>Tip Cepat:</strong> Proses pemutusan sesi & penghubungan ulang hanya memakan waktu 5 detik dan efisien untuk menyinkronkan token secara otomatis!</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Interactive Filters Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 sm:p-5 flex flex-col xl:flex-row gap-5 items-stretch xl:items-center justify-between font-sans">
          
          {/* Calendar Picker Range */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3 h-3 text-[#4682B4]" />
                <span>PERIODE WAKTU</span>
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="date"
                  className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-800 transition focus:border-[#4682B4] focus:outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <span className="text-slate-400 text-xs font-bold">-</span>
                <input
                  type="date"
                  className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 text-slate-800 transition focus:border-[#4682B4] focus:outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-col">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PRESET PERIODE CEPAT</label>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <button onClick={() => applyPreset("all")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded transition cursor-pointer">
                Semua
              </button>
              <button onClick={() => applyPreset("today")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded transition cursor-pointer">
                Hari Ini
              </button>
              <button onClick={() => applyPreset("last7")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded transition cursor-pointer">
                7 Hari
              </button>
              <button onClick={() => applyPreset("last30")} className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded transition cursor-pointer">
                30 Hari
              </button>
              <button onClick={() => applyPreset("mtd")} className="bg-teal-50 hover:bg-teal-100 text-[#2F4F4F] text-[10px] font-bold px-2.5 py-1.5 rounded transition cursor-pointer font-bold font-sans">
                MTD
              </button>
              <button onClick={() => applyPreset("ytd")} className="bg-teal-50 hover:bg-teal-100 text-[#2F4F4F] text-[10px] font-bold px-2.5 py-1.5 rounded transition cursor-pointer font-bold font-sans">
                YTD
              </button>
            </div>
          </div>

          {/* Advanced Multi-Attribute Filters (Equipment Type, Storage Gate) */}
          <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-[#4682B4]" />
                <span>KATEGORI UNIT ALAT</span>
              </label>
              <select
                value={selectedTypeFilter}
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 mt-1 select-none w-full sm:w-44 focus:border-[#4682B4] focus:outline-none font-medium text-slate-700 cursor-pointer"
              >
                <option value="SEMUA">Semua Kategori Unit</option>
                {uniqueEquipmentTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-sans">LOKASI PENGISIAN FUEL</label>
              <select
                value={selectedStorageFilter}
                onChange={(e) => setSelectedStorageFilter(e.target.value)}
                className="text-xs border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50 mt-1 select-none w-full sm:w-48 focus:border-[#4682B4] focus:outline-none font-medium text-slate-700 cursor-pointer"
              >
                <option value="SEMUA">Semua Lokasi Pengisian</option>
                {uniqueStorages.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* PRINT TARGET CONTAINER - Everything inside is grabbed beautifully for PDF report rendering */}
        <div id="dashboard-to-export" className="space-y-6 bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-200">
          
          {/* Visual Feedback on Chosen Reference Date - Polished Indicator */}
          {referenceDate && (
            <div className="bg-[#1E293B] text-slate-350 px-4 py-3 rounded-xl border border-slate-700/60 text-xs flex flex-col sm:flex-row justify-between items-start sm:items-center shadow-sm gap-2 shrink-0 select-none">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>
                  Tanggal Acuan Analisa Fuel: <strong className="text-white font-mono">{referenceDate}</strong>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 tracking-wide uppercase font-mono bg-slate-800 py-0.5 px-2 rounded">
                Status: Berjalan (Realtime)
              </div>
            </div>
          )}

          {/* Metric KPI Card Grid View */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <MetricCard
              title="Rerata Fuel Burn Harian (Daily)"
              value={metrics.daily.average}
              subValue={metrics.daily.count > 0 ? "Berdasarkan rincian harian log pengisian" : "Tidak ada transaksi pada tanggal acuan"}
              totalFuel={metrics.daily.fuel}
              totalHours={metrics.daily.hours}
              recordCount={metrics.daily.count}
              anomalyCount={metrics.daily.anomalies}
              periodText={referenceDate || "Tidak Terdeteksi"}
              themeColor="blue"
              helpText="Rata-rata pemakaian bahan bakar per jam di tanggal acuan (Daily). Dihitung dari seluruh pengisian non-anomali di hari bersangkutan."
            />

            <MetricCard
              title="Rerata Month to Date (MTD)"
              value={metrics.mtd.average}
              subValue={`Bulan ${referenceDate ? new Date(referenceDate).toLocaleString("id-ID", {month: "long", year:"numeric"}) : "pilihan"}`}
              totalFuel={metrics.mtd.fuel}
              totalHours={metrics.mtd.hours}
              recordCount={metrics.mtd.count}
              anomalyCount={metrics.mtd.anomalies}
              periodText={referenceDate ? `01 s/d ${referenceDate.substring(8, 10)} ${new Date(referenceDate).toLocaleString("id-ID", {month: "short", year: "numeric"})}` : "Tidak Terdeteksi"}
              themeColor="emerald"
              helpText="Rata-rata pemakaian bahan bakar per jam berjalan sejak tanggal 1 sampai tanggal acuan di bulan yang sama (MTD)."
            />

            <MetricCard
              title="Rerata Year to Date (YTD)"
              value={metrics.ytd.average}
              subValue={`Tahun ${referenceDate ? referenceDate.substring(0, 4) : "pilihan"}`}
              totalFuel={metrics.ytd.fuel}
              totalHours={metrics.ytd.hours}
              recordCount={metrics.ytd.count}
              anomalyCount={metrics.ytd.anomalies}
              periodText={referenceDate ? `01 Jan s/d ${referenceDate.substring(8, 10)} ${new Date(referenceDate).toLocaleString("id-ID", {month: "short", year: "numeric"})}` : "Tidak Terdeteksi"}
              themeColor="amber"
              helpText="Rata-rata pemakaian bahan bakar per jam berjalan sejak awal tahun (1 Januari) sampai tanggal acuan di tahun yang sama (YTD)."
            />

          </div>

          {/* Unit Over Plan Monitor Section */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-4 mb-4 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                  Monitoring Deviasi Efisiensi Unit (Aktual vs Target Plan)
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Menganalisis unit alat berat yang melampaui batas Fuel Burn plan (Over Plan) yang diambil dari sheet <strong className="font-mono">List & FC</strong>.
                </p>
              </div>
              <div className="bg-slate-100 text-slate-705 text-[10.5px] px-3 py-1 rounded-full font-semibold">
                Terdeteksi: <strong className="text-rose-600">{overPlanUnits.length}</strong> / {unitComparisons.length} Unit Over Plan
              </div>
            </div>

            {overPlanUnits.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-lg text-slate-500 text-xs border border-dashed border-slate-200">
                <p className="font-bold text-emerald-600 font-sans text-xs">💪 SEMUA UNIT BERJALAN EFISIEN</p>
                <p className="mt-1 text-slate-400">Tidak ada unit alat berat yang melampaui plan Fuel Burn yang terdaftar pada target sheet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Stats Bar summarizing the waste */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-rose-50 border border-rose-100 p-3.5 rounded-xl">
                    <span className="text-[10px] text-rose-500 uppercase tracking-widest font-extrabold block">Unit Terboros (Max Deviation)</span>
                    <span className="text-lg font-black text-rose-700 mt-1 block">
                      {overPlanUnits[0].idAlat} <span className="text-xs font-normal text-rose-500">({overPlanUnits[0].typeAlat})</span>
                    </span>
                    <span className="text-xs text-rose-650 mt-1 block">
                      Deviasi: <strong className="font-bold">+{overPlanUnits[0].deviation.toFixed(2)}</strong> L/Jam (<span className="font-extrabold text-slate-800">+{overPlanUnits[0].deviationPct.toFixed(1)}%</span> over plan)
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
                    <span className="text-[10px] text-slate-550 uppercase tracking-widest font-extrabold block">Rerata Kelebihan Konsumsi</span>
                    <span className="text-lg font-black text-slate-800 mt-1 block">
                      +{(overPlanUnits.reduce((acc, u) => acc + u.deviation, 0) / overPlanUnits.length).toFixed(2)} <span className="text-xs font-semibold text-slate-500">L/Jam per unit</span>
                    </span>
                    <span className="text-xs text-slate-500 mt-1 block">
                      Rata-rata deviasi kumulatif dari seluruh unit yang boros melampaui plan.
                    </span>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-3.5 rounded-xl">
                    <span className="text-[10px] text-amber-600 uppercase tracking-widest font-extrabold block">Estimasi Kelebihan Konsumsi Fuel</span>
                    <span className="text-lg font-black text-amber-800 mt-1 block">
                      {overPlanUnits.reduce((acc, u) => acc + (u.deviation * u.totalHours), 0).toLocaleString("id-ID", { maximumFractionDigits: 1 })} <span className="text-xs font-semibold text-amber-650">Liter</span>
                    </span>
                    <span className="text-xs text-amber-700 mt-1 block">
                      Akumulasi potensi inefisiensi liter bahan bakar selama jam operasional aktif.
                    </span>
                  </div>
                </div>

                {/* Over plan detailed list view */}
                <div className="overflow-x-auto border border-slate-100 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-650 font-sans">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100">
                      <tr>
                        <th className="py-2.5 px-3">Nomor Unit / ID Alat</th>
                        <th className="py-2.5 px-3">Sektor Type Alat</th>
                        <th className="py-2.5 px-3 text-right">Target Plan</th>
                        <th className="py-2.5 px-3 text-right">Konsumsi Aktual</th>
                        <th className="py-2.5 px-3 text-right">Deviasi (L/Jam)</th>
                        <th className="py-2.5 px-3 text-right">Kelebihan (%)</th>
                        <th className="py-2.5 px-3 text-right">Total Jam Kerja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {overPlanUnits.map((u, i) => (
                        <tr key={i} className="hover:bg-rose-50/20 transition-all">
                          <td className="py-3 px-3 font-bold text-slate-800 font-sans">{u.idAlat}</td>
                          <td className="py-3 px-3 text-slate-500">{u.typeAlat}</td>
                          <td className="py-3 px-3 text-right text-slate-500 font-semibold font-mono">{u.plan.toFixed(1)} L/Jam</td>
                          <td className="py-3 px-3 text-right text-rose-700 font-bold font-mono">{u.actual.toFixed(2)} L/Jam</td>
                          <td className="py-3 px-3 text-right text-rose-600 font-black font-mono">+{u.deviation.toFixed(2)}</td>
                          <td className="py-3 px-3 text-right font-black font-mono">
                            <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full text-[10px]">
                              +{u.deviationPct.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-slate-400 font-mono">{u.totalHours.toLocaleString("id-ID", { maximumFractionDigits: 1 })} Jam</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Central Pareto Layout */}
          <ParetoChart records={filteredRecords} selectedType="SEMUA" plans={plans} />

          {/* Quick Metrics of anomalies across full log */}
          {globalAnomaliesCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex gap-3 items-start sm:items-center">
                <div className="bg-amber-100 p-2 rounded-full text-amber-700 shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-900 leading-none">Mendeteksi {globalAnomaliesCount} Anomali Log Bahan Bakar</h4>
                  <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                    Log dengan selisih HM bernilai 0, negatif, atau pembakaran tidak wajar secara otomatis disisihkan dari perhitungan rata-rata agar data efisiensi tidak bias.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingAnomaliesPage(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2 px-4 rounded-lg shadow-sm transition active:scale-95 flex items-center gap-1.5 shrink-0 select-none cursor-pointer"
              >
                <span>Lihat Halaman Anomali</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
        </>
      )}
      </main>

      {/* Corporate Styled Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 text-slate-400 py-6 px-6 text-center text-xs tracking-wide shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 PT. WAHANA BARA SENTOSA - Fuel Operations Internal Analyst Engine.</p>
          <div className="text-[10px] text-slate-500 font-mono">
            VITE • REACT • TAILWIND CSS
          </div>
        </div>
      </footer>

    </div>
  );
}
