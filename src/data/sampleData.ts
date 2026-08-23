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

export const MONTH_NAMES_IND = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

export const MASTER_JULY_BENCHMARKS: Record<string, number> = {
  "DUMP TRUCK": 15.0,
  "FLAT DECK": 6.5,
  "EXCAVATOR": 14.5,
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
  "HINO 500 (FM280JD)": 6.5,
  "HINO 500 (FM260JD)": 6.5,
  "HYUNDAI PC 495": 30.0,
  "KOMATSU FD150E - 8": 6.0,
  "KOMATSU GD 535": 10.0,
  "KOMATSU PC 210": 13.0,
  "CAT 320 GC": 16.0,
  "PC 200": 14.0,
  "DUTRO 136 HD": 6.0,
  "TOYOTA INNOVA": 4.0,
  "KOMATSU D85SS": 25.0,
  "KOMATSU WA 500": 24.0,
  "CAT 980 NG": 24.0,
  "CATERPILAR CS 11 GC": 8.0,
};

// Helper to clean and normalize Egy names (remove any legacy redundant 'EGY ' prefix and map fleet model names to canonical Egy)
export function cleanEgyName(name: string): string {
  if (!name) return "";
  let clean = name.trim();
  if (clean.toUpperCase().startsWith("EGY ")) {
    clean = clean.substring(4).trim();
  }
  const upper = clean.toUpperCase();

  // 1. Flat Deck (FD prefixes or FLAT DECK / FLAT name) - MUST BE CHECKED BEFORE FORKLIFT!
  if (upper.includes("FLAT DECK") || upper.includes("FLATDECK") || upper.startsWith("FLAT") || upper.startsWith("FD")) {
    return "FLAT DECK";
  }

  // 2. Forklift (FL prefixes or FORKLIFT / FORK name, excluding FLAT)
  if (upper.includes("FORKLIFT") || upper.startsWith("FORK") || (upper.startsWith("FL") && !upper.startsWith("FLAT")) || upper.includes("KOMATSU FD150") || upper.includes("FD150E")) {
    return "FORKLIFT";
  }

  // 3. Compactor
  if (upper.includes("CS 11") || upper.includes("CS11") || upper.includes("COMPACTOR") || upper.includes("VIBRO") || upper.includes("BOMAG") || upper.includes("CATERPILAR CS") || upper.includes("CATERPILLAR CS") || upper.startsWith("CP") || upper.startsWith("CS") || upper.startsWith("VB")) {
    return "COMPACTOR";
  }

  // 4. Bulldozer
  if (upper.includes("D8T") || upper.includes("D85") || upper.includes("BULLDOZER") || upper.includes("DOZER") || upper.startsWith("DZ") || upper.startsWith("BD") || upper.startsWith("BULL")) {
    return "BULLDOZER";
  }

  // 5. Motor Grader
  if (upper.includes("GD 535") || upper.includes("GD535") || upper.includes("GD 511") || upper.includes("GD511") || upper.includes("MOTOR GRADER") || upper.includes("GRADER") || upper.startsWith("GD") || upper.startsWith("MG") || upper.startsWith("GRAD")) {
    return "MOTOR GRADER";
  }

  // 6. Water Truck (MUST BE CHECKED BEFORE WHEEL LOADER to prevent 'WA' prefix collision with 'WATER')
  if (upper.includes("WATER TRUCK") || upper.includes("WATER") || upper.startsWith("WT") || upper.startsWith("WR")) {
    return "WATER TRUCK";
  }

  // 7. Wheel Loader (WL / WA500 / CAT 980 / LOADER, strictly excluding WATER)
  if (upper.includes("WA 500") || upper.includes("WA500") || upper.includes("980 NG") || upper.includes("980NG") || upper.includes("CAT 980") || upper.includes("WHEEL LOADER") || upper.includes("LOADER") || upper.startsWith("WL") || (upper.startsWith("WA") && !upper.startsWith("WAT")) || upper.startsWith("LOAD")) {
    return "WHEEL LOADER";
  }

  // 8. Excavator
  if (upper.includes("PC 210") || upper.includes("PC210") || upper.includes("320 GC") || upper.includes("320GC") || upper.includes("PC 495") || upper.includes("PC495") || upper.includes("EXCAVATOR") || upper.includes("EXCA") || upper.startsWith("EX") || upper.startsWith("PC") || upper.startsWith("HY")) {
    return "EXCAVATOR";
  }

  // 9. Dump Truck
  if (upper.includes("FM260") || upper.includes("FM280") || upper.includes("HD785") || upper.includes("DUMP TRUCK") || upper.startsWith("DT") || upper.startsWith("HD")) {
    return "DUMP TRUCK";
  }

  // 10. Crane Truck
  if (upper.includes("CRANE TRUCK") || (upper.includes("CRANE") && !upper.includes("KONECRANE")) || upper.startsWith("CT")) {
    return "CRANE TRUCK";
  }

  // 11. Reach Stacker
  if (upper.includes("KONECRANE") || upper.includes("REACH STACKER") || upper.includes("45T") || upper.startsWith("RS") || upper.startsWith("KC")) {
    return "REACH STACKER";
  }

  // 12. Tower Lamp
  if (upper.includes("TOWER LAMP") || upper.includes("TOWERLAMP") || upper.startsWith("TL")) {
    return "TOWER LAMP";
  }

  // 13. Light Vehicle
  if (upper.includes("LIGHT VEHICLE") || upper.includes("INNOVA") || upper.includes("HILUX") || upper.includes("TRITON") || upper.startsWith("LV")) {
    return "LIGHT VEHICLE";
  }

  // 14. Genset
  if (upper.includes("GENSET") || upper.startsWith("GS") || upper.startsWith("GEN")) {
    return "GENSET";
  }

  // 15. Fuel Truck
  if (upper.includes("FUEL TRUCK") || upper.includes("DUTRO") || upper.startsWith("FT") || upper.startsWith("FUEL")) {
    return "FUEL TRUCK";
  }

  return clean;
}

