import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  Check, 
  ChevronDown, 
  Search, 
  CheckSquare, 
  Square, 
  Truck, 
  CalendarDays,
  ExternalLink
} from "lucide-react";
import { getCanonicalUnitId } from "../data/sampleData";

export interface UnitItem {
  idAlat: string;
  egy: string;
  typeAlat: string;
}

interface UnitSelectorDropdownProps {
  units: UnitItem[];
  selectedUnitIds: string[];
  onChangeSelectedUnitIds: (ids: string[]) => void;
  selectedEgy: string;
}

export default function UnitSelectorDropdown({
  units,
  selectedUnitIds,
  onChangeSelectedUnitIds,
  selectedEgy
}: UnitSelectorDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Canonical set of selected unit IDs (uppercase for reliable matching)
  const selectedSet = useMemo(() => {
    return new Set(selectedUnitIds.map(id => getCanonicalUnitId(id).toUpperCase()));
  }, [selectedUnitIds]);

  // Filtered unit list by search input
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return units;
    const q = searchQuery.toLowerCase().trim();
    return units.filter(u => 
      u.idAlat.toLowerCase().includes(q) || 
      u.egy.toLowerCase().includes(q) ||
      u.typeAlat.toLowerCase().includes(q)
    );
  }, [units, searchQuery]);

  const allAvailableCanonIds = useMemo(() => {
    return units.map(u => getCanonicalUnitId(u.idAlat).toUpperCase());
  }, [units]);

  const isAllSelected = units.length > 0 && allAvailableCanonIds.every(id => selectedSet.has(id));
  const isNoneSelected = selectedSet.size === 0;

  // Toggle single unit selection
  const handleToggleUnit = (unitId: string) => {
    const canon = getCanonicalUnitId(unitId).toUpperCase();
    const newSet = new Set(selectedSet);
    if (newSet.has(canon)) {
      newSet.delete(canon);
    } else {
      newSet.add(canon);
    }
    onChangeSelectedUnitIds(Array.from(newSet) as string[]);
  };

  // Select all units of current EGY
  const handleSelectAll = () => {
    onChangeSelectedUnitIds(allAvailableCanonIds);
  };

  // Deselect all
  const handleDeselectAll = () => {
    onChangeSelectedUnitIds([]);
  };

  // Button title label
  const buttonLabel = useMemo(() => {
    if (units.length === 0) return "Tidak ada unit";
    if (isAllSelected) return `Semua Unit (${units.length})`;
    if (isNoneSelected) return "Pilih Nomor Unit";
    return `${selectedSet.size} dari ${units.length} Unit`;
  }, [units.length, isAllSelected, isNoneSelected, selectedSet.size]);

  return (
    <div className="relative flex flex-col" ref={dropdownRef}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
        <Truck className="w-3 h-3 text-[#4682B4]" />
        <span>NOMOR UNIT</span>
      </label>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={units.length === 0}
        className={`text-xs border rounded px-2.5 py-1.5 bg-slate-50 mt-1 select-none w-full sm:w-56 focus:border-[#4682B4] focus:outline-none font-medium flex items-center justify-between text-left transition-all cursor-pointer shadow-2xs ${
          isOpen ? "border-[#4682B4] ring-2 ring-[#4682B4]/20" : "border-slate-300 hover:border-slate-400"
        } ${units.length === 0 ? "opacity-60 cursor-not-allowed" : "text-slate-700"}`}
        title="Klik untuk memilih nomor unit atau membuka rincian fuel burn harian"
      >
        <div className="flex items-center gap-1.5 truncate">
          <span className="truncate font-semibold">{buttonLabel}</span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#4682B4]" : ""}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-1.5 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-fade-in font-sans">
          
          {/* Popover Header & Quick Actions */}
          <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700">
                Pilih Unit ({selectedEgy === "SEMUA" ? "Semua Egy" : selectedEgy})
              </span>
              <span className="text-[10px] font-mono text-slate-500 bg-slate-200/70 px-1.5 py-0.5 rounded font-bold">
                {selectedSet.size}/{units.length}
              </span>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer border border-blue-200"
              >
                <CheckSquare className="w-3 h-3 text-blue-600" />
                <span>Pilih Semua</span>
              </button>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition flex items-center gap-1 cursor-pointer border border-slate-200"
              >
                <Square className="w-3 h-3 text-slate-400" />
                <span>Batal Semua</span>
              </button>
            </div>

            {/* Search Input (Shown when units > 4) */}
            {units.length > 4 && (
              <div className="relative mt-1.5">
                <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Cari ID unit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-7 pr-3 py-1 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-[#4682B4]"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* Unit List Checklist */}
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {filteredUnits.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                Tidak ada unit yang cocok dengan pencarian.
              </div>
            ) : (
              filteredUnits.map((u) => {
                const canon = getCanonicalUnitId(u.idAlat).toUpperCase();
                const isChecked = selectedSet.has(canon);

                return (
                  <div
                    key={u.idAlat}
                    className="flex items-center justify-between p-2.5 hover:bg-blue-50/40 transition group"
                  >
                    {/* Checkbox & Unit Info */}
                    <label 
                      className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0"
                      onClick={() => handleToggleUnit(u.idAlat)}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Handled by container click
                        className="w-4 h-4 rounded border-slate-300 text-[#4682B4] focus:ring-[#4682B4] cursor-pointer"
                      />
                      <div className="truncate min-w-0">
                        <span className="font-mono font-bold text-xs text-slate-800 group-hover:text-blue-700">
                          {u.idAlat}
                        </span>
                        {u.typeAlat && (
                          <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                            ({u.typeAlat})
                          </span>
                        )}
                      </div>
                    </label>
                  </div>
                );
              })
            )}
          </div>

          {/* Popover Footer Info */}
          <div className="p-2 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
            <span>Klik nama unit untuk melihat tabel fuel burn</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="font-bold text-slate-700 hover:text-slate-900 cursor-pointer"
            >
              Tutup
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
