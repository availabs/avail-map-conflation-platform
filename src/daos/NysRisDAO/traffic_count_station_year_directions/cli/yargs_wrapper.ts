/* eslint-disable import/prefer-default-export */

import handler from '.';

import availableNysTrafficCountStationsVersions from './constants/availableNysTrafficCountStationsVersions';

const [
  latestVersion,
] = availableNysTrafficCountStationsVersions.sort().reverse();

const command = 'load_nys_traffic_count_stations';
const desc = 'Load the NYSDOT Traffic Count Stations.';

const builder = {
  nys_traffic_count_stations_version: {
    desc: 'The NYS Traffic Counts Stations CSV Version.',
    type: 'string',
    demand: true,
    default: latestVersion,
    choices: availableNysTrafficCountStationsVersions,
  },
};

export const loadNysTrafficCountStations = {
  command,
  desc,
  builder,
  handler,
};
