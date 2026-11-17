// Small sound lessons (minimal pairs) per language. Listening choices are measured; recordings are
// self-compared. Examples play the app's recorded voice (ElevenLabs, data/audio/<lang>) when there is
// one, otherwise the best device voice for the language.
(() => {
  // Each lesson: two sides (labels), pairs of words that differ only in that sound, and a tip.
  // Arabic words carry vowel marks so recorded and device voices say exactly that word.
  const LESSONS = {
    pt: [{
      key: 'pt-BR-open-closed-o', tag: 'Brazilian Portuguese', title: 'One vowel, two meanings',
      sub: 'Learn to hear and make the difference between open ó and closed ô.',
      sides: ['Open ó · /ɔ/', 'Closed ô · /o/'], short: ['open ó', 'closed ô'],
      pairs: [[{ text: 'avó', meaning: 'grandmother' }, { text: 'avô', meaning: 'grandfather' }],
              [{ text: 'bisavó', meaning: 'great-grandmother' }, { text: 'bisavô', meaning: 'great-grandfather' }]],
      tip: 'Stress the last syllable in both words. For <b>ó</b>, open your jaw a little more. For <b>ô</b>, raise your tongue slightly and round your lips a little more. Keep each vowel steady.',
      focus: 'Focus on the last vowel.',
      clips: [{ href: '#watch/kGX1vVJU6tk?t=677', text: 'Você lembra da sua avó?', note: 'Easy Portuguese · grandmother · 11:18' },
              { href: '#watch/7R927spyHe8?t=240', text: 'O meu avô é fundador da cidade…', note: 'Easy Portuguese · grandfather · 4:00' }],
      more: { href: 'https://coerll.utexas.edu/brazilpod/tafalado/lesson-04.html', text: 'More explanation and Brazilian recordings: UT Austin’s Tá Falado →' },
    }],
    ar: [
      { key: 'ar-h-h', tag: 'Arabic', title: 'ح or ه', sub: 'The strong, breathy ḥ against a plain h.',
        sides: ['ح · ḥ (strong)', 'ه · h (plain)'], short: ['ḥ (ح)', 'h (ه)'],
        pairs: [[{ text: 'حَرَم', meaning: 'ḥaram · sanctuary' }, { text: 'هَرَم', meaning: 'haram · pyramid' }],
                [{ text: 'حَلَّ', meaning: 'ḥalla · he solved' }, { text: 'هَلَّ', meaning: 'halla · it appeared (the new moon)' }]],
        tip: 'For <b>ح</b>, squeeze the throat and breathe out hard and voiceless, like fogging a mirror with force. For <b>ه</b>, keep the throat relaxed: an English h.',
        focus: 'Focus on the first sound.' },
      { key: 'ar-q-k', tag: 'Arabic', title: 'ق or ك', sub: 'A q made deep in the throat against an ordinary k.',
        sides: ['ق · q (deep)', 'ك · k'], short: ['q (ق)', 'k (ك)'],
        pairs: [[{ text: 'قَلْب', meaning: 'qalb · heart' }, { text: 'كَلْب', meaning: 'kalb · dog' }],
                [{ text: 'قَالَ', meaning: 'qāla · he said' }, { text: 'كَالَ', meaning: 'kāla · he measured' }]],
        tip: 'For <b>ق</b>, touch the very back of your tongue to the soft back of your mouth, behind where k is made; the vowel after it sounds darker. In Lebanese, ق is usually a short catch instead (قلب → ʾalb).',
        focus: 'Focus on the first sound.' },
      { key: 'ar-ain-hamza', tag: 'Arabic', title: 'ع or ء', sub: 'The throat sound ʿayn against a simple catch in the voice.',
        sides: ['ع · ʿayn', 'ء · hamza (catch)'], short: ['ʿayn (ع)', 'hamza (ء)'],
        pairs: [[{ text: 'سَعَلَ', meaning: 'saʿala · he coughed' }, { text: 'سَأَلَ', meaning: 'saʾala · he asked' }],
                [{ text: 'عَلَم', meaning: 'ʿalam · flag' }, { text: 'أَلَم', meaning: 'ʾalam · pain' }]],
        tip: 'For <b>ع</b>, tighten the throat as if starting to gag, and keep your voice on: the vowel sounds squeezed. For <b>ء</b>, just stop the air for a moment, like the break in “uh-oh”.',
        focus: 'Focus on the middle (or first) sound.' },
      { key: 'ar-s-s', tag: 'Arabic', title: 'ص or س', sub: 'A heavy (emphatic) s against a plain s.',
        sides: ['ص · ṣ (heavy)', 'س · s'], short: ['ṣ (ص)', 's (س)'],
        pairs: [[{ text: 'صَارَ', meaning: 'ṣāra · it became' }, { text: 'سَارَ', meaning: 'sāra · he walked' }],
                [{ text: 'صَدّ', meaning: 'ṣadd · pushing back' }, { text: 'سَدّ', meaning: 'sadd · dam' }]],
        tip: 'For <b>ص</b>, pull the back of your tongue down and back while saying s: the sound and the vowel after it get darker and heavier. Listen to the vowel as much as the s.',
        focus: 'Listen to the first sound and the vowel after it.' },
      { key: 'ar-t-t', tag: 'Arabic', title: 'ط or ت', sub: 'A heavy (emphatic) ṭ against a plain t.',
        sides: ['ط · ṭ (heavy)', 'ت · t'], short: ['ṭ (ط)', 't (ت)'],
        pairs: [[{ text: 'طَلَّ', meaning: 'ṭalla · he looked out' }, { text: 'تَلّ', meaning: 'tall · hill' }],
                [{ text: 'طَابَ', meaning: 'ṭāba · it was good' }, { text: 'تَابَ', meaning: 'tāba · he repented' }]],
        tip: 'Same trick as ص: for <b>ط</b>, tongue root back, mouth a little rounder; the vowel after it turns darker. <b>ت</b> is a light, crisp t.',
        focus: 'Listen to the first sound and the vowel after it.' },
      { key: 'ar-kh-h', tag: 'Arabic', title: 'خ or ح', sub: 'A scraping kh against the breathy ḥ.',
        sides: ['خ · kh (scrape)', 'ح · ḥ (breath)'], short: ['kh (خ)', 'ḥ (ح)'],
        pairs: [[{ text: 'خَال', meaning: 'khāl · uncle (mother’s brother)' }, { text: 'حَال', meaning: 'ḥāl · state, condition' }],
                [{ text: 'خَدّ', meaning: 'khadd · cheek' }, { text: 'حَدّ', meaning: 'ḥadd · limit' }]],
        tip: 'For <b>خ</b>, scrape the back of your tongue, like the “ch” in Scottish “loch”. For <b>ح</b>, nothing scrapes: it is pure, strong breath from the throat.',
        focus: 'Focus on the first sound.' },
    ],
  };
  const VOICE_LANG = { pt: /^pt[-_]BR$/i, ar: /^ar([-_]|$)/i };
  const LANG_TAG = { pt: 'pt-BR', ar: 'ar' };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  // Best voices first: Google's, then Premium/Enhanced ones; Apple's novelty voices (Eddy, Flo, …) last.
  const NOVELTY = /^(Eddy|Flo|Grandma|Grandpa|Reed|Rocko|Sandy|Shelley|Albert|Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Good News|Jester|Organ|Superstar|Trinoids|Whisper|Wobble|Zarvox|Junior|Ralph|Kathy|Fred)\b/i;
  const voiceRank = v => (/google/i.test(v.name) ? 3 : /premium|enhanced|neural|natural/i.test(v.name) ? 2 : NOVELTY.test(v.name) ? -2 : 0);
  let LANG = 'pt', lesson = LESSONS.pt[0];
  const voices = () => (window.speechSynthesis?.getVoices() || []).filter(v => VOICE_LANG[LANG].test(v.lang)).sort((a, b) => voiceRank(b) - voiceRank(a));
  const pairs = () => lesson.pairs;
  let active = null;

  function stopAudio(r) {
    if (r.speaking) { window.speechSynthesis?.cancel(); r.speaking = false; }
    if (r.cancelSpeech) { r.cancelSpeech(); r.cancelSpeech = null; }
    if (r.audio) { r.audio.pause(); r.audio = null; }
  }
  function releaseRecording(r) {
    clearTimeout(r.recordTimer);
    if (r.recorder?.state === 'recording') r.recorder.stop();
    r.recorder = null;
    r.stream?.getTracks().forEach(t => t.stop()); r.stream = null;
    if (r.recording) URL.revokeObjectURL(r.recording);
    r.recording = null;
  }
  function stop() {
    const r = active;
    if (!r) return;
    active = null; r.serial++;
    stopAudio(r); releaseRecording(r);
    window.speechSynthesis?.removeEventListener('voiceschanged', r.voiceListener);
  }
  function word(sample) { return `<b lang="${LANG_TAG[LANG]}" dir="auto" class="sound-word">${esc(sample.text)}</b> <span class="muted small">${esc(sample.meaning)}</span>`; }
  function draw(r) {
    if (active !== r) return;
    const pair = pairs()[r.pair], d = r.state.sounds?.[lesson.key] || { n: 0, correct: 0 };
    const recording = r.recorder?.state === 'recording', busy = recording || r.pendingMic;
    r.main.querySelector('#sound-voice').disabled = busy || (!voices().length && !r.recorded);
    r.main.querySelector('#sound-practice').innerHTML = `
      <div class="box sound-step">
        <h2>1. Hear the difference</h2>
        <div class="sound-pair">${pair.map((sample, i) => `<button data-sound="example" data-side="${i}" ${busy ? 'disabled' : ''}><span class="sound-label">${esc(lesson.sides[i])}</span><span>▶ ${word(sample)}</span></button>`).join('')}</div>
        <p>${lesson.tip}</p>
        ${pairs().length > 1 ? `<button data-sound="pair" ${busy ? 'disabled' : ''}>Try ${pairs()[(r.pair + 1) % pairs().length].map(x => esc(x.text)).join(' / ')}</button>` : ''}
      </div>
      <div class="box sound-step">
        <div class="rpt-head"><h2>2. Which word did you hear?</h2><span class="small muted">${d.n ? `${d.correct} / ${d.n} first choices correct` : 'Listening progress starts here'}</span></div>
        <p class="muted small">Play a question, then choose. Only your first choice counts.</p>
        <button class="primary" data-sound="quiz" ${busy ? 'disabled' : ''}>${r.trial && !r.trial.answered ? '▶ Replay question' : '▶ New question'}</button>
        <div class="sound-pair">${pair.map((sample, i) => `<button data-sound="answer" data-side="${i}" ${busy || !r.trial?.heard || r.trial.answered ? 'disabled' : ''}>${word(sample)}</button>`).join('')}</div>
        <p class="sound-feedback" role="status">${r.feedback || ''}</p>
      </div>
      <div class="box sound-step">
        <h2>3. Say it and compare</h2>
        <p class="muted small">Choose a word, listen, then record yourself saying it. ${esc(lesson.focus)}</p>
        <div class="sound-pair">${pair.map((sample, i) => `<button data-sound="target" data-side="${i}" aria-pressed="${r.side === i}" class="${r.side === i ? 'on' : ''}" ${busy ? 'disabled' : ''}>${word(sample)}</button>`).join('')}</div>
        <div class="row sound-actions">
          <button data-sound="model" ${busy ? 'disabled' : ''}>▶ Original</button>
          <button data-sound="record" ${r.pendingMic ? 'disabled' : ''}>${recording ? '■ Stop recording' : '🎙 Record'}</button>
          <button data-sound="mine" ${!r.recording || busy ? 'disabled' : ''}>▶ Listen to me</button>
          <button data-sound="compare" ${!r.recording || busy ? 'disabled' : ''}>▶ Original, then me</button>
        </div>
        <p id="sound-status" role="status">${esc(r.status || '')}</p>
        <p class="muted small">Compare by ear: can you hear the sound you intended? Recordings stay on this device and are discarded when you leave. Listening progress is separate from pronunciation clarity.</p>
      </div>`;
  }
  function refreshVoices(r) {
    if (active !== r) return;
    const list = voices(), select = r.main.querySelector('#sound-voice');
    select.innerHTML = (r.recorded ? `<option value="recorded">${esc(r.recordedName)} (recorded)</option>` : '')
      + list.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}${NOVELTY.test(v.name) ? ' (novelty voice)' : ''}</option>`).join('');
    // r.voice is the learner's saved choice; r.use is what plays: that choice if still available,
    // else the recorded voice, else the best device voice.
    r.use = r.voice === 'recorded' && r.recorded ? 'recorded'
      : list.some(v => v.voiceURI === r.voice) ? r.voice
      : r.recorded ? 'recorded' : list[0]?.voiceURI;
    if (r.use) select.value = r.use;
    select.disabled = !list.length && !r.recorded;
    r.main.querySelector('#sound-voice-note').textContent = r.recorded
      ? `Examples use a recorded ${LANG === 'pt' ? 'Brazilian' : 'Arabic'} voice. Try a device voice too: hearing several speakers makes the contrast easier to catch.`
      : list.length
        ? `Practice examples use a device voice. ${LANG === 'pt' ? 'On a Mac, “Luciana (Premium)”' : 'On a Mac, “Majed (Premium)”'} (System Settings → Accessibility → Spoken Content → Manage Voices) sounds much more natural.`
        : `No ${LANG === 'pt' ? 'Brazilian Portuguese' : 'Arabic'} voice is available on this device. Add one in your device's speech settings, then reopen this tab.`;
  }
  async function recordedAudio(r, sample) {
    // The app's recorded voice for this word, if there is one (null otherwise).
    if (!r.fetchAudio) return null;
    if (sample._url !== undefined) return sample._url;
    try {
      const res = await r.fetchAudio('nl', sample.text);
      sample._url = res.ok ? URL.createObjectURL(await res.blob()) : null;
    } catch (e) { sample._url = null; }
    return sample._url;
  }
  async function speak(r, sample) {
    stopAudio(r);
    if (r.use === 'recorded') {
      const url = await recordedAudio(r, sample);
      if (url) {
        return new Promise(resolve => {
          const a = r.audio = new Audio(url);
          const timer = setTimeout(() => { a.pause(); resolve(false); }, 12000);
          a.onended = () => { clearTimeout(timer); resolve(true); };
          a.onerror = () => { clearTimeout(timer); resolve(false); };
          a.play().catch(() => { clearTimeout(timer); resolve(false); });
        });
      }
    }
    const voice = voices().find(v => v.voiceURI === r.use) || voices().find(v => v.voiceURI === r.voice) || voices()[0];
    if (!voice || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    return new Promise(resolve => {
      let finished = false;
      const utterance = new window.SpeechSynthesisUtterance(sample.text);
      utterance.voice = voice; utterance.lang = LANG_TAG[LANG]; utterance.rate = 0.9;
      const finish = ok => {
        if (finished) return;
        finished = true; clearTimeout(timer); r.speaking = false; r.cancelSpeech = null; resolve(ok);
      };
      utterance.onend = () => finish(true);
      utterance.onerror = () => finish(false);
      const timer = setTimeout(() => { if (r.speaking) window.speechSynthesis.cancel(); r.speaking = false; finish(false); }, 12000);
      r.cancelSpeech = () => finish(false); r.speaking = true;
      try { window.speechSynthesis.speak(utterance); } catch (e) { r.speaking = false; finish(false); }
    });
  }
  async function quiz(r) {
    const serial = ++r.serial;
    if (!r.trial || r.trial.answered) r.trial = { side: Math.floor(Math.random() * 2), heard: false, answered: false };
    r.trial.heard = false; r.feedback = ''; r.status = ''; draw(r);
    const ok = await speak(r, pairs()[r.pair][r.trial.side]);
    if (active !== r || r.serial !== serial) return;
    r.trial.heard = ok;
    if (!ok) r.status = 'Audio could not finish. Pick another practice voice and replay the question.';
    draw(r);
  }
  function answer(r, side) {
    const trial = r.trial;
    if (!trial?.heard || trial.answered) return;
    trial.answered = true;
    const soundState = r.state.sounds || (r.state.sounds = {});
    const d = soundState[lesson.key] || (soundState[lesson.key] = { n: 0, correct: 0 });
    d.n++; if (side === trial.side) d.correct++;
    const sample = pairs()[r.pair][trial.side];
    r.feedback = `${side === trial.side ? '✓ You heard it.' : 'Listen to the two examples again.'} It was ${word(sample)} — ${esc(lesson.short[trial.side])}.`;
    r.save(); draw(r);
  }
  async function record(r) {
    if (r.recorder?.state === 'recording') { r.recorder.stop(); return; }
    if (r.pendingMic) return;
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      r.status = 'Recording is unavailable here. Listen and repeat aloud, or open this page in a browser that supports microphone recording.'; draw(r); return;
    }
    stopAudio(r); releaseRecording(r);
    const serial = ++r.serial;
    r.pendingMic = true; r.status = 'Opening the microphone…'; draw(r);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (active !== r || r.serial !== serial) { stream.getTracks().forEach(t => t.stop()); return; }
      const chunks = [], recorder = new window.MediaRecorder(stream);
      r.stream = stream; r.recorder = recorder;
      recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
      recorder.onstop = () => {
        clearTimeout(r.recordTimer); stream.getTracks().forEach(t => t.stop());
        if (active !== r || r.serial !== serial) return;
        r.stream = null; r.recorder = null;
        if (chunks.length && !r.recordError) r.recording = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
        r.status = r.recordError ? 'Recording failed. Please try again.' : chunks.length ? 'Recorded. Listen to the original and you.' : 'No audio was recorded. Try again.'; draw(r);
      };
      recorder.onerror = () => {
        r.recordError = true;
        if (recorder.state === 'recording') recorder.stop();
        stream.getTracks().forEach(t => t.stop());
        if (active === r && r.serial === serial) { r.status = 'Recording failed. Please try again.'; draw(r); }
      };
      r.recordError = false;
      recorder.start();
      r.recordTimer = setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 8000);
      r.status = 'Recording… say the selected word, then tap Stop recording.';
    } catch (e) {
      stream?.getTracks().forEach(t => t.stop());
      if (active === r && r.serial === serial) r.status = 'Microphone access is unavailable. Allow it in your browser to record, or continue listening.';
    } finally { r.pendingMic = false; if (active === r) draw(r); }
  }
  async function action(r, act, side) {
    if (act === 'record') return record(r);
    if (r.pendingMic || r.recorder?.state === 'recording') return;
    if (act === 'quiz') return quiz(r);
    if (act === 'answer') return answer(r, side);
    const serial = ++r.serial;
    stopAudio(r);
    if (act === 'pair' || act === 'target') {
      releaseRecording(r);
      if (act === 'pair') r.pair = (r.pair + 1) % pairs().length; else r.side = side;
      r.trial = null; r.feedback = ''; r.status = ''; draw(r); return;
    }
    if (act === 'example' || act === 'model') {
      if (r.trial && !r.trial.answered) { r.trial = null; draw(r); }
      const ok = await speak(r, pairs()[r.pair][act === 'example' ? side : r.side]);
      if (!ok && active === r && r.serial === serial) { r.status = 'Audio is unavailable. Pick another practice voice.'; draw(r); }
      return;
    }
    const recording = r.recording;
    if (!recording) return;
    if (act === 'compare' && !(await speak(r, pairs()[r.pair][r.side]))) {
      if (active === r && r.serial === serial) { r.status = 'The original could not play. You can still listen to your recording.'; draw(r); }
      return;
    }
    if (active !== r || r.serial !== serial) return;
    r.audio = new Audio(recording);
    r.audio.play().catch(() => { if (active === r && r.serial === serial) { r.status = 'Playback was blocked. Tap Listen to me to try again.'; draw(r); } });
  }
  async function render({ main, state, save, lang = 'pt', fetchAudio, recordedName }) {
    stop();
    LANG = LESSONS[lang] ? lang : 'pt';
    const list = LESSONS[LANG];
    const saved = state.settings?.soundLesson?.[LANG];
    lesson = list.find(l => l.key === saved) || list[0];
    const r = active = { main, state, save, fetchAudio, recordedName: recordedName || 'App voice', pair: 0, side: 0, serial: 0,
      voice: state.settings?.soundVoice?.[LANG] || (LANG === 'pt' ? state.settings?.soundVoiceBR : undefined) };
    main.innerHTML = `<div class="sound-heading"><span class="chip">${esc(lesson.tag)} · lesson ${list.indexOf(lesson) + 1} of ${list.length}</span><h1 dir="auto">${esc(lesson.title)}</h1><p class="muted">${esc(lesson.sub)}</p>
        ${list.length > 1 ? `<div class="chips sound-lessons">${list.map(l => `<button class="chip ${l === lesson ? 'on' : ''}" data-lesson="${esc(l.key)}" dir="auto">${esc(l.title)}</button>`).join('')}</div>` : ''}</div>
      <div class="box sound-voices"><label for="sound-voice">Practice voice</label> <select id="sound-voice" aria-describedby="sound-voice-note"></select><p id="sound-voice-note" class="small muted"></p></div>
      <div id="sound-practice"></div>
      ${lesson.clips ? `<div class="box sound-step"><h2>4. Hear it in real speech</h2>
        <p>Listen for the sound in these conversations from your library.</p>
        <div class="sound-pair">${lesson.clips.map(c => `<a class="sound-clip" href="${esc(c.href)}"><b lang="${LANG_TAG[LANG]}">${esc(c.text)}</b><span class="small muted">${esc(c.note)}</span></a>`).join('')}</div>
        ${lesson.more ? `<p class="small"><a href="${esc(lesson.more.href)}" target="_blank" rel="noopener noreferrer">${esc(lesson.more.text)}</a></p>` : ''}
      </div>` : ''}`;
    main.addEventListener('click', e => {
      if (active !== r) return;
      const l = e.target.closest('[data-lesson]');
      if (l?.dataset?.lesson) {
        state.settings ||= {}; (state.settings.soundLesson ||= {})[LANG] = l.dataset.lesson; save();
        render({ main, state, save, lang: LANG, fetchAudio, recordedName });
        return;
      }
      const b = e.target.closest('[data-sound]');
      if (b && !b.disabled) action(r, b.dataset.sound, Number(b.dataset.side));
    });
    main.querySelector('#sound-voice').addEventListener('change', e => {
      if (r.pendingMic || r.recorder?.state === 'recording') return;
      r.voice = r.use = e.target.value; r.serial++; stopAudio(r); r.trial = null; r.feedback = ''; draw(r);
      state.settings ||= {}; (state.settings.soundVoice ||= {})[LANG] = r.voice; save();
    });
    r.voiceListener = () => refreshVoices(r);
    window.speechSynthesis?.addEventListener('voiceschanged', r.voiceListener);
    refreshVoices(r); draw(r);
    // Recorded voice: offered when this lesson's first word has a recording.
    r.recorded = !!(await recordedAudio(r, lesson.pairs[0][0]));
    if (active === r) { refreshVoices(r); draw(r); }
  }
  window.Sounds = { render, stop, has: lang => !!LESSONS[lang] };
  window.PortugueseSounds = window.Sounds;  // older name, kept for tests and links
})();
