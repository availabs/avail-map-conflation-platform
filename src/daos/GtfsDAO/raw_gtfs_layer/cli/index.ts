/* eslint-disable no-await-in-loop */

import { pipeline } from 'stream';

import { basename } from 'path';

import unzipper from 'unzipper';
import * as csv from 'fast-csv';

import loadGtfsBaseTables, {
  AsyncCsvRowGenerator,
} from '../loaders/loadGtfsBaseTables';

import { GtfsTable } from '../../domain/types';

const supportedGtfsTableNames = new Set(Object.keys(GtfsTable));

const getTableNameForGtfsFileName = (fileName: string): GtfsTable | null => {
  if (!fileName) {
    return null;
  }

  const name = basename(fileName, '.txt');

  return supportedGtfsTableNames.has(name) ? GtfsTable[name] : null;
};

export async function* makeGtfsFilesIterator(
  gtfs_zip: string,
): AsyncGenerator<{
  tableName: GtfsTable;
  ayncRowIterator: AsyncCsvRowGenerator;
}> {
  const { files: zipEntries } = await unzipper.Open.file(gtfs_zip);

  for (let i = 0; i < zipEntries.length; ++i) {
    const zipEntry = zipEntries[i];

    const { path: fileName } = zipEntry;

    const tableName = getTableNameForGtfsFileName(fileName);

    if (tableName !== null) {
      // Convert the CSV to an Object stream
      const csvParseStream = csv.parse({
        headers: true,
      });

      // @ts-ignore
      const ayncRowIterator: AsyncCsvRowGenerator = pipeline(
        zipEntry.stream(),
        csvParseStream,
        (err) => {
          if (err) {
            throw err;
          }
        },
      );

      yield { tableName, ayncRowIterator };
    }
  }
}

export default async function loadGtfsZipArchive({ agency_name, gtfs_zip }) {
  try {
    const timerId = `load ${agency_name} GTFS Feed`;

    console.time(timerId);

    const gtfsFilesIterator = makeGtfsFilesIterator(gtfs_zip);

    await loadGtfsBaseTables(agency_name, gtfsFilesIterator);

    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    throw err;
  }
}
