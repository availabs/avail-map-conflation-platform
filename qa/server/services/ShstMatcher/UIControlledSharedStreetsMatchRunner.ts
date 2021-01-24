/* eslint-disable no-restricted-syntax */

import _ from 'lodash'

import EventBus, {EventBusActionHandler} from '../EventBus';

import {makeShstMatchesIterator} from '../../../../src/services/Conflation/TargetMapConflationKnowlegeSources/SharedStreets/SharedStreetsMatcher';

import TargetMapConflationBlackboardDao from '../../../../src/services/Conflation/TargetMapConflationBlackboardDao';

const getUnixTimestamp = () => _.round(Date.now() / 1000)

export default class UIControlledSharedStreetsMatchRunner {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;
  private readonly uuid: string;
  private _isLocked: boolean;
  private boundActionHandler: EventBusActionHandler;
  private shstMatcherFlags: string[]
  private previousHeartbeatTimestamp: number;
  private heartbeatMonitor: any;

  private controls: {
    lock: Promise<void> | null;
    releaseLock: Function | null;
    halt: boolean;
  };

  constructor(blkbrdDao: TargetMapConflationBlackboardDao, uuid: string, shstMatcherFlags: string[] = []) {
    this.blkbrdDao = blkbrdDao;
    this.uuid = uuid;
    this.controls = {
      lock: null,
      releaseLock: null,
      halt: false,
    };

    this.lock()

    this.boundActionHandler = this.actionHandler.bind(this);

    this.shstMatcherFlags = shstMatcherFlags

    this.previousHeartbeatTimestamp = getUnixTimestamp()

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

  *makeInputIterator() {
    const targetMapEdgesGeoProximityIterator = this.blkbrdDao.makeTargetMapEdgeFeaturesGeoProximityIterator();

    for (const targetMapEdge of targetMapEdgesGeoProximityIterator) {
      EventBus.emitAction(this.uuid, {
        type: 'TARGET_MAP_EDGE_ID',
        payload: {
          targetMapEdgeId: targetMapEdge.id,
        }
      });

      yield targetMapEdge;
    }
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
      flags: this.shstMatcherFlags
    });

    for await (const {matchFeature} of shstMatchesIter) {
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

    EventBus.emitAction(this.uuid, {type: 'DONE'})
    console.log('DONE')
  }
}