export interface JulyEquipmentMaster {
  egy: string;
  type: string;
}

// Canonical July Benchmark Master Map (Kolom C: Equipment, Kolom D: Egy, Kolom E: Type)
export const JULY_BENCHMARK_MASTER: Record<string, JulyEquipmentMaster> = {
  // Dump Trucks
  "DT23001": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "DT23002": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "DT23003": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "DT23004": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "DT23005": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT23006": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT23007": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT23008": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT23009": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT-01": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "DT-02": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT-HD785-05": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT-HD785-06": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "DT-HD785-07": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "HN-260-01": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "HN-260-02": { egy: "DUMP TRUCK", type: "HINO 500 (FM260JD)" },
  "HN-280-01": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },
  "HN-280-02": { egy: "DUMP TRUCK", type: "HINO 500 (FM280JD)" },

  // Bulldozers
  "DZ23001": { egy: "BULLDOZER", type: "CATERPILAR D8T" },
  "DZ-01": { egy: "BULLDOZER", type: "CATERPILAR D8T" },
  "BULL-D85-01": { egy: "BULLDOZER", type: "KOMATSU D85SS" },
  "BULL-D85-02": { egy: "BULLDOZER", type: "KOMATSU D85SS" },
  "BD-01": { egy: "BULLDOZER", type: "KOMATSU D85SS" },

  // Tower Lamp
  "TL23002": { egy: "TOWER LAMP", type: "TOWER LAMP" },
  "TL-01": { egy: "TOWER LAMP", type: "TOWER LAMP" },
  "TL-02": { egy: "TOWER LAMP", type: "TOWER LAMP" },

  // Light Vehicles
  "LV23207": { egy: "LIGHT VEHICLE", type: "TOYOTA INNOVA" },
  "LV-01": { egy: "LIGHT VEHICLE", type: "TOYOTA INNOVA" },
  "LV-02": { egy: "LIGHT VEHICLE", type: "TOYOTA INNOVA" },
  "LV-HILUX-01": { egy: "LIGHT VEHICLE", type: "LIGHT VEHICLE" },
  "LIGHT VEHICLE": { egy: "LIGHT VEHICLE", type: "LIGHT VEHICLE" },

  // Excavators
  "EX23001": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "EX23203": { egy: "EXCAVATOR", type: "CAT 320 GC" },
  "EX-01": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "EX-02": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "EXC-PC200-01": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "EXC-PC200-02": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "EXC-PC200-03": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "PC-210-01": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "PC-210-02": { egy: "EXCAVATOR", type: "KOMATSU PC 210" },
  "HY-495-01": { egy: "EXCAVATOR", type: "HYUNDAI PC 495" },
  "HYUNDAI-495": { egy: "EXCAVATOR", type: "HYUNDAI PC 495" },
  "PC-495-01": { egy: "EXCAVATOR", type: "HYUNDAI PC 495" },

  // Crane Truck
  "CT23001": { egy: "CRANE TRUCK", type: "HINO 500 (FM280JD)" },
  "CT-01": { egy: "CRANE TRUCK", type: "HINO 500 (FM280JD)" },

  // Fuel Truck
  "FT23001": { egy: "FUEL TRUCK", type: "DUTRO 136 HD" },
  "FT-01": { egy: "FUEL TRUCK", type: "DUTRO 136 HD" },

  // Forklift & Heavy Lifting (FL... is strictly FORKLIFT)
  "FL23001": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL23002": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL15001": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL15002": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL-01": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL-02": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL-150-01": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FL-150-02": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FORKLIFT-15T": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "FORKLIFT": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },
  "KOMATSU FD150E - 8": { egy: "FORKLIFT", type: "KOMATSU FD150E - 8" },

  // Water Truck (WT, WR, WATER)
  "WT23001": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23002": { egy: "WATER TRUCK", type: "HINO 500 (FM280JD)" },
  "WT23003": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23004": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23005": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23006": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23007": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23008": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23009": { egy: "WATER TRUCK", type: "HINO 500 (FM260JD)" },
  "WT23102": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },
  "WT-01": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },
  "WT-02": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },
  "WR23001": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },
  "WR23002": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },
  "WATER TRUCK": { egy: "WATER TRUCK", type: "DUTRO 136 HD" },

  // Reach Stacker
  "RS23003": { egy: "REACH STACKER", type: "KONECRANE 45T" },
  "RS-01": { egy: "REACH STACKER", type: "KONECRANE 45T" },
  "KC-45T-01": { egy: "REACH STACKER", type: "KONECRANE 45T" },
  "KC-01": { egy: "REACH STACKER", type: "KONECRANE 45T" },
  "KONECRANE-01": { egy: "REACH STACKER", type: "KONECRANE 45T" },

  // Wheel Loaders & Compactors
  "WL23001": { egy: "WHEEL LOADER", type: "CAT 980 NG" },
  "WL23002": { egy: "WHEEL LOADER", type: "CAT 980 NG" },
  "CAT 980 NG": { egy: "WHEEL LOADER", type: "CAT 980 NG" },
  "CAT 980": { egy: "WHEEL LOADER", type: "CAT 980 NG" },
  "WA-500-01": { egy: "WHEEL LOADER", type: "KOMATSU WA 500" },
  "LOAD-WA500-01": { egy: "WHEEL LOADER", type: "KOMATSU WA 500" },
  "LOAD-WA500-02": { egy: "WHEEL LOADER", type: "KOMATSU WA 500" },
  "CATERPILAR CS 11 GC": { egy: "COMPACTOR", type: "CATERPILAR CS 11 GC" },
  "CS 11 GC": { egy: "COMPACTOR", type: "CATERPILAR CS 11 GC" },
  "COMPACTOR": { egy: "COMPACTOR", type: "CATERPILAR CS 11 GC" },

  // Flat Deck
  "FD23209": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23213": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23214": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23215": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23001": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23002": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23003": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23004": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23005": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23006": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23007": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23008": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23009": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23010": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23011": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23012": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23013": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23014": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23015": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23016": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23017": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23018": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23019": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23020": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23021": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23022": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD23023": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15001": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15002": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15003": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15004": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15008": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15014": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15024": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15032": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD15035": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FD-01": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },
  "FLAT DECK": { egy: "FLAT DECK", type: "HINO 500 (FM260JD)" },

  // Motor Graders
  "GRAD-GD511-01": { egy: "MOTOR GRADER", type: "KOMATSU GD 535" },
  "GD-535-01": { egy: "MOTOR GRADER", type: "KOMATSU GD 535" },
  "GD-535-02": { egy: "MOTOR GRADER", type: "KOMATSU GD 535" },
  "GD-01": { egy: "MOTOR GRADER", type: "KOMATSU GD 535" },

  // Gensets
  "GS-01": { egy: "GENSET", type: "GENSET EX PT MAS" },
  "GENSET-01": { egy: "GENSET", type: "GENSET EX PT MAS" },
  "GENSET-02": { egy: "GENSET", type: "GENSET EX PT MAS" },
  "GENSET EX PT MAS": { egy: "GENSET", type: "GENSET EX PT MAS" },
};

