// Sufficient within same map.
//   Buffer is too tight for GTFS-ShSt cospatiality.

import * as turf from '@turf/turf';
import gdal from 'gdal';

import _ from 'lodash';

import lineMerge from './lineMerge';

const SHORT_SEG_LENGTH_THOLD = 0.002; // 2 meters

export function getGdalMultiLineString(
  feature: turf.Feature<turf.LineString | turf.MultiLineString>,
) {
  const gdalMultiLineString = new gdal.MultiLineString();

  let geoms = turf.getCoords(feature);

  if (!Array.isArray(geoms[0][0])) {
    geoms = [geoms];
  }

  for (let i = 0; i < geoms.length; ++i) {
    const geom = geoms[i];

    const lineString = new gdal.LineString();

    for (let j = 0; j < geom.length; ++j) {
      const [lon, lat] = geom[j];

      lineString.points.add(new gdal.Point(lon, lat));
    }

    gdalMultiLineString.children.add(lineString);
  }

  return gdalMultiLineString;
}

// https://github.com/naturalatlas/node-gdal/blob/c013781c7564f759145eb1e17a30ca0451ce4057/test/api_polygon.test.js#L164-L180
export function getGdalPolygon(polygon: turf.Feature<turf.Polygon>) {
  const gdalPolygon = new gdal.Polygon();
  const ring = new gdal.LinearRing();

  const coords = polygon.geometry?.coordinates[0];

  coords?.forEach(([lon, lat]) => ring.points.add(lon, lat));

  gdalPolygon.rings.add(ring);

  return gdalPolygon;
}

// https://postgis.net/docs/ST_LineMerge.html
const geometryToGeoJson = (
  geometry: gdal.Geometry,
  removeShortSegments: boolean = false,
) => {
  // @ts-ignore
  const feature = JSON.parse(geometry.toJSON());

  if (turf.getType(feature) === 'LineString') {
    try {
      const coords = turf.getCoords(feature);

      if (!_.flatMapDeep(coords).length) {
        return null;
      }

      return removeShortSegments &&
        turf.length(feature) < SHORT_SEG_LENGTH_THOLD
        ? null
        : turf.lineString(coords, {});
    } catch (err) {
      // console.debug('invalid feature')
      return null;
    }
  }

  if (turf.getType(feature) === 'MultiLineString') {
    try {
      const coords = turf.getCoords(feature);
      if (!_.flatMapDeep(coords).length) {
        return null;
      }
    } catch (err) {
      // console.debug('invalid feature')
      return null;
    }
    // handle linestring[] instead of bare coords
    let lineStrings = lineMerge(feature);

    if (removeShortSegments) {
      lineStrings = lineStrings.filter((f) => {
        const len = turf.length(f);
        return len > SHORT_SEG_LENGTH_THOLD;
      });
    }

    if (lineStrings.length === 0) {
      return null;
    }

    return lineStrings.length === 1
      ? lineStrings[0]
      : turf.multiLineString(lineStrings.map((f) => turf.getCoords(f)));
  }

  // Other possible geometry types of gdal geometry intersection.
  if (
    turf.getType(feature) === 'Point' ||
    turf.getType(feature) === 'MultiPoint' ||
    // @ts-ignore
    turf.getType(feature) === 'GeometryCollection'
  ) {
    return null;
  }

  throw new Error(`Unrecognized feature type: ${turf.getType(feature)}`);
};

export default function getBufferedOverlap(
  line: turf.Feature<turf.LineString | turf.MultiLineString>,
  buffer: turf.Feature<turf.Polygon>,
) {
  const s = getGdalMultiLineString(line);
  const p = getGdalPolygon(buffer);

  const intxn = s.intersection(p); // .intersection(s);

  const intxnGeoJson = geometryToGeoJson(intxn, true);

  if (intxnGeoJson === null) {
    return null;
  }

  const [sIntxnFeature] = lineMerge(intxnGeoJson);

  return sIntxnFeature ?? null;
}
