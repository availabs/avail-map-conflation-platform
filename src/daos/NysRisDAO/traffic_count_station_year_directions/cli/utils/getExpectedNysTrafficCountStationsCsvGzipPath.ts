import { join } from 'path';

import nysRisInputDirectory from '../../../raw_map_layer/cli/constants/nysRisInputDirectory';

import { NysTrafficCountStationsVersion } from '../../domain/types';

export default function getExpectedNysTrafficCountStationsCsvGzipPath(
  nys_traffic_count_stations_version: NysTrafficCountStationsVersion,
) {
  return join(
    nysRisInputDirectory,
    `${nys_traffic_count_stations_version}.csv.gz`,
  );
}
