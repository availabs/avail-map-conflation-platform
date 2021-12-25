import _ from 'lodash';
import * as turf from '@turf/turf';

export default function mergePathIntoLineString(
  path: turf.Feature<turf.LineString | turf.MultiLineString>[],
) {
  const mergedCoords = _(path)
    .map((shstRef) => turf.getCoords(shstRef))
    .flattenDeep()
    .chunk(2)
    .filter((coord, i, coords) => !_.isEqual(coord, coords[i - 1]))
    .value();

  const lineString = turf.lineString(mergedCoords, {});

  return lineString;
}
