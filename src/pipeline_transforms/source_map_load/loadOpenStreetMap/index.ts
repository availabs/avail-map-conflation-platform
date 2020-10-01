// https://wiki.openstreetmap.org/wiki/Way#Examples
//   The nodes defining the geometry of the way are enumerated in the correct order,
//     and indicated only by reference using their unique identifier.
//   These nodes must have been already defined separately with their coordinates.

import { EventEmitter } from 'events';
import { createReadStream, existsSync } from 'fs';

import XmlStream from 'xml-stream';
import FileType from 'file-type';

import { loadOpenStreetMaps } from '../../../daos/SourceMapDao/index';

const main = async (osm_xml: string) => {
  if (!existsSync(osm_xml)) {
    throw new Error(`${osm_xml} does not exist`);
  } else if ((await FileType.fromFile(osm_xml))?.mime !== 'application/xml') {
    throw new Error(`${osm_xml} is not an XML file.`);
  }

  let streamClosed: any;
  let streamError: any;

  const sentinel = new Promise((resolve, reject) => {
    streamClosed = resolve;
    streamError = reject;
  });

  const osmElementEmitter = new EventEmitter();
  loadOpenStreetMaps(osmElementEmitter);

  try {
    const xml = new XmlStream(
      createReadStream(osm_xml)
        .on('close', streamClosed)
        .on('error', streamError),
    );

    xml.collect('node tag');
    xml.on('endElement: node', (d: any) => {
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
        osmNodeId: +osmNodeId,
        lat: +lat,
        lon: +lon,
        tags,
      });
    });

    xml.collect('way nd');
    xml.collect('way tag');
    xml.on('endElement: way', (d: any) => {
      const {
        $: { id: osmWayId },
        nd,
        tag,
      } = d;

      const nodeIds = Array.isArray(nd)
        ? nd.map(({ $: { ref } }) => +ref)
        : null;

      const tags = Array.isArray(tag)
        ? tag.reduce((acc, { $: { k, v } }) => {
            acc[k] = v;
            return acc;
          }, {})
        : null;

      osmElementEmitter.emit('way', { osmWayId, nodeIds, tags });
    });

    xml.on('end', () => osmElementEmitter.emit('done'));

    await sentinel;
  } catch (err) {
    osmElementEmitter.emit('error', err);
    console.error(err);
  }
};

export default main;
