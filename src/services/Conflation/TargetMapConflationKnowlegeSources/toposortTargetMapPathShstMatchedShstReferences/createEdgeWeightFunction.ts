/* eslint-disable no-underscore-dangle */

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
const PREFER_SHST_MATCHES_DEFAULT = true;
const DEFAULT_SHST_MATCH_DISCOUNT = 0.1;
const DEFAULT_MAX_DISTANCE_KM = 0.2;
const EXCEEDS_MAX_DISTANCE_KM_PENALTY = 2;

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

export type CreateEdgeWeightFunctionOptions = {
  preferShstMatches?: boolean;
  shstMatchDiscount?: number;
  maxDistanceKm?: number;
  exceedsMaxDistanceKmPenalty?: number;
};

export default function createEdgeWeightFunction(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
  options: CreateEdgeWeightFunctionOptions = {},
): EdgeWeightFunction {
  const {
    preferShstMatches,
    shstMatchDiscount,
    maxDistanceKm,
    exceedsMaxDistanceKmPenalty,
  } = options;

  const _preferShstMatches = preferShstMatches ?? PREFER_SHST_MATCHES_DEFAULT;
  const _shstMatchDiscount = shstMatchDiscount ?? DEFAULT_SHST_MATCH_DISCOUNT;
  const _maxDistanceKm = maxDistanceKm ?? DEFAULT_MAX_DISTANCE_KM;
  const _exceedsMaxDistanceKmPenalty =
    exceedsMaxDistanceKmPenalty ?? EXCEEDS_MAX_DISTANCE_KM_PENALTY;

  if (_shstMatchDiscount < 0) {
    throw new Error('shstMatchDiscount must be >= 0');
  }

  if (_maxDistanceKm < 0) {
    throw new Error('maxDistanceKm must be >= 0');
  }

  if (_exceedsMaxDistanceKmPenalty < 0) {
    throw new Error('_exceedsMaxDistanceKmPenalty must be >= 0');
  }

  const {
    targetMapPathEdges,
    allVicinitySharedStreetsReferencesById,
  } = vicinity;

  // Preferred ShstReferences get discounted weight in the Dijkstra algorithm.
  const preferredShstRefs = _preferShstMatches
    ? getPreferredShstReferences(vicinity)
    : new Set();

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

    // IMPORTANT: maxDistanceKm and exceedsMaxDistanceKmPenalty do not apply to preferredShstRefs
    // If the ShstReference is amongst the preferred...
    if (preferredShstRefs.has(shstRef)) {
      // Discount the weight
      const weight = shstReferenceLength * _shstMatchDiscount;

      cachedEdgeWeights[shstRefId] = weight;

      return weight;
    }

    // Create a buffer around the ShstReference under consideration
    const buffer = turf.buffer(shstRef, _maxDistanceKm); // 200m buffer

    // Slice a segment from the TargetMapPath. Need to slice because otherwise very slow.
    const slicedTargetMapPath = getBufferedOverlap(mergedTargetMapPath, buffer);

    // If the TargetMapPath is not within 200 meters of the ShstReference, give it high weight.
    if (!slicedTargetMapPath) {
      const weight = shstReferenceLength * _exceedsMaxDistanceKmPenalty;

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
    // NOTE: We know that all points along the TMPath should be within _maxDistanceKm
    //       of the ShstReference or else it would not have been included in the buffer overlap.
    const diffs = shstRefPts
      .map(
        (pt) =>
          turf.nearestPointOnLine(slicedTargetMapPath, pt).properties.dist,
      )
      .map((dist) => (Number.isFinite(dist) ? dist : _maxDistanceKm * 2));

    // avgDiff range: [0, (_maxDistanceKm * 2)]
    const avgDiff = _.sum(diffs) / diffs.length;

    // weightedAvgDiff range: [1, 2]
    const weightedAvgDiff = avgDiff / (_maxDistanceKm * 2) + 1;

    const weight = weightedAvgDiff * shstReferenceLength;
    cachedEdgeWeights[shstRefId] = weight;

    return weight;
  };
}
