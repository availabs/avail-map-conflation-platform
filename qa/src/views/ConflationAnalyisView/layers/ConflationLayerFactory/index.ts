import {Map, LineLayer} from 'mapbox-gl'

import EventEmitter from 'eventemitter3'

import _ from 'lodash'

import MapLayer from "AvlMap/MapLayer"

import {TILESERVER_HOST} from '../../../../config'

import {ConflationAnalysis} from '../../store/ConflationAnalysisFactory'

import {TargetMap, TargetMapId, ConflationMapId} from '../../domain/types'

import ConflationMatchingStats from '../../components/ConflationMatchingStats'
import TargetMapEdgeInfo from '../../components/TargetMapEdgeInfo'

// const createLineWidthObj = (baseWidth: number) => (
// {
// "type": "exponential",
// "base": 2,
// "stops": [
// [1, baseWidth * Math.pow(2, (1 - 8))],
// [8, baseWidth * Math.pow(2, (8 - 8))]
// ]
// });

const createLineWidthObj = (baseWidth: number) => (
  {
    "type": "exponential",
    "base": 2,
    "stops": [
      [1, baseWidth * Math.pow(2, (1 - 8))],
      [8, baseWidth * Math.pow(2, (8 - 8))]
    ]
  });

// https://gis.stackexchange.com/a/259429
const makeLineLayer =
  (
    name: string,
    sourceLayer: string,
    lineColor: string,
    lineOffset: number = 0
  ): LineLayer => (
      {
        "id": name,
        "type": "line",
        "source": sourceLayer,
        "source-layer": sourceLayer,
        'layout': {
          'line-join': 'round',
          'line-cap': 'round',
        },
        'paint': {
          'line-color': lineColor,
          // @ts-ignore
          // "line-width": createLineWidthObj(baseWidth),
          "line-width": 1,
          'line-offset': {
            "type": "exponential",
            "base": 1.5,
            "stops": [
              [0, lineOffset * Math.pow(1.5, (0 - 8))],
              [10, lineOffset * Math.pow(1.5, (10 - 8))]
            ]
          },
        },
      }
    )

// FIXME: The Mapbox tiles are being cached.
//        This throws off the ids of the conflation_map_qa source.
// https://stackoverflow.com/a/41559057/3970755
// Not sure if the ?fresh=true is actually working.
const conflationMapSource = {
  id: 'conflation_map_qa',
  source: {
    type: 'vector',
    url: `${TILESERVER_HOST}/data/conflation_map_qa.json?fresh=true`
  }
}

const targetMapSources = {
  [TargetMap.NYS_RIS]: {
    id: 'nys_ris_qa',
    source: {
      type: 'vector',
      url: `${TILESERVER_HOST}/data/nys_ris_qa.json?fresh=true`
    }
  },
  [TargetMap.NPMRDS]: {
    id: 'npmrds_qa',
    source: {
      type: 'vector',
      url: `${TILESERVER_HOST}/data/npmrds_qa.json?fresh=true`
    }
  }
}

enum ConflationMapColors {
  active = 'lime',
  inactive = 'palegreen'
}

enum TargetMapColors {
  active = 'navy',
  inactive = 'cornflowerblue',
}

export class ConflationAnalysisLayer extends MapLayer {
  conflationAnalysis: ConflationAnalysis;

  targetMapSource: any;

  targetMapLineOffset: number;

  private targetMapMouseMoveListener: Function | null;

  readonly infoBoxes: any;

  minLenDiff: number | null;
  maxLenDiff: number | null;

  activeTargetMapIds: TargetMapId[];

  selectedTargetMapId: TargetMapId | null;

  selectedTargetMapIdChangeEmitter: EventEmitter;

  mapReadyEventEmitter: EventEmitter;

  private getMatchedConflationMapIdsFn: Function

  constructor(
    name: string,
    config: any,
    conflationAnalysis: ConflationAnalysis
  ) {
    super(name, config)
    this.conflationAnalysis = conflationAnalysis

    this.targetMapSource = targetMapSources[conflationAnalysis.targetMap]

    this.targetMapLineOffset =
      conflationAnalysis.targetMap === TargetMap.NPMRDS
        ? 1
        : 0

    this.infoBoxes = {
      ['AggStats']: {
        comp: ConflationMatchingStats,
        show: true
      },
      ['EdgeInfo']: {
        comp: TargetMapEdgeInfo,
        show: true
      }
    }

    this.targetMapMouseMoveListener = null

    this.minLenDiff = null;
    this.maxLenDiff = null;

    this.activeTargetMapIds = []
    this.selectedTargetMapId = null

    this.selectedTargetMapIdChangeEmitter = new EventEmitter()

    this.mapReadyEventEmitter = new EventEmitter()

    this.getMatchedConflationMapIdsFn = () => console.warn('this.getMatchedConflationMapIdsFn is not set')
  }

