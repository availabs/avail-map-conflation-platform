/* eslint-disable import/no-extraneous-dependencies */

import { existsSync } from 'fs';
import { join, isAbsolute } from 'path';

import restify from 'restify';
import corsMiddleware from 'restify-cors-middleware';

import * as NpmrdsController from './controllers/NpmrdsController';

import db from '../src/services/DbService';

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

db.setOutputDirectory(outputDirAbsolute);

const server = restify.createServer();

// https://www.npmjs.com/package/restify-cors-middleware#usage
// @ts-ignore
const cors = corsMiddleware({
  origins: ['*'],
});

server.pre(cors.preflight);
server.use(cors.actual);
server.use(restify.plugins.bodyParser());
server.use(restify.plugins.gzipResponse());

server.get('/npmrds/raw-shapefile', (_req, res, next) => {
  const featureCollection = NpmrdsController.getRawTargetMapFeatureCollection();

  res.send(featureCollection);

  next();
});

server.get('/npmrds/shst-matches-metadata', (_req, res, next) => {
  const featureCollection = NpmrdsController.getShstMatchesMetadata();

  res.send(featureCollection);

  next();
});

server.listen(PORT, function main() {
  console.log('%s listening at %s', server.name, server.url);
});
