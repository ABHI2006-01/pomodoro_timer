/* ==========================================================================
   ZenSpace Application Logic & Web Audio Synthesizer
   ========================================================================== */

// --- MINDFULNESS QUOTES ---
const ZEN_QUOTES = [
  { text: "Do not dwell in the past, do not dream of the future, concentrate the mind on the present moment.", author: "Buddha" },
  { text: "The present moment is filled with joy and happiness. If you are attentive, you will see it.", author: "Thich Nhat Hanh" },
  { text: "Quiet the mind and the soul will speak.", author: "Ma Jaya Sati Bhagavati" },
  { text: "Nature does not hurry, yet everything is accomplished.", author: "Lao Tzu" },
  { text: "You should sit in meditation for twenty minutes every day — unless you're too busy; then you should sit for an hour.", author: "Zen Proverb" },
  { text: "He who is contented is rich.", author: "Lao Tzu" },
  { text: "Flow with whatever may happen, and let your mind be free.", author: "Zhuangzi" },
  { text: "Be here now.", author: "Ram Dass" },
  { text: "Within you, there is a stillness and a sanctuary to which you can retreat at any time.", author: "Hermann Hesse" },
  { text: "Mindfulness isn't difficult, we just need to remember to do it.", author: "Sharon Salzberg" },
  { text: "The feeling that any task is a nuisance to be got through is a symptom of lack of presence.", author: "Alan Watts" },
  { text: "Muddy water is best cleared by leaving it alone.", author: "Alan Watts" },
  { text: "To understand the limitlessness of things, we must first learn to respect limits.", author: "Seneca" },
  { text: "Very little is needed to make a happy life; it is all within yourself, in your way of thinking.", author: "Marcus Aurelius" },
  { text: "With the past, I have nothing to do; nor with the future. I live now.", author: "Ralph Waldo Emerson" }
];

// --- APP STATE ---
const state = {
  // Timer Settings (Default)
  settings: {
    focus: 25 * 60,
    short: 5 * 60,
    long: 15 * 60,
    autoplay: true,
    ticking: false,
    chimePitch: 440
  },
  
  // Active Timer state
  timer: {
    mode: 'focus', // 'focus', 'short', 'long'
    remaining: 25 * 60,
    duration: 25 * 60,
    isRunning: false,
    lastTickTime: null,
    animationFrameId: null
  },

  // Task list
  tasks: [],
  activeTaskId: null,

  // Stats & Streak
  stats: {
    minutesToday: 0,
    sessionsCompleted: 0,
    tasksCompleted: 0,
    streak: 0,
    lastFocusDate: ""
  }
};