// Legacy compatibility object
export const JULY_BENCHMARK_EGY_MAP: Record<string, string> = Object.entries(JULY_BENCHMARK_MASTER).reduce((acc, [k, v]) => {
  acc[k] = v.egy;
  return acc;
}, {} as Record<string, string>);

// Persistent Registry for dynamic July benchmark equipment extracted from files
export function getJulyBenchmarkRegistry(): Record<string, { egy: string; type?: string }> {
  if (typeof window === "undefined") {
    return Object.entries(JULY_BENCHMARK_MASTER).reduce((acc, [k, v]) => {
      acc[k] = { egy: v.egy, type: v.type };
      return acc;
    }, {} as Record<string, { egy: string; type?: string }>);
  }
  try {
    const raw = localStorage.getItem("wbs_july_benchmark_registry_v2");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const cleaned: Record<string, { egy: string; type?: string }> = {};
        Object.entries(parsed).forEach(([k, v]: [string, any]) => {
          if (!k || k.length < 2 || !isNaN(Number(k)) || k.includes(".") || k === "C" || k === "TOTAL") return;
          const egy = typeof v === "string" ? v : v?.egy;
          const type = typeof v === "object" ? v?.type : "";
          if (egy && egy !== "C" && egy.length > 1) {
            cleaned[k] = { egy, type };
          }
        });
        return { ...JULY_BENCHMARK_MASTER, ...cleaned };
      }
    }
  } catch (_) {}
  return Object.entries(JULY_BENCHMARK_MASTER).reduce((acc, [k, v]) => {
    acc[k] = { egy: v.egy, type: v.type };
    return acc;
  }, {} as Record<string, { egy: string; type?: string }>);
}

