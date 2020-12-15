import React from "react"

import store from "store"
import { update } from "utils/redux-falcor/components/duck"
import { falcorGraph, falcorChunkerNiceWithUpdate } from "store/falcorGraph"
import { connect } from 'react-redux';
import { reduxFalcor, UPDATE as REDUX_UPDATE } from 'utils/redux-falcor'
import {asyncContainer, Typeahead} from 'react-bootstrap-typeahead';
import get from "lodash.get"
import styled from "styled-components"

import {
  scaleQuantile,
  scaleQuantize, scaleThreshold
} from "d3-scale"
import { extent } from "d3-array"
import { format as d3format } from "d3-format"

import { fnum } from "utils/sheldusUtils"

import MapLayer from "../MapLayer"
import { register, unregister } from "../ReduxMiddleware"
import { getColorRange } from "constants/color-ranges";
import {Link} from "react-router-dom";
var _ = require('lodash')

const LEGEND_COLOR_RANGE = getColorRange(7, "YlGn");
const LEGEND_RISK_COLOR_RANGE = getColorRange(6, "Reds");
const AsyncTypeahead = asyncContainer(Typeahead);
const IDENTITY = i => i;
let colouredBuildings = [];
let filteredBuildings = [];
let color = {};
class EBRLayer extends MapLayer {

    boundingBoxCenter(bbox,building_id){
        const SELECTED_BULDING_COLOR = "#cb181d",
            FILTERED_COLOR = "#666",
            EBR_LINE_COLOR = "#6baed6",
            DEFAULT_COLOR = "#000";

        this.map.setCenter(bbox)
        let zoom_level = this.map.getZoom()
        if(zoom_level <15){
            this.map.setZoom(15)
        }else{
            this.map.setZoom()
        }
        this.map.setPaintProperty(
            'ebr',
            'fill-color',
            ["match", ["to-string", ["get", "id"]],
                building_id.toString(), SELECTED_BULDING_COLOR,
                colouredBuildings.length ? colouredBuildings.filter(id => id !== building_id.toString()) : "no-colored", ["get", ["to-string", ["get", "id"]], ["literal",color]],
                filteredBuildings.length ? filteredBuildings.filter(id => id !== building_id.toString()) : "no-filtered", FILTERED_COLOR,
                DEFAULT_COLOR
            ],
            { validate: false }
        )

    }

    getBackToOriginalBound(area){
        if(area){
            return falcorGraph.get(['geo',area,"boundingBox"])
                .then(response =>{
                    let graph = {}
                    let bbox = []
                    if(area.length === 1){
                        graph = response.json.geo[area].boundingBox
                        let initalBbox = graph.slice(4,-1).split(",")
                        bbox = [initalBbox[0].split(" "),initalBbox[1].split(" ")]
                    }else{
                        graph = response.json.geo
                        let X_coordinates = []
                        let Y_coordinates = []
                        area.forEach(geoid => {
                            X_coordinates.push(parseFloat(graph[geoid].boundingBox.slice(4, -1).split(",")[0].split(" ")[0]))
                            X_coordinates.push(parseFloat(graph[geoid].boundingBox.slice(4, -1).split(",")[1].split(" ")[0]))
                            Y_coordinates.push(parseFloat(graph[geoid].boundingBox.slice(4, -1).split(",")[0].split(" ")[1]))
                            Y_coordinates.push(parseFloat(graph[geoid].boundingBox.slice(4, -1).split(",")[1].split(" ")[1]))
                        })
                        bbox = [
                            [Math.min(...X_coordinates), Math.min(...Y_coordinates)],
                            [Math.max(...X_coordinates), Math.max(...Y_coordinates)]
                        ]
                    }
                    this.map.resize()
                    this.map.fitBounds(bbox)
                    })

        }

    }

