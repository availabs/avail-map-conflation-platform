/* eslint-disable no-restricted-syntax */

import {
  SharedStreetsGeometry,
  SharedStreetsMetadata,
  SharedStreetsReference,
  SharedStreetsIntersection,
} from 'sharedstreets-types';

import db from '../../../services/DbService';

import {
  createSharedStreetsIntersectionTables,
  insertSharedStreetsIntersection,
} from './sharedStreetsIntersection';

import {
  createSharedStreetsGeometryTables,
  insertSharedStreetsGeometry,
} from './sharedStreetsGeometry';

import {
  createSharedStreetsMetadataTables,
  insertSharedStreetsMetadata,
} from './sharedStreetsMetadata';

import {
  createSharedStreetsReferenceTables,
  insertSharedStreetsReference,
} from './sharedStreetsReference';

export function loadSharedStreetsGeometries(
  iter: Generator<SharedStreetsGeometry, void, unknown>,
) {
  try {
    db.exec('BEGIN');
    createSharedStreetsGeometryTables(db);

    for (const geometry of iter) {
      insertSharedStreetsGeometry(db, geometry);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function loadSharedStreetsMetadata(
  iter: Generator<SharedStreetsMetadata, void, unknown>,
) {
  try {
    db.exec('BEGIN');
    createSharedStreetsMetadataTables(db);

    for (const shstMetadata of iter) {
      insertSharedStreetsMetadata(db, shstMetadata);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function loadSharedStreetsReferences(
  iter: Generator<SharedStreetsReference, void, unknown>,
) {
  try {
    db.exec('BEGIN');
    createSharedStreetsReferenceTables(db);

    for (const shstReference of iter) {
      insertSharedStreetsReference(db, shstReference);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}

export function loadSharedStreetsIntersections(
  iter: Generator<SharedStreetsIntersection, void, unknown>,
) {
  try {
    db.exec('BEGIN');
    createSharedStreetsIntersectionTables(db);

    for (const shstIntersection of iter) {
      insertSharedStreetsIntersection(db, shstIntersection);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
