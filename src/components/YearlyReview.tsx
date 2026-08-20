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
  Table, 
  FileText,
  Activity,
  DollarSign,
  Trash2,
  Cloud,
  Database,
  RefreshCw
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas-pro";
import { normalizeDateToYMD } from "../data/sampleData";
import { 
  subscribeToMonthlyReports, 
  fetchAllMonthlyReports,
  saveMonthlyReportToFirestore, 
  deleteMonthlyReport, 
  testConnection 
} from "../lib/firebase";
import { getSyncLocalData, saveLocalData, removeLocalData } from "../lib/storage";
import { MonthlyReportData } from "../types";

interface YearlyReviewProps {
  onBackToDashboard?: () => void;
}

// Hardcoded standard plans for equipment types matching the main database
const DEFAULT_TYPE_PLANS: Record<string, number> = {
  "Excavator PC200": 22.0,
  "Dump Truck HD785": 72.0,
  "Bulldozer D85SS": 25.0,
  "Motor Grader GD511": 17.5,
  "Wheel Loader WA500": 30.0,
};

// Default Months List order
const MONTH_NAMES_IND = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

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

// Built-in Year-round high-fidelity sample datasets to show beautiful analytics instantly!
const SAMPLE_YEARLY_DATA = [
  // Januari
  { bulan: "Januari", typeAlat: "Excavator PC200", totalVolume: 11450, totalHours: 512, recordCount: 140 },
  { bulan: "Januari", typeAlat: "Dump Truck HD785", totalVolume: 28400, totalHours: 390, recordCount: 125 },
  { bulan: "Januari", typeAlat: "Bulldozer D85SS", totalVolume: 8250, totalHours: 322, recordCount: 92 },
  { bulan: "Januari", typeAlat: "Motor Grader GD511", totalVolume: 3450, totalHours: 195, recordCount: 50 },
  { bulan: "Januari", typeAlat: "Wheel Loader WA500", totalVolume: 4900, totalHours: 160, recordCount: 45 },

  // Februari
  { bulan: "Februari", typeAlat: "Excavator PC200", totalVolume: 12100, totalHours: 560, recordCount: 152 },
  { bulan: "Februari", typeAlat: "Dump Truck HD785", totalVolume: 31200, totalHours: 420, recordCount: 130 },
  { bulan: "Februari", typeAlat: "Bulldozer D85SS", totalVolume: 8900, totalHours: 340, recordCount: 100 },
  { bulan: "Februari", typeAlat: "Motor Grader GD511", totalVolume: 3600, totalHours: 210, recordCount: 55 },
  { bulan: "Februari", typeAlat: "Wheel Loader WA500", totalVolume: 5100, totalHours: 172, recordCount: 48 },

  // Maret
  { bulan: "Maret", typeAlat: "Excavator PC200", totalVolume: 13400, totalHours: 595, recordCount: 168 },
  { bulan: "Maret", typeAlat: "Dump Truck HD785", totalVolume: 35600, totalHours: 480, recordCount: 145 },
  { bulan: "Maret", typeAlat: "Bulldozer D85SS", totalVolume: 9200, totalHours: 362, recordCount: 105 },
  { bulan: "Maret", typeAlat: "Motor Grader GD511", totalVolume: 3900, totalHours: 220, recordCount: 60 },
  { bulan: "Maret", typeAlat: "Wheel Loader WA500", totalVolume: 5800, totalHours: 190, recordCount: 54 },

  // April
  { bulan: "April", typeAlat: "Excavator PC200", totalVolume: 14050, totalHours: 630, recordCount: 175 },
  { bulan: "April", typeAlat: "Dump Truck HD785", totalVolume: 38200, totalHours: 525, recordCount: 160 },
  { bulan: "April", typeAlat: "Bulldozer D85SS", totalVolume: 9600, totalHours: 390, recordCount: 110 },
  { bulan: "April", typeAlat: "Motor Grader GD511", totalVolume: 4100, totalHours: 245, recordCount: 65 },
  { bulan: "April", typeAlat: "Wheel Loader WA500", totalVolume: 6200, totalHours: 205, recordCount: 60 },

  // Mei
  { bulan: "Mei", typeAlat: "Excavator PC200", totalVolume: 13950, totalHours: 642, recordCount: 180 },
  { bulan: "Mei", typeAlat: "Dump Truck HD785", totalVolume: 39500, totalHours: 540, recordCount: 165 },
  { bulan: "Mei", typeAlat: "Bulldozer D85SS", totalVolume: 9100, totalHours: 350, recordCount: 98 },
  { bulan: "Mei", typeAlat: "Motor Grader GD511", totalVolume: 4300, totalHours: 250, recordCount: 68 },
  { bulan: "Mei", typeAlat: "Wheel Loader WA500", totalVolume: 6100, totalHours: 202, recordCount: 58 },

  // Juni
  { bulan: "Juni", typeAlat: "Excavator PC200", totalVolume: 14200, totalHours: 660, recordCount: 190 },
  { bulan: "Juni", typeAlat: "Dump Truck HD785", totalVolume: 42100, totalHours: 570, recordCount: 182 },
  { bulan: "Juni", typeAlat: "Bulldozer D85SS", totalVolume: 10400, totalHours: 412, recordCount: 115 },
  { bulan: "Juni", typeAlat: "Motor Grader GD511", totalVolume: 4400, totalHours: 255, recordCount: 70 },
  { bulan: "Juni", typeAlat: "Wheel Loader WA500", totalVolume: 6350, totalHours: 215, recordCount: 62 }
];

