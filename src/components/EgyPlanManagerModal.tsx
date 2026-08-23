import React, { useState, useEffect, useMemo } from "react";
import { 
  X, 
  Save, 
  RotateCcw, 
  Plus, 
  Trash2, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Sliders, 
  Database,
  Search,
  Fuel,
  Info,
  Layers
} from "lucide-react";
import { EgyPlanMap } from "../types";
import { 
  DEFAULT_EGY_PLANS, 
  EGY_CATEGORIES_INFO, 
  saveEgyPlansToFirestore,
  saveStoredEgyPlans,
  cleanEgyName
} from "../lib/egyPlanService";

interface EgyPlanManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPlans: EgyPlanMap;
  onSavePlans: (updatedPlans: EgyPlanMap) => void;
  availableEgysInDataset?: string[];
}

export default function EgyPlanManagerModal({
  isOpen,
  onClose,
  currentPlans,
  onSavePlans,
  availableEgysInDataset = []
}: EgyPlanManagerModalProps) {
  const [draftPlans, setDraftPlans] = useState<EgyPlanMap>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error" | null; message: string }>({ type: null, message: "" });
  
  // New Egy Modal/Form State
  const [isAddingNewEgy, setIsAddingNewEgy] = useState(false);
  const [newEgyName, setNewEgyName] = useState("");
  const [newEgyPlanValue, setNewEgyPlanValue] = useState<string>("10.0");
  const [newEgyError, setNewEgyError] = useState("");

  // Sync draft when modal opens or currentPlans change
  useEffect(() => {
    if (isOpen) {
      // Merge currentPlans with dataset Egys and default Egys to ensure no missing Egy
      const merged: EgyPlanMap = { ...DEFAULT_EGY_PLANS, ...currentPlans };
      
      availableEgysInDataset.forEach(egyRaw => {
        const clean = cleanEgyName(egyRaw).toUpperCase();
        if (clean && clean !== "SEMUA" && merged[clean] === undefined) {
          merged[clean] = DEFAULT_EGY_PLANS[clean] || 10.0;
        }
      });

      setDraftPlans(merged);
      setNotification({ type: null, message: "" });
      setIsAddingNewEgy(false);
    }
  }, [isOpen, currentPlans, availableEgysInDataset]);

  if (!isOpen) return null;

  const handlePlanChange = (egy: string, valueStr: string) => {
    const val = parseFloat(valueStr);
    setDraftPlans(prev => ({
      ...prev,
      [egy]: isNaN(val) ? 0 : val
    }));
  };

  const handleIncrement = (egy: string, delta: number) => {
    setDraftPlans(prev => {
      const current = prev[egy] !== undefined ? prev[egy] : (DEFAULT_EGY_PLANS[egy] || 10.0);
      const updated = Math.max(0.1, Number((current + delta).toFixed(1)));
      return {
        ...prev,
        [egy]: updated
      };
    });
  };

  const handleResetSingle = (egy: string) => {
    const defaultVal = DEFAULT_EGY_PLANS[egy] || 10.0;
    setDraftPlans(prev => ({
      ...prev,
      [egy]: defaultVal
    }));
  };

  const handleDeleteCustomEgy = (egy: string) => {
    setDraftPlans(prev => {
      const next = { ...prev };
      delete next[egy];
      return next;
    });
  };

  const handleResetAllToBenchmark = () => {
    if (window.confirm("Kembalikan seluruh target plan Fuel Burn ke nilai standar benchmark PT. WBS?")) {
      const reset = { ...DEFAULT_EGY_PLANS };
      setDraftPlans(reset);
      setNotification({
        type: "success",
        message: "Seluruh target Plan Fuel Burn berhasil dikembalikan ke standar benchmark Master Juli."
      });
    }
  };

  const handleApplyPreset = (multiplier: number, label: string) => {
    setDraftPlans(prev => {
      const next: EgyPlanMap = {};
      Object.entries(prev).forEach(([k, v]) => {
        const num = typeof v === "number" ? v : parseFloat(String(v)) || 0;
        next[k] = Number((num * multiplier).toFixed(1));
      });
      return next;
    });
    setNotification({
      type: "success",
      message: `Preset "${label}" berhasil diterapkan ke seluruh target Egy.`
    });
  };

  const handleAddNewEgySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNewEgyError("");

    const clean = cleanEgyName(newEgyName).toUpperCase().trim();
    if (!clean) {
      setNewEgyError("Nama Jenis Egy tidak boleh kosong.");
      return;
    }

    const val = parseFloat(newEgyPlanValue);
    if (isNaN(val) || val <= 0) {
      setNewEgyError("Nilai plan Fuel Burn harus lebih besar dari 0 L/Jam.");
      return;
    }

    setDraftPlans(prev => ({
      ...prev,
      [clean]: Number(val.toFixed(1))
    }));

    setNewEgyName("");
    setNewEgyPlanValue("10.0");
    setIsAddingNewEgy(false);
    setNotification({
      type: "success",
      message: `Jenis Egy baru "${clean}" dengan target ${val.toFixed(1)} L/Jam berhasil ditambahkan!`
    });
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    setNotification({ type: null, message: "" });
    try {
      // 1. Sanitize draft plans
      const cleanPlans: EgyPlanMap = {};
      Object.entries(draftPlans).forEach(([k, v]) => {
        const cleanKey = cleanEgyName(k).toUpperCase().trim();
        const numVal = typeof v === "number" && !isNaN(v) && v > 0 ? Number(v.toFixed(1)) : (DEFAULT_EGY_PLANS[cleanKey] || 10.0);
        if (cleanKey) {
          cleanPlans[cleanKey] = numVal;
        }
      });

      // 2. Persist to Firestore
      await saveEgyPlansToFirestore(cleanPlans);

      // 3. Local fallback persistence
      saveStoredEgyPlans(cleanPlans);

      // 4. Propagate to parent state
      onSavePlans(cleanPlans);

      setNotification({
        type: "success",
        message: "Target Plan Fuel Burn per Jenis Egy berhasil disimpan ke Cloud Firestore & diaplikasikan ke seluruh penilaian!"
      });

      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("Save error:", err);
      setNotification({
        type: "error",
        message: `Gagal menyimpan plan: ${err.message || "Periksa koneksi database."}`
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Filter and sort items
  const filteredEgyEntries = useMemo(() => {
    const list = Object.entries(draftPlans);
    return list
      .filter(([egy]) => egy.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => a[0].localeCompare(b[0]));
  }, [draftPlans, searchTerm]);

  // Statistics
  const stats = useMemo(() => {
    const vals: number[] = Object.values(draftPlans)
      .map(v => (typeof v === "number" ? v : parseFloat(String(v)) || 0))
      .filter(v => v > 0);
    const count = Object.keys(draftPlans).length;
    const avg = vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;
    const maxVal = vals.length > 0 ? Math.max(...vals) : 0;
    const minVal = vals.length > 0 ? Math.min(...vals) : 0;
    return { count, avg, maxVal, minVal };
  }, [draftPlans]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-fade-in font-sans">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Modal Header */}
        <div className="bg-[#1E293B] text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Input Plan Fuel Burn per Jenis Egy
                </h2>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30 font-mono">
                  Cloud Synced
                </span>
              </div>
              <p className="text-xs text-slate-350 mt-0.5">
                Tentukan target benchmark konsumsi bahan bakar (L/Jam) per kategori Egy untuk evaluasi Plan vs Actual.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Tutup Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Controls & Preset Bar */}
        <div className="bg-slate-50 border-b border-slate-200 p-4 shrink-0 flex flex-wrap items-center justify-between gap-3">
          
          {/* Search bar */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari jenis Egy (misal: EXCAVATOR, DUMP TRUCK)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl focus:border-[#4682B4] focus:outline-none focus:ring-1 focus:ring-[#4682B4]/30 text-slate-700 font-medium"
            />
          </div>

          {/* Quick Presets & Add New */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsAddingNewEgy(true)}
              className="flex items-center gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-2 rounded-xl transition shadow-xs cursor-pointer active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Egy Baru</span>
            </button>

            <button
              onClick={() => handleApplyPreset(0.95, "Target Efisiensi -5%")}
              className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-2 rounded-xl transition cursor-pointer"
              title="Turunkan seluruh target sebesar 5% untuk target operasional lebih ketat"
            >
              Ketat (-5%)
            </button>

            <button
              onClick={() => handleApplyPreset(1.05, "Toleransi Beban +5%")}
              className="text-[11px] bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 font-bold px-2.5 py-2 rounded-xl transition cursor-pointer"
              title="Naikkan target sebesar 5% untuk kondisi medan berat"
            >
              Toleransi (+5%)
            </button>

            <button
              onClick={handleResetAllToBenchmark}
              className="flex items-center gap-1 text-[11px] bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold px-2.5 py-2 rounded-xl transition cursor-pointer"
              title="Reset seluruh target ke Master Benchmark Juli"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Standar WBS</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Strip */}
        <div className="bg-white border-b border-slate-100 px-5 py-2.5 flex flex-wrap items-center justify-between text-xs text-slate-600 gap-3">
          <div className="flex items-center gap-4">
            <span>Total Jenis Egy: <strong className="text-slate-900 font-mono">{stats.count}</strong></span>
            <span>•</span>
            <span>Rerata Target Plan: <strong className="text-amber-700 font-mono">{stats.avg} L/Jam</strong></span>
            <span>•</span>
            <span>Rentang: <strong className="text-slate-800 font-mono">{stats.minVal} - {stats.maxVal} L/Jam</strong></span>
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-slate-400" />
            <span>Target ini otomatis dipakai sebagai benchmark evaluasi Fuel Burn seluruh unit.</span>
          </div>
        </div>

        {/* Feedback Alert */}
        {notification.type && (
          <div className={`p-3 mx-5 mt-4 rounded-xl border flex items-center gap-2.5 text-xs font-medium ${
            notification.type === "success" 
              ? "bg-emerald-50 border-emerald-200 text-emerald-800" 
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}>
            {notification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* Add New Egy Inline Form */}
        {isAddingNewEgy && (
          <form onSubmit={handleAddNewEgySubmit} className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 m-5 mb-0 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-emerald-900 uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-emerald-700" />
                <span>Tambah Kategori / Jenis Egy Baru</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingNewEgy(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1">Nama Jenis Egy</label>
                <input
                  type="text"
                  placeholder="Contoh: ARTICULATED DUMP TRUCK, PUMPING UNIT"
                  value={newEgyName}
                  onChange={(e) => setNewEgyName(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-bold uppercase"
                />
              </div>

              <div>
                <label className="text-[10px] font-extrabold text-slate-600 uppercase block mb-1">Target Plan (L/Jam)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="200"
                  value={newEgyPlanValue}
                  onChange={(e) => setNewEgyPlanValue(e.target.value)}
                  className="w-full text-xs px-3 py-2 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono font-bold"
                />
              </div>
            </div>

            {newEgyError && (
              <p className="text-[11px] font-bold text-rose-600">{newEgyError}</p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingNewEgy(false)}
                className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="text-xs px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                Tambahkan Egy
              </button>
            </div>
          </form>
        )}

        {/* Scrollable Table of Egy Plans */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="py-3 px-4">Jenis Egy (Equipment Grouping)</th>
                  <th className="py-3 px-3">Deskripsi & Armada Standar</th>
                  <th className="py-3 px-3 text-center">Standar Benchmark</th>
                  <th className="py-3 px-4 text-center">Target Plan Fuel Burn (L/Jam)</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredEgyEntries.map(([egy, planVal]) => {
                  const info = EGY_CATEGORIES_INFO[egy];
                  const benchmarkVal = DEFAULT_EGY_PLANS[egy] || 10.0;
                  const isModified = planVal !== benchmarkVal;
                  const isPresentInActiveDataset = availableEgysInDataset.some(e => cleanEgyName(e).toUpperCase() === egy);

                  return (
                    <tr key={egy} className={`hover:bg-slate-50/80 transition-colors ${isModified ? "bg-amber-50/20" : ""}`}>
                      
                      {/* Egy Name */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-800 font-mono tracking-tight text-xs">
                            {egy}
                          </span>
                          {isPresentInActiveDataset && (
                            <span className="text-[9px] bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200" title="Terdeteksi di data Excel saat ini">
                              Aktif di Dataset
                            </span>
                          )}
                          {isModified && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded" title="Nilai diubah dari benchmark standar">
                              Kustom
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Description & Fleet */}
                      <td className="py-3.5 px-3 max-w-[280px]">
                        <p className="text-[11px] text-slate-700 font-medium truncate">{info?.desc || "Kategori Unit Khusus"}</p>
                        <p className="text-[10px] text-slate-400 truncate">{info?.standardFleet || "Model Alat Penunjang"}</p>
                      </td>

                      {/* Benchmark Default Value */}
                      <td className="py-3.5 px-3 text-center font-mono text-slate-500 font-semibold">
                        {benchmarkVal.toFixed(1)} <span className="text-[10px] text-slate-400">L/J</span>
                      </td>

                      {/* Interactive Plan Input */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="inline-flex items-center border border-slate-300 rounded-xl bg-white shadow-2xs overflow-hidden focus-within:border-[#4682B4] focus-within:ring-1 focus-within:ring-[#4682B4]/30">
                          <button
                            type="button"
                            onClick={() => handleIncrement(egy, -0.5)}
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-black cursor-pointer select-none transition active:bg-slate-200"
                            title="Kurangi 0.5 L/Jam"
                          >
                            -
                          </button>
                          
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="200"
                            value={planVal}
                            onChange={(e) => handlePlanChange(egy, e.target.value)}
                            className="w-20 text-center font-mono font-black text-xs text-slate-900 py-1.5 focus:outline-none border-x border-slate-200 bg-slate-50/40"
                          />

                          <button
                            type="button"
                            onClick={() => handleIncrement(egy, 0.5)}
                            className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 font-black cursor-pointer select-none transition active:bg-slate-200"
                            title="Tambah 0.5 L/Jam"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {isModified && (
                            <button
                              type="button"
                              onClick={() => handleResetSingle(egy)}
                              className="text-slate-400 hover:text-amber-700 p-1.5 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                              title="Kembalikan ke benchmark default"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!DEFAULT_EGY_PLANS[egy] && (
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomEgy(egy)}
                              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                              title="Hapus Egy kustom ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Database className="w-4 h-4 text-emerald-600" />
            <span>Perubahan otomatis tersimpan ke <strong>Cloud Firestore</strong> (fuel-wbs) untuk semua pengguna.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center justify-center gap-2 text-xs bg-[#4682B4] hover:bg-[#36648B] disabled:opacity-50 text-white font-extrabold px-6 py-2.5 rounded-xl transition shadow-sm cursor-pointer active:scale-95"
            >
              {isSaving ? (
                <span>Menyimpan ke Cloud...</span>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Target Plan</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
