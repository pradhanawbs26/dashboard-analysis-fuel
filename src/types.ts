export interface FuelRecord {
  id: number;
  tanggal: string;
  namaUnit: string;
  jenisUnit: string;
  area: string;
  operator: string;
  hmAwal: number;
  hmAkhir: number;
  hmOperasi: number;
  volumeBBM: number;
  fuelRatio: number;
}

export interface UnitSummary {
  namaUnit: string;
  jenisUnit: string;
  totalFuel: number;
  totalHM: number;
  avgFuelRatio: number;
  recordCount: number;
  percentage: number;
  cumulative: number;
  isInPareto80: boolean;
}

export type AnomalyType = 'high_fuel_ratio' | 'high_volume' | 'invalid_hm';
export type SeverityLevel = 'warning' | 'critical';

export interface Anomaly {
  record: FuelRecord;
  type: AnomalyType;
  severity: SeverityLevel;
  message: string;
  zScore: number;
}

export interface AnalyticsResult {
  totalFuel: number;
  totalHM: number;
  avgFuelRatio: number;
  maxFuelRatio: number;
  unitCount: number;
  recordCount: number;
  unitSummaries: UnitSummary[];
  anomalies: Anomaly[];
  topConsumer: UnitSummary | null;
  paretoThreshold: number;
  dateRange: { start: string; end: string } | null;
}

export interface ColumnMapping {
  tanggal?: number;
  namaUnit?: number;
  jenisUnit?: number;
  area?: number;
  operator?: number;
  hmAwal?: number;
  hmAkhir?: number;
  hmOperasi?: number;
  volumeBBM?: number;
  fuelRatio?: number;
}
