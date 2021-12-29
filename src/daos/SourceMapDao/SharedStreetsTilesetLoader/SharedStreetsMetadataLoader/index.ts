/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';

import { join } from 'path';

import { Database, Statement } from 'better-sqlite3';
import { SharedStreetsMetadata } from 'sharedstreets-types';
import DbService from '../../../../services/DbService';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleNoOsmMetadata,
  handleEmptyOsmWaySections,
  handleEmptyNodeIdsForOsmWaySection,
  handleEmptyGisMetadata,
  handleEmptyGisMetadataSections,
} from './anomalyHandlers';

function getSql(fName: string) {
  return readFileSync(join(__dirname, './sql/', fName), {
    encoding: 'utf8',
  });
}

export default class SharedStreetsMetadataLoader {
  protected dbWriteConnection: Database;

  protected readonly preparedWriteStatements!: {
    insertShstMetadataStmt?: Statement;
    insertShstMetadataOsmMetadataWaySectionsStmt?: Statement;
    insertShstMetadataOsmMetadataWaySectionNodesStmt?: Statement;
    insertShstMetadataGisMetadataStmt?: Statement;
    shstMetadataGisMetadataSectionMetadataStmt?: Statement;
  };

  constructor() {
    this.dbWriteConnection = DbService.openConnectionToDb(SCHEMA, null, 'shst');

    this.preparedWriteStatements = {};
  }

  protected initializeDatabaseTables() {
    const sql = getSql('create_shst_metadata_tables.sql');

    this.dbWriteConnection.exec(sql);
  }

  protected get insertShstMetadataStmt(): Statement {
    this.preparedWriteStatements.insertShstMetadataStmt =
      this.preparedWriteStatements.insertShstMetadataStmt ||
      this.dbWriteConnection.prepare(`
        INSERT OR IGNORE INTO shst.shst_metadata (
          geometry_id,
          osm_metadata_name
        ) VALUES (?, ?);
      `);

    return this.preparedWriteStatements.insertShstMetadataStmt;
  }

  protected insertShstMetadata = (shstMetadata: SharedStreetsMetadata) => {
    const {
      geometryId,
      osmMetadata: { name: osmMetadataName = null } = {},
    } = shstMetadata;

    // lastInsertRowid is the autoincrement id
    const {
      changes: success,
      lastInsertRowid: shstMetadataId,
    } = this.insertShstMetadataStmt.run([geometryId, osmMetadataName]);

    return success ? shstMetadataId : null;
  };

  protected get insertShstMetadataOsmMetadataWaySectionsStmt(): Statement {
    this.preparedWriteStatements.insertShstMetadataOsmMetadataWaySectionsStmt =
      this.preparedWriteStatements
        .insertShstMetadataOsmMetadataWaySectionsStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_metadata_osm_metadata_way_sections (
          shst_metadata_id,
          osm_metadata_way_section_idx,
          way_id,
          road_class,
          one_way,
          roundabout,
          link,
          name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ;
      `);

    return this.preparedWriteStatements
      .insertShstMetadataOsmMetadataWaySectionsStmt;
  }

  protected get insertShstMetadataOsmMetadataWaySectionNodesStmt(): Statement {
    this.preparedWriteStatements.insertShstMetadataOsmMetadataWaySectionNodesStmt =
      this.preparedWriteStatements
        .insertShstMetadataOsmMetadataWaySectionNodesStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_metadata_osm_metadata_way_section_nodes (
          shst_metadata_id,
          osm_metadata_way_section_idx,
          way_section_nodes_idx,
          osm_node_id
        ) VALUES (?, ?, ?, ?) ;
      `);

    return this.preparedWriteStatements
      .insertShstMetadataOsmMetadataWaySectionNodesStmt;
  }

