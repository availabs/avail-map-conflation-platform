// Renaming GeoJSON properties in ogr2ogr: https://gis.stackexchange.com/a/282334

import { existsSync, mkdirSync } from 'fs';
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

const gdalLogLevel: GdalLogLevel = GdalLogLevel.OFF;

// @ts-ignore
const stdio = gdalLogLevel === GdalLogLevel.ON ? 'inherit' : 'ignore';

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
          "SELECT feature from target_map_ppg_edge_line_features" |
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
          -sql '
            SELECT
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
          "SELECT feature from target_map_ppg_edge_line_features" |
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
          -sql '
            SELECT
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
  }
}

export default function createAllConflationInputMapsGpkg(
  gpkgPath: string,
  outputSqliteDir: string,
  overwrite: boolean = false,
) {
  if (existsSync(gpkgPath) && !overwrite) {
    console.info(`${gpkgPath} already exists.`);
    return;
  }

  const gpkgParentDir = dirname(gpkgPath);

  mkdirSync(gpkgParentDir, { recursive: true });

  createShstReferenceLayer(gpkgPath, outputSqliteDir);
  createNysRisTargetMapLayer(gpkgPath, outputSqliteDir);
  createNpmrdsTargetMapLayer(gpkgPath, outputSqliteDir);
}
