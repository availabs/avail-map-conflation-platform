import { join } from 'path';

import outputDirectory from '../../../constants/outputDirectory';

import { GtfsAgencyName } from '../domain/types';

export default function getGtfsAgencyOutputDir(gtfsAgencyName: GtfsAgencyName) {
  return join(outputDirectory, 'gtfs', gtfsAgencyName);
}
