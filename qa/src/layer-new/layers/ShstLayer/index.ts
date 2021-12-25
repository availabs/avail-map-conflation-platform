import {Map} from 'mapbox-gl'

import * as ss from 'simple-statistics'

import MapLayer from "AvlMap/MapLayer"


import {SharedStreetsReferenceId} from '../../../domain/TargetMapConflationBlackboardDomain/types'

// const COLOR = 'rgba(255, 255, 255, 0.95)'
const api = 'http://localhost:8080'
const networks = ['nys_ris', 'npmrds']
const network = networks[0]

export default class ShstLayer extends MapLayer {
  rawTargetMapFeatureProperties!: any[];
  shstMatches!: any[];
  chosenMatches!: any[];

  numUnidirectional!: number;

  numMatched!: number;
  numChosenForwardMatched!: number;
  numChosenBackwardMatched!: number;

  match10!: number;
  match50!: number;

  meanShstMatchLenDiff!: number;
  medianShstMatchLenDiff!: number;
  stddevShstMatchLenDiff!: number;
  varShstMatchLenDiff!: number;

  chosenForward10!: number;
  chosenForward50!: number;

  meanFChosenMatchLenDiff!: number;
  medianFChosenMatchLenDiff!: number;
  stddevFChosenMatchLenDiff!: number;
  varFChosenMatchLenDiff!: number;

  chosenBackward10!: number;
  chosenBackward50!: number;

  meanBChosenMatchLenDiff!: number;
  medianBChosenMatchLenDiff!: number;
  stddevBChosenMatchLenDiff!: number;
  varBChosenMatchLenDiff!: number;

  numEdges!: number;
  unMatched!: any[]
  unChosenMatched!: any[]
  unJoined!: any[]
  schedSegments!: any[]

  constructor(...args: any) {
    super(...args)

    this.initializeStatVariables()
  }

  async onAdd(map: Map) {
    super.onAdd(map);

    const [
      rawTargetMapFeatureProperties,
      shstMatches,
      chosenMatches,
    ] = await Promise.all([
      fetch(`${api}/${network}/raw-shapefile-properties`).then(r => r.json()),
      fetch(`${api}/${network}/shst-matches-metadata`).then(r => r.json()),
      fetch(`${api}/${network}/shst-chosen-matches`).then(r => r.json()),
    ])

    this.rawTargetMapFeatureProperties = rawTargetMapFeatureProperties
    this.shstMatches = shstMatches
    this.chosenMatches = chosenMatches

    this.numEdges = this.rawTargetMapFeatureProperties.length

    this.numUnidirectional = this.rawTargetMapFeatureProperties.reduce(
      (acc, tmEdgeProps) => acc + +(tmEdgeProps.isUnidirectional),
      0
    )

    console.log({
      rawTargetMapFeatureProperties,
      shstMatches,
      chosenMatches,
    })

    this.calculateShstMatchStatistics()
    this.calculateChosenShstMatchStatistics()

    this.component.forceUpdate()

    this.toggleTarget = this.toggleTarget.bind(this)
    this.targetOpacity = this.targetOpacity.bind(this)
    this.highlightUnJoined = this.highlightUnJoined.bind(this)
    this.highlightUnMatched = this.highlightUnMatched.bind(this)
  }

  initializeStatVariables() {
    this.numMatched = 0;

    this.numEdges = 0
    this.rawTargetMapFeatureProperties = []
    this.unMatched = []
    this.unChosenMatched = []
    this.unJoined = []
  }

  calculateShstMatchStatistics() {
    this.numMatched = 0
    this.match10 = 0
    this.match50 = 0

    const matchLenDiffs: number[] = []

    this.rawTargetMapFeatureProperties.forEach((rawTMEdgeProps) => {
      const {featureLengthKm, isUnidirectional} = rawTMEdgeProps

      const tmEdgeMatches = this.shstMatches[rawTMEdgeProps.id]

      if (!tmEdgeMatches) {
        this.unMatched.push(rawTMEdgeProps.id)
      } else {
        this.numMatched += 1

        const mergedShstMatchLengths = tmEdgeMatches.reduce(
          (acc: Record<SharedStreetsReferenceId, number[]>, shstMatch: any) => {
            const {shstReferenceId, shst_ref_start, shst_ref_end} = shstMatch

            acc[shstReferenceId] = acc[shstReferenceId] || [Infinity, -Infinity]

            if (shst_ref_start < acc[shstReferenceId][0]) {
              acc[shstReferenceId][0] = shst_ref_start
            }

            if (shst_ref_end > acc[shstReferenceId][1]) {
              acc[shstReferenceId][1] = shst_ref_end
            }

            return acc
          }, {})

        const totalShstMatchLengths = Object.keys(mergedShstMatchLengths)
          .reduce(
            (acc, shstRefId) =>
              acc + mergedShstMatchLengths[shstRefId][1] - mergedShstMatchLengths[shstRefId][0],
            0)

        const shstMatchLenPerDirection = isUnidirectional ? totalShstMatchLengths : totalShstMatchLengths / 2

        const matchLenDiff = Math.abs(featureLengthKm * 1000 - shstMatchLenPerDirection)
        matchLenDiffs.push(matchLenDiff)

        this.match10 += matchLenDiff < 10 ? 1 : 0
        this.match50 += matchLenDiff < 50 ? 1 : 0
      }
    })

    this.meanShstMatchLenDiff = ss.mean(matchLenDiffs)
    this.medianShstMatchLenDiff = ss.median(matchLenDiffs)
    this.stddevShstMatchLenDiff = ss.standardDeviation(matchLenDiffs)
    this.varShstMatchLenDiff = ss.variance(matchLenDiffs)
  }

