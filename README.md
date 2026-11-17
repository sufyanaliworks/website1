# Al Yasmeen Stadium · Ajman (3D concept website)

An interactive 3D website (Three.js) for a concept sports and faith district in Al Yasmeen, Ajman, UAE.

- **Stadium**: Bernabéu-inspired football stadium with **~62,000 seats** across 3 tiers and 84 sections, a steel-ribbon facade with a 360° screen band, and a retractable roof.
- **3D seat selection**: drone over the bowl and hover any seat to see its section, row, seat, **price (AED)** and whether it is **Selected / Not selected / Sold**. Click to select. Includes price filters, fly-to-section, "view from seat" and a basket.
- **Changing rooms**: home and away dressing rooms, a hydrotherapy suite and the players' tunnel.
- **Grand mosque**: at the scale of the Sheikh Zayed Grand Mosque (60,000 capacity, 4 minarets, domes, courtyard, pools), faces the qibla. Visitors only. Has wudu areas, washrooms and drinking-water stations.
- **Parking**: 104,800 spaces (8 garages + 4 surface lots).
- **Al Yasmeen Park**: lake, about 2,600 trees, jogging loop, playground and amphitheatre.
- **Highways**: E311 and E611 with an interchange, a ring boulevard and live traffic.
- Smooth drone camera flights, an automatic drone tour, a day/night switch, and WASD/QE free flight.

## Run
It is a static site with no build step:
```
python3 -m http.server 8080
```
Then open http://localhost:8080. It also works on GitHub Pages. Three.js is vendored in `vendor/`.
