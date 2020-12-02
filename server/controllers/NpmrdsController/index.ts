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

export function getNpmrdsFeatures(tmcs: string[]) {
  const rawTargetMapFeatures = targetMapDao.getRawEdgeFeatures(tmcs);

  return turf.featureCollection(rawTargetMapFeatures);
}

export function getShstMatchesMetadata() {
  const matchesMetadataIter = targetMapDao.makeShstMatchMetadataByTargetMapIdIterator();

  const response = {};

  for (const { targetMapId, shstMatchesMetadata } of matchesMetadataIter) {
    response[targetMapId] = shstMatchesMetadata;
  }

  return response;
}

export function getShstChosenMatchesMetadata() {
  const chosenMatchesIter = targetMapDao.makeTargetMapEdgesChosenMatchesIterator();

  const response = {};

  let i = 0;
  for (const {
    targetMapId,
    chosenMatchesFeatureCollection,
  } of chosenMatchesIter) {
    const matches = chosenMatchesFeatureCollection.features;

    const matchesMetadata = matches.map(
      ({
        properties: {
          shstMatchId: shst_match_id,
          shstReferenceId: shst_reference,
          section: [shst_ref_start, shst_ref_end],
        },
      }) => ({ shst_match_id, shst_reference, shst_ref_start, shst_ref_end }),
    );

    response[targetMapId] = matchesMetadata;

    if (++i === 3) {
      break;
    }
  }

  return response;
}
