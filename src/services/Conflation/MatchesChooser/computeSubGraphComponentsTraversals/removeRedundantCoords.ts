import _ from 'lodash';

export default function removeRedundantCoords(coords) {
  return coords.filter((coord, i) => !_.isEqual(coords[i - 1], coord));
}
