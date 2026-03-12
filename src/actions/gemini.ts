"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI: GoogleGenerativeAI | null = null;
function getGenAI() {
  if (!genAI) genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI;
}

export interface RawBulkEstimationResult {
  hargaPasarPerKg: number | null;
  hargaPasarFormatted: string;
  estimasiPorsiPerKemasan: number | null;
  estimasiGramPerPorsi: number | null;
  namaMenuContoh: string;
  narasi: string;
  error?: string;
}

/**
 * Estimasi yield dan harga pasar untuk bahan raw_bulk.
 * Dipanggil dari modal "Tambah Bahan" di Products page.
 *
 * @param namaBahan   - Nama bahan (e.g. "Beras")
 * @param isiSatuan   - Isi kemasan dalam satuan dapur (e.g. 50000 = 50.000 gram)
 * @param satuanDapur - Satuan dapur (e.g. "gram")
 */
export async function estimateRawBulkYield(
  namaBahan: string,
  isiSatuan: number,
  satuanDapur: string
): Promise<RawBulkEstimationResult> {
  const isiKg = satuanDapur.toLowerCase() === "gram" ? isiSatuan / 1000 : isiSatuan;

  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli manajemen bahan baku.

Saya memiliki bahan: "${namaBahan}"
Ukuran kemasan: ${isiSatuan} ${satuanDapur} (≈ ${isiKg.toFixed(1)} kg jika satuan gram)

Berikan estimasi dalam format JSON yang KETAT berikut (tanpa markdown, tanpa komentar):
{
  "harga_pasar_per_kg": <angka integer harga pasar bahan ini per kg dalam Rupiah, tanpa titik atau koma>,
  "estimasi_gram_per_porsi": <berapa gram bahan ini dipakai per 1 porsi masakan umum berbahan ini>,
  "nama_menu_contoh": <satu nama menu Indonesia yang paling umum menggunakan bahan ini>,
  "narasi": <1-2 kalimat singkat dalam Bahasa Indonesia tentang yield dan harga bahan ini>
}

Contoh output untuk "Beras":
{
  "harga_pasar_per_kg": 15000,
  "estimasi_gram_per_porsi": 150,
  "nama_menu_contoh": "Nasi Putih",
  "narasi": "Beras kualitas medium saat ini berkisar Rp 15.000/kg. Per kemasan 50kg bisa menghasilkan sekitar 333 porsi nasi."
}`;

  try {
    const ai = getGenAI();
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();

    // Strip markdown code fences if present
    const jsonStr = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    const data = JSON.parse(jsonStr);

    const hargaPerKg = parseInt(data.harga_pasar_per_kg) || null;
    const gramPerPorsi = parseInt(data.estimasi_gram_per_porsi) || null;
    const porsiPerKemasan =
      gramPerPorsi && gramPerPorsi > 0 && isiSatuan > 0
        ? Math.floor(isiSatuan / gramPerPorsi)
        : null;

    const hargaPasarFormatted = hargaPerKg
      ? `Rp ${hargaPerKg.toLocaleString("id-ID")}/kg`
      : "—";

    return {
      hargaPasarPerKg: hargaPerKg,
      hargaPasarFormatted,
      estimasiPorsiPerKemasan: porsiPerKemasan,
      estimasiGramPerPorsi: gramPerPorsi,
      namaMenuContoh: data.nama_menu_contoh ?? "",
      narasi: data.narasi ?? "",
    };
  } catch (err) {
    // Fallback: simple calculation without AI
    const fallbackGram = 150;
    const fallbackPorsi = isiSatuan > 0 ? Math.floor(isiSatuan / fallbackGram) : null;
    return {
      hargaPasarPerKg: null,
      hargaPasarFormatted: "Tidak tersedia",
      estimasiPorsiPerKemasan: fallbackPorsi,
      estimasiGramPerPorsi: fallbackGram,
      namaMenuContoh: "",
      narasi: `Estimasi: ${fallbackPorsi ?? "?"} porsi per kemasan (asumsi ${fallbackGram}${satuanDapur}/porsi). Harga pasar tidak tersedia.`,
      error: "Gemini API tidak tersedia, menggunakan estimasi default.",
    };
  }
}
