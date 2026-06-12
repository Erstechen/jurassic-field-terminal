MISSION CLUE IMAGES
===================

Drop one image per mission here. Each gives the player a visual clue to the
general area where that mission's embryo QR code is hidden.

Expected filenames (referenced in data/missions.json):

  mission_01.jpg  -> Site Entry Protocol (Brachiosaurus)
  mission_02.jpg  -> Tri-Horn Extraction (Triceratops)
  mission_03.jpg  -> River Basin Sweep (Spinosaurus)
  mission_04.jpg  -> Shark-Tooth Pursuit (Carcharodontosaurus)
  mission_05.jpg  -> King of the Kill Zone (Tyrannosaurus)
  mission_06.jpg  -> Hybrid Containment (Scorpios Rex)
  mission_07.jpg  -> Bull Run Protocol (Carnotaurus / Toro)
  mission_08.jpg  -> Giant Recovery (Giganotosaurus)
  mission_09.jpg  -> Pack Hunt Extraction (Velociraptor)
  mission_10.jpg  -> Final Specimen (Mutadon)

Notes:
- mission_11 (Cryo Extraction Complete) has no clue image (image: null).
- To use a different filename or extension (e.g. .png), update the matching
  "image" path in data/missions.json.
- If an image file is missing, the app simply omits it (no broken image).
- By default the clue image appears on the Dashboard for the active mission only.
- The Missions tab lists all missions without clue images.
- Recommended: landscape photos, ~1200px wide, kept reasonably small (<300 KB)
  since they are cached for offline play.
