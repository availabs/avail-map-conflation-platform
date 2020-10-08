import * as turf from '@turf/turf';

import ajv from 'ajv';

import logger from '../services/Logger';

import { ModuleId } from './getModuleId';

// eslint-disable-next-line import/prefer-default-export
export const handleIrregularBoundingPolygon = (
  msg: string,
  moduleId: ModuleId,
  feature: turf.Feature,
) => {
  logger.warn({
    type: 'IRREGULAR_BOUNDING_POLYGON',
    payload: {
      msg,
      feature,
      moduleId,
    },
  });
};

export const handleInputDataSchemaInconsistency = (
  msg: string,
  moduleId: ModuleId,
  dbOnly: readonly string[],
  inputOnly: readonly string[],
) => {
  if (dbOnly.length > 0 || inputOnly.length > 0) {
    logger.warn({
      type: 'INPUT_AND_DATABASE_SCHEMA_INCONSISTENCY',
      payload: {
        msg,
        dbOnly,
        inputOnly,
        moduleId,
      },
    });
  }
};

export const handleAlwaysNullColumns = (
  msg: string,
  moduleId: ModuleId,
  alwaysNullColumns: readonly string[],
) => {
  if (alwaysNullColumns.length > 0) {
    logger.warn({
      type: 'COLUMN_NULL_FOR_ALL_DATABASE_RECORDS',
      payload: {
        msg,
        alwaysNullColumns,
        moduleId,
      },
    });
  }
};

export const handleFailedDataStructureValidation = (
  error: Error,
  moduleId: ModuleId,
  data: any,
  validationErrors: ajv.ErrorObject[],
) => {
  logger.error({
    type: 'DATA_STRUCTURE_VALIDATION_FAILED',
    error: true,
    payload: error,
    meta: {
      data,
      moduleId,
      validationErrors,
    },
  });
};
