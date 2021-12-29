/* eslint-disable no-restricted-syntax, no-await-in-loop */

import os from 'os';
import { join } from 'path';

import workerFarm from 'worker-farm';

import { getGtfsZipPathsByAgency } from '../../../utils/getGtfsInputDirs';

const MAX_CONCURRENT = os.cpus().length / 2;

const WORKER_FARM_CONFIG = {
  maxConcurrentWorkers: MAX_CONCURRENT,
  maxConcurrentCallsPerWorker: 3,
  maxRetries: 0,
  autoStart: true,
};

const workerModulePath = join(__dirname, './workerLoader.js');

// This function loads all GTFS Feeds in the getGtfsInputDirs.
// It does so concurrently, in separate processes, thus with
// much better performance than serially calling loadGtfsZipArchive.
export default async function bulkLoadGtfsFeeds() {
  const workers = workerFarm(WORKER_FARM_CONFIG, workerModulePath);

  const gtfsZipPathsByAgency = getGtfsZipPathsByAgency();

  const agencies = Object.keys(gtfsZipPathsByAgency);

  await Promise.all(
    // A Promise per agency
    agencies.map(
      (agency_name) =>
        new Promise((resolve) => {
          const gtfs_zip = gtfsZipPathsByAgency[agency_name];

          console.time(agency_name);

          workers({ agency_name, gtfs_zip }, (err: Error) => {
            if (err) {
              console.error(`===== ERROR loading ${agency_name} =====`);
              console.error(err);
            }

            console.timeEnd(agency_name);

            // Resolve this agency's Promise
            resolve();
          });
        }),
    ),
  );

  workerFarm.end(workers);
}
