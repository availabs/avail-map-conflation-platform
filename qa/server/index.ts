import restify from 'restify';
import corsMiddleware from 'restify-cors-middleware';

import socketio from 'socket.io';

import EventBus from './services/EventBus';

import NpmrdsController from './controllers/NpmrdsController';
import NysRisController from './controllers/NysRisController';
import * as SharedStreetsController from './controllers/SharedStreetsController';
import ConflationMapController from './controllers/ConflationMapController'

const PORT = process.env.PORT || 8080;

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

// http://restify.com/docs/home/#socketio
const socketServer = new socketio.Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

socketServer.listen(server.server);

EventBus.injectSocketServer(socketServer);

socketServer.sockets.on('connection', socket => {
  socket.onAny((event: string, action: any) => {
    EventBus.emitAction(event, action)
  })
})


const targetMapControllers = {
  npmrds: NpmrdsController,
  nys_ris: NysRisController,
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
    console.error(err)
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
    console.error(err)
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
    console.error(err)
    return next(err);
  }
});

server.get('/:targetMap/raw-shapefile-properties', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const controller = targetMapControllers[targetMap];
    const rawTargetMapFeatureProperties = controller.getRawTargetMapFeatureProperties();

    res.send(rawTargetMapFeatureProperties);

    return next();
  } catch (err) {
    console.error(err)
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
    console.error(err)
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
    console.error(err)
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
    console.error(err)
    return next(err);
  }
});

server.post('/:targetMap/run-shst-matcher', (req, res, next) => {
  try {
    const {targetMap} = req.params;
    const config = req.body

    const controller = targetMapControllers[targetMap];
    const uuid = controller.runShstMatch(config);

    res.send(uuid);

    return next();
  } catch (err) {
    console.error(err)
    return next(err);
  }
});

server.get('/:targetMap/target-map-path-vicinity/:targetMapPathId', (req, res, next) => {
  try {
    const {targetMap, targetMapPathId} = req.params;

    const vicinity = targetMapControllers[targetMap].getTargetMapPathVicinity(targetMapPathId);

    res.send(vicinity)

    return next();
  } catch (err) {
    console.error(err)
    return next(err);
  }
});

server.get('/:targetMap/conflation-mappings', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const mappings = ConflationMapController.getConflationMappings(targetMap)

    res.send(mappings)

    return next();
  } catch (err) {
    console.error(err)
    return next(err);
  }
});

server.get('/:targetMap/conflation-metrics', (req, res, next) => {
  try {
    const {targetMap} = req.params;

    const metrics = ConflationMapController.getConflationMetrics(targetMap)

    res.send(metrics)

    return next();
  } catch (err) {
    console.error(err)
    return next(err);
  }
});


server.listen(PORT, function main() {
  console.log('%s listening at %s', server.name, server.url);
});
