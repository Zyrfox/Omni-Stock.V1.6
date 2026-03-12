/**
 * OMNI-STOCK — Gemini AI Engine
 * Server-side only. Section 19 PRD.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI() {
  if (!genAI) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  return genAI;
}

export interface AIPredictionInput {
  namaBahan: string;
  stokAkhir: number;
  satuanDapur: string;
  stokMinimum: number;
  leadTimeDays: number;
  avgDailyConsumption: number;
  tipeBahan: "packaged" | "raw_bulk";
  // raw_bulk only
  namaMenu?: string;
  estimasiYield?: number;
}

export interface AIPredictionOutput {
  aiNotes: string;
  qtyRekomendasi: number;
  estimasiHargaPasar?: number; // raw_bulk only
}

/**
 * Generate AI prediction notes for a stock item.
 * Status color is calculated server-side (not by AI).
 */
export async function generateAIPrediction(
  input: AIPredictionInput
): Promise<AIPredictionOutput> {
  const {
    namaBahan,
    stokAkhir,
    satuanDapur,
    stokMinimum,
    leadTimeDays,
    avgDailyConsumption,
    tipeBahan,
    namaMenu,
    estimasiYield,
  } = input;

  const hariHabis =
    avgDailyConsumption > 0 ? Math.floor(stokAkhir / avgDailyConsumption) : 999;
  const qtyRekomendasi = Math.ceil(
    avgDailyConsumption * (leadTimeDays + 5) - stokAkhir + stokMinimum
  );
  const qtyRek = Math.max(0, qtyRekomendasi);

  let prompt: string;

  if (tipeBahan === "packaged") {
    prompt = `Kamu adalah asisten manajemen stok untuk bisnis F&B. Berikan rekomendasi restock dalam Bahasa Indonesia, singkat dan actionable (2-3 kalimat).

Data bahan: ${namaBahan}
Stok saat ini: ${stokAkhir} ${satuanDapur}
Konsumsi rata-rata: ${avgDailyConsumption} ${satuanDapur}/hari
Lead time: ${leadTimeDays} hari
Stok minimum: ${stokMinimum} ${satuanDapur}
Estimasi stok habis: ${hariHabis} hari
Rekomendasi order: ${qtyRek} ${satuanDapur}

Berikan narasi yang mengandung kata "habis dalam" dan "BUAT PO" jika stok kritis, atau "order sekarang" jika warning, atau "aman" jika safe.`;
  } else {
    prompt = `Kamu adalah asisten manajemen stok untuk bisnis F&B. Berikan rekomendasi restock bahan baku dalam Bahasa Indonesia, singkat dan actionable (3-4 kalimat).

Data bahan: ${namaBahan} (bahan baku segar/curah)
Stok saat ini: ${stokAkhir} ${satuanDapur}
Konsumsi rata-rata: ${avgDailyConsumption} ${satuanDapur}/hari
Lead time: ${leadTimeDays} hari
Stok minimum: ${stokMinimum} ${satuanDapur}
Estimasi stok habis: ${hariHabis} hari
Rekomendasi order: ${qtyRek} ${satuanDapur}
${namaMenu ? `Digunakan untuk: ${namaMenu}` : ""}
${estimasiYield ? `Estimasi yield: ${estimasiYield} porsi` : ""}

Sertakan estimasi harga pasar dalam format "Rp [angka]/kg" dan estimasi yield jika ada. Gunakan kata "habis dalam" dan "BUAT PO" jika kritis.`;
  }

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const aiNotes = result.response.text().trim();

    // Try to extract estimated market price from raw_bulk notes
    let estimasiHargaPasar: number | undefined;
    if (tipeBahan === "raw_bulk") {
      const priceMatch = aiNotes.match(/Rp\s*([\d.,]+)\s*\/kg/i);
      if (priceMatch) {
        estimasiHargaPasar = parseFloat(priceMatch[1].replace(/\./g, "").replace(",", "."));
      }
    }

    return { aiNotes, qtyRekomendasi: qtyRek, estimasiHargaPasar };
  } catch {
    // Fallback if Gemini API fails
    const fallback =
      tipeBahan === "packaged"
        ? `Stok ${namaBahan} saat ini ${stokAkhir} ${satuanDapur}, akan habis dalam ${hariHabis} hari. Rekomendasi order ${qtyRek} ${satuanDapur} untuk buffer 5 hari. BUAT PO segera.`
        : `Stok ${namaBahan} saat ini ${stokAkhir} ${satuanDapur}, habis dalam ${hariHabis} hari. Order ${qtyRek} ${satuanDapur} untuk buffer 5 hari ke depan. BUAT PO segera.`;
    return { aiNotes: fallback, qtyRekomendasi: qtyRek };
  }
}
