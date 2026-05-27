import { FuelRecord, UnitSummary, Anomaly, AnalyticsResult } from '../types';

export function computeAnalytics(records: FuelRecord[]): AnalyticsResult {
  if (records.length === 0) {
    return {
      totalFuel: 0, totalHM: 0, avgFuelRatio: 0, maxFuelRatio: 0,
      unitCount: 0, recordCount: 0, unitSummaries: [], anomalies: [],
      topConsumer: null, paretoThreshold: 0, dateRange: null,
    };
  }

  const totalFuel = records.reduce((s, r) => s + r.volumeBBM, 0);
  const totalHM = records.reduce((s, r) => s + r.hmOperasi, 0);
  const validRatios = records.filter(r => r.fuelRatio > 0).map(r => r.fuelRatio);
  const avgFuelRatio = totalHM > 0 ? totalFuel / totalHM : 0;
  const maxFuelRatio = validRatios.length > 0 ? Math.max(...validRatios) : 0;

  // Group by unit
  const unitMap = new Map<string, { fuel: number; hm: number; count: number; jenis: string }>();
  for (const r of records) {
    const existing = unitMap.get(r.namaUnit);
    if (existing) {
      existing.fuel += r.volumeBBM;
      existing.hm += r.hmOperasi;
      existing.count += 1;
    } else {
      unitMap.set(r.namaUnit, { fuel: r.volumeBBM, hm: r.hmOperasi, count: 1, jenis: r.jenisUnit });
    }
  }

  // Build sorted summaries (desc by total fuel)
  const sorted = Array.from(unitMap.entries())
    .map(([namaUnit, d]) => ({
      namaUnit,
      jenisUnit: d.jenis,
      totalFuel: d.fuel,
      totalHM: d.hm,
      avgFuelRatio: d.hm > 0 ? d.fuel / d.hm : 0,
      recordCount: d.count,
      percentage: totalFuel > 0 ? (d.fuel / totalFuel) * 100 : 0,
      cumulative: 0,
      isInPareto80: false,
    }))
    .sort((a, b) => b.totalFuel - a.totalFuel);

  let cumulative = 0;
  let paretoThreshold = sorted.length - 1;
  for (let i = 0; i < sorted.length; i++) {
    cumulative += sorted[i].percentage;
    sorted[i].cumulative = cumulative;
    if (cumulative >= 80 && paretoThreshold === sorted.length - 1) {
      paretoThreshold = i;
    }
  }
  for (let i = 0; i <= paretoThreshold; i++) {
    sorted[i].isInPareto80 = true;
  }

  const anomalies = detectAnomalies(records, validRatios);

  const dates = records.map(r => r.tanggal).filter(Boolean).sort();
  const dateRange = dates.length > 0 ? { start: dates[0], end: dates[dates.length - 1] } : null;

  return {
    totalFuel,
    totalHM,
    avgFuelRatio,
    maxFuelRatio,
    unitCount: unitMap.size,
    recordCount: records.length,
    unitSummaries: sorted,
    anomalies,
    topConsumer: sorted[0] ?? null,
    paretoThreshold,
    dateRange,
  };
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function detectAnomalies(records: FuelRecord[], ratios: number[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  if (ratios.length < 3) return anomalies;

  const meanRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const sdRatio = stdDev(ratios);

  const volumes = records.map(r => r.volumeBBM).filter(v => v > 0);
  const meanVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const sdVol = stdDev(volumes);

  for (const r of records) {
    if (r.hmOperasi < 0 || (r.hmAwal > 0 && r.hmAkhir > 0 && r.hmAkhir < r.hmAwal)) {
      anomalies.push({
        record: r,
        type: 'invalid_hm',
        severity: 'critical',
        message: `HM tidak valid: HM Akhir (${r.hmAkhir}) < HM Awal (${r.hmAwal})`,
        zScore: 0,
      });
      continue;
    }

    if (r.fuelRatio > 0 && sdRatio > 0) {
      const z = (r.fuelRatio - meanRatio) / sdRatio;
      if (z > 2.0) {
        anomalies.push({
          record: r,
          type: 'high_fuel_ratio',
          severity: z > 3.0 ? 'critical' : 'warning',
          message: `Fuel Ratio tinggi: ${r.fuelRatio.toFixed(2)} L/HM (rata-rata: ${meanRatio.toFixed(2)})`,
          zScore: z,
        });
      }
    }

    if (r.volumeBBM > 0 && sdVol > 0) {
      const z = (r.volumeBBM - meanVol) / sdVol;
      if (z > 2.5) {
        const alreadyFlagged = anomalies.some(a => a.record.id === r.id);
        if (!alreadyFlagged) {
          anomalies.push({
            record: r,
            type: 'high_volume',
            severity: z > 3.5 ? 'critical' : 'warning',
            message: `Volume BBM tinggi: ${r.volumeBBM.toFixed(0)} L (rata-rata: ${meanVol.toFixed(0)} L)`,
            zScore: z,
          });
        }
      }
    }
  }

  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('id-ID', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
