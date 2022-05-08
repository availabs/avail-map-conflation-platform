import { EventEmitter } from 'events';
import { existsSync, createReadStream } from 'fs';
import { pipeline } from 'stream';

import parseOsm from 'osm-pbf-parser';

import through from 'through2';

import pEvent from 'p-event';

import OsmDao from '..';

import getExpectedOsmVersionPbfPath from '../utils/getExpectedOsmVersionPbfPath';

import { OsmVersion } from '../domain/types';

const main = async ({ osm_version }: { osm_version: OsmVersion }) => {
  const osmPbfPath = getExpectedOsmVersionPbfPath(osm_version);

  if (!existsSync(osmPbfPath)) {
    throw new Error(`${osmPbfPath} does not exist`);
  }

  OsmDao.initializeDatabase();

  OsmDao.setOsmVersion(osm_version);

  const osmElementEmitter = new EventEmitter();
  const osmNodesIterator = pEvent.iterator(osmElementEmitter, ['node'], {
    resolutionEvents: ['done'],
  });
  const osmWaysIterator = pEvent.iterator(osmElementEmitter, ['way'], {
    resolutionEvents: ['done'],
  });
  const osmRelationsIterator = pEvent.iterator(
    osmElementEmitter,
    ['relation'],
    { resolutionEvents: ['done'] },
  );

  // @ts-ignore
  const nodesLoadDone = OsmDao.bulkLoadOsmNodesAsync(osmNodesIterator);
  // @ts-ignore
  const wayLoadDone = OsmDao.bulkLoadOsmWaysAsync(osmWaysIterator);
  // @ts-ignore
  const relationsLoadDone =
    OsmDao.bulkLoadOsmRelationsAsync(osmRelationsIterator);

  let nodeCt = 0;
  let wayCt = 0;
  let relationsCt = 0;

  function emitNode({ id, lat, lon, tags }) {
    ++nodeCt;
    osmElementEmitter.emit('node', { id, coord: [lon, lat], tags });
  }

  function emitWay({ id, refs: nodeIds, tags }) {
    ++wayCt;
    osmElementEmitter.emit('way', { id, nodeIds, tags });
  }

  function emitRelation({ id, tags, members }) {
    ++relationsCt;
    osmElementEmitter.emit('relation', { id, tags, members });
  }

  pipeline(
    createReadStream(osmPbfPath),
    parseOsm(),
    through.obj(function a(items, _enc, next) {
      items.forEach(function b(item: any) {
        if (item.type === 'node') {
          emitNode(item);
        }

        if (item.type === 'way') {
          emitWay(item);
        }

        if (item.type === 'relation') {
          emitRelation(item);
        }
      });

      next();
    }),
    async (err) => {
      console.log(
        'Nodes:',
        nodeCt,
        ', Ways:',
        wayCt,
        'Relations:',
        relationsCt,
      );

      if (err) {
        return osmElementEmitter.emit('error', err);
      }

      osmElementEmitter.emit('done');

      await Promise.all([nodesLoadDone, wayLoadDone, relationsLoadDone]);

      return OsmDao.finalizeDatabase();
    },
  );
};

export default main;
