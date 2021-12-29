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
  const osmNodesIterator = pEvent.iterator(osmElementEmitter, ['node']);
  const osmWaysIterator = pEvent.iterator(osmElementEmitter, ['way']);

  // @ts-ignore
  OsmDao.bulkLoadOsmNodesAsync(osmNodesIterator);
  // @ts-ignore
  OsmDao.bulkLoadOsmWaysAsync(osmWaysIterator);

  let nodeCt = 0;
  let wayCt = 0;

  function emitNode({ id, lat, lon, tags }) {
    ++nodeCt;
    osmElementEmitter.emit('node', { id, coord: [lon, lat], tags });
  }

  function emitWay({ id, refs: nodeIds, tags }) {
    ++wayCt;
    osmElementEmitter.emit('way', { id, nodeIds, tags });
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
      });

      next();
    }),
    (err) => {
      console.log('Nodes:', nodeCt, ', Ways:', wayCt);

      if (err) {
        return osmElementEmitter.emit('error', err);
      }

      osmElementEmitter.emit('done');

      return OsmDao.loadOsmWayNodeIdsTable();
    },
  );
};

export default main;
