const STORAGE_KEY = "jp_state";

const defaultState = {
  player: {
    name: "Field Agent",
    embryosCollected: []
  },
  embryos: {
    brachiosaurus: "locked",
    ceratosaurus: "locked",
    spinosaurus: "locked",
    carcharodontosaurus: "locked",
    tyrannosaurus: "locked",
    scorpios_rex: "locked",
    carnotaurus: "locked",
    giganotosaurus: "locked",
    velociraptor: "locked",
    mutadon: "locked"
  },
  missions: {
    mission_01: "active"
  },
  systems: {
    trackingEnabled: false,
    motionTrackerEnabled: false,
    gpsSignal: "signal lost"
  },
  flags: {
    finalEventTriggered: false,
    briefingComplete: false
  },
  puzzles: {
    puzzle_01: false,
    puzzle_02: false
  },
  extractionDeadline: null
};

function migrateState(raw) {
  if (!raw || typeof raw !== "object") {
    return cloneState(defaultState);
  }

  if (raw.player && raw.embryos && raw.missions) {
    const merged = { ...cloneState(defaultState), ...raw };
    const legacyIdMap = { trex: "tyrannosaurus", triceratops: "ceratosaurus" };
    const embryos = cloneState(defaultState.embryos);
    const collected = [];

    Object.entries(raw.embryos || {}).forEach(([id, status]) => {
      const mappedId = legacyIdMap[id] || id;
      if (embryos[mappedId] !== undefined && status === "collected") {
        embryos[mappedId] = "collected";
        collected.push(mappedId);
      }
    });

    merged.embryos = embryos;
    merged.player.embryosCollected = [...new Set(collected)];
    merged.puzzles = { ...cloneState(defaultState.puzzles), ...(raw.puzzles || {}) };
    return merged;
  }

  const migrated = cloneState(defaultState);

  if (Array.isArray(raw.collected)) {
    raw.collected.forEach(id => {
      if (migrated.embryos[id] !== undefined) {
        migrated.embryos[id] = "collected";
        migrated.player.embryosCollected.push(id);
      }
    });
  }

  if (raw.mission) {
    migrated.missions[raw.mission] = "active";
  }

  return migrated;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? migrateState(JSON.parse(saved)) : cloneState(defaultState);
  } catch (err) {
    console.warn("Failed to load state, resetting:", err);
    return cloneState(defaultState);
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  console.log("State saved:", state);
}

function resetState() {
  const fresh = cloneState(defaultState);
  saveState(fresh);
  return fresh;
}

function cloneState(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

let GAME_STATE = loadState();
