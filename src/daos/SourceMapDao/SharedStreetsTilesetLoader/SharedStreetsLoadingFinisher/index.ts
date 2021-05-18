/* eslint-disable no-restricted-syntax, no-underscore-dangle */

import { readFileSync } from 'fs';
import { join } from 'path';

import _ from 'lodash';
import * as turf from '@turf/turf';

import { RoadClass } from 'sharedstreets-types';
import { Database, Statement } from 'better-sqlite3';

import DbService from '../../../../services/DbService';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

import { OSM, SOURCE_MAP } from '../../../../constants/databaseSchemaNames';

import {
  SharedStreetsLocationReference,
  SharedStreetsReferenceFeature,
  OsmMetadataWaySection,
} from '../../domain/types';

const handleOsmMetaSection = (osmMetaWaySection: any) => {
  // eslint-disable-next-line no-param-reassign
  osmMetaWaySection.nodeIds = osmMetaWaySection.nodeIds
    .sort((a: any, b: any) => a.way_section_nodes_idx - b.way_section_nodes_idx)
    .map(({ osm_node_id }) => osm_node_id);

  return _.omit(osmMetaWaySection, 'osm_metadata_way_section_idx');
};

export default class SharedStreetsLoadingFinisher {
  protected dbReadConnection: Database;

  protected dbWriteConnection: Database;

  protected readonly preparedReadStatements!: {
    shstReferenceFeatureComponentsStmt?: Statement;
  };

  protected readonly preparedWriteStatements!: {
    shstReferenceFeatureComponentsStmt?: Statement;
    insertShstReferenceFeatureStmt?: Statement;
    updateShstReferenceFeaturesGeopolyIdxStmt?: Statement;
  };

  constructor() {
    this.dbReadConnection = DbService.openConnectionToDb(
      SOURCE_MAP,
      null,
      'shst',
    );
    // @ts-ignore
    this.dbReadConnection.unsafeMode(true);

    DbService.attachDatabaseToConnection(
      this.dbReadConnection,
      OSM,
      null,
      'osm',
    );

    this.dbWriteConnection = DbService.openConnectionToDb(
      SOURCE_MAP,
      null,
      'shst',
    );
    // @ts-ignore
    this.dbWriteConnection.unsafeMode(true);

    this.preparedReadStatements = {};
    this.preparedWriteStatements = {};
  }

  protected initializeDatabaseTables() {
    const ddl = readFileSync(
      join(__dirname, './sql/create_cached_join_tables.sql'),
      {
        encoding: 'utf8',
      },
    );

    this.dbWriteConnection.exec(ddl);
  }

