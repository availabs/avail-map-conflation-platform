import {Map, LineLayer} from 'mapbox-gl'

import MapLayer from "AvlMap/MapLayer"

import {NysRisConflation} from '../../store/NysRisConflationFactory'

// https://gis.stackexchange.com/a/259429
const makeLineLayer = (name: string, sourceLayer: string, baseWidth: number, lineColor: string, lineOffset: number = 0): LineLayer => (
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
      "line-width": {
        "type": "exponential",
        "base": 2,
        "stops": [
          [1, baseWidth * Math.pow(2, (1 - 8))],
          [8, baseWidth * Math.pow(2, (8 - 8))]
        ]
      },
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

const risMapSource = {
  id: 'nys_ris_qa',
  source: {
    type: 'vector',
    url: 'http://127.0.0.1:8090/data/nys_ris_qa.json'
  }
}

export class NysRisConflationLayer extends MapLayer {
  nysRisConflation: NysRisConflation

  constructor(name: string, config: any, nysRisConflation: NysRisConflation) {
    super(name, config)
    this.nysRisConflation = nysRisConflation
  }

  onAdd(map: Map) {
    super.onAdd(map);

    /*
    // @ts-ignore
    map.addSource(conflationMapSource.id, conflationMapSource.source)

    map.addLayer(makeLineLayer(conflationMapSource.id, 2, 'blue', 1))

    // @ts-ignore
    map.addSource(risMapSource.id, risMapSource.source)

    map.addLayer(makeLineLayer(risMapSource.id, 2, 'red', 1))
   */

    map.addSource(risMapSource.id, risMapSource.source)

    map.addLayer(makeLineLayer('unmatched_ris', risMapSource.id, 2, 'red', 1))

    console.log(this.nysRisConflation.unmatchedRisSegmentIds)

    map.setFilter('unmatched_ris', [
      'match',
      ['get', 'ris'],
      this.nysRisConflation.unmatchedRisSegmentIds,
      true,
      false
    ])

    map.addLayer(makeLineLayer('matched_ris', risMapSource.id, 2, 'blue', 1))

    console.log(this.nysRisConflation.unmatchedRisSegmentIds)

    map.setFilter('matched_ris', [
      'match',
      ['get', 'ris'],
      this.nysRisConflation.matchedRisSegmentIds,
      true,
      false
    ])
  }
}

export default {
  createTargetMapPathLayer(nysRisConflation: NysRisConflation) {
    return new NysRisConflationLayer("TargetMapPath", {
      active: true,
    }, nysRisConflation)
  }
}
