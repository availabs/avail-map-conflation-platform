/* eslint-disable no-restricted-syntax */

// NOTE: ShstReference are formed from either splitting or merging OSM Ways.
// https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/transforms/BaseSegments.java

import { strict as assert } from 'assert';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { longestCommonSubstring } from '../../../utils/stringAlgorithms';

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
  OsmNodeId,
  OsmWayId,
} from '../../SourceMapDao/domain/types';

const getShstReferenceOsmNodeIds = (shstRef: SharedStreetsReferenceFeature) => {
  const {
    properties: { osmMetadataWaySections },
  } = shstRef;

  const coords = turf.getCoords(shstRef);

  // OsmNodeIds, possibly across multiple OsmWays
  const shstRefOsmNodeIds = _(osmMetadataWaySections)
    .map('nodeIds')
    .flattenDeep()
    .filter((nodeId, i, arr) => nodeId !== arr[i - 1])
    .value();

  assert(coords.length === shstRefOsmNodeIds.length);

  return shstRefOsmNodeIds;
};

export type OsmWayChosenShstReferenceSegment = {
  shstReferenceId: SharedStreetsReferenceId;
  osmNodesStartIdx: number;
  osmNodesEndIdx: number;
  sectionStart: number;
  sectionEnd: number;
};

export type ChosenShstReferenceSegmentsForOsmWay = {
  osmWayId: OsmWayId;
  chosenForward: OsmWayChosenShstReferenceSegment[];
  chosenBackward: OsmWayChosenShstReferenceSegment[];
};

export default function getChosenShstReferenceSegmentsForOsmWay({
  osmWayId,
  osmNodeIds,
  shstReferences,
}: {
  osmWayId: OsmWayId;
  osmNodeIds: OsmNodeId[];
  shstReferences: SharedStreetsReferenceFeature[];
}) {
  const reversedOsmNodeIds = osmNodeIds.slice().reverse();

  const shstRefsToOsmNodesByDirection: ChosenShstReferenceSegmentsForOsmWay = shstReferences.reduce(
    (
      acc: ChosenShstReferenceSegmentsForOsmWay,
      shstRef: SharedStreetsReferenceFeature,
    ) => {
      const {
        properties: { shstReferenceId, isForward },
      } = shstRef;

      const shstRefOsmNodeIds = getShstReferenceOsmNodeIds(shstRef);

      // Since a OsmWays to ShstReferences is Many-2-Many,
      //   cannot rely on shstReferences.properties.isForward.
      const forwardLCS = longestCommonSubstring(osmNodeIds, shstRefOsmNodeIds);
      const backwardLCS = longestCommonSubstring(
        reversedOsmNodeIds,
        shstRefOsmNodeIds,
      );

      if (forwardLCS === null || backwardLCS === null) {
        console.error('INVARIANT BROKEN: No common OSM Nodes?');
        return acc;
      }

      const forwardOsm =
        forwardLCS.len === backwardLCS.len
          ? isForward
          : forwardLCS.len > backwardLCS.len;

      const lcs = forwardOsm ? forwardLCS : backwardLCS;

      const { b: shstRefNodesOverlappingWay } = lcs;

      const shstRefCoords = turf.getCoords(shstRef);

      const shstRefCoordsLen = shstRefCoords.length;

      const shstRefLen = turf.length(shstRef);

      const osmWayIncludesShstRefStart = shstRefNodesOverlappingWay[0] === 0;

      const osmWayIncludesShstRefEnd =
        shstRefNodesOverlappingWay[shstRefNodesOverlappingWay.length - 1] ===
        shstRefCoordsLen;

      const osmWayCoversShstRef =
        osmWayIncludesShstRefStart && osmWayIncludesShstRefEnd;

      const osmStartOffset = osmWayIncludesShstRefStart
        ? 0
        : turf.length(
            turf.lineString(
              shstRefCoords.slice(0, shstRefNodesOverlappingWay[0] + 1),
            ),
          );

      const osmOverlapLen = osmWayCoversShstRef
        ? shstRefLen
        : turf.length(
            turf.lineString(shstRefCoords.slice(...shstRefNodesOverlappingWay)),
          );

      if (osmOverlapLen > 0) {
        const dir = forwardOsm ? 'chosenForward' : 'chosenBackward';

        acc[dir].push({
          shstReferenceId,
          osmNodesStartIdx: lcs.a[0],
          osmNodesEndIdx: lcs.a[1] - 1,
          sectionStart: osmStartOffset,
          sectionEnd: osmStartOffset + osmOverlapLen,
        });
      }

      return acc;
    },
    { osmWayId, chosenForward: [], chosenBackward: [] },
  );

  shstRefsToOsmNodesByDirection.chosenForward.sort(
    (a, b) => a.osmNodesStartIdx - b.osmNodesStartIdx,
  );

  shstRefsToOsmNodesByDirection.chosenBackward.sort(
    (a, b) => a.osmNodesStartIdx - b.osmNodesStartIdx,
  );

  return shstRefsToOsmNodesByDirection;
}