  protected get shstReferenceFeatureComponentsStmt(): Statement {
    this.preparedReadStatements.shstReferenceFeatureComponentsStmt =
      this.preparedReadStatements.shstReferenceFeatureComponentsStmt ||
      this.dbReadConnection.prepare(`
        SELECT
            shst_reference_id,
            shst_geometry_id,
            form_of_way,
            road_class,
            is_forward,
            location_references,
            geom_feature,
            osm_metadata_way_sections,
            (
              forward_reference_id IS NULL
              OR
              back_reference_id IS NULL
            ) is_unidirectional
          FROM (
            SELECT
                ref.id as shst_reference_id,
                geometry_id AS shst_geometry_id,
                fow.value AS form_of_way,
                rc.value AS road_class,
                NULLIF(forward_reference_id, '') as forward_reference_id,
                NULLIF(back_reference_id, '') as back_reference_id,
                IFNULL(geom.forward_reference_id = ref.id, 0) AS is_forward,
                geom.geojson_linestring as geom_feature
              FROM shst.shst_references AS ref
                INNER JOIN shst.shst_geometries AS geom
                  ON (geom.id = ref.geometry_id)
                LEFT OUTER JOIN shst.shst_reference_forms_of_way AS fow
                  ON (ref.form_of_way = fow.element)
                LEFT JOIN shst.shst_geometry_road_class AS rc
                  ON (geom.road_class = rc.element)
              WHERE (
                ( ref.id = geom.forward_reference_id )
                OR
                ( ref.id = geom.back_reference_id )
              )
            ) INNER JOIN (
              SELECT
                  shst_reference_id,
                  json_group_array(
                    -- JS code must sort the location_references array by the sequence field.
                    json_object(
                      'sequence',
                      location_reference_idx + 1,
                      'point',
                      json_extract(geojson_point, '$.geometry.coordinates'),
                      'bearing',
                      COALESCE(inbound_bearing, outbound_bearing),
                      'distanceToNextRef',
                      distance_to_next_ref,
                      'intersectionId',
                      intersection_id
                    )
                  ) AS location_references
                FROM shst.shst_references_location_references
                GROUP BY 1
            ) USING (shst_reference_id)
            INNER JOIN (
              SELECT
                  geometry_id AS shst_geometry_id,
                  json_group_array( DISTINCT -- FIXME FIXME FIXME: Why duplicates? DISTINCT is a hack.
                    json_object(
                      'osm_metadata_way_section_idx',
                      osm_metadata_way_section_idx,
                      'way_id',
                      way_id,
                      'osm_way_tags',
                      json(osm_ways.tags),
                      'road_class',
                      road_class,
                      'one_way',
                      one_way,
                      'roundabout',
                      roundabout,
                      'link',
                      link,
                      'nodeIds',
                      json(osm_way_nodes),
                      'name',
                      name
                    )
                  ) AS osm_metadata_way_sections
                FROM shst.shst_metadata AS meta
                  INNER JOIN shst.shst_metadata_osm_metadata_way_sections AS way_sections
                    ON (meta._id = way_sections.shst_metadata_id)
                  INNER JOIN (
                    SELECT
                        shst_metadata_id,
                        osm_metadata_way_section_idx,
                        json_group_array(
                          json_object(
                            'way_section_nodes_idx',  way_section_nodes_idx,
                            'osm_node_id',            osm_node_id
                          )
                        ) AS osm_way_nodes
                      FROM shst.shst_metadata_osm_metadata_way_section_nodes
                      GROUP BY shst_metadata_id, osm_metadata_way_section_idx
                  ) AS way_node_ids
                    USING (shst_metadata_id, osm_metadata_way_section_idx)
                  INNER JOIN osm.osm_ways
                    ON (way_sections.way_id = osm_ways.osm_way_id)
                GROUP BY geometry_id
            ) USING (shst_geometry_id)
        ;
      `);

    return this.preparedReadStatements.shstReferenceFeatureComponentsStmt;
  }

  protected *makeShstReferenceLoaderIterator(): Generator<SharedStreetsReferenceFeature> {
    // FIXME FIXME FIXME: Figure out why need to use DISTINCT for the osm_metadata_way_sections
    const iter = this.shstReferenceFeatureComponentsStmt.raw().iterate();

    for (const [
      shstReferenceId,
      geometryId,
      formOfWay,
      roadClass,
      isForward,
      locationReferencesStr,
      geomFeatureStr,
      osmMetadataWaySectionsStr,
      is_unidirectional,
    ] of iter) {
      const feature = JSON.parse(geomFeatureStr);

      const isUnidirectional = is_unidirectional === 1;

      const shstReferenceLength = turf.length(feature);

      const locationReferences: SharedStreetsLocationReference[] = JSON.parse(
        locationReferencesStr,
      );

      locationReferences.sort((a: any, b: any) => a.sequence - b.sequence);

      const fromIntersectionId = locationReferences[0].intersectionId;

      const toIntersectionId =
        locationReferences[locationReferences.length - 1].intersectionId;

      const unsortedOsmMetadataWaySections = JSON.parse(
        osmMetadataWaySectionsStr,
      );

      const osmMetadataWaySections = unsortedOsmMetadataWaySections
        .sort(
          (a: any, b: any) =>
            a.osm_metadata_way_section_idx - b.osm_metadata_way_section_idx,
        )
        .map(handleOsmMetaSection);

      const osmHighwayTypes = _(osmMetadataWaySections)
        .map('osm_way_tags.highway')
        .filter((t) => t)
        .sort()
        .sortedUniq()
        .value();

      const distinctOsmRoadClasses = _(osmMetadataWaySections)
        .map('road_class')
        .map((c) => RoadClass[c])
        .filter(_.negate(_.isNil))
        .sort()
        .sortedUniq()
        .value();

      const minOsmRoadClass = _.first(distinctOsmRoadClasses);
      const maxOsmRoadClass = _.last(distinctOsmRoadClasses);

      feature.id = shstReferenceId;

      feature.properties = {
        shstReferenceId,
        geometryId,
        formOfWay,
        roadClass,
        fromIntersectionId,
        toIntersectionId,
        locationReferences,
        isForward: !!isForward,
        osmMetadataWaySections,
        // Adding these for convenience and faster queries.
        osmHighwayTypes,
        minOsmRoadClass,
        maxOsmRoadClass,
        distinctOsmRoadClasses,
        shstReferenceLength,
        isUnidirectional,
      };

      if (!isForward) {
        feature.geometry.coordinates.reverse();
        feature.properties.osmMetadataWaySections.reverse();
        feature.properties.osmMetadataWaySections.forEach(
          (osmMeta: OsmMetadataWaySection) => osmMeta.nodeIds.reverse(),
        );
      }

      yield feature;
    }
  }

