import { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, Filter } from 'lucide-react';
import { FuelRecord } from '../types';
import { formatNumber } from '../utils/analytics';

interface DataTableProps {
  records: FuelRecord[];
}

type SortKey = keyof FuelRecord;
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 20;

export default function DataTable({ records }: DataTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('volumeBBM');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return records;
    return records.filter(r =>
      r.namaUnit.toLowerCase().includes(q) ||
      r.jenisUnit.toLowerCase().includes(q) ||
      r.area.toLowerCase().includes(q) ||
      r.operator.toLowerCase().includes(q) ||
      r.tanggal.toLowerCase().includes(q)
    );
  }, [records, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ChevronUp className="w-3 h-3 text-slate-300" />;
    return sortDir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const cols: { key: SortKey; label: string; align?: string }[] = [
    { key: 'tanggal', label: 'Tanggal' },
    { key: 'namaUnit', label: 'Nama Unit' },
    { key: 'jenisUnit', label: 'Jenis' },
    { key: 'area', label: 'Area' },
    { key: 'operator', label: 'Operator' },
    { key: 'hmAwal', label: 'HM Awal', align: 'right' },
    { key: 'hmAkhir', label: 'HM Akhir', align: 'right' },
    { key: 'hmOperasi', label: 'HM Op.', align: 'right' },
    { key: 'volumeBBM', label: 'Vol. BBM (L)', align: 'right' },
    { key: 'fuelRatio', label: 'FR (L/HM)', align: 'right' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
        <div>
          <h3 className="font-bold text-slate-800">Data Pengisian BBM</h3>
          <p className="text-slate-400 text-xs mt-0.5">{formatNumber(filtered.length, 0)} dari {formatNumber(records.length, 0)} record</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari unit, area, operator..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 w-56"
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Filter className="w-3.5 h-3.5" />
            <span>{sorted.length} hasil</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {cols.map(c => (
                <th
                  key={c.key}
                  onClick={() => handleSort(c.key)}
                  className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition-colors select-none ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    <SortIcon k={c.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {paged.map(r => (
              <tr key={r.id} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-2.5 text-slate-500 text-xs">{r.tanggal || '-'}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{r.namaUnit}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.jenisUnit || '-'}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.area || '-'}</td>
                <td className="px-4 py-2.5 text-slate-500">{r.operator || '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.hmAwal > 0 ? formatNumber(r.hmAwal, 0) : '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.hmAkhir > 0 ? formatNumber(r.hmAkhir, 0) : '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono text-slate-600">{r.hmOperasi > 0 ? formatNumber(r.hmOperasi, 1) : '-'}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-700">{formatNumber(r.volumeBBM, 0)}</td>
                <td className="px-4 py-2.5 text-right">
                  <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${r.fuelRatio > 0 ? 'bg-amber-50 text-amber-700' : 'text-slate-400'}`}>
                    {r.fuelRatio > 0 ? r.fuelRatio.toFixed(2) : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between text-sm text-slate-500">
          <span>Halaman {page} dari {totalPages}</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