// --- AUDIO ENGINE (WEB AUDIO API SYNTHESIZER) ---
class ZenAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.noiseBuffer = null;
    this.masterVolume = 0.7;
    
    // Ambient channels
    this.channels = {
      rain: { isPlaying: false, volume: 0.5, nodes: {} },
      wind: { isPlaying: false, volume: 0.5, nodes: {} },
      hum:  { isPlaying: false, volume: 0.5, nodes: {} },
      fire: { isPlaying: false, volume: 0.5, nodes: {} }
    };
    
    // Interval timers for random scheduling (rain/fire crackles)
    this.schedulers = {
      rainCrackle: null,
      fireCrackle: null
    };
  }

  // Initialize Audio Context on first interaction
  init() {
    if (this.ctx) return;
    
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      
      // Master Gain Node
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      
      // Generate static 2-second white noise buffer for wind/rain
      this.noiseBuffer = this.createNoiseBuffer(2.0);
      
      console.log("Zen Audio Engine Initialized successfully.");
    } catch (e) {
      console.error("Web Audio API not supported in this browser:", e);
    }
  }

  // Helper: Generates a buffer of white noise
  createNoiseBuffer(durationSeconds) {
    const bufferSize = this.ctx.sampleRate * durationSeconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  // Set master volume
  setMasterVolume(val) {
    this.masterVolume = parseFloat(val);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.masterVolume, this.ctx.currentTime);
    }
  }

  // Update slider volumes individually
  setChannelVolume(channelName, val) {
    if (this.channels[channelName]) {
      this.channels[channelName].volume = parseFloat(val);
      
      const nodeObj = this.channels[channelName].nodes;
      if (nodeObj.gainNode && this.ctx) {
        nodeObj.gainNode.gain.setValueAtTime(parseFloat(val), this.ctx.currentTime);
      }
    }
  }

  // Toggle ambient channel
  toggleChannel(channelName) {
    this.init(); // Ensure initialized
    
    // Resume context if suspended (browser security)
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const channel = this.channels[channelName];
    if (channel.isPlaying) {
      this.stopChannel(channelName);
    } else {
      this.startChannel(channelName);
    }
    return channel.isPlaying;
  }

  // Start sound node routing
  startChannel(name) {
    if (!this.ctx) return;
    
    const channel = this.channels[name];
    channel.isPlaying = true;
    
    // Create gain node for this specific sound channel
    channel.nodes.gainNode = this.ctx.createGain();
    channel.nodes.gainNode.gain.setValueAtTime(channel.volume, this.ctx.currentTime);
    channel.nodes.gainNode.connect(this.masterGain);

    if (name === 'rain') {
      // 1. Deep rumble background (Noise + Lowpass)
      const rumbleSrc = this.ctx.createBufferSource();
      rumbleSrc.buffer = this.noiseBuffer;
      rumbleSrc.loop = true;

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

      rumbleSrc.connect(rumbleFilter);
      rumbleFilter.connect(channel.nodes.gainNode);
      rumbleSrc.start();
      
      channel.nodes.rumbleSrc = rumbleSrc;

      // 2. Synthesize individual droplets hitting surface (randomized interval scheduler)
      this.schedulers.rainCrackle = setInterval(() => {
        if (!channel.isPlaying || this.ctx.state === 'suspended') return;
        
        // Random chance of droplet click
        if (Math.random() > 0.3) {
          this.playRaindrop(channel.nodes.gainNode);
        }
      }, 50);

    } else if (name === 'wind') {
      // Wind gusting (Noise + Bandpass + dynamic LFO sweeps)
      const windSrc = this.ctx.createBufferSource();
      windSrc.buffer = this.noiseBuffer;
      windSrc.loop = true;

      const windFilter = this.ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.Q.setValueAtTime(2.5, this.ctx.currentTime);
      windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

      // Sweep filter frequency using slow LFO
      const lfo = this.ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.06, this.ctx.currentTime); // Slow sweep 16s

      const lfoGain = this.ctx.createGain();
      lfoGain.gain.setValueAtTime(220, this.ctx.currentTime); // Swell amplitude

      lfo.connect(lfoGain);
      lfoGain.connect(windFilter.frequency); // Connect LFO to filter frequency!
      
      // Swell volume gently with LFO
      const volumeSwell = this.ctx.createGain();
      volumeSwell.gain.setValueAtTime(0.5, this.ctx.currentTime);
      
      // Map LFO to modulate volume swell slightly
      const lfoVolGain = this.ctx.createGain();
      lfoVolGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      lfo.connect(lfoVolGain);
      lfoVolGain.connect(volumeSwell.gain);

      windSrc.connect(windFilter);
      windFilter.connect(volumeSwell);
      volumeSwell.connect(channel.nodes.gainNode);
      
      lfo.start();
      windSrc.start();

      channel.nodes.windSrc = windSrc;
      channel.nodes.lfo = lfo;

    } else if (name === 'hum') {
      // Binaural Beat generator (80Hz left, 85Hz right for a 5Hz focus state theta beat)
      const merger = this.ctx.createChannelMerger(2);

      const oscL = this.ctx.createOscillator();
      oscL.type = 'sine';
      oscL.frequency.setValueAtTime(80, this.ctx.currentTime);

      const oscR = this.ctx.createOscillator();
      oscR.type = 'sine';
      oscR.frequency.setValueAtTime(85, this.ctx.currentTime);

      // Low pass to keep it smooth and deep
      const filterL = this.ctx.createBiquadFilter();
      filterL.type = 'lowpass';
      filterL.frequency.setValueAtTime(150, this.ctx.currentTime);
      
      const filterR = this.ctx.createBiquadFilter();
      filterR.type = 'lowpass';
      filterR.frequency.setValueAtTime(150, this.ctx.currentTime);

      // Route Left
      oscL.connect(filterL);
      filterL.connect(merger, 0, 0); // oscL -> input 0 of merger

      // Route Right
      oscR.connect(filterR);
      filterR.connect(merger, 0, 1); // oscR -> input 1 of merger

      merger.connect(channel.nodes.gainNode);
      
      oscL.start();
      oscR.start();

      channel.nodes.oscL = oscL;
      channel.nodes.oscR = oscR;

    } else if (name === 'fire') {
      // Fireplace (deep hum noise + crackles)
      const rumbleSrc = this.ctx.createBufferSource();
      rumbleSrc.buffer = this.noiseBuffer;
      rumbleSrc.loop = true;

      const rumbleFilter = this.ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(120, this.ctx.currentTime);

      const lowGain = this.ctx.createGain();
      lowGain.gain.setValueAtTime(0.4, this.ctx.currentTime);

      rumbleSrc.connect(rumbleFilter);
      rumbleFilter.connect(lowGain);
      lowGain.connect(channel.nodes.gainNode);
      rumbleSrc.start();
      
      channel.nodes.rumbleSrc = rumbleSrc;

      // Crackles/embers generator
      this.schedulers.fireCrackle = setInterval(() => {
        if (!channel.isPlaying || this.ctx.state === 'suspended') return;
        
        // Random embers pops
        if (Math.random() > 0.8) {
          this.playFirePop(channel.nodes.gainNode);
        }
      }, 100);
    }
  }

  // Rain click synthesis
  playRaindrop(destinationGain) {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    // Peaked raindrop frequency
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200 + Math.random() * 800, this.ctx.currentTime);
    
    // Sharp envelope
    const now = this.ctx.currentTime;
    const dur = 0.005 + Math.random() * 0.01;
    const vol = 0.01 + Math.random() * 0.03;
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(vol, now + 0.001);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    
    osc.connect(gainNode);
    gainNode.connect(destinationGain);
    
    osc.start(now);
    osc.stop(now + dur + 0.05);
  }

  // Fire crackle pop synthesis
  playFirePop(destinationGain) {
    if (!this.ctx || this.ctx.state === 'suspended') return;

    const now = this.ctx.currentTime;
    
    // 1. High frequency snap (Highpassed noise burst)
    const noiseBurst = this.ctx.createBufferSource();
    noiseBurst.buffer = this.noiseBuffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(3500, now);
    
    const burstGain = this.ctx.createGain();
    const burstDur = 0.003 + Math.random() * 0.008;
    const burstVol = 0.08 + Math.random() * 0.12;

    burstGain.gain.setValueAtTime(0, now);
    burstGain.gain.linearRampToValueAtTime(burstVol, now + 0.001);
    burstGain.gain.exponentialRampToValueAtTime(0.0001, now + burstDur);

    noiseBurst.connect(filter);
    filter.connect(burstGain);
    burstGain.connect(destinationGain);

    noiseBurst.start(now);
    noiseBurst.stop(now + burstDur + 0.05);

    // 2. Hollow wood resonance (Low oscillator thud)
    if (Math.random() > 0.5) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180 + Math.random() * 150, now);
      
      const thudDur = 0.02 + Math.random() * 0.03;
      const thudVol = 0.05 + Math.random() * 0.08;

      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.linearRampToValueAtTime(thudVol, now + 0.002);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + thudDur);

      osc.connect(oscGain);
      oscGain.connect(destinationGain);

      osc.start(now);
      osc.stop(now + thudDur + 0.05);
    }
  }

  // Stop sound node routing
  stopChannel(name) {
    const channel = this.channels[name];
    channel.isPlaying = false;
    
    // Clear schedulers
    if (name === 'rain' && this.schedulers.rainCrackle) {
      clearInterval(this.schedulers.rainCrackle);
      this.schedulers.rainCrackle = null;
    }
    if (name === 'fire' && this.schedulers.fireCrackle) {
      clearInterval(this.schedulers.fireCrackle);
      this.schedulers.fireCrackle = null;
    }

    // Stop nodes
    const nodeObj = channel.nodes;
    try {
      if (nodeObj.rumbleSrc) { nodeObj.rumbleSrc.stop(); }
      if (nodeObj.windSrc) { nodeObj.windSrc.stop(); }
      if (nodeObj.lfo) { nodeObj.lfo.stop(); }
      if (nodeObj.oscL) { nodeObj.oscL.stop(); }
      if (nodeObj.oscR) { nodeObj.oscR.stop(); }
      if (nodeObj.gainNode) { nodeObj.gainNode.disconnect(); }
    } catch (e) {
      // Already stopped
    }
    channel.nodes = {};
  }

  // Synthesize Alarm Chime (E5 -> A5 -> C#6 -> E6 warm bell melody)
  playAlarmChime(pitchFreq = 440) {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (!this.ctx) return;

    const baseFreqs = [
      pitchFreq, 
      pitchFreq * 1.334, // Perfect fourth
      pitchFreq * 1.678, // Major sixth
      pitchFreq * 2.0     // Octave
    ];
    const now = this.ctx.currentTime;
    
    // Play notes sequence
    baseFreqs.forEach((freq, idx) => {
      const noteTime = now + (idx * 0.35);
      this.playBellNote(freq, noteTime);
    });
  }

  // Bell synthesis
  playBellNote(fundamental, startTime) {
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const osc3 = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(fundamental, startTime);
    
    // Harmonic 1: 2x fundamental
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fundamental * 2, startTime);
    
    // Harmonic 2: 3x fundamental
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(fundamental * 3, startTime);

    // Exponential envelope
    const attack = 0.005;
    const decay = 1.6;
    
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(0.18, startTime + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);

    // Merge harmonics with lower gain
    const oscGain2 = this.ctx.createGain();
    oscGain2.gain.setValueAtTime(0.07, startTime);
    osc2.connect(oscGain2);
    oscGain2.connect(gainNode);

    const oscGain3 = this.ctx.createGain();
    oscGain3.gain.setValueAtTime(0.03, startTime);
    osc3.connect(oscGain3);
    oscGain3.connect(gainNode);

    osc1.connect(gainNode);
    gainNode.connect(this.masterGain);

    osc1.start(startTime);
    osc2.start(startTime);
    osc3.start(startTime);

    osc1.stop(startTime + decay + 0.1);
    osc2.stop(startTime + decay + 0.1);
    osc3.stop(startTime + decay + 0.1);
  }

  // Simple quick clock tick click
  playTick() {
    if (!this.ctx || this.ctx.state === 'suspended') return;
    const osc = this.ctx.createOscillator();
    const gainNode = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    
    const now = this.ctx.currentTime;
    gainNode.gain.setValueAtTime(0.006, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.003);
    
    osc.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.01);
  }
}

