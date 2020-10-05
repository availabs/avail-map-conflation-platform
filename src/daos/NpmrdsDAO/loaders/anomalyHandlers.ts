import * as turf from '@turf/turf';

import getModuleId from '../../../utils/getModuleId';

import logger from '../../../services/Logger';

// For logging.
const moduleId = getModuleId(__dirname, __filename);

// eslint-disable-next-line import/prefer-default-export
export const handleTmcGeometryIrregularBoundingPolygon = (
  tmcShapeGeoJson: turf.Feature<turf.LineString | turf.MultiLineString>,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg: `NPMRDS TMC geometry bounding polygon is MultiPolygon.`,
      tmcShapeGeoJson,
      _moduleId: moduleId,
    },
  });

  return false;
};