export function saveJulyBenchmarkRegistry(newMap: Record<string, string | { egy: string; type?: string }>): void {
  if (typeof window === "undefined") return;
  try {
    const current = getJulyBenchmarkRegistry();
    const normalizedNew: Record<string, { egy: string; type?: string }> = {};
    Object.entries(newMap).forEach(([k, v]) => {
      if (!k || k.length < 2 || !isNaN(Number(k)) || k.includes(".") || k === "C" || k === "TOTAL") return;
      const egyVal = typeof v === "string" ? v : v?.egy;
      if (!egyVal || egyVal === "C" || egyVal.length < 2) return;
      if (typeof v === "string") {
        normalizedNew[k] = { egy: v, type: current[k]?.type || deriveEquipmentType(k, "") };
      } else if (v && typeof v === "object") {
        normalizedNew[k] = { egy: v.egy, type: v.type || deriveEquipmentType(k, "") };
      }
    });
    const merged = { ...current, ...normalizedNew };
    localStorage.setItem("wbs_july_benchmark_registry_v2", JSON.stringify(merged));
  } catch (e) {
    console.warn("Could not persist July benchmark registry to localStorage", e);
  }
}

// Master Helper: Strictly derive the canonical July Egy for ANY equipment number & type from Jan-Jun onwards
export function deriveEgy(idAlat?: string, typeAlat?: string): string {
  const idStr = (idAlat || "").trim().toUpperCase();
  const rawType = (typeAlat || "").trim();
  const typeUpper = rawType.toUpperCase();

  // 1. PRIMARY ASSESSMENT: Match Equipment ID patterns (Nomor Equipment)
  if (idStr) {
    // Flat Deck: e.g. FD23001, FD23002, FD23209, FD-01, FD15035, FD15004, FD15008, FD15014, FD15032, FD15024, FD15003, FD...
    if (idStr.startsWith("FD") || idStr.startsWith("FLAT") || idStr.includes("FLAT DECK") || idStr.includes("FLATDECK")) {
      return "FLAT DECK";
    }
    // Forklift: e.g. FL23001, FL23002, FL15001, FL-01, FL-150-01, FORKLIFT (strictly exclude FLAT)
    if ((idStr.startsWith("FL") && !idStr.startsWith("FLAT")) || idStr.startsWith("FORKLIFT") || idStr.startsWith("FORK") || idStr.includes("FORKLIFT")) {
      return "FORKLIFT";
    }
    // Water Truck: e.g. WR23001, WT23001, WT23002, WT23003, WT23102, WT-01, WATER-01
    if (idStr.startsWith("WR") || idStr.startsWith("WT") || idStr.startsWith("WATER") || idStr.includes("WATER TRUCK") || idStr.includes("WATERTRUCK")) {
      return "WATER TRUCK";
    }
    // Wheel Loader: e.g. WL23001, WL23002, WA-500, LOAD-WA500 (strictly excluding WATER)
    if (idStr.startsWith("WL") || (idStr.startsWith("WA") && !idStr.startsWith("WAT")) || idStr.startsWith("LOAD")) {
      return "WHEEL LOADER";
    }
    // Dump Truck: e.g. DT23001, DT-HD785, HN-260, HN-280, DT-01
    if (idStr.startsWith("DT") || idStr.startsWith("HN-260") || idStr.startsWith("HN-280") || idStr.startsWith("HD")) {
      return "DUMP TRUCK";
    }
    // Excavator: e.g. EX23001, EX23203, PC-210, HY-495, EXC-PC200
    if (idStr.startsWith("EX") || idStr.startsWith("PC") || idStr.startsWith("HY") || idStr.startsWith("EXC")) {
      return "EXCAVATOR";
    }
    // Bulldozer: e.g. DZ23001, BD-01, BULL-D85, DOZER
    if (idStr.startsWith("DZ") || idStr.startsWith("BD") || idStr.startsWith("BULL") || idStr.startsWith("DOZER")) {
      return "BULLDOZER";
    }
    // Crane Truck: e.g. CT23001, CT-01, CRANE
    if (idStr.startsWith("CT") || idStr.startsWith("CRANE")) {
      return "CRANE TRUCK";
    }
    // Fuel Truck: e.g. FT23001, FT-01, FUEL-01
    if (idStr.startsWith("FT") || idStr.startsWith("FUEL")) {
      return "FUEL TRUCK";
    }
    // Reach Stacker: e.g. RS23003, RS-01, KC-45T, KONECRANE
    if (idStr.startsWith("RS") || idStr.startsWith("KC") || idStr.startsWith("KONECRANE")) {
      return "REACH STACKER";
    }
    // Tower Lamp: e.g. TL23002, TL-01, TOWER
    if (idStr.startsWith("TL") || idStr.startsWith("TOWER")) {
      return "TOWER LAMP";
    }
    // Light Vehicle: e.g. LV23207, LV-01, LV-HILUX
    if (idStr.startsWith("LV") || idStr.startsWith("LIGHT")) {
      return "LIGHT VEHICLE";
    }
    // Motor Grader: e.g. GD-535, GRAD-GD511, MG-01, GRADER
    if (idStr.startsWith("GD") || idStr.startsWith("GRAD") || idStr.startsWith("MG") || idStr.startsWith("GRADER")) {
      return "MOTOR GRADER";
    }
    // Compactor: e.g. CP-01, CS-11, CS11GC, VB-01, COMPACTOR, CATERPILAR CS 11 GC
    if (idStr.startsWith("CP") || idStr.startsWith("CS") || idStr.startsWith("VB") || idStr.startsWith("COMP") || idStr.includes("CS 11") || idStr.includes("CS11") || idStr.includes("COMPACTOR") || idStr.includes("VIBRO") || idStr.includes("BOMAG") || idStr.includes("CATERPILAR CS") || idStr.includes("CATERPILLAR CS")) {
      return "COMPACTOR";
    }
    // Genset: e.g. GS-01, GEN-01, GENSET
    if (idStr.startsWith("GS") || idStr.startsWith("GEN") || idStr.includes("GENSET")) {
      return "GENSET";
    }
  }

  // 2. Check dynamic July benchmark registry (from uploaded List & FC or July files)
  const registry = getJulyBenchmarkRegistry();
  if (idStr && registry[idStr] && registry[idStr].egy) {
    return cleanEgyName(registry[idStr].egy);
  }

  // 3. Check static July benchmark map
  if (idStr && JULY_BENCHMARK_MASTER[idStr]) {
    return cleanEgyName(JULY_BENCHMARK_MASTER[idStr].egy);
  }

  // 4. Match type descriptions if ID didn't match
  if (typeUpper.includes("FLAT DECK") || typeUpper.includes("FLATDECK") || typeUpper.startsWith("FLAT") || typeUpper.startsWith("FD")) {
    return "FLAT DECK";
  }
  if (typeUpper.includes("WATER TRUCK") || typeUpper.includes("WATER") || typeUpper.startsWith("WT") || typeUpper.startsWith("WR")) {
    return "WATER TRUCK";
  }
  if (typeUpper.includes("WHEEL LOADER") || typeUpper.includes("980 NG") || typeUpper.includes("CAT 980") || typeUpper.includes("980") || typeUpper.includes("WA 500") || typeUpper.includes("LOADER")) {
    return "WHEEL LOADER";
  }
  if (typeUpper.includes("DUMP TRUCK") || typeUpper.includes("FM260") || typeUpper.includes("FM280") || typeUpper.includes("HD785")) {
    return "DUMP TRUCK";
  }
  if (typeUpper.includes("FORKLIFT") || (typeUpper.startsWith("FL") && !typeUpper.startsWith("FLAT")) || (typeUpper.includes("KOMATSU") && (typeUpper.includes("FD150") || typeUpper.includes("FD 150")))) {
    return "FORKLIFT";
  }
  if (typeUpper.includes("EXCAVATOR") || typeUpper.includes("PC200") || typeUpper.includes("PC 210") || typeUpper.includes("320 GC") || typeUpper.includes("PC 495")) {
    return "EXCAVATOR";
  }
  if (typeUpper.includes("BULLDOZER") || typeUpper.includes("DOZER") || typeUpper.includes("D8T") || typeUpper.includes("D85")) {
    return "BULLDOZER";
  }
  if (typeUpper.includes("CRANE TRUCK") || (typeUpper.includes("CRANE") && !typeUpper.includes("KONECRANE"))) {
    return "CRANE TRUCK";
  }
  if (typeUpper.includes("FUEL TRUCK")) {
    return "FUEL TRUCK";
  }
  if (typeUpper.includes("REACH STACKER") || typeUpper.includes("KONECRANE") || typeUpper.includes("45T")) {
    return "REACH STACKER";
  }
  if (typeUpper.includes("TOWER LAMP")) {
    return "TOWER LAMP";
  }
  if (typeUpper.includes("LIGHT VEHICLE") || typeUpper.includes("INNOVA") || typeUpper.includes("HILUX") || typeUpper.includes("TRITON")) {
    return "LIGHT VEHICLE";
  }
  if (typeUpper.includes("MOTOR GRADER") || typeUpper.includes("GD 535") || typeUpper.includes("GD 511") || typeUpper.includes("GRADER")) {
    return "MOTOR GRADER";
  }
  if (typeUpper.includes("COMPACTOR") || typeUpper.includes("CS 11") || typeUpper.includes("CS11") || typeUpper.includes("VIBRO") || typeUpper.includes("BOMAG")) {
    return "COMPACTOR";
  }
  if (typeUpper.includes("GENSET") || typeUpper.includes("GENSET EX PT MAS")) {
    return "GENSET";
  }
  if (typeUpper.includes("DUTRO")) {
    return "FUEL TRUCK";
  }

  // 5. Fallback
  return rawType ? cleanEgyName(rawType) : "DUMP TRUCK";
}