  onAdd(map) {
    register(this, REDUX_UPDATE, ["graph"]);
    const geoLevel = "cousubs";
    return falcorGraph.get(
        ["geo",store.getState().user.activeGeoid, geoLevel],
        ["parcel", "meta", ["prop_class", "owner_type"],
        ["geo",[store.getState().user.activeGeoid],"boundingBox"]
        ]
      )
      .then(res => res.json.geo[store.getState().user.activeGeoid][geoLevel])
      .then(geoids => {
        return falcorChunkerNiceWithUpdate(["geo", geoids, "name"])
          .then(()=>{
            return falcorChunkerNiceWithUpdate(["geo",geoids,"boundingBox"])
                .then(() =>{
                  const graph = falcorGraph.getCache().geo;
                  this.filters.area.domain = geoids.map(geoid => {
                    return { value: geoid, name: graph[geoid].name ,bounding_box: graph[geoid].boundingBox.value}
                })
                .sort((a, b) => {
                  const aCounty = a.value.slice(0, 5),
                      bCounty = b.value.slice(0, 5);
                  if (aCounty === bCounty) {
                    return a.name < b.name ? -1 : 1;
                  }
                  return +aCounty - +bCounty;
                })
            })
          })
          .then(() => {
            this.filters.owner_type.domain =
              get(falcorGraph.getCache(), ["parcel", "meta", "owner_type", "value"], [])
                .filter(({ name, value }) => name !== "Unknown")
                .sort((a, b) => +a.value - +b.value);
          })

      })
      .then(() => {
          if(localStorage.getItem("activeScenarioCousub") && localStorage.getItem("activeScenarioCousub").length !== 0){
              this.doAction(["updateFilter", "area",localStorage.getItem("activeScenarioCousub").split(',')])
          }else{
              this.doAction(["updateFilter", "area", [this.filters.area.domain[0].value]])
          }
          })
  }
  onRemove(map) {
    unregister(this);
  }
  receiveMessage(action, data) {
    this.falcorCache = data;
  }
  onFilterFetch(filterName, oldValue, newValue) {
    if (filterName === "measure") {
      switch (newValue) {
        case "num_occupants":
          this.legend.format = IDENTITY;
          break;
        case "replacement_value":
          this.legend.format = fnum;
          break;
      }
    }
    if (filterName === "prop_category") {
      if (newValue.length === 0) {
        this.filters.prop_class.active = false;
        this.filters.prop_class.domain = [];
      }
      else {
        this.filters.prop_class.active = true;
        const propClasses = get(falcorGraph.getCache(), ["parcel", "meta", "prop_class", "value"], []),
          shouldFilter = this.makeCheckPropCategoryFilter();
        this.filters.prop_class.domain = propClasses.filter(({ name, value }) => !shouldFilter(value))
      }
    }
    return this.fetchData();
  }
  getBuildingIdsFromFalcorCache() {
    const geoids = this.filters.area.value;

    if (!geoids.length) return Promise.resolve([]);

    const buildingids = [];

    for (const geoid of geoids) {
      const length = get(this.falcorCache, ["building", "byGeoid", geoid, "length"], 0);

      for (let i = 0; i <= length; ++i) {
        const id = get(this.falcorCache, ["building", "byGeoid", geoid, "byIndex", i, "value", 2], null);
        if (id !== null) {
          buildingids.push(id);
        }
      }
    }

    return Promise.resolve(buildingids);
  }
  getBuildingIds() {
    // console.log('in get building ids')
    const geoids = this.filters.area.value;

    if (!geoids.length) return Promise.resolve([]);

    return falcorGraph.get(["building", "byGeoid", geoids, "length"])
      .then(res => {
        let requests =  geoids.map(geoid => {
          const length = res.json.building.byGeoid[geoid].length;
          return ["building", "byGeoid", geoid, "byIndex", { from: 0, to: length-1}, ["id","address", "replacement_value", "owner_type", "prop_class", "num_occupants", "name", "type", "critical", "flood_zone"]]
        })
        return requests;
      })
      .then(requests => {
        return falcorGraph.get(...requests)
          .then(res => {

            const buildingids = [],
              graph = get(res.json, ["building", "byGeoid"], {});

            geoids.forEach(geoid => {
              const byIndex = get(graph, [geoid, "byIndex"], {});
              Object.values(byIndex).forEach(({ id }) => {
                if (id) {
                  buildingids.push(id)
                }
              })
            })
            // console.log('buildingids', buildingids)
            return buildingids;
          })
      })
  }
  fetchData() {
    return this.getBuildingIds()
      .then(buildingids => {
        if (!buildingids.length) return;
        return falcorChunkerNiceWithUpdate(["building", "byId", buildingids, ["address", "replacement_value", "owner_type", "prop_class", "num_occupants", "name", "type", "critical", "flood_zone"]])
          .then(() => falcorChunkerNiceWithUpdate(["building", "byId", buildingids, "riskZone", "riverine", "aal"]))
      })
      .then(() => store.dispatch(update(falcorGraph.getCache())))
  }
  makeCheckPropCategoryFilter() {
    const propCategoryFilters = this.filters.prop_category.value;

    return prop_class => {
      let prop_category = 0;
      if (prop_class.length === 3) {
        prop_category = (+prop_class[0]) * 100;
      }
      return propCategoryFilters.reduce((a, c) => a && (c !== prop_category), Boolean(propCategoryFilters.length));
    }
  }
  makeCheckPropClassFilter() {
    const propClassFilters = this.filters.prop_class.value;
    if (!propClassFilters.length) return this.makeCheckPropCategoryFilter();

    return prop_class => propClassFilters.reduce((a, c) => a && (c != prop_class), true);
  }
  makeCheckOwnerTypeFilter() {
    const ownerTypeFilters = this.filters.owner_type.value;

    return owner_type => ownerTypeFilters.reduce((a, c) => a && (c != owner_type), Boolean(ownerTypeFilters.length));
  }
  makeShouldFilter() {
    const propClassFilter = this.makeCheckPropClassFilter(),
      ownerTypeFilter = this.makeCheckOwnerTypeFilter();

    return ({ owner_type, prop_class }) => propClassFilter(prop_class) || ownerTypeFilter(owner_type);
  }
  getBuildingRisks({ flood_zone }) {
    return [
      this.getFloodZone(flood_zone)
    ].filter(r => Boolean(r));
  }
  getFloodZone(flood_zone) {
    if (!Boolean(flood_zone)) return false;

    switch ((flood_zone + "").slice(0, 1).toLowerCase()) {
      case "a":
      case "v":
        return "100-year";
      case "x":
      case "b":
        return "500-year";
      default:
        return false;
    }
  }