// Instantiate Sound Engine
const audio = new ZenAudioEngine();

// --- DOM ELEMENTS ---
const DOM = {
  body: document.body,
  streakCount: document.getElementById('streak-count'),
  themeBtns: document.querySelectorAll('.theme-btn'),
  
  // Timer
  timerTime: document.getElementById('timer-time'),
  timerLabel: document.getElementById('timer-label'),
  activeTaskTitle: document.getElementById('active-task-title'),
  btnReset: document.getElementById('btn-reset'),
  btnPlayPause: document.getElementById('btn-play-pause'),
  btnSkip: document.getElementById('btn-skip'),
  playIcon: document.getElementById('play-icon'),
  pauseIcon: document.getElementById('pause-icon'),
  progressRingActive: document.querySelector('.progress-ring-active'),
  
  modeFocus: document.getElementById('mode-focus'),
  modeShort: document.getElementById('mode-short'),
  modeLong: document.getElementById('mode-long'),
  modeBtns: document.querySelectorAll('.mode-btn'),
  
  // Tasks
  taskForm: document.getElementById('task-form'),
  taskInput: document.getElementById('task-input'),
  taskEst: document.getElementById('task-est'),
  pomoDec: document.getElementById('pomo-dec'),
  pomoInc: document.getElementById('pomo-inc'),
  taskList: document.getElementById('task-list'),
  taskEmpty: document.getElementById('task-empty'),
  taskCompletionRatio: document.getElementById('task-completion-ratio'),
  
  // Ambient Sound
  masterVolume: document.getElementById('master-volume'),
  ambientToggles: document.querySelectorAll('.ambient-toggle'),
  ambientSliders: document.querySelectorAll('.ambient-slider'),
  
  // Stats
  statMinutes: document.getElementById('stat-minutes'),
  statSessions: document.getElementById('stat-sessions'),
  statTasks: document.getElementById('stat-tasks'),
  btnResetStats: document.getElementById('btn-reset-stats'),
  zenQuote: document.getElementById('zen-quote'),
  zenAuthor: document.getElementById('zen-author'),
  footerGreeting: document.getElementById('footer-greeting'),
  
  // Modal Settings
  openSettingsBtn: document.getElementById('open-settings-btn'),
  settingsModal: document.getElementById('settings-modal'),
  closeSettingsBtn: document.getElementById('close-settings-btn'),
  btnSettingsCancel: document.getElementById('btn-settings-cancel'),
  btnSettingsSave: document.getElementById('btn-settings-save'),
  
  setFocus: document.getElementById('set-focus'),
  setShort: document.getElementById('set-short'),
  setLong: document.getElementById('set-long'),
  setAutoplay: document.getElementById('set-autoplay'),
  setTicking: document.getElementById('set-ticking'),
  setChimePitch: document.getElementById('set-chime-pitch'),
  chimePitchVal: document.getElementById('chime-pitch-val'),
  testChimeBtn: document.getElementById('test-chime-btn')
};

