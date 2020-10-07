import { join } from 'path';

// https://www.reddit.com/r/typescript/comments/bmy35p/checking_object_schema_at_runtime/
import Ajv from 'ajv';
import * as tsj from 'ts-json-schema-generator';

const ajv = new Ajv();

const config = {
  path: join(__dirname, './types.ts'),
  tsconfig: join(__dirname, '../../../../tsconfig.json'),
  additionalProperties: true,
};

export * from './types';

const tsjGenerator = tsj.createGenerator(config);

export const NysRoadInventorySystemPropertiesSchema = tsjGenerator.createSchema(
  'NysRoadInventorySystemProperties',
);

export const NysRoadInventorySystemPropertiesValidator = ajv.compile(
  NysRoadInventorySystemPropertiesSchema,
);

export const NysRoadInventorySystemFeatureSchema = tsjGenerator.createSchema(
  'NysRoadInventorySystemFeature',
);

export const NysRoadInventorySystemFeatureValidator = ajv.compile(
  NysRoadInventorySystemFeatureSchema,
);
