import {API_HOST} from '../../../../config'

import _ from 'lodash'

import * as ss from 'simple-statistics'

import {
  TargetMap,
  TargetMapId,
  ConflationMapId,
} from '../../domain/types'

type ConflationMapping = {
  id: ConflationMapId;
  targetMapId: TargetMapId;
  isForward: boolean;
}

type ConflationMappings = ConflationMapping[]

type TargetMapToConflationMapLookup = Record<TargetMapId, {forward: ConflationMapId[], backward: ConflationMapId[]}>;
type ConflationMapToTargetMapLookup = Record<ConflationMapId, TargetMapId>;

type ConflationMetric = {
  targetMapId: TargetMapId,
  targetMapEdgeLength: number;
  isUnidirectional: boolean;
  forwardConflationSegmentsLengthSum: number | null;
  backwardConflationSegmentsLengthSum: number | null
}

type ConflationMetrics = Record<TargetMapId, ConflationMetric>

type ConflationAnalysisConstrutorConfig = {
  targetMap: TargetMap,
  conflationMappings: ConflationMappings,
  conflationMetrics: ConflationMetrics
}

type LengthDiffs = Record<TargetMapId, number | null>

export type ConflationAnalysisConfig = Pick<ConflationAnalysisConstrutorConfig, 'targetMap'>

export class ConflationAnalysis {
  readonly targetMap: TargetMap;

  readonly targetMapIds: TargetMapId[];

  readonly forwardMatchedTargetMapIds: TargetMapId[];

  readonly forwardUnmatchedTargetMapIds: TargetMapId[];

  readonly backwardMatchedTargetMapIds: TargetMapId[] | null;

  readonly backwardUnmatchedTargetMapIds: TargetMapId[] | null;

  readonly directionalMatchedTargetMapIds: TargetMapId[];

  readonly directionalUnmatchedTargetMapIds: TargetMapId[];

  readonly forwardMatchedConflationMapIds: ConflationMapId[];

  readonly backwardMatchedConflationMapIds: ConflationMapId[];

  readonly matchedConflationMapIds: ConflationMapId[];

  private readonly conflationMappings: ConflationMappings;

  private readonly conflationMetrics: ConflationMetrics;

  private readonly targetMapToConflationMapLookup: TargetMapToConflationMapLookup;

  private readonly conflationMapToTargetMapLookup: ConflationMapToTargetMapLookup;

  readonly targetMapIsUnidirectional: boolean;

  private readonly targetMapIdConverter: (id: string) => TargetMapId

  private readonly forwardMatchLengthDiffs: LengthDiffs;

  private readonly backwardMatchLengthDiffs: LengthDiffs | null;

  public readonly minFwdLenDiff: number;
  public readonly maxFwdLenDiff: number;

  public readonly minBwdLenDiff: number | null;
  public readonly maxBwdLenDiff: number | null;

  private cachedMatchingStats!: Record<string, number>

