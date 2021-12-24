// Renaming GeoJSON properties in ogr2ogr: https://gis.stackexchange.com/a/282334

import { existsSync, mkdirSync, unlinkSync } from 'fs';
import { execSync } from 'child_process';
import { join, dirname } from 'path';

const ndjsonToGeoJsonScript = join(
  __dirname,
  '../../../../../../bin/ndjson_to_geojson',
);

// Because ogr2ogr is noisey.
enum GdalLogLevel {
  OFF,
  ON,
}

const gdalLogLevel: GdalLogLevel = GdalLogLevel.ON;

// @ts-ignore
const stdio = gdalLogLevel === GdalLogLevel.ON ? 'inherit' : 'ignore';

export function createOsmNodesLayer(gpkgPath: string, outputSqliteDir: string) {
  if (existsSync(join(outputSqliteDir, 'osm'))) {
    const nodesSql = `
        SELECT
            json_set(
              json('
                {
                  "type": "Feature",
                  "geometry": {
                    "type": "Point",
                    "coordinates": null
                  },
                  "properties": {}
                }
              '),
              '$.id',                     osm_node_id,
              '$.properties.osm_node_id', osm_node_id,
              '$.geometry.coordinates',   json(coord)
            ) AS feature
          FROM osm_nodes
            INNER JOIN (
              SELECT DISTINCT
                  value AS osm_node_id
                FROM osm_ways, json_each(osm_node_ids)
                WHERE (
                  NULLIF( LOWER(TRIM(json_extract(tags, '$.highway'))), '' ) IS NOT NULL
                )
            ) USING (osm_node_id)
      `.replace(/"/g, '\\"');

    execSync(
      `
        sqlite3 \
          osm \
          "${nodesSql}" |
        ${ndjsonToGeoJsonScript} |
        ogr2ogr \
          -F GeoJSON  \
          -nln INPUT  \
          /vsistdout/ \
          /vsistdin/  |
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln osm_nodes
      `,
      { cwd: outputSqliteDir, stdio },
    );
  }
}

export function createOsmWaysLayer(
  gpkgPath: string,
  outputSqliteDir: string,
  osmPbfFilePath: string,
) {
  if (existsSync(join(outputSqliteDir, 'osm'))) {
    // NOTE: Trying to load osm_way_node_ids layer directly yields the following:
    //
    //         Warning 1: Integer overflow occurred when trying to set 32bit field.
    execSync(
      `
        ogrinfo \
          ${gpkgPath} \
          -sql '
            DROP TABLE IF EXISTS osm_way_node_ids ;
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogrinfo \
          ${gpkgPath} \
          -sql '
            CREATE TABLE osm_way_node_ids (
              osm_way_id          INTEGER NOT NULL,
              osm_node_idx        INTEGER NOT NULL,
              osm_node_id         INTEGER NOT NULL,

              PRIMARY KEY(osm_way_id, osm_node_idx)
            );
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        sqlite3 \
          ${gpkgPath} \
          "
            ATTACH 'osm' AS osm;

            INSERT INTO osm_way_node_ids (
              osm_way_id,
              osm_node_idx,
              osm_node_id
            )
              SELECT
                  osm_way_id,
                  osm_node_idx,
                  osm_node_id
                FROM osm.osm_way_node_ids
            ;
          "
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogr2ogr \
          -dialect SQLITE \
          -F GeoJSON  \
          /vsistdout/ \
          ${osmPbfFilePath} lines \
          -where "highway <> '' AND highway IS NOT NULL" |
        sed 's/"osm_id"/"osm_way_id"/' |
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln osm_ways
      `,
      { cwd: outputSqliteDir, stdio },
    );
    execSync(
      `
        ogr2ogr \
          -dialect SQLITE \
          -F GeoJSON  \
          /vsistdout/ \
          ${osmPbfFilePath} lines \
          -where "highway <> '' AND highway IS NOT NULL" |
        sed 's/"osm_id"/"osm_way_id"/' |
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln osm_ways
      `,
      { cwd: outputSqliteDir, stdio },
    );
  }
}

export function createShstReferenceLayer(
  gpkgPath: string,
  outputSqliteDir: string,
) {
  if (existsSync(join(outputSqliteDir, 'source_map'))) {
    execSync(
      `
        sqlite3 \
          source_map \
          "SELECT feature from shst_reference_features" |
        ${ndjsonToGeoJsonScript} |
        ogr2ogr \
          -F GeoJSON  \
          -nln INPUT  \
          /vsistdout/ \
          /vsistdin/  |
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln shst_references \
          -sql '
            SELECT
                shstReferenceId       AS shst_reference_id,
                geometryId            AS shst_geometry_id,
                formOfWay             AS form_of_way,
                roadClass             AS road_class,
                fromIntersectionId    AS from_intersection_id,
                toIntersectionId      AS to_intersection_id,
                isForward             AS is_forward,
                minOsmRoadClass       AS min_osm_road_class,
                maxOsmRoadClass       AS max_osm_road_class,
                shstReferenceLength   AS shst_reference_length,
                isUnidirectional      AS is_unidirectional
              FROM INPUT
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );
  }
}

export function createNysRisTargetMapLayer(
  gpkgPath: string,
  outputSqliteDir: string,
) {
  if (existsSync(join(outputSqliteDir, 'nys_ris'))) {
    execSync(
      `
        sqlite3 \
          nys_ris \
          "
            SELECT
                json_set(
                  feature,
                  '$.properties.edgeId', edge_id
                )
              FROM target_map_ppg_edge_line_features
          " |
        ${ndjsonToGeoJsonScript} |
        ogr2ogr \
          -F GeoJSON  \
          -nln INPUT  \
          /vsistdout/ \
          /vsistdin/  |
        ogr2ogr \
          -overwrite \
          -update \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln nys_ris_target_map_edges \
          -nlt LINESTRING \
          -sql '
            SELECT
                edgeId                AS edge_id,
                targetMapId           AS target_map_id,
                targetMapEdgeLength   AS target_map_edge_length,
                isUnidirectional      AS is_unidirectional,
                roadName              AS road_name,
                routeNumber           AS route_number,
                networkLevel          AS network_level,
                isPrimary             AS is_primary
              FROM INPUT
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          nys_ris \
          -nln nys_ris_target_map_ppg_paths \
          -sql '
            SELECT
                *
              FROM target_map_ppg_paths ;
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          nys_ris \
          -nln nys_ris_target_map_ppg_path_edges \
          -sql '
            SELECT
                *
              FROM target_map_ppg_path_edges ;
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );
  }
}

export function createNpmrdsTargetMapLayer(
  gpkgPath: string,
  outputSqliteDir: string,
) {
  if (existsSync(join(outputSqliteDir, 'npmrds'))) {
    execSync(
      `
        sqlite3 \
          npmrds \
          "
            SELECT
                json_set(
                  feature,
                  '$.properties.edgeId', edge_id
                )
              FROM target_map_ppg_edge_line_features
          " |
        ${ndjsonToGeoJsonScript} |
        ogr2ogr \
          -F GeoJSON  \
          -nln INPUT  \
          /vsistdout/ \
          /vsistdin/  |
        ogr2ogr \
          -overwrite \
          -update \
          -F GPKG \
          ${gpkgPath} \
          /vsistdin/ \
          -nln npmrds_target_map_edges \
          -nlt MULTILINESTRING \
          -sql '
            SELECT
                edgeId                AS edge_id,
                targetMapId           AS target_map_id,
                targetMapEdgeLength   AS target_map_edge_length,
                isUnidirectional      AS is_unidirectional,
                roadName              AS road_name,
                routeNumber           AS route_number,
                networkLevel          AS network_level,
                isPrimary             AS is_primary
              FROM INPUT
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          npmrds \
          -nln npmrds_target_map_ppg_paths \
          -sql '
            SELECT
                *
              FROM target_map_ppg_paths ;
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );

    execSync(
      `
        ogr2ogr \
          -overwrite \
          -F GPKG \
          ${gpkgPath} \
          npmrds \
          -nln npmrds_target_map_ppg_path_edges \
          -sql '
            SELECT
                *
              FROM target_map_ppg_path_edges ;
          '
      `,
      { cwd: outputSqliteDir, stdio },
    );
  }
}

export default function createAllConflationInputMapsGpkg(
  gpkgPath: string,
  outputSqliteDir: string,
  osmPbfFilePath: string,
  overwrite: boolean = false,
) {
  if (existsSync(gpkgPath)) {
    if (!overwrite) {
      console.info(`${gpkgPath} already exists.`);
      return;
    }

    console.log('Deleting existing input maps GPKG at', gpkgPath);
    unlinkSync(gpkgPath);
  }

  const gpkgParentDir = dirname(gpkgPath);

  mkdirSync(gpkgParentDir, { recursive: true });

  createOsmNodesLayer(gpkgPath, outputSqliteDir);
  createOsmWaysLayer(gpkgPath, outputSqliteDir, osmPbfFilePath);
  createShstReferenceLayer(gpkgPath, outputSqliteDir);
  createNysRisTargetMapLayer(gpkgPath, outputSqliteDir);
  createNpmrdsTargetMapLayer(gpkgPath, outputSqliteDir);
}
