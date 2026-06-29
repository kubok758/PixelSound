(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);

  const els = {
    stars: $('stars'),
    miniVisual: $('miniVisual'),
    convertedCount: $('convertedCount'),
    homeBtn: $('homeBtn'),
    fileInput: $('fileInput'),
    dropzone: $('dropzone'),
    previewBox: $('previewBox'),
    previewImg: $('previewImg'),
    fileName: $('fileName'),
    fileInfo: $('fileInfo'),
    resolution: $('resolution'),
    resolutionValue: $('resolutionValue'),
    duration: $('duration'),
    durationValue: $('durationValue'),
    detailMode: $('detailMode'),
    instrument: $('instrument'),
    convertBtn: $('convertBtn'),
    emptyState: $('emptyState'),
    progressWrap: $('progressWrap'),
    progressTitle: $('progressTitle'),
    progressPercent: $('progressPercent'),
    progressFill: $('progressFill'),
    player: $('player'),
    trackThumb: $('trackThumb'),
    trackTitle: $('trackTitle'),
    trackStats: $('trackStats'),
    audio: $('audio'),
    playBtn: $('playBtn'),
    stopBtn: $('stopBtn'),
    seek: $('seek'),
    timeNow: $('timeNow'),
    timeTotal: $('timeTotal'),
    downloadAudioBtn: $('downloadAudioBtn'),
    downloadMidiBtn: $('downloadMidiBtn'),
    pianoRoll: $('pianoRoll'),
    clearBtn: $('clearBtn'),
    historyList: $('historyList'),
    clearHistoryBtn: $('clearHistoryBtn')
  };

  const STORE = 'pixelSound.history.v1';
  const COUNT_STORE = 'pixelSound.count.v1';
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  let selectedFile = null;
  let current = {
    audioBlob: null,
    audioUrl: null,
    midiBlob: null,
    midiUrl: null,
    notes: [],
    imageDataUrl: '',
    fileName: '',
    duration: 0,
    detailKey: 'normal',
    visualMax: 3200
  };

  const instruments = {
    piano: { name: 'Акустическое пианино', midi: 0, wave: 'triangle', attack: .006, decay: .12, sustain: .17, release: .55, cutoff: 4200, second: 'sine', detune: 6 },
    musicbox: { name: 'Музыкальная шкатулка', midi: 10, wave: 'sine', attack: .002, decay: .18, sustain: .08, release: .9, cutoff: 9000, second: 'triangle', detune: 1200 },
    organ: { name: 'Церковный орган', midi: 19, wave: 'sine', attack: .02, decay: .06, sustain: .45, release: .38, cutoff: 5000, second: 'square', detune: 1200 },
    guitar: { name: 'Акустическая гитара', midi: 24, wave: 'sawtooth', attack: .006, decay: .16, sustain: .12, release: .45, cutoff: 2600, second: 'triangle', detune: -7 },
    strings: { name: 'Скрипичный ансамбль', midi: 48, wave: 'sawtooth', attack: .16, decay: .16, sustain: .35, release: .95, cutoff: 3600, second: 'sine', detune: 5 },
    pad: { name: 'Тёплый космический пад', midi: 89, wave: 'sine', attack: .45, decay: .25, sustain: .38, release: 1.2, cutoff: 1800, second: 'triangle', detune: 11 },
    sci: { name: 'Научно-фантастический эффект', midi: 101, wave: 'square', attack: .01, decay: .07, sustain: .11, release: .65, cutoff: 2800, second: 'sawtooth', detune: 17 }
  };

  const scale = [0, 2, 3, 5, 7, 8, 10]; // C minor-ish

  const detailProfiles = {
    fast: {
      name: 'Быстро',
      maxHeight: 260,
      maxPixels: 90000,
      minScore: .13,
      baseDensity: 2,
      maxDensity: 5,
      minGapDiv: 15,
      audioMax: 1700,
      midiMax: 2600,
      visualMax: 2400
    },
    normal: {
      name: 'Детально',
      maxHeight: 520,
      maxPixels: 190000,
      minScore: .10,
      baseDensity: 3,
      maxDensity: 8,
      minGapDiv: 21,
      audioMax: 2800,
      midiMax: 5200,
      visualMax: 4200
    },
    photo: {
      name: 'Фото-режим',
      maxHeight: 720,
      maxPixels: 420000,
      minScore: .07,
      baseDensity: 4,
      maxDensity: 12,
      minGapDiv: 30,
      audioMax: 4200,
      midiMax: 9000,
      visualMax: 8500
    }
  };


  init();

  function init() {
    drawStars();
    makeMiniVisual();
    setupEvents();
    updateSliders();
    loadCounter();
    renderHistory();
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    }
  }

  function setupEvents() {
    els.homeBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    els.resolution.addEventListener('input', updateSliders);
    els.duration.addEventListener('input', updateSliders);

    els.fileInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) loadFile(file);
    });

    ['dragenter', 'dragover'].forEach((ev) => els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.add('dragover');
    }));
    ['dragleave', 'drop'].forEach((ev) => els.dropzone.addEventListener(ev, (e) => {
      e.preventDefault();
      els.dropzone.classList.remove('dragover');
    }));
    els.dropzone.addEventListener('drop', (e) => {
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) loadFile(file);
    });

    els.convertBtn.addEventListener('click', convert);
    els.playBtn.addEventListener('click', togglePlay);
    els.stopBtn.addEventListener('click', stopAudio);
    els.seek.addEventListener('input', () => {
      if (!isFinite(els.audio.duration)) return;
      els.audio.currentTime = (Number(els.seek.value) / 1000) * els.audio.duration;
    });
    els.audio.addEventListener('timeupdate', updateAudioTime);
    els.audio.addEventListener('loadedmetadata', updateAudioTime);
    els.audio.addEventListener('ended', () => els.playBtn.textContent = '▶');
    els.downloadAudioBtn.addEventListener('click', () => current.audioBlob && downloadBlob(current.audioBlob, safeBase(current.fileName) + '.wav'));
    els.downloadMidiBtn.addEventListener('click', () => current.midiBlob && downloadBlob(current.midiBlob, safeBase(current.fileName) + '.mid'));
    els.clearBtn.addEventListener('click', clearResult);
    els.clearHistoryBtn.addEventListener('click', () => {
      localStorage.removeItem(STORE);
      renderHistory();
    });
    window.addEventListener('resize', debounce(() => {
      drawStars();
      if (current.notes.length) drawPianoRoll(current.notes, current.duration, current.visualMax);
    }, 120));
  }

  function updateSliders() {
    els.resolutionValue.textContent = els.resolution.value;
    els.durationValue.textContent = els.duration.value;
  }

  async function loadFile(file) {
    if (!file.type.startsWith('image/')) {
      alert('Нужна картинка PNG, JPG или WEBP.');
      return;
    }
    selectedFile = file;
    const dataUrl = await readAsDataURL(file);
    els.previewImg.src = dataUrl;
    els.previewBox.classList.remove('hidden');
    els.fileName.textContent = file.name;
    els.fileInfo.textContent = `${prettyBytes(file.size)} • ${file.type.replace('image/', '').toUpperCase()}`;
    current.imageDataUrl = dataUrl;
    current.fileName = file.name;
  }

  async function convert() {
    if (!selectedFile && !current.imageDataUrl) {
      alert('Сначала выбери картинку.');
      return;
    }
    if (!OfflineCtx) {
      alert('Этот браузер не поддерживает OfflineAudioContext. Попробуй Safari/Chrome поновее.');
      return;
    }

    try {
      els.convertBtn.disabled = true;
      setProgress(4, 'Читаю изображение…');
      els.emptyState.classList.add('hidden');
      els.player.classList.add('hidden');
      els.progressWrap.classList.remove('hidden');

      const imageUrl = current.imageDataUrl || await readAsDataURL(selectedFile);
      const img = await loadImage(imageUrl);
      const resolution = Number(els.resolution.value);
      const duration = Number(els.duration.value);
      const instrumentKey = els.instrument.value;
      const detailKey = els.detailMode.value;

      setProgress(16, 'Сжимаю пиксели…');
      await nextFrame();
      const analysis = analyzeImage(img, resolution, duration, detailKey);
      const notes = analysis.notes;
      if (!notes.length) throw new Error('В картинке почти нет контраста. Попробуй другое фото или увеличь разрешение.');

      setProgress(38, `Создаю ${notes.length} нот…`);
      await nextFrame();
      const midiBlob = makeMidi(notes, instrumentKey, duration, detailKey);

      setProgress(56, 'Синтезирую аудио…');
      await nextFrame();
      const audioBuffer = await renderAudio(notes, instrumentKey, duration, detailKey, (p) => setProgress(56 + Math.round(p * 34), 'Синтезирую аудио…'));

      setProgress(93, 'Кодирую WAV…');
      await nextFrame();
      const audioBlob = encodeWav(audioBuffer);

      if (current.audioUrl) URL.revokeObjectURL(current.audioUrl);
      if (current.midiUrl) URL.revokeObjectURL(current.midiUrl);
      current = {
        audioBlob,
        audioUrl: URL.createObjectURL(audioBlob),
        midiBlob,
        midiUrl: URL.createObjectURL(midiBlob),
        notes,
        imageDataUrl: imageUrl,
        fileName: current.fileName || selectedFile?.name || 'track',
        duration,
        detailKey,
        visualMax: analysis.visualMax
      };

      setProgress(100, 'Готово');
      showResult(analysis, instrumentKey, detailKey);
      addHistory(current, instrumentKey, analysis);
      incrementCounter();
    } catch (err) {
      console.error(err);
      alert(err.message || 'Не получилось сконвертировать файл.');
      els.emptyState.classList.remove('hidden');
    } finally {
      setTimeout(() => els.progressWrap.classList.add('hidden'), 350);
      els.convertBtn.disabled = false;
    }
  }

  function analyzeImage(img, targetWidth, duration, detailKey) {
    const profile = detailProfiles[detailKey] || detailProfiles.normal;
    const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
    let w = Math.max(16, Math.round(targetWidth));
    let h = Math.max(16, Math.round(w * ratio));
    if (h > profile.maxHeight) {
      h = profile.maxHeight;
      w = Math.max(16, Math.round(h / Math.max(.01, ratio)));
    }
    const pixels = w * h;
    if (pixels > profile.maxPixels) {
      const scaleDown = Math.sqrt(profile.maxPixels / pixels);
      w = Math.max(16, Math.round(w * scaleDown));
      h = Math.max(16, Math.round(h * scaleDown));
    }
    const cnv = document.createElement('canvas');
    cnv.width = w;
    cnv.height = h;
    const ctx = cnv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    const columns = [];
    let totalBright = 0;
    let totalSat = 0;
    let count = 0;

    for (let x = 0; x < w; x++) {
      const candidates = [];
      for (let y = 0; y < h; y++) {
        const i = (y * w + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const a = data[i + 3] / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const bright = (0.2126 * r + 0.7152 * g + 0.0722 * b) * a;
        const sat = max === 0 ? 0 : (max - min) / max;
        const colorPush = sat * 0.35;
        const score = bright * 0.75 + colorPush + edgeScore(data, w, h, x, y) * 0.28;
        totalBright += bright;
        totalSat += sat;
        count++;
        if (score > profile.minScore) candidates.push({ x, y, r, g, b, bright, sat, score });
      }
      candidates.sort((a, b) => b.score - a.score);
      columns.push(candidates);
    }

    const avgBright = totalBright / Math.max(1, count);
    const avgSat = totalSat / Math.max(1, count);
    const densityTarget = Math.max(2, Math.min(profile.maxDensity, Math.round(profile.baseDensity + avgSat * 5 + avgBright * 3)));
    const notes = [];
    const step = duration / w;
    const minGapY = Math.max(1, Math.floor(h / profile.minGapDiv));

    for (let x = 0; x < w; x++) {
      const chosen = [];
      const pool = columns[x];
      const threshold = Math.max(profile.minScore, avgBright * .50 + avgSat * .08);
      for (const p of pool) {
        if (chosen.length >= densityTarget) break;
        if (p.score < threshold && chosen.length >= 1) continue;
        if (chosen.some(q => Math.abs(q.y - p.y) < minGapY)) continue;
        chosen.push(p);
      }
      const time = x * step;
      for (const p of chosen) {
        const pitch01 = 1 - (p.y / Math.max(1, h - 1));
        const note = noteFromScale(pitch01, p.sat, p.bright);
        const velocity = clamp(0.16 + p.score * 0.8, 0.12, 0.95);
        const hue = rgbToHue(p.r, p.g, p.b);
        const length = clamp(step * (1.15 + p.bright * 1.75 + p.sat * .8), .08, 2.7);
        notes.push({ time, duration: length, midi: note, velocity, hue, y: p.y, x, bright: p.bright, sat: p.sat });
      }
    }

    notes.sort((a, b) => a.time - b.time || a.midi - b.midi);
    return { notes, width: w, height: h, avgBright, avgSat, thumb: cnv.toDataURL('image/png'), detailName: profile.name, audioMax: profile.audioMax, midiMax: profile.midiMax, visualMax: profile.visualMax }; 
  }

  function edgeScore(data, w, h, x, y) {
    if (x <= 0 || y <= 0 || x >= w - 1 || y >= h - 1) return 0;
    const lum = (xx, yy) => {
      const i = (yy * w + xx) * 4;
      return (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    };
    return Math.min(1, Math.abs(lum(x - 1, y) - lum(x + 1, y)) + Math.abs(lum(x, y - 1) - lum(x, y + 1)));
  }

  function noteFromScale(pos, sat, bright) {
    const octaves = 4;
    const scaleIndex = Math.floor(clamp(pos, 0, 1) * (scale.length * octaves - 1));
    const octave = Math.floor(scaleIndex / scale.length);
    const degree = scale[scaleIndex % scale.length];
    let midi = 45 + octave * 12 + degree;
    if (sat > .65 && bright > .45) midi += 12;
    if (bright < .18) midi -= 12;
    return clamp(Math.round(midi), 33, 92);
  }

  async function renderAudio(notes, instrumentKey, duration, detailKey, onProgress) {
    const sampleRate = 44100;
    const ctx = new OfflineCtx(2, Math.ceil((duration + 3) * sampleRate), sampleRate);
    const master = ctx.createGain();
    master.gain.value = 0.72;

    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 24;
    compressor.ratio.value = 7;
    compressor.attack.value = .004;
    compressor.release.value = .2;

    master.connect(compressor);
    compressor.connect(ctx.destination);

    const inst = instruments[instrumentKey] || instruments.piano;
    const profile = detailProfiles[detailKey] || detailProfiles.normal;
    const maxNotes = Math.min(notes.length, profile.audioMax); // защита от смерти на мобилках, но с фото-режимом нот больше
    const selected = downsampleNotes(notes, maxNotes);

    for (let i = 0; i < selected.length; i++) {
      scheduleNote(ctx, master, selected[i], inst);
      if (i % 160 === 0) {
        onProgress?.(i / selected.length * .45);
        await nextFrame();
      }
    }

    const buffer = await ctx.startRendering();
    onProgress?.(1);
    return buffer;
  }

  function downsampleNotes(notes, maxNotes) {
    if (notes.length <= maxNotes) return notes;
    const step = notes.length / maxNotes;
    const out = [];
    for (let i = 0; i < maxNotes; i++) out.push(notes[Math.floor(i * step)]);
    return out;
  }

  function scheduleNote(ctx, destination, note, inst) {
    const start = Math.max(0, note.time);
    const dur = Math.max(.05, note.duration);
    const freq = midiToFreq(note.midi);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(inst.cutoff + note.velocity * 1000, start);
    filter.Q.value = instrumentQ(inst);

    const gain = ctx.createGain();
    const peak = Math.min(.24, note.velocity * .14);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak), start + inst.attack + 0.002);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, peak * inst.sustain), start + inst.attack + inst.decay + 0.003);
    gain.gain.setValueAtTime(Math.max(0.001, peak * inst.sustain), start + dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur + inst.release);

    const osc = ctx.createOscillator();
    osc.type = inst.wave;
    osc.frequency.setValueAtTime(freq, start);
    if (inst === instruments.sci) {
      osc.frequency.linearRampToValueAtTime(freq * (note.hue > 180 ? 1.02 : .985), start + dur);
    }
    osc.connect(filter);

    const gain2 = ctx.createGain();
    gain2.gain.value = inst.second === 'square' ? .045 : .07;
    const osc2 = ctx.createOscillator();
    osc2.type = inst.second || 'sine';
    const detuneFreq = inst.detune && Math.abs(inst.detune) >= 1000 ? freq * 2 : freq;
    osc2.frequency.setValueAtTime(detuneFreq, start);
    osc2.detune.value = Math.abs(inst.detune || 0) < 1000 ? (inst.detune || 0) : 0;
    osc2.connect(gain2);
    gain2.connect(filter);

    filter.connect(gain);
    gain.connect(destination);
    osc.start(start);
    osc.stop(start + dur + inst.release + .05);
    osc2.start(start);
    osc2.stop(start + dur + inst.release + .05);
  }

  function instrumentQ(inst) {
    if (inst === instruments.musicbox) return 7;
    if (inst === instruments.organ) return 1.4;
    if (inst === instruments.sci) return 10;
    return 2.2;
  }

  function makeMidi(notes, instrumentKey, duration, detailKey) {
    const ticksPerBeat = 480;
    const bpm = 120;
    const ticksPerSecond = ticksPerBeat * bpm / 60;
    const inst = instruments[instrumentKey] || instruments.piano;
    const profile = detailProfiles[detailKey] || detailProfiles.normal;
    const events = [];
    events.push({ tick: 0, data: [0xC0, inst.midi] });
    const selected = downsampleNotes(notes, profile.midiMax);
    for (const n of selected) {
      const start = Math.max(0, Math.round(n.time * ticksPerSecond));
      const end = Math.max(start + 20, Math.round((n.time + n.duration) * ticksPerSecond));
      const vel = Math.round(clamp(n.velocity, .1, .95) * 118);
      events.push({ tick: start, data: [0x90, n.midi, vel] });
      events.push({ tick: end, data: [0x80, n.midi, 0] });
    }
    events.push({ tick: Math.round((duration + 1) * ticksPerSecond), data: [0xFF, 0x2F, 0x00] });
    events.sort((a, b) => a.tick - b.tick || a.data[0] - b.data[0]);

    const track = [];
    // tempo meta event, 120 BPM = 500000 microseconds per quarter
    track.push(...vlq(0), 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20);
    let lastTick = 0;
    for (const ev of events) {
      const delta = Math.max(0, ev.tick - lastTick);
      track.push(...vlq(delta), ...ev.data);
      lastTick = ev.tick;
    }

    const header = [
      ...ascii('MThd'), ...u32(6), ...u16(0), ...u16(1), ...u16(ticksPerBeat),
      ...ascii('MTrk'), ...u32(track.length), ...track
    ];
    return new Blob([new Uint8Array(header)], { type: 'audio/midi' });
  }

  function encodeWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const length = buffer.length * numChannels * 2 + 44;
    const arrayBuffer = new ArrayBuffer(length);
    const view = new DataView(arrayBuffer);
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + buffer.length * numChannels * 2, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * 2, true);
    view.setUint16(32, numChannels * 2, true);
    view.setUint16(34, 16, true);
    writeString(view, 36, 'data');
    view.setUint32(40, buffer.length * numChannels * 2, true);

    let offset = 44;
    const channels = [];
    for (let i = 0; i < numChannels; i++) channels.push(buffer.getChannelData(i));
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        const s = Math.max(-1, Math.min(1, channels[ch][i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
    }
    return new Blob([view], { type: 'audio/wav' });
  }

  function showResult(analysis, instrumentKey, detailKey) {
    els.player.classList.remove('hidden');
    els.emptyState.classList.add('hidden');
    els.trackThumb.src = current.imageDataUrl || analysis.thumb;
    els.trackTitle.textContent = `${safeBase(current.fileName)}.wav`;
    const rendered = Math.min(analysis.notes.length, analysis.audioMax);
    els.trackStats.textContent = `${analysis.notes.length} нот • аудио ${rendered} • ${analysis.width}×${analysis.height}px • ${analysis.detailName} • ${instruments[instrumentKey].name}`;
    els.audio.src = current.audioUrl;
    els.timeTotal.textContent = formatTime(current.duration);
    els.playBtn.textContent = '▶';
    drawPianoRoll(analysis.notes, current.duration, analysis.visualMax);
  }

  function drawPianoRoll(notes, duration, visualMax = 3200) {
    const canvas = els.pianoRoll;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(500, Math.floor(rect.width * dpr));
    canvas.height = Math.floor(310 * dpr);
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = 'rgba(255,255,255,.018)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,.055)';
    ctx.lineWidth = 1 * dpr;
    for (let x = 0; x < w; x += 16 * dpr) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += 14 * dpr) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const minMidi = 32;
    const maxMidi = 96;
    const visible = downsampleNotes(notes, visualMax);
    for (const n of visible) {
      const x = (n.time / duration) * w;
      const nw = Math.max(2 * dpr, (n.duration / duration) * w);
      const y = h - ((n.midi - minMidi) / (maxMidi - minMidi)) * h;
      const hue = Math.round(n.hue || 0);
      ctx.fillStyle = `hsla(${hue}, 75%, ${55 + n.velocity * 22}%, ${0.35 + n.velocity * 0.45})`;
      roundRect(ctx, x, y - 4 * dpr, nw, 7 * dpr, 3 * dpr);
      ctx.fill();
    }
  }

  function addHistory(item, instrumentKey, analysis) {
    const arr = getHistory();
    const record = {
      name: item.fileName,
      date: Date.now(),
      instrument: instruments[instrumentKey].name,
      notes: analysis.notes.length,
      duration: item.duration,
      image: shrinkDataUrl(item.imageDataUrl)
    };
    arr.unshift(record);
    localStorage.setItem(STORE, JSON.stringify(arr.slice(0, 8)));
    renderHistory();
  }

  function renderHistory() {
    const arr = getHistory();
    els.historyList.innerHTML = '';
    if (!arr.length) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'Пока пусто.';
      els.historyList.appendChild(empty);
      return;
    }
    for (const item of arr) {
      const row = document.createElement('div');
      row.className = 'historyItem';
      row.innerHTML = `
        <img src="${item.image}" alt="">
        <div><b>${escapeHtml(item.name)}</b><small>${formatDate(item.date)} • ${item.notes} нот • ${item.duration} сек • ${escapeHtml(item.instrument)}</small></div>
        <button class="ghostBtn small" type="button">Открыть</button>
      `;
      row.querySelector('button').addEventListener('click', async () => {
        current.imageDataUrl = item.image;
        current.fileName = item.name;
        selectedFile = null;
        els.previewImg.src = item.image;
        els.previewBox.classList.remove('hidden');
        els.fileName.textContent = item.name;
        els.fileInfo.textContent = 'из истории';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      els.historyList.appendChild(row);
    }
  }

  function getHistory() {
    try { return JSON.parse(localStorage.getItem(STORE) || '[]'); }
    catch { return []; }
  }

  function clearResult() {
    stopAudio();
    if (current.audioUrl) URL.revokeObjectURL(current.audioUrl);
    if (current.midiUrl) URL.revokeObjectURL(current.midiUrl);
    current.audioBlob = null;
    current.audioUrl = null;
    current.midiBlob = null;
    current.midiUrl = null;
    current.notes = [];
    els.player.classList.add('hidden');
    els.emptyState.classList.remove('hidden');
  }

  function togglePlay() {
    if (!els.audio.src) return;
    if (els.audio.paused) {
      els.audio.play().then(() => els.playBtn.textContent = '❚❚').catch((e) => alert(e.message));
    } else {
      els.audio.pause();
      els.playBtn.textContent = '▶';
    }
  }

  function stopAudio() {
    els.audio.pause();
    els.audio.currentTime = 0;
    els.playBtn.textContent = '▶';
    updateAudioTime();
  }

  function updateAudioTime() {
    const dur = isFinite(els.audio.duration) ? els.audio.duration : current.duration || 0;
    const now = els.audio.currentTime || 0;
    els.timeNow.textContent = formatTime(now);
    els.timeTotal.textContent = formatTime(dur);
    els.seek.value = dur ? String(Math.round(now / dur * 1000)) : '0';
  }

  function setProgress(percent, title) {
    const p = clamp(Math.round(percent), 0, 100);
    els.progressFill.style.width = p + '%';
    els.progressPercent.textContent = p + '%';
    els.progressTitle.textContent = title;
  }

  function incrementCounter() {
    const n = Number(localStorage.getItem(COUNT_STORE) || '0') + 1;
    localStorage.setItem(COUNT_STORE, String(n));
    els.convertedCount.textContent = String(n);
  }

  function loadCounter() {
    els.convertedCount.textContent = localStorage.getItem(COUNT_STORE) || '0';
  }

  function drawStars() {
    const canvas = els.stars;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    canvas.width = Math.floor(window.innerWidth * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const dots = Math.round((window.innerWidth * window.innerHeight) / 14500);
    for (let i = 0; i < dots; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const r = (Math.random() * 2.1 + .5) * dpr;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * .13 + .05})`;
      ctx.fill();
    }
  }

  function makeMiniVisual() {
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 85; i++) {
      const dot = document.createElement('i');
      dot.className = 'noteDot';
      dot.style.left = `${Math.random() * 100}%`;
      dot.style.top = `${Math.random() * 100}%`;
      dot.style.animationDelay = `${Math.random() * 3}s`;
      frag.appendChild(dot);
    }
    els.miniVisual.appendChild(frag);
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Не удалось открыть изображение.'));
      img.src = src;
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function nextFrame() { return new Promise(r => requestAnimationFrame(r)); }
  function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }
  function prettyBytes(bytes) {
    if (!bytes) return '0 Б';
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    let i = 0, n = bytes;
    while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
    return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
  }
  function formatTime(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
  function safeBase(name) {
    return (name || 'pixel-sound').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 70) || 'pixel-sound';
  }
  function rgbToHue(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0;
    const d = max - min;
    if (d === 0) h = 0;
    else if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    return (h + 360) % 360;
  }
  function writeString(view, offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }
  function ascii(str) { return [...str].map(c => c.charCodeAt(0)); }
  function u16(n) { return [(n >> 8) & 255, n & 255]; }
  function u32(n) { return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function vlq(value) {
    let buffer = value & 0x7F;
    const bytes = [];
    while ((value >>= 7)) {
      buffer <<= 8;
      buffer |= ((value & 0x7F) | 0x80);
    }
    while (true) {
      bytes.push(buffer & 0xFF);
      if (buffer & 0x80) buffer >>= 8;
      else break;
    }
    return bytes;
  }
  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
  function formatDate(ts) {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  }
  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
  }
  function shrinkDataUrl(dataUrl) {
    return dataUrl; // оставляем оригинал: история маленькая, максимум 8 файлов
  }
})();
