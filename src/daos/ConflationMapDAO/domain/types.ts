import * as turf from '@turf/turf';

import {
  SharedStreetsReferenceId,
  SharedStreetsReferenceLength,
  SharedStreetsRoadClass,
} from '../../SourceMapDao/domain/types';

import { TargetMapAssignedMatch } from '../../../services/Conflation/domain/types';

export enum TargetMap {
  OSM = 'osm',
  NYS_RIS = 'nys_ris',
  NPMRDS = 'npmrds',
}

export type ShstReferenceTargetMapEdgesAssignment = Pick<
  TargetMapAssignedMatch,
  'targetMapId' | 'isForward' | 'sectionStart' | 'sectionEnd'
>;

export type ShstReferenceTargetMapsAssignments = {
  [TargetMap.OSM]: ShstReferenceTargetMapEdgesAssignment[];

  [TargetMap.NYS_RIS]?: ShstReferenceTargetMapEdgesAssignment[];

  [TargetMap.NPMRDS]?: ShstReferenceTargetMapEdgesAssignment[];
};

export type ConflationMapSegment = turf.Feature<turf.LineString> & {
  id: number;
  properties: {
    shst: SharedStreetsReferenceId;
    shstReferenceLength: SharedStreetsReferenceLength;
    roadClass: SharedStreetsRoadClass;
    partitionStartDist: number;
    partitionStopDist: number;

    [TargetMap.OSM]: ShstReferenceTargetMapEdgesAssignment;

    [TargetMap.NYS_RIS]?: ShstReferenceTargetMapEdgesAssignment;

    [TargetMap.NPMRDS]?: ShstReferenceTargetMapEdgesAssignment;
  };
};

export type ProtoConflationMapSegment = Omit<ConflationMapSegment, 'id'>;
