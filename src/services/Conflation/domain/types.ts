import * as turf from '@turf/turf';
import * as SharedStreetsTypes from 'sharedstreets-types';

import * as TargetMapDaoTypes from '../../../utils/TargetMapDatabases/TargetMapDAO';

import * as ShstSourceMapTypes from '../../../daos/SourceMapDao/domain/types';

export type RawTargetMapFeature = TargetMapDaoTypes.RawTargetMapFeature;
export type TargetMapSchema = TargetMapDaoTypes.TargetMapSchema;
export type TargetMapId = TargetMapDaoTypes.TargetMapId;
export type TargetMapEdge = TargetMapDaoTypes.TargetMapEdge;
export type TargetMapEdgeId = TargetMapDaoTypes.TargetMapEdgeId;
export type TargetMapEdgeFeature = TargetMapDaoTypes.TargetMapEdgeFeature;
export type TargetMapPathEdgeFeature = TargetMapDaoTypes.TargetMapPathEdgeFeature;
export type TargetMapPathEdgeFeatures = TargetMapDaoTypes.TargetMapPathEdgeFeatures;
export type TargetMapPathId = TargetMapDaoTypes.TargetMapPathId;
export type TargetMapPathEdgeIdx = TargetMapDaoTypes.TargetMapPathEdgeIdx;
export type TargetMapEdgesGeoproximityIterator = TargetMapDaoTypes.TargetMapEdgesGeoproximityIterator;
export type QueryPolygon = TargetMapDaoTypes.QueryPolygon;

export * from '../../../daos/SourceMapDao/domain/types';

export type SharedStreetsReferenceId = ShstSourceMapTypes.SharedStreetsReferenceId;
export type SharedStreetsReferenceFeature = ShstSourceMapTypes.SharedStreetsReferenceFeature;
export type SharedStreetsReferenceChain = SharedStreetsReferenceFeature[];

export type ShstReferenceRoadClass = SharedStreetsTypes.RoadClass;
export type ShstReferenceFormOfWay = SharedStreetsTypes.FormOfWay;

export interface SharedStreetsMatchResult
  extends turf.Feature<turf.LineString> {
  id: number;
  properties: Record<string, any> & {
    readonly shstReferenceId: string;
    readonly shstGeometryId: string;
    readonly shstFromIntersectionId: string;
    readonly shstToIntersectionId: string;
    readonly referenceLength: number;
    readonly section: [number, number];
    readonly gisReferenceId: string;
    readonly gisGeometryId: string;
    readonly gisTotalSegments: number;
    readonly gisSegmentIndex: number;
    readonly gisFromIntersectionId: string;
    readonly gisToIntersectionId: string;
    readonly startSideOfStreet: 'right' | 'left';
    readonly endSideOfStreet: 'right' | 'left';
    readonly sideOfStreet: 'right' | 'left' | 'unknown';
    readonly score: number;
    readonly matchType: 'string';
  };
  geometry: turf.LineString;
}

// NOTE: This is a dupe of src/daos/SourceMapDao/domain/types.SharedStreetsMatchFeature
export interface SharedStreetsMatchFeature extends SharedStreetsMatchResult {
  id: number;
}

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

export type TargetMapPathMatchesIterator = Generator<TargetMapPathMatchesRecord>;

export type TargetMapPathChosenMatches = {
  targetMapPathId: TargetMapPathId;
  chosenMatches: TargetMapPathEdgeChosenMatches[] | null;
  chosenMatchesMetadata: TargetMapPathChosenMatchesMetadata | null;
};

export type ToposortedShstRefs = {
  forwardPaths: SharedStreetsReferenceFeature[][];
  backwardPaths: SharedStreetsReferenceFeature[][];
};

export type ChosenMatchMetadata = {
  targetMapId: TargetMapId;
  targetMapPathId: TargetMapPathId;
  targetMapPathEdgeIdx: TargetMapPathEdgeIdx;
  targetMapEdgeId: TargetMapEdgeId;
  isForward: boolean;
  targetMapEdgeShstMatchIdx: number;
  shstReferenceId: SharedStreetsReferenceId;
  sectionStart: number;
  sectionEnd: number;
  alongEdgeStart: number;
  alongEdgeEnd: number;
  avgDevianceKm: number | null;
};

export type ChosenMatchFeature = SharedStreetsReferenceFeature & {
  properties: { chosenMatchMetadata: ChosenMatchMetadata };
};

export type TargetMapPathsSegments = TargetMapPathEdgeFeature[][];

export type TargetMapEdgesShstMatchReferenceIds = Record<
  TargetMapEdgeId,
  Set<SharedStreetsReferenceId>
>;

export type TargetMapEdgesChosenMatchesMetadata = Record<
  TargetMapEdgeId,
  SharedStreetsMatchMetadata[]
>;

export type ReversedTargetMapPathEdgeFeature = TargetMapEdgeFeature & {
  properties: { reversed: true };
};

export type ReversedTargetMapPathEdgeFeatures = ReversedTargetMapPathEdgeFeature[];

export type AssignedMatch = {
  shstReferenceId: SharedStreetsReferenceId;
  targetMapEdgeId: TargetMapEdgeId;
  isForward: boolean;
  sectionStart: number | null;
  sectionEnd: number | null;
};

export type TargetMapAssignedMatch = {
  shstReferenceId: SharedStreetsReferenceId;
  targetMapId: TargetMapId;
  isForward: boolean;
  sectionStart: number;
  sectionEnd: number;
};