// Master Helper: Strictly derive the canonical July Type for ANY equipment number & type from Jan-Jun onwards
export function deriveEquipmentType(idAlat?: string, typeAlat?: string): string {
  const idStr = (idAlat || "").trim().toUpperCase();
  const rawType = (typeAlat || "").trim();

  // 1. Check registry
  const registry = getJulyBenchmarkRegistry();
  if (idStr && registry[idStr] && registry[idStr].type) {
    return registry[idStr].type!;
  }

  // 2. Check static July benchmark map
  if (idStr && JULY_BENCHMARK_MASTER[idStr]) {
    return JULY_BENCHMARK_MASTER[idStr].type;
  }

  // 3. Fallbacks based on pattern
  if (idStr.startsWith("DT23005") || idStr.startsWith("DT23006") || idStr.startsWith("DT23007") || idStr.startsWith("DT23008") || idStr.startsWith("DT23009") || idStr.startsWith("CT")) {
    return "HINO 500 (FM280JD)";
  }
  if (idStr.startsWith("DT") || idStr.startsWith("FD") || idStr.startsWith("FLAT")) {
    return "HINO 500 (FM260JD)";
  }
  if (idStr.startsWith("WL") || (idStr.startsWith("WA") && !idStr.startsWith("WAT"))) {
    return "CAT 980 NG";
  }
  if (idStr === "EX23203") {
    return "CAT 320 GC";
  }
  if (idStr.startsWith("EX") || idStr.startsWith("PC")) {
    return "KOMATSU PC 210";
  }
  if (idStr.startsWith("DZ") || idStr.startsWith("BD")) {
    return "CATERPILAR D8T";
  }
  if (idStr.startsWith("TL")) {
    return "TOWER LAMP";
  }
  if (idStr.startsWith("LV")) {
    return "TOYOTA INNOVA";
  }
  if (idStr.startsWith("RS") || idStr.startsWith("KC")) {
    return "KONECRANE 45T";
  }
  if ((idStr.startsWith("FL") && !idStr.startsWith("FLAT")) || idStr.startsWith("FORKLIFT") || idStr.startsWith("FORK")) {
    return "KOMATSU FD150E - 8";
  }
  if (idStr.startsWith("FT")) {
    return rawType || "DUTRO 136 HD";
  }
  if (idStr.startsWith("WT") || idStr.startsWith("WR") || idStr.startsWith("WATER")) {
    return rawType || "DUTRO 136 HD";
  }
  if (idStr.startsWith("GD") || idStr.startsWith("GRAD")) {
    return "KOMATSU GD 535";
  }
  if (idStr.startsWith("LOAD") || (idStr.startsWith("WA") && !idStr.startsWith("WAT"))) {
    return "KOMATSU WA 500";
  }
  if (idStr.startsWith("GS") || idStr.includes("GENSET")) {
    return "GENSET EX PT MAS";
  }

  return rawType || "HINO 500 (FM260JD)";
}

