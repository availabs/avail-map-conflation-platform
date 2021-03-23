/* eslint-disable no-restricted-syntax */

require('ts-node').register();

const { default: TargetMapDAO } = require('./TargetMapDAO');
const { default: getBearing } = require('../gis/getBearing');

// import { NYS_RIS as SCHEMA } from '../../constants/databaseSchemaNames';
const SCHEMA = require('../../constants/databaseSchemaNames').NYS_RIS;

const dao = new TargetMapDAO(SCHEMA);

module.exports = function getPathBearing(targetMapPathId, cb) {
  try {
    const p = dao.getMergedPathBoundaryEdges(targetMapPathId);
    const bearing = getBearing(p);

    cb(null, { targetMapPathId, bearing });
  } catch (err) {
    console.error(err);
    cb(null, { targetMapPathId, bearing: null });
  }
};
