import { join } from 'path';

// https://www.reddit.com/r/typescript/comments/bmy35p/checking_object_schema_at_runtime/
import Ajv from 'ajv';
import * as tsj from 'ts-json-schema-generator';

import { handleFailedDataStructureValidation } from '../../../utils/templateAnomalyHandlers';
import getModuleId from '../../../utils/getModuleId';

import {
  NysRoadInventorySystemProperties,
  NysRoadInventorySystemFeature,
} from './types';

// For logging.
const moduleId = getModuleId(__filename);

const ajv = new Ajv();

const config = {
  path: join(__dirname, './types.ts'),
  tsconfig: join(__dirname, '../../../../tsconfig.json'),
  additionalProperties: true,
};

const tsjGenerator = tsj.createGenerator(config);

export * from './types';

export const NysRoadInventorySystemPropertiesSchema = tsjGenerator.createSchema(
  'NysRoadInventorySystemProperties',
);

export const NysRoadInventorySystemPropertiesValidator = ajv.compile(
  NysRoadInventorySystemPropertiesSchema,
);

export const validateNysRoadInventorySystemProperties = (
  properties: NysRoadInventorySystemProperties,
) => {
  NysRoadInventorySystemPropertiesValidator(properties);

  if (NysRoadInventorySystemPropertiesValidator.errors) {
    const error = new Error('Invalid NYS Road Inventory System Properties.');

    handleFailedDataStructureValidation(
      error,
      moduleId,
      properties,
      NysRoadInventorySystemPropertiesValidator.errors,
    );

    throw error;
  }
};

export const NysRoadInventorySystemFeatureSchema = tsjGenerator.createSchema(
  'NysRoadInventorySystemFeature',
);

export const NysRoadInventorySystemFeatureValidator = ajv.compile(
  NysRoadInventorySystemFeatureSchema,
);

export const validateNysRoadInventorySystemFeature = (
  feature: NysRoadInventorySystemFeature,
) => {
  NysRoadInventorySystemFeatureValidator(feature);

  if (NysRoadInventorySystemFeatureValidator.errors) {
    const error = new Error('Invalid NYS Road Inventory System feature.');

    handleFailedDataStructureValidation(
      error,
      moduleId,
      feature,
      NysRoadInventorySystemFeatureValidator.errors,
    );

    throw error;
  }
};
