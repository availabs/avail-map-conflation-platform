/* eslint-disable no-restricted-syntax */

import { createReadStream } from 'fs';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream';

import * as csv from 'fast-csv';

import {
  NysTrafficCountStationsVersion,
  TrafficCountStationYearDirection,
} from '../domain/types';

import getExpectedNysTrafficCountStationsCsvGzipPath from './utils/getExpectedNysTrafficCountStationsCsvGzipPath';

import loadNysTrafficCountStationsTables from '../loaders';

type TrafficCountStationStationYearDirectionAsyncIterator = AsyncGenerator<TrafficCountStationYearDirection>;

async function* makeTrafficCountStationStationYearDirectionAsyncIterator(
  traffic_count_station_year_direction_gz: string,
): TrafficCountStationStationYearDirectionAsyncIterator {
  const stream = csv.parseStream(
    pipeline(
      createReadStream(traffic_count_station_year_direction_gz),
      createGunzip(),
      (err) => {
        if (err) {
          throw err;
        }
      },
    ),
    { headers: true, trim: true },
  );

  for await (const {
    rc_station: rcStation,
    year,
    federal_direction,
  } of stream) {
    const federalDirection = +federal_direction;

    if (federalDirection === 0 || federalDirection === 9) {
      continue;
    }

    yield { rcStation, year: +year, federalDirection };
  }
}

export default async function loadNysTrafficCountStationsCsv({
  nys_traffic_count_stations_version,
}: {
  nys_traffic_count_stations_version: NysTrafficCountStationsVersion;
}) {
  const traffic_count_station_year_direction_gz = getExpectedNysTrafficCountStationsCsvGzipPath(
    nys_traffic_count_stations_version,
  );

  const iter = makeTrafficCountStationStationYearDirectionAsyncIterator(
    traffic_count_station_year_direction_gz,
  );

  await loadNysTrafficCountStationsTables(
    nys_traffic_count_stations_version,
    iter,
  );
}
