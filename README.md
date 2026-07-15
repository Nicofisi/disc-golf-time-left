# Will I make it to disc golf?

**Not "what time is sunset" — "how much actual playable light is left once I get there."**

A generic sunset time is misleading for disc golf: courses in Gdańsk sit under tall pine tree lines, so usable light disappears well before the textbook sunset, and by how much depends entirely on the course. This answers the real question by combining live solar position, real travel time, and photographic ground truth — for three specific Gdańsk courses (Jaśkowa Dolina, Park im. R. Reagana, Na Zboczu).

## How it works

1. **Real solar position, not a city-wide lookup.** Uses [SunCalc](https://github.com/mourner/suncalc) against your actual GPS coordinates (or the course's) to compute the sun's angle above the horizon live, rather than a single daily sunset time that's the same across an entire city.
2. **Travel time, not straight-line distance.** Estimates arrival time per transport mode (walk/bike/car/transit) using mode-specific average speeds and a 1.3× route factor to approximate real road distance from as-the-crow-flies, plus a configurable prep-time buffer for "how long you actually take to get out the door."
3. **Drone reference photography as ground truth.** Each course was shot by drone at a range of solar angles (−12° to +6° relative to the horizon) with matched exposure settings, so instead of trusting a formula you can see exactly how much usable light is left at that angle once the sun drops behind the actual tree line — see [`optimize_images.py`](optimize_images.py) for how the ~200 source shots get resized/converted to WebP for the gallery.
4. **The playable cutoff is configurable.** "Good enough light to finish a round" is subjective, so the minimum sun angle is a setting, not a hardcoded assumption.

## Courses covered

Jaśkowa Dolina, Park im. R. Reagana, Na Zboczu — all in Gdańsk.

## Stack

Vanilla JS + [Leaflet](https://leafletjs.com/) (map) + [SunCalc](https://github.com/mourner/suncalc) (astronomy). No framework, no backend, no build step — installable as a PWA (`manifest.json`).

## Live

https://nicofisi.github.io/disc-golf-time-left/
