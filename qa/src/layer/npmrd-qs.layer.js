import React from "react"
import { 
    ShshStyle, 
    ShstSource,
    npmrd2019Source, 
    npmrdsStyle,
    ris2019Source,
    risStyle
 } from './shst_styles.js'
import MapLayer from "AvlMap/MapLayer"
import length from '@turf/length'
import * as d3 from "d3-scale"
import get from 'lodash.get'

// const COLOR = 'rgba(255, 255, 255, 0.95)'
const api = 'http://localhost:8080' 
const networks = ['nys_ris','npmrds']
const network = networks[0]


//const api = 'http://localhost:8080/cdta'



class ShstLayer extends MapLayer {

    onAdd(map) {
        super.onAdd(map);
        fetch(`${api}/${network}/shst-matches-metadata`)
        .then(r => r.json())
        .then(matches => {
            //this.matches = matches
            fetch(`${api}/${network}/shst-chosen-matches`)
            .then(r => r.json())
            .then(joins => {
                this.joins = joins;
                // console.log('joins', joins)
                  fetch(`${api}/${network}/raw-shapefile`)
                    .then(r => r.json())
                    .then(edges => {
                        this.edges=edges.features
                        //console.log('matches', matches)
                        console.log('edges', edges.features)
                        //console.log('joins', joins)
                        this.calculateStatistics(matches, edges, joins)
                    })
            })
        })

        
        this.toggleTarget = this.toggleTarget.bind(this)
        this.targetOpacity = this.targetOpacity.bind(this)
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
            this.numMatches += matches[e.id] ? 1 : 0
            if(!matches[e.id]) {
                this.unMatched.push(e.id)
            } else { 
                
                let matchLength = matches[e.id]
                    .reduce((out, curr) =>  { return out + (curr.shst_ref_end - curr.shst_ref_start)},0)
                
                this.match10 +=  Math.abs(e.properties.length*1000 - matchLength) < 5 ? 1 : 0
                this.match50 +=  Math.abs(e.properties.length*1000 - matchLength) < 50 ? 1 : 0

            }

            this.numJoins += joins[e.id] ? 1 : 0
            if(!joins[e.id]) {

                this.unJoined.push(e.id)
            
            }  else { 
                
                
                let matchLength = joins[e.id]
                    .reduce((out, curr) =>  { 
                        return out + ( curr.shst_ref_end - curr.shst_ref_start )
                    },0)
                
                this.join10 +=  Math.abs(e.properties.length*1000 - matchLength) < 5 ? 1 : 0
                this.join50 +=  Math.abs(e.properties.length*1000 - matchLength) < 50 ? 1 : 0

            }

        })
        // console.log('scheduled segments',this.schedSegments.length)
        
        this.edges = edges.features
        this.numEdges = edges.features.length
        
        this.highlightTarget(this.unMatched)
      
        this.component.forceUpdate()
        console.log('done',)

    }
    
    highlightUnJoined() {
        this.highlightTarget(this.unJoined, 'hotpink')
    }

    highlightUnMatched() {
        this.highlightTarget(this.unMatched, 'crimson')
    }

    highlightTarget(ids,color='crimson') {
        this.map.setPaintProperty(
            network, 
            "line-color",
            ["match", 
                ["string", ["get", "matchId"]], 
                [...ids],
                color,
                'slateblue'
            ]
        )
    }

    toggleTarget() {
        this.map.setLayoutProperty(
            network, 
            'visibility', 
            this.map.getLayoutProperty(network, 'visibility') === 'visible' ? 'none' : 'visible'
        );
    }

    targetOpacity (e) {
        if(e && e.target) {
            this.map.setPaintProperty(network,'line-opacity', e.target.value/100)
        }
    }   
}


 export default (props = {}) =>
    new ShstLayer("Conflation QA", {
    active: true,
    matches: {},
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
        layers: [network],// 'shst',
        dataFunc: function (feature) {
            if(feature[0].properties.fid && this.joins){
                let properties = get(this.edges.filter(d => d.properties.fid == feature[0].id),'[0].properties', {})
                
                let matchId = feature[0].properties.fid
                this.matchId = matchId
                this.matchProperties = properties

                let segments = this.joins[matchId] || []
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
               
                if(segments) {
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
        layers: ["shst",network],
        dataFunc: function (feature,map) {
            let transit = []
            
            return [['id', feature.id],...Object.keys(feature.properties).map(k => [k, feature.properties[k]]),]
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
    
    return  (

        <div style={{backgroundColor: '#fff',padding: 15}}>
            <div>
                <div style={{fontSize: '1.4em', fontWeigh: 500, borderBottom: `1px solid ${colors.primary}`, color: colors.primary }}>
                   Target Layer
                    <span style={{float: 'right'}}><input type='checkbox'  onClick={layer.toggleTarget}/></span>
                </div>
                <label style={{color: colors.light}}>Opacity</label>
                <input type="range" min="1" max="100" onChange={layer.targetOpacity} style={{width: '100%'}}/>
                <div style={{display: 'flex', padding: 10, borderRadius: 5, border: '1px solid DimGray', flexDirection: 'column'}}>
                    {layer.numMatches ? 
                        (
                        <React.Fragment>
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
                        </React.Fragment>)
                        : <div style={{flex: '1',textAlign:'center'}}><h4>Loading Conflation</h4></div>
                    }
                </div>
                <SegmentDetails layer={layer} />
            </div>
        </div>
    )
}

const SegmentDetails = ({layer}) => {

    return (
        <div>
            <div style={{padding: 10}}>
                <span style={{fontSize: '2em', padding: 5}}>{layer.matchProperties.road_name}</span>
                <span style={{padding: 5}}>{layer.matchProperties.gis_id}-{layer.matchProperties.beg_mp}</span>  
                {layer.matchProperties.begin_description || layer.matchProperties.end_description ? 
                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> <strong>from<br/></strong>  {layer.matchProperties.begin_description} </div>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> <strong>to<br/></strong>  {layer.matchProperties.end_description} </div>
                </div> : ''}
                <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>Oneway<br/></strong>  
                        {layer.matchProperties.oneway} 
                    </div>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>Divided<br/></strong>  
                        {layer.matchProperties.divided} 
                    </div>

                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>Direction<br/></strong>  
                        {layer.matchProperties.direction} 
                    </div>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>lanes<br/></strong>  
                        {layer.matchProperties.total_lanes} | {layer.matchProperties.primary_dir_lanes}
                    </div>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>length (calc)<br/></strong>  
                         {get(layer, 'matchProperties.shape_length', 0).toFixed(2) } ({ (get(layer, 'matchProperties.length',0) * 1000).toFixed(2) })
                    </div>
                    <div style={{border: '1px solid #ddd', flex:1, padding: 10}}> 
                        <strong>Type<br/></strong>  
                        {layer.matchProperties.roadway_type}
                    </div>
                </div>
            </div>
            <table>
                <tbody>
                    {layer.segments.map( (d,i) => <tr key={d.shst_match_id}><td>{d.shst_match_id}</td><td>{d.shst_reference}</td></tr>)}
                </tbody>    
            </table>
            
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