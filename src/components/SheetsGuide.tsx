import React, { useState } from "react";
import { Copy, Check, EyeOff, Table2, Flame, Award, Lightbulb, ChevronRight, Settings } from "lucide-react";

export default function SheetsGuide() {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const formulas = [
    {
      title: "1. Formula Dasar (Mitigasi Zero & Negatif)",
      desc: "Menghitung Fuel Burn (Liter/Jam) dengan mengamankan pembagian dari nilai nol (0) atau selisih HM yang terbalik (negatif).",
      syntax: "=IFERROR(IF((L2-K2)<=0; 0; N2/(L2-K2)); 0)",
      indonesian: "Fungsi IF memeriksa apakah selisih HM Saat Ini (L2) dikurangi HM Sebelumnya (K2) bernilai kurang dari atau sama dengan nol. Jika ya, output di-force ke 0 (menghindari hasil negatif/tak terhingga). Jika sehat, pembagian dijalankan. IFERROR menangkap error tak terduga.",
      accent: "=IF"
    },
    {
      title: "2. Formula Lanjutan dengan Label Anomali",
      desc: "Formula yang tidak hanya memitigasi, namun melabeli baris yang terindikasi anomali agar mudah difilter.",
      syntax: '=IF(L2-K2=0; "ANOMALI: 0 Jam"; IF(L2-K2<0; "ANOMALI: HM Mundur"; N2/(L2-K2)))',
      indonesian: "Formula bertingkat ini memberikan alasan spesifik langsung pada kolom jika terjadi error operasional, memudahkan tim audit lapangan.",
      accent: "=IF bertingkat"
    },
    {
      title: "3. Rumus Prosentase Kumulatif Pareto",
      desc: "Digunakan pada kolom bantu untuk menghitung garis kumulatif 100% pada grafik Pareto.",
      syntax: "=SUM($E$2:E2) / SUM($E$2:$E$25)",
      indonesian: "Gunakan formula ini pada baris data unit yang sudah diurutkan dari konsumsi tertinggi ke terendah. Mengunci sel awal dengan tanda $ membuat penjumlahan bertambah (running sum) baris demi baris, lalu dibagi total seluruh volume.",
      accent: "=SUM Running"
    }
  ];

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-md p-6 font-sans">
      <div className="pb-4 mb-6 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-[#4682B4]" />
          <h3 className="text-lg font-bold text-slate-850">
            Panduan Konsultan: Integrasi Formula & Desain Google Sheets
          </h3>
        </div>
        <p className="text-xs text-slate-550 mt-1">
          Dapatkan petunjuk langkah-demi-langkah dari Google Sheets Expert untuk mendesain lembar kerja Anda agar rapi, aman, dan memikat di hadapan manajemen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Formulas & Calculations */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-slate-800 font-bold text-sm bg-[#4682B4]/10 py-2 px-3 rounded-lg border border-[#4682B4]/20">
            <Flame className="w-4.5 h-4.5 text-[#4682B4]" />
            Formula & Mitigasi Error Formula (Bahasa Indonesia)
          </div>

          <div className="space-y-4">
            {formulas.map((item, index) => (
              <div key={index} className="border border-slate-200/65 rounded-xl p-4 bg-slate-50/30 hover:bg-slate-50/60 transition duration-200">
                <div className="font-bold text-slate-850 text-xs tracking-wide">
                  {item.title}
                </div>
                <p className="text-[11px] text-slate-550 mt-1">
                  {item.desc}
                </p>

                {/* Code Block syntax */}
                <div className="relative mt-3 flex items-center justify-between gap-2 bg-slate-900 text-slate-100 p-2.5 rounded-lg border border-slate-800 font-mono text-[11px] overflow-x-auto select-all">
                  <span className="text-emerald-400 select-all pr-8 leading-relaxed whitespace-pre-wrap">
                    {item.syntax}
                  </span>
                  <button
                    onClick={() => handleCopy(item.syntax, index)}
                    className="absolute right-2 top-1.5 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition"
                    title="Salin formula ke papan klip"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="mt-2.5 bg-sky-50/40 p-2 border border-sky-100/60 rounded text-[11.5px] text-slate-650 leading-relaxed flex gap-2 items-start">
                  <Lightbulb className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Penjelasan:</strong> {item.indonesian}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Checklist Pivot / Pareto */}
          <div className="bg-gradient-to-br from-indigo-50/60 to-slate-50/40 border border-indigo-100 p-4 rounded-xl">
            <h4 className="font-bold text-indigo-950 text-xs mb-2 flex items-center gap-1.5">
              <Table2 className="w-4 h-4 text-indigo-600" />
              Cara Membuat Pivot & Grafik Pareto di Sheets
            </h4>
            <ol className="list-decimal list-inside text-xs text-slate-650 space-y-2 leading-relaxed pl-1">
              <li>
                Pilih semua baris data di sheet <strong className="text-slate-800">"Issued"</strong> (G:W), lalu klik <strong className="font-medium text-slate-700">Sisipkan (Insert) &gt; Tabel Pivot</strong>.
              </li>
              <li>
                Buat Pivot dengan konfigurasi: <strong className="text-slate-800">Baris (Rows)</strong> = <span className="font-mono bg-white border px-1 rounded text-[11px]">ID Alat</span> dan <span className="font-mono bg-white border px-1 rounded text-[11px]">Type Alat</span>, sementara <strong className="text-slate-800">Nilai (Values)</strong> = Rata-rata <span className="font-mono bg-slate-100 px-1 rounded text-[11px]">Fuel Burn Rate</span> dan Jumlah <span className="font-mono bg-slate-105 px-1 rounded text-[11px]">Volume Fuel</span>.
              </li>
              <li>
                Urutkan Pivot berdasarkan rata-rata <strong className="text-slate-850">Fuel Burn Rate (Kecil ke Besar atau sebaliknya)</strong>.
              </li>
              <li>
                Tambahkan rumus <strong className="text-indigo-700">Kumulatif Pareto</strong> di kolom sebelahnya untuk memplot kurva kumulatif.
              </li>
              <li>
                Blok kolom Unit ID, Average Burn Rate, dan Kumulatif %, lalu pilih <strong className="font-medium text-slate-700">Sisipkan &gt; Diagram</strong>. Ubah Jenis Diagram menjadi <strong className="text-indigo-750">Diagram Kombo (Combo Chart)</strong>, set Burn Rate sebagai Batang (Bar) dan Kumulatif sebagai Garis (Line) di Sumbu Kanan.
              </li>
            </ol>
          </div>
        </div>

        {/* Right Column: UI/UX & Visual Designing Checklist */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm bg-indigo-50/50 py-2 px-3 rounded-lg border border-indigo-100">
            <Award className="w-4.5 h-4.5 text-indigo-600" />
            Langkah UI/UX Designer: Visualisasi Minimalis & Profesional
          </div>

          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 shadow-sm">
            {/* Guide Item 1 */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 border">1</div>
                <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <EyeOff className="w-4 h-4 text-rose-500" /> Sembunyikan Garis Kisi Bawaan (Gridlines)
                </div>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed pl-7">
                Garis kisi default abu-abu tebal membuat mata audiens cepat lelah dan berantakan. 
                <br />
                <strong className="text-slate-700">Caranya:</strong> Di Google Sheets, buka menu utama <span className="underline decoration-slate-350">Tampilan (View) &gt; Tampilkan (Show) &gt; Hapus centang pada Garis Kisi (Gridlines)</span>. Latar belakang sheet seketika bersih, memberi kebebasan tata letak.
              </p>
            </div>

            {/* Guide Item 2 */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 border">2</div>
                <div className="font-bold text-xs text-slate-800">Skema Palet Warna Korporat (Corporate Aura)</div>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed pl-7">
                Hindari penggunaan warna "murni" primer (such as solid red, bright green) yang melukai mata. Gunakan warna premium dengan intensitas redup:
              </p>
              <div className="pl-7 grid grid-cols-2 gap-2 text-[10px]">
                <div className="flex items-center gap-1.5 p-1 border rounded">
                  <div className="w-4 h-4 rounded bg-slate-800 shrink-0"></div>
                  <div>Header: Slate Dark</div>
                </div>
                <div className="flex items-center gap-1.5 p-1 border rounded">
                  <div className="w-4 h-4 rounded bg-blue-50 bg-sky-50 border border-blue-200 shrink-0"></div>
                  <div>Aksen: Soft Indigo Blue</div>
                </div>
                <div className="flex items-center gap-1.5 p-1 border rounded">
                  <div className="w-4 h-4 rounded bg-rose-50 border border-rose-200 shrink-0"></div>
                  <div>Alert: Light Soft Rose</div>
                </div>
                <div className="flex items-center gap-1.5 p-1 border rounded">
                  <div className="w-4 h-4 rounded bg-slate-50 shrink-0"></div>
                  <div>Body: Soft Frost White</div>
                </div>
              </div>
            </div>

            {/* Guide Item 3 */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 border">3</div>
                <div className="font-bold text-xs text-slate-800">Tipografi Menggunakan Roboto / Montserrat</div>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed pl-7">
                Ubah seluruh isi lembar kerja dari Arial/Calibri ke font san-serif modern. Pilih <strong className="text-slate-850">Roboto</strong> untuk kejelasan data numerik tinggi atau <strong className="text-slate-850">Montserrat</strong> untuk visual display utama. Perkecil ukuran huruf data detail menjadi 9pt - 10pt agar data padat tapi bernapas lega.
              </p>
            </div>

            {/* Guide Item 4 */}
            <div className="p-4 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-700 shrink-0 border">4</div>
                <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-rose-200 border border-rose-400 block shrink-0"></span> Format Bersyarat (Conditional Formatting)
                </div>
              </div>
              <p className="text-xs text-slate-550 leading-relaxed pl-7">
                Anomali harus melompat ke mata pembaca dalam waktu kurang dari 2 detik.
                <br />
                <strong className="text-slate-700">Caranya:</strong> Blok range kolom rata-rata fuel burn. Buka <span className="underline">Format &gt; Format Bersyarat</span>. Buat aturan:
                <ul className="list-disc leading-relaxed pl-4 text-slate-500 text-[11px] mt-1 space-y-0.5">
                  <li>Aturan 1: <code className="bg-slate-100 font-mono text-[10px] px-0.5 rounded text-rose-700">Sama dengan</code> = 0 &rarr; Format teks warna abu-abu / pudar (Mitigasi HM tidak jalan).</li>
                  <li>Aturan 2: <code className="bg-slate-100 font-mono text-[10px] px-0.5 rounded text-rose-700">Lebih besar dari</code> = 80 L/Jam (atau ambang batas unit Anda) &rarr; Beri warna isi <span className="bg-rose-100 text-rose-800 font-bold px-1 rounded text-[10px]">merah muda lembut</span>, BUKAN merah menyala, agar tidak merusak harmoni estetika halaman.</li>
                </ul>
              </p>
            </div>
          </div>

          {/* Expert Pro Tip for Layout Presentation */}
          <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 space-y-2 text-xs text-slate-650 leading-relaxed">
            <h5 className="font-bold text-emerald-850 flex items-center gap-1.5">
              <ChevronRight className="w-4 h-4 text-emerald-600 font-bold" /> Pro Tip Presentasi Direksi
            </h5>
            <p>
              Gunakan baris paling atas (Baris 1-4) khusus untuk Dashboard summary yang berisi card KPI berlatar belakang abu-abu terang dengan border putih tipis. Tempatkan raw data transaksional di sheet terpisah bernama <strong className="text-slate-800">"Data_Issued"</strong> lalu panggil rangkumannya ke sheet <strong className="text-slate-800">"Dashboard"</strong> menggunakan rumus dinamis `=AVERAGEIFS` atau `=SUMIFS`. Ini menyembunyikan tabel mentah berukuran besar dari pandangan para eksekutif saat presentasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