  render(map) {
    return this.getBuildingIdsFromFalcorCache()
      .then(buildingids => {
          const filteredBuildingids = [];
        const shouldFilter = this.makeShouldFilter();

        if (this.filters.measure.value === 'riskZone') {
          this.legend.type = 'threshold'
          this.legend.domain = [100, 1000, 10000, 50000, 250000]
          this.legend.range = LEGEND_RISK_COLOR_RANGE;
        } else {
          this.legend.type = 'quantile'
          this.legend.range = LEGEND_COLOR_RANGE;
        }
        const byIdGraph = get(falcorGraph.getCache(), ["building", "byId"], {}),
          measure = this.filters.measure.value,
          data = [],
            legendData = [];
        let legendMeasure = ''
        buildingids.forEach((id,i) => {
          const prop_class = get(byIdGraph, [id, "prop_class"], "000") + "",
            owner_type = get(byIdGraph, [id, "owner_type"], "-999") + "",
            flood_zone = get(byIdGraph, [id, "flood_zone"], null),
            risks = this.getBuildingRisks({ flood_zone });
          if(measure === "riskZone") {
            let expected_annual_loss_value = +get(byIdGraph, [id,measure, 'riverine','aal'])
            legendMeasure = "replacement_value"
            data.push({id,measure,value : expected_annual_loss_value,risks})
            legendData.push({ id,legendMeasure, value: +get(byIdGraph, [id, "replacement_value"], 0), risks })
          }
          else if (!shouldFilter({ prop_class, owner_type })) {
              data.push({ id, measure, value: +get(byIdGraph, [id, measure], 0), risks });
              legendMeasure = "riskZone"
              legendData.push({id,legendMeasure,value : +get(byIdGraph, [id,"riskZone", 'riverine','aal'],0),risks});
          }
          else {
            filteredBuildingids.push(id.toString());
            filteredBuildings.push(id.toString());
          }
        });
        return [filteredBuildingids, data,legendData]
      })
      .then(([filteredBuildingids = [], data = [], legendData = []]) => {
        const riskFilter = this.filters.risk.value,
          atRiskIds = [];
        this.infoBoxes["measure"].show = Boolean(data.length);
        this.measureData = data;
        this.legendData = legendData;
        const coloredBuildingIds = [];
        const colorScale = this.getColorScale(data),
          colors = data.reduce((a, c) => {
            a[c.id] = colorScale(c.value);
            coloredBuildingIds.push(c.id.toString());
            colouredBuildings.push(c.id.toString());
            if (riskFilter.reduce((aa, cc) => aa || c.risks.includes(cc), false)) {
              atRiskIds.push(c.id.toString());
            }
            return a;
          }, {});
        color = colors

// REDDS: ["#fee5d9", "#fcbba1", "#fc9272", "#fb6a4a", "#ef3b2c", "#cb181d", "#99000d"]
        const SELECTED_BULDING_COLOR = "#cb181d",
          FILTERED_COLOR = "#666",
          DEFAULT_COLOR = "#000",
          EBR_LINE_COLOR = "#6baed6";

        const selectedBuildingId = this.modals.building.show ? this.selectedBuildingId : "none";

        map.setFilter("ebr-line", ["in", "id", ...atRiskIds.map(id => +id)]);

        map.setPaintProperty(
          "ebr-line",
          "line-color",
          ["match", ["to-string", ["get", "id"]],
            selectedBuildingId, SELECTED_BULDING_COLOR,
            EBR_LINE_COLOR
          ]
        )


          map.setPaintProperty(
              'ebr',
              'fill-color',
              ["match", ["to-string", ["get", "id"]],
                  selectedBuildingId, SELECTED_BULDING_COLOR,
                  coloredBuildingIds.length ? coloredBuildingIds.filter(id => id !== selectedBuildingId) : "no-colored", ["get", ["to-string", ["get", "id"]], ["literal", colors]],
                  filteredBuildingids.length ? filteredBuildingids.filter(id => id !== selectedBuildingId) : "no-filtered", FILTERED_COLOR,
                  DEFAULT_COLOR
              ],
              { validate: false }
          )

      })
  }
  getColorScale(data) {
    const { type, range, domain } = this.legend;
    switch (type) {
      case "quantile": {
        const domain = data.map(d => d.value).filter(d => d).sort();
        this.legend.domain = domain;
        return scaleQuantile()
          .domain(domain)
          .range(range);
      }
      case "quantize": {
        const domain = extent(data, d => d.value);
        this.legend.domain = domain;
        return scaleQuantize()
          .domain(domain)
          .range(range);
      }
      case "threshold": {
        return scaleThreshold()
            .domain(domain)
            .range(range)
      }
    }
  }
}

