import {
  TargetMapPathId,
  TargetMapEdge,
  TargetMapEdgesGeoproximityIterator as TargetMapDAOTargetMapEdgesGeoproximityIterator,
} from '../../../../utils/TargetMapDatabases/TargetMapDAO';

import * as SharedStreetsMatcherDomain from '../../SharedStreetsMatcher/domain/types';

export type SharedStreetsMatchResult = SharedStreetsMatcherDomain.SharedStreetsMatchResult;

// NOTE: This is a dupe of src/daos/SourceMapDao/domain/types.SharedStreetsMatchFeature
export interface SharedStreetsMatchFeature extends SharedStreetsMatchResult {
  id: number;
}

export type TargetMapEdgesGeoproximityIterator = TargetMapDAOTargetMapEdgesGeoproximityIterator;

export type SharedStreetsMatchMetadata = {
  shst_match_id: number;
  shst_reference: string;
  shst_ref_start: number;
  shst_ref_end: number;
};

export type TargetMapEdgeShstMatches = {
  targetMapEdge: TargetMapEdge;
  shstMatches: SharedStreetsMatchFeature[] | null;
};

export type TargetMapPathMatches = TargetMapEdgeShstMatches[];

export interface TargetMapPathChosenMatchesMetadata {
  pathLength: number;
  chosenMatchesTotalLength: number;
  numEdges: number;
  numEdgesWithChosenMatches: number;
  edgeMatchesLengthRatios: number[];
}

export type TargetMapPathEdgeChosenMatches =
  | (SharedStreetsMatchFeature['id'] | null)[][]
  | null;

export type TargetMapPathMatchesRecord = {
  targetMapPathId: TargetMapPathId;
  targetMapPathMatches: TargetMapEdgeShstMatches[] | null;
};

export type TargetMapPathMatchesIterator = Generator<
  TargetMapPathMatchesRecord
>;

export type TargetMapPathChosenMatches = {
  targetMapPathId: TargetMapPathId;
  chosenShstMatches: TargetMapPathEdgeChosenMatches[] | null;
  chosenShstMatchesMetadata: TargetMapPathChosenMatchesMetadata | null;
};
