/* eslint-disable no-restricted-syntax */

require('ts-node').register();

const { default: loadGtfsZipArchive } = require('../index.ts');

module.exports = async function consumeGtfsFeed({ agency_name, gtfs_zip }, cb) {
  try {
    await loadGtfsZipArchive({ agency_name, gtfs_zip });

    cb(null);
  } catch (err) {
    cb(err);
  }
};