const getFilterName = (layer, filterName, value = null) =>
    value === null ?
        layer.filters[filterName].domain.reduce((a, c) => c.value === layer.filters[filterName].value ? c.name : a, null)
        :
        layer.filters[filterName].domain.reduce((a, c) => c.value === value ? c.name : a, null)


const getPropClassName = (falcorCache, value) =>
  get(falcorCache, ["parcel", "meta", "prop_class", "value"], [])
    .reduce((a, c) => c.value == value ? c.name : a, "Unknown")

let geoFilter = function (map, layer, value) {
    let bbox = []
    let X_coordinates= []
    let Y_coordinates= []
    localStorage.setItem("activeScenarioCousub",layer.filters.area.value)
    let currentValues = layer.filters.area.domain.filter(d => layer.filters.area.value.includes(d.value))
    if(currentValues && currentValues.length !== 0){
        if (currentValues.length === 1){
            currentValues.forEach(value =>{
                if (layer.filters.area.value.includes(value.value)){
                    let initalBbox = value.bounding_box.slice(4,-1).split(",")
                    bbox = [initalBbox[0].split(" "),initalBbox[1].split(" ")]
                }
            })
        }
        else{
            currentValues.forEach(value =>{
                X_coordinates.push(parseFloat(value.bounding_box.slice(4,-1).split(",")[0].split(" ")[0]))
                X_coordinates.push(parseFloat(value.bounding_box.slice(4,-1).split(",")[1].split(" ")[0]))
                Y_coordinates.push(parseFloat(value.bounding_box.slice(4,-1).split(",")[0].split(" ")[1]))
                Y_coordinates.push(parseFloat(value.bounding_box.slice(4,-1).split(",")[1].split(" ")[1]))
            })
            bbox = [
                [Math.min(...X_coordinates),Math.min(...Y_coordinates)],
                [Math.max(...X_coordinates),Math.max(...Y_coordinates)]
                ]
        }
        map.resize()
        map.fitBounds(bbox)

    }

}

