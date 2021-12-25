/* eslint-disable no-restricted-syntax */

import * as turf from '@turf/turf'
import _ from 'lodash'

import EventBus, {EventBusActionHandler} from '../EventBus';

import {makeShstMatchesIterator} from '../../../../src/services/Conflation/TargetMapConflationKnowlegeSources/SharedStreets/SharedStreetsMatcher';

import TargetMapConflationBlackboardDao from '../../../../src/services/Conflation/TargetMapConflationBlackboardDao';
import {TargetMapEdgeId, QueryPolygon} from '../../../../src/services/Conflation/domain/types';

const getUnixTimestamp = () => _.round(Date.now() / 1000)

enum Iterators {
  TARGET_MAP_EDGE = 'TARGET_MAP_EDGE',
  SHST_MATCH = 'SHST_MATCH'
}

export type UIControlledSharedStreetsMatchRunnerConfig = {
  flags?: string[] | null;
  edgeIds?: TargetMapEdgeId[] | null;
  queryPolygon?: QueryPolygon | null;
}

export default class UIControlledSharedStreetsMatchRunner {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;
  private readonly uuid: string;

  // @ts-ignore
  private _isLocked: boolean;

  private boundActionHandler: EventBusActionHandler;
  private previousHeartbeatTimestamp: number;
  private heartbeatMonitor: any;

  private readonly flags: string[];
  private readonly edgeIds: TargetMapEdgeId[] | null
  private readonly queryPolygon: QueryPolygon | null

  private controls: {
    lock: Promise<void> | null;
    releaseLock: Function | null;
    halt: boolean;
  };

  private activeIterator: Iterators

  constructor(blkbrdDao: TargetMapConflationBlackboardDao, uuid: string, config: UIControlledSharedStreetsMatchRunnerConfig) {
    this.blkbrdDao = blkbrdDao;
    this.uuid = uuid;
    this.controls = {
      lock: null,
      releaseLock: null,
      halt: false,
    };

    this.flags = config.flags ?? []
    this.edgeIds = config.edgeIds ?? null
    this.queryPolygon = config.queryPolygon ?? null

    this.lock()

    this.boundActionHandler = this.actionHandler.bind(this);

    this.previousHeartbeatTimestamp = getUnixTimestamp()

    this.activeIterator = null

    this.heartbeatMonitor = setInterval(() => {
      const currentHearbeatTimestamp = getUnixTimestamp()
      if (currentHearbeatTimestamp - this.previousHeartbeatTimestamp > 5) {
        console.log('HEARTBEAT duration > 5 seconds')
        return this.halt()
      }
    }, 2500)

    EventBus.on(this.uuid, this.boundActionHandler);
  }

  get isLocked() {
    return this._isLocked
  }

  private lock() {
    if (this.controls.lock) {
      return
    }

    this._isLocked = true

    this.controls.lock = new Promise((resolve) => {
      this.controls.releaseLock = resolve
      this._isLocked = false
    })
  }

  private unlock() {
    if (!this.controls.lock) {
      return
    }

    // @ts-ignore
    this.controls.releaseLock()
    this.controls.lock = null
  }

  private get lockIsReleased() {
    return this.controls.lock
  }

  private halt() {
    clearInterval(this.heartbeatMonitor)
    EventBus.off(this.uuid, this.boundActionHandler);

    this.controls.halt = true;
    this.unlock(); // proceed to halt
  }

  private get done() {
    return this.controls.halt
  }

  actionHandler(action: any) {
    // console.log(JSON.stringify(action, null, 4))

    if (action.type === 'PROCEED') {
      this.unlock();
    }

    if (action.type === 'PAUSE') {
      this.lock();
    }

    if (action.type === 'HALT') {
      this.halt();
    }

    if (action.type === 'HEARTBEAT') {
      this.previousHeartbeatTimestamp = getUnixTimestamp()
    }
  }

  private setActiveIterator(iterator: Iterators) {
    if (this.activeIterator === Iterators.SHST_MATCH && iterator === Iterators.TARGET_MAP_EDGE) {

      EventBus.emitAction(this.uuid, {
        type: 'SHST_MATCHER_BATCH_DONE',
      });
    }

    this.activeIterator = iterator
  }

  *makeInputIterator() {
    const targetMapEdgesGeoProximityIterator = this.blkbrdDao.makeTargetMapEdgeFeaturesGeoProximityIterator({
      edgeIds: this.edgeIds,
      boundingPolygon: this.queryPolygon,
    });

    const edges = []
    for (const targetMapEdge of targetMapEdgesGeoProximityIterator) {
      this.setActiveIterator(Iterators.TARGET_MAP_EDGE);

      edges.push(targetMapEdge)

      EventBus.emitAction(this.uuid, {
        type: 'TARGET_MAP_EDGE_ID',
        payload: {
          targetMapEdgeId: targetMapEdge.id,
        }
      });

      yield targetMapEdge;
    }

    require('fs').writeFileSync('labVicinityTMEdges.geojson', JSON.stringify(turf.featureCollection(edges)))

    EventBus.emitAction(this.uuid, {
      type: 'TARGET_MAP_EDGE_ITERATOR_DONE',
    });
  }

  async runShstMatch() {
    await this.lockIsReleased
    if (this.done) {
      console.log('DONE')
      return
    }

    const isCenterline = this.blkbrdDao.targetMapIsCenterline;

    const shstMatchesIter = makeShstMatchesIterator(this.makeInputIterator(), {
      centerline: isCenterline,
      flags: this.flags
    });

    const shstMatches = []
    for await (const {matchFeature} of shstMatchesIter) {
      this.setActiveIterator(Iterators.SHST_MATCH);

      shstMatches.push(matchFeature)

      if (this.done) {
        break;
      }

      const {
        properties: {
          shstReferenceId: shst_reference,
          section: [section_start, section_end]
        }} = matchFeature


      const shstMatch = {
        shst_reference,
        section_start,
        section_end,
      }

      EventBus.emitAction(this.uuid, {
        type: 'SHST_MATCH',
        payload: shstMatch,
      });

      await this.lockIsReleased
    }

    require('fs').writeFileSync('labVicinityTMEdgeShstMatches.geojson', JSON.stringify(turf.featureCollection(shstMatches)))

    EventBus.emitAction(this.uuid, {type: 'SHST_MATCHER_BATCH_DONE'})
    EventBus.emitAction(this.uuid, {type: 'SHST_MATCHER_DONE'})
    console.log('DONE')
  }
}
