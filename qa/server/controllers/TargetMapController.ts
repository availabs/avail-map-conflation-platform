/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf';

import TargetMapDAO from '../../../src/utils/TargetMapDatabases/TargetMapDAO';
import TargetMapConflationBlackboardDao from '../../../src/services/Conflation/TargetMapConflationBlackboardDao'

class TargetMapController {
  private targetMapDao: TargetMapDAO;
  private targetMapConflationBlackboardDao?: TargetMapConflationBlackboardDao;
  private schema: string;

  constructor(schema: string) {
    this.schema = schema
    this.targetMapDao = new TargetMapDAO(null, this.schema);
  }

  // Because this needs to happen after everything loaded.
  private initializeBlackboardDao() {
    this.targetMapConflationBlackboardDao =
      this.targetMapConflationBlackboardDao || new TargetMapConflationBlackboardDao(this.schema)
  }

  getRawTargetMapFeatureCollection() {
    this.initializeBlackboardDao()
    const allRawTargetMapFeatures = [
      ...this.targetMapDao.makeRawEdgeFeaturesIterator(),
    ];

    return turf.featureCollection(allRawTargetMapFeatures);
  }

  getFeatures(ids: string[]) {
    this.initializeBlackboardDao()
    const rawTargetMapFeatures = this.targetMapDao.getRawEdgeFeatures(ids);

    return turf.featureCollection(rawTargetMapFeatures);
  }

  getShstMatchesMetadata() {
    this.initializeBlackboardDao()
    const matchesMetadataIter = this.targetMapConflationBlackboardDao.makeShstMatchMetadataByTargetMapIdIterator();

    const response = {};

    for (const {targetMapId, shstMatchesMetadata} of matchesMetadataIter) {
      response[targetMapId] = shstMatchesMetadata;
    }

    return response;
  }

  getShstChosenMatchesMetadata() {
    this.initializeBlackboardDao()
    const chosenMatchesIter = this.targetMapDao.makeChosenShstMatchesIterator();

    const response = {};

    for (const chosenMatch of chosenMatchesIter) {
      const {
        targetMapId,
        shstReferenceId,
        isForward,
        sectionStart,
        sectionEnd
      } = chosenMatch

      response[targetMapId] = response[targetMapId] || []

      response[targetMapId].push({
        shst_reference: shstReferenceId,
        isForward,
        shst_ref_start: sectionStart,
        shst_ref_end: sectionEnd,
      })
    }

    return response;
  }
}

export default TargetMapController;
