export interface FuelRecord {
  id: string; // Unique ID for key mapping
  tanggal: string; // Kolom G: Tanggal (YYYY-MM-DD)
  storage: string; // Kolom H: Tempat/Storage
  idAlat: string; // Kolom I: Nomor unit alat berat
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
  typeAlat: string;
  totalVolume: string | number;
  averageFuelBurn: number;
  runningHours: number;
  recordCount: number;
  cumulativePercent: number;
  isAnomaly: boolean;
}

export interface MonthlyTypeSummary {
  typeAlat: string;
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
  plans?: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>;
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
  plans: Record<string, { idAlat: string; typeAlat: string; planFuelBurn: number }>;
  batchesCount: number;
}

