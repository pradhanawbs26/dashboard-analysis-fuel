export interface FuelRecord {
  id: string; // Unique ID for key mapping
  tanggal: string; // Kolom G: Tanggal (YYYY-MM-DD)
  storage: string; // Kolom H: Tempat/Storage
  idAlat: string; // Kolom I: Nomor unit alat berat
  egy: string; // Kolom C / Parameter Utama: Egy Alat
  typeAlat: string; // Kolom J: Type alat berat
  hmSebelum: number; // Kolom K: HM Sebelumnya
  hmSaatIni: number; // Kolom L: HM Saat Ini
  volumeFuel: number; // Kolom N: Volume Fuel (Liter)
  operator: string; // Kolom R: Nama Operator
  fuelman: string; // Kolom U: Nama Fuelman
  shift: string; // Kolom V: Shift
  jam: string; // Kolom W: Jam pengisian
  
  // Calculated fields
  selisihHm: number; // K - L (Hours Run)
  fuelBurnRate: number; // Fuel Burn (L/Jam)
  isAnomaly: boolean; // Flag if K >= L or other issues
  anomalyMessage?: string;
}

export interface MetricSummary {
  dailyAverage: number;
  mtdAverage: number;
  ytdAverage: number;
  totalVolume: number;
  totalHours: number;
  recordCount: number;
}

export interface ParetoUnitItem {
  idAlat: string;
  egy: string;
  typeAlat: string;
  totalVolume: string | number;
  averageFuelBurn: number;
  runningHours: number;
  recordCount: number;
  cumulativePercent: number;
  isAnomaly: boolean;
}

export interface MonthlyTypeSummary {
  egy?: string;
  typeAlat: string;
  totalVolume: number;
  totalHours: number;
  recordCount: number;
  burnRate: number;
}

export interface MonthlyUnitSummary {
  idAlat: string;
  egy?: string;
  typeAlat?: string;
  totalVolume: number;
  totalHours: number;
  recordCount: number;
  burnRate: number;
}

export interface MonthlyReportData {
  id: string; // e.g. "2026_06" or "2026_Juni" or "Juni"
  bulan: string; // e.g. "Juni"
  monthIndex: number; // 0 for Jan, 5 for Juni, etc.
  year: number; // e.g. 2026
  fileName: string;
  uploadedAt: string;
  totalVolume: number;
  totalHours: number;
  recordCount: number;
  avgBurnRate: number;
  typeSummaries: MonthlyTypeSummary[];
  unitSummaries?: MonthlyUnitSummary[];
  plans?: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
  records?: FuelRecord[];
}

export interface ActiveDatasetData {
  id: string; // e.g. "current"
  fileName: string;
  startDate: string;
  endDate: string;
  recordCount: number;
  totalVolume: number;
  totalHours: number;
  uploadedAt: string;
  uploadedBy?: string;
  plans: Record<string, { idAlat: string; egy?: string; typeAlat: string; planFuelBurn: number }>;
  batchesCount: number;
}

export interface EgyPlanItem {
  egy: string;
  planFuelBurn: number; // L/Jam
  category?: string;
  notes?: string;
  updatedAt?: string;
}

export type EgyPlanMap = Record<string, number>;

export interface UnitPlanConfig {
  idAlat: string;
  egy: string;
  typeAlat?: string;
  planFuelBurn?: number; // Custom unit override if defined, else uses Egy plan
  notes?: string;
  updatedAt?: string;
}

export type UnitRegistryMap = Record<string, UnitPlanConfig>;

export interface EgyUnitAssessmentDetail {
  idAlat: string;
  typeAlat: string;
  actual: number;
  plan: number;
  deviation: number;
  deviationPct: number;
  isOver: boolean;
  totalHours: number;
  totalVolume: number;
  recordCount: number;
}

export interface EgyAssessmentItem {
  egy: string;
  unitCount: number;
  recordCount: number;
  totalVolume: number;
  totalHours: number;
  actualBurnRate: number;
  planBurnRate: number;
  deviation: number; // actual - plan (positive = over plan / wasteful)
  deviationPct: number;
  isOver: boolean;
  status: "EFISIEN" | "ON_TRACK" | "OVER_PLAN" | "KRITIS";
  grade: "A+" | "A" | "B" | "C" | "D";
  fuelImpactLiters: number; // (actual - plan) * totalHours (>0 = excess fuel used, <0 = fuel saved)
  units: EgyUnitAssessmentDetail[];
}

export interface OverallAssessmentSummary {
  totalEgys: number;
  efficientEgys: number;
  overPlanEgys: number;
  totalVolume: number;
  totalHours: number;
  overallActualRate: number;
  overallWeightedPlan: number;
  overallDeviation: number;
  totalOverLiters: number;
  totalSavedLiters: number;
  overallEfficiencyPct: number;
  overallGrade: "A+" | "A" | "B" | "C" | "D";
}