  calculateChosenShstMatchStatistics() {
    this.numChosenForwardMatched = 0
    this.numChosenBackwardMatched = 0
    this.chosenForward10 = 0
    this.chosenForward50 = 0
    this.chosenBackward10 = 0
    this.chosenBackward50 = 0

    const forwardMatchLenDiffs: number[] = []
    const backwardMatchLenDiffs: number[] = []

    this.rawTargetMapFeatureProperties.forEach((rawTMEdgeProps) => {
      const {featureLengthKm} = rawTMEdgeProps

      const tmEdgeChosenMatches = this.chosenMatches[rawTMEdgeProps.id]

      if (!tmEdgeChosenMatches) {
        this.unChosenMatched.push(rawTMEdgeProps.id)
      } else {
        type MergedChosenMatchLengths = {
          forward: Record<SharedStreetsReferenceId, number[]>,
          backward: Record<SharedStreetsReferenceId, number[]>
        }

        const mergedChosenMatchLengths = tmEdgeChosenMatches.reduce(
          (acc: MergedChosenMatchLengths, shstMatch: any) => {
            const {shstReferenceId, isForward, shst_ref_start, shst_ref_end} = shstMatch

            const dir = isForward ? 'forward' : 'backward'

            acc[dir][shstReferenceId] = acc[dir][shstReferenceId] || [Infinity, -Infinity]

            if (shst_ref_start < acc[dir][shstReferenceId][0]) {
              acc[dir][shstReferenceId][0] = shst_ref_start
            }

            if (shst_ref_end > acc[dir][shstReferenceId][1]) {
              acc[dir][shstReferenceId][1] = shst_ref_end
            }

            return acc
          }, {forward: {}, backward: {}})

        const totalForwardChosenMatchLengths = Object.keys(mergedChosenMatchLengths.forward)
          .reduce(
            (acc, shstRefId) =>
              acc + (mergedChosenMatchLengths.forward[shstRefId][1] - mergedChosenMatchLengths.forward[shstRefId][0]),
            0)

        if (totalForwardChosenMatchLengths > 0) {
          this.numChosenForwardMatched += 1
        }

        const totalBackwardChosenMatchLengths = Object.keys(mergedChosenMatchLengths.backward)
          .reduce(
            (acc, shstRefId) =>
              acc + (mergedChosenMatchLengths.backward[shstRefId][1] - mergedChosenMatchLengths.backward[shstRefId][0]),
            0)

        if (totalBackwardChosenMatchLengths > 0) {
          this.numChosenBackwardMatched += 1
        }

        const forwardMatchLenDiffMeters = Math.abs(featureLengthKm - totalForwardChosenMatchLengths) * 1000
        const backwardMatchLenDiffMeters = Math.abs(featureLengthKm - totalBackwardChosenMatchLengths) * 1000

        forwardMatchLenDiffs.push(forwardMatchLenDiffMeters)
        backwardMatchLenDiffs.push(backwardMatchLenDiffMeters)

        this.chosenForward10 += forwardMatchLenDiffMeters < 10 ? 1 : 0
        this.chosenForward50 += forwardMatchLenDiffMeters < 50 ? 1 : 0

        this.chosenBackward10 += backwardMatchLenDiffMeters < 10 ? 1 : 0
        this.chosenBackward50 += backwardMatchLenDiffMeters < 50 ? 1 : 0
      }
    })

    console.log({forwardMatchLenDiffs, backwardMatchLenDiffs})

    this.meanFChosenMatchLenDiff = ss.mean(forwardMatchLenDiffs)
    this.medianFChosenMatchLenDiff = ss.median(forwardMatchLenDiffs)
    this.stddevFChosenMatchLenDiff = ss.standardDeviation(forwardMatchLenDiffs)
    this.varFChosenMatchLenDiff = ss.variance(forwardMatchLenDiffs)

    this.meanBChosenMatchLenDiff = ss.mean(backwardMatchLenDiffs)
    this.medianBChosenMatchLenDiff = ss.median(backwardMatchLenDiffs)
    this.stddevBChosenMatchLenDiff = ss.standardDeviation(backwardMatchLenDiffs)
    this.varBChosenMatchLenDiff = ss.variance(backwardMatchLenDiffs)
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
