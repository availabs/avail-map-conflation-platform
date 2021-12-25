import * as turf from '@turf/turf';
import _ from 'lodash';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

const BUFFER_SIZE_KM = 0.05; // 50 meters

export default function getBufferPolygonCoordsForFeatures(
  features: turf.Feature<turf.LineString | turf.MultiLineString>[],
) {
  const unionedCoords = features
    .reduce((acc: any[], feature) => {
      if (turf.getType(feature) === 'MultiLineString') {
        acc.push(...turf.getCoords(feature));
      } else {
        acc.push(turf.getCoords(feature));
      }

      return acc;
    }, [])
    .filter((c) => !_.isEmpty(c));

  const unionedMultiLineString = turf.multiLineString(unionedCoords);

  const bufferPolyCoords = getBufferPolygonCoords(unionedMultiLineString, {
    bufferRadius: BUFFER_SIZE_KM,
  });

  return bufferPolyCoords;
}
