import { useCallback, useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface FileUploadProps {
  onFileParsed: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export default function FileUpload({ onFileParsed, isLoading, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) return;
    onFileParsed(file);
  }, [onFileParsed]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex bg-blue-900 text-amber-400 p-4 rounded-2xl mb-4 shadow-lg">
            <FileSpreadsheet className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-blue-900">Upload Fuel Report</h2>
          <p className="text-slate-500 mt-2 text-sm">
            Upload file Excel atau CSV laporan pengisian BBM alat berat
          </p>
        </div>

        <label
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          className={`
            relative block border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer
            transition-all duration-200 bg-white
            ${isDragging ? 'border-blue-500 bg-blue-50 scale-[1.01]' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50/40'}
            ${isLoading ? 'pointer-events-none opacity-70' : ''}
          `}
        >
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={onInputChange}
            className="hidden"
            disabled={isLoading}
          />
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-blue-700 font-medium">Memproses data...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className={`w-10 h-10 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
              <div>
                <p className="font-semibold text-slate-700">
                  {isDragging ? 'Lepaskan file di sini' : 'Drag & drop atau klik untuk memilih file'}
                </p>
                <p className="text-slate-400 text-sm mt-1">Mendukung .xlsx, .xls, .csv</p>
              </div>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-4 flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Format Kolom yang Didukung</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
            {[
              ['Tanggal', 'tanggal / date / tgl'],
              ['Nama Unit', 'nama unit / unit / kode unit'],
              ['Jenis Unit', 'jenis unit / model / tipe'],
              ['Area', 'area / lokasi / pit'],
              ['HM Awal', 'hm awal / start hm'],
              ['HM Akhir', 'hm akhir / end hm'],
              ['HM Operasi', 'hm operasi / running hours'],
              ['Volume BBM', 'volume bbm / fuel / liter'],
              ['Fuel Ratio', 'fuel ratio / fr / fbr'],
              ['Operator', 'operator / driver'],
            ].map(([label, hint]) => (
              <div key={label} className="flex gap-1">
                <span className="font-medium text-blue-800 shrink-0">{label}:</span>
                <span className="text-slate-400 truncate">{hint}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
