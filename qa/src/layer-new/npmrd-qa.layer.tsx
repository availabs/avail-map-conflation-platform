import React from "react"
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
import SegmentDetails from './components/SegmentDetails'

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
        let transit = []

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

const MapController = ({layer}) => {
  // console.log('MapController', layer)
  const colors = {
    primary: '#333',
    light: '#aaa'
  }

  const inlineStyle_1 = {fontSize: '3em', fontWeight: 500, padding: 5}

  return (

    <div style={{backgroundColor: '#fff', padding: 15}
    }>
      <div>
        <div style={{fontSize: '1.4em', fontWeigh: 500, borderBottom: `1px solid ${colors.primary}`, color: colors.primary}}>
          Target Layer
    <span style={{float: 'right'}}> <input type='checkbox' onClick={layer.toggleTarget} /> </span>
        </div>
        <label style={{color: colors.light}}> Opacity </label>
        <input type="range" min="1" max="100" onChange={layer.targetOpacity} style={{width: '100%'}} />
        <div style={{display: 'flex', padding: 10, borderRadius: 5, border: '1px solid DimGray', flexDirection: 'column'}}>
          {
            layer.numMatches ?
              (
                <React.Fragment>
                  <div style={{display: 'flex', paddingBottom: 15}}>
                    <div style={{flex: '1', textAlign: 'center', width: '100%'}}>
                      <div># Edges </div>
                      <div style={inlineStyle_1}> {layer.numEdges.toLocaleString()} </div>
                    </div>
                  </div>
                  <div style={{display: 'flex', paddingBottom: 15}}>
                    <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnMatched} >
                      <div>% Matching </div>
                      <div style={inlineStyle_1}> {((layer.numMatches / layer.numEdges) * 100).toFixed(1)}</div>

                    </div>
                    <div style={{flex: '1', textAlign: 'center'}}>
                      <div>5m </div>
                      <div style={inlineStyle_1}> {((layer.match10 / layer.numEdges) * 100).toFixed(1)}</div>
                    </div>
                    <div style={{flex: '1', textAlign: 'center'}}>
                      <div>50m </div>
                      <div style={inlineStyle_1}> {((layer.match50 / layer.numEdges) * 100).toFixed(1)}</div>
                    </div>
                  </div>
                  <div style={{display: 'flex', paddingBottom: 15}}>
                    <div style={{flex: '1', textAlign: 'center', cursor: 'pointer'}} onClick={layer.highlightUnJoined} >
                      <div>% Matching </div>
                      <div style={inlineStyle_1}> {((layer.numJoins / layer.numEdges) * 100).toFixed(1)}</div>

                    </div>
                    <div style={{flex: '1', textAlign: 'center'}}>
                      <div>5m </div>
                      <div style={inlineStyle_1}> {((layer.join10 / layer.numEdges) * 100).toFixed(1)}</div>
                    </div>
                    <div style={{flex: '1', textAlign: 'center'}}>
                      <div>50m </div>
                      <div style={inlineStyle_1}> {((layer.join50 / layer.numEdges) * 100).toFixed(1)}</div>
                    </div>

                  </div>
                </React.Fragment>)
              : <div style={{flex: '1', textAlign: 'center'}}> <h4>Loading Conflation </h4></div >
          }
        </div>
        <SegmentDetails layer={layer} />
      </div>
    </div>
  )
}
