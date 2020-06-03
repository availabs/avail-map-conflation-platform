/* eslint-disable no-restricted-syntax, jsdoc/require-jsdoc */

const assert = require('assert');
const turf = require('@turf/turf');

const db = require('../../../services/DbService');
const RawGtfsDAOFactory = require('../../RawGtfsDAOFactory');

const getGeoProximityKey = require('../../../utils/getGeoProximityKey');
const formatRow = require('../../../utils/formatRowForSqliteInsert');

const SCHEMA = require('./DATABASE_SCHEMA_NAME');
const { createStopsTable, createShapesTable } = require('./createTableFns');

const rawGtfsDAO = RawGtfsDAOFactory.getDAO();

function* toPointsIterator(gtfsStopsIterator) {
  for (const { stop_id, stop_lat, stop_lon } of gtfsStopsIterator) {
    yield turf.point([stop_lon, stop_lat], null, { id: stop_id });
  }
}

function* toLineStringsIterator(gtfsShapesIterator) {
  let curShapeId = null;
  let curShapePtSeq = null;
  let coordinates;

  for (const {
    shape_id,
    shape_pt_lat,
    shape_pt_lon,
    shape_pt_sequence
  } of gtfsShapesIterator) {
    if (curShapeId) {
      if (curShapeId === shape_id) {
        assert(
          (curShapePtSeq === null && shape_pt_sequence === null) ||
            curShapePtSeq <= shape_pt_sequence
        );
      } else {
        assert(curShapeId < shape_id);
      }
    }

    // FIXME: Clean this
    if (!curShapeId || curShapeId !== shape_id) {
      if (curShapeId && coordinates && coordinates.length > 1) {
        yield turf.lineString(coordinates, null, { id: curShapeId });
      }

      curShapeId = shape_id;
      curShapePtSeq = shape_pt_sequence;
      coordinates = [[shape_pt_lon, shape_pt_lat]];
    } else {
      coordinates.push([shape_pt_lon, shape_pt_lat]);
    }
  }

  if (curShapeId && coordinates && coordinates.length > 1) {
    yield turf.lineString(
      coordinates,
      { shape_id: curShapeId },
      { id: curShapeId }
    );
  }
}

function loadFeatures(tableName, featureIterator, opts) {
  const { clean } = opts;

  db.unsafeMode(true);

  try {
    db.exec('BEGIN');

    if (clean) {
      db.exec(`DROP TABLE IF EXISTS ${SCHEMA}.${tableName};`);
    }

    if (tableName === 'stops') {
      createStopsTable(db);
    } else if (tableName === 'shapes') {
      createShapesTable(db);
    } else {
      throw new Error(`UNSUPPORTED table ${tableName}`);
    }

    const featureInsertStmt = db.prepare(`
      INSERT INTO ${SCHEMA}.${tableName} (
        id,
        geoprox_key,
        feature
      ) VALUES (?, ?, ?);
    `);

    for (const feature of featureIterator) {
      const { id } = feature;
      const geoprox_key = getGeoProximityKey(feature);
      const stringifiedFeature = JSON.stringify(feature);

      const params = formatRow(['id', 'geoprox_key', 'feature'], {
        id,
        geoprox_key,
        feature: stringifiedFeature
      });

      featureInsertStmt.run(params);
    }

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    db.unsafeMode(false);
  }
}

function loadStops(opts) {
  const gtfsStopsIterator = rawGtfsDAO.makeStopsIterator();
  const pointsIterator = toPointsIterator(gtfsStopsIterator);

  loadFeatures('stops', pointsIterator, opts);
}

function loadShapes(opts) {
  const gtfsShapesIterator = rawGtfsDAO.makeShapesIterator();
  const lineStringsIterator = toLineStringsIterator(gtfsShapesIterator);

  loadFeatures('shapes', lineStringsIterator, opts);
}

function load(opts) {
  loadStops(opts);
  loadShapes(opts);
}

module.exports = {
  load
};