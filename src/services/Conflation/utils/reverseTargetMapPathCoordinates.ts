import * as turf from '@turf/turf';
import _ from 'lodash';

import {
  TargetMapPathEdgeFeatures,
  ReversedTargetMapPathEdgeFeatures,
} from '../domain/types';

export default function reverseTargetMapPathCoordinates(
  path: TargetMapPathEdgeFeatures,
): ReversedTargetMapPathEdgeFeatures {
  // @ts-ignore
  return path
    .map((feature) =>
      turf.lineString(
        // Reverse the coordinates.
        _(turf.getCoords(feature))
          .flattenDeep()
          .chunk(2)
          .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
          .reverse()
          .value(),
        { ...feature.properties, reversed: true },
        { id: feature.id },
      ),
    )
    .reverse();
}
