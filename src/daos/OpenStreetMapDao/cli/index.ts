// https://wiki.openstreetmap.org/wiki/Way#Examples
//   The nodes defining the geometry of the way are enumerated in the correct order,
//     and indicated only by reference using their unique identifier.
//   These nodes must have been already defined separately with their coordinates.

import { EventEmitter } from 'events';
import { createReadStream, existsSync } from 'fs';
import { pipeline } from 'stream';
import zlib from 'zlib';

// @ts-ignore
import XmlStream from 'xml-stream';

import pEvent from 'p-event';

import OsmDao from '..';

import { OsmVersion } from '../domain/types';

const main = async ({ osm_version }: { osm_version: OsmVersion }) => {
  const osm_xml_gz = OsmDao.getExpectedOsmXmlGzFilePath(osm_version);

  if (!existsSync(osm_xml_gz)) {
    throw new Error(`${osm_xml_gz} does not exist`);
  }

  OsmDao.initializeDatabase();

  OsmDao.setOsmVersion(osm_version);

  let streamClosed: any;
  let streamError: any;

  const sentinel = new Promise((resolve, reject) => {
    streamClosed = resolve;
    streamError = reject;
  });

  const osmElementEmitter = new EventEmitter();
  const osmNodesIterator = pEvent.iterator(osmElementEmitter, ['node']);
  const osmWaysIterator = pEvent.iterator(osmElementEmitter, ['way']);

  // @ts-ignore
  OsmDao.bulkLoadOsmNodesAsync(osmNodesIterator);
  // @ts-ignore
  OsmDao.bulkLoadOsmWaysAsync(osmWaysIterator);

  try {
    const osmStream = pipeline(
      createReadStream(osm_xml_gz),
      zlib.createGunzip(),
      (err) => {
        if (err) {
          return streamError(err);
        }

        return streamClosed();
      },
    );

    const xml = new XmlStream(osmStream);

    let nodeCt = 0;
    let wayCt = 0;

    xml.collect('node tag');
    xml.on('endElement: node', (d: any) => {
      ++nodeCt;

      const {
        $: { id: osmNodeId, lat, lon },
        tag,
      } = d;

      const tags = Array.isArray(tag)
        ? tag.reduce((acc, { $: { k, v } }) => {
            acc[k] = v;
            return acc;
          }, {})
        : null;

      osmElementEmitter.emit('node', {
        id: +osmNodeId,
        coord: [+lon, +lat],
        tags,
      });
    });

    xml.collect('way nd');
    xml.collect('way tag');
    xml.on('endElement: way', (d: any) => {
      ++wayCt;

      const {
        $: { id: osmWayId },
        nd,
        tag,
      } = d;

      const osmNodeIds = Array.isArray(nd)
        ? nd.map(({ $: { ref } }) => +ref)
        : null;

      const tags = Array.isArray(tag)
        ? tag.reduce((acc, { $: { k, v } }) => {
            acc[k] = v;
            return acc;
          }, {})
        : null;

      osmElementEmitter.emit('way', { id: +osmWayId, osmNodeIds, tags });
    });

    xml.on('end', () => osmElementEmitter.emit('done'));

    await sentinel;

    console.log('Nodes:', nodeCt, ', Ways:', wayCt);

    OsmDao.finalizeDatabase();
  } catch (err) {
    osmElementEmitter.emit('error', err);
    console.error(err);
  }
};

export default main;
