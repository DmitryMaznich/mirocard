# Tug-of-war illustration assets, v1

Illustrations generated for Mironium and approved through the interactive tug-of-war animation mockup (2026-11-19). WebP conversion preserves transparency. Keep these assets out of the single-file JavaScript bundle.

- `garden.webp`: stationary garden, yellow centre flag and ground boundaries.
- `rope.webp`: braided rope and red ribbon, transparent.
- `people.webp`: six equal columns, two rows (boy facing right, man facing left).
- `people-female.webp`: matching six columns, two rows (girl facing right, woman facing left).

Sheets are 2172 × 724 pixels; each pose is 362 × 362 pixels. Gripping hand anchors and animation registration are defined in `src/features/games/tugArt.js`. Characters can be mirrored about their grips to play on either side.

- `celebration.webp`: four columns (release, hands up, jump, landing), four rows (boy, girl, man, woman), 1254 × 1254 pixels. Generated separately from the same character references. Victory animation releases the winning end of the rope, plays two short jumps and holds the happy pose before the reward. Reduced motion shows the hands-up pose without jumping.
