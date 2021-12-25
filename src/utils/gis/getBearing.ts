import * as turf from '@turf/turf';
import _ from 'lodash';

type LinearFeature = turf.Feature<turf.LineString | turf.MultiLineString>;

export default function getBearing(path: LinearFeature | LinearFeature[]) {
  const startEdge = Array.isArray(path) ? _.first(path) : path;
  const lastEdge = Array.isArray(path) ? _.last(path) : path;

  // @ts-ignore
  const startCoord: turf.Position = _(turf.getCoords(startEdge))
    .flattenDeep()
    .chunk(2)
    .first();

  // @ts-ignore
  const lastCoord: turf.Position = _(turf.getCoords(lastEdge))
    .flattenDeep()
    .chunk(2)
    .last();

  const startPt = turf.point(startCoord);
  const lastPt = turf.point(lastCoord);

  if (turf.distance(startPt, lastPt) < 0.000001) {
    return null;
  }

  const bearing = turf.bearing(startPt, lastPt);

  return bearing;
}
