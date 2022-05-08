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
