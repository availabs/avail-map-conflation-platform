/* eslint-disable no-restricted-syntax */

import concaveman from 'concaveman';

import * as turf from '@turf/turf';
import _ from 'lodash';

const BATCH_SIZE = 10000;

function getGeometriesHull(
  convex: boolean,
  geometries:
    | Generator<turf.Geometries | any[]>
    | Array<turf.Geometries | any[]>,
) {
  const concavity = convex ? Infinity : 1;

  let points: turf.Position[] = [];
  let counter = 0;
  for (const geom of geometries) {
    const geomPoints = _(turf.getCoords(geom))
      .flattenDeep()
      .chunk(2)
      .uniqWith(_.isEqual)
      .value();

    points.push(...geomPoints);

    if (++counter === BATCH_SIZE) {
      points = concaveman(points, concavity);
    }
  }

  const hullCoords = concaveman(points, concavity);

  return turf.polygon([hullCoords]);
}

export const getGeometriesConvexHull = getGeometriesHull.bind(null, true);

export const getGeometriesConcaveHull = getGeometriesHull.bind(null, false);
