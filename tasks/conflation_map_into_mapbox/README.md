# Create QA mbtiles

## Instructions

### Create the mbtiles

```bash
./bin/dumpSharedStreetsReferencesToNDGeoJSON.js
./bin/createSharedStreets2019MBTiles
```

```bash
./bin/dumpNpmrdsToNDGeoJSON.js
./bin/createNpmrds2019MBTiles
```

## Serving

The mbtiles are served using the
[AVAIL MBTiles Server](https://github.com/availabs/avail_mbtiles_server).
NOTE: MBTile files renamed in the server's ./config.json file.
