const GM_COMMAND_KEY = "jp_gm_command";

const EMBRYO_MISSIONS = {
  brachiosaurus: { unlockMission: "mission_02", audioLog: "log_01", name: "Brachiosaurus" },
  ceratosaurus: { unlockMission: "mission_03", audioLog: "log_02", name: "Ceratosaurus" },
  spinosaurus: { unlockMission: "mission_04", audioLog: "log_03", name: "Spinosaurus" },
  carcharodontosaurus: { unlockMission: "mission_05", audioLog: "log_04", name: "Carcharodontosaurus" },
  tyrannosaurus: { unlockMission: "mission_06", audioLog: "log_05", name: "Tyrannosaurus" },
  scorpios_rex: { unlockMission: "mission_07", audioLog: "log_06", name: "Scorpios Rex" },
  carnotaurus: { unlockMission: "mission_08", audioLog: "log_07", name: "Toro" },
  giganotosaurus: { unlockMission: "mission_09", audioLog: "log_08", name: "Giganotosaurus" },
  velociraptor: { unlockMission: "mission_10", audioLog: "log_09", name: "Velociraptor" },
  mutadon: { unlockMission: "mission_11", audioLog: "log_10", name: "Mutadon" }
};

function sendCommand(payload) {
  const json = JSON.stringify(payload);
  localStorage.setItem(GM_COMMAND_KEY, json);
  document.getElementById("qr-output").value = json;
}

function triggerRaptorBreach() {
  sendCommand({
    type: "event",
    eventId: "raptor_breach",
    audio: "alarm.mp3"
  });
}

function sendEvent(eventId, audio) {
  sendCommand({ type: "event", eventId, audio });
}

function unlockEmbryo() {
  const id = document.getElementById("embryo-select").value;
  const meta = EMBRYO_MISSIONS[id];

  sendCommand({
    type: "embryo",
    id,
    name: meta.name,
    unlockMission: meta.unlockMission,
    audioLog: meta.audioLog
  });
}

function setGPSSignal(level) {
  sendCommand({
    type: "event",
    eventId: "gps_update",
    gpsSignal: level
  });
}

function copyQR() {
  const output = document.getElementById("qr-output");
  output.select();
  document.execCommand("copy");
}

window.addEventListener("storage", event => {
  if (event.key === GM_COMMAND_KEY && event.newValue) {
    document.getElementById("qr-output").value = event.newValue;
  }
});
