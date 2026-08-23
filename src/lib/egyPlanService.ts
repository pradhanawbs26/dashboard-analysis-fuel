import { doc, getDoc, setDoc, onSnapshot, Unsubscribe } from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "./firebase";
import { cleanEgyName, deriveEgy, JULY_BENCHMARK_MASTER } from "../data/sampleData";
export { cleanEgyName, deriveEgy };
import { 
  EgyPlanMap, 
  UnitRegistryMap,
  UnitPlanConfig,
  FuelRecord, 
  EgyAssessmentItem, 
  OverallAssessmentSummary,
  EgyUnitAssessmentDetail 
} from "../types";

/**
 * Standard default Plan Fuel Burn targets per Egy (Equipment Grouping)
 * Based on PT. WBS Standard Operational Benchmarks & July Calibration
 */
export const DEFAULT_EGY_PLANS: EgyPlanMap = {
  "DUMP TRUCK": 7.5,
  "EXCAVATOR": 14.5,
  "BULLDOZER": 28.0,
  "FLAT DECK": 6.5,
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
  "SUPPORT": 5.0
};

export const EGY_CATEGORIES_INFO: Record<string, { desc: string; standardFleet: string }> = {
  "DUMP TRUCK": { desc: "Armada Hauling & Angkut Material", standardFleet: "Hino 500 FM260JD / FM280JD" },
  "EXCAVATOR": { desc: "Alat Gali & Muat (Digging & Loading)", standardFleet: "Komatsu PC 210, CAT 320 GC, Hyundai PC 495" },
  "BULLDOZER": { desc: "Alat Dorong & Dozing Material", standardFleet: "Komatsu D85SS, CAT D8T" },
  "FLAT DECK": { desc: "Truk Angkutan Logistik & Kargo Datar", standardFleet: "Hino 500 FM260JD Flat Deck" },
  "CRANE TRUCK": { desc: "Truk Derek & Pengangkat Beban Mobile", standardFleet: "Hino 500 FM280JD Crane" },
  "FUEL TRUCK": { desc: "Truk Distribusi & Pengisian Bahan Bakar", standardFleet: "Dutro 136 HD Fuel Tank" },
  "FORKLIFT": { desc: "Alat Angkat Material Gudang & Workshop", standardFleet: "Komatsu FD150E - 8" },
  "WATER TRUCK": { desc: "Truk Penyiraman Jalan Tambang (Dust Suppression)", standardFleet: "Dutro 136 HD Water Tank" },
  "REACH STACKER": { desc: "Alat Pemindah & Penumpuk Kontainer", standardFleet: "Konecrane 45T" },
  "TOWER LAMP": { desc: "Lampu Penerangan Lapangan Malam Hari", standardFleet: "Tower Lamp 4-Lamp LED" },
  "LIGHT VEHICLE": { desc: "Kendaraan Operasional & Supervisi", standardFleet: "Toyota Innova, Hilux 4x4" },
  "MOTOR GRADER": { desc: "Alat Perata & Perawatan Jalan Tambang", standardFleet: "Komatsu GD 535" },
  "WHEEL LOADER": { desc: "Alat Muat Roda Karet (Rehandling)", standardFleet: "Komatsu WA 500, CAT 980 NG" },
  "COMPACTOR": { desc: "Alat Pemadat Tanah & Lapisan Jalan", standardFleet: "Caterpillar CS 11 GC" },
  "GENSET": { desc: "Generator Pembangkit Listrik Utama / Darurat", standardFleet: "Genset Ex PT MAS" },
  "SUPPORT": { desc: "Peralatan Penunjang Operasional Tambang", standardFleet: "Equipment Pendukung Lainnya" }
};

const LOCAL_STORAGE_EGY_PLANS_KEY = "wbs_fuel_burn_egy_plans_v1";
const LOCAL_STORAGE_UNIT_REGISTRY_KEY = "wbs_fuel_burn_unit_registry_v1";
const FIRESTORE_PLAN_SETTINGS_COLLECTION = "plan_settings";
const FIRESTORE_EGY_PLANS_DOC_ID = "egy_plans";
const FIRESTORE_UNIT_REGISTRY_DOC_ID = "unit_registry";

