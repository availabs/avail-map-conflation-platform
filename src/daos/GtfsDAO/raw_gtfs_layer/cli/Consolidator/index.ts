/* eslint-disable no-restricted-syntax, no-await-in-loop */

import { readFileSync } from 'fs';
import { join } from 'path';

import DbService from '../../../../../services/DbService';

import { getGtfsZipPathsByAgency } from '../../../utils/getGtfsInputDirs';
import getGtfsAgencyOutputDir from '../../../utils/getGtfsAgencyOutputDir';

export default function consolidateConflationMapBusAadtTables() {
  const gtfsZipPathsByAgency = getGtfsZipPathsByAgency();

  const agencies = Object.keys(gtfsZipPathsByAgency);

  const aggregatedGtfsDir = getGtfsAgencyOutputDir('_total_');

  // The ATTACHED database is given the alias "_total_".
  const db = DbService.openConnectionToDb('gtfs', aggregatedGtfsDir, '_total_');

  const sql = readFileSync(
    join(__dirname, 'sql/createConsolidatedGtfsConflationTables.sql'),
    { encoding: 'utf8' },
  );

  db.exec(sql);

  // For each loaded GTFS feed, copy the conflation_map_segments_bus_aadt table into
  //   the consolidated conflation_map_segments_bus_aadt table.
  agencies.forEach((agency) => {
    console.log('==>', agency);
    const dir = getGtfsAgencyOutputDir(agency);

    DbService.attachDatabaseToConnection(db, 'gtfs', dir, 'feed');

    const feed_agency_name = agency
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_/, '')
      .replace(/_$/, '');

    // // NOTE: The following was used to distinguish between sub-agencies
    // //         when a single GTFS Feed contains multiple entries in the agency table.
    //
    // const numAgenciesInFeed = db
    // .prepare(
    // `
    // SELECT
    // COUNT(1) AS ct
    // FROM feed.agency ;
    // `,
    // )
    // .pluck()
    // .get();

    // const agencyNameSelectClause =
    // numAgenciesInFeed <= 1
    // ? `'${feed_agency_name}' AS agency_name`
    // : `('${feed_agency_name}|' || REPLACE(agency, '|', '_')) AS agency_name`;

    try {
      db.prepare(
        `
          INSERT INTO _total_.conflation_map_segments_bus_aadt
            SELECT
                conflation_map_id,
                '${feed_agency_name}' AS feed_agency_name,
                aadt_by_route
              FROM feed.conflation_map_segments_bus_aadt
          ;
        `,
      ).run();
    } catch (err) {
      console.error(agency);
      console.error(err);
    } finally {
      DbService.detachDatabaseFromConnection(db, 'feed');
    }
  });
}
