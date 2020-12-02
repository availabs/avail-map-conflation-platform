/* eslint-disable no-restricted-syntax */
// import { writeFileSync } from 'fs';
import { join } from 'path';

import test from 'tape';

import * as turf from '@turf/turf';
// import _ from 'lodash';

import db from '../../../services/DbService';

import { getShstReferenceFeaturesOverlappingPoly, getShstReferences } from '.';

import getBufferPolygonCoords from '../../../utils/getBufferPolygonCoords';

import { SOURCE_MAP } from '../../../constants/databaseSchemaNames';

const SAMPLE_SIZE = 10;

db.setOutputDirectory(join(__dirname, '../../../../output'));

const testFeature: turf.Feature<turf.LineString> = {
  type: 'Feature',
  id: '120P07911',
  properties: {},
  geometry: {
    type: 'LineString',
    coordinates: [
      [-73.74826, 42.64342],
      [-73.74865, 42.64353],
      [-73.74901, 42.64363],
      [-73.74931, 42.64372],
      [-73.74934, 42.64373],
      [-73.74939, 42.64374],
      [-73.74965, 42.6438],
      [-73.74974, 42.64383],
      [-73.7501, 42.64394],
      [-73.75026, 42.64399],
      [-73.7504, 42.64403],
      [-73.75056, 42.64409],
      [-73.7507, 42.64416],
      [-73.75099, 42.64434],
      [-73.75122, 42.64448],
      [-73.75132, 42.64459],
      [-73.75143, 42.6447],
      [-73.75153, 42.64479],
      [-73.75174, 42.64499],
      [-73.75196, 42.64521],
      [-73.75198, 42.64524],
      [-73.75223, 42.64549],
      [-73.75245, 42.64572],
      [-73.75282, 42.64609],
      [-73.75303, 42.64632],
      [-73.75319, 42.6465],
      [-73.75335, 42.6467],
      [-73.75342, 42.64678],
    ],
  },
};

const testBuffer = getBufferPolygonCoords(testFeature);

test('Geopoly SharedStreetsReference Query', (t) => {
  try {
    const shstReferences = getShstReferenceFeaturesOverlappingPoly(
      testBuffer[0],
    );

    t.ok(Array.isArray(shstReferences));
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});

test('get SharedStreetsReferences', (t) => {
  const shstReferenceIds = db
    .prepare(
      `SELECT id from ${SOURCE_MAP}.shst_references ORDER BY random() LIMIT ${SAMPLE_SIZE};`,
    )
    .raw()
    .all()
    .map(([id]) => id);

  try {
    const shstReferences = getShstReferences(shstReferenceIds);

    t.ok((shstReferenceIds.length = shstReferences.length));
  } catch (err) {
    t.error(err);
  } finally {
    t.end();
  }
});
