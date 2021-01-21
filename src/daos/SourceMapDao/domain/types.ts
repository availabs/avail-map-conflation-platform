// https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts

import * as turf from '@turf/turf';

import {
  FormOfWay as SharedStreetsFormOfWay,
  RoadClass as SharedStreetsRoadClass,
  SharedStreetsIntersection,
} from 'sharedstreets-types';

export { SharedStreetsFormOfWay };
export { SharedStreetsRoadClass };

export type SharedStreetsIntersectionId = SharedStreetsIntersection['id'];

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
    isForward: boolean;
    osmMetadataWaySections: OsmMetadataWaySection[];
    osmHighwayTypes: OsmHighwayType[];
  };
}

export type SharedStreetsGeometryId = SharedStreetsReferenceFeature['properties']['geometryId'];
