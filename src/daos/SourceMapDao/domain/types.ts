import * as turf from '@turf/turf';

export interface SharedStreetsLocationReference {
  sequence: number;
  point: [number, number];
  bearing: number;
  distanceToNextRef: number;
  intersectionId: string;
}

export type SharedStreetsReferenceId = string;

export interface SharedStreetsReferenceFeature
  extends turf.Feature<turf.LineString> {
  id: string;
  properties: {
    shstReferenceId: SharedStreetsReferenceId;
    geometryId: string;
    formOfWay: string;
    fromIntersectionId: string;
    toIntersectionId: string;
    locationReferences: SharedStreetsLocationReference[];
  };
}

export interface SharedStreetsMatchFeature
  extends turf.Feature<turf.LineString> {
  properties: {
    shstReferenceId: string;
    shstGeometryId: string;
    shstFromIntersectionId: string;
    shstToIntersectionId: string;
    referenceLength: number;
    section: [number, number];
    gisReferenceId: string;
    gisGeometryId: string;
    gisTotalSegments: number;
    gisSegmentIndex: number;
    gisFromIntersectionId: string;
    gisToIntersectionId: string;
    startSideOfStreet: 'right' | 'left';
    endSideOfStreet: 'right' | 'left';
    sideOfStreet: 'right' | 'left' | 'unknown';
    score: number;
    matchType: string;
    pp_targetmapid: string | number;
    pp_id: number;
    pp_osrm_assisted: boolean;
    pp_match_index: number;
  };
}