  protected get insertShstReferenceFeatureStmt(): Statement {
    this.preparedWriteStatements.insertShstReferenceFeatureStmt =
      this.preparedWriteStatements.insertShstReferenceFeatureStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_reference_features (
          shst_reference_id,
          feature
        ) VALUES (?, json(?)) ;
      `);

    return this.preparedWriteStatements.insertShstReferenceFeatureStmt;
  }

  protected get updateShstReferenceFeaturesGeopolyIdxStmt(): Statement {
    this.preparedWriteStatements.updateShstReferenceFeaturesGeopolyIdxStmt =
      this.preparedWriteStatements.updateShstReferenceFeaturesGeopolyIdxStmt ||
      this.dbWriteConnection.prepare(`
        INSERT INTO shst.shst_reference_features_geopoly_idx (
          _shape,
          shst_reference_id
        ) VALUES (json(?), ?) ;
      `);

    return this.preparedWriteStatements
      .updateShstReferenceFeaturesGeopolyIdxStmt;
  }

  protected loadShstReferenceFeatures() {
    const iter = this.makeShstReferenceLoaderIterator();

    for (const shstReference of iter) {
      this.insertShstReferenceFeatureStmt.run([
        shstReference.id,
        JSON.stringify(shstReference),
      ]);

      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shstReference);

      const geopolyShape = polyCoords[0];

      this.updateShstReferenceFeaturesGeopolyIdxStmt.run([
        JSON.stringify(geopolyShape),
        shstReference.id,
      ]);
    }
  }

  protected loadShstReferenceRoadwaysMetadata() {
    this.dbWriteConnection
      .prepare(
        `
          INSERT OR IGNORE INTO shst.shst_reference_roadways_metadata (
            shst_reference_id,
            geometry_id,
            road_class,
            form_of_way,
            from_intersection_id,
            to_intersection_id,
            shst_ref_length,
            is_unidirectional
          )
            SELECT DISTINCT
                json_extract(feature, '$.properties.shstReferenceId')     AS shst_reference_id,
                json_extract(feature, '$.properties.geometryId')          AS geometry_id,
                json_extract(feature, '$.properties.roadClass')           AS road_class,
                json_extract(feature, '$.properties.formOfWay')           AS form_of_way,
                json_extract(feature, '$.properties.fromIntersectionId')  AS from_intersection_id,
                json_extract(feature, '$.properties.toIntersectionId')    AS to_intersection_id,
                json_extract(feature, '$.properties.shstReferenceLength') AS shst_ref_length,
                json_extract(feature, '$.properties.isUnidirectional')    AS is_unidirectional
              FROM shst.shst_reference_features
              WHERE json_extract(feature, '$.properties.roadClass') <= 7
          ; `,
      )
      .run();
  }

  finishSharedStreetsTilesetLoad() {
    try {
      this.dbWriteConnection.exec('BEGIN;');

      this.initializeDatabaseTables();

      this.loadShstReferenceFeatures();

      this.loadShstReferenceRoadwaysMetadata();

      this.dbWriteConnection.exec('COMMIT');
    } catch (err) {
      console.error(err.message);
      this.dbWriteConnection.exec('ROLLBACK');
      throw err;
    }
  }
}