/**
 * Generate default unit registry populated from canonical benchmark master
 */
export function getDefaultUnitRegistry(): UnitRegistryMap {
  const registry: UnitRegistryMap = {};
  
  // Populate from canonical July benchmark master
  Object.entries(JULY_BENCHMARK_MASTER).forEach(([id, meta]) => {
    const cleanId = id.trim().toUpperCase();
    registry[cleanId] = {
      idAlat: cleanId,
      egy: meta.egy,
      typeAlat: meta.type || meta.egy
    };
  });

  return registry;
}

/**
 * Read Unit Registry from Local Storage
 */
export function getStoredUnitRegistry(): UnitRegistryMap {
  if (typeof window === "undefined") {
    return getDefaultUnitRegistry();
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_UNIT_REGISTRY_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return parsed as UnitRegistryMap;
      }
    }
  } catch (err) {
    console.warn("Error reading stored Unit Registry:", err);
  }
  const defaults = getDefaultUnitRegistry();
  saveStoredUnitRegistry(defaults);
  return defaults;
}

/**
 * Save Unit Registry to Local Storage
 */
export function saveStoredUnitRegistry(registry: UnitRegistryMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_UNIT_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn("Error saving stored Unit Registry to localStorage:", err);
  }
}

/**
 * Save Unit Registry to Cloud Firestore
 */
export async function saveUnitRegistryToFirestore(registry: UnitRegistryMap): Promise<void> {
  const docRef = doc(db, FIRESTORE_PLAN_SETTINGS_COLLECTION, FIRESTORE_UNIT_REGISTRY_DOC_ID);
  const payload = {
    id: FIRESTORE_UNIT_REGISTRY_DOC_ID,
    updatedAt: new Date().toISOString(),
    units: registry
  };
  try {
    await setDoc(docRef, payload);
    saveStoredUnitRegistry(registry);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FIRESTORE_PLAN_SETTINGS_COLLECTION}/${FIRESTORE_UNIT_REGISTRY_DOC_ID}`);
  }
}

/**
 * Subscribe to Real-time updates of Unit Registry from Cloud Firestore
 */
export function subscribeToUnitRegistry(
  onData: (registry: UnitRegistryMap) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const docRef = doc(db, FIRESTORE_PLAN_SETTINGS_COLLECTION, FIRESTORE_UNIT_REGISTRY_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.units && typeof data.units === "object") {
          saveStoredUnitRegistry(data.units);
          onData(data.units);
          return;
        }
      }
      onData(getStoredUnitRegistry());
    },
    (error) => {
      console.warn("subscribeToUnitRegistry onSnapshot notice:", error);
      if (onError) onError(error);
      onData(getStoredUnitRegistry());
    }
  );
}

/**
 * Read Egy Plans from Local Storage with standard default fallback
 */
export function getStoredEgyPlans(): EgyPlanMap {
  if (typeof window === "undefined") {
    return { ...DEFAULT_EGY_PLANS };
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_EGY_PLANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        return { ...DEFAULT_EGY_PLANS, ...parsed };
      }
    }
  } catch (err) {
    console.warn("Error reading stored Egy plans:", err);
  }
  return { ...DEFAULT_EGY_PLANS };
}

/**
 * Save Egy Plans to Local Storage
 */
export function saveStoredEgyPlans(plans: EgyPlanMap): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_EGY_PLANS_KEY, JSON.stringify(plans));
  } catch (err) {
    console.warn("Error saving stored Egy plans to localStorage:", err);
  }
}

/**
 * Save Egy Plans to Cloud Firestore for cross-session/cross-device persistence
 */
export async function saveEgyPlansToFirestore(plans: EgyPlanMap): Promise<void> {
  const docRef = doc(db, FIRESTORE_PLAN_SETTINGS_COLLECTION, FIRESTORE_EGY_PLANS_DOC_ID);
  const payload = {
    id: FIRESTORE_EGY_PLANS_DOC_ID,
    updatedAt: new Date().toISOString(),
    plans
  };
  try {
    await setDoc(docRef, payload);
    saveStoredEgyPlans(plans);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${FIRESTORE_PLAN_SETTINGS_COLLECTION}/${FIRESTORE_EGY_PLANS_DOC_ID}`);
  }
}

