// NOTE: The input tables are initially copied into the Snapshot GPKG because
//       the following error was encountered when trying to ATTACH the input databases:
//
//          driver GPKG does not support open option PRELUDE_STATEMENTS
//
//       From https://gdal.org/drivers/vector/gpkg.html#opening-options
//
//          GPKG PRELUDE_STATEMENTS support added in GDAL version 3.2

import { execSync } from 'child_process';
import { mkdirSync, unlinkSync } from 'fs';
import { dirname } from 'path';

// Because ogr2ogr is noisey.
enum GdalLogLevel {
  OFF,
  ON,
}

const gdalLogLevel: GdalLogLevel = GdalLogLevel.OFF;

// @ts-ignore
const stdio = gdalLogLevel === GdalLogLevel.ON ? 'inherit' : 'ignore';

function initializeGeoPackage(
  conflationInputMapsGpkgPath: string,
  conflationBlkbrdSnapshotGpkgPath: string,
) {
  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln shst_references  \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationInputMapsGpkgPath} \
        -sql '
          SELECT
              *
            FROM shst_references
        '
    `,
    { stdio },
  );
}

function createShstMatchesLayer(
  conflationBlkbrdSnapshotPath: string,
  conflationBlkbrdSnapshotGpkgPath: string,
) {
  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln target_map_edges_shst_matches  \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotPath} \
        -sql '
          SELECT
              *
            FROM target_map_edges_shst_matches
        '
    `,
    { stdio },
  );

  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F 'GPKG'  \
        -nln shst_match_features \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotGpkgPath} \
        -sql '
          SELECT
              b.*,
              ST_Line_Substring(
                geom,
                ( b.section_start / a.shst_reference_length ),
                ( b.section_end / a.shst_reference_length )
              ) AS geometry
            FROM shst_references AS a
              INNER JOIN target_map_edges_shst_matches AS b
                ON ( b.shst_reference = a.shst_reference_id )
        '
    `,
    { stdio },
  );

  execSync(
    `ogrinfo ${conflationBlkbrdSnapshotGpkgPath} -sql 'DROP TABLE target_map_edges_shst_matches'`,
  );
}

function createChosenMatchesLayer(
  conflationBlkbrdSnapshotPath: string,
  conflationBlkbrdSnapshotGpkgPath: string,
) {
  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln target_map_edge_chosen_matches  \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotPath} \
        -sql '
          SELECT
              *
            FROM target_map_edge_chosen_matches
        '
    `,
    { stdio },
  );

  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F 'GPKG'  \
        -nln chosen_match_features \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotGpkgPath} \
        -sql '
          SELECT
              b.*,
              ST_Line_Substring(
                geom,
                ( b.section_start / a.shst_reference_length ),
                ( b.section_end / a.shst_reference_length )
              ) AS geometry
            FROM shst_references AS a
              INNER JOIN target_map_edge_chosen_matches AS b
                ON ( b.shst_reference = a.shst_reference_id )
        '
    `,
    { stdio },
  );

  execSync(
    `ogrinfo ${conflationBlkbrdSnapshotGpkgPath} -sql 'DROP TABLE target_map_edge_chosen_matches'`,
  );
}

function createAssignedMatchesLayer(
  conflationBlkbrdSnapshotPath: string,
  conflationBlkbrdSnapshotGpkgPath: string,
) {
  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln target_map_edge_assigned_matches  \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotPath} \
        -sql '
          SELECT
              shst_reference_id,
              edge_id,
              is_forward,
              section_start,
              section_end
            FROM target_map_edge_assigned_matches
        '
    `,
    { stdio },
  );

  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F 'GPKG'  \
        -nln assigned_match_features \
        ${conflationBlkbrdSnapshotGpkgPath} \
        ${conflationBlkbrdSnapshotGpkgPath} \
        -sql '
          SELECT
              b.shst_reference_id,
              b.edge_id,
              b.is_forward,
              b.section_start,
              b.section_end,
              ST_Line_Substring(
                geom,
                ( b.section_start / a.shst_reference_length ),
                ( b.section_end / a.shst_reference_length )
              ) AS geometry
            FROM shst_references AS a
              INNER JOIN target_map_edge_assigned_matches AS b
                USING ( shst_reference_id )
        '
    `,
    { stdio },
  );

  execSync(
    `ogrinfo ${conflationBlkbrdSnapshotGpkgPath} -sql 'DROP TABLE target_map_edge_assigned_matches'`,
  );
}

function finalizeGeoPackage(conflationBlkbrdSnapshotGpkgPath: string) {
  execSync(
    `ogrinfo ${conflationBlkbrdSnapshotGpkgPath} -sql 'DROP TABLE shst_references'`,
  );

  execSync(`sqlite3 ${conflationBlkbrdSnapshotGpkgPath} 'VACUUM'`);
  execSync(`sqlite3 ${conflationBlkbrdSnapshotGpkgPath} 'ANALYZE'`);
  execSync(
    `sqlite3 ${conflationBlkbrdSnapshotGpkgPath} 'PRAGMA journal_mode=DELETE'`,
  );
}

export default function createConflationBlkbrdSnapshotGpkg(
  conflationInputMapsGpkgPath: string,
  conflationBlkbrdSnapshotPath: string,
  conflationBlkbrdSnapshotGpkgPath: string,
) {
  mkdirSync(dirname(conflationBlkbrdSnapshotGpkgPath), { recursive: true });

  try {
    unlinkSync(conflationBlkbrdSnapshotGpkgPath);
  } catch (err) {
    //
  }

  initializeGeoPackage(
    conflationInputMapsGpkgPath,
    conflationBlkbrdSnapshotGpkgPath,
  );

  createShstMatchesLayer(
    conflationBlkbrdSnapshotPath,
    conflationBlkbrdSnapshotGpkgPath,
  );

  createChosenMatchesLayer(
    conflationBlkbrdSnapshotPath,
    conflationBlkbrdSnapshotGpkgPath,
  );

  createAssignedMatchesLayer(
    conflationBlkbrdSnapshotPath,
    conflationBlkbrdSnapshotGpkgPath,
  );

  finalizeGeoPackage(conflationBlkbrdSnapshotGpkgPath);
}
