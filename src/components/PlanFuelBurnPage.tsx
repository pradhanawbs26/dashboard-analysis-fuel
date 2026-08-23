import React, { useState, useMemo, useEffect } from "react";
import { 
  SlidersHorizontal, 
  Plus, 
  Trash2, 
  Edit3, 
  Save, 
  RefreshCw, 
  Search, 
  Download, 
  Upload, 
  Check, 
  AlertCircle, 
  HelpCircle, 
  Layers, 
  Truck, 
  Fuel, 
  Flame, 
  Zap, 
  ArrowRight,
  Filter,
  Eye,
  CheckCircle2,
  FileSpreadsheet,
  Copy,
  FolderPlus,
  Tag,
  Gauge,
  X
} from "lucide-react";
import * as XLSX from "xlsx";
import { 
  EgyPlanMap, 
  UnitRegistryMap, 
  UnitPlanConfig, 
  FuelRecord 
} from "../types";
import { 
  DEFAULT_EGY_PLANS, 
  EGY_CATEGORIES_INFO, 
  cleanEgyName,
  deriveEgy,
  saveEgyPlansToFirestore, 
  saveUnitRegistryToFirestore,
  saveStoredUnitRegistry,
  saveStoredEgyPlans
} from "../lib/egyPlanService";

interface PlanFuelBurnPageProps {
  egyPlans: EgyPlanMap;
  unitRegistry: UnitRegistryMap;
  onSaveEgyPlans: (plans: EgyPlanMap) => Promise<void> | void;
  onSaveUnitRegistry: (registry: UnitRegistryMap) => Promise<void> | void;
  records?: FuelRecord[];
  onBackToDashboard?: () => void;
}

