import getModuleId from '../../../utils/getModuleId';

import {
  handleIrregularBoundingPolygon,
  handleInputDataSchemaInconsistency,
  handleAlwaysNullColumns,
} from '../../../utils/templateAnomalyHandlers';

// For logging.
const moduleId = getModuleId(__filename);

// eslint-disable-next-line import/prefer-default-export
export const handleNysRisGeometryIrregularBoundingPolygon = handleIrregularBoundingPolygon.bind(
  null,
  'NYS Road Inventory System shape bounding polygon is MultiPolygon.',
  moduleId,
);

export const handleNysRoadInventorySystemInputDataSchemaInconsistency = handleInputDataSchemaInconsistency.bind(
  null,
  'NYS Road Inventory System Geodatabase/SQLite Database Schema Inconsistency.',
  moduleId,
);

export const handleAlwaysNullNysRoadInventorySystemColumns = handleAlwaysNullColumns.bind(
  null,
  'NYS Road Inventory System SQLite Database Column NULL for all Geodatabase Records.',
  moduleId,
);
