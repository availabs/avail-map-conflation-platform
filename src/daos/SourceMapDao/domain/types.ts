import * as turf from '@turf/turf';

import {
  FormOfWay as SharedStreetsFormOfWay,
  RoadClass as SharedStreetsRoadClass,
} from 'sharedstreets-types';

export { SharedStreetsFormOfWay };
export { SharedStreetsRoadClass };

export interface SharedStreetsLocationReference {
  sequence: number;
  point: [number, number];
  bearing: number;
  distanceToNextRef: number;
  intersectionId: string;
}

export type SharedStreetsReferenceId = string;

export interface OsmMetadataWaySection {
  way_id: number;
  osm_way_tags: Record<string, any>;
  road_class: string;
  one_way: 0 | 1;
  roundabout: 0 | 1;
  link: 0 | 1;
  name: string;
}

export type OsmHighwayType = string;

export interface SharedStreetsReferenceFeature
  extends turf.Feature<turf.LineString> {
  id: string;
  properties: {
    shstReferenceId: SharedStreetsReferenceId;
    geometryId: string;
    formOfWay: SharedStreetsFormOfWay;
    roadClass: SharedStreetsRoadClass;
    fromIntersectionId: string;
    toIntersectionId: string;
    locationReferences: SharedStreetsLocationReference[];
    osmMetadataWaySections: OsmMetadataWaySection[];
    osmHighwayTypes: OsmHighwayType[];
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
