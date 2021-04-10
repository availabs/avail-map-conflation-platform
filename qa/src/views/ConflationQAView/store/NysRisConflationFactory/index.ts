import {API_HOST} from '../../../../config'

import _ from 'lodash'

const targetMap = 'nys_ris'

export type ConflationMapId = number
export type RisId = number

export type RisConflationMapping = {
  id: ConflationMapId;
  ris: RisId;
}

export type RisConflationMappings = RisConflationMapping[]

export type RisToConflationMap = Record<RisId, ConflationMapId[]>;
export type ConflationMapToRis = Record<ConflationMapId, RisId>;

export type RisConflationMetric = {
  ris: RisId,
  targetMapEdgeLength: number;
  isUnidirectional: boolean;
  forwardConflationSegmentsLengthSum:
  number | null;
  backwardConflationSegmentsLengthSum: number | null
}

export type RisConflationMetrics = Record<RisId, RisConflationMetric>

export class NysRisConflation {
  public readonly risToConflationMap: RisToConflationMap;
  public readonly conflationMapToRis: ConflationMapToRis;

  constructor(readonly mappings: RisConflationMappings, public readonly risConflationMetrics: RisConflationMetrics) {
    this.risToConflationMap = mappings.reduce((acc: RisToConflationMap, {id, ris}) => {
      acc[ris] = acc[ris] || []
      acc[ris].push(id)

      return acc
    }, {})

    this.conflationMapToRis = mappings.reduce((acc: ConflationMapToRis, {id, ris}) => {
      acc[id] = ris

      return acc
    }, {})
  }

  get unmatchedRisSegmentIds() {
    return Object.keys(this.risConflationMetrics).map(risId => +risId)
      .filter((risId: RisId) => (
        this.risConflationMetrics[risId].forwardConflationSegmentsLengthSum === null
        && this.risConflationMetrics[risId].backwardConflationSegmentsLengthSum === null
      ))
  }

  get matchedRisSegmentIds() {
    return Object.keys(this.risConflationMetrics).map(risId => +risId)
      .filter((risId: RisId) => (
        this.risConflationMetrics[risId].forwardConflationSegmentsLengthSum !== null
        || this.risConflationMetrics[risId].backwardConflationSegmentsLengthSum !== null
      ))
  }

  get passingForwardRisSegmentIds() {
    return Object.keys(this.risConflationMetrics).map(risId => +risId)
      .filter((risId: RisId) => (
        this.risConflationMetrics[risId].forwardConflationSegmentsLengthSum !== null
        || this.risConflationMetrics[risId].backwardConflationSegmentsLengthSum !== null
      ))
  }

};

export default {
  async createNysRisConflation() {
    const mappingsUrl = `${API_HOST}/${targetMap}/conflation-mappings`
    const metricsUrl = `${API_HOST}/${targetMap}/conflation-metrics`

    const [mappings, metrics]: [RisConflationMappings, RisConflationMetrics] = await Promise.all(
      [
        fetch(mappingsUrl).then(r => r.json()),
        fetch(metricsUrl).then(r => r.json())
      ]
    )

    return new NysRisConflation(mappings, metrics)
  }
}