const EBR = (options = {}) =>
  new EBRLayer("Enhanced Building Risk", {
    active: true,
    falcorCache: {},
    measureData: [],
    sources: [
      { id: "nys_buildings_avail",
        source: {
          'type': "vector",
          'url': 'mapbox://am3081.dpm2lod3'
        }
      }
    ],
    layers: [
      { 'id': 'ebr',
          'source': 'nys_buildings_avail',
          'source-layer': 'nys_buildings_osm_ms_parcelid_pk',
          'type': 'fill',
          'minzoom': 8,
          'paint': {
              'fill-color': '#000000'
          }

      },
      { id: "ebr-line",
        'source': 'nys_buildings_avail',
        'source-layer': 'nys_buildings_osm_ms_parcelid_pk',
        'type': 'line',
        'minzoom': 8,
        'paint': {
// BLUES: ["#eff3ff", "#c6dbef", "#9ecae1", "#6baed6", "#4292c6", "#2171b5", "#084594"]
            'line-color': '#6baed6',
            'line-width': 3,
            'line-offset': -1
        },
        filter: ["in", "id", "none"]
      }
    ],
    legend: {
      title: ({ layer }) => <>{ getFilterName(layer, "measure") }</>,
      type: "quantile",
      types: ["quantile", "quantize"],
      vertical: false,
      range: LEGEND_COLOR_RANGE,
      active: true,
      domain: [],
      format: fnum
    },
    popover: {
      layers: ["ebr", "ebr-line"],
      dataFunc: function(topFeature, features) {
        const { id } = topFeature.properties,
          graph = get(this.falcorCache, ["building", "byId", id], {}),
          attributes = [
            [null, ["address"]],
            ["Name", ["name"]],
            ["Replacement Cost", ["replacement_value"], fnum],
            ["Owner Type", ["owner_type"], d => getFilterName(this, "owner_type", d)],
            ["Land Use", ["prop_class"], d => getPropClassName(this.falcorCache, d)],
            ["Type", ["type"]],
            ["Critical Facilities (FCode)", ["critical"]],
            ["Flood Zone", ["flood_zone"]],
            ["Expected Annual Flood Loss", ["riskZone", "riverine", "aal"], fnum]
          ];
        const data = attributes.reduce((a, [name, key, format = IDENTITY]) => {
          const data = get(graph, key, false)
          if (data && (name === null)) {
            a.push(format(data));
          }
          else if (data && (name !== null)) {
            a.push([name, format(data)]);
          }
          return a;
        }, [])
        if (data.length) {
          data.push(["Building ID", id]);
          return data;
        }
        return data;
      },
      minZoom: 13
    },

    selectedBuildingId: "none",

    filters: {
      area: {
        name: 'Area',
        type: 'multi',
        domain: [],
        onChange: geoFilter,
        value: []
      },
      owner_type: {
        name: "Owner Type",
        type: "multi",
        domain: [],
        value: []
      },
      prop_category: {
        name: "Property Category",
        type: "multi",
        domain: [
          { value: 100, name: "Agriculture" },
          { value: 200, name: "Residential" },
          { value: 300, name: "Vacant Land" },
          { value: 400, name: "Commercial" },
          { value: 500, name: "Recreation & Entertainment" },
          { value: 600, name: "Community Services" },
          { value: 700, name: "Industrial" },
          { value: 800, name: "Public Services" },
          { value: 900, name: "Wild, Forested, Conservation Lands & Public Parks" },
        ],
        value: []
      },
      prop_class: {
        name: "Property Class",
        type: "multi",
        domain: [],
        value: [],
        active: false
      },
      risk: {
        name: "Risk",
        type: "multi",
        domain: [
          { value: "100-year", name: "100-year Flood Zone" },
          { value: "500-year", name: "500-year Flood Zone" }
        ],
        value: []
      },
      measure: {
        name: "Measure",
        type: "single",
        domain: [
          { value: "replacement_value", name: "Replacement Cost" },
          { value: "num_occupants", name: "Number of Occupants" },
          { value: "riskZone",name: "Expected Annual Flood Loss"}
        ],
        value: "replacement_value"
      }
    },
    infoBoxes: {
      measure: {
        title: function({layer}) {
          return(
              <>{ `${ getFilterName(layer, "measure") } Info ` }</>
          )
        },
        comp: MeasureInfoBox,
        show: false
      }
    },

    onClick: {
      layers: ["ebr"],
      dataFunc: function(features) {
        if (!features.length) return;

        const props = { ...features[0].properties };

        this.selectedBuildingId = props.id.toString();
        this.map && this.render(this.map);

        this.modals.building.show
          ? this.doAction(["updateModal", "building", props])
          : this.doAction(["toggleModal", "building", props]);
      }
    },
    modals: {
      building: {
        comp: BuildingModal,
        show: false,
        onClose: function() {
          this.map && this.render(this.map);
        }
      }
    },
    ...options
  })


