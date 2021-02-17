import * as turf from '@turf/turf';
import _ from 'lodash';

export default function reverseTargetMapPathCoordinates(
  path: turf.Feature<turf.LineString | turf.MultiLineString>[],
) {
  return path
    .map((feature) =>
      turf.lineString(
        _(turf.getCoords(feature))
          .flattenDeep()
          .chunk(2)
          .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
          .reverse()
          .value(),
        feature.properties,
      ),
    )
    .reverse();
}
