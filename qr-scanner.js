let scannerActive = false;
let videoStream = null;
let scanFrameId = null;
let lastScannedData = "";
let lastScannedTime = 0;
let barcodeDetector = null;
let jsQRDecoder = null;
let decoderMode = null;

const SCAN_COOLDOWN_MS = 2500;

function installMediaDevicesPolyfill() {
  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }
  if (!navigator.mediaDevices.getUserMedia) {
    const legacy = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
    if (legacy) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        return new Promise(function (resolve, reject) {
          legacy.call(navigator, constraints, resolve, reject);
        });
      };
    }
  }
}

function getJsQR() {
  const lib = window.jsQR || (typeof globalThis !== "undefined" ? globalThis.jsQR : null);
  if (typeof lib === "function") return lib;
  if (lib && typeof lib.default === "function") return lib.default;
  return null;
}

function normalizeJsQRGlobal() {
  const decoder = getJsQR();
  if (decoder && typeof window.jsQR !== "function") {
    window.jsQR = decoder;
  }
  return decoder;
}

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.onload = function () {
      script.dataset.loaded = "true";
      resolve();
    };
    script.onerror = function () {
      reject(new Error(`Failed to load ${src}`));
    };
    document.head.appendChild(script);
  });
}

async function ensureQrDecoder() {
  barcodeDetector = null;
  jsQRDecoder = null;
  decoderMode = null;

  if (typeof BarcodeDetector !== "undefined") {
    try {
      const supported = await BarcodeDetector.getSupportedFormats();
      if (supported.includes("qr_code")) {
        barcodeDetector = new BarcodeDetector({ formats: ["qr_code"] });
        decoderMode = "barcode";
        return decoderMode;
      }
    } catch (err) {
      console.warn("BarcodeDetector unavailable:", err);
    }
  }

  jsQRDecoder = normalizeJsQRGlobal();
  if (jsQRDecoder) {
    decoderMode = "jsqr";
    return decoderMode;
  }

  try {
    await loadScript("./lib/jsQR.js");
  } catch (err) {
    console.warn("jsQR load failed:", err);
  }

  jsQRDecoder = normalizeJsQRGlobal();
  if (jsQRDecoder) {
    decoderMode = "jsqr";
    return decoderMode;
  }

  return null;
}

function getScannerUnavailableMessage() {
  if (!window.isSecureContext) {
    return "Camera requires HTTPS. Open the official hosted site link — not http:// or a local network address.";
  }

  installMediaDevicesPolyfill();
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return "Camera API is not available in this browser.";
  }

  return "QR decoder failed to load. Refresh the page to update cached files, then try again.";
}

async function getCameraStream() {
  installMediaDevicesPolyfill();

  const attempts = [
    { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
    { video: { facingMode: "environment" } },
    { video: true }
  ];

  let lastError;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Camera unavailable");
}

function handleDetectedCode(raw) {
  const now = Date.now();
  if (raw === lastScannedData && now - lastScannedTime <= SCAN_COOLDOWN_MS) {
    return;
  }

  lastScannedData = raw;
  lastScannedTime = now;
  onCodeDetected(raw);
}

function scanLoopJsQR(video, canvas, ctx) {
  if (!scannerActive || !jsQRDecoder) return;

  if (video.readyState >= video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQRDecoder(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code && code.data) {
      handleDetectedCode(code.data);
      return;
    }
  }

  scanFrameId = requestAnimationFrame(function () {
    scanLoopJsQR(video, canvas, ctx);
  });
}

function scanLoopBarcodeDetector(video) {
  if (!scannerActive || !barcodeDetector) return;

  barcodeDetector.detect(video)
    .then(function (codes) {
      if (!scannerActive) return;

      const match = codes.find(function (code) {
        return code && code.rawValue;
      });

      if (match) {
        handleDetectedCode(match.rawValue);
        return;
      }

      scanFrameId = requestAnimationFrame(function () {
        scanLoopBarcodeDetector(video);
      });
    })
    .catch(function () {
      if (!scannerActive) return;
      scanFrameId = requestAnimationFrame(function () {
        scanLoopBarcodeDetector(video);
      });
    });
}

function onCodeDetected(raw) {
  closeQRScanner();

  if (typeof window.onQRCodeScanned === "function") {
    window.onQRCodeScanned(raw);
  }
}

async function openQRScanner() {
  if (scannerActive) return;

  installMediaDevicesPolyfill();

  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (typeof showEventOverlay === "function") {
      showEventOverlay("SCANNER UNAVAILABLE", getScannerUnavailableMessage());
    }
    return;
  }

  const decoder = await ensureQrDecoder();
  if (!decoder) {
    if (typeof showEventOverlay === "function") {
      showEventOverlay("SCANNER UNAVAILABLE", getScannerUnavailableMessage());
    }
    return;
  }

  const overlay = document.getElementById("qr-scanner-overlay");
  const video = document.getElementById("qr-scanner-video");
  const canvas = document.getElementById("qr-scanner-canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  overlay.classList.remove("hidden");
  scannerActive = true;

  try {
    videoStream = await getCameraStream();
    video.srcObject = videoStream;
    await video.play();

    if (decoderMode === "barcode") {
      scanLoopBarcodeDetector(video);
    } else {
      scanLoopJsQR(video, canvas, ctx);
    }
  } catch (err) {
    console.warn("Camera error:", err);
    closeQRScanner();

    if (typeof showEventOverlay === "function") {
      const msg = err.name === "NotAllowedError"
        ? "Camera access denied. Allow camera permission in Settings > Safari > Camera."
        : "Unable to access camera. Check permissions and try again.";
      showEventOverlay("CAMERA ERROR", msg);
    }
  }
}

function closeQRScanner() {
  scannerActive = false;

  if (scanFrameId) {
    cancelAnimationFrame(scanFrameId);
    scanFrameId = null;
  }

  if (videoStream) {
    videoStream.getTracks().forEach(function (track) {
      track.stop();
    });
    videoStream = null;
  }

  const video = document.getElementById("qr-scanner-video");
  if (video) {
    video.srcObject = null;
  }

  const overlay = document.getElementById("qr-scanner-overlay");
  if (overlay) {
    overlay.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  normalizeJsQRGlobal();

  document.getElementById("open-scanner-btn")?.addEventListener("pointerdown", function () {
    if (typeof warmUpAudio === "function") warmUpAudio();
  }, { once: true });
  document.getElementById("open-scanner-btn")?.addEventListener("click", function () {
    openQRScanner();
  });
  document.getElementById("close-scanner-btn")?.addEventListener("click", closeQRScanner);
});
