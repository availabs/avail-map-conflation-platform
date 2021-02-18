// import { strict as assert } from 'assert';
import _ from 'lodash';
import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import reverseTargetMapPathCoordinates from './reverseTargetMapPathCoordinates';

import getOverlaps, { TargetMapPathMatchOverlapSummary } from './getOverlaps';

import {
  forwardOverlapsToChosenShstMatches,
  backwardOverlapsToChosenShstMatches,
} from './overlapsToChosenShstMatches';

import { RawTargetMapFeature, ToposortedShstRefs } from '../../domain/types';

export default function divvy(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
  toposortedShstRefs: ToposortedShstRefs,
) {
  const { targetMapPathEdges } = vicinity;

  const { forwardPaths, backwardPaths } = toposortedShstRefs;

  const reversedTargetMapPathEdges = reverseTargetMapPathCoordinates(
    targetMapPathEdges,
  );

  const forwardOverlaps = forwardPaths
    .filter(_.negate(_.isEmpty))
    .reduce(
      (acc: TargetMapPathMatchOverlapSummary | null, shstRefPath) =>
        acc || getOverlaps(targetMapPathEdges, shstRefPath),
      null,
    );

  const backwardOverlaps = backwardPaths
    .filter(_.negate(_.isEmpty))
    .reduce(
      (acc: TargetMapPathMatchOverlapSummary | null, shstRefPath) =>
        acc || getOverlaps(reversedTargetMapPathEdges, shstRefPath),
      null,
    );

  const forward =
    forwardOverlaps &&
    forwardOverlapsToChosenShstMatches(
      targetMapPathEdges,
      forwardOverlaps.targetMapPathShstReferenceOverlaps,
    );

  const backward =
    backwardOverlaps &&
    backwardOverlapsToChosenShstMatches(
      reversedTargetMapPathEdges,
      backwardOverlaps.targetMapPathShstReferenceOverlaps,
    );

  const chosenShstMatches = {
    forward,
    backward,
  };

  return chosenShstMatches;
}
