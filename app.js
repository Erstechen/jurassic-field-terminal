let EMBRYO_DATA = {};
let MISSION_DATA = {};
let AUDIO_LOG_DATA = {};
let DINO_DB_DATA = {};
let PUZZLE_DATA = {};
let activePuzzleId = null;
// Hidden debug unlock — tap the InGen logo 3 times (menu, briefing, or dashboard brand bar).
const DEV_TAP_COUNT = 3;
const DEV_TAP_WINDOW_MS = 2500;
const DEV_MENU_KEY = "dev_menu_unlock";
const DEV_DASHBOARD_KEY = "dev_dashboard_unlock";
const devTapState = { menu: { count: 0, timer: null }, dashboard: { count: 0, timer: null }, briefing: { count: 0, timer: null } };

let booting = false;
let selectedDinoId = null;
let pendingFinale = false;
let briefingData = null;

const GPS_SIGNALS = ["signal lost", "signal detected", "target nearby"];

// Extraction finale countdown length (seconds). 120 = 2:00.
const EXTRACTION_COUNTDOWN_SECONDS = 120;
let finaleTimerId = null;
let lastAlarmSecond = null;

const BOOT_STATUS_STEPS = [
  { at: 0, msg: "Loading cryo recovery modules..." },
  { at: 22, msg: "Syncing embryo database..." },
  { at: 45, msg: "Establishing mission protocols..." },
  { at: 68, msg: "Calibrating Barbasol vault..." },
  { at: 88, msg: "Bringing systems online..." }
];

// Audio volume levels (0.0 – 1.0) — adjust each sound independently
const AUDIO_CONFIG = {
  // UI sound effects
  typewriter: { file: "sfx_typewriter.mp3", volume: 0.35 },
  flicker:    { file: "sfx_flicker.mp3",    volume: 0.35 },
  button:     { file: "sfx_button.mp3",     volume: 0.45 },
  loading:    { file: "sfx_loading.mp3",    volume: 0.5 },

  // Story & event audio
  alarm:      { file: "alarm.mp3",          volume: 0.8  },
  log_01:     { file: "log_01.mp3",         volume: 0.7  },
  log_02:     { file: "log_02.mp3",         volume: 0.7  },
  log_03:     { file: "log_03.mp3",         volume: 0.7  },
  log_04:     { file: "log_04.mp3",         volume: 0.7  },
  log_05:     { file: "log_05.mp3",         volume: 0.7  },
  log_06:     { file: "log_06.mp3",         volume: 0.7  },
  log_07:     { file: "log_07.mp3",         volume: 0.7  },
  log_08:     { file: "log_08.mp3",         volume: 0.7  },
  log_09:     { file: "log_09.mp3",         volume: 0.7  },
  log_10:     { file: "log_10.mp3",         volume: 0.7  },

  // Optional finale sting — drop audio/extraction.mp3 in to enable; silent if absent
  extraction: { file: "extraction.mp3",     volume: 0.8  },

  // Optional mission briefing narration — drop audio/briefing.mp3 in to enable; silent if absent
  briefing:   { file: "briefing.mp3",       volume: 0.85 }
};

const AUDIO_BY_FILE = Object.fromEntries(
  Object.values(AUDIO_CONFIG).map(entry => [entry.file, entry.volume])
);

const UI_SFX_KEYS = ["typewriter", "flicker", "button", "loading"];

let audioCtx = null;
let loadingSource = null;
let audioReady = false;
let audioUnlocked = false;
const audioBuffers = {};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAudioVolume(file, fallback = 0.7) {
  return AUDIO_BY_FILE[file] ?? fallback;
}

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

async function ensureAudioRunning() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    await ctx.resume();
  }
}

