import _ from 'lodash'

import {
  ShshStyle,
  ShstSource,
  npmrd2019Source,
  npmrdsStyle,
  ris2019Source,
  risStyle
} from './shst_styles.js'

import ShstLayer from './layers/ShstLayer'
import MapController from './components/MapController'

// const COLOR = 'rgba(255, 255, 255, 0.95)'
const networks = ['nys_ris', 'npmrds']
const network = networks[0]

//const api = 'http://localhost:8080/cdta'

export default (props = {}) =>
  new ShstLayer("Conflation QA", {
    active: true,
    shstMatches: {},
    matchProperties: {},
    segments: [],
    edges: [],
    sources: [
      ShstSource,
      npmrd2019Source,
      ris2019Source
    ],

    layers: [
      ShshStyle,
      network === 'npmrds' ?
        npmrdsStyle :
        risStyle

    ],

    onHover: {
      layers: ['shst', network],
      dataFunc: function (feature) {
        if (feature[0].properties.shape_id) {
          let matchIndex = `${feature[0].properties.shape_id}::${feature[0].properties.shape_index}`

          let segments = this.shstMatches[matchIndex]
          if (segments) {
            this.shstHover = Object.values(segments).map(v => {
              this.map.setFeatureState({
                source: 'ShstSource',
                sourceLayer: 'gtfs_conflation_qa',
                id: v.shst_match_id
              }, {
                hover: true
              });
              return v.shst_match_id
            })
            //console.log('shape_id', matchIndex, this.shstHover)
          }
        }

      }
    },

    onClick: {
      layers: [network],// 'shst',
      dataFunc: function (feature) {
        if (feature[0].properties.fid && this.chosenShstMatches) {
          let properties = _.get(
            this.rawTargetMapFeatureProperties.filter(
              fProps => fProps.id == feature[0].id
            ),
            '[0].properties', {}
          )

          let matchId = feature[0].properties.fid
          this.matchId = matchId
          this.matchProperties = properties

          let segments = this.chosenShstMatches[matchId] || []
          console.log('click data', matchId, properties, segments.length, segments)
          this.map.setPaintProperty(
            network,
            "line-color",
            ["match",
              ["get", "fid"],
              matchId,
              '#FF8C00',
              '#6495ED'
            ]
          )

          if (segments) {
            this.segments = segments || []
            let shstIds = Object.values(segments).map(v => v.shst_reference)
            console.log('conflation ids', shstIds)
            this.map.setPaintProperty(
              "shst",
              "line-color",
              ["match",
                ["get", "s"],
                shstIds,
                'yellow',
                'white'
              ]
            )
          }


        }

      }
    },

    popover: {
      layers: ["shst", network],
      dataFunc: function (feature, map) {
        return [['id', feature.id], ...Object.keys(feature.properties).map(k => [k, feature.properties[k]]),]
      }
    },

    infoBoxes: {
      Overview: {
        comp: MapController,
        show: true
      }

    }

  })
