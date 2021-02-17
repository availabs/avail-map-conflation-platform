import _ from 'lodash';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import {
  RawTargetMapFeature,
  SharedStreetsGeometryId,
  SharedStreetsReferenceFeature,
} from '../../domain/types';

// While routing over the candidate ShstReferences for a TMPath,
//   we prefer ShstReferences suggested by ShstMatch.
//   Additionally, we include the opposite direction pair for any
//   bi-directional road segment in the preferredShstRefs set.
export default function getPreferredShstReferences(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
): Set<SharedStreetsReferenceFeature> {
  const {
    targetMapPathEdgeShstMatchedShstReferences,
    vicinitySharedStreetsReferences,
  } = vicinity;

  const matchedShstGeomIds: Set<SharedStreetsGeometryId> = new Set(
    _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences).map(
      ({ properties: { geometryId } }) => geometryId,
    ),
  );

  const preferredShstRefs = new Set(
    _.flattenDeep(targetMapPathEdgeShstMatchedShstReferences),
  );

  vicinitySharedStreetsReferences
    .filter(({ properties: { geometryId } }) =>
      matchedShstGeomIds.has(geometryId),
    )
    .forEach((shstRef) => preferredShstRefs.add(shstRef));

  return preferredShstRefs;
}