  constructor(
    {
      targetMap,
      conflationMappings,
      conflationMetrics
    }: ConflationAnalysisConstrutorConfig
  ) {
    this.targetMap = targetMap;


    this.conflationMappings = conflationMappings;
    this.conflationMetrics = conflationMetrics;

    this.targetMapIsUnidirectional = targetMap === TargetMap.NPMRDS

    this.targetMapIdConverter = this.targetMap === TargetMap.NPMRDS
      ? (id: string) => id
      : (id: string) => +id

    this.targetMapIds = Object.keys(this.conflationMetrics).map(this.targetMapIdConverter)

    this.targetMapToConflationMapLookup = this.conflationMappings.reduce(
      (acc: TargetMapToConflationMapLookup, {id, targetMapId, isForward}) => {
        acc[targetMapId] = acc[targetMapId] || {
          forward: [],
          backward: []
        }

        const dir = isForward ? 'forward' : 'backward'

        acc[targetMapId][dir].push(id)

        return acc
      }, {}
    )

    this.conflationMapToTargetMapLookup = this.conflationMappings.reduce(
      (acc: ConflationMapToTargetMapLookup, {id, targetMapId}) => {
        acc[id] = targetMapId

        return acc
      }, {})

    this.forwardMatchLengthDiffs = {}
    this.forwardMatchedTargetMapIds = []
    this.forwardUnmatchedTargetMapIds = []

    this.minFwdLenDiff = Infinity
    this.maxFwdLenDiff = -Infinity

    if (!this.targetMapIsUnidirectional) {
      this.backwardMatchLengthDiffs = {}
      this.minBwdLenDiff = Infinity
      this.maxBwdLenDiff = -Infinity
      this.backwardMatchedTargetMapIds = []
      this.backwardUnmatchedTargetMapIds = []
    } else {
      this.backwardMatchLengthDiffs = null
      this.minBwdLenDiff = null
      this.maxBwdLenDiff = null
      this.backwardMatchedTargetMapIds = null;
      this.backwardUnmatchedTargetMapIds = null;
    }

    this.directionalMatchedTargetMapIds = []
    this.directionalUnmatchedTargetMapIds = []

    for (const targetMapId of this.targetMapIds) {
      const {
        targetMapEdgeLength,
        forwardConflationSegmentsLengthSum,
        backwardConflationSegmentsLengthSum,
        isUnidirectional
      } = this.conflationMetrics[targetMapId]

      const directionalMatched = isUnidirectional
        ? (
          forwardConflationSegmentsLengthSum
          || backwardConflationSegmentsLengthSum
        )
        : (
          forwardConflationSegmentsLengthSum
          && backwardConflationSegmentsLengthSum
        )

      if (directionalMatched) {
        this.directionalMatchedTargetMapIds.push(targetMapId)
      } else {
        this.directionalUnmatchedTargetMapIds.push(targetMapId)
      }

      const fwdLenDiff = Number.isFinite(forwardConflationSegmentsLengthSum)
        // @ts-ignore
        ? Math.abs(targetMapEdgeLength - forwardConflationSegmentsLengthSum)
        : targetMapEdgeLength

      this.forwardMatchLengthDiffs[targetMapId] = fwdLenDiff

      if (forwardConflationSegmentsLengthSum) {
        this.forwardMatchedTargetMapIds.push(targetMapId)

        if (fwdLenDiff < this.minFwdLenDiff) {
          this.minFwdLenDiff = fwdLenDiff
        }

        if (fwdLenDiff > this.maxFwdLenDiff) {
          this.maxFwdLenDiff = fwdLenDiff
        }
      } else if (!directionalMatched) {
        this.forwardUnmatchedTargetMapIds.push(targetMapId)
      }

      if (!this.targetMapIsUnidirectional) {
        const {
          backwardConflationSegmentsLengthSum
        } = this.conflationMetrics[targetMapId]

        const bwdLenDiff = Number.isFinite(backwardConflationSegmentsLengthSum)
          // @ts-ignore
          ? Math.abs(targetMapEdgeLength - backwardConflationSegmentsLengthSum)
          : targetMapEdgeLength

        // @ts-ignore
        this.backwardMatchLengthDiffs[targetMapId] = bwdLenDiff

        if (backwardConflationSegmentsLengthSum) {
          // @ts-ignore
          this.backwardMatchedTargetMapIds.push(targetMapId)

          // @ts-ignore
          if (bwdLenDiff < this.minBwdLenDiff) {
            this.minBwdLenDiff = bwdLenDiff
          }

          // @ts-ignore
          if (bwdLenDiff > this.maxBwdLenDiff) {
            this.maxBwdLenDiff = bwdLenDiff
          }
        } else if (!directionalMatched) {
          // @ts-ignore
          this.backwardUnmatchedTargetMapIds.push(targetMapId)
        }
      }
    }

    this.forwardMatchedConflationMapIds = _.flatten(
      this.forwardMatchedTargetMapIds.map(
        targetMapId => this.targetMapToConflationMapLookup[targetMapId].forward
      ).filter(id => !_.isNil(id))
    )

    this.backwardMatchedConflationMapIds = this.backwardMatchedTargetMapIds !== null
      ? _.flatten(
        this.backwardMatchedTargetMapIds.map(
          targetMapId => this.targetMapToConflationMapLookup[targetMapId].backward
        )
      ).filter(id => !_.isNil(id))
      : []

    this.matchedConflationMapIds = _.union(
      this.forwardMatchedConflationMapIds,
      this.backwardMatchedConflationMapIds
    )
  }

