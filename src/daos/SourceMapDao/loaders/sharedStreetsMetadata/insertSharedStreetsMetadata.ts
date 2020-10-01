import { SharedStreetsMetadata } from 'sharedstreets-types';

import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import {
  handleNoOsmMetadata,
  handleEmptyOsmWaySections,
  handleEmptyNodeIdsForOsmWaySection,
  handleEmptyGisMetadata,
  handleEmptyGisMetadataSections,
} from './anomalyHandlers';

const insertShstMetadata = (db: any, shstMetadata: SharedStreetsMetadata) => {
  const {
    geometryId,
    osmMetadata: { name: osmMetadataName = null } = {},
  } = shstMetadata;

  // lastInsertRowid is the autoincrement id
  const { lastInsertRowid: shstMetadataId } = db
    .prepare(
      `
      INSERT INTO ${SCHEMA}.shst_metadata (
        geometry_id,
        osm_metadata_name
      ) VALUES (?, ?);
    `,
    )
    .run([geometryId, osmMetadataName]);

  return shstMetadataId;
};

const insertWaySections = (
  db: any,
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
) => {
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

    db.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_metadata_osm_metadata_way_sections (
          shst_metadata_id,
          osm_metadata_way_section_idx,
          way_id,
          road_class,
          one_way,
          roundabout,
          link,
          name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ;
      `,
    ).run([
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

        db.prepare(
          `
            INSERT INTO ${SCHEMA}.shst_metadata_osm_metadata_way_section_nodes (
              shst_metadata_id,
              osm_metadata_way_section_idx,
              way_section_nodes_idx,
              osm_node_id
            ) VALUES (?, ?, ?, ?) ;
          `,
        ).run([
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
};

const insertGisMetadata = (
  db: any,
  shstMetadata: SharedStreetsMetadata,
  shstMetadataId: number,
) => {
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

    db.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_metadata_gis_metadata (
          shst_metadata_id,
          gis_metadata_idx,
          source
        ) VALUES (?, ?, ?) ;
      `,
    ).run([shstMetadataId, gisMetadataIdx, source]);

    if (sections !== null) {
      for (
        let gisMetadataSectionIdx = 0;
        gisMetadataSectionIdx < sections.length;
        ++gisMetadataSectionIdx
      ) {
        const { sectionId, sectionProperties } = sections[
          gisMetadataSectionIdx
        ];

        db.prepare(
          `
            INSERT INTO ${SCHEMA}.shst_metadata_gis_metadata (
              shst_metadata_id,
              gis_metadata_idx,
              gis_metadata_section_idx,
              section_id,
              section_properties
            ) VALUES (?, ?, ?, ?, ?) ;
          `,
        ).run([
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
};

export default (db: any, shstMetadata: SharedStreetsMetadata) => {
  const shstMetadataId = insertShstMetadata(db, shstMetadata);
  insertWaySections(db, shstMetadata, shstMetadataId);
  insertGisMetadata(db, shstMetadata, shstMetadataId);

  return true;
};
