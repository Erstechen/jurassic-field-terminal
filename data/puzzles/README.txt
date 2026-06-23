LOCK PUZZLE DEFINITIONS
=========================

One JSON file per physical lock puzzle. Each is triggered by scanning a matching
QR code in qr/ (type: "puzzle", puzzleId must match the "id" here).

Files:
  puzzle_01.json  -> first lock puzzle (sliding tiles)
  puzzle_02.json  -> second lock puzzle (cipher)

Puzzle types (set "type" field):
  text   - Player types an answer (default if omitted)
  slide  - Sliding tile grid; arrange tiles into goal order
  gears  - Linked rotating valve dials with verify button
  cipher - Encrypted message; player decodes and enters the answer

Cipher type:
  cipher.ciphertext  - Encrypted text (shown in 4-character groups)
  cipher.label       - Heading above ciphertext
  cipher.showAlphabet - Show A–Z reference row (default true)
  answer             - Expected solution (e.g. lock digits)
  acceptAnswers      - Optional alternate accepted forms
  answerLabel        - Input label override

Shared fields:
  title, subtitle, intro, puzzleBody, lockCode, lockCodeLabel,
  requiredEmbryosMin, solvedMessage

Text type only:
  answer, caseSensitive

Slide type ("interactive"):
  columns      - grid width (3 = 3x3 with eight tiles + empty slot)
  tileLabels   - labels for tiles 1..N (optional; defaults to numbers)
  initial      - starting order; use 0 for the empty slot
  goal         - solved order (default: 1,2,3..N,0)

Gears type ("interactive"):
  wheel          - shared symbol/number list for all dials (optional)
  dials[]        - label, start (index), target (index); per-dial values optional
  links[]        - { master, slave, delta } — rotating master also rotates slave

Players must press VERIFY PRESSURE; wrong settings show an error with no hint
which valve is incorrect. Do not give direct target values in puzzleBody — use clues.

After editing, bump sw.js CACHE_NAME so iPads refresh the cached JSON.
