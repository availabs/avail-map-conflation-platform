import * as turf from '@turf/turf';

import lineMerge from './lineMerge';

export default function linearFeatureCoordsAreContinuous(
  f: turf.Feature<turf.LineString | turf.MultiLineString>,
): boolean {
  return lineMerge(f).length < 2;
}
