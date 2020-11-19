import * as turf from '@turf/turf';
import getFrechetDistance from './frechet';

export default function score(
  S: turf.Feature<turf.LineString | turf.MultiLineString>,
  T: turf.Feature<turf.LineString | turf.MultiLineString>,
) {
  const frechet = getFrechetDistance(S, T);

  return { frechet };
}
