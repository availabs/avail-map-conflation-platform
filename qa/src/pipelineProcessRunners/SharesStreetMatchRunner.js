import React, {useState, useEffect} from 'react';

import EventBus from '../EventBus';

import {API_HOST} from '../config';

export default class SharedStreetsMatchRunner {
  constructor(config) {
    const {
      targetMap,
      flags = [],
      queryPolygon
    } = config

    this.targetMap = targetMap

    // https://github.com/sharedstreets/sharedstreets-js#options-1
    this.flags = flags

    this.queryPolygon = queryPolygon

    this.matchRunId = null

    this.unsubscribe = () => {}

    this.locked = true

    this.targetMapEdgeIds = []
    this.targetMapEdgeIdListeners = new Set()

    this.shstMatches = []
    this.shstMatchListeners = new Set()
  }

  async run() {
    const res = await fetch(`${API_HOST}/${this.targetMap}/run-shst-matcher`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        flags: this.flags,
        queryPolygon: this.queryPolygon
      })
    })

    this.matchRunId = await res.json()

    const actionListener = this.actionHandler.bind(this)

    EventBus.on(this.matchRunId, actionListener);

    this.hearbeat = setInterval(() => EventBus.emitAction(this.matchRunId, {type: 'HEARTBEAT'}), 1000)

    this.unsubscribe = () => EventBus.off(this.matchRunId, actionListener);

    // ready
    return true
  }

  actionHandler(action) {
    if (action.type === 'TARGET_MAP_EDGE_ID') {
      const targetMapEdgeId = action.payload
      this.targetMapEdgeIds.push(targetMapEdgeId)
      return this.targetMapEdgeIdListeners.forEach(listener => listener(targetMapEdgeId))
    }

    if (action.type === 'SHST_MATCH') {
      const shstMatch = action.payload
      this.shstMatches.push(shstMatch)
      return this.shstMatchListeners.forEach(listener => listener(shstMatch))
    }
  }

  toggleLock() {
    if (this.locked) {
      this.proceed()
    } else {
      this.pause()
    }
  }

  pause() {
    EventBus.emitAction(this.matchRunId, {type: 'PAUSE'});
    this.locked = true
  }

  proceed() {
    EventBus.emitAction(this.matchRunId, {type: 'PROCEED'});
    this.locked = false
  }

  addTargetMapEdgeListener(listener) {
    this.targetMapEdgeListeners.add(listener)
  }

  removeTargetMapEdgeListener(listener) {
    this.targetMapEdgeListeners.remove(listener)
  }

  addShstMatchListener(listener) {
    this.shstMatchListeners.add(listener)
  }

  removeTargetMapEdgeListener(listener) {
    this.shstMatchListeners.remove(listener)
  }

  destroy() {
    clearInterval(this.hearbeat)
    this.unsubscribe()
    this.targetMapEdgeIdListeners.clear()
    this.shstMatchListeners.clear()
    EventBus.emitAction(this.matchRunId, {type: 'HALT'});
  }
}
