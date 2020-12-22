/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import TargetMapDAO from '../../../src/utils/TargetMapDatabases/TargetMapDAO';

class TargetMapController {
  private targetMapDao: TargetMapDAO;

  constructor(schema: string) {
    this.targetMapDao = new TargetMapDAO(null, schema);
  }

  getRawTargetMapFeatureCollection() {
    const allRawTargetMapFeatures = [
      ...this.targetMapDao.makeRawEdgeFeaturesIterator(),
    ];

    return turf.featureCollection(allRawTargetMapFeatures);
  }

  getFeatures(ids: string[]) {
    const rawTargetMapFeatures = this.targetMapDao.getRawEdgeFeatures(ids);

    return turf.featureCollection(rawTargetMapFeatures);
  }

  getShstMatchesMetadata() {
    const matchesMetadataIter = this.targetMapDao.makeShstMatchMetadataByTargetMapIdIterator();

    const response = {};

    for (const { targetMapId, shstMatchesMetadata } of matchesMetadataIter) {
      response[targetMapId] = shstMatchesMetadata;
    }

    return response;
  }

  getShstChosenMatchesMetadata() {
    const chosenMatchesIter = this.targetMapDao.makeTargetMapEdgesChosenMatchesIterator();

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

    }

    return response;
  }
}

export default TargetMapController;
