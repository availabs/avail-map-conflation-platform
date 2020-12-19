/* eslint-disable no-restricted-syntax, import/prefer-default-export */

import * as turf from '@turf/turf';
import _ from 'lodash';

import * as SourceMapDao from '../../../../src/daos/SourceMapDao';
import { SharedStreetsReferenceFeature } from '../../../../src/daos/SourceMapDao/domain/types';

export function getShstReferences(
  shstReferenceIds: SharedStreetsReferenceFeature['id'][],
): turf.FeatureCollection {
  const shstRefs = SourceMapDao.getShstReferences(shstReferenceIds);

  return turf.featureCollection(shstRefs);
}
