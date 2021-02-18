import * as turf from '@turf/turf';
import _ from 'lodash';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import {
  RawTargetMapFeature,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

import getFrechetDistance from '../../scoreChosenPaths/frechet';

import mergePathIntoLineString from '../divvyToposortedHypothesizedTargetMapPathShstReferences/mergePathIntoLineString';
import reverseTargetMapPathCoordinates from '../divvyToposortedHypothesizedTargetMapPathShstReferences/reverseTargetMapPathCoordinates';

export default function selectOptimalShstReferencesChainForTargetMapPath(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
  candidatePaths: SharedStreetsReferenceFeature[][],
  isForward: boolean,
) {
  const { targetMapPathEdges } = vicinity;

  const tmPath = isForward
    ? targetMapPathEdges
    : reverseTargetMapPathCoordinates(targetMapPathEdges);

  const mergedTargetMapPath = mergePathIntoLineString(tmPath);

  const targetMapPathLength = turf.length(mergedTargetMapPath);

  const mergedTargetMapPathCoords = turf.getCoords(mergedTargetMapPath);

  const mergedTargetMapPathStartCoord = turf.point(
    mergedTargetMapPathCoords[0],
  );

  const targetMapPathEndCoord = turf.point(
    mergedTargetMapPathCoords[mergedTargetMapPathCoords.length - 1],
  );

  // Lower score is better.
  const pathScores = new Map();

  for (let i = 0; i < candidatePaths.length; ++i) {
    const path = candidatePaths[i];

    if (_.isEmpty(path)) {
      continue;
    }
    const merged = mergePathIntoLineString(path);

    const startSnap = turf.nearestPointOnLine(
      merged,
      mergedTargetMapPathStartCoord,
    );

    const endSnap = turf.nearestPointOnLine(merged, targetMapPathEndCoord);

    if (
      startSnap?.properties?.location === undefined ||
      endSnap?.properties?.location === undefined ||
      startSnap?.properties?.dist === undefined ||
      endSnap?.properties?.dist === undefined ||
      startSnap.properties.location >= endSnap.properties.location
    ) {
      pathScores.set(path, Infinity);
      continue;
    }

    const sliced = turf.lineSliceAlong(
      merged,
      startSnap.properties.location,
      endSnap.properties.location,
    );

    const slicedLen = turf.length(sliced);

    const compareLen = Math.min(slicedLen, 0.5);

    const startScore =
      getFrechetDistance(
        turf.lineSliceAlong(mergedTargetMapPath, 0, compareLen),
        turf.lineSliceAlong(sliced, 0, compareLen),
      ) * startSnap.properties.dist;

    const endScore =
      getFrechetDistance(
        turf.lineSliceAlong(
          mergedTargetMapPath,
          Math.max(targetMapPathLength - compareLen, 0),
          targetMapPathLength,
        ),
        turf.lineSliceAlong(sliced, slicedLen - compareLen, slicedLen),
      ) * endSnap.properties.dist;

    const sliceLenDiffRatio =
      Math.abs(targetMapPathLength - slicedLen) / targetMapPathLength;

    pathScores.set(path, (startScore + endScore) * sliceLenDiffRatio);
  }

  const [optimalShstReferencesChain] = candidatePaths.sort(
    (a, b) => pathScores.get(a) - pathScores.get(b),
  );

  return optimalShstReferencesChain;
}