// --- CIRCULAR PROGRESS CALCULATIONS ---
const RADIUS = 95;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function initProgressRing() {
  DOM.progressRingActive.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
  DOM.progressRingActive.style.strokeDashoffset = CIRCUMFERENCE;
}

function setProgress(percent) {
  const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
  DOM.progressRingActive.style.strokeDashoffset = offset;
}

// --- STATE PERSISTENCE (LOCAL STORAGE) ---
function loadData() {
  // Load tasks
  const storedTasks = localStorage.getItem('zs_tasks');
  if (storedTasks) {
    state.tasks = JSON.parse(storedTasks);
  }
  
  // Load active task ID
  state.activeTaskId = localStorage.getItem('zs_active_task_id');

  // Load stats
  const storedStats = localStorage.getItem('zs_stats');
  if (storedStats) {
    state.stats = { ...state.stats, ...JSON.parse(storedStats) };
  }

  // Load settings
  const storedSettings = localStorage.getItem('zs_settings');
  if (storedSettings) {
    state.settings = { ...state.settings, ...JSON.parse(storedSettings) };
  }

  // Load theme
  const storedTheme = localStorage.getItem('zs_theme') || 'forest';
  setTheme(storedTheme);

  // Initialize timer values based on mode settings
  state.timer.duration = state.settings[state.timer.mode];
  state.timer.remaining = state.timer.duration;
  
  updateTimerUI();
  updateStreak();
  updateStatsUI();
  renderTasks();
  updateGreeting();
  loadRandomQuote();
}

