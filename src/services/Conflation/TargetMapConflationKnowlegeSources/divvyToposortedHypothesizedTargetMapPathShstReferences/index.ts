// import { strict as assert } from 'assert';
import _ from 'lodash';
import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import reverseTargetMapPathCoordinates from './reverseTargetMapPathCoordinates';

import getOverlaps, { TargetMapPathMatchOverlapSummary } from './getOverlaps';

import {
  forwardOverlapsToChosenMatches,
  backwardOverlapsToChosenMatches,
} from './overlapsToChosenMatches';

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
    forwardOverlapsToChosenMatches(
      targetMapPathEdges,
      forwardOverlaps.targetMapPathShstReferenceOverlaps,
    );

  const backward =
    backwardOverlaps &&
    backwardOverlapsToChosenMatches(
      reversedTargetMapPathEdges,
      backwardOverlaps.targetMapPathShstReferenceOverlaps,
    );

  const chosenMatches = {
    forward,
    backward,
  };

  return chosenMatches;
}
