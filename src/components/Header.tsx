import { Fuel, Building2 } from 'lucide-react';

interface HeaderProps {
  hasData: boolean;
  onReset: () => void;
}

export default function Header({ hasData, onReset }: HeaderProps) {
  return (
    <header className="bg-blue-900 text-white shadow-lg sticky top-0 z-40">
      <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-amber-400 p-2 rounded-lg">
            <Fuel className="w-5 h-5 text-blue-900" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Dashboard Fuel Analysis</h1>
            <p className="text-blue-200 text-xs mt-0.5">PT. Wahana Bara Sentosa</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-blue-200 text-sm">
            <Building2 className="w-4 h-4" />
            <span>Sistem Analisis BBM Alat Berat</span>
          </div>
          {hasData && (
            <button
              onClick={onReset}
              className="text-xs bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors border border-blue-600"
            >
              Upload Ulang
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
