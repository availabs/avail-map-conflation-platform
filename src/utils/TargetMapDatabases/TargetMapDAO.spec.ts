import test from 'tape';

import Database from 'better-sqlite3';

import TargetMapDAO from './TargetMapDAO';

test('create TargetMapDAO instance (no schemaQualifier)', (t) => {
  try {
    const testDB = Database(':memory:');
    const targetMapDao = new TargetMapDAO(testDB);
    targetMapDao.initializeTargetMapDatabase();

    t.pass('Test database successfully created and initialized');
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

test('create TargetMapDAO instance (with schemaQualifier)', (t) => {
  try {
    const testDB = new Database(':memory:');
    testDB.exec(`ATTACH DATABASE ':memory:' AS foo;`);

    const targetMapDao = new TargetMapDAO(testDB, 'foo');
    targetMapDao.initializeTargetMapDatabase();

    t.pass('Test database successfully created and initialized');
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

function sqlSyntaxTests(targetMapDao: TargetMapDAO) {
  targetMapDao.initializeTargetMapDatabase();

  const n1 = { lon: Math.random(), lat: Math.random() };
  const n2 = { lon: Math.random(), lat: Math.random() };

  const e1 = {
    startCoord: [n1.lon, n1.lat],
    endCoord: [n2.lon, n2.lat],
    properties: { targetMapId: 'e1' },
    coordinates: [
      [n1.lon, n1.lat],
      [n2.lon, n2.lat],
    ],
  };

  const e2 = {
    startCoord: [n2.lon, n2.lat],
    endCoord: [n1.lon, n1.lat],
    properties: { targetMapId: 'e2' },
    coordinates: [
      [n2.lon, n2.lat],
      [n1.lon, n1.lat],
    ],
  };

  targetMapDao.insertNode(n1);
  targetMapDao.insertNode(n2);
  // @ts-ignore
  targetMapDao.insertEdge(e1);
  // @ts-ignore
  targetMapDao.insertEdge(e2);

  targetMapDao.makeTargetMapEdgeFeaturesIterator();
  targetMapDao.getAllPathsTraversingEdges({ edgeIds: [0, 1] });
  targetMapDao.deleteAllPathsWithLabel('Foo');
}

test('create TargetMapDAO SQL Syntax Tests', (t) => {
  try {
    let testDB = new Database(':memory:');

    let targetMapDao = new TargetMapDAO(testDB);

    sqlSyntaxTests(targetMapDao);

    testDB.close();

    testDB = new Database(':memory:');
    testDB.exec(`ATTACH DATABASE ':memory:' AS foo;`);

    targetMapDao = new TargetMapDAO(testDB, 'foo');

    sqlSyntaxTests(targetMapDao);

    testDB.close();
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});
