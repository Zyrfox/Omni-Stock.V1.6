"use server";

import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function callClaude(prompt: string, maxTokens = 400): Promise<string> {
  const anthropic = getClient();
  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return (msg.content[0] as { type: string; text: string }).text.trim();
}

function parseJSON(raw: string): Record<string, unknown> {
  const clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  return JSON.parse(clean);
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
 * Estimasi yield + harga pasar bahan raw_bulk — powered by Claude.
 * Dipanggil dari AI Research panel di modal Tambah/Edit Bahan.
 */
export async function estimateRawBulkYield(
  namaBahan: string,
  isiSatuan: number,
  satuanDapur: string
): Promise<RawBulkEstimationResult> {
  const isiKg = satuanDapur.toLowerCase() === "gram" ? isiSatuan / 1000 : isiSatuan;

  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli manajemen bahan baku restoran.

Bahan: "${namaBahan}"
Ukuran kemasan: ${isiSatuan} ${satuanDapur}${satuanDapur.toLowerCase() === "gram" ? ` (≈ ${isiKg.toFixed(1)} kg)` : ""}

Berikan estimasi dalam format JSON KETAT berikut (tanpa markdown):
{
  "harga_pasar_per_kg": <integer harga pasar bahan ini per kg dalam Rupiah>,
  "estimasi_gram_per_porsi": <integer berapa gram/ml bahan ini dipakai per 1 porsi masakan umum>,
  "nama_menu_contoh": "<satu nama menu Indonesia yang paling umum menggunakan bahan ini>",
  "narasi": "<1-2 kalimat Bahasa Indonesia tentang yield dan harga bahan ini>"
}`;

  try {
    const raw = await callClaude(prompt);
    const data = parseJSON(raw);

    const hargaPerKg = parseInt(String(data.harga_pasar_per_kg)) || null;
    const gramPerPorsi = parseInt(String(data.estimasi_gram_per_porsi)) || null;
    const porsiPerKemasan =
      gramPerPorsi && gramPerPorsi > 0 && isiSatuan > 0
        ? Math.floor(isiSatuan / gramPerPorsi)
        : null;

    return {
      hargaPasarPerKg: hargaPerKg,
      hargaPasarFormatted: hargaPerKg ? `Rp ${hargaPerKg.toLocaleString("id-ID")}/kg` : "—",
      estimasiPorsiPerKemasan: porsiPerKemasan,
      estimasiGramPerPorsi: gramPerPorsi,
      namaMenuContoh: String(data.nama_menu_contoh ?? ""),
      narasi: String(data.narasi ?? ""),
    };
  } catch (err: unknown) {
    const msg = String(err);
    const isAuth = msg.includes("401") || msg.includes("authentication_error") || msg.includes("invalid x-api-key");
    const isCredit = msg.includes("credit balance") || msg.includes("too low") || msg.includes("402");
    return {
      hargaPasarPerKg: null,
      hargaPasarFormatted: "Tidak tersedia",
      estimasiPorsiPerKemasan: null,
      estimasiGramPerPorsi: null,
      namaMenuContoh: "",
      narasi: isAuth ? "API key tidak valid — perbarui ANTHROPIC_API_KEY di .env.local" : isCredit ? "Kredit Anthropic habis — top up di console.anthropic.com/settings/billing" : "Estimasi AI tidak tersedia.",
      error: isAuth ? "API key tidak valid" : isCredit ? "Kredit habis — top up di console.anthropic.com/settings/billing" : msg,
    };
  }
}

export interface PorsiEstimationResult {
  porsiPerKemasan: number | null;
  hargaPerPorsi: number | null;
  narasi: string;
  error?: string;
}

/**
 * Estimasi jumlah porsi per kemasan — khusus untuk tab "Estimasi Porsi".
 * Tidak butuh isiSatuan dalam gram — cocok untuk bahan seperti es krim
 * yang tidak bisa diukur gram per sendok.
 */
export async function estimatePorsiSaja(
  namaBahan: string,
  satuanBeli: string,
  hargaBeli?: number
): Promise<PorsiEstimationResult> {
  const hargaInfo = hargaBeli && hargaBeli > 0
    ? `Harga beli: Rp ${hargaBeli.toLocaleString("id-ID")} per ${satuanBeli || "kemasan"}.`
    : "";

  const prompt = `Kamu adalah konsultan F&B Indonesia yang berpengalaman di operasional kafe dan restoran.

Bahan: "${namaBahan}"
Kemasan: 1 ${satuanBeli || "kemasan"}
${hargaInfo}

Berikan estimasi berapa porsi yang bisa dihasilkan dari 1 kemasan bahan ini untuk kebutuhan restoran/kafe.
Anggap porsi yang wajar untuk disajikan ke tamu (bukan porsi rumahan).

Jawab HANYA dalam format JSON (tanpa markdown):
{
  "porsi_per_kemasan": <integer estimasi jumlah porsi>,
  "narasi": "<1 kalimat Bahasa Indonesia yang menjelaskan estimasi ini>"
}`;

  try {
    const raw = await callClaude(prompt, 200);
    const data = parseJSON(raw);

    const porsi = parseInt(String(data.porsi_per_kemasan)) || null;
    const hargaPerPorsi = porsi && hargaBeli && porsi > 0
      ? Math.round(hargaBeli / porsi)
      : null;

    return {
      porsiPerKemasan: porsi,
      hargaPerPorsi,
      narasi: String(data.narasi ?? ""),
    };
  } catch (err: unknown) {
    const msg = String(err);
    const isAuth = msg.includes("401") || msg.includes("authentication_error") || msg.includes("invalid x-api-key");
    const isCredit = msg.includes("credit balance") || msg.includes("too low") || msg.includes("402");
    return {
      porsiPerKemasan: null,
      hargaPerPorsi: null,
      narasi: isAuth ? "API key tidak valid — perbarui ANTHROPIC_API_KEY di .env.local" : isCredit ? "Kredit Anthropic habis — top up di console.anthropic.com/settings/billing" : "Estimasi tidak tersedia.",
      error: isAuth ? "API key tidak valid" : isCredit ? "Kredit habis" : msg,
    };
  }
}
