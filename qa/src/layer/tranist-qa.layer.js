import React from "react"
import { ShshStyle, ShstSource, GtfsEdgesStyle } from './shst_styles.js'
import MapLayer from "AvlMap/MapLayer"
import length from '@turf/length'
import * as d3 from "d3-scale"

// const COLOR = 'rgba(255, 255, 255, 0.95)'
const api = 'http://lor.availabs.org:8080/cdta' 
//const api = 'http://localhost:8080/cdta'


class ShstLayer extends MapLayer {

    onAdd(map) {
        super.onAdd(map);
        fetch(`${api}/gtfs-matches`)
        .then(r => r.json())
        .then(matches => {
            // console.log('matches', matches)
            this.matches = matches
            fetch(`${api}/gtfs-conflation-map-join`)
            .then(r => r.json())
            .then(joins => {
                this.joins = joins;
                // console.log('joins', joins)
                  fetch(`${api}/gtfs-edges`)
                    .then(r => r.json())
                    .then(edges => {
                        console.log('matches', matches)
                        console.log('edges', edges)
                        console.log('joins', joins)
                        this.calculateStatistics(matches, edges, joins)
                    })
            })
        })

        fetch(`${api}/gtfs-conflation-schedule-join`)
        .then(r => r.json())
        .then(schedule => {
            //console.log('got schedule', schedule)
            this.schedule = schedule
            this.calculateSchedule(schedule)
        })
        
        this.toggleTransit = this.toggleTransit.bind(this)
        this.transitOpacity = this.transitOpacity.bind(this)
        this.highlightUnJoined = this.highlightUnJoined.bind(this)
        this.highlightUnMatched = this.highlightUnMatched.bind(this)
    }

    calculateSchedule (schedule) {
        let aadts = Object.values(schedule).map(d => d.aadt)
        let domain = [Math.min(...aadts), median(aadts), Math.max(...aadts)]
        let aadtScale = d3.scaleLinear()
            .domain(domain)
            .range(['#edf8b1', '#7fcdbb','#2c7fb8'])





        let segmentColors = Object.keys(schedule)
            .reduce((out,mapId) => {
                out[mapId] = aadtScale(schedule[mapId].aadt)
                return out
            },{})

        console.log(domain, segmentColors)

        this.map.setPaintProperty(
            "shst",
            'line-color',

            ["case",
                ["has", ["to-string", ["get", "id"]], ["literal", segmentColors]],
                ["get", ["to-string", ["get", "id"]], ["literal", segmentColors]],
            'white']
        );


    }

    calculateStatistics (matches,edges, joins) {
        this.numMatches = 0;
        this.numJoins = 0;
        this.unMatched = []
        this.unJoined = []
        this.match10 = 0
        this.match50 = 0
        this.join10 = 0
        this.join50 = 0
        this.schedSegments = []

        edges.features.forEach((e,i) => {
            
            e.properties.length = length(e)
            this.numMatches += matches[e.properties.matchId] ? 1 : 0
            if(!matches[e.properties.matchId]) {
                this.unMatched.push(e.properties.matchId)
            } else { 
                
                let matchLength = matches[e.properties.matchId]
                    .reduce((out, curr) =>  { return out + (curr.shst_ref_end - curr.shst_ref_start)},0)
                
                if(Math.abs(e.properties.length*1000 - matchLength) < 5){
                    this.match10 += 1
                } else {

                }

                this.match50 +=  Math.abs(e.properties.length*1000 - matchLength) < 50 ? 1 : 0

            }

            this.numJoins += joins[e.properties.matchId] ? 1 : 0
            if(!joins[e.properties.matchId]) {

                this.unJoined.push(e.properties.matchId)
            
            }  else { 
                
                joins[e.properties.matchId].forEach(seg => {
                    if(this.schedSegments.indexOf(seg.conflation_map_id) === -1){
                        this.schedSegments.push(seg.conflation_map_id)
                    }
                })


                let matchLength = joins[e.properties.matchId]
                    .reduce((out, curr) =>  { return out + (curr.conf_map_seg_len - (curr.conf_map_pre_len + curr.conf_map_post_len ))},0)
                
                this.join10 +=  Math.abs(e.properties.length - matchLength) < .03 ? 1 : 0
                this.join50 +=  Math.abs(e.properties.length - matchLength) < .5 ? 1 : 0

            }

        })
        console.log('scheduled segments',this.schedSegments.length)
        
        this.edges = edges
        this.numEdges = edges.features.length
        
        this.highlightTransit(this.unMatched)
      
        this.component.forceUpdate()
        console.log('done',)

    }
    