  onAdd(map: Map) {
    super.onAdd(map);

    // @ts-ignore
    map.addSource(conflationMapSource.id, conflationMapSource.source)
    // @ts-ignore
    map.addSource(this.targetMapSource.id, this.targetMapSource.source)

    map.addLayer(
      makeLineLayer(
        'conflation_map',
        conflationMapSource.id,
        ConflationMapColors.inactive,
        this.targetMapLineOffset + 2
      )
    )

    map.addLayer(
      makeLineLayer(
        'target_map',
        this.targetMapSource.id,
        TargetMapColors.inactive,
        this.targetMapLineOffset
      )
    )

    this.setConflationMapVisible(false)

    this.setTargetMapVisible(false)

    this.mapReadyEventEmitter.emit('ready')
  }

  private setConflationMapVisible(visible: boolean) {
    this.map.setLayoutProperty('conflation_map', 'visibility', visible ? 'visible' : 'none')
  }

  private setTargetMapVisible(visible: boolean) {
    this.map.setLayoutProperty('target_map', 'visibility', visible ? 'visible' : 'none')
  }

  private conflationMapShow(ids: ConflationMapId[]) {
    this.map.setFilter('conflation_map', [
      'in',
      ['id'],
      ['literal', ids],
    ])
  }

  private conflationMapHide(ids: ConflationMapId[]) {
    this.map.setFilter('conflation_map', [
      '!',
      [
        'in',
        ['get', 'id'],
        ['literal', ids],
      ]
    ])
  }

  private targetMapShow(ids: TargetMapId[]) {
    this.activeTargetMapIds = ids

    this.map.setFilter('target_map', [
      'in',
      ['get', 'id'],
      ['literal', ids],
    ])
  }

  get showingMatched() {
    return this.activeTargetMapIds === this.conflationAnalysis.directionalMatchedTargetMapIds
  }

  get showingUnmatched() {
    return this.activeTargetMapIds === this.conflationAnalysis.directionalUnmatchedTargetMapIds
  }

  showSetDifferenceTargetMapSegments() {
    // FIXME: If we add directionality, must update this.
    this.activeTargetMapIds = _.difference(
      this.conflationAnalysis.targetMapIds,
      _.union(
        this.activeTargetMapIds,
        this.conflationAnalysis.directionalUnmatchedTargetMapIds
      )
    )

    this.minLenDiff = null
    this.maxLenDiff = null

    this.targetMapShow(this.activeTargetMapIds)
    this.conflationMapShow(this.getMatchedConflationMapIdsFn(this.activeTargetMapIds))
  }

  private setMapLineColor(mapName: string, color: string) {
    this.map.setPaintProperty(mapName, 'line-color', color)
  }

  private setConflationMapLineColor(color: string) {
    this.setMapLineColor('conflation_map', color)
  }

  private setTargetMapLineColor(color: string) {
    this.setMapLineColor('target_map', color)
  }

  hideConflationMap() {
    this.setConflationMapVisible(false)
  }

  hideTargetMap() {
    this.setTargetMapVisible(false)
  }

  showConflationMapMatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.matchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapForwardMatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.forwardMatchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapSegmentsBackwardMatched() {
    this.resetMinAndMaxLenDiffs()

    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.backwardMatchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapUnmatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setConflationMapVisible(true)
    this.conflationMapHide(this.conflationAnalysis.matchedConflationMapIds)
    this.setConflationMapLineColor('orangered')
  }

  showTargetMapMatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.directionalMatchedTargetMapIds)
    this.setTargetMapLineColor('blue')
  }

  showTargetMapUnmatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.directionalUnmatchedTargetMapIds)
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  showTargetMapForwardMatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.forwardMatchedTargetMapIds)
    this.setTargetMapLineColor('blue')
  }

  showTargetMapForwardUnmatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.forwardUnmatchedTargetMapIds)
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  showTargetMapBackwardMatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.backwardMatchedTargetMapIds ?? [])
    this.setTargetMapLineColor('blue')
  }

  showTargetMapBackwardUnmatchedSegments() {
    this.resetMinAndMaxLenDiffs()

    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.backwardUnmatchedTargetMapIds ?? [])
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  private resetMinAndMaxLenDiffs() {
    this.minLenDiff = null;
    this.maxLenDiff = null;
  }

  showTargetMapMatchedSegmentsInLengthDifferenceRange(minLenDiff: number | null, maxLenDiff: number | null) {
    this.minLenDiff = minLenDiff;
    this.maxLenDiff = maxLenDiff;

    this.setTargetMapVisible(true)

    const targetMapIds =
      this.conflationAnalysis.getLengthDifferenceFilteredMatchedTargetMapIds(minLenDiff, maxLenDiff)

    this.targetMapShow(targetMapIds)

    this.conflationMapShow(
      this.conflationAnalysis.getMatchedConflationMapIds(this.activeTargetMapIds)
    )

    this.enableShowHoveredTargetMapConflationMatches(
      this.conflationAnalysis.getMatchedConflationMapIds.bind(this.conflationAnalysis)
    )
  }

  showTargetMapFowardMatchedSegmentsInLengthDifferenceRange(minLenDiff: number | null, maxLenDiff: number | null) {
    this.minLenDiff = minLenDiff;
    this.maxLenDiff = maxLenDiff;

    this.setTargetMapVisible(true)

    const targetMapIds =
      this.conflationAnalysis.getLengthDifferenceFilteredForwardMatchedTargetMapIds(minLenDiff, maxLenDiff)

    this.targetMapShow(targetMapIds)

    this.conflationMapShow(
      this.conflationAnalysis.getForwardMatchedConflationMapIds(this.activeTargetMapIds)
    )

    this.enableShowHoveredTargetMapConflationMatches(
      this.conflationAnalysis.getForwardMatchedConflationMapIds.bind(this.conflationAnalysis)
    )
  }

  selectTargetMapId(targetMapId: TargetMapId) {
    if (this.selectedTargetMapId !== targetMapId) {
      this.selectedTargetMapId = targetMapId

      this.selectedTargetMapIdChangeEmitter.emit('update', this.selectedTargetMapId)

      this.updateMapColors()
    }
  }

  updateMapColors() {
    const targetMapId = this.selectedTargetMapId ?? -1
    let conflationMapIds = this.getMatchedConflationMapIdsFn(targetMapId)

    if (_.isEmpty(conflationMapIds)) {
      conflationMapIds = [-1]
    }

    this.map.setPaintProperty(
      'target_map',
      'line-color',
      ["match",
        ["get", "id"],
        [this.selectedTargetMapId ?? -1],
        TargetMapColors.active,
        TargetMapColors.inactive,
      ]
    )

    this.map.setPaintProperty(
      'target_map',
      'line-width',
      ["match",
        ["get", "id"],
        [this.selectedTargetMapId ?? -1],
        2,
        1
      ]
    )

    this.map.setPaintProperty(
      'conflation_map',
      'line-color',
      ["match",
        ["id"],
        conflationMapIds,
        ConflationMapColors.active,
        ConflationMapColors.inactive,
      ]
    )

    this.map.setPaintProperty(
      'conflation_map',
      'line-width',
      ["match",
        ["id"],
        conflationMapIds,
        2,
        1
      ]
    )
  }

  private enableShowHoveredTargetMapConflationMatches(getMatchedConflationMapIdsFn: Function) {
    this.getMatchedConflationMapIdsFn = getMatchedConflationMapIdsFn

    // For idempotency
    if (this.targetMapMouseMoveListener) {
      return
    }

    this.setConflationMapVisible(true)

    // FIXME: May potentially break
    let currentActiveTargetMapIds = this.activeTargetMapIds
    this.conflationMapShow(getMatchedConflationMapIdsFn(currentActiveTargetMapIds))

    // Run it once on entry.
    this.updateMapColors()

    this.targetMapMouseMoveListener = (e: any) => {
      if (currentActiveTargetMapIds !== this.activeTargetMapIds) {
        currentActiveTargetMapIds = this.activeTargetMapIds
        this.conflationMapShow(this.getMatchedConflationMapIdsFn(currentActiveTargetMapIds))
      }

      // @ts-ignore
      const hoveredTargetMapIds = e.features.map(({properties}) => properties.id).slice(0, 1);

      const hoveredTargetMapId = hoveredTargetMapIds[0] ?? -1

      this.selectTargetMapId(hoveredTargetMapId)
    }

    this.map.on('mousemove', 'target_map', this.targetMapMouseMoveListener)
  }

  disableShowHoveredTargetMapConflationMatches() {
    this.setConflationMapVisible(false)

    if (this.targetMapMouseMoveListener) {
      this.map.off('mousemove', 'target_map', this.targetMapMouseMoveListener)
      this.targetMapMouseMoveListener = null
    }
  }

  // Recreating the MBTiles requires clearing the cache.
  // https://github.com/mapbox/mapbox-gl-js/issues/2633#issuecomment-576050636
  clearMapboxTileCaches() {
    const sourceIds = [
      conflationMapSource.id,
      this.targetMapSource.id
    ]

    console.log(this.map.style.sourceCaches)

    for (const sourceId of sourceIds) {
      const sourceCache = this.map.style.sourceCaches[sourceId];

      sourceCache.clearTiles();

      for (const id in sourceCache._tiles) {
        sourceCache._tiles[id].expirationTime = Date.now() - 1;
        sourceCache._reloadTile(id, 'reloading');
      }

      sourceCache._cache.reset();
    }

    this.map.triggerRepaint()
  }
}

export default {
  createConflationAnalysisLayer(
    conflationAnalysis: ConflationAnalysis,
  ) {
    const conflationAnalysisLayer = new ConflationAnalysisLayer(
      "Conflation Analysis",
      {active: true},
      conflationAnalysis,
    )

    return conflationAnalysisLayer
  }
}