export default function PlanFuelBurnPage({
  egyPlans,
  unitRegistry,
  onSaveEgyPlans,
  onSaveUnitRegistry,
  records = [],
  onBackToDashboard
}: PlanFuelBurnPageProps) {
  // Local editable draft state
  const [draftPlans, setDraftPlans] = useState<EgyPlanMap>({ ...DEFAULT_EGY_PLANS, ...egyPlans });
  const [draftUnits, setDraftUnits] = useState<UnitRegistryMap>({ ...unitRegistry });
  
  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEgyFilter, setSelectedEgyFilter] = useState("SEMUA");
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  // Modals
  const [isAddEgyModalOpen, setIsAddEgyModalOpen] = useState(false);
  const [isAddUnitModalOpen, setIsAddUnitModalOpen] = useState(false);
  const [isEditUnitModalOpen, setIsEditUnitModalOpen] = useState(false);
  const [isBatchImportModalOpen, setIsBatchImportModalOpen] = useState(false);
  const [activeEgyForNewUnit, setActiveEgyForNewUnit] = useState<string>("");
  const [editingUnit, setEditingUnit] = useState<UnitPlanConfig | null>(null);

  // Form states for adding/editing
  const [newEgyName, setNewEgyName] = useState("");
  const [newEgyPlan, setNewEgyPlan] = useState("10.0");
  const [newEgyDesc, setNewEgyDesc] = useState("");

  const [unitFormEgy, setUnitFormEgy] = useState("");
  const [unitFormInput, setUnitFormInput] = useState(""); // supports comma/newline batch
  const [unitFormType, setUnitFormType] = useState("");
  const [unitFormCustomPlan, setUnitFormCustomPlan] = useState("");

  // Sync draft states with incoming props when they change
  useEffect(() => {
    setDraftPlans({ ...DEFAULT_EGY_PLANS, ...egyPlans });
  }, [egyPlans]);

  useEffect(() => {
    setDraftUnits({ ...unitRegistry });
  }, [unitRegistry]);

  // Clear feedback after 4 seconds
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(null), 4000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Group registered units by Egy
  const unitsByEgy = useMemo(() => {
    const map: Record<string, UnitPlanConfig[]> = {};
    
    // Ensure all known Egys have an entry
    Object.keys(draftPlans).forEach(egy => {
      map[egy] = [];
    });

    (Object.values(draftUnits) as UnitPlanConfig[]).forEach(u => {
      const egyKey = (u.egy || "SUPPORT").toUpperCase();
      if (!map[egyKey]) {
        map[egyKey] = [];
      }
      map[egyKey].push(u);
    });

    // Sort units alphabetically inside each Egy
    Object.keys(map).forEach(egy => {
      map[egy].sort((a, b) => a.idAlat.localeCompare(b.idAlat, undefined, { numeric: true, sensitivity: 'base' }));
    });

    return map;
  }, [draftPlans, draftUnits]);

  // Filtered Egys based on search and selected filter
  const filteredEgys = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let egys = Object.keys(draftPlans);

    if (selectedEgyFilter !== "SEMUA") {
      egys = egys.filter(e => e === selectedEgyFilter);
    }

    if (q) {
      egys = egys.filter(egy => {
        // match Egy name
        if (egy.toLowerCase().includes(q)) return true;
        // match any unit ID inside this Egy
        const units = unitsByEgy[egy] || [];
        return units.some(u => u.idAlat.toLowerCase().includes(q) || (u.typeAlat && u.typeAlat.toLowerCase().includes(q)));
      });
    }

    return egys.sort();
  }, [draftPlans, selectedEgyFilter, searchQuery, unitsByEgy]);

  // Filtered unit list for Table View
  const filteredUnitsList = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = (Object.values(draftUnits) as UnitPlanConfig[]);

    if (selectedEgyFilter !== "SEMUA") {
      list = list.filter(u => u.egy.toUpperCase() === selectedEgyFilter);
    }

    if (q) {
      list = list.filter(u => 
        u.idAlat.toLowerCase().includes(q) || 
        u.egy.toLowerCase().includes(q) || 
        (u.typeAlat && u.typeAlat.toLowerCase().includes(q))
      );
    }

    return list.sort((a, b) => {
      const egyComp = a.egy.localeCompare(b.egy);
      if (egyComp !== 0) return egyComp;
      return a.idAlat.localeCompare(b.idAlat, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [draftUnits, selectedEgyFilter, searchQuery]);

  // Statistics
  const totalEgys = Object.keys(draftPlans).length;
  const totalUnits = Object.keys(draftUnits).length;
  const avgPlanBurn = useMemo(() => {
    const vals = Object.values(draftPlans).map(v => typeof v === "number" ? v : parseFloat(String(v)) || 0).filter(v => v > 0);
    return vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : 0;
  }, [draftPlans]);

  // Handlers for Plan Burn modifications
  const handleEgyPlanChange = (egy: string, valStr: string) => {
    const num = parseFloat(valStr);
    setDraftPlans(prev => ({
      ...prev,
      [egy]: isNaN(num) ? 0 : Math.max(0, Number(num.toFixed(1)))
    }));
  };

  const handleStepPlan = (egy: string, delta: number) => {
    const current = draftPlans[egy] || 0;
    const updated = Math.max(0.5, Number((current + delta).toFixed(1)));
    setDraftPlans(prev => ({
      ...prev,
      [egy]: updated
    }));
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
    setFeedback({
      type: "info",
      message: `Berhasil menerapkan penyesuaian target plan ${label} ke seluruh jenis Egy!`
    });
  };

  const handleResetToDefault = () => {
    if (window.confirm("Kembalikan seluruh nilai target Plan Fuel Burn ke standar benchmark operasional awal?")) {
      setDraftPlans({ ...DEFAULT_EGY_PLANS });
      setFeedback({
        type: "info",
        message: "Target Plan Fuel Burn berhasil dikembalikan ke standar benchmark default."
      });
    }
  };

  // Unit Operations
  const handleOpenAddUnit = (egyName?: string) => {
    setActiveEgyForNewUnit(egyName || Object.keys(draftPlans)[0] || "DUMP TRUCK");
    setUnitFormEgy(egyName || Object.keys(draftPlans)[0] || "DUMP TRUCK");
    setUnitFormInput("");
    setUnitFormType("");
    setUnitFormCustomPlan("");
    setIsAddUnitModalOpen(true);
  };

  const handleSaveNewUnit = () => {
    if (!unitFormInput.trim()) {
      alert("Masukkan minimal satu nomor unit!");
      return;
    }
    const egy = (unitFormEgy || "SUPPORT").toUpperCase().trim();
    // Support comma, whitespace or newline separated unit lists
    const rawTokens = unitFormInput.split(/[\n,;]+/);
    const unitCodes = rawTokens
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0);

    if (unitCodes.length === 0) {
      alert("Nomor unit tidak valid!");
      return;
    }

    const customPlan = unitFormCustomPlan ? parseFloat(unitFormCustomPlan) : undefined;

    setDraftUnits(prev => {
      const updated = { ...prev };
      unitCodes.forEach(code => {
        updated[code] = {
          idAlat: code,
          egy,
          typeAlat: unitFormType.trim() || egy,
          planFuelBurn: (customPlan !== undefined && !isNaN(customPlan) && customPlan > 0) ? customPlan : undefined
        };
      });
      return updated;
    });

    // Ensure Egy exists in draft plans
    if (draftPlans[egy] === undefined) {
      setDraftPlans(prev => ({
        ...prev,
        [egy]: customPlan || 10.0
      }));
    }

    setIsAddUnitModalOpen(false);
    setFeedback({
      type: "success",
      message: `Berhasil menambahkan ${unitCodes.length} nomor unit ke kategori ${egy}!`
    });
  };

  const handleOpenEditUnit = (unit: UnitPlanConfig) => {
    setEditingUnit(unit);
    setUnitFormEgy(unit.egy);
    setUnitFormInput(unit.idAlat);
    setUnitFormType(unit.typeAlat || "");
    setUnitFormCustomPlan(unit.planFuelBurn ? String(unit.planFuelBurn) : "");
    setIsEditUnitModalOpen(true);
  };

  const handleSaveEditUnit = () => {
    if (!editingUnit) return;
    const oldId = editingUnit.idAlat;
    const newId = unitFormInput.trim().toUpperCase();
    if (!newId) {
      alert("Nomor unit tidak boleh kosong!");
      return;
    }

    const egy = (unitFormEgy || "SUPPORT").toUpperCase().trim();
    const customPlan = unitFormCustomPlan ? parseFloat(unitFormCustomPlan) : undefined;

    setDraftUnits(prev => {
      const updated = { ...prev };
      if (oldId !== newId) {
        delete updated[oldId];
      }
      updated[newId] = {
        idAlat: newId,
        egy,
        typeAlat: unitFormType.trim() || egy,
        planFuelBurn: (customPlan !== undefined && !isNaN(customPlan) && customPlan > 0) ? customPlan : undefined,
        updatedAt: new Date().toISOString()
      };
      return updated;
    });

    setIsEditUnitModalOpen(false);
    setEditingUnit(null);
    setFeedback({
      type: "success",
      message: `Data nomor unit ${newId} berhasil diperbarui!`
    });
  };

  const handleDeleteUnit = async (idAlat: string) => {
    const next = { ...draftUnits };
    delete next[idAlat];
    setDraftUnits(next);
    try {
      await onSaveUnitRegistry(next);
      saveStoredUnitRegistry(next);
      await saveUnitRegistryToFirestore(next);
    } catch (e) {
      console.warn("Unit deletion save notice:", e);
    }
    setFeedback({
      type: "info",
      message: `Nomor unit ${idAlat} berhasil dihapus dari registrasi.`
    });
  };

  const handleDeleteFromEditModal = async () => {
    if (!editingUnit) return;
    const idToDelete = editingUnit.idAlat;
    const next = { ...draftUnits };
    delete next[idToDelete];
    setDraftUnits(next);
    try {
      await onSaveUnitRegistry(next);
      saveStoredUnitRegistry(next);
      await saveUnitRegistryToFirestore(next);
    } catch (e) {
      console.warn("Unit deletion save notice:", e);
    }
    setIsEditUnitModalOpen(false);
    setEditingUnit(null);
    setFeedback({
      type: "info",
      message: `Nomor unit ${idToDelete} berhasil dihapus dari registrasi.`
    });
  };

  // Egy Operations
  const handleAddNewEgy = () => {
    const clean = cleanEgyName(newEgyName).toUpperCase().trim();
    if (!clean) {
      alert("Nama Egy tidak boleh kosong!");
      return;
    }
    const plan = parseFloat(newEgyPlan) || 10.0;

    setDraftPlans(prev => ({
      ...prev,
      [clean]: plan
    }));

    setNewEgyName("");
    setNewEgyPlan("10.0");
    setNewEgyDesc("");
    setIsAddEgyModalOpen(false);

    setFeedback({
      type: "success",
      message: `Kategori Egy ${clean} dengan target ${plan} L/Jam berhasil ditambahkan!`
    });
  };

  const handleDeleteEgy = (egy: string) => {
    const unitsInThis = unitsByEgy[egy] || [];
    const unitCount = unitsInThis.length;
    
    if (window.confirm(`Hapus kategori Egy "${egy}"? ${unitCount > 0 ? `${unitCount} nomor unit yang terdaftar akan dipindahkan ke kategori SUPPORT.` : ''}`)) {
      setDraftPlans(prev => {
        const next = { ...prev };
        delete next[egy];
        return next;
      });

      if (unitCount > 0) {
        setDraftUnits(prev => {
          const next = { ...prev };
          unitsInThis.forEach(u => {
            if (next[u.idAlat]) {
              next[u.idAlat] = {
                ...next[u.idAlat],
                egy: "SUPPORT"
              };
            }
          });
          return next;
        });
      }

      setFeedback({
        type: "info",
        message: `Kategori Egy ${egy} berhasil dihapus.`
      });
    }
  };

  // Main Save to Cloud Firestore and Local State
  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      // 1. Save Egy Plans
      await onSaveEgyPlans(draftPlans);
      await saveEgyPlansToFirestore(draftPlans);

      // 2. Save Unit Registry
      await onSaveUnitRegistry(draftUnits);
      await saveUnitRegistryToFirestore(draftUnits);

      setFeedback({
        type: "success",
        message: "Seluruh Target Plan Fuel Burn dan Registrasi Nomor Unit berhasil disimpan dan disinkronkan ke Cloud Firestore!"
      });
    } catch (err) {
      console.error("Save error:", err);
      setFeedback({
        type: "error",
        message: "Terjadi kendala saat menyimpan ke Cloud. Data telah tersimpan secara lokal."
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    try {
      // Sheet 1: Target Plan per Egy
      const egyRows = Object.entries(draftPlans).map(([egy, plan]) => ({
        "Nama Egy": egy,
        "Target Plan Fuel Burn (Liter/Jam)": plan,
        "Jumlah Unit Terdaftar": (unitsByEgy[egy] || []).length,
        "Deskripsi Armada": EGY_CATEGORIES_INFO[egy]?.desc || "Peralatan Operasional Tambang",
        "Standar Model Fleet": EGY_CATEGORIES_INFO[egy]?.standardFleet || "-"
      }));

      // Sheet 2: Daftar Nomor Unit
      const unitRows = (Object.values(draftUnits) as UnitPlanConfig[]).map((u, idx) => ({
        "No": idx + 1,
        "Nomor Unit (ID Alat)": u.idAlat,
        "Nama Egy": u.egy,
        "Tipe / Model Alat": u.typeAlat || "-",
        "Target Plan Fuel Burn (L/Jam)": u.planFuelBurn || draftPlans[u.egy] || 10.0,
        "Status Plan": u.planFuelBurn ? "Override Khusus Unit" : "Standar Kategori Egy"
      }));

      const wb = XLSX.utils.book_new();
      const wsEgy = XLSX.utils.json_to_sheet(egyRows);
      const wsUnits = XLSX.utils.json_to_sheet(unitRows);

      XLSX.utils.book_append_sheet(wb, wsEgy, "Target Plan Egy");
      XLSX.utils.book_append_sheet(wb, wsUnits, "Daftar Nomor Unit");

      const fileName = `PT_WBS_Plan_Fuel_Burn_Master_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      setFeedback({
        type: "success",
        message: `File master plan berhasil diekspor: ${fileName}`
      });
    } catch (err) {
      console.error("Export error:", err);
      setFeedback({
        type: "error",
        message: "Gagal mengekspor data ke file Excel."
      });
    }
  };

  // Import from Excel file
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });

        let importedEgyCount = 0;
        let importedUnitCount = 0;

        const updatedPlans = { ...draftPlans };
        const updatedUnits = { ...draftUnits };

        // Process sheet 1 or any sheet with Egy data
        wb.SheetNames.forEach(sheetName => {
          const ws = wb.Sheets[sheetName];
          const rawJson: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

          rawJson.forEach(row => {
            // Check for Egy & Plan
            const egyKey = (row["Nama Egy"] || row["EGY"] || row["Jenis Egy"] || row["Kategori"] || "").toString().trim().toUpperCase();
            const planVal = parseFloat(row["Target Plan Fuel Burn (Liter/Jam)"] || row["Plan"] || row["PLAN"] || row["Target Plan"] || row["Fuel Burn Plan"]);

            if (egyKey && !isNaN(planVal) && planVal > 0) {
              updatedPlans[cleanEgyName(egyKey)] = planVal;
              importedEgyCount++;
            }

            // Check for Unit
            const unitId = (row["Nomor Unit (ID Alat)"] || row["Nomor Unit"] || row["ID Alat"] || row["Equipment"] || row["Unit"] || "").toString().trim().toUpperCase();
            const unitEgy = (row["Nama Egy"] || row["EGY"] || row["Jenis Egy"] || row["Type"] || egyKey || "SUPPORT").toString().trim().toUpperCase();
            const unitType = (row["Tipe / Model Alat"] || row["Type Alat"] || row["Model"] || "").toString().trim();
            const unitCustomPlan = parseFloat(row["Target Plan Fuel Burn (L/Jam)"] || row["Custom Plan"]);

            if (unitId) {
              updatedUnits[unitId] = {
                idAlat: unitId,
                egy: cleanEgyName(unitEgy) || "SUPPORT",
                typeAlat: unitType || unitEgy,
                planFuelBurn: (!isNaN(unitCustomPlan) && unitCustomPlan > 0) ? unitCustomPlan : undefined
              };
              importedUnitCount++;
            }
          });
        });

        setDraftPlans(updatedPlans);
        setDraftUnits(updatedUnits);

        setFeedback({
          type: "success",
          message: `Berhasil mengimpor data dari Excel! ${importedEgyCount} target Egy & ${importedUnitCount} nomor unit terbarui.`
        });
      } catch (err) {
        console.error("Import error:", err);
        setFeedback({
          type: "error",
          message: "Format file Excel tidak sesuai. Pastikan terdapat kolom Nama Egy atau Nomor Unit."
        });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      
      {/* HEADER SECTION */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/20">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  INPUT PLAN FUEL BURN
                </h1>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => setIsAddEgyModalOpen(true)}
              className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer border border-slate-200"
              title="Tambah Kategori Egy Baru"
            >
              <FolderPlus className="w-4 h-4 text-indigo-600" />
              <span>+ Nama Egy</span>
            </button>

            <button
              onClick={() => handleOpenAddUnit()}
              className="flex items-center gap-2 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3.5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer border border-indigo-200"
              title="Tambah Nomor Unit Baru ke Egy"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>+ Nomor Unit</span>
            </button>

            <label className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer border border-slate-200">
              <Upload className="w-4 h-4 text-slate-600" />
              <span>Impor Excel</span>
              <input type="file" accept=".xlsx, .xls, .csv" onChange={handleImportExcel} className="hidden" />
            </label>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3.5 py-2.5 rounded-xl transition active:scale-95 cursor-pointer border border-slate-200"
              title="Unduh seluruh data Plan & Nomor Unit ke Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor Excel</span>
            </button>

            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="flex items-center gap-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-4 py-2.5 rounded-xl shadow-sm shadow-emerald-600/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alert Toast */}
        {feedback && (
          <div className={`mt-4 p-3 rounded-xl flex items-center gap-3 text-xs font-semibold animate-fade-in ${
            feedback.type === "success" 
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
              : feedback.type === "error" 
                ? "bg-rose-50 text-rose-800 border border-rose-200"
                : "bg-blue-50 text-blue-800 border border-blue-200"
          }`}>
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : feedback.type === "error" ? (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
            )}
            <span className="flex-1">{feedback.message}</span>
          </div>
        )}
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Kategori Egy</div>
            <div className="text-xl font-black text-slate-800">{totalEgys} <span className="text-xs font-semibold text-slate-400">Jenis</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-black">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Nomor Unit Terdaftar</div>
            <div className="text-xl font-black text-slate-800">{totalUnits} <span className="text-xs font-semibold text-slate-400">Unit</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 font-black">
            <Fuel className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rerata Target Plan</div>
            <div className="text-xl font-black text-slate-800">{avgPlanBurn} <span className="text-xs font-semibold text-slate-400">L/Jam</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-black">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sinkronisasi Cloud</div>
            <div className="text-xs font-bold text-emerald-600 flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Firestore Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* CONTROLS & FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Search & Filter */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari Nama Egy atau Nomor Unit (misal: FD 23001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedEgyFilter}
              onChange={(e) => setSelectedEgyFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
            >
              <option value="SEMUA">Semua Kategori Egy ({totalEgys})</option>
              {Object.keys(draftPlans).sort().map(egy => (
                <option key={egy} value={egy}>{egy} ({(unitsByEgy[egy] || []).length} Unit)</option>
              ))}
            </select>
          </div>
        </div>

        {/* View Switcher */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {/* View Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "card"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kartu Egy</span>
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white text-indigo-700 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Daftar Unit ({filteredUnitsList.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: KARTU PER KATEGORI EGY */}
      {viewMode === "card" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEgys.map(egy => {
            const planValue = draftPlans[egy] || 0;
            const units = unitsByEgy[egy] || [];
            const info = EGY_CATEGORIES_INFO[egy];
            const isStandard = DEFAULT_EGY_PLANS[egy] !== undefined;

            return (
              <div
                key={egy}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Top Header */}
                <div className="p-5 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        <h3 className="text-base font-black text-slate-900 tracking-tight">
                          {egy}
                        </h3>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1">
                        {info?.desc || "Armada Operasional Penunjang"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-extrabold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80">
                        {units.length} Unit
                      </span>
                      {!isStandard && (
                        <button
                          onClick={() => handleDeleteEgy(egy)}
                          className="text-slate-400 hover:text-rose-600 p-1 transition"
                          title="Hapus Kategori Egy Kustom"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Target Plan Fuel Burn Input Control */}
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-extrabold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Fuel className="w-3.5 h-3.5 text-amber-500" />
                        <span>TARGET PLAN FUEL BURN</span>
                      </span>
                      <span className="text-slate-400 font-semibold">Liter / Jam</span>
                    </div>

                    <div>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={planValue}
                        onChange={(e) => handleEgyPlanChange(egy, e.target.value)}
                        placeholder="0.0"
                        className="w-full bg-white border border-slate-200 font-black text-center text-slate-900 text-xl py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Registered Unit Numbers Section */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span className="flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-indigo-500" />
                        <span>Daftar Nomor Unit:</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleOpenAddUnit(egy)}
                        className="text-indigo-600 hover:text-indigo-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Tambah</span>
                      </button>
                    </div>

                    {/* Unit Badges / Pills */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                      {units.length > 0 ? (
                        units.map(u => (
                          <div
                            key={u.idAlat}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-200 text-slate-800 text-[11px] font-bold transition shadow-2xs"
                          >
                            <span 
                              onClick={() => handleOpenEditUnit(u)}
                              className="cursor-pointer hover:text-indigo-700 select-none"
                              title={`Klik untuk edit unit ${u.idAlat} (${u.typeAlat || egy})`}
                            >
                              {u.idAlat}
                            </span>
                            {u.planFuelBurn && (
                              <span className="text-[9px] font-extrabold text-amber-700 bg-amber-100 px-1 py-0.2 rounded" title={`Custom plan: ${u.planFuelBurn} L/J`}>
                                {u.planFuelBurn}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeleteUnit(u.idAlat);
                              }}
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-100 p-0.5 rounded transition cursor-pointer flex items-center justify-center ml-0.5"
                              title={`Hapus unit ${u.idAlat}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-[11px] text-slate-400 italic py-2 text-center w-full">
                          Belum ada nomor unit terdaftar di Egy ini.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Fleet Model Info */}
                <div className="bg-slate-50/80 border-t border-slate-100 px-5 py-2.5 flex items-center justify-between text-xs text-slate-500">
                  <span className="text-[11px] text-slate-400">
                    Model Armada: <strong className="text-slate-600 font-semibold">{info?.standardFleet?.split(",")[0] || egy}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW MODE 2: TABEL LENGKAP SEMUA UNIT */}
      {viewMode === "table" && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="font-extrabold text-slate-700">
              Total {filteredUnitsList.length} Nomor Unit Terdaftar
            </div>
            <button
              onClick={() => handleOpenAddUnit()}
              className="flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Unit Baru</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-extrabold border-b border-slate-200">
                  <th className="py-3 px-4 w-12 text-center">No</th>
                  <th className="py-3 px-4">Nomor Unit (ID Alat)</th>
                  <th className="py-3 px-4">Nama Egy</th>
                  <th className="py-3 px-4">Tipe / Model Alat</th>
                  <th className="py-3 px-4 text-center">Target Plan (L/Jam)</th>
                  <th className="py-3 px-4 text-center">Tipe Plan</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredUnitsList.length > 0 ? (
                  filteredUnitsList.map((u, idx) => {
                    const egyPlan = draftPlans[u.egy] || 10.0;
                    const effectivePlan = u.planFuelBurn || egyPlan;
                    const isCustom = u.planFuelBurn !== undefined && u.planFuelBurn > 0;

                    return (
                      <tr key={u.idAlat} className="hover:bg-indigo-50/30 transition">
                        <td className="py-2.5 px-4 text-center text-slate-400 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 px-4 font-black text-slate-900">
                          {u.idAlat}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                            {u.egy}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {u.typeAlat || "-"}
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          <span className="font-extrabold text-slate-900 text-sm">
                            {effectivePlan.toFixed(1)}
                          </span>
                          <span className="text-[10px] text-slate-400 ml-1">L/Jam</span>
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {isCustom ? (
                            <span className="text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              Override Unit
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500">
                              Mengikuti Egy ({egyPlan.toFixed(1)})
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditUnit(u);
                              }}
                              className="text-indigo-600 hover:text-indigo-800 p-1.5 hover:bg-indigo-50 rounded-md transition cursor-pointer"
                              title={`Edit Unit ${u.idAlat}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeleteUnit(u.idAlat);
                              }}
                              className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-md transition cursor-pointer"
                              title={`Hapus Unit ${u.idAlat}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 italic">
                      Tidak ada nomor unit yang sesuai dengan kriteria pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOTTOM FLOATING SAVE BAR */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">
              Konfigurasi Master Plan Siap Disinkronkan
            </div>
            <div className="text-[11px] text-slate-400">
              Perubahan akan otomatis diterapkan ke perhitungan Monthly Review, Pareto, dan Yearly Review.
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="text-xs text-slate-300 hover:text-white font-bold px-3 py-2 rounded-xl transition"
            >
              Kembali ke Dashboard
            </button>
          )}
          <button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="flex items-center gap-2 text-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black px-5 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 transition active:scale-95 cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menyimpan ke Cloud...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Target Plan & Unit</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* MODAL 1: TAMBAH KATEGORI EGY BARU */}
      {isAddEgyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-indigo-600" />
                <span>Tambah Nama Egy Baru</span>
              </h3>
              <button 
                onClick={() => setIsAddEgyModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Nama Egy / Kategori Alat:
                </label>
                <input
                  type="text"
                  placeholder="Contoh: TRAILER HEAVY, WATER PUMP..."
                  value={newEgyName}
                  onChange={(e) => setNewEgyName(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Target Plan Fuel Burn (Liter/Jam):
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  placeholder="Contoh: 12.5"
                  value={newEgyPlan}
                  onChange={(e) => setNewEgyPlan(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAddEgyModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                onClick={handleAddNewEgy}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95"
              >
                Tambahkan Egy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: TAMBAH NOMOR UNIT (SINGLE ATAU BATCH) */}
      {isAddUnitModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>Tambah Nomor Unit</span>
              </h3>
              <button 
                onClick={() => setIsAddUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Pilih Kategori Egy:
                </label>
                <select
                  value={unitFormEgy}
                  onChange={(e) => setUnitFormEgy(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                >
                  {Object.keys(draftPlans).sort().map(egy => (
                    <option key={egy} value={egy}>{egy} (Plan: {draftPlans[egy]} L/Jam)</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Nomor Unit (Bisa Input Banyak Sekaligus):
                </label>
                <textarea
                  rows={3}
                  placeholder="Contoh satu unit: FD 23001&#10;Atau multi unit: FD 23001, FD 23002, FD 23003..."
                  value={unitFormInput}
                  onChange={(e) => setUnitFormInput(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  *Gunakan tanda koma (,), spasi, atau baris baru untuk memasukkan beberapa unit sekaligus.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Tipe / Model Alat (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Misal: Hino 500 FM260JD"
                    value={unitFormType}
                    onChange={(e) => setUnitFormType(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="font-extrabold text-slate-700 block mb-1">
                    Custom Plan L/Jam (Opsional):
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Default (${draftPlans[unitFormEgy] || 10.0})`}
                    value={unitFormCustomPlan}
                    onChange={(e) => setUnitFormCustomPlan(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setIsAddUnitModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                Batal
              </button>
              <button
                onClick={handleSaveNewUnit}
                className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95"
              >
                Simpan Nomor Unit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT NOMOR UNIT */}
      {isEditUnitModalOpen && editingUnit && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <span>Edit Nomor Unit: {editingUnit.idAlat}</span>
              </h3>
              <button 
                onClick={() => setIsEditUnitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1"
              >
                ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Nomor Unit (ID Alat):
                </label>
                <input
                  type="text"
                  value={unitFormInput}
                  onChange={(e) => setUnitFormInput(e.target.value.toUpperCase())}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-slate-900 focus:bg-white uppercase"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Kategori Egy:
                </label>
                <select
                  value={unitFormEgy}
                  onChange={(e) => setUnitFormEgy(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                >
                  {Object.keys(draftPlans).sort().map(egy => (
                    <option key={egy} value={egy}>{egy}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Tipe / Model Alat:
                </label>
                <input
                  type="text"
                  value={unitFormType}
                  onChange={(e) => setUnitFormType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Custom Target Plan Fuel Burn (L/Jam):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder={`Default Egy (${draftPlans[unitFormEgy] || 10.0})`}
                    value={unitFormCustomPlan}
                    onChange={(e) => setUnitFormCustomPlan(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:bg-white"
                  />
                  {unitFormCustomPlan && (
                    <button
                      onClick={() => setUnitFormCustomPlan("")}
                      className="text-xs text-slate-500 hover:text-slate-700 whitespace-nowrap"
                      title="Kembalikan ke plan Egy standar"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={handleDeleteFromEditModal}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Unit Ini</span>
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditUnitModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveEditUnit}
                  className="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition active:scale-95"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
