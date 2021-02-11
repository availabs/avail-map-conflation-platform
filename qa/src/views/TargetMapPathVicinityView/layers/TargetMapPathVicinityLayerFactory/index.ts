import {Map, LineLayer, CircleLayer} from 'mapbox-gl'

import MapLayer from "AvlMap/MapLayer"

import {TargetMapPathVicinity} from '../../store/TargetMapPathVicinityFactory'

// https://gis.stackexchange.com/a/259429
const makeLineLayer = (name: string, baseWidth: number, lineColor: string, lineOffset: number = 0): LineLayer => (
  {
    "id": name,
    "type": "line",
    "source": name,
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

const makeCircleLayer = (name: string, circleColor: string, baseRadius: number): CircleLayer => ({
  "id": name,
  "type": "circle",
  "source": name,
  'paint': {
    'circle-radius': {
      "type": "exponential",
      "base": 2,
      "stops": [
        [1, baseRadius * Math.pow(2, (1 - 8))],
        [8, baseRadius * Math.pow(2, (8 - 8))]
      ]
    },
    'circle-color': circleColor
  }
})

export class TargetMapPathVicinityLayer extends MapLayer {
  targetMapPathVicinity: TargetMapPathVicinity

  constructor(name: string, config: any, targetMapPathVicinity: TargetMapPathVicinity) {
    super(name, config)
    this.targetMapPathVicinity = targetMapPathVicinity
  }

  onAdd(map: Map) {
    super.onAdd(map);

    // Vicinity ShstReferences LineStrings
    map.addSource('vicinity_shst_references', {
      type: 'geojson',
      data: this.targetMapPathVicinity.vicinityShstReferencesFeatureCollection,
    })

    // map.addLayer(makeLineLayer("vicinity_shst_references", 'red', 2, 7))
    map.addLayer(makeLineLayer("vicinity_shst_references", 2, 'red', 1))

    map.addSource('vicinity_shst_intersections', {
      type: 'geojson',
      data: this.targetMapPathVicinity.vicinityShstIntersectionsFeatureCollection,
    })

    map.addLayer(makeCircleLayer("vicinity_shst_intersections", 'red', 4))

    // TargetMapPathEdge LineStrings
    map.addSource('nearby_target_map_edges', {
      type: 'geojson',
      data: this.targetMapPathVicinity.nearbyTargetMapEdgesFeatureCollection,
    })

    map.addLayer(makeLineLayer('nearby_target_map_edges', 2, 'teal'))

    map.addSource('nearby_target_map_edge_endpoints', {
      type: 'geojson',
      data: this.targetMapPathVicinity.nearbyTargetMapEdgeEndPointsFeatureCollection,
    })

    map.addLayer(makeCircleLayer("nearby_target_map_edge_endpoints", 'teal', 4))

    // TargetMapPathEdge LineStrings
    map.addSource('target_map_path_edges', {
      type: 'geojson',
      data: this.targetMapPathVicinity.targetMapPathEdgesFeatureCollection,
    })

    map.addLayer(makeLineLayer("target_map_path_edges", 3, 'black'))

    map.addSource('target_map_path_intersections', {
      type: 'geojson',
      data: this.targetMapPathVicinity.targetMapPathIntersectionsFeatureCollection,
    })

    map.addLayer(makeCircleLayer("target_map_path_intersections", 'black', 5))

    // TargetMapPathEdge LineStrings
    map.addSource('target_map_path_chosen_matches', {
      type: 'geojson',
      data: this.targetMapPathVicinity.targetMapPathChosenMatchesFeatureCollection,
    })

    console.log(this.targetMapPathVicinity.targetMapPathChosenMatches)

    map.addLayer(makeLineLayer("target_map_path_chosen_matches", 3, 'orange', 2))

    map.addSource('target_map_path_chosen_matches_intersections', {
      type: 'geojson',
      data: this.targetMapPathVicinity.targetMapPathChosenMatchesIntersectionsFeatureCollection,
    })

    map.addLayer(makeCircleLayer("target_map_path_chosen_matches_intersections", 'orange', 5))
  }
}

export default {
  createTargetMapPathLayer(targetMapPathVicinity: TargetMapPathVicinity) {
    return new TargetMapPathVicinityLayer("TargetMapPath", {
      active: true,
    }, targetMapPathVicinity)
  }
}
