/* eslint-disable no-restricted-syntax */

/*
  https://github.com/naturalatlas/node-gdal/blob/d25c9fbae845779beecc20ddcef8b4e64f27fc6e/lib/gdal.js#L609-L630
*/

import fs from 'fs';
import { join } from 'path';

import * as turf from '@turf/turf';
import gdal from 'gdal';
import _ from 'lodash';

import { sync as mkdirpSync } from 'mkdirp';
import { sync as rimrafSync } from 'rimraf';

import {
  SharedStreetsReferenceFeature,
  TargetMapSchema,
  TargetMapPathId,
} from '../domain/types';

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import TargetMapPathVicinity from '../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

const vicinityLayerDefinitionFileTemplate = fs
  .readFileSync(join(__dirname, './vicinityLayerDefinitionFileTemplate.qlr'))
  .toString();

// @ts-ignore
const wgs84 = gdal.SpatialReference.fromEPSG(4326);

type gdalOFTType = string;

const addFieldToLayer = (layer: gdal.Layer, name: string, type: gdalOFTType) =>
  layer.fields.add(new gdal.FieldDefn(name, type));

const addShstReferencesLineLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  shstReferences: SharedStreetsReferenceFeature[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.LineString);

  const fieldDefinitionPairs = [['shst_ref', gdal.OFTString]];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const shstRef of shstReferences) {
    const gdalFeature = new gdal.Feature(layer);

    gdalFeature.fields.set('shst_ref', shstRef.id);

    const lineString = new gdal.LineString();

    turf
      .getCoords(shstRef)
      .forEach(([lon, lat]) => lineString.points.add(new gdal.Point(lon, lat)));

    gdalFeature.setGeometry(lineString);

    layer.features.add(gdalFeature);
  }
};

const addShstReferencesPointLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  shstReferences: SharedStreetsReferenceFeature[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.Point);

  const fieldDefinitionPairs = [
    ['shst_ref', gdal.OFTString],
    ['is_startpt', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const shstRef of shstReferences) {
    const shstMatchCoords = _(turf.getCoords(shstRef))
      .flattenDeep()
      .chunk(2)
      .value();

    for (let i = 0; i <= 1; ++i) {
      const coord =
        i === 0 ? _.first(shstMatchCoords) : _.last(shstMatchCoords);

      const gdalFeature = new gdal.Feature(layer);

      gdalFeature.fields.set(
        'shst_ref',
        // @ts-ignore
        shstRef.id,
      );

      gdalFeature.fields.set('is_startpt', +(i === 0));

      // @ts-ignore
      const point = new gdal.Point(coord[0], coord[1]);

      gdalFeature.setGeometry(point);
      layer.features.add(gdalFeature);
    }
  }
};

const addShstReferencesLayers = (
  dataset: gdal.Dataset,
  layerName: string,
  shstReferences: SharedStreetsReferenceFeature[],
) => {
  addShstReferencesLineLayer(dataset, layerName, shstReferences);
  addShstReferencesPointLayer(dataset, `${layerName}_endpts`, shstReferences);
};

const addTargetMapEdgesLineLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  targetMapEdges: turf.Feature<turf.LineString | turf.MultiLineString>[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.LineString);

  const fieldDefinitionPairs = [
    ['tm_id', gdal.OFTString],
    ['tm_edge_id', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const targetMapPathEdge of targetMapEdges) {
    const gdalFeature = new gdal.Feature(layer);

    // @ts-ignore
    gdalFeature.fields.set('tm_id', targetMapPathEdge.properties.targetMapId);
    gdalFeature.fields.set('tm_edge_id', targetMapPathEdge.id);

    const multiLS = new gdal.MultiLineString();

    let geoms = turf.getCoords(targetMapPathEdge);

    if (!Array.isArray(geoms[0][0])) {
      geoms = [geoms];
    }

    for (let i = 0; i < geoms.length; ++i) {
      const geom = geoms[i];

      const lineString = new gdal.LineString();

      for (let j = 0; j < geom.length; ++j) {
        const [lon, lat] = geom[j];

        lineString.points.add(new gdal.Point(lon, lat));
      }

      multiLS.children.add(lineString);
    }

    gdalFeature.setGeometry(multiLS);

    layer.features.add(gdalFeature);
  }
};

const addTargetMapEdgesPointLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  targetMapEdges: turf.Feature<turf.LineString | turf.MultiLineString>[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.Point);

  const fieldDefinitionPairs = [
    ['tm_id', gdal.OFTString],
    ['tm_edge_id', gdal.OFTInteger],
    ['geom_num', gdal.OFTInteger],
    ['is_startpt', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const targetMapPathEdge of targetMapEdges) {
    let multiCoords = turf.getCoords(targetMapPathEdge);

    if (!Array.isArray(multiCoords[0][0])) {
      multiCoords = [multiCoords];
    }

    // We iterate over each Coords Array of the MultiLineString
    for (let geomNum = 0; geomNum < multiCoords.length; ++geomNum) {
      const coords = _(multiCoords[geomNum]).flattenDeep().chunk(2).value();

      for (let i = 0; i <= 1; ++i) {
        const coord = i === 0 ? _.first(coords) : _.last(coords);

        const gdalFeature = new gdal.Feature(layer);

        // @ts-ignore
        gdalFeature.fields.set(
          'tm_id',
          // @ts-ignore
          targetMapPathEdge.properties.targetMapId,
        );
        gdalFeature.fields.set('tm_edge_id', targetMapPathEdge.id);

        gdalFeature.fields.set('geom_num', geomNum);

        gdalFeature.fields.set('is_startpt', +(i === 0));

        // @ts-ignore
        const point = new gdal.Point(coord[0], coord[1]);

        gdalFeature.setGeometry(point);
        layer.features.add(gdalFeature);
      }
    }
  }
};

const addTargetMapEdgesLayers = (
  dataset: gdal.Dataset,
  layerName: string,
  targetMapEdges: turf.Feature<turf.LineString | turf.MultiLineString>[],
) => {
  addTargetMapEdgesLineLayer(dataset, layerName, targetMapEdges);
  addTargetMapEdgesPointLayer(dataset, `${layerName}_endpts`, targetMapEdges);
};

const addShstMatchesLineLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  shstMatches: turf.Feature<turf.LineString>[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.LineString);

  const fieldDefinitionPairs = [
    ['shst_ref', gdal.OFTString],
    ['match_id', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const shstMatch of shstMatches) {
    try {
      const gdalFeature = new gdal.Feature(layer);

      // FIXME: Why is TypeScript complaining?
      // @ts-ignore
      gdalFeature.fields.set('shst_ref', shstMatch.properties.shstReferenceId);
      gdalFeature.fields.set('match_id', shstMatch.id);

      const lineString = new gdal.LineString();

      turf
        .getCoords(shstMatch)
        .forEach(([lon, lat]) =>
          lineString.points.add(new gdal.Point(lon, lat)),
        );

      gdalFeature.setGeometry(lineString);

      layer.features.add(gdalFeature);
    } catch (err) {
      console.error(err);
      console.log(JSON.stringify({ layerName, shstMatches }, null, 4));
      process.exit(1);
    }
  }
};

const addShstMatchesPointLayer = (
  dataset: gdal.Dataset,
  layerName: string,
  shstMatches: turf.Feature<turf.LineString>[],
) => {
  // @ts-ignore
  const layer = dataset.layers.create(layerName, wgs84, gdal.Point);

  const fieldDefinitionPairs = [
    ['shst_ref', gdal.OFTString],
    ['match_id', gdal.OFTInteger],
    ['is_startpt', gdal.OFTInteger],
  ];

  for (const [name, type] of fieldDefinitionPairs) {
    addFieldToLayer(layer, name, type);
  }

  for (const shstMatch of shstMatches) {
    try {
      const shstMatchCoords = _(turf.getCoords(shstMatch))
        .flattenDeep()
        .chunk(2)
        .value();

      for (let i = 0; i <= 1; ++i) {
        const coord =
          i === 0 ? _.first(shstMatchCoords) : _.last(shstMatchCoords);

        const gdalFeature = new gdal.Feature(layer);

        gdalFeature.fields.set(
          'shst_ref',
          // @ts-ignore
          shstMatch.properties.shstReferenceId,
        );
        gdalFeature.fields.set('match_id', shstMatch.id);
        gdalFeature.fields.set('is_startpt', +(i === 0));

        // @ts-ignore
        const point = new gdal.Point(coord[0], coord[1]);

        gdalFeature.setGeometry(point);
        layer.features.add(gdalFeature);
      }
    } catch (err) {
      console.error(err);
      console.log(JSON.stringify({ layerName, shstMatches }, null, 4));
      process.exit(1);
    }
  }
};

