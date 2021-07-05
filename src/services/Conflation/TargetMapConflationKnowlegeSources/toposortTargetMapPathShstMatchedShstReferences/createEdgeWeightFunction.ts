import * as turf from '@turf/turf';
import _ from 'lodash';

import getBufferedOverlap from '../../../../utils/gis/getBufferedOverlap';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import mergePathIntoLineString from '../divvyToposortedHypothesizedTargetMapPathShstReferences/mergePathIntoLineString';

import {
  RawTargetMapFeature,
  SharedStreetsGeometryId,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

import { EdgeWeightFunction } from '../../utils/ShstReferencesSubNet';

// Length of the edgs is discounted by this much if ShstMatcher chose ShstReference for the TMPEdge.
const PREFERRED_DISCOUNT = 0.1;

const UNPREFERRED_PENALTY = 2;

// While routing over the candidate ShstReferences for a TMPath,
//   we prefer ShstReferences suggested by ShstMatch.
//   Additionally, we include the opposite direction pair for any
//   bi-directional road segment in the preferredShstRefs set.
export function getPreferredShstReferences(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
): Set<SharedStreetsReferenceFeature> {
  const {
    targetMapPathEdgeShstMatchedShstReferences,
    vicinitySharedStreetsReferences,
  } = vicinity;

  // Get the SharedStreetsGeometryIds of all ShstReferences that ShstMatch selected for TMPEdges.
  const matchedShstGeomIds: Set<SharedStreetsGeometryId> = new Set(
    _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences)
      .filter((s) => s)
      .map(({ properties: { geometryId } }) => geometryId),
  );

  // Initialize the set with the ShstMatchReferences
  const preferredShstRefs = new Set(
    _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences),
  );

  // Add to the set the ShstReferences that share a ShstGeometry with ShstMatch References.
  vicinitySharedStreetsReferences
    .filter(({ properties: { geometryId } }) =>
      matchedShstGeomIds.has(geometryId),
    )
    .forEach((shstRef) => preferredShstRefs.add(shstRef));

  return preferredShstRefs;
}

export default function createEdgeWeightFunction(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
  preferredDiscount?: number,
  unpreferredPenalty?: number,
): EdgeWeightFunction {
  const prefDisc = preferredDiscount ?? PREFERRED_DISCOUNT;
  const unprefPen = unpreferredPenalty ?? UNPREFERRED_PENALTY;

  const {
    targetMapPathEdges,
    allVicinitySharedStreetsReferencesById,
  } = vicinity;

  // Preferred ShstReferences get discounted weight in the Dijkstra algorithm.
  const preferredShstRefs = getPreferredShstReferences(vicinity);

  // The TargetMapPathEdges are merged into a single LineString.
  const mergedTargetMapPath = mergePathIntoLineString(targetMapPathEdges);

  const cachedEdgeWeights = {};

  return (e) => {
    const { name: shstRefId } = e;

    // If we already calculated a weight for this shstRef.
    if (Number.isFinite(cachedEdgeWeights[shstRefId])) {
      return cachedEdgeWeights[shstRefId];
    }

    // Get the SharedStreetsReferenceFeature
    const shstRef = allVicinitySharedStreetsReferencesById[shstRefId];

    if (!shstRef) {
      console.warn(
        'WARNING: Vicinity used to create the weight function not same as vicinity traversed.',
      );
      return Infinity;
    }

    // Get the ShstReference length
    const {
      properties: { shstReferenceLength },
    } = shstRef;

    // If the ShstReference is amongst the preferred...
    if (preferredShstRefs.has(shstRef)) {
      // Discount the weight
      const weight = shstReferenceLength * prefDisc;

      cachedEdgeWeights[shstRefId] = weight;

      return weight;
    }

    const sliceBufferWidth = 200 / 1000;

    // Create a buffer around the ShstReference under consideration
    const buffer = turf.buffer(shstRef, sliceBufferWidth); // 200m buffer

    // Slice a segment from the TargetMapPath. Need to slice because otherwise very slow.
    const slicedTargetMapPath = getBufferedOverlap(mergedTargetMapPath, buffer);

    // If the TargetMapPath is not within 200 meters of the ShstReference, give it high weight.
    if (!slicedTargetMapPath) {
      const weight = shstReferenceLength * unprefPen;

      cachedEdgeWeights[shstRefId] = weight;

      return weight;
    }

    // Get 10 points along the ShstReference
    const shstRefPts = _.range(11).map((n) =>
      turf.along(shstRef, 0 + (n / 10) * shstReferenceLength),
    );

    // NOTE: Fine to use mergedTargetMapPath on backward routing
    //       since only concerned about distance between lines.
    //       Direction is irrelevant unless we use Frechet.

    // Get the distance between each point and the slicedTargetMapPath
    // NOTE: We know that all points along the TMPath should be within sliceBufferWidth
    //       of the ShstReference or else it would not have been included in the buffer overlap.
    const diffs = shstRefPts
      .map(
        (pt) =>
          turf.nearestPointOnLine(slicedTargetMapPath, pt).properties.dist,
      )
      .map((dist) => (Number.isFinite(dist) ? dist : sliceBufferWidth * 2));

    // avgDiff range: [0, (sliceBufferWidth * 2)]
    const avgDiff = _.sum(diffs) / diffs.length;

    // weightedAvgDiff range: [1, 2]
    const weightedAvgDiff = avgDiff / (sliceBufferWidth * 2) + 1;

    const weight = weightedAvgDiff * shstReferenceLength;
    cachedEdgeWeights[shstRefId] = weight;

    return weight;
  };
}
