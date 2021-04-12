import {Map, LineLayer} from 'mapbox-gl'

import _ from 'lodash'

import MapLayer from "AvlMap/MapLayer"

import {ConflationAnalysis} from '../../store/ConflationAnalysisFactory'

import {TargetMap, TargetMapId, ConflationMapId} from '../../domain/types'

import Test from '../../components/Test'
import ConflationMatchingStats from '../../components/ConflationMatchingStats'

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
    baseWidth: number,
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
          "line-width": createLineWidthObj(baseWidth),
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

const conflationMapSource = {
  id: 'conflation_map_qa',
  source: {
    type: 'vector',
    url: 'http://127.0.0.1:8090/data/conflation_map_qa.json'
  }
}

const targetMapSources = {
  [TargetMap.NYS_RIS]: {
    id: 'nys_ris_qa',
    source: {
      type: 'vector',
      url: 'http://127.0.0.1:8090/data/nys_ris_qa.json'
    }
  },
  [TargetMap.NPMRDS]: {
    id: 'npmrds_qa',
    source: {
      type: 'vector',
      url: 'http://127.0.0.1:8090/data/npmrds_qa.json'
    }
  }
}

export class ConflationAnalysisLayer extends MapLayer {
  conflationAnalysis: ConflationAnalysis;

  targetMapSource: any;

  targetMapLineOffset: number;

  constructor(
    name: string,
    config: any,
    conflationAnalysis: ConflationAnalysis,
    readonly notifyMapReady: Function,
  ) {
    super(name, config)
    this.conflationAnalysis = conflationAnalysis

    this.targetMapSource = targetMapSources[conflationAnalysis.targetMap]

    this.targetMapLineOffset =
      conflationAnalysis.targetMap === TargetMap.NPMRDS
        ? 1
        : 0

    this.infoBoxes = {
      ['MapControls']: {
        comp: Test,
        show: true
      },
      ['Stats']: {
        comp: ConflationMatchingStats,
        show: true
      }
    }
  }

  onAdd(map: Map) {
    super.onAdd(map);

    // @ts-ignore
    map.addSource(conflationMapSource.id, conflationMapSource.source)
    // @ts-ignore
    map.addSource(this.targetMapSource.id, this.targetMapSource.source)

    map.addLayer(makeLineLayer('conflation_map', conflationMapSource.id, 1, 'black', 2))

    map.addLayer(makeLineLayer('target_map', this.targetMapSource.id, 1, 'blue', this.targetMapLineOffset))

    this.setConflationMapVisible(false)

    this.setTargetMapVisible(false)

    this.notifyMapReady()
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
      ['get', 'id'],
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
    this.map.setFilter('target_map', [
      'in',
      ['get', 'id'],
      ['literal', ids],
    ])
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
    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.matchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapForwardMatchedSegments() {
    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.forwardMatchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapSegmentsBackwardMatched() {
    this.setConflationMapVisible(true)
    this.conflationMapShow(this.conflationAnalysis.backwardMatchedConflationMapIds)
    this.setConflationMapLineColor('black')
  }

  showConflationMapUnmatchedSegments() {
    this.setConflationMapVisible(true)
    this.conflationMapHide(this.conflationAnalysis.matchedConflationMapIds)
    this.setConflationMapLineColor('orangered')
  }

  showTargetMapMatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.directionalMatchedTargetMapIds)
    this.setTargetMapLineColor('blue')
  }

  showTargetMapUnmatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.directionalUnmatchedTargetMapIds)
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  showTargetMapForwardMatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.forwardMatchedTargetMapIds)
    this.setTargetMapLineColor('blue')
  }

  showTargetMapForwardUnmatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.forwardUnmatchedTargetMapIds)
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  showTargetMapBackwardMatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.backwardMatchedTargetMapIds ?? [])
    this.setTargetMapLineColor('blue')
  }

  showTargetMapBackwardUnmatchedSegments() {
    this.setTargetMapVisible(true)
    this.targetMapShow(this.conflationAnalysis.backwardUnmatchedTargetMapIds ?? [])
    this.setTargetMapLineColor('red')

    this.disableShowHoveredTargetMapConflationMatches()
  }

  showTargetMapMatchedSegmentsInLengthDifferenceRange(minLenDiff: number | null, maxLenDiff: number | null) {
    this.setTargetMapVisible(true)
    const targetMapIds =
      this.conflationAnalysis.getLengthDifferenceFilteredMatchedTargetMapIds(minLenDiff, maxLenDiff)
    this.targetMapShow(targetMapIds)
    this.setTargetMapLineColor('blue')

    this.showHoveredTargetMapConflationMatches()
  }

  showTargetMapFowardMatchedSegmentsInLengthDifferenceRange(minLenDiff: number | null, maxLenDiff: number | null) {
    this.setTargetMapVisible(true)
    const targetMapIds =
      this.conflationAnalysis.getLengthDifferenceFilteredForwardMatchedTargetMapIds(minLenDiff, maxLenDiff)
    this.targetMapShow(targetMapIds)
    this.setTargetMapLineColor('blue')

    this.showHoveredTargetMapConflationMatches()
  }


  showHoveredTargetMapConflationMatches() {
    this.setConflationMapVisible(true)
    this.conflationMapShow([])
    this.setConflationMapLineColor('green')

    if (!this.targetMapMouseMoveListener) {
      this.targetMapMouseMoveListener = (e: any) => {
        const hoveredTargetMapIds = e.features.map(({properties}) => properties.id)
        const conflationMapIds = this.conflationAnalysis.getMatchedConflationMapIds(hoveredTargetMapIds)

        // FIXME: Should use own layer
        this.conflationMapShow(conflationMapIds)

        this.map.setPaintProperty(
          'target_map',
          'line-color',
          ["match",
            ["get", "id"],
            hoveredTargetMapIds,
            'midnightblue',
            'cornflowerblue'
          ]
        )
      }

      this.map.on('mousemove', 'target_map', this.targetMapMouseMoveListener)
    }
  }

  disableShowHoveredTargetMapConflationMatches() {
    if (this.targetMapMouseMoveListener) {
      this.map.off('mousemove', 'target_map', this.targetMapMouseMoveListener)
      this.targetMapMouseMoveListener = null
    }
  }


  showHoveredTargetMapForwardConflationMatches() {
    this.setConflationMapVisible(true)
    this.conflationMapShow([])
    this.setConflationMapLineColor('green')

    this.map.on('mousemove', 'target_map', (e: any) => {
      const hoveredTargetMapIds = e.features.map(({properties}) => properties.id)
      const conflationMapIds = this.conflationAnalysis.getForwardMatchedConflationMapIds(hoveredTargetMapIds)

      // FIXME: Should use own layer
      this.conflationMapShow(conflationMapIds)

      this.map.setPaintProperty(
        'target_map',
        'line-color',
        ["match",
          ["get", "id"],
          hoveredTargetMapIds,
          'midnightblue',
          'cornflowerblue'
        ]
      )

      // const conflationMetrics = hoveredTargetMapIds.map(
      // tgtMapId => this.conflationAnalysis.getConflationMetricsForTargetMapId(tgtMapId)
      // )

      // console.log({conflationMetrics})
    })

    // Turned this off because it's too sensitive
    // this.map.on('mouseleave', 'target_map', () => {
    // this.conflationMapShow([])
    // })
  }

}

export default {
  createConflationAnalysisLayer(
    conflationAnalysis: ConflationAnalysis,
    notifyMapReady: Function,
  ) {
    const conflationAnalysisLayer = new ConflationAnalysisLayer(
      "Conflation Analysis",
      {active: true},
      conflationAnalysis,
      notifyMapReady,
    )

    return conflationAnalysisLayer
  }
}
