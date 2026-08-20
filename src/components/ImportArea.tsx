import React, { useState } from "react";
import { Upload, Copy, Database, HelpCircle, FileText, CheckCircle2, RotateCcw, AlertTriangle } from "lucide-react";
import { parsePastedData, INITIAL_FUEL_DATA } from "../data/sampleData";
import { FuelRecord } from "../types";

interface ImportAreaProps {
  onDataImported: (newRecords: FuelRecord[], append: boolean) => void;
  onResetToSample: () => void;
  currentCount: number;
}

export default function ImportArea({ onDataImported, onResetToSample, currentCount }: ImportAreaProps) {
  const [pasteText, setPasteText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });

  const handlePasteSubmit = (append: boolean) => {
    if (!pasteText.trim()) {
      setImportStatus({ type: "error", message: "Silakan tempel (paste) data Excel atau isi teks CSV terlebih dahulu." });
      return;
    }

    try {
      const parsed = parsePastedData(pasteText);
      if (parsed.length === 0) {
        setImportStatus({
          type: "error",
          message: "Tidak ada baris data valid yang terdeteksi. Silakan periksa format kolom Anda."
        });
        return;
      }
      
      onDataImported(parsed, append);
      setImportStatus({
        type: "success",
        message: `Berhasil mengimpor ${parsed.length} baris data bahan bakar baru!`
      });
      setPasteText("");
    } catch (err: any) {
      setImportStatus({ type: "error", message: `Gagal memproses data: ${err.message || 'Error tidak dikenal'}` });
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setImportStatus({ type: "error", message: "Format file tidak didukung. Harap gunakan file CSV atau data teks (.txt)." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setPasteText(text);
        setImportStatus({ type: "success", message: `File "${file.name}" terbaca! Klik tombol impor di bawah untuk memproses.` });
      }
    };
    reader.onerror = () => {
      setImportStatus({ type: "error", message: "Gagal membaca file tersebut." });
    };
    reader.readAsText(file);
  };

  const generateTemplateCSV = () => {
    const headers = "Tanggal\tTempat/Storage\tNomor Unit\tType Alat\tHM Sebelum\tHM Saat Ini\tVolume Fuel\tOperator\tFuelman\tShift\tJam pengisian";
    const example1 = "2026-05-27\tStorage Utama Central\tEXC-PC200-01\tExcavator PC200\t1120.5\t1130.5\t220\tRahmad Hidayat\tAndi Susanto\tShift 1 - Siang\t08:30";
    const example2 = "2026-05-27\tFuel Truck FT-01\tDT-HD785-05\tDump Truck HD785\t8712.0\t8723.2\t560\tSlamet Santoso\tAgus Triyono\tShift 2 - Malam\t21:15";
    const example3 = "2026-05-26\tTemporary Tank Pit A\tBULL-D85-02\tBulldozer D85SS\t1450.0\t1450.0\t120\tBudi Wijaya\tEko Prasetyo\tShift 1 - Siang\t10:00\t(Contoh Anomali Selisih HM 0)";
    
    const fullText = `${headers}\n${example1}\n${example2}\n${example3}`;
    navigator.clipboard.writeText(fullText);
    alert("Format template Excel berhasil disalin ke clipboard! Anda bisa melakukan paste langsung (Ctrl+V) di program Excel atau Google Sheets.");
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 font-sans">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-[#4682B4]" />
            <h3 className="text-lg font-bold text-slate-800">Pemberi Makan Data (Data Importer)</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Impor, timpa, atau tambahkan log transaksi langsung dari lembar kerja Excel / file CSV.
          </p>
        </div>

        <button
          onClick={onResetToSample}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 font-medium px-2.5 py-1.5 rounded transition"
          title="Kembalikan ke data contoh default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset ke Data Sampel
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Helper Instructions Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-lg space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-500" /> Format Penyusunan Kolom
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Sistem akan memetakan data dengan mendeteksi teks pembatas Tab (hasil copasan Excel) atau Koma (file CSV). Pastikan data mengikuti urutan kolom berikut:
            </p>
            <div className="bg-white rounded border border-slate-200 p-2.5 font-mono text-[10px] text-slate-700 space-y-1 select-all overflow-x-auto">
              <div>Tanggal <span className="text-[#4682B4]">[Kolom G]</span></div>
              <div>Tempat/Storage <span className="text-[#4682B4]">[Kolom H]</span></div>
              <div>Nomor Unit (ID Alat) <span className="text-[#4682B4]">[Kolom I]</span></div>
              <div>Type Alat Berat <span className="text-[#4682B4]">[Kolom J]</span></div>
              <div>HM Sebelumnya <span className="text-[#4682B4]">[Kolom K]</span></div>
              <div>HM Saat Ini <span className="text-[#4682B4]">[Kolom L]</span></div>
              <div>Volume Fuel (Liter) <span className="text-[#4682B4]">[Kolom N]</span></div>
              <div>Nama Operator <span className="text-[#4682B4]">[Kolom R]</span></div>
              <div>Nama Fuelman <span className="text-[#4682B4]">[Kolom U]</span></div>
              <div>Shift <span className="text-[#4682B4]">[Kolom V]</span></div>
              <div>Jam Pengisian <span className="text-[#4682B4]">[Kolom W]</span></div>
            </div>
            
            <button
              onClick={generateTemplateCSV}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-[#4682B4] hover:text-white bg-[#4682B4]/10 hover:bg-[#4682B4] border border-[#4682B4]/20 rounded px-3 py-2 transition font-medium cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" /> Salin Template Copy-Paste ke Excel
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-550 bg-slate-100/50 p-3 rounded-lg border border-slate-150">
            <span>Database Aktif Saat Ini:</span>
            <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-800">
              {currentCount} Log
            </span>
          </div>
        </div>

        {/* Input Area Column */}
        <div className="lg:col-span-7 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`relative border-2 border-dashed rounded-lg p-4 transition-all ${
              isDragging 
                ? "border-[#4682B4] bg-[#4682B4]/5" 
                : "border-slate-200 hover:border-[#4682B4] bg-slate-50/20"
            }`}
          >
            <textarea
              className="w-full h-44 bg-transparent border-0 p-0 text-xs font-mono text-slate-700 focus:ring-0 placeholder:text-slate-400 resize-none"
              placeholder="Tempel (Ctrl+V) baris sel dari Excel, atau geser & lepas (drag-and-drop) file CSV/Txt Anda di sini..."
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />

            {/* Empty block backdrop for Drag hints */}
            {!pasteText && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400 select-none">
                <Upload className="w-8 h-8 opacity-60 mb-2 text-[#4682B4]" />
                <p className="text-xs font-bold text-slate-600">Seret File CSV / Paste Sel Google Sheets</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Mendukung format TSV / CSV</p>
              </div>
            )}
            
            {/* File explorer select trigger inside dragzone */}
            <div className="absolute right-3.5 bottom-3.5 flex items-center gap-2">
              <label htmlFor="file-upload" className="cursor-pointer text-[10px] bg-white hover:bg-slate-550 hover:text-white border border-slate-200 rounded px-2 py-1 shadow-sm font-medium transition">
                Pilih File...
              </label>
              <input
                id="file-upload"
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {/* Import actions and feedbacks */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex-1">
              {importStatus.type && (
                <div className={`p-2.5 rounded-lg border text-xs flex gap-2 items-center ${
                  importStatus.type === "success" 
                    ? "bg-emerald-50 border-emerald-200 text-emerald-850" 
                    : "bg-rose-50 border-rose-200 text-rose-850"
                }`}>
                  {importStatus.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="leading-tight font-medium">{importStatus.message}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handlePasteSubmit(true)}
                className="bg-slate-850 hover:bg-slate-900 border border-slate-700 text-white font-medium text-xs rounded-lg px-4 py-2.5 transition active:scale-95"
                title="Tambahkan data baru ke bawah data lama"
              >
                Tambahkan Data
              </button>
              <button
                onClick={() => handlePasteSubmit(false)}
                className="bg-[#4682B4] hover:bg-[#36648B] text-white font-medium text-xs rounded-lg px-4 py-2.5 transition active:scale-95"
                title="Hapus data lama dan gantikan dengan data baru ini"
              >
                Gantikan Semua Data
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
