const CACHE_NAME = "jp-cache-v39";

const CORE_ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./state.js",
  "./qr-scanner.js",
  "./lib/jsQR.js",
  "./manifest.json",
  "./data/embryos.json",
  "./data/missions.json",
  "./data/audioLogs.json",
  "./data/briefing.json",
  "./qr/brachiosaurus.json",
  "./qr/raptor_breach.json",
  "./gm/index.html",
  "./gm/gm.js",
  "./gm/gm.css",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/ingen_logo.png"
];

const DINO_DB_INFO = [
  "./dino_db_info/brachiosaurus.json",
  "./dino_db_info/ceratosaurus.json",
  "./dino_db_info/spinosaurus.json",
  "./dino_db_info/carcharodontosaurus.json",
  "./dino_db_info/tyrannosaurus.json",
  "./dino_db_info/scorpios_rex.json",
  "./dino_db_info/carnotaurus.json",
  "./dino_db_info/giganotosaurus.json",
  "./dino_db_info/velociraptor.json",
  "./dino_db_info/mutadon.json"
];

const DINO_RECOVERY_IMAGES = [
  "./dino_recovery_images/Brachiosaurus.png",
  "./dino_recovery_images/Ceratosaurus.png",
  "./dino_recovery_images/Spinosaurus.png",
  "./dino_recovery_images/Carcharodontosaurus.png",
  "./dino_recovery_images/Tyrannosaurus.png",
  "./dino_recovery_images/Scorpios Rex.png",
  "./dino_recovery_images/Carnotaurus-Toro.png",
  "./dino_recovery_images/Giganotosaurus.png",
  "./dino_recovery_images/Velociraptor.png",
  "./dino_recovery_images/Mutadon.png"
];

const AUDIO_ASSETS = [
  "./audio/sfx_typewriter.mp3",
  "./audio/sfx_flicker.mp3",
  "./audio/sfx_button.mp3",
  "./audio/sfx_loading.mp3",
  "./audio/alarm.mp3",
  "./audio/log_01.mp3",
  "./audio/log_02.mp3",
  "./audio/log_03.mp3",
  "./audio/log_04.mp3",
  "./audio/log_05.mp3",
  "./audio/log_06.mp3",
  "./audio/log_07.mp3",
  "./audio/log_08.mp3",
  "./audio/log_09.mp3",
  "./audio/log_10.mp3",
  "./audio/extraction.mp3",
  "./audio/briefing.mp3"
];

// Optional menu/title-screen art. Cached when present; missing files are ignored.
const MENU_ASSETS = [
  "./images/menu_bg.jpg"
];

// Optional mission clue images. Cached when present; missing files are ignored.
const MISSION_IMAGES = [
  "./mission_images/mission_01.png",
  "./mission_images/mission_02.png",
  "./mission_images/mission_03.png",
  "./mission_images/mission_04.png",
  "./mission_images/mission_05.png",
  "./mission_images/mission_06.png",
  "./mission_images/mission_07.png",
  "./mission_images/mission_08.png",
  "./mission_images/mission_09.png",
  "./mission_images/mission_10.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async cache => {
      await cache.addAll(CORE_ASSETS);
      await Promise.all(
        [...DINO_DB_INFO, ...DINO_RECOVERY_IMAGES, ...AUDIO_ASSETS, ...MENU_ASSETS, ...MISSION_IMAGES].map(url =>
          cache.add(url).catch(() => {})
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