/**
 * Fetch Egy Plans from Cloud Firestore
 */
export async function fetchEgyPlansFromFirestore(): Promise<EgyPlanMap | null> {
  try {
    const docRef = doc(db, FIRESTORE_PLAN_SETTINGS_COLLECTION, FIRESTORE_EGY_PLANS_DOC_ID);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.plans && typeof data.plans === "object") {
        const merged = { ...DEFAULT_EGY_PLANS, ...data.plans };
        saveStoredEgyPlans(merged);
        return merged;
      }
    }
  } catch (error) {
    console.warn("fetchEgyPlansFromFirestore warning:", error);
  }
  return null;
}

/**
 * Subscribe to Real-time updates of Egy Plans from Cloud Firestore
 */
export function subscribeToEgyPlans(
  onData: (plans: EgyPlanMap) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const docRef = doc(db, FIRESTORE_PLAN_SETTINGS_COLLECTION, FIRESTORE_EGY_PLANS_DOC_ID);
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data && data.plans && typeof data.plans === "object") {
          const merged = { ...DEFAULT_EGY_PLANS, ...data.plans };
          saveStoredEgyPlans(merged);
          onData(merged);
          return;
        }
      }
      onData(getStoredEgyPlans());
    },
    (error) => {
      console.warn("subscribeToEgyPlans onSnapshot notice:", error);
      if (onError) onError(error);
      onData(getStoredEgyPlans());
    }
  );
}

/**
 * Resolve the Target Plan Fuel Burn rate for any unit or equipment:
 * 1. User-configured Egy Plan from "INPUT PLAN FUEL BURN" (authoritative)
 * 2. Unit-level specific plan override (from registry or sheet if explicitly set)
 * 3. Standard default fallback
 */
export function resolvePlanForUnit(
  idAlat: string,
  egy?: string,
  typeAlat?: string,
  unitPlans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>,
  egyPlans?: EgyPlanMap
): { planFuelBurn: number; source: "UNIT_SHEET" | "EGY_PLAN" | "DEFAULT" } {
  const cleanId = (idAlat || "").trim().toUpperCase();
  const canonicalEgy = cleanEgyName(egy || deriveEgy(idAlat, typeAlat)).toUpperCase();
  const activeEgyPlans = egyPlans || getStoredEgyPlans();

  // 1. Authoritative: check user-configured plan from "INPUT PLAN FUEL BURN"
  if (canonicalEgy && activeEgyPlans[canonicalEgy] !== undefined && activeEgyPlans[canonicalEgy] > 0) {
    return { planFuelBurn: activeEgyPlans[canonicalEgy], source: "EGY_PLAN" };
  }

  // 2. Unit-level specific plan override if explicitly present
  if (unitPlans && unitPlans[cleanId] && unitPlans[cleanId].planFuelBurn > 0) {
    return { planFuelBurn: unitPlans[cleanId].planFuelBurn, source: "UNIT_SHEET" };
  }

  // 3. Fallback in DEFAULT_EGY_PLANS
  if (canonicalEgy && DEFAULT_EGY_PLANS[canonicalEgy] !== undefined) {
    return { planFuelBurn: DEFAULT_EGY_PLANS[canonicalEgy], source: "DEFAULT" };
  }

  return { planFuelBurn: 10.0, source: "DEFAULT" };
}

/**
 * Comprehensive Evaluation: Plan vs Actual Fuel Burn calculation by Egy and Overall Fleet
 * Strictly excludes rental units (where running hours HM <= 0 or isAnomaly)
 */
