import * as turf from '@turf/turf';
import _ from 'lodash';

import getBufferedOverlap from '../../../../utils/gis/getBufferedOverlap';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import mergePathIntoLineString from '../divvyToposortedHypothesizedTargetMapPathShstReferences/mergePathIntoLineString';
import getPreferredShstReferences from './getPreferredShstReferences';

import { RawTargetMapFeature } from '../../domain/types';

import { EdgeWeightFunction } from '../../utils/ShstReferencesSubNet';

export default function createEdgeWeightFunction(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
): EdgeWeightFunction {
  const {
    targetMapPathEdges,
    allVicinitySharedStreetsReferencesById,
  } = vicinity;

  const preferredShstRefs = getPreferredShstReferences(vicinity);

  const targetMapPathForwardMerged = mergePathIntoLineString(
    targetMapPathEdges,
  );

  const cachedEdgeWeights = {};

  return (e) => {
    const { name: shstRefId } = e;

    if (Number.isFinite(cachedEdgeWeights[shstRefId])) {
      return cachedEdgeWeights[shstRefId];
    }

    const shstRef = allVicinitySharedStreetsReferencesById[shstRefId];

    const shstRefLen = turf.length(shstRef);

    if (preferredShstRefs.has(shstRef)) {
      const weight = shstRefLen * 0.5;

      cachedEdgeWeights[shstRefId] = weight;

      return weight;
    }

    const buffer = turf.buffer(shstRef, 200 / 1000); // 200m buffer

    // Need to slice because otherwise very slow.
    const slicedTargetMapPath = getBufferedOverlap(
      targetMapPathForwardMerged,
      buffer,
    );

    if (!slicedTargetMapPath) {
      const weight = 2 * shstRefLen;
      cachedEdgeWeights[shstRefId] = weight;

      return weight;
    }

    const shstRefPts = _.range(11).map((n) =>
      turf.along(shstRef, 0 + (n / 10) * shstRefLen),
    );

    // Fine to use targetMapPathForwardMerged on backward routing
    //   since only concerned about distance between lines.
    //   Direction is irrelevant unless we use Frechet.
    const diffs = shstRefPts
      .map(
        (pt) =>
          turf.nearestPointOnLine(slicedTargetMapPath, pt).properties.dist,
      )
      .map((dist) => (Number.isFinite(dist) ? dist : 0.4));

    const avgDiff = _.sum(diffs) / diffs.length;

    // avgDiff range: [0, .4]
    // weightedAvgDiff range: [1, 2]
    const weightedAvgDiff = avgDiff / 0.4 + 1;

    const weight = weightedAvgDiff * shstRefLen;
    cachedEdgeWeights[shstRefId] = weight;

    return weight;
  };
}
