/* eslint-disable no-restricted-syntax, no-underscore-dangle */
// @ts-nocheck

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';

import {
  SharedStreetsReferenceFeature,
  // SharedStreetsRoadClass,
} from '../../domain/types';

function getSql(fName: string) {
  console.log('getSql', fName);
  return readFileSync(join(__dirname, './sql/', fName), {
    encoding: 'utf8',
  });
}

// type NodeSequenceInfo = {
// way_section_nodes_idx: number;
// osm_node_id: number;
// osm_node_seq_idxs: number[];
// };

// type ShstGeomOsmMeta = {
// shst_geometry_id: number;
// osm_metadata_way_section_idx: number;
// way_id: number;
// road_class: SharedStreetsRoadClass;
// nodes_seq_info: NodeSequenceInfo[];
// };

function getAllShstWaySectionNodeMetadataForOsmNodesSeqStmt() {
  this.preparedReadStatements.allShstWaySectionNodeMetadataForOsmNodesSeqStmt =
    this.preparedReadStatements
      .allShstWaySectionNodeMetadataForOsmNodesSeqStmt ||
    this.dbReadConnection.prepare(
      getSql('allShstWaySectionNodeMetadataForOsmNodesSeq.sql'),
    );

  return this.preparedReadStatements
    .allShstWaySectionNodeMetadataForOsmNodesSeqStmt;
}

function getShstReferencesStmt() {
  this.preparedReadStatements.getShstGeomIdsStmt =
    this.preparedReadStatements.getShstGeomIdsStmt ||
    this.dbReadConnection.prepare(
      `
        SELECT
            a.feature
          FROM shst.shst_reference_features AS a
            INNER JOIN (
              SELECT
                  json_extract(value, '$.geometryId') AS geometryId,
                  json_extract(value, '$.isForward') AS isForward
                FROM json_each(?)
            ) AS b
              ON (
                ( json_extract(a.feature, '$.properties.geometryId') = b.geometryId )
                AND
                ( json_extract(a.feature, '$.properties.isForward') = b.isForward )
              )
      `,
    );

  return this.preparedReadStatements.getShstGeomIdsStmt;
}

export default function getShstReferencesChainForOsmNodesSequence(
  osmNodeIdsSequence: number[],
): SharedStreetsReferenceFeature[] | null {
  console.time('     getShstReferencesChainForOsmNodesSequence');
  type Response1Row = {
    shst_geometry_id: number;
    osm_metadata_way_section_idx: number;
    way_section_nodes_idx: number;
    osm_node_id: number;
    osm_node_seq_idx: number;
  };

  if (!osmNodeIdsSequence?.length) {
    return null;
  }

  // NOTE: result ORDERed BY osm_node_seq_idx
  const result: Response1Row[] = getAllShstWaySectionNodeMetadataForOsmNodesSeqStmt
    .call(this)
    .all([JSON.stringify(osmNodeIdsSequence)]);

  if (!result.length) {
    console.error('RESULT LENGTH === 0');
    console.error(JSON.stringify({ osmNodeIdsSequence, result }, null, 4));
    return null;
  }

  type CollectedEntry = {
    way_section_nodes_idx: number;
    osm_node_id: number;
    osm_node_seq_idx: number;
  };

  type Collected = Record<number, Record<number, CollectedEntry[][]>>;

  const collected = result.reduce(
    (
      acc: Collected,
      {
        shst_geometry_id,
        osm_metadata_way_section_idx,
        way_section_nodes_idx,
        osm_node_id,
        osm_node_seq_idx,
      },
    ) => {
      acc[shst_geometry_id] = acc[shst_geometry_id] || {};
      acc[shst_geometry_id][osm_metadata_way_section_idx] =
        acc[shst_geometry_id][osm_metadata_way_section_idx] || [];

      const lastSeq = _.last(
        acc[shst_geometry_id][osm_metadata_way_section_idx],
      );

      const lastEntry = _.last(lastSeq);

      if (Math.abs(lastEntry?.osm_node_seq_idx - osm_node_seq_idx) === 1) {
        lastSeq.push({ way_section_nodes_idx, osm_node_id, osm_node_seq_idx });
      } else {
        acc[shst_geometry_id][osm_metadata_way_section_idx].push([
          { way_section_nodes_idx, osm_node_id, osm_node_seq_idx },
        ]);
      }

      return acc;
    },
    {},
  );

  const orderedOsmMetaMatches = Object.keys(collected)
    .reduce((acc, shst_geometry_id) => {
      const c = collected[shst_geometry_id];

      Object.keys(c).forEach((osm_metadata_way_section_idx) => {
        const nodeSeqs =
          collected[shst_geometry_id][osm_metadata_way_section_idx];

        nodeSeqs.forEach((node_sequence) => {
          const [{ osm_node_seq_idx: min_osm_node_seq_idx }] = node_sequence;

          let fwd = true;
          let bwd = true;

          for (let i = 1; i < node_sequence.length; ++i) {
            fwd =
              fwd &&
              node_sequence[i - 1].way_section_nodes_idx <=
                node_sequence[i].way_section_nodes_idx;

            bwd =
              bwd &&
              node_sequence[i - 1].way_section_nodes_idx >=
                node_sequence[i].way_section_nodes_idx;

            if (!(fwd || bwd)) {
              break;
            }
          }

          // Both fwd and bwd
          if (fwd === false && bwd === false) {
            fwd = true;
            bwd = true;
          }

          acc.push({
            shst_geometry_id,
            osm_metadata_way_section_idx,
            fwd,
            bwd,
            min_osm_node_seq_idx,
            node_sequence,
          });
        });
      });

      return acc;
    }, [])
    .sort((a, b) => a.min_osm_node_seq_idx - b.min_osm_node_seq_idx);

  const queryPairs = _.uniqWith(
    // FIXME: Bring forward/backward back in.
    orderedOsmMetaMatches.reduce((acc, { shst_geometry_id, fwd, bwd }) => {
      // orderedOsmMetaMatches.reduce((acc, { shst_geometry_id }) => {
      if (fwd) {
        acc.push({ geometryId: shst_geometry_id, isForward: true });
      }

      if (bwd) {
        acc.push({ geometryId: shst_geometry_id, isForward: false });
      }

      return acc;
    }, []),
    _.isEqual,
  );

  const shstReferences: SharedStreetsReferenceFeature[] = getShstReferencesStmt
    .call(this)
    .pluck()
    .all([JSON.stringify(queryPairs)])
    .map((f: string) => JSON.parse(f));

  console.timeEnd('     getShstReferencesChainForOsmNodesSequence');
  return shstReferences;
}