function saveData() {
  localStorage.setItem('zs_tasks', JSON.stringify(state.tasks));
  localStorage.setItem('zs_active_task_id', state.activeTaskId || '');
  localStorage.setItem('zs_stats', JSON.stringify(state.stats));
  localStorage.setItem('zs_settings', JSON.stringify(state.settings));
}

// --- DESIGN THEMES ---
function setTheme(themeName) {
  DOM.body.className = '';
  DOM.body.classList.add(`theme-${themeName}`);
  
  DOM.themeBtns.forEach(btn => {
    if (btn.dataset.theme === themeName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  localStorage.setItem('zs_theme', themeName);
}

// --- TIMING MECHANISMS ---
function startTimer() {
  audio.init(); // Initialize audio context on play interaction
  
  state.timer.isRunning = true;
  state.timer.lastTickTime = Date.now();
  
  DOM.playIcon.classList.add('hidden');
  DOM.pauseIcon.classList.remove('hidden');
  DOM.btnPlayPause.title = "Pause Timer";
  
  // Tick loop
  function tick() {
    if (!state.timer.isRunning) return;
    
    const now = Date.now();
    const elapsed = (now - state.timer.lastTickTime) / 1000;
    
    if (elapsed >= 1.0) {
      const secondsToSubtract = Math.floor(elapsed);
      state.timer.remaining -= secondsToSubtract;
      state.timer.lastTickTime = now - (elapsed % 1 * 1000);
      
      // Background Ticking Sound
      if (state.settings.ticking && state.timer.mode === 'focus') {
        audio.playTick();
      }

      if (state.timer.remaining <= 0) {
        state.timer.remaining = 0;
        timerCompleted();
        return;
      }
      
      updateTimerUI();
    }
    
    state.timer.animationFrameId = requestAnimationFrame(tick);
  }
  
  state.timer.animationFrameId = requestAnimationFrame(tick);
}

function pauseTimer() {
  state.timer.isRunning = false;
  if (state.timer.animationFrameId) {
    cancelAnimationFrame(state.timer.animationFrameId);
  }
  
  DOM.playIcon.classList.remove('hidden');
  DOM.pauseIcon.classList.add('hidden');
  DOM.btnPlayPause.title = "Start Timer";
  
  updateTimerUI();
}

function resetTimer() {
  pauseTimer();
  state.timer.remaining = state.timer.duration;
  updateTimerUI();
}

function skipTimer() {
  pauseTimer();
  switchMode(getNextMode());
  if (state.settings.autoplay) {
    startTimer();
  }
}

function switchMode(newMode) {
  state.timer.mode = newMode;
  state.timer.duration = state.settings[newMode];
  state.timer.remaining = state.timer.duration;
  
  // Update Mode buttons UI
  DOM.modeBtns.forEach(btn => {
    if (btn.dataset.mode === newMode) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Label UI Update
  if (newMode === 'focus') {
    DOM.timerLabel.textContent = "Breathe & Focus";
  } else if (newMode === 'short') {
    DOM.timerLabel.textContent = "Time to Rest";
  } else {
    DOM.timerLabel.textContent = "Deep Recharge";
  }

  updateTimerUI();
}

function getNextMode() {
  if (state.timer.mode === 'focus') {
    // If completed 4 focus sessions, take a long break
    if (state.stats.sessionsCompleted > 0 && state.stats.sessionsCompleted % 4 === 0) {
      return 'long';
    }
    return 'short';
  } else {
    return 'focus';
  }
}

function timerCompleted() {
  pauseTimer();
  
  // Play synthesized bell chime
  audio.playAlarmChime(state.settings.chimePitch);
  
  // Increment statistics
  if (state.timer.mode === 'focus') {
    const focusMins = Math.round(state.timer.duration / 60);
    state.stats.minutesToday += focusMins;
    state.stats.sessionsCompleted += 1;
    
    // Active task session update
    if (state.activeTaskId) {
      const activeTask = state.tasks.find(t => t.id === state.activeTaskId);
      if (activeTask) {
        activeTask.completedSessions += 1;
        renderTasks();
      }
    }
    
    updateStreak();
    loadRandomQuote();
  }
  
  updateStatsUI();
  saveData();
  
  // Auto-advance mode
  setTimeout(() => {
    switchMode(getNextMode());
    if (state.settings.autoplay) {
      startTimer();
    }
  }, 1500);
}

// Update clock and browser title bar
function updateTimerUI() {
  const mins = Math.floor(state.timer.remaining / 60);
  const secs = state.timer.remaining % 60;
  const timeString = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  
  DOM.timerTime.textContent = timeString;
  
  // Circle ring percentage
  const elapsedPercent = ((state.timer.duration - state.timer.remaining) / state.timer.duration) * 100;
  setProgress(elapsedPercent);

  // Tab Title
  const modeLabel = state.timer.mode === 'focus' ? 'Focus' : 'Break';
  const tabStatus = state.timer.isRunning ? '▶' : '■';
  document.title = `${timeString} ${tabStatus} ZenSpace | ${modeLabel}`;
}

// --- TASK MANAGEMENT ---
DOM.pomoInc.addEventListener('click', () => {
  let val = parseInt(DOM.taskEst.value);
  if (val < 10) DOM.taskEst.value = val + 1;
});

DOM.pomoDec.addEventListener('click', () => {
  let val = parseInt(DOM.taskEst.value);
  if (val > 1) DOM.taskEst.value = val - 1;
});

DOM.taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const text = DOM.taskInput.value.trim();
  const estSessions = parseInt(DOM.taskEst.value);
  
  if (!text) return;
  
  const newTask = {
    id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
    text: text,
    estSessions: estSessions,
    completedSessions: 0,
    isCompleted: false
  };
  
  state.tasks.push(newTask);
  
  // If no task is active, select this new one
  if (!state.activeTaskId) {
    state.activeTaskId = newTask.id;
  }
  
  DOM.taskInput.value = '';
  DOM.taskEst.value = '1';
  
  renderTasks();
  saveData();
  updateActiveTaskUI();
});

function renderTasks() {
  DOM.taskList.innerHTML = '';
  
  if (state.tasks.length === 0) {
    DOM.taskEmpty.classList.remove('hidden');
    DOM.taskList.appendChild(DOM.taskEmpty);
    DOM.taskCompletionRatio.textContent = "0/0 Tasks";
    return;
  }
  
  DOM.taskEmpty.classList.add('hidden');
  
  // Sort tasks: completed go to bottom
  const sortedTasks = [...state.tasks].sort((a, b) => a.isCompleted - b.isCompleted);
  
  let completedCount = 0;
  
  sortedTasks.forEach(task => {
    if (task.isCompleted) completedCount++;
    
    const taskEl = document.createElement('div');
    taskEl.className = `task-item ${task.id === state.activeTaskId ? 'active-focus' : ''} ${task.isCompleted ? 'completed' : ''}`;
    taskEl.dataset.id = task.id;
    
    taskEl.innerHTML = `
      <div class="task-left">
        <div class="checkbox-custom">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <span class="task-text" title="${task.text}">${task.text}</span>
      </div>
      <div class="task-right">
        <span class="pomo-estimate">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.75z"/>
          </svg>
          ${task.completedSessions}/${task.estSessions}
        </span>
        <button class="task-delete" title="Delete Task">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    `;
    
    // Toggle active focus selection
    taskEl.addEventListener('click', (e) => {
      // Don't trigger if clicked checkbox or delete button
      if (e.target.closest('.checkbox-custom') || e.target.closest('.task-delete')) {
        return;
      }
      
      if (!task.isCompleted) {
        state.activeTaskId = task.id;
        document.querySelectorAll('.task-item').forEach(el => el.classList.remove('active-focus'));
        taskEl.classList.add('active-focus');
        updateActiveTaskUI();
        saveData();
      }
    });
    
    // Complete check toggle
    const checkbox = taskEl.querySelector('.checkbox-custom');
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskCompletion(task.id);
    });
    
    // Delete task
    const delBtn = taskEl.querySelector('.task-delete');
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });

    DOM.taskList.appendChild(taskEl);
  });
  
  DOM.taskCompletionRatio.textContent = `${completedCount}/${state.tasks.length} Tasks`;
}

