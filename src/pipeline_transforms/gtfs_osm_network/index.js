/* eslint-disable no-restricted-syntax */

const dao = require('../../daos/GtfsOsmNetworkDAO');

const timerId = 'load gtfs-osm network';

const main = async () => {
  try {
    console.time(timerId);
    await dao.load();
    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = main;
