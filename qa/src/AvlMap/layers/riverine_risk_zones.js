import React from "react"

import store from "store"
import { update } from "utils/redux-falcor/components/duck"
import { falcorGraph, falcorChunkerNice } from "store/falcorGraph"
import { connect } from 'react-redux';
import { reduxFalcor, UPDATE as REDUX_UPDATE } from 'utils/redux-falcor'

import get from "lodash.get"
import styled from "styled-components"

import {
    scaleQuantile,
    scaleQuantize
} from "d3-scale"
import { extent } from "d3-array"
import { format as d3format } from "d3-format"

import { fnum } from "utils/sheldusUtils"

import MapLayer from "../MapLayer"
import { register, unregister } from "../ReduxMiddleware"

import { getColorRange } from "constants/color-ranges";
const LEGEND_COLOR_RANGE = getColorRange(7, "YlGn");

const IDENTITY = i => i;

class RiverineRiskZones extends MapLayer{
}


export default (options = {}) =>
    new RiverineRiskZones("Riverine Risk Zones", {
        active: true,
        ...options,
        sources: [
            { id: "riverine_risk_layer",
                source: {
                    'type': "vector",
                    'url': 'mapbox://am3081.9kl7zknl'
                }
            }
        ],
        layers: [
            { 'id': 'riverine_risk_layer',
                'source': 'riverine_risk_layer',
                'source-layer': '59_riverine_500',
                'type': 'fill',
                'minzoom': 8,
                'paint': {
                    'fill-color': ["interpolate",
                        ["linear"],
                        ["get", "depth_m"],
                        0,
                        "hsl(211, 0%, 100%)",
                        10,
                        "hsl(211, 75%, 53%)",
                        20,
                        "hsl(211, 83%, 39%)",
                        30,
                        "hsl(211, 64%, 44%)",
                        40,
                        "hsl(211, 91%, 33%)",
                        50,
                        "hsl(211, 83%, 31%)",
                        60,
                        "hsl(211, 35%, 33%)",
                        70,
                        "hsl(211, 89%, 38%)",
                        80,
                        "hsl(211, 83%, 31%)",
                        83,
                        "hsl(211, 83%, 31%)"
                    ]
                },

            }
        ],
        filters: {
            risk: {
                name: "Risk",
                type: "single",
                domain: [
                    { value: "500", name: "500-year Flood Zone" },
                    { value: "100", name: "100-year Flood Zone" },
                    { value: "50", name: "50-year Flood Zone"},
                    { value: "25", name: "25-year Flood Zone"}
                ],
                value: "500",
                onChange: function (map, layer, value){
                    layer.filters.county.domain.forEach(d =>{
                        if (d.value === layer.filters.county.value){
                            let source_layer = d.value + "_riverine_"+ value
                            if (map.getLayer('riverine_risk_layer')){
                                map.removeLayer('riverine_risk_layer');
                            }

                            if (map.getSource('riverine_risk_layer')){
                                map.removeSource('riverine_risk_layer');
                            }
                            map.addSource('riverine_risk_layer', {
                                'type': "vector",
                                'url': 'mapbox://am3081.9kl7zknl'
                            });
                            map.addLayer({
                                'id': 'riverine_risk_layer',
                                'source': 'riverine_risk_layer',
                                'source-layer': source_layer,
                                'type': 'fill',
                                'minzoom': 8,
                                'paint': {
                                    'fill-color': ["interpolate",
                                        ["linear"],
                                        ["get", "depth_m"],
                                        0,
                                        "hsl(211, 0%, 100%)",
                                        10,
                                        "hsl(211, 75%, 53%)",
                                        20,
                                        "hsl(211, 83%, 39%)",
                                        30,
                                        "hsl(211, 64%, 44%)",
                                        40,
                                        "hsl(211, 91%, 33%)",
                                        50,
                                        "hsl(211, 83%, 31%)",
                                        60,
                                        "hsl(211, 35%, 33%)",
                                        70,
                                        "hsl(211, 89%, 38%)",
                                        80,
                                        "hsl(211, 83%, 31%)",
                                        83,
                                        "hsl(211, 83%, 31%)"
                                    ]

                                }
                            });
                        }
                    });
                }
            },
            county: {
                name: "County",
                type: "single",
                domain: [
                    { value : "59",name: "Delaware"},
                    { value : "56",name: "Fulton"},
                    { value : "10",name: "Hamilton"},
                    { value : "32",name: "Sullivan"},
                    { value : "13",name: "Tompkins"}
                ],
                value: "59",
                onChange: function (map, layer, value){
                    layer.filters.risk.domain.forEach(d =>{
                        if (d.value === layer.filters.risk.value){
                            let source_layer = value + "_riverine_" + d.value
                            if (map.getLayer('riverine_risk_layer')){
                                map.removeLayer('riverine_risk_layer');
                            }

                            if (map.getSource('riverine_risk_layer')){
                                map.removeSource('riverine_risk_layer');
                            }
                            map.addSource('riverine_risk_layer', {
                                'type': "vector",
                                'url': 'mapbox://am3081.9kl7zknl'
                            });
                            map.addLayer({
                                'id': 'riverine_risk_layer',
                                'source': 'riverine_risk_layer',
                                'source-layer': source_layer,
                                'type': 'fill',
                                'minzoom': 8,
                                'paint': {
                                    'fill-color': ["interpolate",
                                        ["linear"],
                                        ["get", "depth_m"],
                                        0,
                                        "hsl(211, 0%, 100%)",
                                        10,
                                        "hsl(211, 75%, 53%)",
                                        20,
                                        "hsl(211, 83%, 39%)",
                                        30,
                                        "hsl(211, 64%, 44%)",
                                        40,
                                        "hsl(211, 91%, 33%)",
                                        50,
                                        "hsl(211, 83%, 31%)",
                                        60,
                                        "hsl(211, 35%, 33%)",
                                        70,
                                        "hsl(211, 89%, 38%)",
                                        80,
                                        "hsl(211, 83%, 31%)",
                                        83,
                                        "hsl(211, 83%, 31%)"
                                    ]
                                }
                            });
                        }
                    });
                }
            }
        }

    })


const mapStateToProps = (state, { id }) => ({

});
const mapDispatchToProps = {};