  get numEdges() {
    return this.targetMapIds.length
  }

  get numForwardMatchedEdges() {
    return this.forwardMatchedTargetMapIds.length
  }

  get numForwardUnmatchedEdges() {
    return this.forwardUnmatchedTargetMapIds.length
  }

  get numBackwardMatchedEdges() {
    return this.backwardMatchedTargetMapIds?.length || 0
  }

  get numDirectionalMatchedEdges() {
    return this.directionalMatchedTargetMapIds.length
  }

  get numDirectionalUnmatchedEdges() {
    return this.directionalUnmatchedTargetMapIds.length
  }

  get numBackwardUnmatchedEdges() {
    return this.backwardUnmatchedTargetMapIds?.length || 0
  }

  get minLenDiff() {
    return Math.min(this.minFwdLenDiff, this.minBwdLenDiff ?? Infinity)
  }

  get maxLenDiff() {
    return Math.max(this.maxFwdLenDiff, this.maxBwdLenDiff ?? -Infinity)
  }

  lookupTargetMapIdForConflationMapId(conflationMapId: ConflationMapId) {
    return this.conflationMapToTargetMapLookup[conflationMapId] ?? null
  }

  get matchingStats() {
    if (this.cachedMatchingStats) {
      return this.cachedMatchingStats
    }

    this.cachedMatchingStats = {}

    // === Directional Matched ===

    const matchLenDiffs =
      _(this.directionalMatchedTargetMapIds)
        .map(targetMapId => [
          this.forwardMatchLengthDiffs[targetMapId],
          this.backwardMatchLengthDiffs?.[targetMapId],
        ])
        .flatten()
        .filter(n => Number.isFinite(n))
        .value()

    // @ts-ignore
    this.cachedMatchingStats.matchedMeanLenDiffKm = ss.mean(matchLenDiffs)
    // @ts-ignore
    this.cachedMatchingStats.matchedMedianLenDiffKm = ss.median(matchLenDiffs)

    this.cachedMatchingStats.matchedR =
      this.directionalMatchedTargetMapIds.length
      / (this.directionalMatchedTargetMapIds.length + this.directionalUnmatchedTargetMapIds.length)

    this.cachedMatchingStats.matchedLt5mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0, .005).length
      / this.numDirectionalMatchedEdges

