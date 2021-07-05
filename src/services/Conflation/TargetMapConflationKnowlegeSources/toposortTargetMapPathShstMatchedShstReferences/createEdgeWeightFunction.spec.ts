/* eslint-disable no-restricted-syntax */

import _ from 'lodash';
import * as turf from '@turf/turf';

import test from 'tape';

import createEdgeWeightFunction from './createEdgeWeightFunction';

const mockVicinity = {
  targetMapPathEdges: [
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.00877795349408, 40.6861360279459],
          [-74.0109590066914, 40.69029703257276],
          [-74.01203896388358, 40.691986009442864],
          [-74.01244603704664, 40.69254297676601],
          [-74.01385694694694, 40.69543902338199],
          [-74.01439896121244, 40.696639981930005],
          [-74.01497197233353, 40.6980120063082],
          [-74.01572395805533, 40.69993200626586],
          [-74.01592198887735, 40.70115398875259],
          [-74.01591300008884, 40.70143497659976],
          [-74.01585001271903, 40.70199900262097],
          [-74.01581294745611, 40.70217696581534],
          [-74.01541594354123, 40.704660017000805],
          [-74.01536798933537, 40.704885990674065],
          [-74.01529295826364, 40.7051820005404],
          [-74.01527904449145, 40.7052440368859],
        ],
      },
      properties: {
        targetMapId: '100416022:0.0',
        targetMapEdgeLength: 2.2397980284473378,
        targetMapPathId: 6,
        targetMapPathIdx: 0,
      },
      id: 34,
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.01527904449145, 40.7052440368859],
          [-74.01524405355256, 40.70540003945334],
          [-74.0151835820428, 40.705523415640585],
        ],
      },
      properties: {
        targetMapId: '100416022:1.39',
        targetMapEdgeLength: 0.03223090325040395,
        targetMapPathId: 6,
        targetMapPathIdx: 1,
      },
      id: 35,
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-74.0151835820428, 40.705523415640585],
          [-74.01517497669423, 40.705540973653754],
          [-74.01512496954243, 40.705657026893974],
          [-74.01490501547134, 40.70620403782125],
          [-74.014852999164, 40.706367998985755],
          [-74.01483394521863, 40.70645602955914],
          [-74.01483205605591, 40.70652799133151],
          [-74.01484101202918, 40.706586983338255],
          [-74.01486598155671, 40.706691965261],
          [-74.014900019325, 40.70677603476443],
          [-74.01492294313816, 40.70681902075484],
          [-74.01497494550956, 40.706897027681464],
          [-74.01516704269797, 40.7071000066611],
          [-74.01522194336971, 40.70713398665533],
          [-74.01526701882209, 40.70717599044953],
          [-74.01543404819822, 40.7073369557058],
          [-74.01554452153991, 40.70749670600221],
        ],
      },
      properties: {
        targetMapId: '100416022:1.41',
        targetMapEdgeLength: 0.24163954035582896,
        targetMapPathId: 6,
        targetMapPathIdx: 2,
      },
      id: 36,
    },
  ],
};

test('Matched are discounted', (t) => {
  const discount = Math.random();

  const clonedVicinity = _.cloneDeep(mockVicinity);

  // @ts-ignore
  clonedVicinity.targetMapPathEdgeShstMatchedShstReferences = [];
  // @ts-ignore
  clonedVicinity.allVicinitySharedStreetsReferencesById = {};
  // @ts-ignore
  clonedVicinity.vicinitySharedStreetsReferences = [];

  clonedVicinity.targetMapPathEdges.forEach((tmpe, i) => {
    const alter = _.cloneDeep(tmpe);

    // @ts-ignore
    alter.properties.shstReferenceId = alter.properties.targetMapId;
    // @ts-ignore
    alter.properties.geometryId = alter.properties.targetMapId
      .split('')
      .reverse()
      .join('');
    // @ts-ignore
    alter.properties.shstReferenceLength = alter.properties.targetMapEdgeLength;

    // @ts-ignore
    clonedVicinity.targetMapPathEdgeShstMatchedShstReferences[i] = [alter];

    // @ts-ignore
    clonedVicinity.allVicinitySharedStreetsReferencesById[
      tmpe.properties.targetMapId
    ] = alter;

    // @ts-ignore
    clonedVicinity.vicinitySharedStreetsReferences.push(alter);
  });

  // @ts-ignore
  const weightFn = createEdgeWeightFunction(clonedVicinity, discount);

  clonedVicinity.targetMapPathEdges.forEach((tmpe) => {
    const len = tmpe.properties.targetMapEdgeLength;

    // @ts-ignore
    const weight = weightFn({ name: tmpe.properties.targetMapId });

    console.log(len, weight);

    t.assert(weight === len * discount);
  });

  t.end();
});

