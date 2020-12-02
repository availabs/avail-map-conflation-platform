import * as turf from '@turf/turf';
import _ from 'lodash';

export default function removeRedundantCoords(coords: turf.Position[]) {
  return coords.filter((coord, i) => !_.isEqual(coords[i - 1], coord));
}
