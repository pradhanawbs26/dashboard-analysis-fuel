import * as XLSX from 'xlsx';
import { FuelRecord, ColumnMapping } from '../types';

const HEADER_ALIASES: Record<string, keyof ColumnMapping> = {
  // tanggal
  tanggal: 'tanggal', date: 'tanggal', tgl: 'tanggal',
  'tanggal pengisian': 'tanggal', 'tanggal isi': 'tanggal',
  // namaUnit
  'nama unit': 'namaUnit', unit: 'namaUnit', equipment: 'namaUnit',
  alat: 'namaUnit', 'id unit': 'namaUnit', 'unit id': 'namaUnit',
  'nomor unit': 'namaUnit', 'no unit': 'namaUnit', 'no. unit': 'namaUnit',
  'kode unit': 'namaUnit',
  // jenisUnit
  'jenis unit': 'jenisUnit', type: 'jenisUnit', tipe: 'jenisUnit',
  model: 'jenisUnit', jenis: 'jenisUnit', 'tipe unit': 'jenisUnit',
  // area
  area: 'area', lokasi: 'area', location: 'area',
  pit: 'area', site: 'area', 'area kerja': 'area',
  // operator
  operator: 'operator', driver: 'operator', pengemudi: 'operator',
  'nama operator': 'operator', 'nama driver': 'operator',
  // hmAwal
  'hm awal': 'hmAwal', 'jam awal': 'hmAwal', 'km awal': 'hmAwal',
  'start hm': 'hmAwal', 'opening hm': 'hmAwal', 'hm in': 'hmAwal',
  'hm awal (jam)': 'hmAwal',
  // hmAkhir
  'hm akhir': 'hmAkhir', 'jam akhir': 'hmAkhir', 'km akhir': 'hmAkhir',
  'end hm': 'hmAkhir', 'closing hm': 'hmAkhir', 'hm out': 'hmAkhir',
  'hm akhir (jam)': 'hmAkhir',
  // hmOperasi
  'hm operasi': 'hmOperasi', 'jam operasi': 'hmOperasi',
  'operating hours': 'hmOperasi', hm: 'hmOperasi',
  'running hours': 'hmOperasi', rh: 'hmOperasi',
  'total hm': 'hmOperasi', 'total jam': 'hmOperasi',
  // volumeBBM
  'volume bbm': 'volumeBBM', volume: 'volumeBBM', bbm: 'volumeBBM',
  fuel: 'volumeBBM', liter: 'volumeBBM', 'jumlah bbm': 'volumeBBM',
  'fuel (l)': 'volumeBBM', 'fuel (liter)': 'volumeBBM',
  'fuel liter': 'volumeBBM', 'qty bbm': 'volumeBBM',
  'total bbm': 'volumeBBM', 'pemakaian bbm': 'volumeBBM',
  // fuelRatio
  'fuel ratio': 'fuelRatio', fr: 'fuelRatio',
  'fuel burn rate': 'fuelRatio', ratio: 'fuelRatio',
  'l/hm': 'fuelRatio', 'liter/hm': 'fuelRatio',
  fbr: 'fuelRatio', 'rasio bbm': 'fuelRatio',
};

function findHeaderRow(rawData: unknown[][]): number {
  for (let i = 0; i < Math.min(8, rawData.length); i++) {
    const row = rawData[i];
    if (!row || row.length < 2) continue;
    const nonEmpty = row.filter(c => c !== null && c !== undefined && String(c).trim() !== '');
    if (nonEmpty.length >= 3) return i;
  }
  return 0;
}

function buildColumnMap(headers: string[]): ColumnMapping {
  const map: ColumnMapping = {};
  headers.forEach((h, i) => {
    const normalized = h.toLowerCase().trim().replace(/\s+/g, ' ');
    const field = HEADER_ALIASES[normalized];
    if (field && !(field in map)) {
      (map as Record<string, number>)[field] = i;
    }
  });
  return map;
}

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0;
  const s = String(val).replace(/,/g, '.').replace(/[^\d.-]/g, '');
  return parseFloat(s) || 0;
}

function parseDate(val: unknown): string {
  if (!val) return '';
  if (typeof val === 'number') {
    // Excel serial date
    const date = XLSX.SSF.parse_date_code(val);
    if (date) return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
  }
  return String(val);
}

export function parseFile(file: File): Promise<FuelRecord[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary', cellDates: false });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as unknown[][];
        resolve(processRawData(rawData));
      } catch (err) {
        reject(new Error(`Gagal membaca file: ${err instanceof Error ? err.message : String(err)}`));
      }
    };
    reader.onerror = () => reject(new Error('Gagal membaca file'));
    reader.readAsBinaryString(file);
  });
}

function processRawData(rawData: unknown[][]): FuelRecord[] {
  if (rawData.length < 2) return [];

  const headerRowIdx = findHeaderRow(rawData);
  const headers = (rawData[headerRowIdx] as unknown[]).map(h => String(h ?? ''));
  const colMap = buildColumnMap(headers);

  const records: FuelRecord[] = [];
  let idCounter = 1;

  for (let i = headerRowIdx + 1; i < rawData.length; i++) {
    const row = rawData[i] as unknown[];
    if (!row || row.every(c => c === null || c === undefined || c === '')) continue;

    const get = (field: keyof ColumnMapping) => {
      const idx = (colMap as Record<string, number | undefined>)[field];
      return idx !== undefined ? row[idx] : undefined;
    };

    const namaUnit = String(get('namaUnit') ?? '').trim();
    const volumeRaw = parseNum(get('volumeBBM'));

    if (!namaUnit && volumeRaw === 0) continue;

    let hmAwal = parseNum(get('hmAwal'));
    let hmAkhir = parseNum(get('hmAkhir'));
    let hmOperasi = parseNum(get('hmOperasi'));
    const volumeBBM = volumeRaw;

    if (hmAwal > 0 && hmAkhir > 0 && hmOperasi === 0) {
      hmOperasi = hmAkhir - hmAwal;
    } else if (hmOperasi > 0 && hmAwal > 0 && hmAkhir === 0) {
      hmAkhir = hmAwal + hmOperasi;
    }

    let fuelRatio = parseNum(get('fuelRatio'));
    if (fuelRatio === 0 && volumeBBM > 0 && hmOperasi > 0) {
      fuelRatio = volumeBBM / hmOperasi;
    }

    records.push({
      id: idCounter++,
      tanggal: parseDate(get('tanggal')),
      namaUnit: namaUnit || `Unit-${idCounter}`,
      jenisUnit: String(get('jenisUnit') ?? '').trim(),
      area: String(get('area') ?? '').trim(),
      operator: String(get('operator') ?? '').trim(),
      hmAwal,
      hmAkhir,
      hmOperasi,
      volumeBBM,
      fuelRatio,
    });
  }

  return records;
}
