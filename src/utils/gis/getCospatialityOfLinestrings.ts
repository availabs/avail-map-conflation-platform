// Sufficient within same map.
//   Buffer is too tight for GTFS-ShSt cospatiality.

import * as turf from '@turf/turf';
import gdal from 'gdal';

import _ from 'lodash';

import lineMerge from './lineMerge';

const GDAL_BUFF_DIST = 5e-7;
const SEGMENTS = 100;
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

export const analyze = (orig, sub) => {
  // Snap each vertex of sub to the orig
  //   Record:
  //     1. Dist from orig start
  //     2. Dist from orig end
  //     3. Dist from snapped pt to next sub vertex snapped pt
  //     4. Dist from snapped pt to prev sub vertex snapped pt

  const origLen = turf.length(orig);

  const subCoords = _(turf.getCoords(sub));
  const subPoints = subCoords.map((coord) => turf.point(coord));

  const overlapInfo = subPoints.reduce((acc, pt, i) => {
    const {
      properties: { location: snappedPtDistAlong },
    } = turf.nearestPointOnLine(orig, pt);
    const snappedPtDistFromEnd = origLen - snappedPtDistAlong;

    const d = {
      snappedPtDistAlong,
      snappedPtDistFromEnd,
      distFromPrevPt: null,
      distFromNextPt: null,
      snappedPtDistFromPrevSnappedPt: null,
      snappedPtDistFromNextSnappedPt: null,
    };

    const prev = _.last(acc);
    if (prev) {
      d.distFromPrevPt = turf.distance(subPoints[i - 1], pt);
      prev.distFromNextPt = d.distFromPrevPt;

      d.snappedPtDistFromPrevSnappedPt =
        snappedPtDistAlong - prev.snappedPtDistAlong;

      prev.snappedPtDistFromNextSnappedPt = d.snappedPtDistFromPrevSnappedPt;
    }

    acc.push(d);

    return acc;
  }, []);

  return overlapInfo;
};

export const getSubGeometryOffsets = (
  { sIntxnAnalysis, sDiffAnalysis, tIntxnAnalysis, tDiffAnalysis },
  { snapToEndPoints = true } = {},
) => {
  const bothIntxnsNull = sIntxnAnalysis === null && tIntxnAnalysis === null;

  const sIntxnPasses =
    bothIntxnsNull ||
    (Array.isArray(sIntxnAnalysis) &&
      sIntxnAnalysis.length === 1 &&
      sIntxnAnalysis
        .slice(1)
        .every(
          ({ distFromPrevPt, distFromPrevSnappedPt }) =>
            Math.abs(distFromPrevPt - distFromPrevSnappedPt) < 0.001,
        ));

  const tIntxnPasses =
    bothIntxnsNull ||
    (Array.isArray(tIntxnAnalysis) &&
      tIntxnAnalysis.length === 1 &&
      tIntxnAnalysis
        .slice(1)
        .every(
          ({ distFromPrevPt, distFromPrevSnappedPt }) =>
            Math.abs(distFromPrevPt - distFromPrevSnappedPt) < 0.001,
        ));

  if (!sIntxnPasses || !tIntxnPasses) {
    throw new Error(
      'Intersection invariant broken. Need to implement intxnAnalysis corrections.',
    );
  }

  // TODO TODO TODO TODO TODO TODO TODO
  //   Make sure Intersections and Differences offsets do NOT overlap.
  //   Use the Differences to improve Intersections accuracy.

  const [sIntxnOffsets, tIntxnOffsets, sDiffOffsets, tDiffOffsets] = [
    sIntxnAnalysis,
    tIntxnAnalysis,
    sDiffAnalysis,
    tDiffAnalysis,
  ].map((subAnalysis) => {
    if (subAnalysis === null) {
      return null;
    }

    return subAnalysis.map((subElemAnalysis) => {
      let startAlong = _.first(subElemAnalysis).snappedPtDistAlong;
      let startFromEnd = _.first(subElemAnalysis).snappedPtDistFromEnd;

      let endAlong = _.last(subElemAnalysis).snappedPtDistAlong;
      let endFromEnd = _.last(subElemAnalysis).snappedPtDistFromEnd;

      if (snapToEndPoints) {
        if (startAlong < GDAL_BUFF_DIST) {
          startFromEnd += startAlong;
          startAlong = 0;
        }
        if (endFromEnd < GDAL_BUFF_DIST) {
          endAlong += endFromEnd;
          endFromEnd = 0;
        }
      }
      return {
        startAlong,
        startFromEnd,
        endAlong,
        endFromEnd,
      };
    });
  });

  // NOTE: Above we ASSERT that the sIntxnAnalysis and tIntxnAnalysis arrays are length 1.
  return {
    sIntxnOffsets: sIntxnOffsets[0],
    sDiffOffsets,
    tIntxnOffsets: tIntxnOffsets[0],
    tDiffOffsets,
  };
};

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
    } catch (err) {
      // console.debug('invalid feature')
      return null;
    }
    return removeShortSegments && turf.length(feature) < SHORT_SEG_LENGTH_THOLD
      ? null
      : feature;
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