test('Distant are penalized', (t) => {
  const penalty = Math.random() * 1000;

  const clonedVicinity = _.cloneDeep(mockVicinity);
  // @ts-ignore
  clonedVicinity.targetMapPathEdgeShstMatchedShstReferences = [];
  // @ts-ignore
  clonedVicinity.allVicinitySharedStreetsReferencesById = {};
  // @ts-ignore
  clonedVicinity.vicinitySharedStreetsReferences = [];

  clonedVicinity.targetMapPathEdges.forEach((tmpe) => {
    // @ts-ignore
    const alter = turf.transformTranslate(
      // @ts-ignore
      _.cloneDeep(tmpe),
      tmpe.properties.targetMapEdgeLength * 2 + 0.5,
      0,
      { mutate: true },
    );

    // @ts-ignore
    alter.properties.shstReferenceId = tmpe.properties.targetMapId;
    // @ts-ignore
    alter.properties.geometryId = tmpe.properties.targetMapId
      .split('')
      .reverse()
      .join('');

    // @ts-ignore
    alter.properties.shstReferenceLength = tmpe.properties.targetMapEdgeLength;

    // @ts-ignore
    clonedVicinity.allVicinitySharedStreetsReferencesById[
      tmpe.properties.targetMapId
    ] = alter;

    // @ts-ignore
    clonedVicinity.vicinitySharedStreetsReferences.push(alter);
  });

  // @ts-ignore
  const weightFn = createEdgeWeightFunction(clonedVicinity, null, penalty);

  clonedVicinity.targetMapPathEdges.forEach((tmpe) => {
    const len = tmpe.properties.targetMapEdgeLength;

    // @ts-ignore
    const weight = weightFn({ name: tmpe.properties.targetMapId });

    console.log(len, weight);

    t.assert(Math.abs(weight - len * penalty) < 0.001);
  });

  t.end();
});

test('Near weights reasonable', (t) => {
  const clonedVicinity = _.cloneDeep(mockVicinity);
  // @ts-ignore
  clonedVicinity.targetMapPathEdgeShstMatchedShstReferences = [];
  // @ts-ignore
  clonedVicinity.allVicinitySharedStreetsReferencesById = {};
  // @ts-ignore
  clonedVicinity.vicinitySharedStreetsReferences = [];

  clonedVicinity.targetMapPathEdges.forEach((tmpe) => {
    const len = tmpe.properties.targetMapEdgeLength;

    for (let i = 0; i < 4; ++i) {
      const start = 0.25 * i * len;
      const end = 0.25 * (i + 1) * len;

      // @ts-ignore
      const startPt = turf.along(tmpe, start);
      // @ts-ignore
      const endPt = turf.along(tmpe, end);

      // @ts-ignore
      const slice = turf.lineSlice(startPt, endPt, _.cloneDeep(tmpe));

      const bearing = turf.bearing(startPt, endPt);

      const translateDirection = bearing <= 0 ? bearing + 180 : bearing - 180;

      // @ts-ignore
      const alter = turf.transformTranslate(
        // @ts-ignore
        slice,
        (Math.random() < 0.5 ? -1 : 1) * (0.01 * i), // 5 meters
        translateDirection,
        { mutate: true },
      );

      // @ts-ignore
      alter.properties.shstReferenceId = `${tmpe.properties.targetMapId}_${i}`;
      // @ts-ignore
      alter.properties.geometryId = alter.properties.shstReferenceId
        .split('')
        .reverse()
        .join('');
      // @ts-ignore
      alter.properties.shstReferenceLength = end - start;

      // @ts-ignore
      clonedVicinity.allVicinitySharedStreetsReferencesById[
        // @ts-ignore
        alter.properties.shstReferenceId
      ] = alter;

      // @ts-ignore
      clonedVicinity.vicinitySharedStreetsReferences.push(alter);
    }
  });

  // @ts-ignore
  const weightFn = createEdgeWeightFunction(clonedVicinity);

  // @ts-ignore
  clonedVicinity.vicinitySharedStreetsReferences.forEach((sref: any) => {
    const id = sref.properties.shstReferenceId;
    const len = sref.properties.shstReferenceLength;

    // @ts-ignore
    const weight = weightFn({ name: id });

    console.log(id, len, weight);

    t.assert(weight > len);
    t.assert(weight < 2 * len);
  });

  t.end();
});
