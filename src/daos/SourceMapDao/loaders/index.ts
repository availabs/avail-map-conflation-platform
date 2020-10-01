/* eslint-disable no-restricted-syntax */

import {
  SharedStreetsGeometry,
  SharedStreetsMetadata,
  SharedStreetsReference,
  SharedStreetsIntersection,
} from 'sharedstreets-types';

import db from '../../../services/DbService';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';

import { createOsmTables, insertOsmNode, insertOsmWay } from './openStreetMap';

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

// https://basarat.gitbook.io/typescript/main-1/typed-event
export async function loadOpenStreetMaps(osmElementEmitter: any) {
  const xdb = db.openLoadingConnectionToDb(SOURCE_MAP);

  try {
    xdb.exec('BEGIN EXCLUSIVE;');

    createOsmTables(xdb);

    const sentinel = new Promise((resolve, reject) =>
      osmElementEmitter
        .on('node', insertOsmNode.bind(null, xdb))
        .on('way', insertOsmWay.bind(null, xdb))
        .on('done', resolve)
        .on('error', reject),
    );

    await sentinel;
    xdb.exec('COMMIT');
  } catch (err) {
    xdb.exec('ROLLBACK;');
    throw err;
  } finally {
    db.closeLoadingConnectionToDb(xdb);
  }
}

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
