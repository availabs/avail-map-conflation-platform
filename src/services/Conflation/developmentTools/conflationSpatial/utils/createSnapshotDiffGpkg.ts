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

const matchTypes = ['shst', 'chosen', 'assigned'];
const diffTypes = ['a_except_b', 'b_except_a', 'a_intersect_b'];

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
  conflationSnapshotDiffPath: string,
  conflationSnapshotDiffGpkgPath: string,
) {
  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln shst_references  \
        ${conflationSnapshotDiffGpkgPath} \
        ${conflationInputMapsGpkgPath} \
        -sql '
          SELECT
              *
            FROM shst_references
        '
      `,
    { stdio },
  );

  execSync(
    `
      ogr2ogr \
        -overwrite \
        -F GPKG  \
        -nln conflation_blackboard_snapshot_diff_metadata  \
        ${conflationSnapshotDiffGpkgPath} \
        ${conflationSnapshotDiffPath} \
        -sql '
          SELECT
              *
            FROM conflation_blackboard_snapshot_diff_metadata
        '
      `,
    { stdio },
  );
}

function createLayers(
  conflationSnapshotDiffPath: string,
  conflationSnapshotDiffGpkgPath: string,
) {
  const getLayerName = (matchType: string, diffType: string) =>
    `${matchType}_matches_${diffType}`;

  matchTypes.forEach((matchType) => {
    const successfulDiffTypes: string[] = [];
    const unsuccessfulDiffTypes: string[] = [];

    diffTypes.forEach((diffType) => {
      const layerName = getLayerName(matchType, diffType);

      try {
        execSync(
          `
            ogr2ogr \
              -overwrite \
              -F GPKG  \
              -nln nonspatial_${layerName}  \
              ${conflationSnapshotDiffGpkgPath} \
              ${conflationSnapshotDiffPath} \
              -sql '
                SELECT
                    *
                  FROM ${layerName}
              '
          `,
          { stdio },
        );

        const shsrRefIdCol =
          matchType === 'assigned' ? 'shst_reference_id' : 'shst_reference';

        execSync(
          `
            ogr2ogr \
              -overwrite \
              -F 'GPKG'  \
              -nln ${layerName} \
              ${conflationSnapshotDiffGpkgPath} \
              ${conflationSnapshotDiffGpkgPath} \
              -sql '
                SELECT
                    *
                  FROM (
                    SELECT
                        b.*,
                        ST_Line_Substring(
                          geom,
                          ( b.section_start / a.shst_reference_length ),
                          ( b.section_end / a.shst_reference_length )
                        ) AS geometry
                      FROM shst_references AS a
                        INNER JOIN nonspatial_${layerName} AS b
                          ON ( b.${shsrRefIdCol} = a.shst_reference_id )
                  )
                  WHERE ( geometry IS NOT NULL )
              '
          `,
          { stdio },
        );

        execSync(
          `ogrinfo ${conflationSnapshotDiffGpkgPath} -sql 'DROP TABLE nonspatial_${layerName}'`,
        );

        const layerExistsSql = `
          SELECT
              COUNT(1)
            FROM sqlite_master
            WHERE (
              ( type = 'table' )
              AND
              ( name = '${layerName}' )
            )
        `;

        const successful =
          execSync(
            `sqlite3 ${conflationSnapshotDiffGpkgPath} "${layerExistsSql}"`,
            { encoding: 'utf8' },
          ).trim() === '1';

        if (successful) {
          successfulDiffTypes.push(diffType);
        } else {
          unsuccessfulDiffTypes.push(diffType);
        }
      } catch (err) {
        unsuccessfulDiffTypes.push(diffType);
      }
    });

    if (unsuccessfulDiffTypes.length === 0) {
      return;
    }

    if (successfulDiffTypes.length === 0) {
      console.warn(`Unable to create ${matchType} diff layers`);
      return;
    }

    const successfulLayer = getLayerName(matchType, successfulDiffTypes[0]);

    unsuccessfulDiffTypes.forEach((unsuccessfulDiffType) => {
      const unsuccessfulLayer = getLayerName(matchType, unsuccessfulDiffType);

      execSync(
        `
          ogr2ogr \
            -overwrite \
            -F GPKG  \
            -nln ${unsuccessfulLayer}  \
            ${conflationSnapshotDiffGpkgPath} \
            ${conflationSnapshotDiffGpkgPath} \
            -sql '
              SELECT
                  *
                FROM ${successfulLayer}
                LIMIT 1
            '
        `,
        { stdio },
      );

      execSync(
        `ogrinfo ${conflationSnapshotDiffGpkgPath} -sql 'DELETE FROM ${unsuccessfulLayer}'`,
      );
    });
  });
}

function finalizeGeoPackage(conflationSnapshotDiffGpkgPath: string) {
  execSync(
    `ogrinfo ${conflationSnapshotDiffGpkgPath} -sql 'DROP TABLE shst_references'`,
    { stdio },
  );

  execSync(`sqlite3 ${conflationSnapshotDiffGpkgPath} 'VACUUM'`);
  execSync(`sqlite3 ${conflationSnapshotDiffGpkgPath} 'ANALYZE'`);

  execSync(
    `sqlite3 ${conflationSnapshotDiffGpkgPath} 'PRAGMA journal_mode=DELETE'`,
  );
}

export default function createConflationSnapshotDiffGpkg(
  conflationInputMapsGpkgPath: string,
  conflationSnapshotDiffPath: string,
  conflationSnapshotDiffGpkgPath: string,
) {
  mkdirSync(dirname(conflationSnapshotDiffGpkgPath), { recursive: true });

  try {
    unlinkSync(conflationSnapshotDiffGpkgPath);
  } catch (err) {
    //
  }

  initializeGeoPackage(
    conflationInputMapsGpkgPath,
    conflationSnapshotDiffPath,
    conflationSnapshotDiffGpkgPath,
  );

  createLayers(conflationSnapshotDiffPath, conflationSnapshotDiffGpkgPath);

  finalizeGeoPackage(conflationSnapshotDiffGpkgPath);
}