// Dynamic helper to compute values for a raw row
export function processRecord(raw: Omit<FuelRecord, 'selisihHm' | 'fuelBurnRate' | 'isAnomaly' | 'anomalyMessage' | 'egy'> & { egy?: string }): FuelRecord {
  const egy = raw.egy && raw.egy.trim() ? cleanEgyName(raw.egy) : deriveEgy(raw.idAlat, raw.typeAlat);
  const selisihHm = Number((raw.hmSaatIni - raw.hmSebelum).toFixed(2));
  let fuelBurnRate = 0;
  let isAnomaly = false;
  let anomalyMessage = "";

  const cleanId = (raw.idAlat || "").toUpperCase();
  if (raw.hmSebelum < 0 || raw.hmSaatIni < 0) {
    isAnomaly = true;
    anomalyMessage = "Nilai HM tidak boleh negatif";
  } else if (cleanId === "FD23252" || selisihHm === 0 || isNaN(selisihHm) || (raw.hmSebelum === 0 && raw.hmSaatIni > 100) || selisihHm > 744) {
    isAnomaly = true;
    anomalyMessage = "Unit Rental (HM Running Kosong / Dump Odometer Fisik)";
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
    egy,
    selisihHm,
    fuelBurnRate,
    isAnomaly,
    anomalyMessage
  };
}

// Initial high-quality dataset matching real-life log
const RAW_SAMPLE_DATA: (Omit<FuelRecord, 'selisihHm' | 'fuelBurnRate' | 'isAnomaly' | 'anomalyMessage' | 'egy'> & { egy?: string })[] = [
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
    storage: "Storage Utama Central",
    idAlat: "FD23001",
    typeAlat: "HINO 500 (FM260JD)",
    hmSebelum: 1420.0,
    hmSaatIni: 1432.0, // 12 hrs
    volumeFuel: 84, // 7.0 L/h
    operator: "Bambang Sugiono",
    fuelman: "Eko Prasetyo",
    shift: "Shift 1 - Siang",
    jam: "10:30"
  },
  {
    id: "rec-020",
    tanggal: "2026-05-08",
    storage: "Storage Utama Central",
    idAlat: "FD23209",
    typeAlat: "HINO 500 (FM260JD)",
    hmSebelum: 890.0,
    hmSaatIni: 900.0, // 10 hrs
    volumeFuel: 70, // 7.0 L/h
    operator: "Doni Pratama",
    fuelman: "Andi Susanto",
    shift: "Shift 2 - Malam",
    jam: "21:00"
  },
  {
    id: "rec-021",
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