function toggleTaskCompletion(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  
  task.isCompleted = !task.isCompleted;
  
  if (task.isCompleted) {
    state.stats.tasksCompleted += 1;
    // If the completed task was active, remove active status
    if (state.activeTaskId === id) {
      state.activeTaskId = null;
      // Assign another incomplete task as active, if available
      const nextTask = state.tasks.find(t => !t.isCompleted);
      if (nextTask) {
        state.activeTaskId = nextTask.id;
      }
    }
  } else {
    // If unchecked, adjust completed count
    state.stats.tasksCompleted = Math.max(0, state.stats.tasksCompleted - 1);
    // If no active task currently, restore this one
    if (!state.activeTaskId) {
      state.activeTaskId = id;
    }
  }
  
  renderTasks();
  updateActiveTaskUI();
  updateStatsUI();
  saveData();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  
  if (state.activeTaskId === id) {
    state.activeTaskId = null;
    const nextTask = state.tasks.find(t => !t.isCompleted);
    if (nextTask) {
      state.activeTaskId = nextTask.id;
    }
  }
  
  renderTasks();
  updateActiveTaskUI();
  saveData();
}

function updateActiveTaskUI() {
  if (state.activeTaskId) {
    const active = state.tasks.find(t => t.id === state.activeTaskId);
    if (active) {
      DOM.activeTaskTitle.textContent = active.text;
      return;
    }
  }
  DOM.activeTaskTitle.textContent = "No task selected";
}

