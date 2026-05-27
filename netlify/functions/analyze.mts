import { GoogleGenAI } from '@google/genai';
import type { Config } from '@netlify/functions';

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY tidak dikonfigurasi' }, { status: 503 });
  }

  let body: { summary?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Request body tidak valid' }, { status: 400 });
  }

  const { summary } = body;
  if (!summary) {
    return Response.json({ error: 'Data summary diperlukan' }, { status: 400 });
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `Anda adalah analis data bahan bakar (BBM) untuk perusahaan pertambangan dengan alat berat.
Berikut adalah ringkasan data laporan konsumsi BBM yang telah diproses:

${JSON.stringify(summary, null, 2)}

Berikan analisis komprehensif dalam Bahasa Indonesia yang mencakup:
1. **Kondisi Umum**: Ringkasan kondisi konsumsi BBM secara keseluruhan
2. **Unit Kritis**: Identifikasi unit alat berat yang perlu perhatian segera berdasarkan data
3. **Analisis Pareto**: Interpretasi hasil analisis 80/20 dan implikasinya untuk manajemen biaya BBM
4. **Anomali**: Penjelasan anomali yang ditemukan dan kemungkinan penyebabnya
5. **Rekomendasi**: 3-5 rekomendasi actionable untuk optimasi konsumsi BBM dan pengurangan biaya

Berikan analisis yang ringkas, faktual, dan dapat ditindaklanjuti. Gunakan data numerik yang disediakan.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const analysis = response.candidates?.[0]?.content?.parts?.[0]?.text ?? 'Tidak ada hasil analisis.';
    return Response.json({ analysis });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: `Gemini API error: ${message}` }, { status: 502 });
  }
};

export const config: Config = {
  path: '/api/analyze',
};
