// Small Brazilian Portuguese sound lessons. Listening choices are measured; recordings are self-compared.
(() => {
  const pairs = [
    [{ text: 'avó', meaning: 'grandmother' }, { text: 'avô', meaning: 'grandfather' }],
    [{ text: 'bisavó', meaning: 'great-grandmother' }, { text: 'bisavô', meaning: 'great-grandfather' }],
  ];
  const key = 'pt-BR-open-closed-o';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const voices = () => (window.speechSynthesis?.getVoices() || []).filter(v => /^pt[-_]BR$/i.test(v.lang));
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
  function word(sample) { return `<b lang="pt-BR">${esc(sample.text)}</b> <span class="muted small">${esc(sample.meaning)}</span>`; }
  function draw(r) {
    if (active !== r) return;
    const pair = pairs[r.pair], d = r.state.sounds?.[key] || { n: 0, correct: 0 };
    const recording = r.recorder?.state === 'recording', busy = recording || r.pendingMic;
    r.main.querySelector('#sound-voice').disabled = busy || !voices().length;
    r.main.querySelector('#sound-practice').innerHTML = `
      <div class="box sound-step">
        <h2>1. Hear the difference</h2>
        <div class="sound-pair">${pair.map((sample, i) => `<button data-sound="example" data-side="${i}" ${busy ? 'disabled' : ''}><span class="sound-label">${i ? 'Closed ô · /o/' : 'Open ó · /ɔ/'}</span><span>▶ ${word(sample)}</span></button>`).join('')}</div>
        <p>Stress the last syllable in both words. For <b>ó</b>, open your jaw a little more. For <b>ô</b>, raise your tongue slightly and round your lips a little more. Keep each vowel steady.</p>
        <button data-sound="pair" ${busy ? 'disabled' : ''}>${r.pair ? 'Back to avó / avô' : 'Try bisavó / bisavô'}</button>
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
        <p class="muted small">Choose a word, listen, then record yourself saying it. Focus on the last vowel.</p>
        <div class="sound-pair">${pair.map((sample, i) => `<button data-sound="target" data-side="${i}" aria-pressed="${r.side === i}" class="${r.side === i ? 'on' : ''}" ${busy ? 'disabled' : ''}>${word(sample)}</button>`).join('')}</div>
        <div class="row sound-actions">
          <button data-sound="model" ${busy ? 'disabled' : ''}>▶ Original</button>
          <button data-sound="record" ${r.pendingMic ? 'disabled' : ''}>${recording ? '■ Stop recording' : '🎙 Record'}</button>
          <button data-sound="mine" ${!r.recording || busy ? 'disabled' : ''}>▶ Listen to me</button>
          <button data-sound="compare" ${!r.recording || busy ? 'disabled' : ''}>▶ Original, then me</button>
        </div>
        <p id="sound-status" role="status">${esc(r.status || '')}</p>
        <p class="muted small">Compare by ear: can you hear the vowel you intended? Recordings stay on this device and are discarded when you leave. Listening progress is separate from pronunciation clarity.</p>
      </div>`;
  }
  function refreshVoices(r) {
    if (active !== r) return;
    const list = voices(), select = r.main.querySelector('#sound-voice');
    select.innerHTML = list.map(v => `<option value="${esc(v.voiceURI)}">${esc(v.name)}</option>`).join('');
    if (list.some(v => v.voiceURI === r.voice)) select.value = r.voice;
    else if (list.length) r.voice = list[0].voiceURI;
    select.disabled = !list.length;
    r.main.querySelector('#sound-voice-note').textContent = list.length
      ? 'Practice examples use a Brazilian Portuguese device voice. Try another voice as the contrast gets easier.'
      : 'No Brazilian Portuguese voice is available yet. Add a Brazilian Portuguese speech voice in your device settings, then reopen this section. You can still hear the real-video examples below.';
  }
  function speak(r, sample) {
    stopAudio(r);
    const voice = voices().find(v => v.voiceURI === r.voice) || voices()[0];
    if (!voice || !window.SpeechSynthesisUtterance) return Promise.resolve(false);
    return new Promise(resolve => {
      let finished = false;
      const utterance = new window.SpeechSynthesisUtterance(sample.text);
      utterance.voice = voice; utterance.lang = 'pt-BR'; utterance.rate = 0.9;
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
    const ok = await speak(r, pairs[r.pair][r.trial.side]);
    if (active !== r || r.serial !== serial) return;
    r.trial.heard = ok;
    if (!ok) r.status = 'Audio could not finish. Select a Brazilian Portuguese voice and replay the question.';
    draw(r);
  }
  function answer(r, side) {
    const trial = r.trial;
    if (!trial?.heard || trial.answered) return;
    trial.answered = true;
    const soundState = r.state.sounds || (r.state.sounds = {});
    const d = soundState[key] || (soundState[key] = { n: 0, correct: 0 });
    d.n++; if (side === trial.side) d.correct++;
    const sample = pairs[r.pair][trial.side];
    r.feedback = `${side === trial.side ? '✓ You heard it.' : 'Listen to the two examples again.'} It was ${word(sample)} — ${trial.side ? 'closed ô' : 'open ó'}.`;
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
      if (act === 'pair') r.pair = 1 - r.pair; else r.side = side;
      r.trial = null; r.feedback = ''; r.status = ''; draw(r); return;
    }
    if (act === 'example' || act === 'model') {
      if (r.trial && !r.trial.answered) { r.trial = null; draw(r); }
      const ok = await speak(r, pairs[r.pair][act === 'example' ? side : r.side]);
      if (!ok && active === r && r.serial === serial) { r.status = 'Audio is unavailable. Select a Brazilian Portuguese voice or try the real-video examples.'; draw(r); }
      return;
    }
    const recording = r.recording;
    if (!recording) return;
    if (act === 'compare' && !(await speak(r, pairs[r.pair][r.side]))) {
      if (active === r && r.serial === serial) { r.status = 'The original could not play. You can still listen to your recording.'; draw(r); }
      return;
    }
    if (active !== r || r.serial !== serial) return;
    r.audio = new Audio(recording);
    r.audio.play().catch(() => { if (active === r && r.serial === serial) { r.status = 'Playback was blocked. Tap Listen to me to try again.'; draw(r); } });
  }
  function render({ main, state, save }) {
    stop();
    const r = active = { main, state, save, pair: 0, side: 0, serial: 0, voice: state.settings?.soundVoiceBR };
    main.innerHTML = `<div class="sound-heading"><span class="chip">Brazilian Portuguese · lesson 1</span><h1>One vowel, two meanings</h1><p class="muted">Learn to hear and make the difference between open ó and closed ô.</p></div>
      <div class="box sound-voices"><label for="sound-voice">Practice voice</label> <select id="sound-voice" aria-describedby="sound-voice-note"></select><p id="sound-voice-note" class="small muted"></p></div>
      <div id="sound-practice"></div>
      <div class="box sound-step"><h2>4. Hear it in real speech</h2>
        <p>Listen for the last vowel in these Brazilian conversations from your library.</p>
        <div class="sound-pair"><a class="sound-clip" href="#watch/kGX1vVJU6tk?t=677"><b lang="pt-BR">Você lembra da sua avó?</b><span class="small muted">Easy Portuguese · grandmother · 11:18</span></a><a class="sound-clip" href="#watch/7R927spyHe8?t=240"><b lang="pt-BR">O meu avô é fundador da cidade…</b><span class="small muted">Easy Portuguese · grandfather · 4:00</span></a></div>
        <p class="small"><a href="https://coerll.utexas.edu/brazilpod/tafalado/lesson-04.html" target="_blank" rel="noopener noreferrer">More explanation and Brazilian recordings: UT Austin’s Tá Falado →</a></p>
      </div>`;
    main.addEventListener('click', e => {
      if (active !== r) return;
      const b = e.target.closest('[data-sound]');
      if (b && !b.disabled) action(r, b.dataset.sound, Number(b.dataset.side));
    });
    main.querySelector('#sound-voice').addEventListener('change', e => {
      if (r.pendingMic || r.recorder?.state === 'recording') return;
      r.voice = e.target.value; r.serial++; stopAudio(r); r.trial = null; r.feedback = ''; draw(r);
      state.settings ||= {}; state.settings.soundVoiceBR = r.voice; save();
    });
    r.voiceListener = () => refreshVoices(r);
    window.speechSynthesis?.addEventListener('voiceschanged', r.voiceListener);
    refreshVoices(r); draw(r);
  }
  window.PortugueseSounds = { render, stop };
})();
