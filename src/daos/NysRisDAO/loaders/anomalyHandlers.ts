import * as turf from '@turf/turf';

import getModuleId from '../../../utils/getModuleId';

import logger from '../../../services/Logger';

// For logging.
const moduleId = getModuleId(__dirname, __filename);

// eslint-disable-next-line import/prefer-default-export
export const handleNysRisGeometryIrregularBoundingPolygon = (
  nysRisShape: turf.Feature<turf.LineString | turf.MultiLineString>,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg: `NYS Road Inventory System shape bounding polygon is MultiPolygon.`,
      nysRisShape,
      _moduleId: moduleId,
    },
  });

  return false;
};
