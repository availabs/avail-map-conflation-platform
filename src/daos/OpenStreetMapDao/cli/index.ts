// https://wiki.openstreetmap.org/wiki/Way#Examples
//   The nodes defining the geometry of the way are enumerated in the correct order,
//     and indicated only by reference using their unique identifier.
//   These nodes must have been already defined separately with their coordinates.

import { EventEmitter } from 'events';
import { createReadStream, existsSync } from 'fs';

// @ts-ignore
import XmlStream from 'xml-stream';
import FileType from 'file-type';

import pEvent from 'p-event';

import OsmDao from '..';

const main = async ({ osm_xml }: { osm_xml: string }) => {
  if (!existsSync(osm_xml)) {
    throw new Error(`${osm_xml} does not exist`);
  } else if ((await FileType.fromFile(osm_xml))?.mime !== 'application/xml') {
    throw new Error(`${osm_xml} is not an XML file.`);
  }

  OsmDao.initializeDatabase();

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
    const xml = new XmlStream(
      createReadStream(osm_xml)
        .on('close', streamClosed)
        .on('error', streamError),
    );

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