export default function getCospatialityOfLinestrings(
  S: turf.Feature<turf.LineString | turf.MultiLineString>,
  T: turf.Feature<turf.LineString | turf.MultiLineString>,
) {
  const sMerged = lineMerge(S);
  const tMerged = lineMerge(T);

  // FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME FIXME
  //  Commented this out to get the NYS RIS to run. Need to actually fix.

  // if (sMerged.length > 1 || tMerged.length > 1) {
  // throw new Error(
  // 'getCospatialityOfLinestrings does not handle discontinuous MultiLineStrings.',
  // );
  // }

  const [sLineString] = sMerged;
  const [tLineString] = tMerged;

  if (!sLineString || !tLineString) {
    return null;
  }

  const sLen = turf.length(sLineString);
  const tLen = turf.length(tLineString);

  if (
    // _.uniqWith(turf.getCoords(S), _.isEqual).length < 2 ||
    // _.uniqWith(turf.getCoords(T), _.isEqual).length < 2
    sLen < SHORT_SEG_LENGTH_THOLD ||
    tLen < SHORT_SEG_LENGTH_THOLD
  ) {
    return null;
  }

  const s = getGdalMultiLineString(sLineString);
  const t = getGdalMultiLineString(tLineString);

  const sBuff = s.buffer(GDAL_BUFF_DIST, SEGMENTS);
  const tBuff = t.buffer(GDAL_BUFF_DIST, SEGMENTS);

  const sIntxn = s.intersection(tBuff); // .intersection(s);
  const tIntxn = t.intersection(sBuff); // .intersection(t);

  // clean up the intersections by removing short segments from multiLineStrings
  //   These can happen when a segment contains a loop that crosses the other
  //     segment's buffer.

  const sIntxnFeature = geometryToGeoJson(sIntxn, true);
  const tIntxnFeature = geometryToGeoJson(tIntxn, true);

  if (sIntxnFeature === null && tIntxnFeature === null) {
    return null;
  }
  if (sIntxnFeature === null || tIntxnFeature === null) {
    console.warn(
      JSON.stringify({
        message:
          'ASSUMPTION BROKEN: one segment has no intersection, while the other does.',
        payload: {
          S,
          T,
          sIntxnFeature,
          tIntxnFeature,
        },
      }),
    );
    return null;
  }

  const sIntxnLineStrings = lineMerge(sIntxnFeature);
  const tIntxnLineStrings = lineMerge(tIntxnFeature);

  const cospatiality = sIntxnLineStrings.reduce(
    (
      acc: ({
        sLen: number;
        sIntxnOffsets: any;
        tLen: number;
        tIntxnOffsets: any;
      } | null)[],
      sIntxnLineString: turf.Feature<turf.LineString>,
    ) => {
      const sIntxn2 = getGdalMultiLineString(sIntxnLineString);

      const cospats = tIntxnLineStrings.map((tIntxnLineString) => {
        const tIntxn2 = getGdalMultiLineString(tIntxnLineString);

        if (sIntxn2 === null || tIntxn2 === null) {
          if (sIntxn2 !== null || tIntxn2 !== null) {
            console.warn(
              JSON.stringify({
                message:
                  'ASSUMPTION BROKEN: one segment has no intersection, while the other does.',
                payload: {
                  S,
                  T,
                  sIntxn2: sIntxn2 && geometryToGeoJson(sIntxn),
                  tIntxn2: tIntxn2 && geometryToGeoJson(tIntxn),
                },
              }),
            );
          }
          return null;
        }

        // const intxn = sIntxn2.union(tIntxn2);
        // const intxnBuff = intxn.buffer(GDAL_BUFF_DIST, SEGMENTS);

        // https://gdal.org/api/ogrgeometry_cpp.html#_CPPv4NK11OGRGeometry6BufferEdi
        const sDiff = s.difference(sIntxn2.buffer(GDAL_BUFF_DIST / 2, 100));
        const tDiff = t.difference(tIntxn2.buffer(GDAL_BUFF_DIST / 2, 100));

        const [sIntersection, tIntersection] = [sIntxn2, tIntxn2].map((g) =>
          geometryToGeoJson(g),
        );

        const [sDifference, tDifference] = [sDiff, tDiff].map((g) =>
          geometryToGeoJson(g),
        );

        const expected =
          _.isNil(sIntersection) === _.isNil(tIntersection) &&
          (_.isNil(sIntersection) ||
            turf.getType(sIntersection) === 'LineString') &&
          (_.isNil(tIntersection) ||
            turf.getType(tIntersection) === 'LineString') &&
          (_.isNil(sDifference) ||
            turf.getType(sDifference) === 'LineString' ||
            (turf.getType(sDifference) === 'MultiLineString' &&
              sDifference.geometry.coordinates.length === 2)) &&
          (_.isNil(tDifference) ||
            turf.getType(tDifference) === 'LineString' ||
            (turf.getType(tDifference) === 'MultiLineString' &&
              tDifference.geometry.coordinates.length === 2));

        if (!expected) {
          console.warn(
            JSON.stringify({
              message: 'WARNING: Unexpected cospatiality result',
              payload: {
                sIntersection,
                sCoords: turf.getCoords(S),
                sDifference,
                tIntersection,
                tCoords: turf.getCoords(T),
                tDifference,
                S,
                T: { ...T, properties: {} },
              },
            }),
          );
        }

        const [sIntxnAnalysis, tIntxnAnalysis, sDiffAnalysis, tDiffAnalysis] = [
          [S, sIntersection],
          [T, tIntersection],
          [S, sDifference],
          [T, tDifference],
        ].map(([orig, sub]) => {
          if (sub === null) {
            return null;
          }

          try {
            return turf.getType(sub) === 'LineString'
              ? [analyze(orig, sub)]
              : turf
                  .getCoords(sub)
                  .map((coords) => analyze(orig, turf.lineString(coords)));
          } catch (err) {
            console.error('@'.repeat(15));
            console.error(turf.getType(sub));
            console.error(JSON.stringify({ sub }, null, 4));
            console.error(JSON.stringify(turf.getCoords(sub), null, 4));
            console.error(err);
            return null;
          }
        });

        const { sIntxnOffsets, tIntxnOffsets } = getSubGeometryOffsets({
          sIntxnAnalysis,
          sDiffAnalysis,
          tIntxnAnalysis,
          tDiffAnalysis,
        });

        // Array because in the future we need to handle discontinuous intersections.
        //   The way we will do that is return mutliple cospatialities, one
        //   for each continuous intersection segment.
        return { sLen, sIntxnOffsets, tLen, tIntxnOffsets };
      });
      acc.push(...cospats.filter((c) => c !== null));
      return acc;
    },
    [],
  );

  return _.isEmpty(cospatiality)
    ? null
    : _.uniqWith(
        cospatiality.filter((c) => c !== null),
        _.isEqual,
      );
}
