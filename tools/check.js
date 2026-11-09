/* ===========================================================
   check.js — validates the question bank for both riwayat.
   Run:  node tools/check.js            (add --samples to print a few cards)

   Fails (exit 1) when:
   - a {{…}} key in cards.js is missing or matches more than one ayah, in either riwaya;
   - a card has duplicate options, or fewer/more than four;
   - cards.js contains hand-typed Quran text ﴿…﴾ (it must come from mushaf.js);
   - an ayah in a generated card is not found verbatim in the mushaf data.
   =========================================================== */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const load = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

globalThis.QURAN_CHECK = [];
const MUSHAF = new Function(load('mushaf.js') + '; return MUSHAF;')();
const HAND   = new Function(load('cards.js') + '; return HAND;')();
const G = require(path.join(ROOT, 'gen.js'));

const errors = [];
if (/﴿/.test(load('cards.js').replace(/\/\*[\s\S]*?\*\//g, '')))
  errors.push('cards.js: نصّ قرآني مكتوب يدوياً بين ﴿﴾ — استعمل مفتاح {{…}}');

const JUZ = [29, 30];
const verbatim = {};
for (const rw of ['q', 'h']) {
  const set = new Set();
  Object.values(MUSHAF[rw].suras).forEach(s => s.a.forEach(t => set.add(t)));
  verbatim[rw] = set;
}

const summary = {};
for (const rw of ['q', 'h']) {
  const cards = G.buildBank(MUSHAF, rw, JUZ, HAND);
  const hand = cards.filter(c => c.id.startsWith('hand:')).length;
  summary[rw] = { all: cards.length, hand };
  cards.forEach(c => {
    if (c.a.length !== 4) errors.push(`${c.id}: ${c.a.length} خيارات`);
    if (new Set(c.a).size !== c.a.length) errors.push(`${c.id}: خيارات مكرّرة`);
    /* كل آية كاملة في سؤال توليدي أو خياراته يجب أن تكون بنصّها في المصحف */
    if (!c.id.startsWith('hand:') && c.k !== 'fill') {
      [c.q, ...c.a].join(' ').replace(/﴿([^﴾]*)﴾/g, (_, t) => {
        if (!verbatim[rw].has(t)) errors.push(`${c.id}: آية ليست بنصّها في المصحف: ${t.slice(0, 30)}`);
      });
    }
  });
  if (process.argv.includes('--samples')) {
    const kinds = [...new Set(cards.map(c => c.k))];
    kinds.forEach(k => {
      const list = cards.filter(c => c.k === k);
      const c = list[Math.floor(Math.random() * list.length)];
      console.log(`\n[${rw}] ${k}  (${list.length})\n  Q: ${c.q}\n  A: ${c.a.join(' | ')}\n  N: ${c.n}`.replace(/[]/g, '`'));
    });
  }
}
errors.push(...new Set(QURAN_CHECK));

console.log(`قالون: ${summary.q.all} بطاقة (${summary.q.hand} يدوية) · حفص: ${summary.h.all} بطاقة (${summary.h.hand} يدوية) · المكتوبة: ${HAND.length}`);
if (errors.length) {
  console.log('\nأخطاء (' + errors.length + '):\n- ' + errors.join('\n- '));
  process.exit(1);
}
console.log('لا أخطاء.');