    highlightUnJoined() {
        this.highlightTransit(this.unJoined, 'hotpink')
    }

    highlightUnMatched() {
        this.highlightTransit(this.unMatched, 'crimson')
    }

    highlightTransit(ids,color='crimson') {
        this.map.setPaintProperty(
            "gtfs-edges", 
            "line-color",
            ["match", 
                ["string", ["get", "matchId"]], 
                [...ids],
                color,
                'slateblue'
            ]
        )
    }

    toggleTransit() {
        this.map.setLayoutProperty(
            'gtfs-edges', 
            'visibility', 
            this.map.getLayoutProperty('gtfs-edges', 'visibility') === 'visible' ? 'none' : 'visible'
        );
    }

    transitOpacity (e) {
        console.log('hello', e)
        if(e && e.target) {
            console.log('set', e.target.value)
            this.map.setPaintProperty('gtfs-edges','line-opacity', e.target.value/100)
        }
    }   
}


 export default (props = {}) =>
    new ShstLayer("Conflation QA", {
    active: true,
    matches: {},
    segments: [],
    sources: [
        ShstSource,
        {   
            id: 'gtfs-edges',
            source: {
                'type': 'geojson',
                'data': `${api}/gtfs-edges`,
                'generateId': true
            }
        }
    ],
    layers: [
        ShshStyle,
        GtfsEdgesStyle
    ],
    onHover: {
        layers: ['shst', "gtfs-edges"],
        dataFunc: function (feature) {
            
            if(feature[0].properties.shape_id){
                let matchIndex = `${feature[0].properties.shape_id}::${feature[0].properties.shape_index}`
                
                let segments = this.matches[matchIndex]
                if(segments){
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
        layers: ['shst', "gtfs-edges"],
        dataFunc: function (feature) {
            
            if(feature[0].properties.shape_id && this.joins){
                let matchId = `${feature[0].properties.shape_id}::${feature[0].properties.shape_index}`
                this.matchId = matchId
                let segments = this.joins[matchId]
                console.log('click data',segments, this.joins, matchId, this.joins[matchId])
                this.map.setPaintProperty(
                    "gtfs-edges", 
                    "line-color",
                    ["match", 
                        ["string", ["get", "matchId"]], 
                        matchId,
                        '#FF8C00',
                        'slateblue'
                    ]
                )
               
                if(segments) {
                    this.segments = segments || []
                    let shstIds = Object.values(segments).map(v => +v.conflation_map_id)
                    console.log('conflation ids', shstIds)
                    this.map.setPaintProperty(
                        "shst", 
                        "line-color",
                        ["match", 
                            ["get", "id"], 
                            shstIds,
                            'yellow',
                            'white'
                        ]
                    )
                    console.log('fetch', `${api}/gtfs-conflation-schedule-join/${segments[0]}`)
                    fetch(`${api}/gtfs-conflation-schedule-join/${shstIds[0]}`)
                        .then(r => r.json())
                        .then(sched => {
                            console.log('a schedule', sched)
                        })


                }


            }
           
        }
    },
    popover: {
        layers: ["shst","gtfs-edges"],
        dataFunc: function (feature,map) {
            let transit = []
            if(feature.properties.shst && this.schedule && this.schedule[feature.properties.id]){
                console.log(this.schedule[feature.properties.id])
                transit.push([
                    <div style={{fontSize:'1.5em', fontWeight: 500}}>Bus AADT</div>,
                    <div style={{fontSize:'1.5em', fontWeight: 500}}>{this.schedule[feature.properties.id].aadt}</div>
                ])
                Object.keys(this.schedule[feature.properties.id].aadt_by_route).forEach(route => {
                    let count = Object.values(this.schedule[feature.properties.id].aadt_by_route[route]).reduce((a,b) => a+b)
                    transit.push([
                    <div style={{fontSize:'1.2em', fontWeight: 300}}>{route}</div>,
                    <div style={{fontSize:'1.2em', fontWeight: 300}}>{count}</div>
                ])
                })
            }
            return [...transit,...Object.keys(feature.properties).map(k => [k, feature.properties[k]]),]
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
    // const transitVisibility = (e,v) => {
    //     console.log('transitVisibility', e.target.value/100, layer)
    //     (e.target.value/100)
    // } 
    //console.log('segments', layer.segments)
    return  (

        <div style={{backgroundColor: '#fff',padding: 15}}>
            <div>
                <div style={{fontSize: '1.3em', fontWeigh: 500, borderBottom: `1px solid ${colors.primary}`, color: colors.primary }}>
                    Transit Layer
                    <span style={{float: 'right'}}><input type='checkbox'  onClick={layer.toggleTransit}/></span>
                </div>
                <label style={{color: colors.light}}>Opacity</label>
                <input type="range" min="1" max="100" onChange={layer.transitOpacity} style={{width: '100%'}}/>
                <div style={{display: 'flex', padding: 10, borderRadius: 5, border: '1px solid DimGray', flexDirection: 'column'}}>
                    {layer.numMatches ? 
                        (
                        <>
                        <div style={{display: 'flex', paddingBottom: 15}}>
                            <div style={{flex: '1',textAlign:'center', width: '100%'}}>
                                <div># Edges</div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{layer.numEdges.toLocaleString()}</div>
                            </div>
                        </div>
                        <div style={{display: 'flex', paddingBottom: 15}}>
                            <div style={{flex: '1',textAlign:'center', cursor:'pointer'}} onClick={layer.highlightUnMatched}>
                                <div>% Matching</div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.numMatches / layer.numEdges) *100).toFixed(1)}</div>
                                
                            </div>
                            <div style={{flex: '1',textAlign:'center'}}>
                                 <div> 5m </div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.match10 / layer.numEdges) *100).toFixed(1)}</div>
                            </div>
                            <div style={{flex: '1',textAlign:'center'}}>
                                 <div> 50m </div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.match50 / layer.numEdges) *100).toFixed(1)}</div>
                            </div>
                        </div>
                        <div style={{display: 'flex', paddingBottom: 15}}>
                            <div style={{flex: '1',textAlign:'center', cursor:'pointer'}}  onClick={layer.highlightUnJoined}>
                                <div>% Matching</div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.numJoins / layer.numEdges) *100).toFixed(1)}</div>
                            
                            </div>
                            <div style={{flex: '1',textAlign:'center'}}>
                                 <div> 5m </div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.join10 / layer.numEdges) *100).toFixed(1)}</div>
                            </div>
                            <div style={{flex: '1',textAlign:'center'}}>
                                 <div> 50m </div>
                                <div style={{fontSize:'3em', fontWeight: 500, padding: 5}}>{ ((layer.join50 / layer.numEdges) *100).toFixed(1)}</div>
                            </div>
                        </div>
                        </>)
                        : <div style={{flex: '1',textAlign:'center'}}><h4>Loading Conflation</h4></div>
                    }
                </div>
                
                <div>
                    {layer.matchId}
                    <table>
                        <tbody>
                            {layer.segments.map(d => <tr><td>{d.shst_match_id}</td><td>{d.shst_reference}</td></tr>)}
                        </tbody>    
                    </table>
                    
                </div>
            </div>
        </div>
    )
}


function median(values){
  if(values.length ===0) return 0;

  values.sort(function(a,b){
    return a-b;
  });

  var half = Math.floor(values.length / 2);

  if (values.length % 2)
    return values[half];

  return (values[half - 1] + values[half]) / 2.0;
}