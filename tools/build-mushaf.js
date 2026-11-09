/* ===========================================================
   build-mushaf.js — extracts the ayat of the ranges the game uses from the
   King Fahd Complex data (KFGQPC) into mushaf.js, for each riwaya.

   Run:  node tools/build-mushaf.js
   Input:  _source/QaloonData_v10.json, _source/hafsData_v18.json
           (KFGQPC Uthmanic data — Qaloon v10, Hafs v18)
   Output: mushaf.js  →  const MUSHAF = { q:{...}, h:{...} }

   The ayah text is copied exactly as it is in the source. The only things
   removed are the trailing ayah number (the game shows the reference
   itself) and the juz/hizb sign ۞ (which would give away the ayah's position).
   =========================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* Juz in the game: 25–30. Juz 25 starts inside Fussilat (41), so the whole
   surah is included (its earlier ayat are marked juz 24): they serve as
   context and wrong options, and get no cards of their own.
   Lower this when more sections leave "soon". */
const FIRST_SURA = 41;

const SOURCES = {
  q: { file: 'QaloonData_v10.json', sura: 'sura_no', name: 'sura_name_ar', label: 'رواية قالون عن نافع', ver: 'KFGQPC Qaloon v10' },
  h: { file: 'hafsData_v18.json',   sura: 'sora', name: 'sora_name_ar', label: 'رواية حفص عن عاصم', ver: 'KFGQPC Hafs v18' }
};

const read = f => JSON.parse(fs.readFileSync(path.join(ROOT, '_source', f), 'utf8').replace(/^﻿/, ''));
const clean = t => t
  .replace(/[\s ]*[٠-٩]+\s*$/, '')   // trailing ayah number
  .replace(/۞[\s ]*/g, '')                // ۞ juz/hizb sign
  .replace(/ /g, ' ')
  .replace(/\s+/g, ' ')
  .trim();
const plainName = n => n.replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/^سورة\s*/, '').trim();

const out = {};
for (const [k, src] of Object.entries(SOURCES)) {
  const rows = read(src.file);
  const suras = {};
  let count = 0;
  for (const r of rows) {
    const s = +r[src.sura];
    if (s < FIRST_SURA) continue;
    if (!suras[s]) suras[s] = { n: plainName(r[src.name]), j: [], a: [] };
    if (r.aya_no !== suras[s].a.length + 1) throw new Error(`${k} ${s}: ayah ${r.aya_no} out of order`);
    const t = clean(r.aya_text);
    if (!t) throw new Error(`${k} ${s}:${r.aya_no}: empty text`);
    suras[s].a.push(t);
    suras[s].j.push(+r.jozz);             // juz of each ayah: juz 25 and 27 start mid-surah
    count++;
  }
  out[k] = { label: src.label, ver: src.ver, suras };
  console.log(`${k}: ${Object.keys(suras).length} surahs, ${count} ayat`);
}

const banner = `/* ===========================================================
   نصّ المصحف — مُولَّد آلياً من بيانات مجمع الملك فهد لطباعة المصحف الشريف
   (${SOURCES.q.ver} · ${SOURCES.h.ver}) بالأداة tools/build-mushaf.js
   لا تعدّل هذا الملف يدوياً: أعِد توليده من المصدر.
   q رواية قالون عن نافع | h رواية حفص عن عاصم
   suras[رقم السورة] = { n الاسم, j [جزء كل آية], a [نصّ الآيات بالترتيب] }
   =========================================================== */
`;
fs.writeFileSync(path.join(ROOT, 'mushaf.js'), banner + 'const MUSHAF = ' + JSON.stringify(out) + ';\n');
console.log('wrote mushaf.js', (fs.statSync(path.join(ROOT, 'mushaf.js')).size / 1024).toFixed(0) + ' KB');
