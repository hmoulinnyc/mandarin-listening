// Conversation scenes: listen to a whole scene, or take your turn by writing or speaking.
// Shared by the laptop app and the phone page; the host supplies audio playback and,
// where a microphone is available, speech-to-text.
//
//   ScenePlayer.mount(el, {
//     scenes,                      // goals/<lang>_scenes.json → scenes
//     friend: 'Mathilde',
//     play(kind, text, {slow}),    // → Promise that resolves when the audio ends
//     stop(),                      // stop any audio
//     canRecord: true|false,       // a microphone is usable here
//     transcribe(wavBlob),         // → Promise<string> (optional; laptop only)
//     coach(prompt),               // → Promise<object> parsed JSON from Claude (optional): judges, teaches, explains
//     dictation: true|false,       // no mic, but keyboard dictation can fill a text box (phone page)
//     onLearned({nl, en, scene}),  // optional, a phrase taught with "Hoe zeg je…?"
//     onResult(sceneId, stats),    // optional, called when a scene is finished
//   })
(function () {
  const CSS = `
  .sp { --sp-card: var(--panel, var(--wall, #fff)); --sp-line: var(--line, var(--seam, #ddd)); --sp-accent: var(--accent, var(--hold, #0d8a83));
        --sp-soft: var(--accent-soft, var(--hold-soft, #eef6f5)); --sp-muted: var(--muted, var(--dust, #777)); --sp-bg: var(--bg, var(--chalk, #f6f6f3));
        --sp-good: var(--good, #2b8a3e); --sp-warn: var(--warn, #b7791f); --sp-bad: var(--bad, var(--tape, #c92a2a));
        display: flex; flex-direction: column; gap: 14px; }
  .sp button { font: inherit; color: inherit; cursor: pointer; border: 1px solid var(--sp-line); background: var(--sp-card); border-radius: 999px; padding: 8px 14px; }
  .sp button.go { background: var(--sp-accent); border-color: var(--sp-accent); color: #fff; font-weight: 700; }
  .sp button.on { background: var(--sp-soft); border-color: var(--sp-accent); color: var(--sp-accent); font-weight: 700; }
  .sp button:disabled { opacity: .5; cursor: default; }
  .sp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
  .sp-pick { text-align: left; border-radius: 14px !important; padding: 14px !important; display: flex; flex-direction: column; gap: 2px; }
  .sp-pick .pic { font-size: 28px; }
  .sp-pick .t { font-weight: 700; font-size: 17px; }
  .sp-pick .g, .sp-muted { color: var(--sp-muted); font-size: 14px; }
  .sp-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .sp-seg { display: inline-flex; gap: 4px; padding: 3px; border: 1px solid var(--sp-line); border-radius: 999px; background: var(--sp-bg); }
  .sp-seg button { border: 0; padding: 6px 12px; }
  .sp-chat { display: flex; flex-direction: column; gap: 10px; }
  .sp-msg { max-width: 85%; padding: 10px 14px; border-radius: 16px; border: 1px solid var(--sp-line); background: var(--sp-card); display: flex; gap: 10px; align-items: flex-start; }
  .sp-msg.me { align-self: flex-end; background: var(--sp-soft); border-color: transparent; }
  .sp-msg .pic { font-size: 22px; line-height: 1.2; }
  .sp-msg .nl { font-size: 18px; font-weight: 600; }
  .sp-msg .en { font-size: 13px; color: var(--sp-muted); }
  .sp-msg .hidden-text { filter: blur(6px); user-select: none; }
  .sp-msg .replay { border: 0 !important; background: none !important; padding: 0 4px !important; color: var(--sp-muted); }
  .sp-msg.playing { border-color: var(--sp-accent); }
  .sp-turn { border: 2px dashed var(--sp-accent); border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 10px; background: var(--sp-card); }
  .sp-turn .hint { font-size: 17px; display: flex; gap: 10px; align-items: center; }
  .sp-turn .hint .pic { font-size: 28px; }
  .sp-turn input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid var(--sp-line); background: var(--sp-bg); font-size: 18px; color: inherit; }
  .sp-fb { border-radius: 12px; padding: 10px 12px; display: flex; flex-direction: column; gap: 4px; font-size: 16px; }
  .sp-fb.exact { background: color-mix(in srgb, var(--sp-good) 14%, transparent); }
  .sp-fb.close { background: color-mix(in srgb, var(--sp-warn) 16%, transparent); }
  .sp-fb.different { background: color-mix(in srgb, var(--sp-bad) 12%, transparent); }
  .sp-fb .v { font-weight: 700; }
  .sp-w { padding: 0 2px; border-radius: 4px; }
  .sp-w.ok { color: var(--sp-good); }
  .sp-w.near { color: var(--sp-warn); text-decoration: underline wavy; }
  .sp-w.wrong, .sp-w.extra { color: var(--sp-bad); text-decoration: line-through; }
  .sp-w.missing { color: var(--sp-bad); font-weight: 700; }
  .sp-fb .tip { color: var(--sp-muted); font-size: 14px; }
  .sp-fb .corr { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .sp button.mini { padding: 0 8px; font-size: 12px; line-height: 20px; }
  .sp-help { gap: 6px; }
  .sp-helpbox { border-radius: 12px; padding: 10px 12px; background: var(--sp-bg); display: flex; flex-direction: column; gap: 8px; }
  .sp-helpbox input { font-size: 17px; }
  .sp-bank { display: flex; flex-wrap: wrap; gap: 6px; }
  .sp-word { cursor: pointer; border-bottom: 1px dotted var(--sp-muted); }
  .sp-word:hover { color: var(--sp-accent); }
  .sp-explain { font-size: 14px; margin-top: 6px; padding: 6px 8px; border-radius: 8px; background: var(--sp-soft); font-weight: 400; }
  .sp-weak { font-size: 12px; font-weight: 700; color: var(--sp-bad); }
  .sp-script { font-size: 20px; color: var(--sp-muted); font-weight: 400; margin-top: 2px; }
  .sp-lb { font-size: 13px; color: var(--sp-muted); margin-top: 2px; }
  .sp-done { text-align: center; padding: 18px; border-radius: 16px; background: var(--sp-soft); display: flex; flex-direction: column; gap: 8px; align-items: center; }
  .sp-rec { color: var(--sp-bad); font-weight: 700; }
  `;

  // ---------- comparing answers ----------
  const strip = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const norm = s => strip(s.toLowerCase().replace(/[’']/g, "'").replace(/[?!.,;:"“”…()¿¡-]/g, ' ')).replace(/\s+/g, ' ').trim();
  const toks = s => (norm(s) ? norm(s).split(' ') : []);

  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function wordCost(a, b) {
    if (a === b) return 0;
    const l = lev(a, b), n = Math.max(a.length, b.length);
    if ((n >= 4 && l <= 1) || (n >= 8 && l <= 2)) return 0.5;  // a typo or a near-miss sound
    return 1;
  }
  // Word-level alignment of an attempt against one target sentence.
  function align(A, T) {
    const D = Array.from({ length: A.length + 1 }, () => Array(T.length + 1).fill(0));
    for (let i = 1; i <= A.length; i++) D[i][0] = i;
    for (let j = 1; j <= T.length; j++) D[0][j] = j;
    for (let i = 1; i <= A.length; i++)
      for (let j = 1; j <= T.length; j++)
        D[i][j] = Math.min(D[i - 1][j] + 1, D[i][j - 1] + 1, D[i - 1][j - 1] + wordCost(A[i - 1], T[j - 1]));
    const ops = [];
    let i = A.length, j = T.length;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && D[i][j] === D[i - 1][j - 1] + wordCost(A[i - 1], T[j - 1])) {
        const c = wordCost(A[i - 1], T[j - 1]);
        ops.unshift({ type: c === 0 ? 'ok' : c < 1 ? 'near' : 'wrong', a: A[i - 1], t: T[j - 1] });
        i--; j--;
      } else if (i > 0 && D[i][j] === D[i - 1][j] + 1) { ops.unshift({ type: 'extra', a: A[i - 1] }); i--; }
      else { ops.unshift({ type: 'missing', t: T[j - 1] }); j--; }
    }
    return { cost: D[A.length][T.length], ops };
  }
  // Romanized Arabic typed on an ordinary keyboard: drop ʿ/ʾ and read chat-style digits (7 = ḥ, 5 = kh, 3/2 = ʿ/ʾ).
  const arabizi = s => s.replace(/[ʿʾ‘`]/g, '').replace(/7/g, 'h').replace(/5/g, 'kh').replace(/[32]/g, '');

  function judge(attempt, line, lang) {
    const fix = lang && lang.romanized ? arabizi : (s => s);
    const A = toks(fix(attempt));
    const variants = [line.nl, ...(line.accept || [])];
    let best = null;
    for (const v of variants) {
      const T = toks(fix(v));
      const r = align(A, T);
      const score = r.cost / Math.max(1, T.length);
      if (!best || score < best.score) best = { ...r, score, target: v };
    }
    const verdict = best.cost === 0 ? 'exact' : (best.cost <= 1 || best.score <= 0.25) ? 'close' : 'different';
    return { verdict, ...best };
  }

  // What each language needs Claude to know. Hosts pass one of these as opts.lang.
  const LANGS = {
    nl: { code: 'nl', name: 'Dutch', register: 'simple, standard Dutch', explainIn: 'very simple Dutch', example: "Hoe zeg je 'I went climbing'?", teachExample: 'Je zegt: Ik ben gaan klimmen.' },
    ar: {
      code: 'ar', name: 'Arabic', romanized: true, script: 'Arabic', scriptLabel: 'عربي script',
      register: 'simple spoken Modern Standard Arabic without case endings, understood everywhere (the friend is Lebanese and may add Lebanese words)',
      learner: 'The learner is male: use masculine forms for the learner. The friend is also male.',
      romanExample: 'Kayfa ḥāluk?', explainIn: 'simple English',
      askLabel: 'Kayfa taqūl…?', askStart: "Kayfa taqūl '", example: "Kayfa taqūl 'I went climbing'?",
      teachExample: 'Taqūl: dhahabtu lit-tasalluq.', regionalFlag: '🇱🇧', regionalName: 'Lebanese',
    },
  };
  const langNotes = L => [
    L.register ? `Language: ${L.register}.` : '',
    L.learner || '',
    L.romanized ? `The conversation is written in Latin letters (romanized ${L.name}, e.g. "${L.romanExample}"). The learner types romanized ${L.name}, possibly without accents or with chat-style digits; spoken answers may arrive in ${L.script} script. Accept either.` : '',
  ].filter(Boolean);
  const scriptField = (L, name) => (L.romanized ? `, "${name}_script": string` : '');
  const scriptRule = (L, name) => (L.romanized ? [`- ${name}_script: the same text as ${name}, in ${L.script} script, fully vowelled only where it helps pronunciation.`] : []);

  // Ask Claude to judge an answer that isn't one of the prepared ones, the way a tutor would.
  function coachPrompt({ L, friend, history, line, attempt, heard, nextFriend }) {
    const convo = history.map(m => `${m.who === 'friend' ? friend : 'Learner'}: ${m.nl}`).join('\n');
    return [
      `You are a friendly ${L.name} tutor. The learner is a beginner practicing a conversation with their friend ${friend}.`,
      ...langNotes(L),
      '', 'Conversation so far:', convo || '(start)', '',
      `The app suggested: "${line.en}" (e.g. "${line.nl}"). This is only a suggestion: the learner may answer ANYTHING that makes sense as their reply to ${friend}'s last line.`,
      `The learner answered: "${attempt}"`,
      heard ? 'This answer was transcribed from speech: ignore capitals, punctuation and tiny transcription quirks.' : '',
      nextFriend ? `Next in the script, ${friend} will say: "${nextFriend}"` : 'After this the scene ends.',
      '', 'Reply with only this JSON object:',
      `{"verdict": "good" | "fix" | "off", "corrected": string${scriptField(L, 'corrected')}, "tip": string, "reply": string | null${scriptField(L, 'reply')}, "reply_en": string | null}`,
      `- "good": correct, natural ${L.name} that makes sense as a reply at this point. It does NOT have to follow the suggestion.`,
      '- "fix": understandable and it fits, but has a grammar or word mistake.',
      `- "off": doesn't work as a reply to what ${friend} just said, isn't ${L.name}, or can't be understood.`,
      `- corrected: the learner's own idea in correct, natural, simple ${L.name}, keeping their meaning (for "off", the typical answer)${L.romanized ? ', romanized like the conversation' : ''}.`,
      ...scriptRule(L, 'corrected'),
      '- tip: one short sentence in English (max 20 words) explaining the main fix, or brief praise if "good".',
      `- reply: only if the learner said something different from the typical answer and the verdict isn't "off": a short, natural reaction from ${friend} in simple ${L.name} (max 8 words) that responds to what they actually said. Do NOT include or paraphrase ${friend}'s next scripted line: it follows right after. Otherwise null.`,
      ...(L.romanized ? [`- reply_script: reply in ${L.script} script, or null.`] : []),
      '- reply_en: English translation of reply, or null.',
    ].filter(x => x !== '').join('\n');
  }

  // Ask Claude to teach a phrase the learner asked for ("Hoe zeg je…?"), as the friend would.
  function teachPrompt({ L, friend, history, line, question }) {
    const convo = history.map(m => `${m.who === 'friend' ? friend : 'Learner'}: ${m.nl}`).join('\n');
    return [
      `You are ${friend}, a friendly friend helping a beginner ${L.name} learner in the middle of a conversation.`,
      ...langNotes(L),
      '', 'Conversation so far:', convo || '(start)', '',
      `It's the learner's turn (the app suggested: "${line.en}"). They ask you: "${question}"`,
      '', 'Reply with only this JSON object:',
      `{"nl": string${scriptField(L, 'nl')}, "en": string, "say": string${scriptField(L, 'say')}}`,
      `- nl: the ${L.name} phrase they want, simple and natural, ready to say at this point in the conversation${L.romanized ? ' (romanized)' : ''}.`,
      ...scriptRule(L, 'nl'),
      '- en: its English meaning.',
      `- say: what ${friend} says to teach it, in simple ${L.name}, max 12 words, containing the phrase${L.teachExample ? ` (e.g. "${L.teachExample}")` : ''}.`,
      ...scriptRule(L, 'say'),
    ].join('\n');
  }

  // Ask Claude what a tapped word means, in the target language first where the learner can follow that.
  function explainPrompt(L, word, sentence) {
    return [
      `A beginner ${L.name} learner tapped the word "${word}" in this sentence: "${sentence}"`,
      ...langNotes(L),
      `Reply with only this JSON object: {"simple": string, "en": string${L.romanized ? ', "script": string' : ''}}`,
      `- simple: what it means here, explained in ${L.explainIn} (max 8 words), with one fitting emoji.`,
      '- en: the English translation of the word as used here (1-4 words).',
      ...(L.romanized ? [`- script: the word in ${L.script} script.`] : []),
    ].join('\n');
  }

  // ---------- weak spots: turns you needed help with come back, kept per browser ----------
  const WEAK_KEY = 'sp-weak';
  function loadWeak() { try { return JSON.parse(localStorage.getItem(WEAK_KEY)) || {}; } catch (e) { return {}; } }
  function markWeak(sceneId, idx, weak) {
    const all = loadWeak();
    const set = new Set(all[sceneId] || []);
    if (weak) set.add(idx); else set.delete(idx);
    all[sceneId] = [...set].sort((a, b) => a - b);
    try { localStorage.setItem(WEAK_KEY, JSON.stringify(all)); } catch (e) { /* storage blocked */ }
  }
  const weakOf = sceneId => loadWeak()[sceneId] || [];

  // ---------- matching loudness ----------
  // Recorded voices come in at full volume and a microphone recording far quieter, so every clip
  // is measured once and played through a gain (plus a limiter) that brings it to the same level.
  const TARGET_RMS = 0.1;
  let audioCtx = null;
  const gainCache = new Map();
  function ctx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }
  async function gainFor(key, source) {
    if (gainCache.has(key)) return gainCache.get(key);
    let g = 1;
    try {
      const buf = source instanceof Blob ? await source.arrayBuffer() : await fetch(source).then(r => r.arrayBuffer());
      const data = (await ctx().decodeAudioData(buf)).getChannelData(0);
      let sum = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const v = data[i];
        if (Math.abs(v) > 0.01) { sum += v * v; n++; }  // ignore silence so pauses don't count
      }
      if (n) g = Math.min(10, Math.max(0.3, TARGET_RMS / Math.sqrt(sum / n)));
    } catch (e) { /* unmeasurable: play as is */ }
    gainCache.set(key, g);
    return g;
  }
  // Route an <audio> element through a gain matched to its clip. Call before play().
  async function level(audio, key, source) {
    const g = await gainFor(key, source || audio.src);
    try {
      const c = ctx();
      // Until the page has been tapped the browser keeps the audio engine paused; audio routed
      // through it would never finish, so fall back to plain volume until it's running.
      await Promise.race([c.resume(), new Promise(r => setTimeout(r, 300))]);
      if (c.state !== 'running') { audio.volume = Math.min(1, g); return audio; }
      const node = c.createMediaElementSource(audio);
      const gain = c.createGain();
      gain.gain.value = g;
      const limiter = c.createDynamicsCompressor();
      limiter.threshold.value = -3; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.1;
      node.connect(gain).connect(limiter).connect(c.destination);
    } catch (e) { audio.volume = Math.min(1, g); }
    return audio;
  }

  // If a clip stops advancing (the browser blocked or stalled it), give up after 2 s so a scene never hangs.
  function watchdog(audio, onStuck) {
    let last = -1, still = 0;
    const timer = setInterval(() => {
      if (audio.ended || audio.paused) return clearInterval(timer);
      if (audio.currentTime === last) still += 500; else { still = 0; last = audio.currentTime; }
      if (still >= 2000) { clearInterval(timer); onStuck(); }
    }, 500);
  }

  // ---------- recording → 16 kHz mono WAV (what Whisper wants) ----------
  async function toWav16k(blob) {
    const buf = await blob.arrayBuffer();
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const decoded = await ctx.decodeAudioData(buf);
    ctx.close();
    const off = new OfflineAudioContext(1, Math.ceil(decoded.duration * 16000), 16000);
    const src = off.createBufferSource();
    src.buffer = decoded; src.connect(off.destination); src.start();
    const pcm = (await off.startRendering()).getChannelData(0);
    const out = new DataView(new ArrayBuffer(44 + pcm.length * 2));
    const w = (o, s) => [...s].forEach((c, k) => out.setUint8(o + k, c.charCodeAt(0)));
    w(0, 'RIFF'); out.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 1, true);
    out.setUint32(24, 16000, true); out.setUint32(28, 32000, true); out.setUint16(32, 2, true); out.setUint16(34, 16, true);
    w(36, 'data'); out.setUint32(40, pcm.length * 2, true);
    pcm.forEach((v, k) => out.setInt16(44 + k * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
    return new Blob([out], { type: 'audio/wav' });
  }

  // ---------- UI ----------
  function h(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (k === 'value') n.value = v; else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach(k => k != null && n.append(k));
    return n;
  }

  function mount(root, opts) {
    if (!document.getElementById('sp-css')) document.head.append(h('style', { id: 'sp-css' }, CSS));
    const friend = opts.friend || 'Friend';
    let state = { view: 'list' };
    let run = 0;  // bumps on every navigation so old playback loops stop
    root.classList.add('sp');

    const voiceOf = line => (line.who === 'friend' ? 'friend' : 'nl');
    const L = opts.lang || LANGS.nl;
    // Romanized languages are shown in Latin letters but spoken from their own script.
    const audioOf = line => line.say || line.nl;
    const speakLabel = opts.canRecord || opts.dictation ? 'Speak' : 'Say it';
    const ask = prompt => (opts.coach ? opts.coach(prompt) : Promise.reject(new Error('no Claude')));

    function renderList() {
      opts.stop && opts.stop();
      run++;
      root.replaceChildren(
        h('p', { class: 'sp-muted' }, `Short conversations with ${friend}. Listen first, then take your turn by writing or speaking.`),
        h('div', { class: 'sp-list' }, opts.scenes.map(sc => {
          const n = weakOf(sc.id).length;
          return h('button', { class: 'sp-pick', onclick: () => openScene(sc) },
            h('span', { class: 'pic' }, sc.pic), h('span', { class: 't' }, sc.title), h('span', { class: 'g' }, sc.gloss),
            n ? h('span', { class: 'sp-weak' }, `🔁 ${n} to practice`) : null);
        })),
      );
    }

    function openScene(sc, mode = 'turn', answer = state.answer || 'write') {
      opts.stop && opts.stop();
      const my = ++run;
      const weak = weakOf(sc.id);
      if (mode === 'weak' && !weak.length) mode = 'turn';
      let order = sc.lines.map((_, i) => i);
      if (mode === 'weak') {
        // Each weak turn, with the friend's line that leads into it.
        const pick = new Set();
        weak.forEach(i => { if (sc.lines[i - 1] && sc.lines[i - 1].who === 'friend') pick.add(i - 1); pick.add(i); });
        order = [...pick].sort((a, b) => a - b);
      }
      state = { view: 'scene', sc, mode, answer, order, pos: 0, idx: order[0] || 0, history: [], showText: state.showText ?? true, showScript: state.showScript ?? false,
                stats: { exact: 0, close: 0, different: 0, skipped: 0 } };
      const chat = h('div', { class: 'sp-chat' });
      const textBtn = h('button', { class: state.showText ? 'on' : '', onclick: () => { state.showText = !state.showText; textBtn.className = state.showText ? 'on' : ''; chat.querySelectorAll('.nl.friend-text').forEach(n => n.classList.toggle('hidden-text', !state.showText)); } }, `${friend}'s text`);
      root.replaceChildren(
        h('div', { class: 'sp-bar' },
          h('button', { onclick: renderList }, '← Scenes'),
          h('b', {}, `${sc.pic} ${sc.title}`)),
        h('div', { class: 'sp-bar' },
          h('span', { class: 'sp-seg' },
            h('button', { class: mode === 'listen' ? 'on' : '', onclick: () => openScene(sc, 'listen', answer) }, '🎧 Listen'),
            h('button', { class: mode === 'turn' ? 'on' : '', onclick: () => openScene(sc, 'turn', answer) }, '🗣 Your turn'),
            weak.length ? h('button', { class: mode === 'weak' ? 'on' : '', onclick: () => openScene(sc, 'weak', answer) }, `🔁 Weak spots (${weak.length})`) : null),
          mode !== 'listen' ? h('span', { class: 'sp-seg' },
            h('button', { class: answer === 'write' ? 'on' : '', onclick: () => openScene(sc, mode, 'write') }, '⌨️ Write'),
            h('button', { class: answer === 'speak' ? 'on' : '', onclick: () => openScene(sc, mode, 'speak') }, `🎙 ${speakLabel}`)) : null,
          textBtn,
          L.romanized ? h('button', { class: state.showScript ? 'on' : '', onclick: e => { state.showScript = !state.showScript; e.currentTarget.className = state.showScript ? 'on' : ''; chat.querySelectorAll('.sp-script').forEach(n => (n.hidden = !state.showScript)); } }, L.scriptLabel || 'Script') : null),
        chat,
      );
      state.chat = chat;
      step(my);
    }

    // Friend lines: every word can be tapped for its meaning.
    function tappable(text) {
      return text.split(/(\s+)/).map(tok => {
        const w = tok.replace(/[^\p{L}'-]/gu, '');
        if (!w) return tok;
        return h('span', { class: 'sp-word', onclick: e => explain(e.currentTarget, w, text) }, tok);
      });
    }

    function bubble(line, extra) {
      const isFriend = line.who === 'friend';
      const nl = h('span', { class: 'nl' + (isFriend ? ' friend-text' + (state.showText ? '' : ' hidden-text') : '') }, isFriend ? tappable(line.nl) : line.nl);
      const msg = h('div', { class: 'sp-msg' + (isFriend ? '' : ' me') },
        h('span', { class: 'pic' }, line.pic || ''),
        h('span', { class: 'sp-body' }, nl,
          line.say && L.romanized ? h('div', { class: 'sp-script', dir: 'rtl', hidden: !state.showScript }, line.say) : null,
          line.lb ? h('div', { class: 'sp-lb' }, `${L.regionalFlag || ''} ${line.lb.tr} `, h('button', { class: 'mini', 'aria-label': `Hear the ${L.regionalName || 'regional'} version`, onclick: () => opts.play('flemish', line.lb.ar || line.lb.tr, {}) }, '▶')) : null,
          h('div', { class: 'en' }, isFriend ? line.en : (extra || ''))),
        h('button', { class: 'replay', 'aria-label': 'Play again', onclick: () => opts.play(voiceOf(line), audioOf(line), {}) }, '▶'),
        isFriend ? h('button', { class: 'replay', 'aria-label': 'Play slowly', onclick: () => opts.play(voiceOf(line), audioOf(line), { slow: true }) }, '🐢') : null);
      state.chat.append(msg);
      state.history.push({ who: line.who, nl: line.nl });
      msg.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return msg;
    }

    const explained = new Map();
    async function explain(anchor, word, sentence) {
      const body = anchor.closest('.sp-body');
      let box = body.querySelector('.sp-explain');
      if (!box) { box = h('div', { class: 'sp-explain' }); body.append(box); }
      if (!opts.coach) { box.textContent = `${word}: explanations need Claude, which isn’t available here.`; return; }
      box.textContent = `${word}: …`;
      const key = word.toLowerCase() + '|' + sentence;
      try {
        const r = explained.get(key) || await ask(explainPrompt(L, word, sentence));
        if (!r || !r.simple) throw new Error('no answer');
        explained.set(key, r);
        const en = h('button', { class: 'mini', onclick: () => en.replaceWith(h('span', { class: 'sp-muted' }, ` · ${r.en}`)) }, 'English?');
        box.replaceChildren(h('b', {}, word), ` = ${r.simple} `, h('button', { class: 'mini', onclick: () => opts.play('nl', r.script || word, {}) }, '▶'), ' ', en);
      } catch (e) { box.textContent = `${word}: couldn’t get an explanation right now.`; }
    }

    async function playLine(line, msg, my) {
      msg.classList.add('playing');
      try { await opts.play(voiceOf(line), audioOf(line), {}); } catch (e) { /* keep going without audio */ }
      msg.classList.remove('playing');
      if (my === run) await new Promise(r => setTimeout(r, 350));
    }

    async function step(my) {
      // Keep this run's own state: a newer run (mode switch, restart) must not be advanced by this one.
      const st = state;
      while (my === run && st.pos < st.order.length) {
        st.idx = st.order[st.pos];
        const line = st.sc.lines[st.idx];
        if (st.mode === 'listen' || line.who === 'friend') await playLine(line, bubble(line, line.who === 'me' ? 'you' : ''), my);
        else {
          const res = await yourTurn(line, my);
          if (my !== run) return;
          if (res && res.reply) {
            const react = { who: 'friend', nl: res.reply, say: res.reply_script || undefined, en: res.reply_en || '', pic: '💬' };
            await playLine(react, bubble(react), my);
          }
        }
        if (my !== run) return;
        st.pos++;
      }
      if (my === run) finish();
    }

    function yourTurn(scriptLine, my) {
      return new Promise(resolve => {
        // A working copy: phrases taught during this turn become accepted answers.
        const line = { ...scriptLine, accept: [...(scriptLine.accept || [])] };
        const fbBox = h('div');
        const helpBox = h('div', { class: 'sp-helpbox', hidden: true });
        const card = h('div', { class: 'sp-turn' },
          h('div', { class: 'hint' }, h('span', { class: 'pic' }, line.pic || '💬'), h('span', {}, line.en)));
        let lastVerdict = null, coached = null, helped = false, input = null, hintLevel = 0;
        const done = (attemptText) => {
          state.stats[lastVerdict || 'skipped']++;
          markWeak(state.sc.id, state.idx, helped || !lastVerdict || lastVerdict === 'different');
          card.remove();
          const tag = { exact: '✓ you said it', close: '≈ almost', different: '✗ model answer', skipped: 'skipped' }[lastVerdict || 'skipped'] + (helped ? ' · with help' : '');
          // An accepted answer of your own goes into the conversation instead of the script's line.
          const own = coached && coached.verdict !== 'off' && coached.corrected;
          const said = own ? { nl: coached.corrected, say: coached.corrected_script || undefined }
            : line.taught && lastVerdict === 'exact' ? { nl: line.taught, say: line.taughtScript || undefined }
            : { nl: line.nl, say: line.say };
          bubble({ ...line, ...said }, attemptText ? `${tag} · you: “${attemptText}”` : tag);
          resolve(own ? { reply: coached.reply, reply_script: coached.reply_script, reply_en: coached.reply_en } : null);
        };
        const next = h('button', { class: 'go', onclick: () => done(state.lastAttempt) }, 'Continue →');
        const hear = h('button', { onclick: () => opts.play('nl', audioOf(line), {}) }, '▶ Model');
        const hearSlow = h('button', { onclick: () => opts.play('nl', audioOf(line), { slow: true }) }, '🐢');
        const skip = h('button', { onclick: () => { lastVerdict = null; done(''); } }, 'Skip');

        async function showFeedback(attempt, heard) {
          const r = judge(attempt, line, L);
          state.lastAttempt = attempt;
          coached = null;
          if (r.verdict !== 'exact' && opts.coach) {
            lastVerdict = null;
            fbBox.replaceChildren(h('div', { class: 'sp-fb close' }, h('span', { class: 'v' }, 'Checking your answer…')));
            const nextFriend = (state.sc.lines.slice(state.idx + 1).find(l => l.who === 'friend') || {}).nl;
            try {
              const c = await ask(coachPrompt({ L, friend, history: state.history, line, attempt, heard, nextFriend }));
              if (state.lastAttempt !== attempt) return;  // a newer attempt is being checked
              if (c && ['good', 'fix', 'off'].includes(c.verdict) && typeof c.corrected === 'string') return showCoached(attempt, heard, c);
            } catch (e) { /* fall back to the word-by-word check */ }
          }
          lastVerdict = r.verdict;
          const words = r.ops.map(o => o.type === 'missing'
            ? h('span', { class: 'sp-w missing', title: 'missing' }, `[${o.t}]`)
            : h('span', { class: 'sp-w ' + o.type, title: o.type === 'near' ? `close to “${o.t}”` : o.type === 'wrong' ? `expected “${o.t}”` : '' }, o.a));
          const label = { exact: '✓ Perfect!', close: '≈ Almost: check the marked words', different: '✗ Not quite: listen to the model and try again' }[r.verdict];
          fbBox.replaceChildren(h('div', { class: 'sp-fb ' + r.verdict },
            h('span', { class: 'v' }, label),
            h('span', {}, heard ? 'Heard: ' : 'You: ', ...words.flatMap((w, k) => (k ? [' ', w] : [w]))),
            r.verdict !== 'exact' ? h('span', {}, 'Model: ', h('b', {}, r.target)) : null));
          // Romanized attempts can't be spoken as typed: play the model line instead.
          opts.play('nl', L.romanized ? audioOf(line) : (r.verdict === 'exact' ? attempt : r.target), {});
        }

        function showCoached(attempt, heard, c) {
          coached = c;
          lastVerdict = { good: 'exact', fix: 'close', off: 'different' }[c.verdict];
          const label = { good: '✓ Good answer!', fix: '≈ Understandable, with a small fix', off: '✗ That doesn’t quite fit here' }[c.verdict];
          const say = c.verdict === 'off' ? line.nl : c.corrected;
          const sayAudio = c.verdict === 'off' ? audioOf(line) : (c.corrected_script || c.corrected);
          fbBox.replaceChildren(h('div', { class: 'sp-fb ' + { good: 'exact', fix: 'close', off: 'different' }[c.verdict] },
            h('span', { class: 'v' }, label),
            h('span', {}, heard ? 'Heard: ' : 'You: ', attempt),
            c.verdict !== 'good' || norm(c.corrected) !== norm(attempt)
              ? h('span', { class: 'corr' }, c.verdict === 'off' ? 'Try: ' : 'Better: ', h('b', {}, say),
                  h('button', { onclick: () => opts.play('nl', sayAudio, {}) }, '▶'))
              : null,
            c.tip ? h('span', { class: 'tip' }, c.tip) : null));
          if (c.verdict === 'off') coached = null;
          opts.play('nl', sayAudio, {});
        }

        // ---- help: hints, "Hoe zeg je…?" ----
        const hintBtn = h('button', { onclick: giveHint }, '💡 Hint');
        const askBtn = h('button', { onclick: openAsk }, `💬 ${L.askLabel || 'Hoe zeg je…?'}`);
        function giveHint() {
          helped = true; hintLevel++; helpBox.hidden = false;
          const words = line.nl.replace(/[?!.,]/g, '').split(/\s+/).filter(Boolean);
          if (hintLevel === 1) {
            const start = words.slice(0, Math.max(1, Math.min(2, words.length - 1))).join(' ');
            helpBox.replaceChildren(h('span', {}, 'Start with: ', h('b', {}, `${start} …`)));
          } else if (hintLevel === 2) {
            const shuffled = words.map(w => [Math.random(), w]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
            helpBox.replaceChildren(h('span', { class: 'sp-muted' }, input ? 'Tap the words in order:' : 'Say these in the right order:'),
              h('div', { class: 'sp-bank' }, shuffled.map(w => h('button', { onclick: e => {
                if (input) { input.value = (input.value.trim() + ' ' + w).trim(); input.focus(); }
                e.currentTarget.disabled = true;
              } }, w))));
          } else {
            helpBox.replaceChildren(
              h('span', {}, 'Answer: ', h('b', {}, line.nl), ' ', h('button', { class: 'mini', onclick: () => opts.play('nl', audioOf(line), {}) }, '▶')),
              h('span', { class: 'sp-muted' }, 'Now say or type it yourself.'));
            opts.play('nl', audioOf(line), {});
            hintBtn.disabled = true;
          }
        }
        function openAsk() {
          helpBox.hidden = false;
          if (!opts.coach) { helpBox.replaceChildren(h('span', { class: 'sp-muted' }, 'Asking needs Claude, which isn’t available here. Try 💡 Hint.')); return; }
          const q = h('input', { type: 'text', value: L.askStart || "Hoe zeg je '", autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
          q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); sendAsk(q.value); } });
          helpBox.replaceChildren(h('span', { class: 'sp-muted' }, `Ask ${friend} in ${L.name}, with English inside: ${L.example}`), q,
            h('div', { class: 'sp-bar' }, h('button', { class: 'go', onclick: () => sendAsk(q.value) }, `Ask ${friend}`)));
          setTimeout(() => { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 30);
        }
        async function sendAsk(question) {
          question = question.trim();
          if (question.replace(L.askStart || "Hoe zeg je '", '').replace(/[\s'’"?]/g, '').length < 2) return;
          helped = true;
          helpBox.replaceChildren(h('span', { class: 'sp-muted' }, `${friend} is thinking…`));
          bubble({ who: 'me', nl: question, pic: '🙋' }, 'asking for help');
          state.chat.append(card);
          try {
            const t = await ask(teachPrompt({ L, friend, history: state.history, line, question }));
            if (!t || !t.nl) throw new Error('no answer');
            const teach = { who: 'friend', nl: t.say || t.nl, say: t.say_script || undefined, en: t.en || '', pic: '💡' };
            const taughtAudio = t.nl_script || t.nl;
            const msg = bubble(teach);
            state.chat.append(card);
            line.accept.push(t.nl);
            line.taught = t.nl;
            line.taughtScript = t.nl_script;
            if (opts.onLearned) opts.onLearned({ nl: t.nl, script: t.nl_script, en: t.en || '', scene: state.sc.id });
            helpBox.replaceChildren(
              h('span', {}, 'Now you: ', h('b', {}, t.nl), ' ',
                h('button', { class: 'mini', onclick: () => opts.play('nl', taughtAudio, {}) }, '▶'), ' ',
                h('button', { class: 'mini', onclick: () => opts.play('nl', taughtAudio, { slow: true }) }, '🐢')),
              h('span', { class: 'sp-muted' }, `Saved to your phrases. ${input ? 'Type' : 'Say'} it yourself to continue.`));
            msg.classList.add('playing');
            await opts.play('friend', audioOf(teach), {});
            msg.classList.remove('playing');
            if (input) { input.value = ''; input.focus(); }
          } catch (e) { helpBox.replaceChildren(h('span', { class: 'sp-muted' }, 'Couldn’t ask right now. Try 💡 Hint.')); }
        }

        // ---- answering: write, dictate, record, or say it ----
        let controls;
        const dictating = state.answer === 'speak' && !opts.canRecord && opts.dictation;
        if (state.answer === 'write' || dictating) {
          input = h('input', { type: 'text', placeholder: dictating ? `Tap 🎙 on your keyboard and speak ${L.name}…` : `Type your answer in ${L.name}${L.romanized ? ' (Latin letters are fine)' : ''}…`, autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false' });
          const check = h('button', { class: 'go', onclick: () => input.value.trim() && showFeedback(input.value.trim(), dictating) }, 'Check');
          input.addEventListener('keydown', e => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (lastVerdict && input.value.trim() === state.lastAttempt) next.click();
            else if (input.value.trim()) showFeedback(input.value.trim(), dictating);
          });
          controls = [
            dictating ? h('span', { class: 'sp-muted' }, `Use your keyboard’s 🎙 dictation with the ${L.name} keyboard (switch with 🌐), then tap Check.`) : null,
            input, h('div', { class: 'sp-bar' }, check, hear, hearSlow, next, skip)];
          setTimeout(() => input.focus(), 50);
        } else if (opts.canRecord) {
          let rec = null, chunks = [], myUrl = null, myBlob = null;
          const status = h('span', { class: 'sp-muted' }, opts.transcribe ? 'Record, and the app checks what it heard.' : 'Record, then compare with the model.');
          const recBtn = h('button', { class: 'go' }, '🎙 Record');
          const mine = h('button', { disabled: true, onclick: async () => {
            await opts.play('nl', audioOf(line), {});
            if (myUrl) (await level(new Audio(myUrl), myUrl, myBlob)).play();
          } }, '▶ Model, then me');
          recBtn.onclick = async () => {
            if (rec && rec.state === 'recording') { rec.stop(); return; }
            let stream;
            try { stream = await navigator.mediaDevices.getUserMedia({ audio: { autoGainControl: true, noiseSuppression: true, echoCancellation: true } }); }
            catch (e) { status.textContent = 'Microphone access was blocked. Use Write instead.'; return; }
            opts.stop && opts.stop();
            chunks = [];
            rec = new MediaRecorder(stream);
            rec.ondataavailable = e => chunks.push(e.data);
            rec.onstop = async () => {
              stream.getTracks().forEach(t => t.stop());
              recBtn.textContent = '🎙 Record again'; recBtn.classList.remove('sp-rec');
              myBlob = new Blob(chunks, { type: rec.mimeType });
              if (myUrl) URL.revokeObjectURL(myUrl);
              myUrl = URL.createObjectURL(myBlob);
              mine.disabled = false;
              if (!opts.transcribe) { status.textContent = 'Recorded. Compare with the model.'; lastVerdict = lastVerdict || 'close'; return; }
              status.textContent = 'Listening to your recording…';
              try {
                const heard = await opts.transcribe(await toWav16k(myBlob));
                status.textContent = '';
                if (heard && heard.trim()) showFeedback(heard.trim(), true);
                else status.textContent = 'Couldn’t hear any words. Try again, a bit closer to the mic.';
              } catch (e) {
                status.textContent = 'Speech check isn’t available right now. Compare by ear instead.';
              }
            };
            rec.start();
            recBtn.textContent = '■ Stop'; recBtn.classList.add('sp-rec');
            status.textContent = 'Recording… say your answer, then tap Stop.';
          };
          controls = [h('div', { class: 'sp-bar' }, recBtn, hear, hearSlow, mine, next, skip), status];
        } else {
          const reveal = h('button', { class: 'go', onclick: () => {
            fbBox.replaceChildren(h('div', { class: 'sp-fb exact' }, h('span', { class: 'v' }, 'Model answer'), h('b', {}, line.taught || line.nl),
              h('span', { class: 'sp-muted' }, 'Say it again along with the audio.')));
            opts.play('nl', line.taught ? (line.taughtScript || line.taught) : audioOf(line), {});
            lastVerdict = 'close';
          } }, 'I said it: reveal');
          controls = [h('span', { class: 'sp-muted' }, 'Say your answer out loud, then reveal it.'), h('div', { class: 'sp-bar' }, reveal, hearSlow, next, skip)];
        }
        card.append(...controls.filter(Boolean), h('div', { class: 'sp-bar sp-help' }, h('span', { class: 'sp-muted' }, 'Stuck?'), hintBtn, askBtn), helpBox, fbBox);
        state.chat.append(card);
        card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    }

    function finish() {
      const { sc, stats, mode } = state;
      const nextSc = opts.scenes[opts.scenes.indexOf(sc) + 1];
      const weakLeft = weakOf(sc.id).length;
      const summary = mode === 'listen'
        ? 'Scene finished. Now try it with 🗣 Your turn.'
        : `✓ ${stats.exact} perfect · ≈ ${stats.close} almost · ✗ ${stats.different} to practice${stats.skipped ? ` · ${stats.skipped} skipped` : ''}`;
      state.chat.append(h('div', { class: 'sp-done' },
        h('b', {}, `${sc.pic} ${sc.title}: done`), h('span', {}, summary),
        h('div', { class: 'sp-bar' },
          mode === 'listen' ? h('button', { onclick: () => openScene(sc, 'turn', state.answer) }, '🗣 Your turn')
                            : h('button', { onclick: () => openScene(sc, 'turn', state.answer) }, '↻ Again'),
          weakLeft && mode !== 'listen' ? h('button', { onclick: () => openScene(sc, 'weak', state.answer) }, `🔁 Weak spots (${weakLeft})`) : null,
          nextSc ? h('button', { class: 'go', onclick: () => openScene(nextSc, mode === 'weak' ? 'turn' : mode, state.answer) }, `Next: ${nextSc.title} →`)
                 : h('button', { onclick: renderList }, 'All scenes'))));
      if (mode !== 'listen' && opts.onResult) opts.onResult(sc.id, { ...stats });
    }

    renderList();
    return { stop: () => { run++; opts.stop && opts.stop(); } };
  }

  window.ScenePlayer = { mount, judge, toWav16k, level, watchdog, LANGS };
})();
