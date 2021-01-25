/* eslint-disable no-restricted-syntax */
import {v4 as uuidv4} from 'uuid';

// import { Server, Request, Response, Next } from 'restify';

import * as turf from '@turf/turf';

import TargetMapDAO from '../../../../src/utils/TargetMapDatabases/TargetMapDAO';
import TargetMapConflationBlackboardDao from '../../../../src/services/Conflation/TargetMapConflationBlackboardDao';

import UIControlledSharedStreetsMatchRunner, {UIControlledSharedStreetsMatchRunnerConfig} from '../../services/ShstMatcher/UIControlledSharedStreetsMatchRunner';

// function bindRouteHandlers(server: Server) {
// const controller = this;
// const { schema } = controller;

// server.get.call(
// server,
// `/${this.schema}/raw-shapefile`,
// (_req: Request, res: Response, next: Next) => {
// try {
// const featureCollection = controller.getRawTargetMapFeatureCollection();

// res.send(featureCollection);

// return next();
// } catch (err) {
// return next(err);
// }
// },
// );

// server.get.call(
// server,
// `/${this.schema}/features`,
// (req: Request, res: Response, next: Next) => {
// try {
// const {
// query: { id },
// } = req;

// const ids = Array.isArray(id) ? id : [id];

// const featureCollection = controller.getFeatures(ids);

// res.send(featureCollection);

// return next();
// } catch (err) {
// return next(err);
// }
// },
// );

// server.get.call(
// server,
// `/${schema}/shst-matches-metadata`,
// (_req: Request, res: Response, next: Next) => {
// try {
// const metadata = controller.getShstMatchesMetadata();
// res.send(metadata);

// console.log(JSON.stringify(metadata, null, 4));

// return next();
// } catch (err) {
// return next(err);
// }
// },
// );

// server.get.call(
// server,
// `/${schema}/shst-chosen-matches`,
// (_req: Request, res: Response, next: Next) => {
// try {
// const result = controller.getShstChosenMatchesMetadata();

// res.send(result);

// return next();
// } catch (err) {
// return next(err);
// }
// },
// );
// }

class TargetMapController {
  private targetMapDao: TargetMapDAO;

  private lazy: {
    targetMapConflationBlackboardDao?: TargetMapConflationBlackboardDao;
  };

  schema: string;

  constructor(schema: string) {
    this.schema = schema;
    this.targetMapDao = new TargetMapDAO(null, this.schema);

    this.lazy = {};
  }

  // registerRoutes(server: Server) {
  // bindRouteHandlers.call(this, server);
  // }

  // Because this needs to happen after everything loaded.
  private get blackboardDao() {
    this.lazy.targetMapConflationBlackboardDao =
      this.lazy.targetMapConflationBlackboardDao ||
      new TargetMapConflationBlackboardDao(this.schema);

    return this.lazy.targetMapConflationBlackboardDao;
  }

  getRawTargetMapFeatureCollection() {
    const allRawTargetMapFeatures = [
      ...this.targetMapDao.makeRawEdgeFeaturesIterator(),
    ];

    return turf.featureCollection(allRawTargetMapFeatures);
  }

  getFeatures(ids: string[]) {
    const rawTargetMapFeatures = this.targetMapDao.getRawEdgeFeatures(ids);

    return turf.featureCollection(rawTargetMapFeatures);
  }

  getShstMatchesMetadata() {
    const matchesMetadataIter = this.blackboardDao.makeShstMatchMetadataByTargetMapIdIterator();

    const response = {};

    for (const {targetMapId, shstMatchesMetadata} of matchesMetadataIter) {
      response[targetMapId] = shstMatchesMetadata;
    }

    return response;
  }

  getShstChosenMatchesMetadata() {
    const chosenMatchesIter = this.targetMapDao.makeChosenShstMatchesIterator();

    const response = {};

    for (const chosenMatch of chosenMatchesIter) {
      const {
        targetMapId,
        shstReferenceId,
        isForward,
        sectionStart,
        sectionEnd,
      } = chosenMatch;

      response[targetMapId] = response[targetMapId] || [];

      response[targetMapId].push({
        shst_reference: shstReferenceId,
        isForward,
        shst_ref_start: sectionStart,
        shst_ref_end: sectionEnd,
      });
    }

    return response;
  }

  runShstMatch(config: UIControlledSharedStreetsMatchRunnerConfig) {
    const uuid = uuidv4();

    const runner = new UIControlledSharedStreetsMatchRunner(
      this.blackboardDao,
      uuid,
      config
    );

    runner.runShstMatch();

    return uuid;
  }
}

export default TargetMapController;