const MeasureInfoBox = ({ layer}) => {

  let format = d => d;
  let replacement_value = '';
  let flood_loss_value = '';
  switch (layer.filters.measure.value) {
    case "replacement_value":
    case "riskZone":
      format = fnum;
      break;
    case "num_occupants":
      format = d3format(",d");
      break;
  }
  if (layer.filters.measure.value === "riskZone"){
    replacement_value = format(layer.legendData.reduce((a, c) => a + c.value, 0))
    flood_loss_value = format(layer.measureData.reduce((a, c) => a + c.value, 0))
  }else if(layer.filters.measure.value === "replacement_value"){
    replacement_value = format(layer.measureData.reduce((a, c) => a + c.value, 0))
    flood_loss_value = format(layer.legendData.reduce((a, c) => a + c.value, 0))
  }
  return (
      <div>
        <table className="table table-sm"
               style={ {
                   margin: "0px",
                   fontSize: "1rem"
               } }>
            <tbody>
            {replacement_value && replacement_value !== "$0" ?
                <tr>
                    <td>Replacement Value Total</td>
                    <td>{ replacement_value }</td>
                </tr>
                :
                null
            }

            {flood_loss_value && flood_loss_value !== "$0" ?
                <tr>
                    <td>Expected Annual Flood Loss Total </td>
                    <td>{ flood_loss_value }</td>
                </tr>
                :
                null
            }
            {
                layer.filters.risk.value.map(r =>
                    <tr key={ r }>
                        <td>{ `${ getFilterName(layer, "risk", r) } Total` }</td>
                        <td>{ format(layer.measureData.filter(({ risks }) => risks.includes(r)).reduce((a, c) => a + c.value, 0)) }</td>
                    </tr>
                )
            }
            {
                <tr>
                    <td>Search For an Address</td>
                    <td>
                        <AddressSearch
                            layer = {[layer]}
                        />
                    </td>
                </tr>
            }
            </tbody>
        </table>
      </div>


  )
}
export default EBR
const TabBase = ({ name, props, data, meta }) => {
    console.log('tab base data', data)
    let rows = [];
    let headers = [];
    if (name === 'Actions'){
        data.actionsData
            .map((action,action_i) => {
                let row = props.reduce((a, c) => {
                    const d = get(action, [c], null);
                     if (!headers.includes(formatPropName(c))) headers.push(formatPropName(c))
                    a.push(
                            <td>{ (d !== null) && (d !== 'null') ? formatPropValue(c, d, meta) : "unknown" }</td>
                    )
                    return a;
                }
                ,[])
                row.push(
                    <td>
                        <Link
                            className="btn btn-sm btn-primary"
                            to={ `/actions/project/view/${action['id']}` } >
                            View Action
                        </Link>
                    </td>
                )
                rows.push(row)
            })
    }else{
         rows = props.reduce((a, c) => {
            const d = (c === "expected_annual_flood_loss") ?
                get(data, ["riskZone", "riverine", "aal"], null)
                :
                get(data, [c], null);
            a.push(
                <tr key={ c }>
                    <td>{ formatPropName(c) }</td>
                    <td>{ (d !== null) && (d !== 'null') ? formatPropValue(c, d, meta) : "unknown" }</td>
                </tr>
            )
            return a;
        },[])
    }
  return name === 'Actions' ?
      (
          <table className='table table-lightborder'>
              <thead>
              {headers.map(h => <th> {h} </th>)}
              </thead>
              <tbody>
              { rows.map((r,r_i) => <tr key={ r_i }> {r} </tr>) }
              </tbody>
          </table>
      ) : (
    <table>
      <tbody>
        { rows }
      </tbody>
    </table>
  )
}