  protected insertWaySections(
    shstMetadata: SharedStreetsMetadata,
    shstMetadataId: number,
  ) {
    const { osmMetadata = null } = shstMetadata;

    if (osmMetadata === null) {
      handleNoOsmMetadata(shstMetadata, shstMetadataId);
      return false;
    }

    const { waySections = null } = osmMetadata;

    if (waySections === null || waySections.length === 0) {
      handleEmptyOsmWaySections(shstMetadata, shstMetadataId);
      return false;
    }

    for (
      let osmMetadataWaySectionIdx = 0;
      osmMetadataWaySectionIdx < waySections.length;
      ++osmMetadataWaySectionIdx
    ) {
      const {
        wayId = null,
        roadClass = null,
        oneWay = null,
        roundabout = null,
        link = null,
        nodeIds = null,
        name = null,
      } = waySections[osmMetadataWaySectionIdx];

      this.insertShstMetadataOsmMetadataWaySectionsStmt.run([
        shstMetadataId,
        osmMetadataWaySectionIdx,
        wayId,
        roadClass,
        oneWay !== null ? +oneWay : null,
        roundabout !== null ? +roundabout : null,
        link !== null ? +link : null,
        name,
      ]);

      if (nodeIds !== null && nodeIds.length > 0) {
        for (
          let waySectionNodeIdx = 0;
          waySectionNodeIdx < nodeIds.length;
          ++waySectionNodeIdx
        ) {
          const nodeId = nodeIds[waySectionNodeIdx];

          this.insertShstMetadataOsmMetadataWaySectionNodesStmt.run([
            shstMetadataId,
            osmMetadataWaySectionIdx,
            waySectionNodeIdx,
            nodeId,
          ]);
        }
      } else {
        handleEmptyNodeIdsForOsmWaySection(
          shstMetadata,
          shstMetadataId,
          osmMetadataWaySectionIdx,
        );
      }
    }

    return true;
  }

  protected get insertShstMetadataGisMetadataStmt(): Statement {
    this.preparedWriteStatements.insertShstMetadataGisMetadataStmt =
      this.preparedWriteStatements.insertShstMetadataGisMetadataStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_metadata_gis_metadata (
          shst_metadata_id,
          gis_metadata_idx,
          source
        ) VALUES (?, ?, ?) ; `);

    return this.preparedWriteStatements.insertShstMetadataGisMetadataStmt;
  }

  protected get shstMetadataGisMetadataSectionMetadataStmt() {
    this.preparedWriteStatements.shstMetadataGisMetadataSectionMetadataStmt =
      this.preparedWriteStatements.shstMetadataGisMetadataSectionMetadataStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_metadata_gis_metadata_section_metadata (
          shst_metadata_id,
          gis_metadata_idx,
          gis_metadata_section_idx,
          section_id,
          section_properties
        ) VALUES (?, ?, ?, ?, ?) ;`);

    return this.preparedWriteStatements
      .shstMetadataGisMetadataSectionMetadataStmt;
  }

  protected insertGisMetadata(
    shstMetadata: SharedStreetsMetadata,
    shstMetadataId: number,
  ) {
    const { gisMetadata = null } = shstMetadata;

    if (gisMetadata === null) {
      handleEmptyGisMetadata(shstMetadata, shstMetadataId);
      return false;
    }

    for (
      let gisMetadataIdx = 0;
      gisMetadataIdx < gisMetadata.length;
      ++gisMetadataIdx
    ) {
      const { source, sections = null } = gisMetadata[gisMetadataIdx];

      this.insertShstMetadataGisMetadataStmt.run([
        shstMetadataId,
        gisMetadataIdx,
        source,
      ]);

      if (sections !== null) {
        for (
          let gisMetadataSectionIdx = 0;
          gisMetadataSectionIdx < sections.length;
          ++gisMetadataSectionIdx
        ) {
          const { sectionId, sectionProperties } = sections[
            gisMetadataSectionIdx
          ];

          this.shstMetadataGisMetadataSectionMetadataStmt.run([
            shstMetadataId,
            gisMetadataIdx,
            gisMetadataSectionIdx,
            sectionId,
            sectionProperties,
          ]);
        }
      } else {
        handleEmptyGisMetadataSections(
          shstMetadata,
          shstMetadataId,
          gisMetadataIdx,
        );
      }
    }

    return true;
  }

  async bulkLoadShstMetadataAsync(
    shstMetadataIter: AsyncGenerator<SharedStreetsMetadata>,
  ) {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      for await (const shstMetadata of shstMetadataIter) {
        const shstMetadataId = this.insertShstMetadata(shstMetadata);

        if (shstMetadataId !== null) {
          this.insertWaySections(shstMetadata, +shstMetadataId);
          this.insertGisMetadata(shstMetadata, +shstMetadataId);
        }
      }

      this.dbWriteConnection.exec('COMMIT;');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
