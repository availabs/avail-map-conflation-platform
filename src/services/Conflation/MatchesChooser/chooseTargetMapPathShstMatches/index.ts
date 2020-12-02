/* eslint-disable no-continue, no-cond-assign, no-param-reassign, no-constant-condition */

import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';

import findAxiomaticPaths from './findAxiomaticPaths';
import findNonAxiomaticPaths from './findNonAxiomaticPaths';

import {
  minPathLengthThld,
  maxSegPathLengthDiffRatioThld,
  maxGapDistThld,
} from './constants';

export default function chooseTargetMapPathShstMatches({
  targetMapPathMatches,
  subGraphComponentsTraversals,
}): { targetMapPathId: number; chosenPaths: any; metadata: any } | null {
  if (
    !(
      Array.isArray(subGraphComponentsTraversals) &&
      subGraphComponentsTraversals.length
    )
  ) {
    return null;
  }

  assert(targetMapPathMatches.length === subGraphComponentsTraversals.length);

  const distinctTargetMapPathIds: number[] = _.uniq(
    targetMapPathMatches.map(
      ({ targetMapPathEdge }) => targetMapPathEdge.properties.targetMapPathId,
    ),
  );

  assert(distinctTargetMapPathIds.length === 1);

  const [targetMapPathId] = distinctTargetMapPathIds;

  assert(Number.isSafeInteger(targetMapPathId));

  const aggregatedSummary: any[] = [];

  for (
    let targetMapPathIdx = 0;
    targetMapPathIdx < targetMapPathMatches.length;
    ++targetMapPathIdx
  ) {
    const { targetMapPathEdge, shstMatches } = targetMapPathMatches[
      targetMapPathIdx
    ];

    assert(targetMapPathIdx === targetMapPathEdge.properties.targetMapPathIdx);

    const targetMapEdgeLength = turf.length(targetMapPathEdge);

    const traversalsInfo = subGraphComponentsTraversals[targetMapPathIdx];

    if (traversalsInfo === null) {
      aggregatedSummary.push(null);
      continue;
    }

    const { pathLineStrings } = traversalsInfo;

    const numPaths = Array.isArray(pathLineStrings)
      ? pathLineStrings.length
      : null;

    const pathLengths: any[] | null = numPaths ? [] : null;

    if (pathLengths) {
      // @ts-ignore
      for (let i = 0; i < numPaths; ++i) {
        const path = pathLineStrings[i];
        const pathLength = turf.length(path);
        pathLengths.push(pathLength);
      }
    }

    const segPathLengthRatios =
      pathLengths &&
      pathLengths.map(
        (pathLength) =>
          Math.abs(targetMapEdgeLength - pathLength) / targetMapEdgeLength,
      );

    aggregatedSummary.push({
      targetMapPathEdge,
      targetMapEdgeLength,
      shstMatches,
      pathLineStrings,
      pathLengths,
      segPathLengthRatios,
      targetMapPathId,
      targetMapPathIdx,
      numPaths,
    });
  }

  // We really want to do this in a loop, where we
  //   * first find axiomaticPaths using tight lenDiffRatio constraints.
  //   * then we try to limit adjacent segments' paths using tight sequentiality constraints.
  //   * then we repeat
  //     * When we don't make progress, we loosen the constraints.
  //     * When we reach the minimum acceptable thresholds for our constraints,
  //       we rank and choose.
  //
  // Find any cases where the TargetMap Edge has a single ShstMatches path
  //   and that path spans the entire TargetMap Edge.
  // These are the highest confidence starting points for deduction.

  // Array of arrays
  //   Each TargetMap Edge gets an entry
  //     The entry is the topologically ordered chosen paths of ShstMatches for that segment
  // Axiomatic paths minumum length in kilometers.
  const initialPathLengthThld = 0.1; // 100 meters
  let pathLengthThld = initialPathLengthThld;

  // Axiomatic paths must not differ in length from GTFS shape segs
  //   by greater than the following ratio.
  const initialSegPathLengthDiffRatioThld = 0.005; // 0.5%
  let segPathLengthDiffRatioThld = initialSegPathLengthDiffRatioThld;

  // Axiomatic paths must not have a gap between them and
  //   chosen adjacent GTFS shape seg paths greater than gapDistThld.
  const initialGapDistThld = 0.0005; // 0.5 meters
  let gapDistThld = initialGapDistThld;

  const thldScaler = Math.SQRT2;

  // Initialize the chosenPaths array.
  //   Length = number of TargetMap Edges.
  //   All values initialized to NULL, signifying no choice made.
  const chosenPaths: any[] = _.range(0, targetMapPathMatches.length).map(
    () => null,
  );

  // TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
  // Record which method was used to chose the paths.
  while (true) {
    // If every segment of the shape has paths chosen, we're done.
    if (chosenPaths.every((p) => p !== null)) {
      break;
    }

    const axioPaths = findAxiomaticPaths({
      chosenPaths,
      aggregatedSummary,
      pathLengthThld,
      segPathLengthDiffRatioThld,
      gapDistThld,
    });

    if (axioPaths !== null) {
      // === Update the chosen paths ===

      // Empty the array
      chosenPaths.length = 0;
      // Fill it with the new axioPaths.
      chosenPaths.push(...axioPaths);

      // While loop will continue with the same thresholds
      //   so that findAxiomaticPaths can leverage the new
      //   chosen paths to potentially choose others.
      //
    } else {
      // No axioPaths were chosen. We loosen the decision thresholds.

      // If the thresholds were already at the loosest acceptable values, we're done.
      if (
        pathLengthThld === minPathLengthThld &&
        segPathLengthDiffRatioThld === maxSegPathLengthDiffRatioThld &&
        gapDistThld === maxGapDistThld
      ) {
        // TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
        //  FILTER Non-Axiomatic Choices
        //    For internal segments, if adjacent segments have chosenPaths
        //    For start and end segments, snapping GTFS shape start and end points.
        break;
      }

      pathLengthThld = Math.max(pathLengthThld / thldScaler, minPathLengthThld);

      segPathLengthDiffRatioThld = Math.min(
        segPathLengthDiffRatioThld * thldScaler,
        maxSegPathLengthDiffRatioThld,
      );

      // Loosen the gap distance threshold.
      gapDistThld = Math.min(gapDistThld * thldScaler, maxGapDistThld);
    }
  }

  if (chosenPaths.some((p) => p === null)) {
    const nonAxioPaths = findNonAxiomaticPaths({
      chosenPaths,
      aggregatedSummary,
    });

    if (nonAxioPaths !== null) {
      // Empty the array
      chosenPaths.length = 0;
      // Fill it with the new axioPaths.
      chosenPaths.push(...nonAxioPaths);
    }
  }

  const metadata = {
    pathLength: _.sumBy(targetMapPathMatches, ({ targetMapPathEdge }) =>
      turf.length(targetMapPathEdge),
    ),
    chosenMatchesTotalLength: chosenPaths.reduce(
      (acc, p) => acc + (p ? _.sumBy(p, turf.length) : 0),
      0,
    ),
    numEdges: targetMapPathMatches.length,
    numEdgesWithChosenMatches: chosenPaths.reduce((sum, p) => sum + !!p, 0),
    edgeMatchesLengthRatios: targetMapPathMatches.map(
      ({ targetMapPathEdge }, i) => {
        const edgeLen = turf.length(targetMapPathEdge);
        const shstLen = chosenPaths[i]
          ? chosenPaths[i]?.reduce(
              (sum, path) => (path ? sum + turf.length(path) : sum),
              0,
            )
          : 0;

        return shstLen / edgeLen;
      },
    ),
  };

  return { targetMapPathId, chosenPaths, metadata };
}