const TABS = [
  { name: "Basic",
    props: [
      "address",
      "name",
      "prop_class",
      "owner_type",
      "replacement_value",
      "critical"
    ] },
  { name: "Occupany",
    props: [
      "num_residents",
      "num_employees",
      "num_occupants",
      "num_vehicles_inhabitants"
    ] },
  { name: "Structural",
    props: [
      "num_units",
      "basement",
      "building_type",
      "roof_type",
      "height",
      "num_stories",
      "structure_type",
      "bldg_style",
      "sqft_living",
      "nbr_kitchens",
      "nbr_full_baths",
      "nbr_bedrooms",
      "first_floor_elevation"
    ] },
  { name: "Services",
    props: [
      "heat_type"
    ] },
  { name: "Commercial",
    props: [
      "replacement_value",
      "naics_code",
      "census_industry_code",
      "contents_replacement_value",
      "inventory_replacement_value",
      "establishment_revenue",
      "business_hours"
    ] },
  { name: "Risk",
    props: [
      "seismic_zone",
      "flood_plain",
      "flood_depth",
      "flood_duration",
      "flood_velocity",
      "high_wind_speed",
      "soil_type",
      "storage_hazardous_materials",
      "topography",
      "expected_annual_flood_loss"
    ] },
    { name: "Actions",
        props: [
            "action_name",
            "action_type"
        ] }
]

const formatPropName = prop =>
  prop.split("_")
    .map(string => string[0].toUpperCase() + string.slice(1))
    .map(string => string.replace(/Nbr|Num/, "Number of"))
    .map(string => string.replace("Prop", "Property"))
    .map(string => string.replace("Value", "Cost"))
    .join(" ")
const formatPropValue = (prop, value, meta) => {
  const string = get(meta, [prop, "value"], [])
    .reduce((a, c) => c.value === value ? c.name : a, value);
  if (/value/.test(prop) || /loss/.test(prop)) {
    return d3format("$,d")(string);
  }
  return string;
}

const BuildingContainer = styled.div`
  color: ${ props => props.theme.textColor };
  padding-top: 15px;
  width: 100%;
  min-width: 500px;

  h4 {
    color: ${ props => props.theme.textColorHl };
  }
`

class BuildingModalBase extends React.Component {
  state = {
    tab: TABS[0].name
  }
  fetchFalcorDeps() {
    return this.props.falcor.get(
      ["building", "byId", this.props.id, TABS.filter(tab => tab.name !== 'Actions').reduce((a, c) => [...a, ...c.props], [])],
      ["parcel", "meta", ["prop_class", "owner_type"]],
      ["building","byId", this.props.id, "riskZone", "riverine", "aal"],
        ['actions', 'assets','byId',[this.props.id],['action_name','action_type']]
    )
    .then(res => console.log("RES:" ,res))
  }
  renderTab() {
    const data = TABS.find(t => t.name === this.state.tab);
    let actionsData = this.props.actionsData &&
        this.props.actionsData[this.props.id] &&
        this.props.actionsData[this.props.id].value ?
        this.props.actionsData[this.props.id].value : {}
    return (
      <TabBase { ...data }
        meta={ this.props.parcelMeta }
        data={ {...this.props.buildingData, actionsData: actionsData}}/>
    )
  }
  render() {
    const { layer, buildingData } = this.props,
      address = get(buildingData, "address", false),
      name = get(buildingData, "name", false);
    return (
      <BuildingContainer>
        { address || name ?
          <h4>
            { address || name }
          </h4>
          : null
        }
        <div style={ { width: "100%", display: "flex", padding: "10px 0px" } }>
          { TABS.map(({ name }) =>
              <TabSelector name={ name } key={ name }
                isActive={ name === this.state.tab }
                select={ tab => this.setState({ tab }) }/>
            )
          }
        </div>
        { this.renderTab() }
      </BuildingContainer>
    )
  }
}

