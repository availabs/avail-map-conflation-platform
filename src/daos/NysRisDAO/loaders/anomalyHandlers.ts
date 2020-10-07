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

export const handleInputDataSchemaInconsistency = (
  dbOnly: string[],
  inputOnly: string[],
) => {
  if (dbOnly.length > 0 && inputOnly.length > 0) {
    logger.warn({
      type: 'INPUT_AND_DATABASE_SCHEMA_INCONSISTENCY',
      payload: {
        msg: `NYS Road Inventory System Geodatabase/SQLite Database Schema Inconsistency.`,
        dbOnly,
        inputOnly,
        _moduleId: moduleId,
      },
    });
  }
};

export const handleAlwaysNullColumns = (alwaysNullColumns: string[]) => {
  if (alwaysNullColumns.length > 0) {
    logger.warn({
      type: 'COLUMN_NULL_FOR_ALL_DATABASE_RECORDS',
      payload: {
        msg: `NYS Road Inventory System SQLite Database Column NULL for all Geodatabase Records.`,
        alwaysNullColumns,
        _moduleId: moduleId,
      },
    });

    console.warn(
      JSON.stringify(
        {
          type: 'COLUMN_NULL_FOR_ALL_DATABASE_RECORDS',
          payload: {
            msg: `NYS Road Inventory System SQLite Database Column NULL for all Geodatabase Records.`,
            alwaysNullColumns,
            _moduleId: moduleId,
          },
        },
        null,
        4,
      ),
    );
  }
};
