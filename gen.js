/* ===========================================================
   بطاقات القرآن — توليد البطاقات من نصّ المصحف
   يعمل في المتصفح وفي node (أداة الفحص tools/check.js).

   كل نصّ قرآني في اللعبة يُنقل من MUSHAF (بيانات مجمع الملك فهد) — لا يُكتب يدوياً.
   البطاقات المكتوبة يدوياً (cards.js) تشير إلى الآية بمفتاح بحث، فيُستخرج نصّها
   من الرواية المختارة.

   شكل البطاقة: { id, k النوع, m بطاقة حفظ؟, j الجزء, d المستوى (٠ سهل، ١ متوسط، ٢ صعب),
                 q السؤال, a الخيارات (الصحيحة أولاً), c:0, n ما يُعرض بعد الإجابة, g درجة الحديث }
   في النصوص: ﴿…﴾ آية بخط المصحف، و AY_OPEN…AY_CLOSE كلمات قرآنية بخط المصحف بلا أقواس.

   الأجزاء تُحسب لكل آية (الجزء ٢٥ يبدأ في وسط فصّلت، و٢٧ في وسط الذاريات):
   تُولَّد بطاقة الآية إن كانت الآية نفسها في جزء مختار.
   =========================================================== */
(function(root){
'use strict';

const AY_OPEN = '', AY_CLOSE = '';
const toAr = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
/* تمييز العدد: ٣–١٠ «آيات»، وما سواها «آية» */
const ayatN = n => toAr(n) + ' ' + (n % 100 >= 3 && n % 100 <= 10 ? 'آيات' : 'آية');

/* بطاقات الحفظ تغلب في الجولة (نحو ثلاثة من كل أربعة)، وبطاقات المعرفة أقلّ */
const MEMO = new Set(['sura', 'end', 'fill', 'prev', 'after', 'begin', 'similar', 'words']);
/* جزء عمّ: لا «أكمل الآية» ولا «الكلمات التالية» */
const NO_FILL_JUZ = new Set([30]);

/* الحركات وعلامات الضبط والوقف: تُحذف عند المطابقة، ولا يُمسّ النصّ المعروض */
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g;
/* علامات الوقف وحدها، تُحذف من آخر الكلمة إن عُرضت الكلمة منفردة خياراً */
const STOPS = /[ۖ-ۜ۞۩]+$/;

/* هيكل الكلمة للمطابقة فقط: بلا حركات، وبلا ألفات (لاختلاف الرسم بالألف الخنجرية)،
   وصور الهمزة موحّدة. فـ«ٱلصَّمَدُ» و«اُ۬لصَّمَدُ» و«الصمد» سواء. */
/* النتائج تُحفظ: الكلمة الواحدة تُطابَق آلاف المرّات أثناء التوليد */
const memo = fn => { const m = new Map(); return x => { let r = m.get(x); if(r === undefined){ r = fn(x); m.set(x, r); } return r; }; };
const skel = memo(w => w.replace(MARKS, '')
    .replace(/[اٱأإآءٰ]/g, '')
    .replace(/ؤ/g, 'و').replace(/[ئىے]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^ء-ي]/g, ''));
/* كلمات الآية للعرض: علامة منفصلة (إن وُجدت) تلتصق بالكلمة قبلها.
   المصفوفة المحفوظة لا تُعدَّل: من يحتاج جزءاً منها يأخذه بـslice */
const words = memo(t => {
  const out = [];
  t.split(' ').forEach(w => {
    if(!w) return;
    if(!skel(w) && out.length) out[out.length - 1] += w; else out.push(w);
  });
  return out;
});
const skelWords = memo(t => words(t).map(skel).filter(Boolean));
const skelText  = memo(t => skelWords(t).join(' '));

const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
const ay  = t => '﴿' + t + '﴾';
const qw  = t => AY_OPEN + t + AY_CLOSE;
const ref = (S, s, a) => `[${S[s].n}: ${toAr(a)}]`;
const cut = W => W.join(' ').replace(STOPS, '');

/* حدود الطول: الآيات الطويلة جداً لا تصلح سؤالاً ولا خياراً على الشاشة */
const MAX_Q_WORDS   = 28;
const MAX_OPT_WORDS = 22;

/* المسافة بين آيتين بالكلمات (عدد الكلمات المضافة أو المحذوفة أو المبدّلة) */
function wordDist(a, b, limit){
  if(Math.abs(a.length - b.length) > limit) return limit + 1;
  let prev = Array.from({length: b.length + 1}, (_, j) => j);
  for(let i = 1; i <= a.length; i++){
    const cur = [i];
    let best = i;
    for(let j = 1; j <= b.length; j++){
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if(cur[j] < best) best = cur[j];
    }
    if(best > limit) return limit + 1;
    prev = cur;
  }
  return prev[b.length];
}

/* المتشابهات: لكل آية، الآيات القريبة منها لفظاً في سور أخرى (لا المطابقة تماماً).
   تُحسب مرة لكل رواية على كل البيانات، ثم تُحفظ. */
const twinCache = new Map();
function twinsFor(S){
  if(twinCache.has(S)) return twinCache.get(S);
  const list = [];
  Object.keys(S).map(Number).forEach(s => S[s].a.forEach((t, i) => {
    const w = skelWords(t);
    if(w.length >= 4 && w.length <= MAX_Q_WORDS) list.push({ s, i, w, key: w.join(' ') });
  }));
  /* فهرس الأزواج المتتالية من الكلمات، لتقليل المقارنات */
  const idx = new Map();
  list.forEach((x, n) => {
    const seen = new Set();
    for(let p = 0; p + 1 < x.w.length; p++){
      const bg = x.w[p] + ' ' + x.w[p + 1];
      if(seen.has(bg)) continue;
      seen.add(bg);
      if(!idx.has(bg)) idx.set(bg, []);
      idx.get(bg).push(n);
    }
  });
  const twins = new Map();               // "s:i" ← [{s, i}]
  list.forEach((x, n) => {
    const hits = new Map();
    for(let p = 0; p + 1 < x.w.length; p++){
      const l = idx.get(x.w[p] + ' ' + x.w[p + 1]);
      if(!l || l.length > 150) continue; // زوج شائع جداً («إن الله») لا يدلّ على تشابه
      l.forEach(m => { if(m !== n) hits.set(m, (hits.get(m) || 0) + 1); });
    }
    hits.forEach((cnt, m) => {
      const y = list[m];
      if(y.s === x.s || cnt < 2 || y.key === x.key) return;
      const limit = Math.min(3, Math.max(1, Math.floor(Math.min(x.w.length, y.w.length) / 3)));
      if(wordDist(x.w, y.w, limit) <= limit){
        const k = x.s + ':' + x.i;
        if(!twins.has(k)) twins.set(k, []);
        twins.get(k).push({ s: y.s, i: y.i });
      }
    });
  });
  twinCache.set(S, twins);
  return twins;
}

/* ================= التوليد ================= */
function buildBank(M, rw, juz, hand){
  const R = M[rw];
  if(!R) throw new Error('رواية غير معروفة: ' + rw);
  const S = R.suras;
  const J = new Set(juz);
  const all  = Object.keys(S).map(Number).sort((x, y) => x - y);
  const jOf  = (s, i) => S[s].j[i];
  const inA  = (s, i) => J.has(jOf(s, i));
  const inJ  = all.filter(s => S[s].j.some(j => J.has(j)));
  /* جزء البطاقة التي تخصّ السورة كلها: جزء أولها إن كان مختاراً، وإلا جزء آخرها */
  const sJ   = s => { const js = S[s].j; return J.has(js[0]) ? js[0] : J.has(js[js.length - 1]) ? js[js.length - 1] : js.find(j => J.has(j)); };
  const out  = [];
  const otherRw = rw === 'q' ? 'h' : 'q';
  const push = c => { c.m = MEMO.has(c.k); out.push(c); };

  /* فهرس التكرار: الآية المكرّرة نصّاً (في كل البيانات المتاحة) لا يُسأل عن موضعها */
  const freq = {};
  all.forEach(s => S[s].a.forEach(t => { const k = skelText(t); freq[k] = (freq[k] || 0) + 1; }));
  const unique = t => freq[skelText(t)] === 1;
  const nW = t => skelWords(t).length;

  /* سور بديلة: الأقرب في المصحف أولاً، من الأجزاء المختارة */
  function nearSuras(s, count, avoid){
    const pool = inJ.filter(x => x !== s && !(avoid || []).includes(x))
      .sort((x, y) => Math.abs(x - s) - Math.abs(y - s) || Math.random() - .5);
    return shuffle(pool.slice(0, Math.max(count + 3, 6))).slice(0, count);
  }
  /* بدائل من آيات السورة نفسها: القريبة أولاً ثم غيرها، بلا تكرار ولا طول زائد */
  function ayahAlts(A, order, avoidKeys){
    const alts = [], seen = new Set(avoidKeys);
    order.forEach(j => {
      if(j < 0 || j >= A.length) return;
      const x = A[j], k = skelText(x);
      if(alts.length < 3 && !seen.has(k) && nW(x) <= MAX_OPT_WORDS){ seen.add(k); alts.push(x); }
    });
    return alts;
  }
  const rest = (A, skip) => shuffle(A.map((_, j) => j).filter(j => !skip.includes(j)));

  /* ——— ١) المتشابهات: في أيّ سورة جاءت الآية بهذا اللفظ؟ ——— */
  const twins = twinsFor(S);
  const hasTwin = new Set();
  inJ.forEach(s => S[s].a.forEach((t, i) => {
    if(!inA(s, i) || !unique(t)) return;
    const tw = (twins.get(s + ':' + i) || []).filter(x => x.s !== s);
    if(!tw.length) return;
    hasTwin.add(s + ':' + i);
    const twinSuras = [...new Set(tw.map(x => x.s))].slice(0, 2);
    const first = tw[0];
    push({
      id: `similar:${rw}:${s}:${i+1}`, k: 'similar', j: jOf(s, i), d: 2,
      q: 'في أيّ سورة جاءت الآية بهذا اللفظ؟ ' + ay(t),
      a: [s, ...twinSuras, ...nearSuras(s, 3 - twinSuras.length, twinSuras)].map(x => 'سورة ' + S[x].n),
      n: ay(t) + ' ' + ref(S, s, i + 1) + ' — وتشبهها: ' + ay(S[first.s].a[first.i]) + ' ' + ref(S, first.s, first.i + 1)
    });
  }));

  /* ——— ٢) في أيّ سورة هذه الآية؟ (ما لم تكن لها شبيهة: فتلك في المتشابهات) ——— */
  inJ.forEach(s => {
    const A = S[s].a;
    A.forEach((t, i) => {
      if(!inA(s, i) || i === A.length - 1 || hasTwin.has(s + ':' + i)) return;
      if(!unique(t) || nW(t) < 3 || nW(t) > MAX_Q_WORDS) return;
      push({
        id: `sura:${rw}:${s}:${i+1}`, k: 'sura', j: jOf(s, i), d: i === 0 ? 0 : 1,
        q: 'في أيّ سورة هذه الآية؟ ' + ay(t),
        a: [s, ...nearSuras(s, 3)].map(x => 'سورة ' + S[x].n),
        n: ay(t) + ' ' + ref(S, s, i + 1)
      });
    });
  });

  /* ——— ٣) أيّ سورة تُختم بهذه الآية؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a, last = A.length;
    if(!inA(s, last - 1)) return;
    let t = A[last - 1], two = false;
    if(!unique(t) || nW(t) < 3){ t = A[last - 2] + ' ' + A[last - 1]; two = true; }   // آيتان إن قصرت الأخيرة أو تكرّرت
    if(nW(t) > MAX_Q_WORDS) return;
    push({
      id: `end:${rw}:${s}`, k: 'end', j: jOf(s, last - 1), d: 1,
      q: two ? 'أيّ سورة تُختم بهاتين الآيتين؟ ' + ay(A[last - 2]) + ' ' + ay(A[last - 1])
             : 'أيّ سورة تُختم بهذه الآية؟ ' + ay(t),
      a: [s, ...nearSuras(s, 3)].map(x => 'سورة ' + S[x].n),
      n: `خاتمة سورة ${S[s].n} ` + ref(S, s, last)
    });
  });

  /* ——— ٤) بمَ تبدأ سورة كذا؟ — مطلعها: من الآيات ما يكفي لتمييزه عن مطالع السور الأخرى ——— */
  const openKey = (x, k) => S[x].a.slice(0, k).map(skelText).join(' | ');
  const openLen = s => {
    for(let k = 1; k <= Math.min(4, S[s].a.length); k++){
      const key = openKey(s, k);
      const words_ = S[s].a.slice(0, k).reduce((n, t) => n + nW(t), 0);
      if(words_ >= 3 && !all.some(x => x !== s && openKey(x, k) === key)) return k;
    }
    return 0;
  };
  inJ.forEach(s => {
    if(!inA(s, 0)) return;
    const k = openLen(s);
    if(!k) return;
    const show = x => S[x].a.slice(0, k);
    const len = x => show(x).reduce((n, t) => n + nW(t), 0);
    if(len(s) > MAX_Q_WORDS) return;
    /* بدائل: السور ذات المطلع المشابه أولاً (كآل حم)، ثم الأقرب في المصحف */
    const first = skelText(S[s].a[0]);
    const pool = all.filter(x => x !== s && S[x].a.length >= k)
      .sort((x, y) => (skelText(S[y].a[0]) === first) - (skelText(S[x].a[0]) === first) ||
                      Math.abs(x - s) - Math.abs(y - s));
    const alts = [], seen = new Set([openKey(s, k)]);
    for(const x of pool.slice(0, 12)){
      const key = openKey(x, k);
      if(alts.length < 3 && !seen.has(key) && len(x) <= MAX_Q_WORDS){ seen.add(key); alts.push(x); }
    }
    if(alts.length < 3) return;
    push({
      id: `begin:${rw}:${s}`, k: 'begin', j: jOf(s, 0), d: 0,
      q: `بمَ تبدأ سورة ${S[s].n}؟`,
      a: [s, ...shuffle(alts)].map(x => show(x).map(ay).join(' ')),
      n: `مطلع سورة ${S[s].n} ` + (k === 1 ? ref(S, s, 1) : `[${S[s].n}: ١–${toAr(k)}]`)
    });
  });

  /* ——— ٥) أكمل الآية: تُحجب الكلمة الأخيرة، والخيارات فواصل آيات حقيقية (لا في جزء عمّ) ——— */
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
      if(!inA(s, i) || NO_FILL_JUZ.has(jOf(s, i))) return;
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
      push({
        id: `fill:${rw}:${s}:${i+1}`, k: 'fill', j: jOf(s, i), d: 1,
        q: 'أكمل الآية: ' + ay(W.slice(0, -1).join(' ') + ' …'),
        a: [right, ...alts].map(qw),
        n: ay(t) + ' ' + ref(S, s, i + 1)
      });
    });
  });

  /* ——— ٦) الكلمات التالية: صدر الآية، ثم ما الكلمات التي تليه؟ (لا في جزء عمّ) ——— */
  const starts = new Map();                          // صدر الآية (٣–١٢ كلمة) ← عدد الآيات التي تبدأ به
  all.forEach(s => S[s].a.forEach(t => {
    const w = skelWords(t);
    for(let p = 3; p <= Math.min(12, w.length); p++){
      const k = w.slice(0, p).join(' ');
      starts.set(k, (starts.get(k) || 0) + 1);
    }
  }));
  inJ.forEach(s => {
    const A = S[s].a;
    A.forEach((t, i) => {
      if(!inA(s, i) || NO_FILL_JUZ.has(jOf(s, i))) return;
      const W = words(t);
      if(W.length !== skelWords(t).length) return;          // كلمة بلا حروف (رمز) تُربك الحساب
      if(W.length < 7 || W.length > MAX_Q_WORDS) return;
      const p = Math.min(W.length - 3, Math.max(3, Math.round(W.length * 0.4)));
      const k = Math.min(3, W.length - p);
      const sw = W.map(skel);
      if(starts.get(sw.slice(0, p).join(' ')) !== 1) return; // صدرٌ تشترك فيه آية أخرى
      const right = cut(W.slice(p, p + k)), rk = sw.slice(p, p + k).join(' ');
      /* بدائل: مقاطع حقيقية بالطول نفسه من آيات السورة نفسها، ثم ما جاورها */
      const seen = new Set([rk]), alts = [];
      const take = list => shuffle(list).forEach(x => {
        if(alts.length >= 3) return;
        const X = words(x);
        if(X.length < k + 1) return;
        const q0 = Math.floor(Math.random() * (X.length - k + 1));
        const key = X.slice(q0, q0 + k).map(skel).join(' ');
        if(key.split(' ').length === k && !seen.has(key)){ seen.add(key); alts.push(cut(X.slice(q0, q0 + k))); }
      });
      take(A.filter((_, j) => j !== i));
      if(alts.length < 3) nearSuras(s, 3).forEach(x => take(S[x].a));
      if(alts.length < 3) return;
      push({
        id: `words:${rw}:${s}:${i+1}`, k: 'words', j: jOf(s, i), d: 1,
        q: 'ما الكلمات التالية؟ ' + ay(W.slice(0, p).join(' ') + ' …'),
        a: [right, ...alts].map(qw),
        n: ay(t) + ' ' + ref(S, s, i + 1)
      });
    });
  });

  /* ——— ٧) ما الآية التي قبلها؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a;
    if(A.length < 4) return;
    A.forEach((t, i) => {
      if(i === 0 || !inA(s, i)) return;
      const prev = A[i - 1];
      if(!unique(t) || !unique(prev) || nW(t) < 2 || nW(t) > MAX_Q_WORDS || nW(prev) > MAX_OPT_WORDS) return;
      const near = [i + 1, i - 2, i + 2, i - 3];
      const alts = ayahAlts(A, [...near, ...rest(A, [i, i - 1, ...near])], [skelText(prev), skelText(t)]);
      if(alts.length < 3) return;
      push({
        id: `prev:${rw}:${s}:${i+1}`, k: 'prev', j: jOf(s, i), d: 2,
        q: 'ما الآية التي قبل قوله تعالى: ' + ay(t),
        a: [prev, ...alts].map(ay),
        n: ay(prev) + ' ' + ay(t) + ' ' + `[${S[s].n}: ${toAr(i)}–${toAr(i + 1)}]`
      });
    });
  });

  /* ——— ٨) ما الآية التي بعدها؟ ——— */
  inJ.forEach(s => {
    const A = S[s].a;
    if(A.length < 4) return;
    A.forEach((t, i) => {
      if(i === A.length - 1 || !inA(s, i)) return;
      const next = A[i + 1];
      if(!unique(t) || !unique(next) || nW(t) < 2 || nW(t) > MAX_Q_WORDS || nW(next) > MAX_OPT_WORDS) return;
      const near = [i + 2, i - 1, i + 3, i - 2];
      const alts = ayahAlts(A, [...near, ...rest(A, [i, i + 1, ...near])], [skelText(next), skelText(t)]);
      if(alts.length < 3) return;
      push({
        id: `after:${rw}:${s}:${i+1}`, k: 'after', j: jOf(s, i), d: 1,
        q: 'ما الآية التي بعد قوله تعالى: ' + ay(t),
        a: [next, ...alts].map(ay),
        n: ay(t) + ' ' + ay(next) + ' ' + `[${S[s].n}: ${toAr(i + 1)}–${toAr(i + 2)}]`
      });
    });
  });

  /* ——— ٩) ترتيب المصحف: ما السورة التي تلي…؟ ——— */
  inJ.forEach(s => {
    const nx = s + 1;
    if(!S[nx]) return;
    const pool = all.filter(x => x !== nx && x !== s);
    const alts = shuffle(pool.sort((x, y) => Math.abs(x - s) - Math.abs(y - s)).slice(0, 5)).slice(0, 3);
    push({
      id: `next:${rw}:${s}`, k: 'next', j: sJ(s), d: 0,
      q: `ما السورة التي تلي سورة ${S[s].n} في ترتيب المصحف؟`,
      a: [nx, ...alts].map(x => 'سورة ' + S[x].n),
      n: `بعد سورة ${S[s].n} (${toAr(s)}) سورةُ ${S[nx].n} (${toAr(nx)}).`
    });
  });

  /* ——— ١٠) عدد الآيات في الرواية المختارة ——— */
  inJ.forEach(s => {
    const n = S[s].a.length;
    if(n < 4) return;
    const cand = shuffle([n - 2, n - 1, n + 1, n + 2].filter(x => x > 2)).slice(0, 3);
    const O = M[otherRw] && M[otherRw].suras[s];
    const diff = O && O.a.length !== n;
    push({
      id: `count:${rw}:${s}`, k: 'count', j: sJ(s), d: 2,
      q: `كم عدد آيات سورة ${S[s].n} في ${R.label}؟`,
      a: [n, ...cand].map(toAr),
      n: `سورة ${S[s].n}: ${ayatN(n)} في ${R.label}` +
         (diff ? `، و${ayatN(O.a.length)} في ${M[otherRw].label} — لاختلاف عدّ الآي.` : '، وكذلك في ' + M[otherRw].label + '.')
    });
  });

  /* ——— ١١) البطاقات المكتوبة يدوياً ——— */
  (hand || []).forEach((h, x) => {
    const c = resolveHand(M, rw, h, x);
    if(c && J.has(c.j)){ c.m = MEMO.has(c.k); out.push(c); }
  });

  return out;
}

/* ================= البطاقات اليدوية =================
   {{مفتاح}} أو {{رقم السورة|مفتاح}}: يُبحث عن الكلمات في الرواية المختارة،
   فتحلّ محلّه ﴿الكلمات بنصّها من المصحف﴾، ويُقدَّم نصّ الآية كاملةً ومرجعها في n.
   r: 'q' أو 'h' لبطاقة تخصّ رواية واحدة. {{رقم|q=…;h=…}} إن اختلف اللفظ بين الروايتين. */
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
          hits.push({ s, a: i + 1, t, text: cut(W.slice(p, p + want.length)) });
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
  const j = firstHit ? S[firstHit.s].j[firstHit.a - 1] : h.j;
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

const API = { buildBank, toTiers, skel, words, findWords, AY_OPEN, AY_CLOSE, MEMO };
if(typeof module !== 'undefined' && module.exports) module.exports = API;
else root.QGEN = API;
})(typeof window !== 'undefined' ? window : globalThis);
