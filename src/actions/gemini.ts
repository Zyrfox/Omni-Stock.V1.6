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
  // Strip markdown code fences
  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Try direct parse first
  try { return JSON.parse(clean); } catch { /* continue */ }
  // Extract outermost {...} if AI wraps JSON in extra text
  const match = clean.match(/\{[\s\S]*\}/);
  if (match) return JSON.parse(match[0]);
  throw new Error("No valid JSON found in AI response");
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
  satuanDapur: string,
  context?: { penggunaan?: string; skalaPorsi?: string }
): Promise<RawBulkEstimationResult> {
  const isiKg = satuanDapur.toLowerCase() === "gram" ? isiSatuan / 1000 : isiSatuan;
  const ctxNote = context?.penggunaan || context?.skalaPorsi
    ? `\nKonteks: digunakan untuk ${context.penggunaan ?? "umum"}, skala porsi ${context.skalaPorsi ?? "restoran standar"}.`
    : "";

  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli manajemen bahan baku restoran.

Bahan: "${namaBahan}"
Ukuran kemasan: ${isiSatuan} ${satuanDapur}${satuanDapur.toLowerCase() === "gram" ? ` (≈ ${isiKg.toFixed(1)} kg)` : ""}${ctxNote}

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

export interface ProductionQuestion {
  id: string;
  question: string;
  type: "number" | "text";
  unit?: string;
  placeholder?: string;
}

export interface WizardEstimationResult {
  isiSatuan: number | null;
  satuanDapur: string;
  gramPerAlat: number | null;
  estimasiPorsiPerKemasan: number | null;
  hargaPerPorsi: number | null;
  narasi: string;
  error?: string;
}

export interface GenerateQuestionsResult {
  metode: string;
  questions: ProductionQuestion[];
}

/**
 * AI menganalisa nama bahan + kemasan lalu generate pertanyaan produksi spesifik.
 * Tidak perlu input alat ukur — AI menentukan sendiri berdasarkan karakteristik bahan.
 */
export async function generateProductionQuestions(
  namaBahan: string,
  satuanBeli: string,
  hargaBeli?: number
): Promise<GenerateQuestionsResult> {
  const hargaInfo = hargaBeli && hargaBeli > 0
    ? `Harga beli: Rp ${hargaBeli.toLocaleString("id-ID")} per ${satuanBeli}`
    : "";

  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli operasional dapur restoran.

Bahan: "${namaBahan}"
Kemasan: ${satuanBeli}
${hargaInfo}

Tugasmu:
1. Analisa karakteristik bahan "${namaBahan}" — jenis bahan, cara pakai, dan satuan lazim di dapur restoran Indonesia
2. Tentukan metode persiapan yang paling umum (seduh, goreng, takar, potong, dll)
3. Buat 3-5 pertanyaan SPESIFIK untuk menghitung berapa porsi sajian dari 1 kemasan

Panduan pertanyaan berdasarkan jenis bahan:
- Bahan DISEDUH/DIREBUS (teh, kopi, jahe, rempah, kaldu, bumbu sachet): tanya → berapa liter air per batch, berapa batch per kemasan, berapa gelas/cup per batch, berapa ml per gelas sajian
- Bahan PELAPIS/GORENG (tepung terigu, tepung bumbu, breadcrumb, maizena): tanya → berapa item yang bisa dilapisi per produksi, berapa kali produksi per kemasan
- Bahan CAIR DITUANG (minyak goreng, kecap, saus, santan): tanya → berapa ml/sdm per masakan, berapa masakan per kemasan
- Bahan TAKAR PADAT (gula, garam, bumbu, merica, rempah): tanya → berapa gram/sendok per porsi, berapa porsi per kemasan
- Bahan ES KRIM/DESSERT (es krim, gelato, sorbet): tanya → berat 1 scoop (gram), scoop per sajian
- Bahan SEGAR DIPOTONG (sayur, buah, daging, ayam): tanya → gram per sajian yang wajar di restoran
- Bahan MINUMAN (sirup, susu, creamer): tanya → ml per sajian, sajian per kemasan

Pertanyaan harus SINGKAT, menggunakan satuan konkret, dan relevan dengan cara kerja dapur.

Jawab HANYA dalam format JSON (tanpa markdown):
{
  "metode": "<1 kalimat singkat: metode persiapan yang AI asumsikan untuk bahan ini>",
  "questions": [
    {
      "id": "q1",
      "question": "<pertanyaan singkat dan spesifik dalam Bahasa Indonesia>",
      "type": "number",
      "unit": "<satuan: liter/gelas/item/gram/ml/kali/potong/sdm/scoop>",
      "placeholder": "<contoh angka yang wajar>"
    }
  ]
}`;

  try {
    const raw = await callClaude(prompt, 1200);
    const data = parseJSON(raw);
    const qs = (data.questions as ProductionQuestion[]) ?? [];
    if (qs.length === 0) throw new Error("AI returned empty questions array");
    return {
      metode: String(data.metode ?? ""),
      questions: qs.slice(0, 5),
    };
  } catch (err: unknown) {
    const msg = String(err);
    const isAuth = msg.includes("401") || msg.includes("authentication_error") || msg.includes("invalid x-api-key");
    const isCredit = msg.includes("credit balance") || msg.includes("too low") || msg.includes("402");
    const errorNote = isAuth ? "API key tidak valid" : isCredit ? "Kredit habis" : msg.slice(0, 120);
    return {
      metode: `[Error: ${errorNote}]`,
      questions: [
        { id: "q1", question: "Berapa kali pemakaian dari 1 kemasan?", type: "number", unit: "kali", placeholder: "10" },
        { id: "q2", question: "Berapa porsi yang dihasilkan per pemakaian?", type: "number", unit: "porsi", placeholder: "5" },
      ],
    };
  }
}

/**
 * Hitung yield & harga per porsi dari jawaban pertanyaan produksi yang sudah dijawab user.
 */
export async function estimateFromWizardAnswers(
  namaBahan: string,
  hargaBeli: number,
  satuanBeli: string,
  alatUkur: string,
  questions: ProductionQuestion[],
  answers: Record<string, string>
): Promise<WizardEstimationResult> {
  const qaText = questions
    .map(q => `- ${q.question} → ${answers[q.id] ?? "?"} ${q.unit ?? ""}`)
    .join("\n");

  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli manajemen bahan baku restoran.

Bahan: "${namaBahan}"
Kemasan: ${satuanBeli}
Alat ukur staff: ${alatUkur}
Harga beli: Rp ${hargaBeli.toLocaleString("id-ID")}

Jawaban spesifikasi produksi dari operator dapur:
${qaText}

Dari data di atas, hitung:
1. Total estimasi porsi per kemasan (integer)
2. Satuan dapur yang paling tepat
3. Total yield dalam satuan dapur untuk 1 kemasan
4. Harga per porsi = Rp ${hargaBeli.toLocaleString("id-ID")} ÷ total_porsi

Jawab HANYA dalam format JSON (tanpa markdown):
{
  "satuan_dapur": "<gram/ml/gelas/porsi/pcs>",
  "gram_per_alat": <estimasi ukuran 1 alatUkur dalam satuan_dapur, atau null>,
  "isi_satuan_total": <total yield dalam satuan_dapur>,
  "estimasi_porsi_per_kemasan": <integer>,
  "harga_per_porsi": <integer>,
  "narasi": "<2-3 kalimat Bahasa Indonesia menjelaskan perhitungan step-by-step ini>"
}`;

  try {
    const raw = await callClaude(prompt, 400);
    const data = parseJSON(raw);
    const isiSatuan = parseFloat(String(data.isi_satuan_total)) || null;
    const porsi = parseInt(String(data.estimasi_porsi_per_kemasan)) || null;
    const hargaPerPorsi = parseInt(String(data.harga_per_porsi)) || null;
    return {
      isiSatuan,
      satuanDapur: String(data.satuan_dapur ?? "gram"),
      gramPerAlat: parseFloat(String(data.gram_per_alat)) || null,
      estimasiPorsiPerKemasan: porsi,
      hargaPerPorsi,
      narasi: String(data.narasi ?? ""),
    };
  } catch (err: unknown) {
    const msg = String(err);
    const isAuth = msg.includes("401") || msg.includes("authentication_error") || msg.includes("invalid x-api-key");
    const isCredit = msg.includes("credit balance") || msg.includes("too low") || msg.includes("402");
    return {
      isiSatuan: null, satuanDapur: "gram", gramPerAlat: null,
      estimasiPorsiPerKemasan: null, hargaPerPorsi: null,
      narasi: isAuth ? "API key tidak valid" : isCredit ? "Kredit Anthropic habis" : "Estimasi tidak tersedia.",
      error: msg,
    };
  }
}

/**
 * @deprecated Gunakan estimateFromWizardAnswers
 */
export async function estimateFromWizard(
  namaBahan: string,
  hargaBeli: number,
  satuanBeli: string,
  alatUkur: string,
  timesPerServing: number
): Promise<WizardEstimationResult> {
  const prompt = `Kamu adalah konsultan F&B Indonesia yang ahli operasional dapur restoran.

Bahan: "${namaBahan}"
Harga beli: Rp ${hargaBeli.toLocaleString("id-ID")} per ${satuanBeli || "kemasan"}
Alat ukur staff: "${alatUkur}"
Pemakaian per sajian: ${timesPerServing} kali ${alatUkur}

Tugasmu:
1. Estimasi berapa gram/ml/unit satu "${alatUkur}" berisi untuk bahan "${namaBahan}"
2. Estimasi total isi kemasan "${satuanBeli}" dalam satuan dapur yang sama
3. Hitung estimasi porsi: total_isi / (gram_per_alat × ${timesPerServing})
4. Hitung harga per porsi: Rp ${hargaBeli.toLocaleString("id-ID")} / estimasi_porsi

Jawab HANYA dalam format JSON (tanpa markdown):
{
  "satuan_dapur": "<gram/ml/pcs/buah>",
  "gram_per_alat": <number>,
  "isi_satuan_total": <number, total isi kemasan dalam satuan_dapur>,
  "estimasi_porsi_per_kemasan": <integer>,
  "harga_per_porsi": <integer>,
  "narasi": "<1-2 kalimat Bahasa Indonesia menjelaskan perhitungan ini>"
}`;

  try {
    const raw = await callClaude(prompt, 300);
    const data = parseJSON(raw);

    const isiSatuan = parseFloat(String(data.isi_satuan_total)) || null;
    const porsi = parseInt(String(data.estimasi_porsi_per_kemasan)) || null;
    const hargaPerPorsi = parseInt(String(data.harga_per_porsi)) || null;

    return {
      isiSatuan,
      satuanDapur: String(data.satuan_dapur ?? "gram"),
      gramPerAlat: parseFloat(String(data.gram_per_alat)) || null,
      estimasiPorsiPerKemasan: porsi,
      hargaPerPorsi,
      narasi: String(data.narasi ?? ""),
    };
  } catch (err: unknown) {
    const msg = String(err);
    const isAuth = msg.includes("401") || msg.includes("authentication_error") || msg.includes("invalid x-api-key");
    const isCredit = msg.includes("credit balance") || msg.includes("too low") || msg.includes("402");
    return {
      isiSatuan: null, satuanDapur: "gram", gramPerAlat: null,
      estimasiPorsiPerKemasan: null, hargaPerPorsi: null,
      narasi: isAuth ? "API key tidak valid" : isCredit ? "Kredit Anthropic habis" : "Estimasi tidak tersedia.",
      error: msg,
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
