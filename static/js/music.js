/**
 * MusicEngine — a tiny generative ambient loop built entirely from
 * Web Audio API oscillators. Nothing here is sampled, downloaded, or
 * copied from any existing recording, so there's no copyright concern
 * — it's synthesized fresh every time it plays.
 *
 * Usage: MusicEngine.play() / MusicEngine.stop() / MusicEngine.isPlaying()
 */
window.MusicEngine = (function () {
  let ctx = null;
  let masterGain = null;
  let filterNode = null;
  let playing = false;
  let schedulerTimer = null;
  let nextChordTime = 0;
  let chordIndex = 0;

  // A calm four-chord loop (Am7 - Fmaj7 - C - G), spelled out as
  // frequencies so no external notation/library is needed.
  const CHORDS = [
    [220.00, 261.63, 329.63, 392.00], // A3 C4 E4 G4  (Am7)
    [174.61, 220.00, 261.63, 349.23], // F3 A3 C4 F4  (Fmaj7)
    [130.81, 164.81, 196.00, 261.63], // C3 E3 G3 C4  (C)
    [196.00, 246.94, 293.66, 392.00], // G3 B3 D4 G4  (G)
  ];
  const CHORD_DURATION = 6.5; // seconds per chord

  function ensureContext() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.value = 1500;
    masterGain.connect(filterNode);
    filterNode.connect(ctx.destination);
  }

  // Soft, slow-swelling pad tone for a chord note
  function playPad(freq, startTime, duration) {
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq * 1.004; // gentle detune for warmth

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.linearRampToValueAtTime(0.05, startTime + 1.4);
    g.gain.linearRampToValueAtTime(0.0001, startTime + duration);

    osc1.connect(g);
    osc2.connect(g);
    g.connect(masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc1.stop(startTime + duration + 0.1);
    osc2.stop(startTime + duration + 0.1);
  }

  // A brief, quiet pluck — sprinkled over the pad for a little movement
  function playPluck(freq, startTime) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, startTime);
    g.gain.exponentialRampToValueAtTime(0.045, startTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.1);

    osc.connect(g);
    g.connect(masterGain);
    osc.start(startTime);
    osc.stop(startTime + 1.2);
  }

  function scheduleChord(time) {
    const chord = CHORDS[chordIndex % CHORDS.length];
    chord.forEach(freq => playPad(freq, time, CHORD_DURATION));

    const pluckCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < pluckCount; i++) {
      const note = chord[Math.floor(Math.random() * chord.length)] * 2; // octave up
      const offset = 0.5 + Math.random() * (CHORD_DURATION - 1.5);
      playPluck(note, time + offset);
    }
    chordIndex++;
  }

  // Lookahead scheduler — keeps queuing chords slightly ahead of time
  // so timing stays tight even if the tab is briefly backgrounded.
  function schedulerLoop() {
    while (nextChordTime < ctx.currentTime + 2) {
      scheduleChord(nextChordTime);
      nextChordTime += CHORD_DURATION;
    }
    schedulerTimer = setTimeout(schedulerLoop, 500);
  }

  function play() {
    ensureContext();
    if (ctx.state === 'suspended') ctx.resume();
    if (playing) return;
    playing = true;
    chordIndex = 0;
    nextChordTime = ctx.currentTime + 0.1;
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.2);
    schedulerLoop();
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (ctx) {
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    }
    clearTimeout(schedulerTimer);
  }

  function isPlaying() {
    return playing;
  }

  return { play, stop, isPlaying };
})();
