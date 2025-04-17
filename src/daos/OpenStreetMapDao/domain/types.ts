import * as turf from '@turf/turf';

export type OsmVersion = string;

export type OsmNodeId = number;

export type OsmNode = {
  id: OsmNodeId;
  coord: [number, number];
  tags: Record<string, any> | null;
};

export type OsmWayId = number;

export type OsmWay = {
  id: OsmWayId;
  nodeIds: OsmNodeId[];
  tags: Record<string, any> | null;
};

// https://github.com/sharedstreets/sharedstreets-types/blob/3c1d5822ff4943ae063f920e018dd3e349213c8c/index.ts

export type RoadClass =
  | 'Motorway'
  | 'Trunk'
  | 'Primary'
  | 'Secondary'
  | 'Tertiary'
  | 'Residential'
  | 'Unclassified'
  | 'Service'
  | 'Other';

export enum RoadClassCode {
  Motorway = 0,
  Trunk = 1,
  Primary = 2,
  Secondary = 3,
  Tertiary = 4,
  Residential = 5,
  Unclassified = 6,
  Service = 7,
  Other = 8,
}

/** FormOfWay enum. */
export enum FormOfWay {
  Undefined = 0,
  Motorway = 1,
  MultipleCarriageway = 2,
  SingleCarriageway = 3,
  Roundabout = 4,
  /**
   * yikes: https://giphy.com/gifs/square-addis-meskel-GYb9s3Afw0cWA
   */
  TrafficSquare = 5,
  SlipRoad = 6,
  Other = 7,
}

export type OsmWayMetadata = {
  osmWayId: OsmWayId;
  osmNodeIds: OsmNodeId[];

  roadClass: RoadClass;
  networkLevel: RoadClassCode;
  formOfWay: FormOfWay;
  forward: boolean;
  backward: boolean;
  oneWay: boolean;
  roundabout: boolean;
  link: boolean;
  roadName: string | null;
  roadAltName: string | null;
  roadNumber: string | null;

  routesNames: string[] | null;
  routesNumbers: string[] | null;
  kilometers: number;
  osmNodesKmAlong: number[];
};

export type OsmWayFeature = turf.Feature<turf.LineString> & {
  id: OsmWayId;
  properties: OsmWayMetadata;
};

export type OsmWayDirectedSegmentMetadata = OsmWayMetadata & {
  isFwd: boolean;
  sectionStart: number;
  sectionEnd: number;
};

export type OsmWayDirectedSegmentFeature = turf.Feature<turf.LineString> & {
  properties: OsmWayDirectedSegmentMetadata;
};

export type OsmRelationId = number;

export type OsmRelation = {
  id: OsmRelationId;
  tags: Record<string, any> | null;
  members: any[];
};

export type OsmRouteRelationWayMember = {
  ref: OsmWayId;
  role?: string;
  type: 'way';
};

export type OsmRouteRelation = {
  id: OsmRelationId;
  tags: Record<string, any> | null;
  members: OsmRouteRelationWayMember[];
};
