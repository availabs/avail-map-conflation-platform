import getModuleId from '../../../utils/getModuleId';

import {
  handleIrregularBoundingPolygon,
  handleInputDataSchemaInconsistency,
  handleAlwaysNullColumns,
} from '../../../utils/templateAnomalyHandlers';

// For logging.
const moduleId = getModuleId(__filename);

// eslint-disable-next-line import/prefer-default-export
export const handleTmcGeometryIrregularBoundingPolygon = handleIrregularBoundingPolygon.bind(
  null,
  `NPMRDS TMC geometry bounding polygon is MultiPolygon.`,
  moduleId,
);

export const handleTmcIdentificationInputDataSchemaInconsistency = handleInputDataSchemaInconsistency.bind(
  null,
  'NPMRDS TMC_Identification CSV and tmc_identification SQLite Database schema inconsistency.',
  moduleId,
);

export const handleNpmrdsShapefileInputDataSchemaInconsistency = handleInputDataSchemaInconsistency.bind(
  null,
  'NPMRDS Shapefile and npmrds_shapefile SQLite Database Schema Inconsistency.',
  moduleId,
);

export const handleAlwaysNullTmcIdentificationColumns = handleAlwaysNullColumns.bind(
  null,
  'tmc_identification SQLite Database Column NULL for all NPMRDS TMC_Identification CSV Records.',
  moduleId,
);

export const handleAlwaysNullNpmrdsShapefileColumns = handleAlwaysNullColumns.bind(
  null,
  'npmrds_shapefile SQLite Database Column NULL for all NPMRDS Shapefile Records.',
  moduleId,
);