// --- METRICS & ANALYTICS ---
function updateStreak() {
  const todayStr = new Date().toISOString().split('T')[0];
  const lastDate = state.stats.lastFocusDate;
  
  if (!lastDate) {
    state.stats.streak = 0;
  } else {
    const today = new Date(todayStr);
    const last = new Date(lastDate);
    const diffTime = Math.abs(today - last);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 1) {
      // Streak broken
      state.stats.streak = 0;
    }
  }

  // Increment streak when focus completes
  if (state.timer.mode === 'focus' && state.timer.remaining === 0) {
    if (lastDate !== todayStr) {
      state.stats.streak += 1;
      state.stats.lastFocusDate = todayStr;
    }
  }
  
  DOM.streakCount.textContent = state.stats.streak;
}

function updateStatsUI() {
  DOM.statMinutes.textContent = state.stats.minutesToday;
  DOM.statSessions.textContent = state.stats.sessionsCompleted;
  DOM.statTasks.textContent = state.stats.tasksCompleted;
  DOM.streakCount.textContent = state.stats.streak;
}

// Clear daily metrics
DOM.btnResetStats.addEventListener('click', () => {
  if (confirm("Are you sure you want to clear focus stats for today? Tasks list will remain.")) {
    state.stats.minutesToday = 0;
    state.stats.sessionsCompleted = 0;
    state.stats.tasksCompleted = 0;
    state.stats.streak = 0;
    state.stats.lastFocusDate = "";
    
    updateStatsUI();
    saveData();
  }
});

// Load Random Quotes
function loadRandomQuote() {
  const randIdx = Math.floor(Math.random() * ZEN_QUOTES.length);
  const quote = ZEN_QUOTES[randIdx];
  DOM.zenQuote.textContent = `"${quote.text}"`;
  DOM.zenAuthor.textContent = `— ${quote.author}`;
}

// Greeting based on hours
function updateGreeting() {
  const hr = new Date().getHours();
  let greet = "Find your focus in the quiet.";
  
  if (hr >= 5 && hr < 12) {
    greet = "Good morning. Center your mind for the day ahead.";
  } else if (hr >= 12 && hr < 17) {
    greet = "Good afternoon. Remain present in your work.";
  } else if (hr >= 17 && hr < 22) {
    greet = "Good evening. Reflect on your goals, breathe deeply.";
  } else {
    greet = "Quiet hours. Let's finish the day mindfully.";
  }
  DOM.footerGreeting.textContent = greet;
}

