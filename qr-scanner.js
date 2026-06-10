let scannerActive = false;
let videoStream = null;
let scanFrameId = null;
let lastScannedData = "";
let lastScannedTime = 0;

const SCAN_COOLDOWN_MS = 2500;

function isScannerSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.jsQR);
}

async function getCameraStream() {
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

function scanLoop(video, canvas, ctx) {
  if (!scannerActive) return;

  if (video.readyState >= video.HAVE_ENOUGH_DATA) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert"
    });

    if (code && code.data) {
      const now = Date.now();
      if (code.data !== lastScannedData || now - lastScannedTime > SCAN_COOLDOWN_MS) {
        lastScannedData = code.data;
        lastScannedTime = now;
        onCodeDetected(code.data);
        return;
      }
    }
  }

  scanFrameId = requestAnimationFrame(() => scanLoop(video, canvas, ctx));
}

function onCodeDetected(raw) {
  closeQRScanner();

  if (typeof window.onQRCodeScanned === "function") {
    window.onQRCodeScanned(raw);
  }
}

async function openQRScanner() {
  if (scannerActive) return;

  if (!isScannerSupported()) {
    if (typeof showEventOverlay === "function") {
      showEventOverlay("SCANNER UNAVAILABLE", "Camera or QR decoder not supported on this device.");
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
    scanLoop(video, canvas, ctx);
  } catch (err) {
    console.warn("Camera error:", err);
    closeQRScanner();

    if (typeof showEventOverlay === "function") {
      const msg = err.name === "NotAllowedError"
        ? "Camera access denied. Allow camera permission in Settings."
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
    videoStream.getTracks().forEach(track => track.stop());
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

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("open-scanner-btn")?.addEventListener("pointerdown", () => {
    if (typeof warmUpAudio === "function") warmUpAudio();
  }, { once: true });
  document.getElementById("open-scanner-btn")?.addEventListener("click", openQRScanner);
  document.getElementById("close-scanner-btn")?.addEventListener("click", closeQRScanner);
});
