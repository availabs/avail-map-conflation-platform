import { join } from 'path';

// https://www.reddit.com/r/typescript/comments/bmy35p/checking_object_schema_at_runtime/
import Ajv from 'ajv';
import * as tsj from 'ts-json-schema-generator';

const ajv = new Ajv();

const config = {
  path: join(__dirname, './types.ts'),
  tsconfig: join(__dirname, '../../../../tsconfig.json'),
};

export * from './types';

export const tmcIdentificationValidator = ajv.compile(
  tsj.createGenerator(config).createSchema('TmcIdentificationProperties'),
);

export const npmrdsShapefileFeatureValidator = ajv.compile(
  tsj.createGenerator(config).createSchema('NpmrdsShapefileFeature'),
);

export const npmrdsTmcFeatureValidator = ajv.compile(
  tsj.createGenerator(config).createSchema('NpmrdsTmcFeature'),
);
