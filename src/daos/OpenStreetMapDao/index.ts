/* eslint-disable no-restricted-syntax, class-methods-use-this */

// import { readFileSync } from 'fs';
// import { join } from 'path';

// import _ from 'lodash';
import * as turf from '@turf/turf';

import { Database, Statement } from 'better-sqlite3';

import db from '../../services/DbService';

import { OSM } from '../../constants/databaseSchemaNames';

import validateOsmVersion from './utils/validateOsmVersion';

import {
  OsmVersion,
  RoadClass,
  RoadClassCode,
  FormOfWay,
  OsmWayMetadata,
  OsmNodeId,
  OsmWayId,
  // OsmWayFeature,
  // OsmNode,
  // OsmWay,
  // OsmRelation,
  // OsmRouteRelation,
} from './domain/types';

import getExpectedOsmVersionPbfPath from './utils/getExpectedOsmVersionPbfPath';

type OsmWayMetadataTableRow = {
  osm_way_id: number;
  osm_node_ids: string;

  road_class: RoadClass;
  form_of_way: FormOfWay;
  forward: 0 | 1;
  backward: 0 | 1;
  one_way: 0 | 1;
  roundabout: 0 | 1;
  link: 0 | 1;
  road_name: string | null;
  road_alt_name: string | null;
  road_number: string | null;

  routes_names: string | null;
  routes_numbers: string | null;

  kilometers: number;
  osm_nodes_km_along: string;
};

function osmRoadwaysMetadataTableRowToObject(
  row: OsmWayMetadataTableRow,
): OsmWayMetadata {
  const {
    osm_way_id,
    osm_node_ids,

    road_class,
    form_of_way,
    forward,
    backward,
    one_way,
    roundabout,
    link,
    road_name,
    road_alt_name,
    road_number,

    routes_names,
    routes_numbers,

    kilometers,
    osm_nodes_km_along,
  } = row;

  try {
    const metadata = {
      osmWayId: osm_way_id,
      osmNodeIds: JSON.parse(osm_node_ids),

      roadClass: road_class,
      networkLevel: RoadClassCode[<RoadClass>road_class],
      formOfWay: form_of_way,

      forward: Boolean(forward),
      backward: Boolean(backward),
      oneWay: Boolean(one_way),
      roundabout: Boolean(roundabout),
      link: Boolean(link),
      roadName: road_name,
      roadAltName: road_alt_name,
      roadNumber: road_number,

      routesNames: routes_names && JSON.parse(routes_names),
      routesNumbers: routes_numbers && JSON.parse(routes_numbers),

      // The following can be undefined before loading complete.
      kilometers,
      osmNodesKmAlong: osm_nodes_km_along
        ? JSON.parse(osm_nodes_km_along)
        : null,
    };

    return metadata;
  } catch (err) {
    console.log(JSON.stringify(row, null, 4));
    throw err;
  }
}

class OpenStreetMapDAO {
  protected connections: {
    // Used for writes
    dbReadConnection: Database | null;
    dbWriteConnection: Database | null;
  };

  protected readonly preparedReadStatements!: {
    getOsmVersionStmt?: Statement;
    getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt?: Statement;
    getOsmRoadwayMetadataByOsmWayIdStmt?: Statement;
    allOsmRoadwayMetadataStmt?: Statement;
    getOsmNodesStmt?: Statement;
  };

  constructor() {
    this.connections = { dbReadConnection: null, dbWriteConnection: null };

    this.preparedReadStatements = {};
  }

  get dbReadConnection(): Database {
    if (!this.connections.dbReadConnection) {
      this.connections.dbReadConnection = db.openConnectionToDb(
        OSM,
        null,
        'osm',
      );
    }

    return this.connections.dbReadConnection;
  }

  protected get getOsmVersionStmt(): Statement {
    this.preparedReadStatements.getOsmVersionStmt =
      this.preparedReadStatements.getOsmVersionStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_version
            FROM osm.osm_version ;
        `,
      );

    return this.preparedReadStatements.getOsmVersionStmt;
  }

  get osmVersion(): OsmVersion {
    const osmVersion = this.getOsmVersionStmt.pluck().get();

    if (!validateOsmVersion(osmVersion)) {
      throw new Error('WARNING: Invalid OSM Version ID.');
    }

    return osmVersion;
  }

  get osmPbfFilePath() {
    return getExpectedOsmVersionPbfPath(this.osmVersion);
  }

  /*
      FIXME:
              [x] Add osm_nodes_km_along to osm_roadways_metadata
              [x] Get OsmRoadWayMetadata[] by NodeIdSeq
              [ ] Get DirectedOsmRoadwayMetadataByNodeIdsSeq
              [ ] Get DirectedOsmRoadwaySegmentMetadataByNodeIdsSeq
                      * Sufficient data for a Match data type
                      * Supports non-spatial algorithms/heuristics/metrics
              [ ] Get DirectedOsmRoadwaySegmentFeatureByNodeIdsSeq
                  * To support spatial algorithms/heuristics/metrics

      CONSIDER: OSRM edge-based-restriction-graph routing would return node-pair-sequences (edges).
  */

  protected get getOsmRoadwayMetadataByOsmWayIdStmt(): Statement {
    this.preparedReadStatements.getOsmRoadwayMetadataByOsmWayIdStmt =
      this.preparedReadStatements.getOsmRoadwayMetadataByOsmWayIdStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_way_id,
              osm_node_ids,

              road_class,
              form_of_way,
              forward,
              backward,
              one_way,
              roundabout,
              link,
              road_name,
              road_alt_name,
              road_number,

              routes_names,
              routes_numbers,

              kilometers,
              osm_nodes_km_along
            FROM osm.osm_roadways_metadata ;
              INNER JOIN (
                SELECT
                    value AS osm_way_id,
                  FROM json_each(?)
              ) AS b USING (osm_way_id)
        `,
      );

