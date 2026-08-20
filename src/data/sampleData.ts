import { FuelRecord } from "../types";

// Helper to reliably convert any Excel/CSV date format into correct YYYY-MM-DD string
export function normalizeDateToYMD(cellVal: any): string {
  if (cellVal === undefined || cellVal === null) return "";
  
  if (typeof cellVal === "number") {
    try {
      // Excel serial date starting from 1900-01-01
      const dateObj = new Date((cellVal - 25569) * 86400 * 1000);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().split("T")[0];
      }
    } catch (_) {}
  }
  
  if (cellVal instanceof Date) {
    try {
      if (!isNaN(cellVal.getTime())) {
        return cellVal.toISOString().split("T")[0];
      }
    } catch (_) {}
  }

  // Handle strings
  let str = String(cellVal).trim();
  if (!str) return "";

  // Split off any time part e.g., "2026-05-27 12:00:00" -> "2026-05-27"
  let datePart = str.split(/[ T]/)[0];

  // Standardise separators to '/'
  const workingStr = datePart.replace(/[-.]/g, "/");
  const parts = workingStr.split("/");

  if (parts.length === 3) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();

    // Case 1: YYYY/MM/DD
    if (p0.length === 4) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
    
    // Case 2: DD/MM/YYYY
    if (p2.length === 4) {
      return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }

    // Case 3: DD/MM/YY
    if (p2.length === 2) {
      const yearPrefix = parseInt(p2) > 50 ? "19" : "20";
      return `${yearPrefix}${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }
  }

  // Fallback: If it's already in YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
    return datePart;
  }

  return datePart;
}

// Dynamic helper to compute values for a raw row
export function processRecord(raw: Omit<FuelRecord, 'selisihHm' | 'fuelBurnRate' | 'isAnomaly' | 'anomalyMessage'>): FuelRecord {
  const selisihHm = Number((raw.hmSaatIni - raw.hmSebelum).toFixed(2));
  let fuelBurnRate = 0;
  let isAnomaly = false;
  let anomalyMessage = "";

  if (raw.hmSebelum < 0 || raw.hmSaatIni < 0) {
    isAnomaly = true;
    anomalyMessage = "Nilai HM tidak boleh negatif";
  } else if (selisihHm === 0) {
    isAnomaly = true;
    anomalyMessage = "Selisih HM Nol (0 Jam / No Run Hour)";
  } else if (selisihHm < 0) {
    isAnomaly = true;
    anomalyMessage = `HM Mundur (${selisihHm} Jam - Indikasi Reset/Kerusakan)`;
  } else {
    fuelBurnRate = Number((raw.volumeFuel / selisihHm).toFixed(2));
    
    // Additional logic warning: typical heavy machinery burn rates
    // Excavator PC200 typically burns 15 - 28 L/h
    // Dump Truck HD785 typically burns 55 - 90 L/h
    // Bulldozer D85SS typically burns 20 - 35 L/h
    // Standard flagging if fuel burn rate exceeds realistic thresholds for safety audit
    if (fuelBurnRate > 120) {
      isAnomaly = true;
      anomalyMessage = `Fuel Burn Sangat Tinggi (${fuelBurnRate} L/Jam - Indikasi Kebocoran/Salah input)`;
    } else if (fuelBurnRate < 3) {
      isAnomaly = true;
      anomalyMessage = `Fuel Burn Sangat Rendah (${fuelBurnRate} L/Jam - Indikasi Manipulasi HM)`;
    }
  }

  return {
    ...raw,
    selisihHm,
    fuelBurnRate,
    isAnomaly,
    anomalyMessage
  };
}

// Initial high-quality dataset matching real-life log
const RAW_SAMPLE_DATA: Omit<FuelRecord, 'selisihHm' | 'fuelBurnRate' | 'isAnomaly' | 'anomalyMessage'>[] = [
  {
    id: "rec-001",
    tanggal: "2026-05-27",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-01",
    typeAlat: "Excavator PC200",
    hmSebelum: 4210.5,
    hmSaatIni: 4220.5, // 10 hrs
    volumeFuel: 220, // 22 l/hr
    operator: "Rahmad Hidayat",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "08:30"
  },
  {
    id: "rec-002",
    tanggal: "2026-05-27",
    storage: "Fuel Truck FT-01",
    idAlat: "DT-HD785-05",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 9845.2,
    hmSaatIni: 9853.2, // 8 hrs
    volumeFuel: 560, // 70 l/hr
    operator: "Slamet Santoso",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "09:15"
  },
  {
    id: "rec-003",
    tanggal: "2026-05-26",
    storage: "Temporary Tank Pit A",
    idAlat: "BULL-D85-02",
    typeAlat: "Bulldozer D85SS",
    hmSebelum: 1145.0,
    hmSaatIni: 1157.0, // 12 hrs
    volumeFuel: 312, // 26 l/hr
    operator: "Budi Wijaya",
    fuelman: "Eko Prasetyo",
    shift: "Shift 2 - Malam",
    jam: "22:45"
  },
  {
    id: "rec-004",
    tanggal: "2026-05-26",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-02",
    typeAlat: "Excavator PC200",
    hmSebelum: 3012.1,
    hmSaatIni: 3020.1, // 8 hrs
    volumeFuel: 216, // 27 l/hr
    operator: "Ahmad Rivai",
    fuelman: "Eko Prasetyo",
    shift: "Shift 1 - Siang",
    jam: "14:10"
  },
  {
    id: "rec-005",
    tanggal: "2026-05-25",
    storage: "Fuel Truck FT-02",
    idAlat: "DT-HD785-06",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 8710.0,
    hmSaatIni: 8721.5, // 11.5 hrs
    volumeFuel: 860, // 74.78 l/hr
    operator: "Wawan Setiawan",
    fuelman: "Agus Triyono",
    shift: "Shift 1 - Siang",
    jam: "11:20"
  },
  {
    id: "rec-006",
    tanggal: "2026-05-25",
    storage: "Storage Utama Central",
    idAlat: "GRAD-GD511-01",
    typeAlat: "Motor Grader GD511",
    hmSebelum: 5120.4,
    hmSaatIni: 5128.4, // 8 hrs
    volumeFuel: 144, // 18 l/hr
    operator: "Dedi Kurniawan",
    fuelman: "Agus Triyono",
    shift: "Shift 1 - Siang",
    jam: "15:45"
  },
  {
    // Test Case for HM difference is 0 (Anomaly)
    id: "rec-007",
    tanggal: "2026-05-24",
    storage: "Temporary Tank Pit A",
    idAlat: "EXC-PC200-01",
    typeAlat: "Excavator PC200",
    hmSebelum: 4180.0,
    hmSaatIni: 4180.0, // 0 hrs - error mitigation!
    volumeFuel: 150,
    operator: "Rahmad Hidayat",
    fuelman: "Yusuf Efendi",
    shift: "Shift 2 - Malam",
    jam: "20:00"
  },
  {
    // Test Case for Negative Hour difference (Anomaly / Error)
    id: "rec-008",
    tanggal: "2026-05-24",
    storage: "Fuel Truck FT-01",
    idAlat: "DT-HD785-07",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 6732.5,
    hmSaatIni: 6720.0, // Negative HM difference!
    volumeFuel: 400,
    operator: "Slamet Santoso",
    fuelman: "Agus Triyono",
    shift: "Shift 2 - Malam",
    jam: "01:10"
  },
  {
    id: "rec-009",
    tanggal: "2026-05-23",
    storage: "Storage Utama Central",
    idAlat: "BULL-D85-01",
    typeAlat: "Bulldozer D85SS",
    hmSebelum: 13910.1,
    hmSaatIni: 13920.1, // 10 hrs
    volumeFuel: 380, // 38 l/hr (elevated!)
    operator: "Budi Wijaya",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "09:50"
  },
  {
    id: "rec-010",
    tanggal: "2026-05-23",
    storage: "Fuel Truck FT-02",
    idAlat: "LOAD-WA500-02",
    typeAlat: "Wheel Loader WA500",
    hmSebelum: 7291.5,
    hmSaatIni: 7301.5, // 10 hrs
    volumeFuel: 320, // 32 l/hr
    operator: "Ahmad Rivai",
    fuelman: "Yusuf Efendi",
    shift: "Shift 1 - Siang",
    jam: "10:30"
  },
  {
    id: "rec-011",
    tanggal: "2026-05-22",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-03",
    typeAlat: "Excavator PC200",
    hmSebelum: 2894.2,
    hmSaatIni: 2904.2, // 10 hrs
    volumeFuel: 210, // 21 l/hr
    operator: "Rahmad Hidayat",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "08:15"
  },
  {
    id: "rec-012",
    tanggal: "2026-05-22",
    storage: "Fuel Truck FT-01",
    idAlat: "DT-HD785-05",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 9812.0,
    hmSaatIni: 9823.5, // 11.5 hrs
    volumeFuel: 1100, // 95.65 l/hr (extremely high!)
    operator: "Slamet Santoso",
    fuelman: "Andi Susanto",
    shift: "Shift 2 - Malam",
    jam: "23:00"
  },
  {
    id: "rec-013",
    tanggal: "2026-05-21",
    storage: "Storage Utama Central",
    idAlat: "BULL-D85-02",
    typeAlat: "Bulldozer D85SS",
    hmSebelum: 1120.0,
    hmSaatIni: 1130.0, // 10 hrs
    volumeFuel: 250, // 25 L/h
    operator: "Budi Wijaya",
    fuelman: "Eko Prasetyo",
    shift: "Shift 1 - Siang",
    jam: "11:45"
  },
  {
    id: "rec-014",
    tanggal: "2026-05-20",
    storage: "Temporary Tank Pit A",
    idAlat: "EXC-PC200-02",
    typeAlat: "Excavator PC200",
    hmSebelum: 2990.5,
    hmSaatIni: 3000.5, // 10 hrs
    volumeFuel: 195, // 19.5 L/h
    operator: "Ahmad Rivai",
    fuelman: "Yusuf Efendi",
    shift: "Shift 2 - Malam",
    jam: "21:30"
  },
  {
    id: "rec-015",
    tanggal: "2026-05-19",
    storage: "Fuel Truck FT-02",
    idAlat: "GRAD-GD511-01",
    typeAlat: "Motor Grader GD511",
    hmSebelum: 5102.1,
    hmSaatIni: 5110.1, // 8 hrs
    volumeFuel: 136, // 17 L/h
    operator: "Dedi Kurniawan",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "14:15"
  },
  {
    id: "rec-016",
    tanggal: "2026-05-18",
    storage: "Storage Utama Central",
    idAlat: "DT-HD785-06",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 8680.2,
    hmSaatIni: 8692.2, // 12 hrs
    volumeFuel: 924, // 77 L/h
    operator: "Wawan Setiawan",
    fuelman: "Eko Prasetyo",
    shift: "Shift 1 - Siang",
    jam: "16:20"
  },
  {
    id: "rec-017",
    tanggal: "2026-05-15",
    storage: "Fuel Truck FT-01",
    idAlat: "LOAD-WA500-02",
    typeAlat: "Wheel Loader WA500",
    hmSebelum: 7260.0,
    hmSaatIni: 7272.0, // 12 hrs
    volumeFuel: 396, // 33 L/h
    operator: "Ahmad Rivai",
    fuelman: "Agus Triyono",
    shift: "Shift 2 - Malam",
    jam: "19:45"
  },
  {
    id: "rec-018",
    tanggal: "2026-05-12",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-01",
    typeAlat: "Excavator PC200",
    hmSebelum: 4122.0,
    hmSaatIni: 4132.0, // 10 hrs
    volumeFuel: 215, // 21.5 L/h
    operator: "Rahmad Hidayat",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "08:10"
  },
  {
    id: "rec-019",
    tanggal: "2026-05-10",
    storage: "Fuel Truck FT-02",
    idAlat: "DT-HD785-05",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 9750.5,
    hmSaatIni: 9762.5, // 12 hrs
    volumeFuel: 1020, // 85 L/h (Typical High)
    operator: "Slamet Santoso",
    fuelman: "Yusuf Efendi",
    shift: "Shift 2 - Malam",
    jam: "22:15"
  },
  {
    id: "rec-020",
    tanggal: "2026-05-08",
    storage: "Temporary Tank Pit A",
    idAlat: "BULL-D85-01",
    typeAlat: "Bulldozer D85SS",
    hmSebelum: 13880.0,
    hmSaatIni: 13890.0, // 10 hrs
    volumeFuel: 280, // 28 L/h
    operator: "Budi Wijaya",
    fuelman: "Eko Prasetyo",
    shift: "Shift 1 - Siang",
    jam: "10:00"
  },
  {
    id: "rec-021",
    tanggal: "2026-05-05",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-03",
    typeAlat: "Excavator PC200",
    hmSebelum: 2865.0,
    hmSaatIni: 2875.0, // 10 hrs
    volumeFuel: 240, // 24 L/h
    operator: "Rahmad Hidayat",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "08:45"
  },
  {
    // High anomaly test case for verification
    id: "rec-022",
    tanggal: "2026-05-03",
    storage: "Storage Utama Central",
    idAlat: "DT-HD785-06",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 8650.0,
    hmSaatIni: 8652.0, // only 2 hrs
    volumeFuel: 950, // 475 L/hour! Obvious leak or key error
    operator: "Wawan Setiawan",
    fuelman: "Yusuf Efendi",
    shift: "Shift 1 - Siang",
    jam: "11:00"
  },
  {
    id: "rec-023",
    tanggal: "2026-04-28",
    storage: "Fuel Truck FT-01",
    idAlat: "DT-HD785-07",
    typeAlat: "Dump Truck HD785",
    hmSebelum: 6690.0,
    hmSaatIni: 6702.0, // 12 hrs
    volumeFuel: 936, // 78 L/h
    operator: "Slamet Santoso",
    fuelman: "Andi Susanto",
    shift: "Shift 2 - Malam",
    jam: "23:30"
  },
  {
    id: "rec-024",
    tanggal: "2026-04-20",
    storage: "Temporary Tank Pit A",
    idAlat: "BULL-D85-02",
    typeAlat: "Bulldozer D85SS",
    hmSebelum: 1045.0,
    hmSaatIni: 1055.0, // 10 hrs
    volumeFuel: 230, // 23 L/h
    operator: "Budi Wijaya",
    fuelman: "Agus Triyono",
    shift: "Shift 1 - Siang",
    jam: "11:15"
  },
  {
    id: "rec-025",
    tanggal: "2026-04-12",
    storage: "Storage Utama Central",
    idAlat: "EXC-PC200-02",
    typeAlat: "Excavator PC200",
    hmSebelum: 2950.0,
    hmSaatIni: 2960.0, // 10 hrs
    volumeFuel: 220, // 22 L/h
    operator: "Ahmad Rivai",
    fuelman: "Andi Susanto",
    shift: "Shift 1 - Siang",
    jam: "14:40"
  }
];

export const INITIAL_FUEL_DATA: FuelRecord[] = RAW_SAMPLE_DATA.map(processRecord);

// Parse tab-separated pasted data or standard CSV
export function parsePastedData(text: string): FuelRecord[] {
  if (!text || text.trim() === "") return [];

  const lines = text.trim().split(/\r?\n/);
  const results: FuelRecord[] = [];

  lines.forEach((line, index) => {
    // Skip empty lines
    if (!line.trim()) return;

    // Split by tab (Excel/Google Sheets copy paste) or comma/semicolon for CSV
    let parts: string[] = [];
    if (line.includes("\t")) {
      parts = line.split("\t");
    } else if (line.includes(";")) {
      parts = line.split(";");
    } else {
      parts = line.split(",");
    }

    // Clean padding spaces
    parts = parts.map(p => p.trim());

    // Check if it's a header line: skip if it contains words like "tanggal" or "storage" or "unit"
    const isHeader = parts.some(p => {
      const low = p.toLowerCase();
      return low.includes("tanggal") || low.includes("storage") || low.includes("unit") || low.includes("nomor") || low.includes("previous") || low.includes("operator");
    });

    if (isHeader && index === 0) {
      return; // Skip header
    }

    // If there aren't enough cells, we gracefully fill values or skip
    if (parts.length < 5) return;

    // Map column values based on expected structure or count
    // Provided structure:
    // Kolom G (0): Tanggal
    // Kolom H (1): Tempat/Storage
    // Kolom I (2): Nomor unit (ID Alat)
    // Kolom J (3): Type alat berat
    // Kolom K (4): HM sebelumnya
    // Kolom L (5): HM saat ini
    // Kolom N (6 / 7 if gap): Volume fuel (Liter)
    // Kolom R (7/8/9...): Operator
    // Kolom U: Fuelman
    // Kolom V: Shift
    // Kolom W: Jam pengisian
    
    // Fallback: If pasting exactly the 11 columns query specified in order:
    // [Tanggal, Tempat/Storage, ID Alat, Type, HM Seb, HM Saat ini, Volume, Operator, Fuelman, Shift, Jam]
    let tanggal = parts[0] || new Date().toISOString().split('T')[0];
    let storage = parts[1] || "Storage Utama Central";
    let idAlat = parts[2] || `UNIT-${Math.floor(100 + Math.random() * 900)}`;
    let typeAlat = parts[3] || "Excavator PC200";
    let hmSebelum = parseFloat(parts[4]) || 0;
    let hmSaatIni = parseFloat(parts[5]) || 0;
    let volumeFuel = parseFloat(parts[6]) || 0;
    let operator = parts[7] || "Operator Standard";
    let fuelman = parts[8] || "Fuelman Standard";
    let shift = parts[9] || "Shift 1 - Siang";
    let jam = parts[10] || "12:00";

    // If there were gaps in columns (or copy-paste spanning the entire excel row):
    // Standard row structure for the full G to W range (17 columns):
    // G:0, H:1, I:2, J:3, K:4, L:5, M:6, N:7 (Volume), O:8, P:9, Q:10, R:11 (Operator), S:12, T:13, U:14 (Fuelman), V:15 (Shift), W:16 (Jam)
    if (parts.length >= 15) {
      tanggal = parts[0] || tanggal;
      storage = parts[1] || storage;
      idAlat = parts[2] || idAlat;
      typeAlat = parts[3] || typeAlat;
      hmSebelum = parseFloat(parts[4]) || 0;
      hmSaatIni = parseFloat(parts[5]) || 0;
      // Kolom N is the 8th item (index 7) if counting G as index 0
      volumeFuel = parseFloat(parts[7]) || parseFloat(parts[6]) || 0;
      // Kolom R is index 11 (A:0, B:1... G:6, H:7, I:8... R:17... wait, G is index 0)
      // G(0), H(1), I(2), J(3), K(4), L(5), M(6), N(7), O(8), P(9), Q(10), R(11), S(12), T(13), U(14), V(15), W(16)
      operator = parts[11] || operator;
      fuelman = parts[14] || fuelman;
      shift = parts[15] || shift;
      jam = parts[16] || jam;
    }

    // Double-check date parsing
    // Standardise dates: if entered in DD/MM/YYYY, convert to YYYY-MM-DD
    tanggal = normalizeDateToYMD(tanggal);

    const rawRecord = {
      id: `rec-pasted-${index}-${Date.now()}`,
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
    };

    results.push(processRecord(rawRecord));
  });

  return results;
}
