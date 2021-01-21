/* eslint-disable import/no-extraneous-dependencies */

import {existsSync} from 'fs';
import {join, isAbsolute} from 'path';

import restify from 'restify';
import corsMiddleware from 'restify-cors-middleware';

import NpmrdsController from './controllers/NpmrdsController';
import NysRisController from './controllers/NysRisController';
import * as SharedStreetsController from './controllers/SharedStreetsController';

import db from '../../src/services/DbService';

const PORT = process.env.PORT || 8080;

const outputDir = process.env.OUTPUT_DIR || join(__dirname, '../output');

const outputDirAbsolute = isAbsolute(outputDir)
  ? outputDir
  : join(process.cwd(), outputDir);

if (!existsSync(outputDirAbsolute)) {
  console.error(
    `Conflation output directory ${outputDirAbsolute} does not exist.`,
  );
  process.exit(1);
}

console.log(outputDirAbsolute);

db.setOutputDirectory(outputDirAbsolute);

const server = restify.createServer();

// https://www.npmjs.com/package/restify-cors-middleware#usage
// @ts-ignore
const cors = corsMiddleware({
  origins: ['*'],
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.queryParser());
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());

const targetMapControllers = {
  npmrds: NpmrdsController,
  'nys-ris': NysRisController,
};

server.get('/shst/shst-references', (req, res, next) => {
  try {
    const {
      query: {id},
    } = req;

    const ids = Array.isArray(id) ? id : [id];

    const featureCollection = SharedStreetsController.getShstReferences(ids);

    res.send(featureCollection);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/shst/metadata', (req, res, next) => {
  try {
    const {
      query: {id},
    } = req;

    const ids = Array.isArray(id) ? id : [id];

    const featureCollection = SharedStreetsController.getShstMetadata(ids);

    res.send(featureCollection);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/shared-streets/shst-references', (req, res, next) => {
  try {
    const {
      query: {id},
    } = req;

    const ids = Array.isArray(id) ? id : [id];

    const featureCollection = SharedStreetsController.getShstReferences(ids);

    res.send(featureCollection);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/:targetMap/raw-shapefile', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const controller = targetMapControllers[targetMap];
    const featureCollection = controller.getRawTargetMapFeatureCollection();

    res.send(featureCollection);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/:targetMap/features', (req, res, next) => {
  try {
    const {
      params: {targetMap},
      query: {id},
    } = req;

    const ids = Array.isArray(id) ? id : [id];

    const controller = targetMapControllers[targetMap];
    const featureCollection = controller.getFeatures(ids);

    res.send(featureCollection);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/:targetMap/shst-matches-metadata', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const controller = targetMapControllers[targetMap];

    const metadata = controller.getShstMatchesMetadata();
    res.send(metadata);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.get('/:targetMap/shst-chosen-matches', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const controller = targetMapControllers[targetMap];
    const result = controller.getShstChosenMatchesMetadata();

    res.send(result);

    return next();
  } catch (err) {
    return next(err);
  }
});

server.listen(PORT, function main() {
  console.log('%s listening at %s', server.name, server.url);
});
