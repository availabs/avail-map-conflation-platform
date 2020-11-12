import { join } from 'path';

// https://www.reddit.com/r/typescript/comments/bmy35p/checking_object_schema_at_runtime/
import Ajv from 'ajv';
import * as tsj from 'ts-json-schema-generator';

import { handleFailedDataStructureValidation } from '../../../../utils/templateAnomalyHandlers';
import getModuleId from '../../../../utils/getModuleId';

import {
  TmcIdentificationProperties,
  NpmrdsShapefileFeature,
  NpmrdsTmcFeature,
} from './types';

// For logging.
const moduleId = getModuleId(__filename);

const ajv = new Ajv();

const typesFilePath = join(__dirname, './types.ts');
const tsconfigPath = join(__dirname, '../../../../../tsconfig.json');

const config = {
  path: typesFilePath,
  tsconfig: tsconfigPath,
  additionalProperties: true,
};

const tsjGenerator = tsj.createGenerator(config);

export * from './types';

export const TmcIdentificationPropertiesSchema = tsjGenerator.createSchema(
  'TmcIdentificationProperties',
);

export const TmcIdentificationPropertiesValidator = ajv.compile(
  TmcIdentificationPropertiesSchema,
);

export const validateTmcIdentificationProperties = (
  tmcIdentProps: TmcIdentificationProperties,
) => {
  TmcIdentificationPropertiesValidator(tmcIdentProps);

  if (TmcIdentificationPropertiesValidator.errors) {
    const error = new Error(
      'Invalid NPMRDS TmcIdentificationProperties object.',
    );

    handleFailedDataStructureValidation(
      error,
      moduleId,
      tmcIdentProps,
      TmcIdentificationPropertiesValidator.errors,
    );

    throw error;
  }
};

export const NpmrdsShapefileFeatureSchema = tsjGenerator.createSchema(
  'NpmrdsShapefileFeature',
);

export const NpmrdsShapefileFeatureValidator = ajv.compile(
  NpmrdsShapefileFeatureSchema,
);

export const validateNpmrdsShapefileFeature = (
  feature: NpmrdsShapefileFeature,
) => {
  NpmrdsShapefileFeatureValidator(feature);

  if (NpmrdsShapefileFeatureValidator.errors) {
    const error = new Error('Invalid NPMRDS Shapefile feature.');

    handleFailedDataStructureValidation(
      error,
      moduleId,
      feature,
      NpmrdsShapefileFeatureValidator.errors,
    );

    throw error;
  }
};

export const NpmrdsTmcFeatureSchema = tsjGenerator.createSchema(
  'NpmrdsTmcFeature',
);

export const NpmrdsTmcFeatureValidator = ajv.compile(NpmrdsTmcFeatureSchema);

export function validateNpmrdsTmcFeature(obj: any): obj is NpmrdsTmcFeature {
  NpmrdsTmcFeatureValidator(obj);

  if (NpmrdsTmcFeatureValidator.errors) {
    const error = new Error('Invalid NPMRDS Tmc feature.');

    handleFailedDataStructureValidation(
      error,
      moduleId,
      obj,
      NpmrdsTmcFeatureValidator.errors,
    );

    throw error;
  }

  return true;
}