    this.cachedMatchingStats.matchedGte5mLt10mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0.005, .01).length
      / this.numDirectionalMatchedEdges

    this.cachedMatchingStats.matchedGte10mLt25mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0.01, .025).length
      / this.numDirectionalMatchedEdges

    this.cachedMatchingStats.matchedGte25mLt50mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0.025, .050).length
      / this.numDirectionalMatchedEdges

    this.cachedMatchingStats.matchedGte50mLt100mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0.05, 0.1).length
      / this.numDirectionalMatchedEdges

    this.cachedMatchingStats.matchedGte100mR =
      this.getLengthDifferenceFilteredMatchedTargetMapIds(0.1).length
      / this.numDirectionalMatchedEdges

    // === Forward Matched ===

    const fwdMatchLenDiffs =
      _(this.forwardMatchedTargetMapIds)
        .map(targetMapId => [
          this.forwardMatchLengthDiffs[targetMapId]
        ])
        .flatten()
        .filter(n => Number.isFinite(n))
        .value()

    // @ts-ignore
    this.cachedMatchingStats.fwdMatchedMeanLenDiffKm = ss.mean(fwdMatchLenDiffs)
    // @ts-ignore
    this.cachedMatchingStats.fwdMatchedMedianLenDiffKm = ss.median(fwdMatchLenDiffs)

    this.cachedMatchingStats.fwdMatchedR =
      this.forwardMatchedTargetMapIds.length
      / (this.forwardMatchedTargetMapIds.length + this.forwardUnmatchedTargetMapIds.length)

    this.cachedMatchingStats.fwdMatchedLt5mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0, .005).length
      / this.numForwardMatchedEdges

    this.cachedMatchingStats.fwdMatchedGte5mLt10mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0.005, .01).length
      / this.numForwardMatchedEdges

    this.cachedMatchingStats.fwdMatchedGte10mLt25mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0.01, .025).length
      / this.numForwardMatchedEdges

    this.cachedMatchingStats.fwdMatchedGte25mLt50mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0.025, .050).length
      / this.numForwardMatchedEdges

    this.cachedMatchingStats.fwdMatchedGte50mLt100mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0.05, 0.1).length
      / this.numForwardMatchedEdges

    this.cachedMatchingStats.fwdMatchedGte100mR =
      this.getLengthDifferenceFilteredForwardMatchedTargetMapIds(0.1).length
      / this.numForwardMatchedEdges


    if (this.backwardMatchedTargetMapIds) {
      const bwdMatchLenDiffs =
        _(this.backwardMatchedTargetMapIds)
          .map(targetMapId => [
            // @ts-ignore
            this.backwardMatchLengthDiffs[targetMapId]
          ])
          .flatten()
          .filter(n => Number.isFinite(n))
          .value()

      // @ts-ignore
      this.cachedMatchingStats.bwdMatchedMeanLenDiffKm = ss.mean(bwdMatchLenDiffs)
      // @ts-ignore
      this.cachedMatchingStats.bwdMatchedMedianLenDiffKm = ss.median(bwdMatchLenDiffs)

      this.cachedMatchingStats.bwdMatchedR =
        this.backwardMatchedTargetMapIds.length
        // @ts-ignore
        / (this.backwardMatchedTargetMapIds.length + this.backwardUnmatchedTargetMapIds.length)

      this.cachedMatchingStats.bwdMatchedLt5mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0, .005).length
        / this.numBackwardMatchedEdges

      this.cachedMatchingStats.bwdMatchedGte5mLt10mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0.005, .01).length
        / this.numBackwardMatchedEdges

      this.cachedMatchingStats.bwdMatchedGte10mLt25mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0.01, .025).length
        / this.numBackwardMatchedEdges

      this.cachedMatchingStats.bwdMatchedGte25mLt50mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0.025, .050).length
        / this.numBackwardMatchedEdges

      this.cachedMatchingStats.bwdMatchedGte50mLt100mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0.05, 0.1).length
        / this.numBackwardMatchedEdges

      this.cachedMatchingStats.bwdMatchedGte100mR =
        this.getLengthDifferenceFilteredBackwardMatchedTargetMapIds(0.1).length
        / this.numBackwardMatchedEdges
    }

    return this.cachedMatchingStats
  }

  // FIXME: All using only forwardMatchLengthDiffs
  private filterTargetMapIdsByMatchLengthDiffs(
    targetMapIds: TargetMapId[],
    minFwdLenDiff?: number | null,
    maxFwdLenDiff?: number | null
  ) {
    const min = minFwdLenDiff ?? -Infinity
    const max = maxFwdLenDiff ?? Infinity

    return targetMapIds.filter(
      targetMapId => (
        this.forwardMatchLengthDiffs[targetMapId] !== null
        // @ts-ignore
        && this.forwardMatchLengthDiffs[targetMapId] >= min
        // @ts-ignore
        && this.forwardMatchLengthDiffs[targetMapId] < max
      )
    )
  }

  getLengthDifferenceFilteredMatchedTargetMapIds(
    minFwdLenDiff?: number | null,
    maxFwdLenDiff?: number | null
  ) {
    // FIXME: Should pass ONLY if both directions pass
    return this.filterTargetMapIdsByMatchLengthDiffs(
      this.directionalMatchedTargetMapIds,
      minFwdLenDiff,
      maxFwdLenDiff
    )
  }

  getLengthDifferenceFilteredForwardMatchedTargetMapIds(
    minFwdLenDiff?: number | null,
    maxFwdLenDiff?: number | null
  ) {
    return this.filterTargetMapIdsByMatchLengthDiffs(
      this.forwardMatchedTargetMapIds,
      minFwdLenDiff,
      maxFwdLenDiff
    )
  }

  getLengthDifferenceFilteredBackwardMatchedTargetMapIds(
    minFwdLenDiff?: number | null,
    maxFwdLenDiff?: number | null
  ) {
    return this.filterTargetMapIdsByMatchLengthDiffs(
      this.backwardMatchedTargetMapIds || [],
      minFwdLenDiff,
      maxFwdLenDiff
    )
  }

  getBackwardMatchLengthDiffFilteredSegmentIds(
    filterFn: (targetMapEdgeLength: number, backwardConflationSegmentsLengthSum: number) => boolean
  ) {
    return Object.keys(this.conflationMetrics).map(targetMapId => +targetMapId)
      .filter((targetMapId: TargetMapId) => {
        const {targetMapEdgeLength, backwardConflationSegmentsLengthSum} = this.conflationMetrics[targetMapId]

        if (backwardConflationSegmentsLengthSum === null) {
          return false
        }

        return filterFn(targetMapEdgeLength, backwardConflationSegmentsLengthSum)
      })
  }

  getForwardMatchedConflationMapIds(targetMapIds: TargetMapId | TargetMapId[]) {
    const tgtMapIds = Array.isArray(targetMapIds) ? targetMapIds : [targetMapIds]

    console.log({tgtMapIds})

    const fwdMatchedConflationMapIds = _.flatten(
      tgtMapIds.map(
        targetMapId => this.targetMapToConflationMapLookup[targetMapId].forward
      ).filter(id => !_.isNil(id))
    )

    return fwdMatchedConflationMapIds
  }

  getBackwardMatchedConflationMapIds(targetMapIds: TargetMapId | TargetMapId[]) {
    const tgtMapIds = Array.isArray(targetMapIds) ? targetMapIds : [targetMapIds]

    const bwdMatchedConflationMapIds = _.flatten(
      tgtMapIds.map(
        targetMapId => this.targetMapToConflationMapLookup[targetMapId].backward
      ).filter(id => !_.isNil(id))
    )

    return bwdMatchedConflationMapIds
  }

  getMatchedConflationMapIds(targetMapIds: TargetMapId | TargetMapId[]) {
    const fwdMatches = this.getForwardMatchedConflationMapIds(targetMapIds)
    const bwdMatches = this.getBackwardMatchedConflationMapIds(targetMapIds)

    return _.union(fwdMatches, bwdMatches)
  }

  getConflationMetricsForTargetMapId(targetMapId: TargetMapId) {
    return this.conflationMetrics[targetMapId]
  }
};

export default {
  async createConflationAnalysis(targetMap: TargetMap) {
    const mappingsUrl = `${API_HOST}/${targetMap}/conflation-mappings`
    const metricsUrl = `${API_HOST}/${targetMap}/conflation-metrics`

    const [conflationMappings, conflationMetrics]: [ConflationMappings, ConflationMetrics] = await Promise.all(
      [
        fetch(mappingsUrl).then(r => r.json()),
        fetch(metricsUrl).then(r => r.json())
      ]
    )

    return new ConflationAnalysis({targetMap, conflationMappings, conflationMetrics})
  }
}
