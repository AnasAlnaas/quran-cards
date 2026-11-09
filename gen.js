/* ===========================================================
   بطاقات القرآن — توليد البطاقات من نصّ المصحف
   يعمل في المتصفح وفي node (أداة الفحص tools/check.js).

   كل نصّ قرآني في اللعبة يُنقل من MUSHAF (بيانات مجمع الملك فهد) — لا يُكتب يدوياً.
   البطاقات المكتوبة يدوياً (cards.js) تشير إلى الآية بمفتاح بحث، فيُستخرج نصّها
   من الرواية المختارة.

   شكل البطاقة: { id, k النوع, j الجزء, d المستوى (٠ سهل، ١ متوسط، ٢ صعب),
                 q السؤال, a الخيارات (الصحيحة أولاً), c:0, n ما يُعرض بعد الإجابة, g درجة الحديث }
   في النصوص: ﴿…﴾ آية بخط المصحف، و AY_OPEN…AY_CLOSE كلمات قرآنية بخط المصحف بلا أقواس.
   =========================================================== */
(function(root){
'use strict';

const AY_OPEN = '', AY_CLOSE = '';
const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
/* تمييز العدد: ٣–١٠ «آيات»، وما سواها «آية» */
const ayatN = n => toAr(n) + ' ' + (n % 100 >= 3 && n % 100 <= 10 ? 'آيات' : 'آية');

/* الحركات وعلامات الضبط والوقف: تُحذف عند المطابقة، ولا يُمسّ النصّ المعروض */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;
/* علامات الوقف وحدها، تُحذف من آخر الكلمة إن عُرضت الكلمة منفردة خياراً */
const STOPS = /[ۖ-ۜ۞۩]+$/;

/* هيكل الكلمة للمطابقة فقط: بلا حركات، وبلا ألفات (لاختلاف الرسم بالألف الخنجرية)،
   وصور الهمزة موحّدة. فـ«ٱلصَّمَدُ» و«اُ۬لصَّمَدُ» و«الصمد» سواء. */
function skel(w){
  return w.replace(MARKS, '')
    .replace(/[اٱأإآءٰ]/g, '')
    .replace(/ؤ/g, 'و').replace(/[ئىے]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, '');
}
/* كلمات الآية للعرض: علامة منفصلة (إن وُجدت) تلتصق بالكلمة قبلها */
function words(t){
  const out = [];
  t.split(' ').forEach(w => {
    if(!w) return;
    if(!skel(w) && out.length) out[out.length - 1] += w; else out.push(w);
  });
  return out;
}
const skelWords = t => words(t).map(skel).filter(Boolean);
const skelText  = t => skelWords(t).join(' ');

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const ay  = t => '﴿' + t + '﴾';
const qw  = t => AY_OPEN + t + AY_CLOSE;
const ref = (S, s, a) => `[${S[s].n}: ${toAr(a)}]`;

/* حدود الطول: الآيات الطويلة جداً لا تصلح سؤالاً ولا خياراً على الشاشة */
const MAX_Q_WORDS   = 28;
const MAX_OPT_WORDS = 22;

/* ================= التوليد ================= */
function buildBank(M, rw, juz, hand){
  const R = M[rw];
  if(!R) throw new Error('رواية غير معروفة: ' + rw);
  const S = R.suras;
  const all  = Object.keys(S).map(Number).sort((x, y) => x - y);
  const inJ  = all.filter(s => juz.includes(S[s].j));
  const out  = [];
  const otherRw = rw === 'q' ? 'h' : 'q';

  /* فهرس التكرار: الآية المكرّرة نصّاً (في كل البيانات المتاحة) لا يُسأل عن موضعها */
  const freq = {};
  all.forEach(s => S[s].a.forEach(t => { const k = skelText(t); freq[k] = (freq[k] || 0) + 1; }));
  const unique = t => freq[skelText(t)] === 1;
  const nW = t => skelWords(t).length;

  /* سور بديلة: الأقرب في المصحف أولاً، من الأجزاء المختارة */
  function nearSuras(s, count){
    const pool = inJ.filter(x => x !== s).sort((x, y) => Math.abs(x - s) - Math.abs(y - s) || Math.random() - .5);
    return shuffle(pool.slice(0, Math.max(count + 3, 6))).slice(0, count);
  }

  /* ——— ١) في أيّ سورة هذه الآية؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a;
    A.forEach((t, i) => {
      if(i === A.length - 1) return;                 // آخر آية لها نوعها الخاص
      if(!unique(t) || nW(t) < 3 || nW(t) > MAX_Q_WORDS) return;
      out.push({
        id: `sura:${rw}:${s}:${i+1}`, k: 'sura', j: S[s].j, d: i === 0 ? 0 : 1,
        q: 'في أيّ سورة هذه الآية؟ ' + ay(t),
        a: [s, ...nearSuras(s, 3)].map(x => 'سورة ' + S[x].n),
        n: ay(t) + ' ' + ref(S, s, i + 1)
      });
    });
  });

  /* ——— ٢) أيّ سورة تُختم بهذه الآية؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a, last = A.length;
    let t = A[last - 1], from = last;
    if(!unique(t) || nW(t) < 3){ t = A[last - 2] + ' ' + A[last - 1]; from = last - 1; }   // آيتان إن قصرت الأخيرة أو تكرّرت
    if(nW(t) > MAX_Q_WORDS) return;
    out.push({
      id: `end:${rw}:${s}`, k: 'end', j: S[s].j, d: 1,
      q: from === last ? 'أيّ سورة تُختم بهذه الآية؟ ' + ay(t)
                       : 'أيّ سورة تُختم بهاتين الآيتين؟ ' + ay(A[last - 2]) + ' ' + ay(A[last - 1]),
      a: [s, ...nearSuras(s, 3)].map(x => 'سورة ' + S[x].n),
      n: `خاتمة سورة ${S[s].n} ` + ref(S, s, last)
    });
  });

  /* ——— ٣) أكمل الآية: تُحجب الكلمة الأخيرة، والخيارات فواصل آيات حقيقية ——— */
  const endings = {};                                // صدر الآية ← نهاياتها الممكنة
  all.forEach(s => S[s].a.forEach(t => {
    const w = skelWords(t);
    if(w.length < 2) return;
    const head = w.slice(0, -1).join(' ');
    (endings[head] = endings[head] || new Set()).add(w[w.length - 1]);
  }));
  const lastWord = t => { const w = words(t); return w[w.length - 1].replace(STOPS, ''); };
  inJ.forEach(s => {
    const A = S[s].a;
    A.forEach((t, i) => {
      const W = words(t), sw = skelWords(t);
      if(sw.length < 4 || sw.length > MAX_Q_WORDS) return;
      if(endings[sw.slice(0, -1).join(' ')].size !== 1) return;   // صدرٌ له أكثر من تمام
      const right = lastWord(t), rk = skel(right);
      /* بدائل: فواصل السورة نفسها أولاً (على الوزن نفسه غالباً)، ثم ما جاورها */
      const seen = new Set([rk]), alts = [];
      const take = list => shuffle(list).forEach(x => {
        const k = skel(x);
        if(alts.length < 3 && k && !seen.has(k)){ seen.add(k); alts.push(x); }
      });
      take(A.filter((_, j) => j !== i).map(lastWord));
      if(alts.length < 3) nearSuras(s, 4).forEach(x => take(S[x].a.map(lastWord)));
      if(alts.length < 3) return;
      const head = W.slice(0, -1).join(' ');
      out.push({
        id: `fill:${rw}:${s}:${i+1}`, k: 'fill', j: S[s].j, d: s >= 93 ? 0 : 1,
        q: 'أكمل الآية: ' + ay(head + ' …'),
        a: [right, ...alts].map(qw),
        n: ay(t) + ' ' + ref(S, s, i + 1)
      });
    });
  });

  /* ——— ٤) ما الآية التي قبلها؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a;
    if(A.length < 4) return;
    A.forEach((t, i) => {
      if(i === 0) return;
      const prev = A[i - 1];
      if(!unique(t) || !unique(prev) || nW(t) < 2 || nW(t) > MAX_Q_WORDS || nW(prev) > MAX_OPT_WORDS) return;
      /* البدائل من السورة نفسها: ما بعدها، وما قبل السابقة، ثم غيرها */
      const near = [i + 1, i - 2, i + 2, i - 3].filter(j => j >= 0 && j < A.length && j !== i);
      const rest = shuffle(A.map((_, j) => j).filter(j => j !== i && j !== i - 1 && !near.includes(j)));
      const alts = [], seen = new Set([skelText(prev), skelText(t)]);
      [...near, ...rest].forEach(j => {
        const x = A[j], k = skelText(x);
        if(alts.length < 3 && !seen.has(k) && nW(x) <= MAX_OPT_WORDS){ seen.add(k); alts.push(x); }
      });
      if(alts.length < 3) return;
      out.push({
        id: `prev:${rw}:${s}:${i+1}`, k: 'prev', j: S[s].j, d: 2,
        q: 'ما الآية التي قبل قوله تعالى: ' + ay(t),
        a: [prev, ...alts].map(ay),
        n: ay(prev) + ' ' + ay(t) + ' ' + `[${S[s].n}: ${toAr(i)}–${toAr(i + 1)}]`
      });
    });
  });

  /* ——— ٥) ترتيب المصحف: ما السورة التي تلي…؟ ——— */
  inJ.forEach(s => {
    const nx = s + 1;
    if(!S[nx]) return;
    const pool = all.filter(x => x !== nx && x !== s);
    const alts = shuffle(pool.sort((x, y) => Math.abs(x - s) - Math.abs(y - s)).slice(0, 5)).slice(0, 3);
    out.push({
      id: `next:${rw}:${s}`, k: 'next', j: S[s].j, d: 0,
      q: `ما السورة التي تلي سورة ${S[s].n} في ترتيب المصحف؟`,
      a: [nx, ...alts].map(x => 'سورة ' + S[x].n),
      n: `بعد سورة ${S[s].n} (${toAr(s)}) سورةُ ${S[nx].n} (${toAr(nx)}).`
    });
  });

  /* ——— ٦) عدد الآيات في الرواية المختارة ——— */
  inJ.forEach(s => {
    const n = S[s].a.length;
    if(n < 4) return;
    const cand = shuffle([n - 2, n - 1, n + 1, n + 2].filter(x => x > 2)).slice(0, 3);
    const O = M[otherRw] && M[otherRw].suras[s];
    const diff = O && O.a.length !== n;
    out.push({
      id: `count:${rw}:${s}`, k: 'count', j: S[s].j, d: 2,
      q: `كم عدد آيات سورة ${S[s].n} في ${R.label}؟`,
      a: [n, ...cand].map(toAr),
      n: `سورة ${S[s].n}: ${ayatN(n)} في ${R.label}` +
         (diff ? `، و${ayatN(O.a.length)} في ${M[otherRw].label} — لاختلاف عدّ الآي.` : '، وكذلك في ' + M[otherRw].label + '.')
    });
  });

  /* ——— ٧) البطاقات المكتوبة يدوياً ——— */
  (hand || []).forEach((h, x) => {
    const c = resolveHand(M, rw, h, x);
    if(c && juz.includes(c.j)) out.push(c);
  });

  return out;
}