const addShstMatchesLayers = (
  dataset: gdal.Dataset,
  layerName: string,
  shstMatches: turf.Feature<turf.LineString>[],
) => {
  addShstMatchesLineLayer(dataset, layerName, shstMatches);
  addShstMatchesPointLayer(dataset, `${layerName}_endpts`, shstMatches);
};

export default function outputPathVicinityShapefile({
  targetMap,
  targetMapPathId,
  shpfileDir,
}: {
  targetMap: TargetMapSchema;
  targetMapPathId: TargetMapPathId;
  shpfileDir: string;
}) {
  const bbDao = new TargetMapConflationBlackboardDao(targetMap);

  const vicinity = new TargetMapPathVicinity(bbDao, targetMapPathId);

  const {
    vicinitySharedStreetsReferences,
    targetMapPathEdges,
    nearbyTargetMapEdges,
    targetMapPathShstMatches,
    nearbyTargetMapEdgesShstMatches,
    sharedStreetsMatchedReferences,
  } = vicinity.vicinity;

  // console.log(JSON.stringify({ nearbyTargetMapEdges }, null, 4));

  if (!Number.isFinite(targetMapPathId)) {
    throw new Error(`Invalid targetMapPathId: ${targetMapPathId}`);
  }

  const outputDir = join(shpfileDir, `targetMapPath_${targetMapPathId}`);

  console.log(outputDir);

  rimrafSync(outputDir);
  mkdirpSync(outputDir);

  const dataset = gdal.open(outputDir, 'w', 'ESRI Shapefile');

  addTargetMapEdgesLayers(dataset, 'target_map_path', targetMapPathEdges);
  addTargetMapEdgesLayers(
    dataset,
    'nearby_target_map_edges',
    nearbyTargetMapEdges,
  );

  addShstReferencesLayers(
    dataset,
    'vicinity_shst_refs',
    vicinitySharedStreetsReferences,
  );
  addShstReferencesLayers(
    dataset,
    'tmpath_shst_matched_refs',
    sharedStreetsMatchedReferences,
  );

  addShstMatchesLayers(dataset, 'path_edge_matches', targetMapPathShstMatches);
  addShstMatchesLayers(
    dataset,
    'nearby_edge_matches',
    nearbyTargetMapEdgesShstMatches,
  );

  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;

  dataset.layers.forEach((layer) =>
    // @ts-ignore
    _(JSON.parse(layer.getExtent().toPolygon().toJSON()).coordinates)
      .flattenDeep()
      .chunk(2)
      .forEach(([x, y]) => {
        if (x < xMin) {
          xMin = x;
        }
        if (x > xMax) {
          xMax = x;
        }
        if (y < yMin) {
          yMin = y;
        }
        if (y > yMax) {
          yMax = y;
        }
      }),
  );

  const vicinityLayerDefinitionFile = vicinityLayerDefinitionFileTemplate
    .replace(
      /__TMPATH_VICINITY__/g,
      `TargetMapPath ${targetMapPathId} TargetMapPathVicinity`,
    )
    .replace(/__SHAPEFILE_DIR__/g, outputDir)
    .replace(/__XMIN__/g, `${xMin}`)
    .replace(/__XMAX__/g, `${xMax}`)
    .replace(/__YMIN__/g, `${yMin}`)
    .replace(/__YMAX__/g, `${yMax}`);

  fs.writeFileSync(
    join(outputDir, 'layerDefinitionFile.qlr'),
    vicinityLayerDefinitionFile,
  );

  dataset.close();
}
