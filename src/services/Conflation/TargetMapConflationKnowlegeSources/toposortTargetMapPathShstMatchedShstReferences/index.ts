import _ from 'lodash';

import TargetMapPathVicinity from '../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import ShstReferencesSubNet from '../../utils/ShstReferencesSubNet';

import createEdgeWeightFunction from './createEdgeWeightFunction';

import selectOptimalShstReferencesChainForTargetMapPath from './selectOptimalShstReferencesChainForTargetMapPath';

import { RawTargetMapFeature, ToposortedShstRefs } from '../../domain/types';

import getBiDirectionalFromToIntersectionPairs from './getBiDirectionalFromToIntersectionPairs';

export default function searchAndSort(
  vicinity: TargetMapPathVicinity<RawTargetMapFeature>,
): ToposortedShstRefs {
  const { vicinitySharedStreetsReferences } = vicinity;

  const vicinitySubnet = new ShstReferencesSubNet(
    vicinitySharedStreetsReferences,
  );

  const {
    forwardFromToIntxns,
    backwardFromToIntxns,
  } = getBiDirectionalFromToIntersectionPairs(vicinity);

  const edgeWeightFn = createEdgeWeightFunction(vicinity);

  const allForwardPaths = _(forwardFromToIntxns)
    .map(
      ([startIntxn, endIntxn]) =>
        vicinitySubnet.getShortestShstReferenceChain(
          startIntxn,
          endIntxn,
          edgeWeightFn,
        ) || [],
    )
    .filter(_.negate(_.isEmpty))
    .uniqWith(_.isEqual)
    .value();

  const allBackwardPaths = _(backwardFromToIntxns)
    .map(
      ([startIntxn, endIntxn]) =>
        vicinitySubnet.getShortestShstReferenceChain(
          startIntxn,
          endIntxn,
          edgeWeightFn,
        ) || [],
    )
    .filter(_.negate(_.isEmpty))
    .uniqWith(_.isEqual)
    .value();

  const optimalForwardPaths = [
    selectOptimalShstReferencesChainForTargetMapPath(
      vicinity,
      allForwardPaths,
      true,
    ),
  ];

  const optimalBackwardPaths = vicinity.targetMapIsCenterline
    ? [
        selectOptimalShstReferencesChainForTargetMapPath(
          vicinity,
          allBackwardPaths,
          false,
        ),
      ]
    : [];

  return {
    forwardPaths: optimalForwardPaths,
    backwardPaths: optimalBackwardPaths,
  };
}