export function evaluateEgyPlanVsActual(
  records: FuelRecord[],
  egyPlans: EgyPlanMap,
  unitPlans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>
): {
  egyAssessments: EgyAssessmentItem[];
  overallSummary: OverallAssessmentSummary;
} {
  // Filter out rental units (running hours 0 or empty) and anomalies
  const validRecords = records.filter(r => !r.isAnomaly && r.selisihHm > 0);

  // Group by Egy and Unit
  const egyMap: Record<string, {
    egy: string;
    totalVolume: number;
    totalHours: number;
    recordCount: number;
    units: Record<string, {
      idAlat: string;
      typeAlat: string;
      totalVolume: number;
      totalHours: number;
      recordCount: number;
    }>;
  }> = {};

  validRecords.forEach(r => {
    const rawEgy = r.egy || deriveEgy(r.idAlat, r.typeAlat);
    const egy = cleanEgyName(rawEgy).toUpperCase() || "SUPPORT";
    const id = r.idAlat ? r.idAlat.trim().toUpperCase() : "UNKNOWN";

    if (!egyMap[egy]) {
      egyMap[egy] = {
        egy,
        totalVolume: 0,
        totalHours: 0,
        recordCount: 0,
        units: {}
      };
    }

    egyMap[egy].totalVolume += r.volumeFuel;
    egyMap[egy].totalHours += r.selisihHm;
    egyMap[egy].recordCount += 1;

    if (!egyMap[egy].units[id]) {
      egyMap[egy].units[id] = {
        idAlat: id,
        typeAlat: r.typeAlat || egy,
        totalVolume: 0,
        totalHours: 0,
        recordCount: 0
      };
    }
    egyMap[egy].units[id].totalVolume += r.volumeFuel;
    egyMap[egy].units[id].totalHours += r.selisihHm;
    egyMap[egy].units[id].recordCount += 1;
  });

  // Ensure all Egy types defined in egyPlans are present in assessment (even if no transactions yet)
  Object.keys(egyPlans).forEach(egyKey => {
    const egy = cleanEgyName(egyKey).toUpperCase();
    if (!egyMap[egy]) {
      egyMap[egy] = {
        egy,
        totalVolume: 0,
        totalHours: 0,
        recordCount: 0,
        units: {}
      };
    }
  });

  const egyAssessments: EgyAssessmentItem[] = Object.values(egyMap).map(group => {
    const planRate = egyPlans[group.egy] !== undefined ? egyPlans[group.egy] : (DEFAULT_EGY_PLANS[group.egy] || 10.0);
    const actualRate = group.totalHours > 0 ? Number((group.totalVolume / group.totalHours).toFixed(2)) : 0;
    
    // Deviation = actual - plan (positive = over plan / wasteful, negative = under plan / efficient)
    const deviation = actualRate > 0 ? Number((actualRate - planRate).toFixed(2)) : 0;
    const deviationPct = planRate > 0 && actualRate > 0 ? Number(((deviation / planRate) * 100).toFixed(1)) : 0;
    const isOver = deviation > 0.05; // toleransi 0.05 L/J

    // Fuel Impact = (actual - plan) * totalHours in Liters
    const fuelImpactLiters = actualRate > 0 ? Number(((actualRate - planRate) * group.totalHours).toFixed(1)) : 0;

    // Status and Grade Determination
    let status: "EFISIEN" | "ON_TRACK" | "OVER_PLAN" | "KRITIS" = "ON_TRACK";
    let grade: "A+" | "A" | "B" | "C" | "D" = "B";

    if (group.totalHours === 0) {
      status = "ON_TRACK";
      grade = "B";
    } else if (deviation <= -1.0) {
      status = "EFISIEN";
      grade = "A+";
    } else if (deviation <= 0.05) {
      status = "EFISIEN";
      grade = "A";
    } else if (deviation <= 1.5 || deviationPct <= 15) {
      status = "OVER_PLAN";
      grade = "C";
    } else {
      status = "KRITIS";
      grade = "D";
    }

    // Process unit breakdown inside this Egy
    const unitsList: EgyUnitAssessmentDetail[] = Object.values(group.units).map(u => {
      const uActual = u.totalHours > 0 ? Number((u.totalVolume / u.totalHours).toFixed(2)) : 0;
      const resolved = resolvePlanForUnit(u.idAlat, group.egy, u.typeAlat, unitPlans, egyPlans);
      const uPlan = resolved.planFuelBurn;
      const uDev = uActual > 0 ? Number((uActual - uPlan).toFixed(2)) : 0;
      const uDevPct = uPlan > 0 && uActual > 0 ? Number(((uDev / uPlan) * 100).toFixed(1)) : 0;
      
      return {
        idAlat: u.idAlat,
        typeAlat: u.typeAlat,
        actual: uActual,
        plan: uPlan,
        deviation: uDev,
        deviationPct: uDevPct,
        isOver: uDev > 0.05,
        totalHours: Number(u.totalHours.toFixed(1)),
        totalVolume: Number(u.totalVolume.toFixed(1)),
        recordCount: u.recordCount
      };
    }).sort((a, b) => b.deviation - a.deviation);

    return {
      egy: group.egy,
      unitCount: Object.keys(group.units).length,
      recordCount: group.recordCount,
      totalVolume: Number(group.totalVolume.toFixed(1)),
      totalHours: Number(group.totalHours.toFixed(1)),
      actualBurnRate: actualRate,
      planBurnRate: planRate,
      deviation,
      deviationPct,
      isOver,
      status,
      grade,
      fuelImpactLiters,
      units: unitsList
    };
  });

  // Sort assessments: Active ones with highest over-plan first, then efficient, then inactive
  egyAssessments.sort((a, b) => {
    if (a.totalHours === 0 && b.totalHours === 0) return a.egy.localeCompare(b.egy);
    if (a.totalHours === 0) return 1;
    if (b.totalHours === 0) return -1;
    return b.deviation - a.deviation;
  });

  // Overall Summary Metrics
  const activeEgys = egyAssessments.filter(e => e.totalHours > 0);
  const totalVolume = activeEgys.reduce((sum, e) => sum + e.totalVolume, 0);
  const totalHours = activeEgys.reduce((sum, e) => sum + e.totalHours, 0);
  const overallActualRate = totalHours > 0 ? Number((totalVolume / totalHours).toFixed(2)) : 0;

  // Weighted plan rate based on hours worked per Egy
  const totalWeightedPlanHours = activeEgys.reduce((sum, e) => sum + (e.planBurnRate * e.totalHours), 0);
  const overallWeightedPlan = totalHours > 0 ? Number((totalWeightedPlanHours / totalHours).toFixed(2)) : 0;
  const overallDeviation = Number((overallActualRate - overallWeightedPlan).toFixed(2));

  const totalOverLiters = activeEgys.filter(e => e.fuelImpactLiters > 0).reduce((sum, e) => sum + e.fuelImpactLiters, 0);
  const totalSavedLiters = Math.abs(activeEgys.filter(e => e.fuelImpactLiters < 0).reduce((sum, e) => sum + e.fuelImpactLiters, 0));

  const efficientEgys = activeEgys.filter(e => !e.isOver).length;
  const overPlanEgys = activeEgys.filter(e => e.isOver).length;

  const overallEfficiencyPct = overallWeightedPlan > 0 
    ? Number(((overallWeightedPlan / Math.max(overallActualRate, 0.01)) * 100).toFixed(1))
    : 100;

  let overallGrade: "A+" | "A" | "B" | "C" | "D" = "B";
  if (overallDeviation <= -0.5) overallGrade = "A+";
  else if (overallDeviation <= 0.05) overallGrade = "A";
  else if (overallDeviation <= 1.0) overallGrade = "B";
  else if (overallDeviation <= 2.5) overallGrade = "C";
  else overallGrade = "D";

  const overallSummary: OverallAssessmentSummary = {
    totalEgys: activeEgys.length,
    efficientEgys,
    overPlanEgys,
    totalVolume: Number(totalVolume.toFixed(1)),
    totalHours: Number(totalHours.toFixed(1)),
    overallActualRate,
    overallWeightedPlan,
    overallDeviation,
    totalOverLiters: Number(totalOverLiters.toFixed(1)),
    totalSavedLiters: Number(totalSavedLiters.toFixed(1)),
    overallEfficiencyPct,
    overallGrade
  };

  return {
    egyAssessments,
    overallSummary
  };
}
