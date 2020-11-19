/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import TargetMapDAO from '../../../src/utils/TargetMapDatabases/TargetMapDAO';

import { NPMRDS as SCHEMA } from '../../../src/constants/databaseSchemaNames';

const targetMapDao = new TargetMapDAO(null, SCHEMA);

export function getRawTargetMapFeatureCollection() {
  const allRawTargetMapFeatures = [
    ...targetMapDao.makeRawEdgeFeaturesIterator(),
  ];

  return turf.featureCollection(allRawTargetMapFeatures);
}

export function getShstMatchesMetadata() {
  const matchesMetadataIter = targetMapDao.makeShstMatchMetadataByTargetMapIdIterator();

  const response = {};

  for (const { targetMapId, shstMatchesMetadata } of matchesMetadataIter) {
    response[targetMapId] = shstMatchesMetadata;
  }

  return response;
}
