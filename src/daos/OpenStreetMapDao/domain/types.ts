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
