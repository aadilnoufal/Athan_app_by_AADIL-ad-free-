/* ── Bismillah text constants for stripping from first ayah ──── */
export const BISMILLAH_AR = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';
export const BISMILLAH_AR_ALT = 'بِسۡمِ ٱللَّهِ ٱلرَّحۡمَـٰنِ ٱلرَّحِيمِ';
export const BISMILLAH_EN_PREFIX = 'In the name of Allah';

/**
 * Strip leading Bismillah from ayah 1 text for surahs 2-113 (except 9).
 * The API includes it in the text but we render a separate styled banner.
 *
 * @param knownBismillah The exact bismillah text from the same API edition
 *   (surah 1, ayah 1). This is the most reliable way to strip it.
 */
export function stripBismillah(text: string, knownBismillah?: string): string {
    // ── 1. Best: use the API's own bismillah text (guaranteed match) ──
    if (knownBismillah) {
        const trimmed = knownBismillah.trim();
        if (text.startsWith(trimmed)) {
            const rest = text.slice(trimmed.length).trim();
            if (rest.length > 0) return rest;
        }
        // Tolerate trailing punctuation / whitespace differences
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const prefixRe = new RegExp('^' + escaped + '[.\\s,;:\\-!]*\\s*');
        const km = text.match(prefixRe);
        if (km) {
            const rest = text.slice(km[0].length).trim();
            if (rest.length > 0) return rest;
        }
    }

    // ── 2. Fallback: hardcoded Arabic patterns (tatweel-tolerant) ──
    const noTatweel = (s: string) => s.replace(/\u0640/g, '');
    const normText = noTatweel(text);
    for (const prefix of [BISMILLAH_AR, BISMILLAH_AR_ALT]) {
        const normPrefix = noTatweel(prefix);
        if (normText.startsWith(normPrefix)) {
            return normText.slice(normPrefix.length).trim();
        }
    }

    // ── 3. Fallback: English patterns ──
    if (text.toLowerCase().startsWith(BISMILLAH_EN_PREFIX.toLowerCase())) {
        const patterns = [
            /^In the name of Allah[,.]?\s*the\s*(Most\s*)?Gracious[,.]?\s*the\s*(Most\s*)?Merciful[.\s-]*/i,
            /^In the name of Allah[,.]?\s*the\s*Entirely\s*Merciful[,.]?\s*the\s*Especially\s*Merciful[.\s-]*/i,
            /^In the name of God[,.]?\s*the\s*Gracious[,.]?\s*the\s*Merciful[.\s-]*/i,
            /^In the name of Allah[,.]?\s*the\s*Beneficent[,.]?\s*the\s*Merciful[.\s-]*/i,
            /^In\s*\(the\)\s*name of Allah[,.]?\s*the\s*Beneficent[,.]?\s*the\s*Merciful[.\s-]*/i,
        ];
        for (const re of patterns) {
            const m = text.match(re);
            if (m) return text.slice(m[0].length).trim();
        }
    }

    // ── 4. Last resort: fuzzy Arabic strip up to ٱلرَّحِيمِ ──
    const rhmNorm = noTatweel('ٱلرَّحِيمِ');
    const rhmIdx = normText.indexOf(rhmNorm);
    if (rhmIdx !== -1 && rhmIdx < 60) {
        return normText.slice(rhmIdx + rhmNorm.length).trim();
    }

    return text;
}

/**
 * Format byte count into human-readable string.
 */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
