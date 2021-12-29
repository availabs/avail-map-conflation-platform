import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

import inputDirectory from '../../../constants/inputDirectory';

export function getGtfsInputDir() {
  return join(inputDirectory, 'gtfs');
}

// NOTE: GTFS Agency directories are sub-directories of the gtfs input directory.
export function getGtfsZipPathsByAgency(): Record<string, string> {
  const gtfsDir = getGtfsInputDir();

  if (!existsSync(gtfsDir)) {
    return {};
  }

  const gtfsDirsByAgency = readdirSync(gtfsDir, { withFileTypes: true }).reduce(
    (acc, d) => {
      if (!d.isDirectory()) {
        return acc;
      }

      // Directory name is agency name
      const agency = d.name;

      const agencyDir = join(gtfsDir, agency);

      const containsGtfsZip = readdirSync(agencyDir, {
        withFileTypes: true,
      }).some(
        (f) => (f.isFile() || f.isSymbolicLink()) && f.name === 'gtfs.zip',
      );

      if (containsGtfsZip) {
        acc[agency] = join(agencyDir, 'gtfs.zip');
      }

      return acc;
    },
    {},
  );

  return gtfsDirsByAgency;
}

// FIXME: Why is this in the InputDirs module?
// NOTE: Reads the file system for each call.
export function getGtfsAgencyInputDir(agency: string) {
  return getGtfsZipPathsByAgency()[agency] || null;
}
