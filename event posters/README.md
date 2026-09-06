# Program posters — final set

Ten posters, 1200 × 675, exported at 2× (2400 × 1350). Ready to post.

## What's here

| File                  | Organization                  | Artwork      |
|-----------------------|-------------------------------|--------------|
| `quran-classes.png`   | Khadijah Islamic Center       | photo        |
| `soccer.png`          | Salahouddine Mosque           | photo        |
| `self-defence.png`    | Salahouddine Mosque           | photo        |
| `ramadan-iftar.png`   | Centre Islamique de Verdun    | illustration |
| `friday-dinner.png`   | Salahouddine Mosque           | illustration |
| `sisters-brunch.png`  | CIIC — Sisters Youth Team     | illustration |
| `summer-camp.png`     | Al-Madinah Center             | illustration |
| `zikr-madih.png`      | Salahouddine Mosque           | illustration |
| `halaqat-dars.png`    | Mosquée Fatima                | illustration |
| `arabic-school.png`   | Al-Madinah Center             | illustration |

`feed.html` — newsfeed mockup showing all ten in a phone-width scroll.
`photos/` — the source images used on the three photo posters.
`source/` — editable SVGs and the build scripts.

## Swapping an illustration for a photo later

1. Put the image in `photos/` named after the poster, e.g. `photos/ramadan-iftar.jpg`
2. Run `python3 source/build-photo-posters.py`

That rebuilds the poster as a photo layout. Sizes and suggested shots are in
`PHOTOS-README.md`. Slots not filled fall back to a labelled placeholder, so
work through them at whatever pace suits.

## Before publishing

- Each mosque should approve its own poster.
- Confirm you hold rights to the three photos. If they came from a stock site,
  keep the licence on file; the mosque's own photography is safer and usually
  stronger.
- Where children's faces are recognisable, get the photo-permission form signed.
- Two posters say "call for current times" because the schedule isn't published
  anywhere — soccer and self-defence. Fill in real times once the mosque confirms.
