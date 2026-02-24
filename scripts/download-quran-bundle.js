#!/usr/bin/env node
/**
 * Download Quran bundle data (Arabic + English) from alquran.cloud API
 * and save as JSON files under assets/quran/ for app-bundled offline use.
 *
 * Outputs:
 *   assets/quran/surah_list.json   – metadata for all 114 surahs
 *   assets/quran/quran_ar.json     – full Arabic text (all 114 surahs)
 *   assets/quran/quran_en.json     – full English (Sahih International) text
 *
 * Usage:  node scripts/download-quran-bundle.js
 */

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.alquran.cloud/v1';
const OUT_DIR = path.resolve(__dirname, '..', 'assets', 'quran');

async function apiFetch(endpoint) {
    const url = `${BASE}${endpoint}`;
    console.log(`  Fetching ${url} ...`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const json = await res.json();
    if (json.code !== 200 || json.status !== 'OK') {
        throw new Error(`API error: ${json.status} – ${JSON.stringify(json.data).slice(0, 200)}`);
    }
    return json.data;
}

async function main() {
    fs.mkdirSync(OUT_DIR, { recursive: true });

    // 1. Surah list (lightweight metadata)
    console.log('[1/3] Downloading surah list …');
    const surahList = await apiFetch('/surah');
    const listPath = path.join(OUT_DIR, 'surah_list.json');
    fs.writeFileSync(listPath, JSON.stringify(surahList));
    console.log(`  → ${listPath} (${(fs.statSync(listPath).size / 1024).toFixed(1)} KB)`);

    // 2. Full Quran – Arabic (Uthmani)
    console.log('[2/3] Downloading full Quran (Arabic – quran-uthmani) …');
    const arData = await apiFetch('/quran/quran-uthmani');
    const arSurahs = arData.surahs;
    const arPath = path.join(OUT_DIR, 'quran_ar.json');
    fs.writeFileSync(arPath, JSON.stringify(arSurahs));
    console.log(`  → ${arPath} (${(fs.statSync(arPath).size / 1024).toFixed(1)} KB)`);

    // 3. Full Quran – English (Sahih International)
    console.log('[3/3] Downloading full Quran (English – en.sahih) …');
    const enData = await apiFetch('/quran/en.sahih');
    const enSurahs = enData.surahs;
    const enPath = path.join(OUT_DIR, 'quran_en.json');
    fs.writeFileSync(enPath, JSON.stringify(enSurahs));
    console.log(`  → ${enPath} (${(fs.statSync(enPath).size / 1024).toFixed(1)} KB)`);

    // Summary
    const totalKB = [listPath, arPath, enPath]
        .reduce((sum, p) => sum + fs.statSync(p).size, 0) / 1024;
    console.log(`\n✅  Done! Total bundle size: ${(totalKB / 1024).toFixed(2)} MB`);
}

main().catch(err => {
    console.error('❌  Failed:', err.message);
    process.exit(1);
});
