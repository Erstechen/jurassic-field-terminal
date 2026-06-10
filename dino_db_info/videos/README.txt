Turntable videos for the Dino DB holographic viewer (optional per specimen).

Filename: match the embryo id, e.g. brachiosaurus.mp4

Recommended specs:
  - Format: MP4 (H.264) — best iPad Safari support
  - Duration: 4–8 second seamless loop (full 360° rotation)
  - Resolution: 720×720 or 512×512
  - Background: solid near-black (#050a09) to blend with the holo stage
  - No audio track (plays muted)
  - Keep files under ~2–5 MB each for offline cache

Optional poster frame (shown before video loads):
  brachiosaurus-poster.jpg — reference as modelPoster in the JSON file.

If modelVideo is missing or fails to load, the app falls back to the recovery
PNG with CSS 3D rotation (same image as the Recovered overlay).

Authoring tips:
  - Blender: animate camera orbit, render to image sequence, encode as looped MP4
  - Or export a turntable from a 3D model tool and trim to a seamless loop
