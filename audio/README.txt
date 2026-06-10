Place MP3 audio files here.

Story / event audio (referenced in data/audioLogs.json):
- log_01.mp3 through log_10.mp3
- alarm.mp3

Volume levels for all sounds are configured in app.js → AUDIO_CONFIG.

UI sound effects:
- sfx_typewriter.mp3  — keystroke click during typewriter text
- sfx_flicker.mp3     — CRT flicker reveal
- sfx_button.mp3      — button press
- sfx_loading.mp3     — looping hum during boot loading bar

All files are loaded from ./audio/ and cached by the service worker for offline use.
