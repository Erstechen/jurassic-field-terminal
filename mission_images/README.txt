MISSION CLUE IMAGES
===================

Drop one image per mission here. Each gives the player a visual clue to the
general area where that mission's embryo QR code is hidden.

Expected filenames (referenced in data/missions.json):

  mission_01.png  -> Site Entry Protocol (Brachiosaurus)
  mission_02.png  -> Horned Hunter Extraction (Ceratosaurus)
  mission_03.png  -> River Basin Sweep (Spinosaurus)
  mission_04.png  -> Shark-Tooth Pursuit (Carcharodontosaurus)
  mission_05.png  -> King of the Kill Zone (Tyrannosaurus)
  mission_06.png  -> Hybrid Containment (Scorpios Rex)
  mission_07.png  -> Bull Run Protocol (Carnotaurus / Toro)
  mission_08.png  -> Giant Recovery (Giganotosaurus)
  mission_09.png  -> Pack Hunt Extraction (Velociraptor)
  mission_10.png  -> Final Specimen (Mutadon)

Notes:
- mission_11 (Cryo Extraction Complete) has no clue image (image: null).
- To use a different filename or extension (e.g. .png), update the matching
  "image" path in data/missions.json.
- If an image file is missing, the app simply omits it (no broken image).
- By default the clue image appears on the Dashboard for the active mission only.
- The Missions tab lists all missions without clue images.
- Recommended: landscape photos, ~1200px wide, kept reasonably small (<300 KB)
  since they are cached for offline play.