async function loadAudioBuffer(file) {
  if (audioBuffers[file]) return audioBuffers[file];

  try {
    const response = await fetch(`./audio/${file}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    audioBuffers[file] = await getAudioContext().decodeAudioData(data);
    return audioBuffers[file];
  } catch (err) {
    console.warn(`Failed to load audio: ${file}`, err);
    return null;
  }
}

async function initAudioSystem() {
  if (audioReady) return;

  await Promise.all(
    UI_SFX_KEYS.map(key => loadAudioBuffer(AUDIO_CONFIG[key].file))
  );

  audioReady = true;
}

async function warmUpAudio() {
  await initAudioSystem();
  if (audioUnlocked) return;

  await ensureAudioRunning();
  audioUnlocked = true;
}

function playBuffer(file, volume, { loop = false } = {}) {
  const buffer = audioBuffers[file];
  if (!buffer) return null;

  const ctx = getAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffer;
  source.loop = loop;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(ctx.destination);
  source.start(0);
  return source;
}

function stopLoadingSound() {
  if (!loadingSource) return;
  try {
    loadingSource.stop();
  } catch (err) {
    // already stopped
  }
  loadingSource = null;
}

function playSfx(key, { loop = false, volume } = {}) {
  const config = AUDIO_CONFIG[key];
  if (!config) return null;

  const vol = volume ?? config.volume;

  if (key === "loading" && loop) {
    stopLoadingSound();
    loadingSource = playBuffer(config.file, vol, { loop: true });
    return loadingSource;
  }

  playBuffer(config.file, vol);
  return null;
}

function playTypewriterSfx() {
  playSfx("typewriter");
}

function typewriter(element, text, charDelay = 18) {
  return new Promise(resolve => {
    element.classList.remove("init-hidden");
    element.textContent = "";
    element.classList.add("typing");

    let i = 0;
    const timer = setInterval(() => {
      if (i >= text.length) {
        clearInterval(timer);
        element.classList.remove("typing");
        resolve();
        return;
      }

      const char = text[i];
      if (char !== " " && char !== "\n") {
        playTypewriterSfx();
      }
      element.textContent += char;
      i += 1;
    }, charDelay);
  });
}

const FLICKER_DURATIONS = { normal: 750, fast: 110 };
const NAV_STAGGER_MS = 300;

function finishFlicker(element, flickerClass) {
  element.classList.remove(flickerClass);
  element.classList.add("revealed");
}

function flickerReveal(element, { fast = false, playSound = true } = {}) {
  return new Promise(resolve => {
    const flickerClass = fast ? "reveal-flicker-fast" : "reveal-flicker";
    const duration = fast ? FLICKER_DURATIONS.fast : FLICKER_DURATIONS.normal;

    if (playSound) {
      playSfx("flicker");
    }

    element.classList.remove("init-hidden");
    element.classList.add(flickerClass);

    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      finishFlicker(element, flickerClass);
      resolve();
    };

    element.addEventListener("animationend", done, { once: true });
    setTimeout(done, duration + 20);
  });
}

function revealNavButtons(navButtons) {
  const duration = FLICKER_DURATIONS.fast;

  navButtons.forEach((btn, index) => {
    setTimeout(() => {
      playSfx("flicker");
      btn.classList.remove("init-hidden");
      btn.classList.add("reveal-flicker-fast");
      setTimeout(() => finishFlicker(btn, "reveal-flicker-fast"), duration);
    }, index * NAV_STAGGER_MS);
  });

  // Next init step starts once the last button begins — not when all finish
  return delay((navButtons.length - 1) * NAV_STAGGER_MS + 600);
}

function resetInitTargets() {
  document.querySelectorAll(".init-target").forEach(el => {
    el.classList.add("init-hidden");
    el.classList.remove("revealed", "reveal-flicker", "reveal-flicker-fast", "typing", "cursor-blink");
  });

  document.getElementById("dashboard-title").textContent = "";
  document.getElementById("status").textContent = "";
  document.getElementById("mission-body").innerHTML = "";
}

function buildFieldAnalysisHtml(mission) {
  if (!mission?.embryo || !mission.fieldAnalysis) return "";

  const embryo = EMBRYO_DATA[mission.embryo];
  const speciesName = (embryo?.name || mission.embryo).toUpperCase();
  const { observation, searchHint } = mission.fieldAnalysis;

  return `
    <div class="field-analysis">
      <div class="field-analysis-alert">DNA TRACE DETECTED</div>
      <div class="field-analysis-species">
        <span class="field-analysis-label">SPECIES:</span>
        <span class="field-analysis-species-name">${escapeHtml(speciesName)}</span>
      </div>
      <div class="field-analysis-heading">FIELD ANALYSIS:</div>
      <p class="field-analysis-observation">${escapeHtml(observation)}</p>
      <p class="field-analysis-search">${escapeHtml(searchHint)}</p>
    </div>`;
}

function buildDashboardMissionHtml(mission) {
  if (!mission) {
    return `
      <div class="dashboard-mission mission-item status-complete">
        <div class="mission-item-head">
          <strong class="mission-title">All missions complete.</strong>
          <span class="badge">COMPLETE</span>
        </div>
        <p class="mission-desc">Awaiting extraction protocol.</p>
      </div>`;
  }

  const status = GAME_STATE.missions[mission.id] || "active";
  const fieldAnalysis = buildFieldAnalysisHtml(mission);
  const imageBlock = mission.image
    ? `
        <div class="mission-image-wrap">
          <img class="mission-image" src="${escapeHtml(mission.image)}"
               alt="Search area clue for ${escapeHtml(mission.title)}"
               onerror="this.closest('.mission-image-wrap').classList.add('asset-missing')" />
        </div>`
    : "";

  const intelRow = (fieldAnalysis || imageBlock)
    ? `
        <div class="mission-intel-row">
          ${fieldAnalysis}
          ${imageBlock}
        </div>`
    : "";

  return `
    <div class="dashboard-mission mission-item status-${status}">
      <div class="mission-item-head">
        <strong class="mission-title">${escapeHtml(mission.title)}</strong>
        <span class="badge">${status.toUpperCase()}</span>
      </div>
      <p class="mission-desc">${escapeHtml(mission.description)}</p>
      <p class="mission-objective">
        <span class="mission-objective-bullet" aria-hidden="true"></span>
        <span class="mission-objective-text">
          <span class="mission-objective-label">OBJECTIVE</span>
          ${escapeHtml(mission.objective)}
        </span>
      </p>
      ${intelRow}
    </div>`;
}

async function blinkCursor(element, times = 3) {
  element.classList.add("cursor-blink");
  await delay(times * 700);
  element.classList.remove("cursor-blink");
}

function animateBootProgress(duration = 3000) {
  return new Promise(resolve => {
    const fill = document.getElementById("boot-loader-fill");
    const percentEl = document.getElementById("boot-loader-percent");
    const statusEl = document.getElementById("boot-loader-status");
    const start = performance.now();
    let lastStep = -1;

    playSfx("loading", { loop: true });

    function frame(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const pct = Math.floor(progress * 100);

      fill.style.width = `${pct}%`;
      percentEl.textContent = `${pct}%`;

      let step = BOOT_STATUS_STEPS[0];
      for (const candidate of BOOT_STATUS_STEPS) {
        if (pct >= candidate.at) step = candidate;
      }

      const stepIndex = BOOT_STATUS_STEPS.indexOf(step);
      if (stepIndex !== lastStep) {
        lastStep = stepIndex;
        statusEl.textContent = step.msg;
        statusEl.classList.remove("status-flicker");
        void statusEl.offsetWidth;
        statusEl.classList.add("status-flicker");
      }

      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        statusEl.textContent = "Boot sequence complete.";
        stopLoadingSound();
        resolve();
      }
    }

    requestAnimationFrame(frame);
  });
}

async function runDashboardReveal() {
  resetInitTargets();

  const status = document.getElementById("status");
  const title = document.getElementById("dashboard-title");
  const headerLine = document.getElementById("header-line");
  const navButtons = document.querySelectorAll(".nav-btn");
  const missionPanel = document.getElementById("mission-panel");
  const missionBody = document.getElementById("mission-body");
  const qrPanel = document.getElementById("qr-panel");

  // 1. "System Online" visible with blinking cursor (3 blinks)
  status.classList.remove("init-hidden");
  status.textContent = "System Online";
  await blinkCursor(status, 3);

  // 2. Typewriter dashboard title
  await typewriter(title, "FIELD OPERATIONS DASHBOARD", 40);

  // 3. Flicker reveal header line
  await flickerReveal(headerLine);

  // 4. Replace status text with embryo count via typewriter
  status.textContent = "";
  const embryoStatus = `EMBRYOS: ${GAME_STATE.player.embryosCollected.length}/10`;
  await typewriter(status, embryoStatus, 40);

  // 5. Flicker reveal nav buttons left to right (overlapping, not sequential)
  await revealNavButtons(navButtons);

  // 6. Flicker reveal mission panel (heading + frame; body stays hidden)
  await flickerReveal(missionPanel);

  // 7. Reveal active mission details (title, status, clue image, objective)
  missionBody.innerHTML = buildDashboardMissionHtml(getActiveMission());
  await flickerReveal(missionBody);

  // 8. Flicker reveal remaining page content
  await flickerReveal(qrPanel);
}

const DEFAULT_BRIEFING = {
  title: "MISSION BRIEFING",
  audio: "briefing.mp3",
  paragraphs: [
    "Field Agent — this is InGen Site B command.",
    "Recover all ten cryo embryos and bring them to the extraction point.",
    "Scan each marker in sequence. Move fast and stay alert."
  ]
};

// How the briefing text appears, all paced to the narration:
//   "fade"       - each paragraph fades in as a whole
//   "fade-lines" - each paragraph's wrapped lines fade in top-to-bottom
//   "typewriter" - characters type on, no sound
const BRIEFING_TEXT_MODE = "fade-lines";
// Finish the on-screen text this many ms before the narration audio ends.
const BRIEFING_TEXT_END_LEAD_MS = 1500;
// Per-paragraph pacing used only when no narration audio is available.
const BRIEFING_FALLBACK_PARA_MS = 5000;

function onPlay() {
  try {
    warmUpAudio().catch(() => {});

    // Returning players who already accepted skip straight into the boot sequence.
    if (GAME_STATE.flags.briefingComplete) {
      startGame();
      return;
    }

    startBriefing();
  } catch (err) {
    console.error("PLAY failed:", err);
  }
}

function startBriefing() {
  warmUpAudio().catch(() => {});

  const menu = document.getElementById("menu-screen");
  menu.classList.remove("active");
  menu.classList.add("hidden");

  const briefing = document.getElementById("briefing-screen");
  briefing.classList.remove("hidden");
  briefing.classList.add("active");

  runBriefing();
}

function runBriefing() {
  const data = briefingData || DEFAULT_BRIEFING;
  const titleEl = document.getElementById("briefing-title");
  const textEl = document.getElementById("briefing-text");
  const acceptBtn = document.getElementById("accept-btn");

  acceptBtn.classList.add("hidden");
  if (titleEl && data.title) titleEl.textContent = data.title;

  const paragraphs =
    Array.isArray(data.paragraphs) && data.paragraphs.length
      ? data.paragraphs
      : DEFAULT_BRIEFING.paragraphs;

  textEl.innerHTML = "";

  // Accept becomes available only after BOTH the text reveal and the
  // narration audio have finished (or immediately if audio is unavailable).
  let textDone = false;
  let audioDone = false;
  const maybeReveal = () => {
    if (textDone && audioDone) revealAccept();
  };

  const audioFile = data.audio || "briefing.mp3";

  loadAudioBuffer(audioFile)
    .then(buffer => {
      const durationMs = buffer && buffer.duration
        ? buffer.duration * 1000
        : paragraphs.length * BRIEFING_FALLBACK_PARA_MS;

      // Start narration.
      const source = buffer ? playBuffer(audioFile, getAudioVolume(audioFile)) : null;
      if (source) {
        source.onended = () => { audioDone = true; maybeReveal(); };
        setTimeout(() => { audioDone = true; maybeReveal(); }, Math.ceil(durationMs) + 500);
      } else {
        audioDone = true;
      }

      // Pace the on-screen text to land just before the narration ends.
      const textBudget = Math.max(2000, durationMs - BRIEFING_TEXT_END_LEAD_MS);
      revealBriefingText(textEl, paragraphs, textBudget).then(() => {
        textDone = true;
        maybeReveal();
      });

      maybeReveal();
    })
    .catch(() => {
      audioDone = true;
      revealBriefingText(textEl, paragraphs, paragraphs.length * BRIEFING_FALLBACK_PARA_MS)
        .then(() => {
          textDone = true;
          maybeReveal();
        });
    });
}

// Reveals briefing paragraphs across totalMs, time-sliced by paragraph length
// so longer paragraphs (more narration) get proportionally more time.
function revealBriefingText(container, paragraphs, totalMs) {
  const lengths = paragraphs.map(line => Math.max(line.length, 1));
  const totalChars = lengths.reduce((sum, n) => sum + n, 0);

  if (BRIEFING_TEXT_MODE === "typewriter") {
    return typewriteBriefing(container, paragraphs, lengths, totalChars, totalMs);
  }
  if (BRIEFING_TEXT_MODE === "fade-lines") {
    return fadeLinesBriefing(container, paragraphs, lengths, totalChars, totalMs);
  }
  return fadeBriefing(container, paragraphs, lengths, totalChars, totalMs);
}

// Like fadeBriefing, but within each paragraph the wrapped visual lines fade in
// one at a time from top to bottom across that paragraph's time slice.
function fadeLinesBriefing(container, paragraphs, lengths, totalChars, totalMs) {
  return new Promise(resolve => {
    let elapsed = 0;
    paragraphs.forEach((line, i) => {
      const start = elapsed;
      const slice = (lengths[i] / totalChars) * totalMs;
      elapsed += slice;
      setTimeout(() => revealParagraphByLines(container, line, slice), start);
    });
    setTimeout(resolve, elapsed);
  });
}

function revealParagraphByLines(container, text, slice) {
  const p = document.createElement("p");
  p.className = "briefing-line briefing-line-instant";

  const words = text.split(" ");
  words.forEach((word, idx) => {
    const span = document.createElement("span");
    span.className = "briefing-word";
    span.textContent = idx < words.length - 1 ? `${word} ` : word;
    p.appendChild(span);
  });
  container.appendChild(p);

  // Group word spans into visual lines by their rendered vertical position.
  const spans = Array.from(p.querySelectorAll(".briefing-word"));
  const lines = [];
  let currentTop = null;
  spans.forEach(span => {
    const top = span.offsetTop;
    if (currentTop === null || top !== currentTop) {
      currentTop = top;
      lines.push([]);
    }
    lines[lines.length - 1].push(span);
  });

  const perLine = slice / Math.max(lines.length, 1);
  lines.forEach((group, li) => {
    setTimeout(() => {
      group.forEach(span => span.classList.add("briefing-word-visible"));
    }, li * perLine);
  });
}

function fadeBriefing(container, paragraphs, lengths, totalChars, totalMs) {
  return new Promise(resolve => {
    let elapsed = 0;
    paragraphs.forEach((line, i) => {
      const start = elapsed;
      elapsed += (lengths[i] / totalChars) * totalMs;
      setTimeout(() => {
        const p = document.createElement("p");
        p.className = "briefing-line";
        p.textContent = line;
        container.appendChild(p);
      }, start);
    });
    setTimeout(resolve, elapsed);
  });
}

function typewriteBriefing(container, paragraphs, lengths, totalChars, totalMs) {
  return new Promise(resolve => {
    let index = 0;

    function nextParagraph() {
      if (index >= paragraphs.length) {
        resolve();
        return;
      }

      const line = paragraphs[index];
      const slice = (lengths[index] / totalChars) * totalMs;
      const charDelay = Math.max(8, slice / Math.max(line.length, 1));

      const p = document.createElement("p");
      p.className = "briefing-line briefing-line-instant";
      container.appendChild(p);

      let c = 0;
      const timer = setInterval(() => {
        if (c >= line.length) {
          clearInterval(timer);
          index += 1;
          nextParagraph();
          return;
        }
        p.textContent += line[c];
        c += 1;
      }, charDelay);
    }

    nextParagraph();
  });
}

function revealAccept() {
  const btn = document.getElementById("accept-btn");
  if (!btn || !btn.classList.contains("hidden")) return;
  btn.classList.remove("hidden");
  flickerReveal(btn, { fast: true });
}

function acceptMission() {
  GAME_STATE.flags.briefingComplete = true;
  saveState(GAME_STATE);
  startGame();
}

// Debug shortcut: jump straight to a fully-loaded dashboard, bypassing the
// briefing and all boot/initialize animations.
function skipToDashboard() {
  stopLoadingSound();
  booting = false;

  ["menu-screen", "briefing-screen"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("active");
      el.classList.add("hidden");
    }
  });

  const mainScreen = document.getElementById("main-screen");
  mainScreen.classList.remove("hidden", "booting");
  mainScreen.classList.add("active", "boot-complete");

  const loader = document.getElementById("boot-loader");
  if (loader) loader.classList.add("hidden");

  document.querySelectorAll(".init-target").forEach(el => {
    el.classList.remove(
      "init-hidden",
      "reveal-flicker",
      "reveal-flicker-fast",
      "typing",
      "cursor-blink"
    );
    el.classList.add("revealed");
  });

  showScreen("dashboard");
  render();
}

async function startGame() {
  if (booting) return;
  await warmUpAudio();
  booting = true;

  const acceptBtn = document.getElementById("accept-btn");
  if (acceptBtn) {
    acceptBtn.disabled = true;
    acceptBtn.textContent = "INITIALIZING...";
  }

  ["menu-screen", "briefing-screen"].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("active");
      el.classList.add("hidden");
    }
  });

  const mainScreen = document.getElementById("main-screen");
  mainScreen.classList.remove("hidden");
  mainScreen.classList.add("active", "booting");

  showScreen("dashboard");

  const loader = document.getElementById("boot-loader");
  loader.classList.remove("hidden", "loader-exit");

  await animateBootProgress();

  loader.classList.add("loader-exit");
  await delay(500);
  loader.classList.add("hidden");

  await runDashboardReveal();

  mainScreen.classList.remove("booting");
  mainScreen.classList.add("boot-complete");
  booting = false;

  render();
}

async function loadGameData() {
  const [embryos, missions, audioLogs] = await Promise.all([
    fetch("./data/embryos.json").then(r => r.json()),
    fetch("./data/missions.json").then(r => r.json()),
    fetch("./data/audioLogs.json").then(r => r.json())
  ]);

  EMBRYO_DATA = embryos;
  MISSION_DATA = missions;
  AUDIO_LOG_DATA = audioLogs;
  await loadDinoDbData();
  await loadBriefingData();
  await loadPuzzleData();
}

async function loadPuzzleData() {
  const ids = ["puzzle_01", "puzzle_02"];
  const results = await Promise.all(
    ids.map(id =>
      fetch(`./data/puzzles/${id}.json`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );

  PUZZLE_DATA = {};
  ids.forEach((id, i) => {
    if (results[i]) PUZZLE_DATA[id] = results[i];
  });
}

async function loadBriefingData() {
  try {
    const response = await fetch("./data/briefing.json");
    briefingData = response.ok ? await response.json() : null;
  } catch (err) {
    console.warn("Failed to load briefing data:", err);
    briefingData = null;
  }
}

async function loadDinoDbData() {
  const ids = Object.keys(EMBRYO_DATA);
  const results = await Promise.all(
    ids.map(id =>
      fetch(`./dino_db_info/${id}.json`)
        .then(r => (r.ok ? r.json() : null))
        .catch(() => null)
    )
  );

  DINO_DB_DATA = {};
  ids.forEach((id, i) => {
    if (results[i]) DINO_DB_DATA[id] = results[i];
  });
}

function showScreen(screenId) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("hidden", view.id !== `view-${screenId}`);
  });

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.screen === screenId);
  });
}

function render() {
  renderDashboard();
  renderMissionView();
  renderEmbryoVault();
  renderDinoDatabase();
  renderTrackingConsole();
  renderDebugPanel();
}

function renderDashboard() {
  const mainScreen = document.getElementById("main-screen");
  if (!mainScreen.classList.contains("boot-complete")) return;

  document.getElementById("mission-body").innerHTML =
    buildDashboardMissionHtml(getActiveMission());
  document.getElementById("dashboard-title").textContent = "FIELD OPERATIONS DASHBOARD";
  document.getElementById("status").textContent =
    `EMBRYOS: ${GAME_STATE.player.embryosCollected.length}/10`;
}

function renderMissionView() {
  const el = document.getElementById("mission-list");
  const entries = Object.values(MISSION_DATA);

  if (!entries.length) {
    el.innerHTML = "<i>Loading mission data...</i>";
    return;
  }

  el.innerHTML = entries.map(mission => {
    const status = GAME_STATE.missions[mission.id] || "locked";
    return `
      <div class="mission-item status-${status}">
        <strong>${mission.title}</strong>
        <span class="badge">${status.toUpperCase()}</span>
        <p>${mission.description}</p>
      </div>
    `;
  }).join("");
}

function renderEmbryoVault() {
  const el = document.getElementById("embryos");
  const ids = Object.keys(GAME_STATE.embryos);

  if (!ids.length) {
    el.innerHTML = "<i>No embryo data loaded</i>";
    return;
  }

  el.innerHTML = ids.map(id => {
    const status = GAME_STATE.embryos[id];
    const meta = EMBRYO_DATA[id];
    const name = meta ? meta.name : id;
    const icon = status === "collected" ? "✔" : status === "locked" ? "○" : "◌";
    return `<div class="embryo-slot ${status}">${icon} ${name}</div>`;
  }).join("");
}

function getDinoMeta(id) {
  return EMBRYO_DATA[id] || null;
}

function getDinoDbEntry(id) {
  return DINO_DB_DATA[id] || null;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHologramHtml(meta) {
  const altText = escapeHtml(meta.name);

  return `
    <div class="holo-stage">
      <div class="holo-platform"></div>
      <div class="holo-ring holo-ring-outer"></div>
      <div class="holo-ring holo-ring-inner"></div>
      <div class="holo-spinner">
        <img src="${escapeHtml(meta.image)}" alt="${altText}" class="holo-model" />
      </div>
      <div class="holo-scan-bar" aria-hidden="true"></div>
      <div class="holo-scanlines"></div>
      <div class="holo-label">HOLOGRAPHIC RENDER — SCANNING</div>
    </div>
  `;
}

function buildDinoDetailsHtml(meta, dbEntry) {
  const stats = dbEntry?.stats
    ? [...dbEntry.stats]
    : [
        { label: "Specimen ID", value: meta.id.toUpperCase() },
        { label: "Status", value: "RECOVERED" },
        { label: "Containment", value: "BARBASOL CAN" }
      ];

  if (meta.audioLog && !stats.some(s => s.label === "Log Ref")) {
    stats.push({ label: "Log Ref", value: meta.audioLog.toUpperCase() });
  }

  const statsHtml = stats.map(s => `
    <div><span>${escapeHtml(s.label)}</span><strong>${escapeHtml(s.value)}</strong></div>
  `).join("");

  const summary = dbEntry?.summary
    ? `<p class="dino-summary">${escapeHtml(dbEntry.summary)}</p>`
    : "";

  const facts = dbEntry?.facts?.length
    ? `<div class="dino-facts">
        <h5>Specimen Log</h5>
        <ul>${dbEntry.facts.map(f => `<li>${escapeHtml(f)}</li>`).join("")}</ul>
      </div>`
    : "";

  const fieldNotes = dbEntry?.fieldNotes
    ? `<p class="dino-field-notes"><span>Field Notes</span>${escapeHtml(dbEntry.fieldNotes)}</p>`
    : "";

  return `
    <div class="dino-details">
      <h4>${escapeHtml(meta.name)}</h4>
      <p class="dino-species">${escapeHtml(meta.species)}</p>
      ${summary}
      <div class="dino-meta-grid">${statsHtml}</div>
      ${facts}
      ${fieldNotes}
    </div>
  `;
}

function renderDinoDatabase() {
  const el = document.getElementById("dino-database");
  const collected = GAME_STATE.player.embryosCollected;

  if (!collected.length) {
    selectedDinoId = null;
    el.innerHTML = "<p class=\"dino-empty\">No specimens logged. Recover embryos to populate database.</p>";
    return;
  }

  if (!selectedDinoId || !collected.includes(selectedDinoId)) {
    selectedDinoId = collected[collected.length - 1];
  }

  const meta = getDinoMeta(selectedDinoId);
  if (!meta) {
    el.innerHTML = "<p class=\"dino-empty\">Specimen data unavailable.</p>";
    return;
  }

  const dbEntry = getDinoDbEntry(selectedDinoId);

  const selector = collected.map(id => {
    const dino = getDinoMeta(id);
    const label = dino ? dino.name : id;
    const active = id === selectedDinoId ? " active" : "";
    return `<button type="button" class="dino-select-btn${active}" data-id="${id}">${label}</button>`;
  }).join("");

  el.innerHTML = `
    <div class="dino-selector">${selector}</div>
    ${buildHologramHtml(meta)}
    ${buildDinoDetailsHtml(meta, dbEntry)}
  `;

  el.querySelectorAll(".dino-select-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedDinoId = btn.dataset.id;
      renderDinoDatabase();
    });
  });
}

function renderTrackingConsole() {
  const signal = GAME_STATE.systems.gpsSignal;
  const tracking = GAME_STATE.systems.trackingEnabled;
  const motion = GAME_STATE.systems.motionTrackerEnabled;

  document.getElementById("gps-signal").textContent = signal.toUpperCase();
  document.getElementById("tracking-status").textContent = tracking ? "ENABLED" : "DISABLED";
  document.getElementById("motion-status").textContent = motion ? "ACTIVE" : "STANDBY";
}

function getActiveMission() {
  const activeId = Object.keys(GAME_STATE.missions).find(
    id => GAME_STATE.missions[id] === "active"
  );
  return activeId ? MISSION_DATA[activeId] : null;
}

function parseQRCode(raw) {
  return JSON.parse(raw.trim());
}

window.onQRCodeScanned = function onQRCodeScanned(raw) {
  try {
    handleQR(parseQRCode(raw));
  } catch (err) {
    showEventOverlay("INVALID QR", "Code does not contain valid mission data.");
  }
};

function handleQR(payload) {
  console.log("STATE BEFORE:", structuredClone(GAME_STATE));
  console.log("QR RECEIVED:", payload);

  if (!payload || !payload.type) {
    showEventOverlay("INVALID QR", "Payload missing type field.");
    return;
  }

  switch (payload.type) {
    case "embryo":
      collectEmbryo(payload.id, payload);
      break;
    case "event":
      handleEvent(payload);
      break;
    case "puzzle":
      handlePuzzle(payload.puzzleId);
      break;
    default:
      showEventOverlay("UNKNOWN QR", `Unsupported type: ${payload.type}`);
  }

  saveState(GAME_STATE);
  render();
  console.log("STATE AFTER:", structuredClone(GAME_STATE));
}

function collectEmbryo(id, payload, { bypassOrder = false } = {}) {
  if (!id || GAME_STATE.embryos[id] === undefined) {
    showEventOverlay("INVALID SPECIMEN", `Unknown embryo: ${id}`);
    return;
  }

  if (GAME_STATE.embryos[id] === "collected") {
    showEventOverlay("DUPLICATE SCAN", `${payload?.name || id} already recovered.`);
    return;
  }

  const expectedId = getActiveMission()?.embryo;
  if (!bypassOrder && expectedId && id !== expectedId) {
    const expectedName = EMBRYO_DATA[expectedId]?.name || expectedId;
    showEventOverlay(
      "OUT OF SEQUENCE",
      `Recovery protocol violation. Current objective: secure the ${expectedName} embryo first.`
    );
    return;
  }

  GAME_STATE.embryos[id] = "collected";
  GAME_STATE.player.embryosCollected.push(id);
  selectedDinoId = id;

  const name = payload?.name || EMBRYO_DATA[id]?.name || id;

  if (payload?.audioLog) {
    const log = AUDIO_LOG_DATA[payload.audioLog];
    if (log) playAudio(log.file);
  }

  const meta = getDinoMeta(id);
  showEventOverlay(
    "EMBRYO RECOVERED",
    `Secure ${name} embryo in cryogenic storage capsule.`,
    { image: meta?.image, variant: "success" }
  );

  if (payload?.unlockMission) {
    unlockMission(payload.unlockMission);
  }

  if (allEmbryosRecovered() && !GAME_STATE.flags.finalEventTriggered) {
    pendingFinale = true;
  }
}

function allEmbryosRecovered() {
  const ids = Object.keys(GAME_STATE.embryos);
  return ids.length > 0 && ids.every(id => GAME_STATE.embryos[id] === "collected");
}

function unlockMission(id) {
  if (!MISSION_DATA[id]) {
    console.warn("Unknown mission:", id);
    return;
  }

  Object.keys(GAME_STATE.missions).forEach(missionId => {
    if (GAME_STATE.missions[missionId] === "active") {
      GAME_STATE.missions[missionId] = "complete";
    }
  });

  GAME_STATE.missions[id] = "active";
  console.log("Mission unlocked:", id);
}

function handleEvent(payload) {
  if (payload.eventId === "raptor_breach") {
    triggerRaptorBreach();
    return;
  }

  if (payload.eventId === "gps_update" && payload.gpsSignal) {
    updateSignal(payload.gpsSignal);
    showEventOverlay("GPS UPDATE", `Signal status: ${payload.gpsSignal}`);
    return;
  }

  if (payload.eventId === "perimeter_alarm") {
    playAudio("alarm.mp3");
    GAME_STATE.systems.motionTrackerEnabled = true;
    showEventOverlay(
      "PERIMETER ALARM",
      "Perimeter breach detected. Motion tracker engaged — verify containment and proceed with caution."
    );
    return;
  }

  if (payload.audio) {
    playAudio(payload.audio);
  }

  showEventOverlay("EVENT TRIGGERED", payload.eventId || "Unknown event");
}

function handlePuzzle(puzzleId) {
  const puzzle = PUZZLE_DATA[puzzleId];
  if (!puzzle) {
    showEventOverlay("INVALID PUZZLE", `Unknown puzzle: ${puzzleId || "missing id"}`);
    return;
  }

  const minEmbryos = puzzle.requiredEmbryosMin || 0;
  const collected = GAME_STATE.player.embryosCollected.length;
  if (collected < minEmbryos) {
    showEventOverlay(
      "ACCESS DENIED",
      `Collect at least ${minEmbryos} embryos before attempting this override. (${collected}/${minEmbryos})`
    );
    return;
  }

  showPuzzleOverlay(puzzle);
}

function showPuzzleOverlay(puzzle) {
  activePuzzleId = puzzle.id;
  const overlay = document.getElementById("puzzle-overlay");
  const solved = GAME_STATE.puzzles[puzzle.id] === true;
  const puzzleType = puzzle.type || "text";
  const isInteractive = puzzleType === "slide" || puzzleType === "gears" || puzzleType === "cipher";

  const subtitleEl = document.getElementById("puzzle-subtitle");
  subtitleEl.textContent = puzzle.subtitle || "";
  subtitleEl.classList.toggle("hidden", !puzzle.subtitle);

  document.getElementById("puzzle-title").textContent = puzzle.title || "Security Override";

  const introEl = document.getElementById("puzzle-intro");
  introEl.textContent = puzzle.intro || "";
  introEl.classList.toggle("hidden", !puzzle.intro);

  const bodyEl = document.getElementById("puzzle-body");
  bodyEl.textContent = puzzle.puzzleBody || "";
  bodyEl.classList.toggle("hidden", !puzzle.puzzleBody);

  const textControls = document.getElementById("puzzle-text-controls");
  const interactiveEl = document.getElementById("puzzle-interactive");
  textControls.classList.toggle("hidden", isInteractive && puzzleType !== "cipher");
  interactiveEl.classList.toggle("hidden", !isInteractive);

  const answerLabel = document.querySelector("#puzzle-text-controls .puzzle-answer-label");
  if (answerLabel) {
    answerLabel.textContent = puzzle.answerLabel || "ENTER SOLUTION";
  }

  if (solved) {
    PuzzleEngine.unmount();
    showPuzzleSolvedView(puzzle);
  } else {
    document.getElementById("puzzle-active").classList.remove("hidden");
    document.getElementById("puzzle-solved").classList.add("hidden");
    document.getElementById("puzzle-error").classList.add("hidden");

    if (isInteractive) {
      const input = document.getElementById("puzzle-answer-input");
      input.value = "";
      input.classList.remove("puzzle-shake");
      PuzzleEngine.mount(interactiveEl, puzzle, {
        onSolved: () => markPuzzleSolved(puzzle)
      });
      if (puzzleType === "cipher") {
        setTimeout(() => input.focus(), 100);
      }
    } else {
      PuzzleEngine.unmount();
      interactiveEl.innerHTML = "";
      const input = document.getElementById("puzzle-answer-input");
      input.value = "";
      input.classList.remove("puzzle-shake");
      setTimeout(() => input.focus(), 100);
    }
  }

  overlay.classList.remove("hidden");
}

function markPuzzleSolved(puzzle) {
  GAME_STATE.puzzles[puzzle.id] = true;
  saveState(GAME_STATE);
  PuzzleEngine.unmount();
  showPuzzleSolvedView(puzzle);
  renderDebugPuzzleButtons();
}

function showPuzzleSolvedView(puzzle) {
  document.getElementById("puzzle-active").classList.add("hidden");
  document.getElementById("puzzle-solved").classList.remove("hidden");
  document.getElementById("puzzle-solved-message").textContent =
    puzzle.solvedMessage || "Override accepted. Use this combination on the lock.";
  document.getElementById("puzzle-lock-label").textContent =
    puzzle.lockCodeLabel || "LOCK COMBINATION";
  document.getElementById("puzzle-lock-code").textContent = puzzle.lockCode || "----";
}

function normalizePuzzleAnswer(value, puzzle) {
  let answer = String(value ?? "");
  if (puzzle.trimAnswer !== false) answer = answer.trim();
  if (!puzzle.caseSensitive) answer = answer.toLowerCase();
  return answer;
}

function normalizeCipherAnswer(value, puzzle) {
  const wordDigits = {
    zero: "0",
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9"
  };

  let answer = normalizePuzzleAnswer(value, puzzle);
  let expanded = ` ${answer} `;
  Object.entries(wordDigits).forEach(([word, digit]) => {
    expanded = expanded.split(` ${word} `).join(` ${digit} `);
  });
  expanded = expanded.trim().replace(/\s+/g, " ");
  const digitsOnly = expanded.replace(/\D/g, "");
  if (digitsOnly) return digitsOnly;
  return expanded.replace(/\s+/g, "");
}

function puzzleAnswerMatches(puzzle, rawValue) {
  const candidates = new Set();
  const primary = puzzle.type === "cipher"
    ? normalizeCipherAnswer(rawValue, puzzle)
    : normalizePuzzleAnswer(rawValue, puzzle);
  candidates.add(primary);

  const alternates = puzzle.acceptAnswers || [];
  alternates.forEach(alt => {
    candidates.add(
      puzzle.type === "cipher"
        ? normalizeCipherAnswer(alt, puzzle)
        : normalizePuzzleAnswer(alt, puzzle)
    );
  });

  const expected = puzzle.type === "cipher"
    ? normalizeCipherAnswer(puzzle.answer, puzzle)
    : normalizePuzzleAnswer(puzzle.answer, puzzle);

  return candidates.has(expected);
}

function submitPuzzleAnswer() {
  const puzzle = PUZZLE_DATA[activePuzzleId];
  if (!puzzle) return;

  const input = document.getElementById("puzzle-answer-input");

  if (!puzzleAnswerMatches(puzzle, input.value)) {
    document.getElementById("puzzle-error").classList.remove("hidden");
    input.classList.add("puzzle-shake");
    input.select();
    setTimeout(() => input.classList.remove("puzzle-shake"), 500);
    return;
  }

  markPuzzleSolved(puzzle);
}

function hidePuzzleOverlay() {
  PuzzleEngine.unmount();
  document.getElementById("puzzle-interactive").innerHTML = "";
  document.getElementById("puzzle-overlay").classList.add("hidden");
  activePuzzleId = null;
}

function triggerRaptorBreach() {
  playAudio("alarm.mp3");
  GAME_STATE.systems.trackingEnabled = true;
  GAME_STATE.systems.motionTrackerEnabled = true;
  updateSignal("target nearby");
  showEventOverlay("RAPTOR BREACH", "Perimeter compromised. Motion tracker activated.");
}

function playAudio(file) {
  if (!file) return;

  const volume = getAudioVolume(file);

  loadAudioBuffer(file).then(buffer => {
    if (buffer) playBuffer(file, volume);
  });
}

function setupButtonSounds() {
  document.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || button.disabled) return;
    playSfx("button");
  }, true);
}

function updateSignal(level) {
  if (!GPS_SIGNALS.includes(level)) {
    console.warn("Invalid GPS signal level:", level);
    return;
  }

  GAME_STATE.systems.gpsSignal = level;
  GAME_STATE.systems.trackingEnabled = level !== "signal lost";
  console.log("GPS signal updated:", level);
}

function showEventOverlay(title, message, { image = null, variant = "alert" } = {}) {
  const overlay = document.getElementById("event-overlay");
  const content = document.getElementById("overlay-content");
  const imageWrap = document.getElementById("event-image-wrap");
  const imageEl = document.getElementById("event-image");

  document.getElementById("event-title").textContent = title;
  document.getElementById("event-message").textContent = message;

  content.classList.remove("overlay-success", "overlay-alert");
  content.classList.add(variant === "success" ? "overlay-success" : "overlay-alert");

  if (image) {
    imageEl.src = image;
    imageEl.alt = title;
    imageWrap.classList.remove("hidden");
  } else {
    imageEl.removeAttribute("src");
    imageWrap.classList.add("hidden");
  }

  overlay.classList.remove("hidden");
}

function hideEventOverlay() {
  document.getElementById("event-overlay").classList.add("hidden");
}

function dismissEventOverlay() {
  hideEventOverlay();
  if (pendingFinale) {
    pendingFinale = false;
    showExtractionFinale();
  }
}

function showExtractionFinale() {
  GAME_STATE.flags.finalEventTriggered = true;

  Object.keys(GAME_STATE.missions).forEach(missionId => {
    if (GAME_STATE.missions[missionId] === "active") {
      GAME_STATE.missions[missionId] = "complete";
    }
  });
  if (GAME_STATE.missions.mission_11 !== undefined) {
    GAME_STATE.missions.mission_11 = "complete";
  }

  saveState(GAME_STATE);
  render();

  const roster = document.getElementById("finale-roster");
  if (roster) {
    roster.innerHTML = Object.keys(EMBRYO_DATA)
      .filter(id => GAME_STATE.embryos[id] === "collected")
      .map(id => {
        const meta = getDinoMeta(id);
        const name = meta ? meta.name : id;
        const img = meta?.image
          ? `<img src="${escapeHtml(meta.image)}" alt="" />`
          : "";
        return `<div class="finale-spec">${img}<span>${escapeHtml(name)}</span></div>`;
      })
      .join("");
  }

  document.getElementById("finale-overlay").classList.remove("hidden");

  // Countdown stays hidden until the extraction audio finishes playing.
  const countdown = document.getElementById("finale-countdown");
  if (countdown) countdown.classList.add("hidden");

  if (GAME_STATE.extractionDeadline) {
    // Resuming after a reload that occurred once the window was already running.
    revealAndStartCountdown();
    return;
  }

  playAudioThen("extraction.mp3", () => {
    if (!GAME_STATE.extractionDeadline) {
      GAME_STATE.extractionDeadline = Date.now() + EXTRACTION_COUNTDOWN_SECONDS * 1000;
      saveState(GAME_STATE);
    }
    revealAndStartCountdown();
  });
}

function revealAndStartCountdown() {
  const countdown = document.getElementById("finale-countdown");
  if (countdown) countdown.classList.remove("hidden");
  startExtractionCountdown();
}

// Plays a one-shot sound and invokes onComplete when it ends (or immediately if unavailable).
function playAudioThen(file, onComplete) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onComplete();
  };

  loadAudioBuffer(file)
    .then(buffer => {
      if (!buffer) {
        finish();
        return;
      }
      const source = playBuffer(file, getAudioVolume(file));
      if (!source) {
        finish();
        return;
      }
      source.onended = finish;
      // Backup: ensure completion fires even if onended is missed.
      setTimeout(finish, Math.ceil(buffer.duration * 1000) + 500);
    })
    .catch(() => finish());
}

function formatCountdown(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getExtractionRemaining() {
  if (!GAME_STATE.extractionDeadline) return null;
  return Math.max(0, Math.round((GAME_STATE.extractionDeadline - Date.now()) / 1000));
}

function updateCountdownDisplays(remaining, expired) {
  const text = formatCountdown(remaining);
  const banner = document.getElementById("extraction-banner");
  const targets = [
    document.getElementById("finale-timer"),
    document.getElementById("extraction-banner-timer")
  ];

  targets.forEach(el => {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("low", !expired && remaining <= 30);
    el.classList.toggle("expired", expired);
  });

  if (banner) banner.classList.remove("hidden");

  if (expired) {
    const msg = document.getElementById("finale-message");
    if (msg) {
      msg.textContent =
        "EXTRACTION WINDOW CLOSED. Proceed immediately — transport is holding past schedule.";
    }
  }
}

// Resumes from the stored deadline; keeps running regardless of overlay visibility.
function startExtractionCountdown() {
  clearInterval(finaleTimerId);
  finaleTimerId = null;

  const initial = getExtractionRemaining();
  if (initial === null) return;

  if (initial <= 0) {
    updateCountdownDisplays(0, true);
    return;
  }

  updateCountdownDisplays(initial, false);
  lastAlarmSecond = null;

  finaleTimerId = setInterval(() => {
    const remaining = getExtractionRemaining();

    if (remaining === null) {
      stopExtractionCountdown();
      return;
    }

    // Beep once for each of the final 5 seconds (5, 4, 3, 2, 1).
    if (remaining >= 1 && remaining <= 5 && remaining !== lastAlarmSecond) {
      lastAlarmSecond = remaining;
      playAudio("alarm.mp3");
    }

    if (remaining <= 0) {
      updateCountdownDisplays(0, true);
      clearInterval(finaleTimerId);
      finaleTimerId = null;
      return;
    }

    updateCountdownDisplays(remaining, false);
  }, 1000);
}

function stopExtractionCountdown() {
  clearInterval(finaleTimerId);
  finaleTimerId = null;
  const banner = document.getElementById("extraction-banner");
  if (banner) banner.classList.add("hidden");
}

function hideFinaleOverlay() {
  document.getElementById("finale-overlay").classList.add("hidden");
}

window.triggerFinale = showExtractionFinale;

function isDashboardDebugUnlocked() {
  return sessionStorage.getItem(DEV_DASHBOARD_KEY) === "1";
}

function revealMenuSkip() {
  document.getElementById("skip-btn")?.classList.remove("hidden");
}

function revealDashboardDebug() {
  const tools = document.getElementById("debug-tools");
  if (tools) tools.classList.remove("hidden");
  renderDebugPanel();
}

function setupDevUnlock(triggerEl, key, storageKey, onUnlock, { persist = true } = {}) {
  if (!triggerEl) return;

  try {
    if (persist && sessionStorage.getItem(storageKey) === "1") {
      onUnlock();
      return;
    }
  } catch (err) {
    console.warn("Dev unlock storage unavailable:", err);
  }

  triggerEl.addEventListener("click", () => {
    const state = devTapState[key];
    clearTimeout(state.timer);
    state.count += 1;

    if (state.count >= DEV_TAP_COUNT) {
      if (persist) {
        try {
          sessionStorage.setItem(storageKey, "1");
        } catch (err) {
          console.warn("Dev unlock storage unavailable:", err);
        }
      }
      state.count = 0;
      onUnlock();
      return;
    }

    state.timer = setTimeout(() => {
      state.count = 0;
    }, DEV_TAP_WINDOW_MS);
  });
}

function shouldUseServiceWorker() {
  const host = location.hostname;
  if (location.protocol === "file:") return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return false;
  if (/^192\.168\./.test(host) || /^10\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) {
    return false;
  }
  if (host.endsWith(".local")) return false;
  return true;
}

function initApp() {
  const playBtn = document.getElementById("play-btn");
  if (playBtn) {
    playBtn.addEventListener("pointerdown", () => {
      warmUpAudio().catch(() => {});
    }, { once: true });
    playBtn.addEventListener("click", onPlay);
  } else {
    console.error("Missing #play-btn — stale cache or incomplete index.html");
  }

  const acceptBtn = document.getElementById("accept-btn");
  if (acceptBtn) acceptBtn.addEventListener("click", acceptMission);

  const skipBtn = document.getElementById("skip-btn");
  if (skipBtn) skipBtn.addEventListener("click", skipToDashboard);

  setupDevUnlock(
    document.getElementById("menu-dev-trigger"),
    "menu",
    DEV_MENU_KEY,
    revealMenuSkip
  );
  setupDevUnlock(
    document.getElementById("briefing-dev-trigger"),
    "briefing",
    DEV_MENU_KEY,
    skipToDashboard,
    { persist: false }
  );
  setupDevUnlock(
    document.getElementById("dashboard-dev-trigger"),
    "dashboard",
    DEV_DASHBOARD_KEY,
    revealDashboardDebug
  );
  setupButtonSounds();

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => showScreen(btn.dataset.screen));
  });

  const dismissOverlay = document.getElementById("dismiss-overlay");
  if (dismissOverlay) dismissOverlay.addEventListener("click", dismissEventOverlay);

  const finaleDismiss = document.getElementById("finale-dismiss");
  if (finaleDismiss) finaleDismiss.addEventListener("click", hideFinaleOverlay);

  const puzzleSubmit = document.getElementById("puzzle-submit");
  if (puzzleSubmit) puzzleSubmit.addEventListener("click", submitPuzzleAnswer);

  const puzzleDismiss = document.getElementById("puzzle-dismiss");
  if (puzzleDismiss) puzzleDismiss.addEventListener("click", hidePuzzleOverlay);

  const puzzleInput = document.getElementById("puzzle-answer-input");
  if (puzzleInput) {
    puzzleInput.addEventListener("keydown", event => {
      if (event.key === "Enter") submitPuzzleAnswer();
    });
  }
}

async function bootApp() {
  initAudioSystem().catch(() => {});

  try {
    initApp();
  } catch (err) {
    console.error("App init failed:", err);
  }

  await loadGameData();
  render();

  if (GAME_STATE.extractionDeadline) {
    startExtractionCountdown();
  } else if (GAME_STATE.flags.finalEventTriggered) {
    // Reloaded during the finale audio before the window began — re-arm it.
    showExtractionFinale();
  }

  if ("serviceWorker" in navigator) {
    if (shouldUseServiceWorker()) {
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.warn("Service worker registration failed:", err);
      });
    } else {
      // Avoid stale offline cache breaking local testing.
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(reg => reg.unregister());
      }).catch(() => {});
    }
  }
}

function renderDebugPanel() {
  renderDebugMissionButtons();
  renderDebugPuzzleButtons();
}

function renderDebugMissionButtons() {
  const container = document.getElementById("debug-mission-buttons");
  if (!container || !isDashboardDebugUnlocked()) return;

  const missions = Object.values(MISSION_DATA)
    .filter(mission => mission.embryo)
    .sort((a, b) => a.id.localeCompare(b.id));

  const activeEmbryo = getActiveMission()?.embryo;

  container.innerHTML = missions.map(mission => {
    const id = mission.embryo;
    const meta = EMBRYO_DATA[id];
    const name = meta?.name || id;
    const collected = GAME_STATE.embryos[id] === "collected";
    const active = id === activeEmbryo;
    const label = mission.id.replace("mission_", "M") + ` — ${name}`;

    return `
      <button type="button"
              class="debug-mission-btn${collected ? " complete" : ""}${active ? " active" : ""}"
              ${collected ? "disabled" : ""}
              onclick="debugCompleteEmbryo('${id}')">${escapeHtml(label)}</button>`;
  }).join("");
}

function renderDebugPuzzleButtons() {
  const container = document.getElementById("debug-puzzle-buttons");
  if (!container || !isDashboardDebugUnlocked()) return;

  const ids = ["puzzle_01", "puzzle_02"];
  container.innerHTML = ids.map(id => {
    const puzzle = PUZZLE_DATA[id];
    if (!puzzle) return "";

    const solved = GAME_STATE.puzzles[id] === true;
    return `
      <button type="button"
              class="debug-mission-btn${solved ? " complete" : ""}"
              onclick="debugOpenPuzzle('${id}')">${escapeHtml(puzzle.title)}</button>`;
  }).join("");
}

window.debugOpenPuzzle = function debugOpenPuzzle(id) {
  if (!isDashboardDebugUnlocked()) return;
  handlePuzzle(id);
};

window.debugCompleteEmbryo = function debugCompleteEmbryo(id) {
  if (!isDashboardDebugUnlocked()) return;

  const meta = EMBRYO_DATA[id];
  if (!meta) return;

  collectEmbryo(
    id,
    {
      type: "embryo",
      id,
      name: meta.name,
      unlockMission: meta.unlockMission,
      audioLog: meta.audioLog
    },
    { bypassOrder: true }
  );

  saveState(GAME_STATE);
  render();
};

window.resetGame = function resetGame() {
  if (!confirm("Reset all progress? This cannot be undone.")) return;
  GAME_STATE = resetState();
  stopExtractionCountdown();
  render();
};

window.addEventListener("storage", event => {
  if (event.key !== "jp_gm_command" || !event.newValue) return;

  try {
    handleQR(JSON.parse(event.newValue));
    localStorage.removeItem("jp_gm_command");
  } catch (err) {
    console.warn("Invalid GM command:", err);
  }
});

document.addEventListener("DOMContentLoaded", () => {
  bootApp().catch(err => console.error("Boot failed:", err));
});

window.onPlay = onPlay;
window.skipToDashboard = skipToDashboard;
