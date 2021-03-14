/* eslint-disable import/prefer-default-export, no-restricted-syntax */

import { readFileSync } from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import _ from 'lodash';

import { RoadClass } from 'sharedstreets-types';
import { SOURCE_MAP as SCHEMA } from '../../../../constants/databaseSchemaNames';

import getBufferPolygonCoords from '../../../../utils/getBufferPolygonCoords';

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

export function* makeShstReferenceLoaderIterator(
  db: any,
): Generator<SharedStreetsReferenceFeature> {
  // FIXME FIXME FIXME: Figure out why need to use DISTINCT for the osm_metadata_way_sections
  const iter = db
    .prepare(
      `
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
              FROM ${SCHEMA}.shst_references AS ref
                INNER JOIN ${SCHEMA}.shst_geometries AS geom
                  ON (geom.id = ref.geometry_id)
                LEFT OUTER JOIN ${SCHEMA}.shst_reference_forms_of_way AS fow
                  ON (ref.form_of_way = fow.element)
                LEFT JOIN ${SCHEMA}.shst_geometry_road_class AS rc
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
                FROM ${SCHEMA}.shst_references_location_references
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
                FROM ${SCHEMA}.shst_metadata AS meta
                  INNER JOIN ${SCHEMA}.shst_metadata_osm_metadata_way_sections AS way_sections
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
                      FROM ${SCHEMA}.shst_metadata_osm_metadata_way_section_nodes
                      GROUP BY shst_metadata_id, osm_metadata_way_section_idx
                  ) AS way_node_ids
                    USING (shst_metadata_id, osm_metadata_way_section_idx)
                  INNER JOIN ${SCHEMA}.osm_ways
                    ON (way_sections.way_id = osm_ways.osm_way_id)
                GROUP BY geometry_id
            ) USING (shst_geometry_id)
        ;
      `,
    )
    .raw()
    .iterate();

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

export default function finishSharedStreetsLoad(db: any) {
  const xdb = db.openLoadingConnectionToDb(SCHEMA);

  // @ts-ignore
  xdb.unsafeMode(true);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    const sql = readFileSync(join(__dirname, './create_cached_join_tables.sql'))
      .toString()
      .replace(/__SCHEMA__/g, SCHEMA);

    xdb.exec(sql);

    const indxInsertStmt = xdb.prepare(
      `
      INSERT INTO ${SCHEMA}.shst_reference_features_geopoly_idx (
        _shape,
        shst_reference_id
      ) VALUES (?, ?) ;
    `,
    );

    const shstRefInsertStmt = xdb.prepare(
      `
        INSERT INTO ${SCHEMA}.shst_reference_features (
          shst_reference_id,
          feature
        ) VALUES (?, ?)
      ; `,
    );

    const iter = makeShstReferenceLoaderIterator(xdb);

    for (const shstReference of iter) {
      shstRefInsertStmt.run([shstReference.id, JSON.stringify(shstReference)]);

      // Coordinates of the feature's bounding polygon.
      const polyCoords = getBufferPolygonCoords(shstReference);

      const geopolyShape = polyCoords[0];

      indxInsertStmt.run([JSON.stringify(geopolyShape), shstReference.id]);
    }

    xdb.exec('COMMIT');
  } catch (err) {
    console.error(err);
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}