// --- AMBIENT SOUND MIXER UI ---
DOM.masterVolume.addEventListener('input', (e) => {
  audio.setMasterVolume(e.target.value);
});

DOM.ambientToggles.forEach(btn => {
  btn.addEventListener('click', () => {
    const soundName = btn.dataset.sound;
    const isPlaying = audio.toggleChannel(soundName);
    
    const itemEl = document.getElementById(`sound-${soundName}`);
    const offIcon = btn.querySelector('.sound-off-icon');
    const onIcon = btn.querySelector('.sound-on-icon');
    
    if (isPlaying) {
      itemEl.classList.add('playing');
      offIcon.classList.add('hidden');
      onIcon.classList.remove('hidden');
    } else {
      itemEl.classList.remove('playing');
      offIcon.classList.remove('hidden');
      onIcon.classList.add('hidden');
    }
  });
});

DOM.ambientSliders.forEach(slider => {
  slider.addEventListener('input', (e) => {
    const soundName = slider.dataset.sound;
    audio.setChannelVolume(soundName, e.target.value);
  });
});

// --- SETTINGS MODAL DIALOG ---
DOM.openSettingsBtn.addEventListener('click', (e) => {
  e.preventDefault();
  
  // Populate settings inputs
  DOM.setFocus.value = state.settings.focus / 60;
  DOM.setShort.value = state.settings.short / 60;
  DOM.setLong.value = state.settings.long / 60;
  DOM.setAutoplay.checked = state.settings.autoplay;
  DOM.setTicking.checked = state.settings.ticking;
  DOM.setChimePitch.value = state.settings.chimePitch;
  updateChimeLabel(state.settings.chimePitch);
  
  DOM.settingsModal.classList.remove('hidden');
});

DOM.closeSettingsBtn.addEventListener('click', closeModal);
DOM.btnSettingsCancel.addEventListener('click', closeModal);

function closeModal() {
  DOM.settingsModal.classList.add('hidden');
}

DOM.setChimePitch.addEventListener('input', (e) => {
  updateChimeLabel(e.target.value);
});

function updateChimeLabel(hz) {
  let label = "Standard (440 Hz)";
  if (hz < 300) label = `Deep Bell (${hz} Hz)`;
  else if (hz > 600) label = `Crystal Chime (${hz} Hz)`;
  else label = `Warm Bell (${hz} Hz)`;
  DOM.chimePitchVal.textContent = label;
}

DOM.testChimeBtn.addEventListener('click', () => {
  audio.playAlarmChime(parseInt(DOM.setChimePitch.value));
});

DOM.btnSettingsSave.addEventListener('click', () => {
  const fMins = parseInt(DOM.setFocus.value);
  const sMins = parseInt(DOM.setShort.value);
  const lMins = parseInt(DOM.setLong.value);
  const chimePitch = parseInt(DOM.setChimePitch.value);
  
  if (fMins >= 1 && sMins >= 1 && lMins >= 1) {
    state.settings.focus = fMins * 60;
    state.settings.short = sMins * 60;
    state.settings.long = lMins * 60;
    state.settings.autoplay = DOM.setAutoplay.checked;
    state.settings.ticking = DOM.setTicking.checked;
    state.settings.chimePitch = chimePitch;
    
    // Apply changes immediately to remaining timer if not running
    if (!state.timer.isRunning) {
      state.timer.duration = state.settings[state.timer.mode];
      state.timer.remaining = state.timer.duration;
      updateTimerUI();
    }
    
    saveData();
    closeModal();
  } else {
    alert("Please enter valid positive minute durations.");
  }
});

// --- CORE EVENT BINDINGS ---
DOM.btnPlayPause.addEventListener('click', () => {
  if (state.timer.isRunning) {
    pauseTimer();
  } else {
    startTimer();
  }
});

DOM.btnReset.addEventListener('click', resetTimer);
DOM.btnSkip.addEventListener('click', skipTimer);

// Mode buttons clicking
DOM.modeFocus.addEventListener('click', () => switchMode('focus'));
DOM.modeShort.addEventListener('click', () => switchMode('short'));
DOM.modeLong.addEventListener('click', () => switchMode('long'));

// Theme Selector clicking
DOM.themeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    setTheme(btn.dataset.theme);
  });
});

// Close modal clicking outside the modal card
DOM.settingsModal.addEventListener('click', (e) => {
  if (e.target === DOM.settingsModal) {
    closeModal();
  }
});

// --- INITIALIZE APPLICATION ---
initProgressRing();
loadData();
