/* eslint-disable no-restricted-syntax, @typescript-eslint/no-loop-func */

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceFeature,
  SharedStreetsIntersectionId,
} from '../../../../../daos/SourceMapDao/domain/types';

export type SharedStreetsIntersectionIdChain = SharedStreetsIntersectionId[];

export type DirectionalShstIntersectionIdChains = {
  forward: SharedStreetsIntersectionIdChain[];
  backward: SharedStreetsIntersectionIdChain[];
  unknown: SharedStreetsIntersectionIdChain[];
};

export interface KnaveShstRefSummaryEntry {
  shstRefId: SharedStreetsReferenceId;
  fromIntersectionId: SharedStreetsIntersectionId;
  toIntersectionId: SharedStreetsIntersectionId;
}

export type SharedStreetsReferenceIdChain = SharedStreetsReferenceId[];

export type SharedStreetsReferenceChain = SharedStreetsReferenceFeature[];

export type DirectionalShstReferenceChains = {
  forward: SharedStreetsReferenceChain[];
  backward: SharedStreetsReferenceChain[];
  unknown: SharedStreetsReferenceChain[];
};

export type DirectionalShstReferenceIdChains = {
  forward: SharedStreetsReferenceIdChain[];
  backward: SharedStreetsReferenceIdChain[];
  unknown: SharedStreetsReferenceIdChain[];
};