    return this.preparedReadStatements.getOsmRoadwayMetadataByOsmWayIdStmt;
  }

  getOsmRoadwayMetadataByOsmWayIds(osmWayIds: OsmWayId[]): OsmWayMetadata[] {
    const rows = this.getOsmRoadwayMetadataByOsmWayIdStmt.all([
      JSON.stringify(osmWayIds),
    ]);
    const metadataById = rows.reduce((acc, row) => {
      const metadata = osmRoadwaysMetadataTableRowToObject(row);
      const { osmWayId } = metadata;

      acc[osmWayId] = metadata;
      return acc;
    }, {});

    return osmWayIds.map((id) => metadataById[id] || null);
  }

  getOsmRoadwayMetadataByOsmWayId(osmWayId: OsmWayId): OsmWayMetadata {
    return this.getOsmRoadwayMetadataByOsmWayIds([osmWayId])[0];
  }

  protected get allOsmRoadwayMetadataStmt(): Statement {
    this.preparedReadStatements.allOsmRoadwayMetadataStmt =
      this.preparedReadStatements.allOsmRoadwayMetadataStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_way_id,
              osm_node_ids,

              road_class,
              form_of_way,
              forward,
              backward,
              one_way,
              roundabout,
              link,
              road_name,
              road_alt_name,
              road_number,

              routes_names,
              routes_numbers,

              kilometers,
              osm_nodes_km_along
            FROM osm.osm_roadways_metadata ;
        `,
      );

    return this.preparedReadStatements.allOsmRoadwayMetadataStmt;
  }

  *makeOsmRoadwayMetadataIterator(): Generator<OsmWayMetadata> {
    const iter = this.allOsmRoadwayMetadataStmt.iterate();

    for (const row of iter) {
      yield osmRoadwaysMetadataTableRowToObject(row);
    }
  }

  protected get getOsmNodesStmt(): Statement {
    this.preparedReadStatements.getOsmNodesStmt =
      this.preparedReadStatements.getOsmNodesStmt ||
      this.dbReadConnection.prepare(
        `
          SELECT
              osm_node_id,
              a.coord,
              a.tags
            FROM osm.osm_nodes AS a
              INNER JOIN (
                SELECT
                    value AS osm_node_id,
                    key AS idx
                  FROM json_each(?)
              ) AS b USING (osm_node_id)
            ORDER BY b.idx
        `,
      );

    return this.preparedReadStatements.getOsmNodesStmt;
  }

  getOsmNodeFeaturesById(osmNodeIds: OsmNodeId[]) {
    const rows = this.getOsmNodesStmt.all([JSON.stringify(osmNodeIds)]);

    const points = rows.map(({ osm_node_id, coord, tags }) =>
      turf.point(
        JSON.parse(coord),
        { osmNodeId: osm_node_id, ...(JSON.parse(tags) || {}) },
        { id: osm_node_id },
      ),
    );

    return points;
  }

  protected get getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt(): Statement {
    this.preparedReadStatements.getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt =
      this.preparedReadStatements
        .getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt ||
      this.dbReadConnection.prepare(
        `
          WITH cte_touched_osm_way_node_ids AS (
            SELECT
                osm_way_id,
                a.osm_node_id,
                a.osm_node_idx,
                b.osm_node_seq_idx
              FROM osm.osm_way_node_ids AS a
                INNER JOIN (
                  SELECT
                      value AS osm_node_id,
                      key AS osm_node_seq_idx
                    FROM json_each(json(?))         -- The NodeSequence as JSON Array
                ) AS b USING (osm_node_id)
          ), cte_osm_way_segment_traversals AS (
            SELECT
                osm_way_id,

                ( a.osm_node_idx < b.osm_node_idx ) AS traversed_forward,

                json_group_array(
                  json_object(
                    'osm_node_idx_pair',  json_array(a.osm_node_idx, b.osm_node_idx),

                    'osm_node_seq_pair',  json_array(a.osm_node_seq_idx, b.osm_node_seq_idx)
                  )
                ) AS osm_nodes_traversal

              FROM cte_touched_osm_way_node_ids AS  a
                INNER JOIN cte_touched_osm_way_node_ids AS b
                  USING (osm_way_id)

              WHERE (
                -- Node from "a" immediately precedes the node from "b" in the NodeSequence
                ( ( a.osm_node_seq_idx - b.osm_node_seq_idx ) = -1 )
                AND
                -- The Nodes are adjacent, but not necessarily ordered, in the OsmWay osmNodeIds array
                ( ABS( a.osm_node_idx - b.osm_node_idx ) = 1 )
              )

              GROUP BY 1,2
          )
            SELECT
                a.osm_way_id,
                a.osm_node_ids,

                a.road_class,
                a.form_of_way,
                a.forward,
                a.backward,
                a.one_way,
                a.roundabout,
                a.link,
                a.road_name,
                a.road_alt_name,
                a.road_number,

                a.routes_names,
                a.routes_numbers,

                a.kilometers,
                a.osm_nodes_km_along,

                b.traversed_forward,
                b.osm_nodes_traversal

              FROM osm.osm_roadways_metadata AS a
                INNER JOIN cte_osm_way_segment_traversals AS b
                  USING (osm_way_id)
              WHERE (
                ( a.forward AND b.traversed_forward )
                OR
                ( a.backward AND (NOT b.traversed_forward) )
              )
        `,
      );

    return this.preparedReadStatements
      .getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt;
  }

  matchOsmNodeSequence(osmNodeSeq: OsmNodeId[]) {
    const rows = this.getOsmRoadwaysMetadataByOsmNodeIdsSequenceStmt.all([
      JSON.stringify(osmNodeSeq),
    ]);

    const matchedOsmWayMetadata = rows.map((row) => ({
      ...osmRoadwaysMetadataTableRowToObject(row),
      traversedForward: Boolean(row.traversed_forward),
      osmNodesTraversal: JSON.parse(row.osm_nodes_traversal),
    }));

    const osmNodeSequenceMatches = matchedOsmWayMetadata
      .reduce(
        (
          acc,
          {
            osmWayId,
            osmNodeIds,
            traversedForward,
            osmNodesTraversal,
            osmNodesKmAlong,
          },
        ) => {
          const directionalNodesKmAlong = traversedForward
            ? osmNodesKmAlong
            : osmNodesKmAlong.slice().reverse();

          const segments: any = [];

          osmNodesTraversal.sort(
            (a: any, b: any) => a.osm_node_seq_pair[0] - b.osm_node_seq_pair[0],
          );

          let prevStep = osmNodesTraversal[0];

          let curSegment = {
            osmWayId,
            traversedForward,
            osmNodeSeqStartIdx: prevStep.osm_node_seq_pair[0],
            osmNodeSeqEndIdx: prevStep.osm_node_seq_pair[1],
            osmNodeIdxs: [...prevStep.osm_node_idx_pair],
            osmNodesKmAlong: prevStep.osm_node_idx_pair.map(
              (nIdx: number) => directionalNodesKmAlong[nIdx],
            ),
          };

          for (const curStep of osmNodesTraversal.slice(1)) {
            const osmWayNodesJump =
              prevStep.osm_node_idx_pair[1] !== curStep.osm_node_idx_pair[0];
            const nodesSeqJump =
              prevStep.osm_node_seq_pair[1] !== curStep.osm_node_seq_pair[0];

            if (osmWayNodesJump || nodesSeqJump) {
              segments.push(curSegment);
              curSegment = {
                osmWayId,
                traversedForward,
                osmNodeSeqStartIdx: curStep.osm_node_seq_pair[0],
                osmNodeSeqEndIdx: curStep.osm_node_seq_pair[1],
                osmNodeIdxs: [curStep.osm_node_idxs[0]],
                osmNodesKmAlong: [
                  directionalNodesKmAlong[curStep.osm_node_idx_pair[0]],
                ],
              };
            }

            [, curSegment.osmNodeSeqEndIdx] = curStep.osm_node_seq_pair;

            curSegment.osmNodeIdxs.push(curStep.osm_node_idx_pair[1]);
            curSegment.osmNodesKmAlong.push(
              directionalNodesKmAlong[curStep.osm_node_idx_pair[1]],
            );
            prevStep = curStep;
          }

          segments.push(curSegment);

          // Assign the sectionStart/End
          for (const segment of segments) {
            [segment.sectionStart] = segment.osmNodesKmAlong;
            segment.sectionEnd =
              segment.osmNodesKmAlong[segment.osmNodesKmAlong.length - 1];
            segment.osmNodeIds = segment.osmNodeIdxs.map(
              (idx) => osmNodeIds[idx],
            );
          }

          acc.push(...segments);

          return acc;
        },
        [],
      )
      .sort(
        (a, b) =>
          a.osmNodeSeqStartIdx - b.osmNodeSeqStartIdx ||
          a.osmNodeSeqEndIdx - b.osmNodeSeqEndIdx,
      );

    return { matchedOsmWayMetadata, osmNodeSequenceMatches };
  }
}

export default new OpenStreetMapDAO();
