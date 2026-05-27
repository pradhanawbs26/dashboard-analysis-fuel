import { Droplets, Timer, TrendingUp, AlertTriangle, Award } from 'lucide-react';
import { AnalyticsResult } from '../types';
import { formatNumber } from '../utils/analytics';

interface MetricsCardsProps {
  analytics: AnalyticsResult;
}

export default function MetricsCards({ analytics }: MetricsCardsProps) {
  const cards = [
    {
      label: 'Total Pemakaian BBM',
      value: formatNumber(analytics.totalFuel, 0),
      unit: 'Liter',
      icon: Droplets,
      color: 'bg-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-700',
    },
    {
      label: 'Total HM Operasi',
      value: formatNumber(analytics.totalHM, 0),
      unit: 'Jam',
      icon: Timer,
      color: 'bg-emerald-600',
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
    },
    {
      label: 'Rata-rata Fuel Ratio',
      value: formatNumber(analytics.avgFuelRatio, 2),
      unit: 'L/HM',
      icon: TrendingUp,
      color: 'bg-amber-500',
      bg: 'bg-amber-50',
      text: 'text-amber-700',
    },
    {
      label: 'Jumlah Anomali',
      value: String(analytics.anomalies.length),
      unit: `dari ${analytics.recordCount} data`,
      icon: AlertTriangle,
      color: analytics.anomalies.length > 0 ? 'bg-red-600' : 'bg-slate-500',
      bg: analytics.anomalies.length > 0 ? 'bg-red-50' : 'bg-slate-50',
      text: analytics.anomalies.length > 0 ? 'text-red-700' : 'text-slate-600',
    },
    {
      label: 'Unit Terboros',
      value: analytics.topConsumer?.namaUnit ?? '-',
      unit: analytics.topConsumer
        ? `${formatNumber(analytics.topConsumer.totalFuel, 0)} L total`
        : '',
      icon: Award,
      color: 'bg-purple-600',
      bg: 'bg-purple-50',
      text: 'text-purple-700',
      isText: true,
    },
    {
      label: 'Jumlah Unit Dianalisis',
      value: String(analytics.unitCount),
      unit: `unit · ${analytics.recordCount} record`,
      icon: Droplets,
      color: 'bg-indigo-600',
      bg: 'bg-indigo-50',
      text: 'text-indigo-700',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`${card.bg} rounded-2xl p-4 border border-white shadow-sm`}>
            <div className={`inline-flex ${card.color} text-white p-2 rounded-xl mb-3`}>
              <Icon className="w-4 h-4" />
            </div>
            <p className="text-slate-500 text-xs font-medium leading-tight mb-1">{card.label}</p>
            <p className={`font-bold text-lg leading-tight ${card.text} ${card.isText ? 'text-sm' : ''} truncate`}>
              {card.value}
            </p>
            {card.unit && <p className="text-slate-400 text-xs mt-0.5">{card.unit}</p>}
          </div>
        );
      })}
    </div>
  );
}
