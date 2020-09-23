/* eslint-disable no-restricted-syntax */

const dao = require('../../daos/GtfsGeoJsonDAO');

const timerId = 'load gtfs as geojson';

const main = async () => {
  try {
    console.time(timerId);
    dao.load();
    console.timeEnd(timerId);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

module.exports = main;
