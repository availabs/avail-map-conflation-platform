/* eslint-disable no-await-in-loop */

import { pipeline } from 'stream';

import { basename } from 'path';

import unzipper from 'unzipper';
import * as csv from 'fast-csv';

import loadRawGtfsTables, {
  AsyncCsvRowGenerator,
} from '../loaders/loadRawGtfsTables';

import { GtfsTable } from '../../domain/types';

const supportedGtfsTableNames = new Set(Object.keys(GtfsTable));

const timerId = 'load raw gtfs';

const getTableNameForGtfsFileName = (fileName: string): GtfsTable | null => {
  if (!fileName) {
    return null;
  }

  const name = basename(fileName, '.txt');

  return supportedGtfsTableNames.has(name) ? GtfsTable[name] : null;
};

export async function* makeGtfsFilesIterator(gtfs_zip: string) {
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
    console.time(timerId);

    const gtfsFilesIterator = makeGtfsFilesIterator(gtfs_zip);

    loadRawGtfsTables(agency_name, gtfsFilesIterator);

    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
