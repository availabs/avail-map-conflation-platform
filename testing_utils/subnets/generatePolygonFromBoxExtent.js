#!/usr/bin/env node

const turf = require('@turf/turf');

const bboxExtent = process.argv.slice(2).map((x) => +x);

if (!bboxExtent[3]) {
  console.error(
    'USAGE: pass minLat, minLon, maxLat, maxLon as the 4 positional CLI args.',
  );
  process.exit(1);
}

const bboxPolygon = turf.bboxPolygon(bboxExtent);

console.log(JSON.stringify(bboxPolygon));