/* ================= البطاقات اليدوية =================
   {{مفتاح}} أو {{رقم السورة|مفتاح}}: يُبحث عن الكلمات في الرواية المختارة،
   فتحلّ محلّه ﴿الكلمات بنصّها من المصحف﴾، ويُقدَّم نصّ الآية كاملةً ومرجعها في n.
   r: 'q' أو 'h' لبطاقة تخصّ رواية واحدة. key: {q:'…', h:'…'} إن اختلف اللفظ بين الروايتين. */
function findWords(S, key, sura){
  const want = key.split(/\s+/).map(skel).filter(Boolean);
  const list = sura ? [sura] : Object.keys(S).map(Number);
  const hits = [];
  list.forEach(s => {
    if(!S[s]) return;
    S[s].a.forEach((t, i) => {
      const W = words(t), K = W.map(skel);
      for(let p = 0; p + want.length <= K.length; p++){
        if(want.every((w, q) => K[p + q] === w)){
          hits.push({ s, a: i + 1, t, text: W.slice(p, p + want.length).join(' ').replace(STOPS, '') });
          break;
        }
      }
    });
  });
  return hits;
}

function resolveHand(M, rw, h, x){
  if(h.r && h.r !== rw) return null;
  const S = M[rw].suras;
  let firstHit = null, err = null;
  const sub = s => s.replace(/\{\{([^}]+)\}\}/g, (_, spec) => {
    let raw = spec, sura = null;
    const bar = spec.indexOf('|');
    if(bar > 0){ sura = +spec.slice(0, bar); raw = spec.slice(bar + 1); }
    /* مفتاح خاص بكل رواية: {{78|q=…;h=…}} */
    if(/^[qh]=/.test(raw)){
      const m = {}; raw.split(';').forEach(p => { const [k, v] = p.split('='); m[k.trim()] = v; });
      raw = m[rw] || '';
    }
    const hits = findWords(S, raw, sura);
    if(hits.length !== 1){ err = `${hits.length ? 'أكثر من موضع' : 'لم يوجد'}: «${raw}» (${rw})`; return '…'; }
    if(!firstHit) firstHit = hits[0];
    return ay(hits[0].text);
  });
  const q = sub(h.q);
  const a = h.a.map(sub);
  const note = sub(h.n || '');
  if(err){ if(root.QURAN_CHECK) root.QURAN_CHECK.push(`بطاقة ${x + 1}: ${err}`); return null; }
  const s = firstHit ? firstHit.s : h.s;
  const j = s ? S[s].j : h.j;
  if(!j){ if(root.QURAN_CHECK) root.QURAN_CHECK.push(`بطاقة ${x + 1}: لا جزء لها`); return null; }
  /* الآية كاملةً ومرجعها أول التعليق — إن كانت في السؤال (لا إن ذُكرت في التعليق وحده) */
  const lead = firstHit && /\{\{/.test(h.q + h.a.join('')) ? ay(firstHit.t) + ' ' + ref(S, firstHit.s, firstHit.a) : '';
  return {
    id: `hand:${rw}:${x}:${h.q.slice(0, 24)}`, k: h.k || 'hand', j, d: h.d,
    q, a, g: h.g,
    n: [lead, note].filter(Boolean).join(' — ')
  };
}

/* ================= البنك بالشكل الذي ينتظره المحرّك ================= */
function toTiers(cards){
  const B = { easy: [], medium: [], hard: [] };
  cards.forEach(c => B[['easy', 'medium', 'hard'][c.d]].push({ ...c, c: 0 }));
  return B;
}

const API = { buildBank, toTiers, skel, words, findWords, AY_OPEN, AY_CLOSE };
if(typeof module !== 'undefined' && module.exports) module.exports = API;
else root.QGEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
