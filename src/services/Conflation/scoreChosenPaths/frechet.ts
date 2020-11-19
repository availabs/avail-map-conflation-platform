import * as turf from '@turf/turf';

import _ from 'lodash';

import { rebalanceCurve, shapeSimilarity } from 'curve-matcher';

const MIN_POINTS_PER_KM = 50;

const getCoords = (feature: turf.Feature) =>
  _(turf.getCoords(feature))
    .flattenDeep()
    .chunk(2)
    .filter((v, i, c) => !_.isEqual(v, c[i - 1]))
    .map(([lon, lat]) => ({ x: lon, y: lat }))
    .value();

const coordsToCurve = (coords: { x: number; y: number }[], numPoints: number) =>
  rebalanceCurve(coords, { numPoints });

export default function getFrechetDistance(
  S: turf.Feature<turf.LineString | turf.MultiLineString>,
  T: turf.Feature<turf.LineString | turf.MultiLineString>,
) {
  const sCoords = getCoords(S);
  const tCoords = getCoords(T);

  const maxFeatureLen = Math.max(turf.length(S), turf.length(T));
  const minPoints = Math.ceil(maxFeatureLen * MIN_POINTS_PER_KM);

  const numPoints = Math.min(
    Math.max(sCoords.length, tCoords.length),
    minPoints,
  );

  const s = coordsToCurve(sCoords, numPoints);
  const t = coordsToCurve(tCoords, numPoints);

  return shapeSimilarity(s, t, { restrictRotationAngle: 0.1 * Math.PI });
}