class AddressSearch extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            isLoading: false,
            options: [],
            allowNew: true,
            multiple: false,
        };
        this.handleSearch = this.handleSearch.bind(this);

    }

    handleSearch(query) {
        this.setState({
            isLoading: true
        })
        if (query.length >= 3) {
            let prop_class = [];
            let risk = [];
            let owner_type = [];
            if (this.props.layer[0].filters.prop_category.value.length === 0 && this.props.layer[0].filters.prop_class.value.length === 0) {
                prop_class = ['no_prop']
            } else if (this.props.layer[0].filters.prop_category.value.length >= 1 && this.props.layer[0].filters.prop_class.value.length === 0) {
                prop_class = this.props.layer[0].filters.prop_category.value
            } else if (this.props.layer[0].filters.prop_category.value.length >= 1 && this.props.layer[0].filters.prop_class.value.length >= 1) {
                prop_class = this.props.layer[0].filters.prop_class.value
            }
            if (this.props.layer[0].filters.risk.value.length === 0) {
                risk = ['no_risk']
            }
            if (this.props.layer[0].filters.risk.value.length >= 1) {
                if (this.props.layer[0].filters.risk.value.includes("100-year")) {
                    risk = ["flood_100"]
                } else {
                    risk = ["flood_500"]
                }
            }
            if (this.props.layer[0].filters.owner_type.value.length === 0) {
                owner_type = ['no_owner']
            } else {
                owner_type = this.props.layer[0].filters.owner_type.value
            }
            if(this.props.layer[0].filters.measure.value[0] === "riskZone"){
                return falcorGraph.get(['building','byGeoid', this.props.layer[0].filters.area.value,'propType',prop_class,'ownerType',owner_type,'text',query,'numResults',[10],'expected_annual_flood_loss'])
                    .then(response =>{
                        let graph = response.json.building.byGeoid
                        if(graph){
                            let addressData = []
                            this.props.layer[0].filters.area.value.forEach(geoid => {
                                prop_class.forEach(prop => {
                                    addressData.push(graph[geoid].propType[prop].ownerType[owner_type].text[query].numResults[10].expected_annual_flood_loss)
                                })

                            })
                            this.setState({
                                isLoading: false,
                                options:  addressData.flat(1) ? addressData.flat(1) : []
                            })
                        }
                    })
            }else{
                return falcorGraph.get(['building', 'byGeoid', this.props.layer[0].filters.area.value, 'propType',prop_class,'ownerType',owner_type,'risk',risk,'text',query,'numResults', [10],'address'])
                    .then(response => {
                        let graph = response.json.building.byGeoid
                        if (graph) {
                            let addressData = []
                            this.props.layer[0].filters.area.value.forEach(geoid => {
                                prop_class.forEach(prop => {
                                    addressData.push(graph[geoid].propType[prop].ownerType[owner_type].risk[risk].text[query].numResults[10].address)
                                })

                            })
                            this.setState({
                                isLoading: false,
                                options:  addressData.flat(1) ? addressData.flat(1) : []
                            })
                        }

                    })
            }
        }
    }


    onChangeFilter(selected) {
        let building = selected.map(d => d.address)
        let building_id = selected.map(d => d.building_id)
        if (building_id.length === 1) {
            return falcorGraph.get(['parcel', 'byAddress', building, 'lng_lat'])
                .then(response => {
                    let point = response.json.parcel.byAddress[building]
                    if (point) {
                        this.props.layer[0].boundingBoxCenter(point.lng_lat, building_id)
                    }

                })
        }
        if(building_id.length === 0){
            this.props.layer[0].getBackToOriginalBound(this.props.layer[0].filters.area.value)
        }
    }

    render(){
        return (
            <div>
                <AsyncTypeahead
                    isLoading = {this.state.isLoading}
                    labelKey={option => `${option.address}`}
                    id="my-typeahead-id"
                    minLength={3}
                    onSearch={this.handleSearch}
                    placeholder="Search for an address..."
                    options = {this.state.options}
                    onChange = {this.onChangeFilter.bind(this)}
                />
            </div>
        )
    }
}

const mapStateToProps = (state, { id }) => ({
  buildingData: get(state, ["graph", "building", "byId", id], {}),
  parcelMeta: get(state, ["graph", "parcel", "meta"], {}),
  buildingRiskData : get(state,["graph","building","byId"]),
  actionsData : get(state,["graph","actions","assets","byId"])
});
const mapDispatchToProps = {};

const BuildingModal = connect(mapStateToProps, mapDispatchToProps)(reduxFalcor(BuildingModalBase))
const AddSearch = connect(mapStateToProps,mapDispatchToProps)(reduxFalcor(AddressSearch))

const TabSelector = ({ name, isActive, select }) =>
  <StyledTabSelector isActive={ isActive }
    onClick={ e => select(name) }>
    { name }
  </StyledTabSelector>

const StyledTabSelector = styled.div`
  border-bottom: ${ props => props.isActive ? `2px solid ${ props.theme.textColorHl }` : 'none' };
  color: ${ props => props.isActive ? props.theme.textColorHl : props.theme.textColor };
  width: ${ 100 / TABS.length }%;
  padding: 2px 5px;
  transition: color 0.15s, background-color 0.15s;
  :hover {
    cursor: pointer;
    color: ${ props => props.theme.textColorHl };
    background-color: ${ props => props.theme.panelBackgroundHover };
  }
`
