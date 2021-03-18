import * as turf from '@turf/turf';
import _ from 'lodash';

import { SharedStreetsReferenceFeature } from '../../SourceMapDao/domain/types';

import {
  ShstReferenceTargetMapsAssignments,
  ProtoConflationMapSegment,
} from '../domain/types';

export default function partitionShstReference(
  shstReference: SharedStreetsReferenceFeature,
  assignments: ShstReferenceTargetMapsAssignments,
): ProtoConflationMapSegment[] {
  // When doing a geographic subset of the SourceMap, some ShstRefences may be outside
  //   the geographic boundary yet in the results for the TargetMap conflations.
  // This breaks the invariant of every ShstRefence having complete OSM coverage.
  if (!assignments.osm) {
    console.warn(
      'ShstRefence',
      shstReference.id,
      'omitted because no OSM assignments.',
    );
    return [];
  }

  const {
    id: shstReferenceId,
    properties: { shstReferenceLength, minOsmRoadClass: roadClass },
  } = shstReference;

  const partitionDists = _(assignments)
    // @ts-ignore
    .map((d) => d.map((asgmt) => [asgmt.sectionStart, asgmt.sectionEnd]))
    .flattenDeep()
    .concat([0, shstReferenceLength])
    .sort((a, b) => +a - +b)
    .sortedUniq()
    .filter(
      (dist, idx, col) =>
        (idx === 0 || dist - col[idx - 1] > 0.0001) &&
        dist <= shstReferenceLength,
    )
    .value();

  // If we filtered out the shstReferenceLength because it was preceeded
  // by a value within the filter threshold.
  if (_.last(partitionDists) !== shstReferenceLength) {
    partitionDists[partitionDists.length - 1] = shstReferenceLength;
  }

  const shstRefPartitions = _.tail(partitionDists).map(
    (partitionStopDist, i) => {
      const partitionStartDist = partitionDists[i];

      const shstRefPartition = turf.lineSliceAlong(
        shstReference,
        partitionStartDist,
        partitionStopDist,
      );

      shstRefPartition.properties = {
        shst: shstReferenceId,
        shstReferenceLength,
        roadClass,
        partitionStartDist,
        partitionStopDist,
      };

      return shstRefPartition;
    },
  );

  Object.keys(assignments).forEach((targetMap) => {
    const asgmts = assignments[targetMap];

    const curShstRefPartition = 0;

    for (let i = 0; i < asgmts.length; ++i) {
      const asgmt = asgmts[i];

      const { sectionStart, sectionEnd } = asgmt;

      for (let j = curShstRefPartition; j < shstRefPartitions.length; ++j) {
        const shstRefPartition = shstRefPartitions[j];
        const {
          // @ts-ignore
          properties: { partitionStartDist, partitionStopDist },
        } = shstRefPartition;

        if (
          sectionStart < partitionStopDist &&
          sectionEnd > partitionStartDist
        ) {
          // @ts-ignore
          shstRefPartition.properties[targetMap] = asgmt;
        } else if (sectionEnd < partitionStopDist) {
          break;
        }
      }
    }
  });

  shstRefPartitions.sort(
    // @ts-ignore
    (a, b) => a.properties.partitionStartDist - b.properties.partitionStartDist,
  );

  // @ts-ignore
  return shstRefPartitions;
}