export default function YearlyReview({ onBackToDashboard }: YearlyReviewProps) {
  // Parsed records grouped by month and typeAlat - initialize from local storage cache for 0ms refresh flicker
  const [dataPoints, setDataPoints] = useState<Array<{
    bulan: string;      // Month name
    typeAlat: string;   // Equipment type name
    totalVolume: number;
    totalHours: number;
    recordCount: number;
  }>>(() => getSyncLocalData("yearly_data_points", []));

  const [activeAnalysisMetric, setActiveAnalysisMetric] = useState<"burnRate" | "volume" | "hours">("burnRate");
  const [selectedHighlightType, setSelectedHighlightType] = useState<string>("SEMUA");
  const [startEvalMonth, setStartEvalMonth] = useState<string>("Januari");
  const [endEvalMonth, setEndEvalMonth] = useState<string>("Desember");
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | null; message: string }>({
    type: "success",
    message: "Silakan unggah file Excel bulanan pada slot di bawah untuk mulai menganalisa."
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [selectedMonthForUpload, setSelectedMonthForUpload] = useState<string | null>(null);
  const [uploadedMonths, setUploadedMonths] = useState<string[]>(() => getSyncLocalData("yearly_uploaded_months", []));
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(true);
  const [isSyncingCloud, setIsSyncingCloud] = useState<boolean>(false);

  // Helper to parse MonthlyReportData array into data points
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
      if (rep.typeSummaries && rep.typeSummaries.length > 0) {
        rep.typeSummaries.forEach((ts) => {
          allPts.push({
            bulan: rep.bulan,
            typeAlat: ts.typeAlat,
            totalVolume: ts.totalVolume,
            totalHours: ts.totalHours,
            recordCount: ts.recordCount
          });
        });
      }
    });

    if (allPts.length > 0) {
      setDataPoints(allPts);
      setUploadedMonths(cloudMonths);
      saveLocalData("yearly_data_points", allPts);
      saveLocalData("yearly_uploaded_months", cloudMonths);
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
          message: `Berhasil menyinkronkan ${reports.length} bulan data dari Cloud Firestore (fuel-wbs)!`
        });
      } else {
        setFeedback({
          type: "success",
          message: "Koneksi Cloud Firestore aktif. Belum ada dokumen laporan bulanan yang tersimpan."
        });
      }
    } catch (err: any) {
      setIsSyncingCloud(false);
      setIsCloudConnected(false);
      setFeedback({
        type: "error",
        message: `Gagal menyinkronkan dari Firestore: ${err.message || "Periksa koneksi internet."}`
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
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 50);
  };

  // Trigger file upload for multi-month master file
  const triggerGlobalUpload = () => {
    setSelectedMonthForUpload(null);
    setTimeout(() => {
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    }, 50);
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

        // Track how many sheets were parsed successfully
        let sheetsCountParsed = 0;

        // Loop sheets
        for (let i = 0; i < workbook.SheetNames.length; i++) {
          const sheetName = workbook.SheetNames[i];
          
          // Skip known plans reference sheets
          if (sheetName.toLowerCase() === "list & fc" || sheetName.toLowerCase().includes("legend") || sheetName.toLowerCase().includes("meta")) {
            continue;
          }

          const sheet = workbook.Sheets[sheetName];
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
            tanggal: isIssuedSheet ? 6 : 0,      // Column G (index 6)
            storage: isIssuedSheet ? 7 : 1,      // Column H (index 7)
            idAlat: isIssuedSheet ? 8 : 2,       // Column I (index 8)
            typeAlat: isIssuedSheet ? (isJuneOrLater ? 10 : 9) : 3,     // Column K (index 10) from June onwards else Column J (index 9)
            hmSebelum: isIssuedSheet ? (isJuneOrLater ? 11 : 10) : 4,   // Column L from June onwards (index 11) else Column K (index 10)
            hmSaatIni: isIssuedSheet ? (isJuneOrLater ? 12 : 11) : 5,   // Column M from June onwards (index 12) else Column L (index 11)
            volumeFuel: isIssuedSheet ? (isJuneOrLater ? 14 : 13) : 6,  // Column O from June onwards (index 14) else Column N (index 13)
          };

          let detectedHeaderRowIdx = -1;

          if (isIssuedSheet) {
            // Strictly lock indices/scan for "Issued" sheet as in App.tsx
            let foundHeaderIdx = -1;
            const scanRowsLimit = Math.min(rawRows.length, 30);
            for (let r = 0; r < scanRowsLimit; r++) {
              const row = rawRows[r];
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

          // Read sheet row by row starting from headers
          const startIdx = detectedHeaderRowIdx !== -1 ? detectedHeaderRowIdx + 1 : 0;
          if (colMap.typeAlat !== -1 && colMap.volumeFuel !== -1) {
            sheetsCountParsed++;
            // Aggregate values for this sheet
            const sheetAggregates: Record<string, { totalVolume: number; totalHours: number; count: number; detectedMonthFromDates: Record<string, number> }> = {};

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

              // Extract vehicule type
              const typeRaw = colMap.typeAlat !== -1 ? row[colMap.typeAlat] : "";
              if (!typeRaw) continue;
              const typeAlat = String(typeRaw).trim();
              if (typeAlat.toLowerCase().includes("tanggal") || typeAlat.toLowerCase().includes("operator")) continue;

              // Extract volumes and HM
              const volVal = colMap.volumeFuel !== -1 ? parseFloat(row[colMap.volumeFuel]) : 0;
              const prevHmVal = colMap.hmSebelum !== -1 ? parseFloat(row[colMap.hmSebelum]) : 0;
              const currHmVal = colMap.hmSaatIni !== -1 ? parseFloat(row[colMap.hmSaatIni]) : 0;
              
              // Seharusnya data liter/jam yaitu pengisian fuel dibagi (HM pengisian hari ini dikurangi HM pengisian sebelumnya)
              let hoursVal = currHmVal - prevHmVal;
              let isAnomalyRow = false;

              // Validate HM values and running hours
              if (isNaN(prevHmVal) || isNaN(currHmVal) || prevHmVal < 0 || currHmVal < 0 || hoursVal <= 0) {
                isAnomalyRow = true;
                hoursVal = 0;
              }
              const validVol = isNaN(volVal) ? 0 : volVal;
              if (validVol <= 0) {
                isAnomalyRow = true;
              }

              // Filter out severe anomalies (unrealistic flow rates, like rate < 3 L/Jam or rate > 120 L/Jam)
              // to prevent corrupted averages (e.g., from reset HM jump or clerical typos).
              if (!isAnomalyRow && hoursVal > 0) {
                const burnRate = validVol / hoursVal;
                if (burnRate < 3.0 || burnRate > 120.0) {
                  isAnomalyRow = true;
                }
              }

              // Attempt to scrape month from date cell
              let rowMonthName = selectedMonthForUpload || monthIdentifier;
              if (!selectedMonthForUpload && colMap.tanggal !== -1 && row[colMap.tanggal]) {
                const normalizedYmd = normalizeDateToYMD(row[colMap.tanggal]);
                if (normalizedYmd) {
                  const parts = normalizedYmd.split("-");
                  if (parts.length === 3) {
                    const mIdx = parseInt(parts[1], 10) - 1;
                    if (mIdx >= 0 && mIdx < 12) {
                      rowMonthName = MONTH_NAMES_IND[mIdx];
                    }
                  }
                }
              }

              const groupKey = typeAlat;
              if (!sheetAggregates[groupKey]) {
                sheetAggregates[groupKey] = { totalVolume: 0, totalHours: 0, count: 0, detectedMonthFromDates: {} };
              }

              // ONLY aggregate valid Operational transactions (where run hour difference and fuel volume are positive)
              // If we add fuel from zero or negative hour transactions to the numerator but 0 to the denominator,
              // the overall average fuel burn rate calculation becomes heavily warped and incorrect.
              if (!isAnomalyRow) {
                sheetAggregates[groupKey].totalVolume += validVol;
                sheetAggregates[groupKey].totalHours += hoursVal;
                sheetAggregates[groupKey].count += 1;
                sheetAggregates[groupKey].detectedMonthFromDates[rowMonthName] = (sheetAggregates[groupKey].detectedMonthFromDates[rowMonthName] || 0) + 1;
              }
            }

            // Convert sheetAggregates to data points
            Object.entries(sheetAggregates).forEach(([typeAlat, val]) => {
              if (val.totalVolume === 0) return; // skip silent items

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
                typeAlat,
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

        // Group and aggregate parsedEntries by (bulan, typeAlat) to avoid any duplicates and resolve mismatches
        const aggregatePts = (ptsArr: typeof parsedEntries) => {
          const map: Record<string, typeof ptsArr[0]> = {};
          ptsArr.forEach(p => {
            const k = `${p.bulan}__${p.typeAlat}`;
            if (!map[k]) {
              map[k] = { ...p };
            } else {
              map[k].totalVolume += p.totalVolume;
              map[k].totalHours += p.totalHours;
              map[k].recordCount += p.recordCount;
            }
          });
          return Object.values(map).map(p => ({
            ...p,
            totalVolume: Number(p.totalVolume.toFixed(1)),
            totalHours: Number(p.totalHours.toFixed(1))
          }));
        };

        const aggregatedParsed = aggregatePts(parsedEntries);

        // Persist each month's data to Firebase Firestore backend
        const monthsInParsed = Array.from(new Set(aggregatedParsed.map(p => p.bulan)));
        for (const mName of monthsInParsed) {
          const mPts = aggregatedParsed.filter(p => p.bulan === mName);
          const mTotalVol = mPts.reduce((sum, p) => sum + p.totalVolume, 0);
          const mTotalHrs = mPts.reduce((sum, p) => sum + p.totalHours, 0);
          const mRecordCount = mPts.reduce((sum, p) => sum + p.recordCount, 0);
          const mIdx = getMonthFromText(mName);
          
          const reportPayload: MonthlyReportData = {
            id: `2026_${mName}`,
            bulan: mName,
            monthIndex: mIdx !== -1 ? mIdx : 0,
            year: 2026,
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            totalVolume: Number(mTotalVol.toFixed(1)),
            totalHours: Number(mTotalHrs.toFixed(1)),
            recordCount: mRecordCount,
            avgBurnRate: mTotalHrs > 0 ? Number((mTotalVol / mTotalHrs).toFixed(2)) : 0,
            typeSummaries: mPts.map(p => ({
              typeAlat: p.typeAlat,
              totalVolume: p.totalVolume,
              totalHours: p.totalHours,
              recordCount: p.recordCount,
              burnRate: p.totalHours > 0 ? Number((p.totalVolume / p.totalHours).toFixed(2)) : 0
            }))
          };
          
          try {
            await saveMonthlyReportToFirestore(reportPayload);
          } catch (cloudErr) {
            console.warn("Penyimpanan Firestore backend notice:", cloudErr);
          }
        }

        let nextPts: typeof dataPoints = [];
        let nextMonths: string[] = [];

        if (selectedMonthForUpload) {
          const clean = dataPoints.filter(d => d.bulan !== selectedMonthForUpload);
          nextPts = aggregatePts([...clean, ...aggregatedParsed]);
          nextMonths = uploadedMonths.includes(selectedMonthForUpload)
            ? uploadedMonths
            : [...uploadedMonths, selectedMonthForUpload];
          
          setDataPoints(nextPts);
          setUploadedMonths(nextMonths);
          saveLocalData("yearly_data_points", nextPts);
          saveLocalData("yearly_uploaded_months", nextMonths);

          setFeedback({
            type: "success",
            message: `Sukses mengunggah & menyimpan data bulan ${selectedMonthForUpload} ke Cloud Firebase (fuel-wbs)! Terdeteksi ${aggregatedParsed.length} jenis alat berat.`
          });
        } else {
          const parsedMonths = Array.from(new Set(aggregatedParsed.map(e => e.bulan)));
          const clean = dataPoints.filter(d => !parsedMonths.includes(d.bulan));
          nextPts = aggregatePts([...clean, ...aggregatedParsed]);
          nextMonths = Array.from(new Set([...uploadedMonths, ...parsedMonths]));

          setDataPoints(nextPts);
          setUploadedMonths(nextMonths);
          saveLocalData("yearly_data_points", nextPts);
          saveLocalData("yearly_uploaded_months", nextMonths);

          setFeedback({
            type: "success",
            message: `Sukses menganalisa & menyimpan ${sheetsCountParsed} sheet data bulanan ke Cloud Firebase! Melacak ${aggregatedParsed.length} kategori tipe alat.`
          });
        }

        setSelectedHighlightType("SEMUA");
      } catch (err: any) {
        setFeedback({
          type: "error",
          message: `Gagal membaca file Yearly Review: ${err.message || "Periksa kesesuaian data."}`
        });
      } finally {
        setIsProcessing(false);
        // Clear input so same file can be selection-triggered again
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };

    reader.readAsArrayBuffer(file);
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
    return max * 1.15; // Give 15% padding at top
  }, [uniqueEquipmentTypes, currentMonths, pivotTableData, activeAnalysisMetric, selectedHighlightType]);

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
      
      {/* Upper Action Hero Card */}
      <div className="bg-gradient-to-r from-[#1E293B] to-[#0F172A] text-white p-6 sm:p-8 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden">
        {/* Abstract decorative graphic shape in background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-1/3 w-60 h-60 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none -mb-10"></div>

        <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-[#4682B4] bg-[#2E4A62] px-3 py-1.5 rounded-full border border-blue-500/20 shadow-sm shadow-blue-900/10">
                <Calendar className="w-3.5 h-3.5" />
                <span>Yearly Review Module</span>
              </span>

              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                isCloudConnected 
                  ? "bg-amber-500/10 text-amber-300 border-amber-500/30" 
                  : "bg-slate-700/50 text-slate-400 border-slate-600"
              }`}>
                <Database className="w-3 h-3 text-amber-400" />
                <span>Firebase Backend: fuel-wbs</span>
                {isSyncingCloud && <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-300 ml-1" />}
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Analisa Fuel Burn Yearly
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed">
              Menyajikan data fuel burn sesuai kategori alat berat yang tersimpan otomatis di Firebase Firestore.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={handleManualCloudRefresh}
              disabled={isSyncingCloud}
              className="text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 font-bold px-4 py-3 rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2 border border-slate-700"
              title="Tarik & sinkronkan data bulanan terbaru dari Cloud Firestore"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-amber-400 ${isSyncingCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingCloud ? "Sinkronisasi..." : "Sync Cloud"}</span>
            </button>

            <button
              onClick={exportToPdf}
              disabled={isExportingPdf}
              className="text-xs bg-[#E11D48] hover:bg-[#BE123C] disabled:opacity-50 text-white font-extrabold px-5 py-3 rounded-xl shadow-md transition active:scale-95 cursor-pointer flex items-center gap-2 border border-rose-400/20"
              title="Ekspor laporan tahunan ini ke dokumen PDF"
            >
              <FileText className="w-4 h-4" />
              <span>{isExportingPdf ? "Mengekspor PDF..." : "Export PDF"}</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple={false}
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>

        {/* Feedback Alert Toast inside card for tidy layout */}
        {feedback.message && (
          <div className={`mt-5 p-3.5 rounded-xl text-xs flex items-start gap-2.5 max-w-4xl border ${
            feedback.type === "success" 
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/25 text-rose-300"
          }`}>
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-405 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-405 shrink-0 mt-0.5 animate-bounce" />
            )}
            <div>
              <p className="font-bold">{feedback.type === "success" ? "Analisis Sukses" : "Peringatan Sistem"}</p>
              <p className="mt-0.5 text-[11px] opacity-90 leading-relaxed font-mono">{feedback.message}</p>
            </div>
          </div>
        )}
      </div>

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

      {/* Left-Right Split: Graphic Dashboard (Left) & Highlight Pivot Grid (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* CHART PORT (lg:col-span-8) */}
        <div className="lg:col-span-8 bg-white border border-slate-200 shadow-sm rounded-xl p-5 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-[#4682B4]" />
              <div>
                <h3 className="text-sm font-extrabold text-slate-800">Grafik Fuel Burn</h3>
                <p className="text-[10px] text-slate-400 font-bold">Gunakan menu pilihan tipe alat di bawah untuk memfilter grafik secara dinamis</p>
              </div>
            </div>
 
            {/* Metric switches */}
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
          </div>
 
          {/* Interactive Legend Dropdown */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">Kategori Tipe Alat Berat:</span>
            <div className="relative">
              <select
                id="equipment-type-dropdown"
                value={selectedHighlightType}
                onChange={(e) => setSelectedHighlightType(e.target.value)}
                className="text-xs bg-white border border-slate-250 text-slate-705 px-3.5 py-2 pr-9 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4682B4] font-bold cursor-pointer transition appearance-none min-w-[200px]"
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
              <svg viewBox="0 0 750 300" className="w-full h-auto overflow-visible select-none">
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
                        x2="720"
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

                {/* X Axis Month Labels */}
                {currentMonths.map((m, mIdx) => {
                  const xVal = 80 + mIdx * ((720 - 80) / (currentMonths.length - 1));
                  return (
                    <g key={m}>
                      {/* Vertical line helper */}
                      <line
                        x1={xVal}
                        y1="50"
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
                    const xVal = 80 + mIdx * ((720 - 80) / (currentMonths.length - 1));

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

                      {/* Points Circles */}
                      {points.map((p, pIdx) => {
                        const formattedVal = (activeAnalysisMetric === "burnRate")
                          ? `${p.val.toFixed(2)} L/Jam`
                          : `${Math.round(p.val).toLocaleString("id-ID")} ${activeAnalysisMetric === "volume" ? "Liter" : "Jam"}`;

                        return (
                          <g key={pIdx} className="group/dot">
                            <circle
                              cx={p.x}
                              cy={p.y}
                              r={selectedHighlightType === t ? "6" : "4"}
                              fill={strokeColor}
                              stroke="#FFFFFF"
                              strokeWidth="2"
                              className="transition-transform duration-100 hover:scale-150 cursor-pointer"
                            />
                            {/* Hover Tooltip inside SVG directly */}
                            <g className="opacity-0 group-hover/dot:opacity-100 transition-opacity duration-150 pointer-events-none">
                              <rect
                                x={p.x - 65}
                                y={p.y - 36}
                                width="130"
                                height="28"
                                rx="6"
                                fill="#1E293B"
                                className="shadow-lg"
                              />
                              <text
                                x={p.x}
                                y={p.y - 20}
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

        {/* COMPARISON PIVOT GRID (lg:col-span-4) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 shadow-sm rounded-xl p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-1 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Table className="w-5 h-5 text-slate-700" />
              <h3 className="text-sm font-extrabold text-slate-800">Tabel Fuel Burn</h3>
            </div>
            <p className="text-[10px] text-slate-400 font-bold">Tabel evaluasi log bahan bakar berdasarkan rentang periode aktif</p>
          </div>

          {/* Table container */}
          <div className="overflow-x-auto border border-slate-100 rounded-lg">
            <table className="w-full text-left text-[11px] font-sans border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="p-2.5 font-extrabold sticky left-0 bg-slate-50 border-r border-slate-100">Tipe Alat</th>
                  {currentMonths.map(m => (
                    <th key={m} className="p-2.5 text-center font-extrabold whitespace-nowrap min-w-[75px]">{m.substring(0, 3)}</th>
                  ))}
                  <th className="p-2.5 text-center font-extrabold bg-slate-100/50">Plan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {uniqueEquipmentTypes
                  .filter((t) => selectedHighlightType === "SEMUA" || selectedHighlightType === t)
                  .map((type) => {
                    const planValue = DEFAULT_TYPE_PLANS[type] || 0;
                  
                  return (
                    <tr key={type} className="hover:bg-slate-50/50 transition">
                      {/* Name Col */}
                      <td className="p-2.5 font-bold text-slate-800 sticky left-0 bg-white border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)] whitespace-nowrap">
                        {type}
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
                            className={`p-2.5 text-center font-mono ${
                              isOverPlan 
                                ? "bg-rose-50 text-rose-600 font-extrabold" 
                                : cell && cell.count > 0 && activeAnalysisMetric === "burnRate"
                                ? "bg-emerald-50 text-emerald-700"
                                : ""
                            }`}
                          >
                            {content}
                          </td>
                        );
                      })}

                      {/* Plan Col */}
                      <td className="p-2.5 text-center font-mono font-bold bg-slate-100/30 text-slate-500">
                        {planValue > 0 ? planValue : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 12 MONTHLY UPLOAD DECK */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-[#4682B4] animate-pulse" />
            <div>
              <h3 className="text-sm font-extrabold text-slate-800">Detail Report Fuel Monthly</h3>
              <p className="text-[10px] text-slate-400 font-bold">Upload file log pengisian BBM terpisah untuk tiap-tiap bulan.</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

                <div className="flex items-center gap-1.5 mt-2">
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

    </div>
  );
}
