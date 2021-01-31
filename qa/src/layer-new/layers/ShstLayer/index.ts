import {Map} from 'mapbox-gl'

import MapLayer from "AvlMap/MapLayer"

// const COLOR = 'rgba(255, 255, 255, 0.95)'
const api = 'http://localhost:8080'
const networks = ['nys_ris', 'npmrds']
const network = networks[0]

export default class ShstLayer extends MapLayer {
  numMatches!: number;
  numJoins!: number;
  match10!: number;
  match50!: number;
  join10!: number;
  join50!: number;
  numEdges!: number;
  rawTargetMapFeatureProperties!: any[];
  unMatched!: any[]
  unJoined!: any[]
  schedSegments!: any[]

  constructor(...args: any) {
    super(...args)

    this.initializeStatVariables()
  }

  async onAdd(map: Map) {
    super.onAdd(map);

    const [
      shstMatches,
      chosenShstMatches,
      rawTargetMapFeatureProperties
    ] = await Promise.all([
      fetch(`${api}/${network}/shst-matches-metadata`).then(r => r.json()),
      fetch(`${api}/${network}/shst-chosen-matches`).then(r => r.json()),
      fetch(`${api}/${network}/raw-shapefile-properties`).then(r => r.json())
    ])

    console.log({
      shstMatches,
      chosenShstMatches,
      rawTargetMapFeatureProperties
    })

    this.calculateStatistics(
      shstMatches,
      rawTargetMapFeatureProperties,
      chosenShstMatches
    )

    this.toggleTarget = this.toggleTarget.bind(this)
    this.targetOpacity = this.targetOpacity.bind(this)
    this.highlightUnJoined = this.highlightUnJoined.bind(this)
    this.highlightUnMatched = this.highlightUnMatched.bind(this)
  }

  initializeStatVariables() {
    this.numMatches = 0;
    this.numJoins = 0;
    this.match10 = 0
    this.match50 = 0
    this.join10 = 0
    this.join50 = 0

    this.numEdges = 0
    this.rawTargetMapFeatureProperties = []
    this.unMatched = []
    this.unJoined = []
  }

  calculateStatistics(shstMatches, rawTargetMapFeatureProperties, chosenShstMatches) {

    rawTargetMapFeatureProperties.forEach((rawTMEdgeProps) => {

      this.numMatches += shstMatches[rawTMEdgeProps.id] ? 1 : 0
      if (!shstMatches[rawTMEdgeProps.id]) {
        this.unMatched.push(rawTMEdgeProps.id)
      } else {

        let matchLength = shstMatches[rawTMEdgeProps.id]
          .reduce((out, curr) => {return out + (curr.shst_ref_end - curr.shst_ref_start)}, 0)

        this.match10 += Math.abs(rawTMEdgeProps.featureLengthKm * 1000 - matchLength) < 5 ? 1 : 0
        this.match50 += Math.abs(rawTMEdgeProps.featureLengthKm * 1000 - matchLength) < 50 ? 1 : 0

      }

      this.numJoins += chosenShstMatches[rawTMEdgeProps.id] ? 1 : 0

      if (!chosenShstMatches[rawTMEdgeProps.id]) {

        this.unJoined.push(rawTMEdgeProps.id)

      } else {


        let matchLength = chosenShstMatches[rawTMEdgeProps.id]
          .reduce((out, curr) => {
            return out + (curr.shst_ref_end - curr.shst_ref_start)
          }, 0)

        this.join10 += Math.abs(rawTMEdgeProps.featureLengthKm * 1000 - matchLength) < 5 ? 1 : 0
        this.join50 += Math.abs(rawTMEdgeProps.featureLengthKm * 1000 - matchLength) < 50 ? 1 : 0

      }

    })

    this.rawTargetMapFeatureProperties = rawTargetMapFeatureProperties
    this.numEdges = rawTargetMapFeatureProperties.length

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

  highlightTarget(ids, color = 'crimson') {
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

  targetOpacity(rawTMEdgeProps) {
    if (rawTMEdgeProps && rawTMEdgeProps.target) {
      this.map.setPaintProperty(network, 'line-opacity', rawTMEdgeProps.target.value / 100)
    }
  }
}
