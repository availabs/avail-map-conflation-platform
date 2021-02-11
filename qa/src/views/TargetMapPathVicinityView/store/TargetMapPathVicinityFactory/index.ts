import * as turf from '@turf/turf'
import _ from 'lodash'

import {QAServerTargetMapVicinityResponse as Vicinity} from '../../../../domain/QAServer'

import {API_HOST} from '../../../../config'

import TargetMaps from '../../../../domain/TargetMaps'

import TargetMapPath, {TargetMapPathId} from '../../../../domainImplementations/TargetMapPath'

export class TargetMapPathVicinity {
  private readonly vicinity: Vicinity;

  readonly targetMapPathId: TargetMapPathId

  readonly targetMapPath: TargetMapPath;
  readonly vicinityShstReferences: Vicinity['vicinityShstReferences'];
  readonly nearbyTargetMapEdges: Vicinity['targetMapPath'];
  readonly targetMapPathShstMatches: Vicinity['targetMapPathShstMatches']
  readonly targetMapPathChosenMatches: Vicinity['nearbyTargetMapPathChosenMatches']
  readonly nearbyTargetMapEdgesShstMatches: Vicinity['nearbyTargetMapEdgesShstMatches']
  readonly nearbyTargetMapPathChosenMatches: Vicinity['nearbyTargetMapPathChosenMatches']

  constructor(vicinity: Vicinity) {
    this.vicinity = vicinity

    this.targetMapPathId = vicinity.targetMapPathId;

    this.targetMapPath = new TargetMapPath(this.targetMapPathId, this.vicinity.targetMapPath)

    this.vicinityShstReferences = vicinity.vicinityShstReferences
    this.nearbyTargetMapEdges = vicinity.nearbyTargetMapEdges;
    this.targetMapPathShstMatches = vicinity.targetMapPathShstMatches;
    this.targetMapPathChosenMatches = vicinity.targetMapPathChosenMatches;
    this.nearbyTargetMapEdgesShstMatches = vicinity.nearbyTargetMapEdgesShstMatches;
  }

  get targetMapPathEdgesFeatureCollection() {
    return this.targetMapPath.targetMapPathEdgesFeatureCollection
  }

  get targetMapPathIntersectionsFeatureCollection() {
    return this.targetMapPath.targetMapPathIntersectionsFeatureCollection
  }

  get nearbyTargetMapEdgesFeatureCollection() {
    return turf.featureCollection(this.nearbyTargetMapEdges)
  }

  get nearbyTargetMapEdgeEndPointsFeatureCollection() {
    const points = this.nearbyTargetMapEdges.reduce((acc: turf.Feature<turf.Point>[], edge) => {
      const coords = _(turf.getCoords(edge)).flattenDeep().chunk(2).value()

      const startPtCoord = coords[0]

      const startPt = turf.point(startPtCoord, {targetMapEdgeId: edge.id})

      // @ts-ignore
      acc.push(startPt)

      const endPtCoord = coords[coords.length - 1]

      const endPt = turf.point(endPtCoord, {targetMapPathIdx: edge.id})

      // @ts-ignore
      acc.push(endPt)

      return acc
    }, [])

    return turf.featureCollection(points)
  }


  get nearbyTargetMapIntersectionsFeatureCollection() {
    return turf.featureCollection(this.nearbyTargetMapEdges)
  }

  get vicinityShstReferencesFeatureCollection() {
    return turf.featureCollection(this.vicinityShstReferences)
  }

  get vicinityShstIntersectionsFeatureCollection() {
    const shstIntersections = this.vicinityShstReferences.reduce((acc, shstRef) => {
      const {properties: {shstReferenceId, fromIntersectionId, toIntersectionId}} = shstRef

      const shstRefCoords = _(turf.getCoords(shstRef)).flattenDeep().chunk(2).value()

      if (!acc[fromIntersectionId]) {
        const startPtCoord = shstRefCoords[0]

        acc[fromIntersectionId] = turf.point(
          startPtCoord,
          {
            shstIntersectionId: fromIntersectionId,
            outboundReferenceIds: [shstReferenceId],
            inboundReferenceIds: []
          },
          {id: fromIntersectionId}
        )
      } else {
        acc[fromIntersectionId].properties.outboundReferenceIds.push(shstReferenceId)
      }

      if (!acc[toIntersectionId]) {
        const startPtCoord = shstRefCoords[shstRefCoords.length - 1]

        acc[toIntersectionId] = turf.point(
          startPtCoord,
          {
            shstIntersectionId: fromIntersectionId,
            outboundReferenceIds: [],
            inboundReferenceIds: [shstReferenceId]
          },
          {id: toIntersectionId}
        )
      } else {
        acc[toIntersectionId].properties.inboundReferenceIds.push(shstReferenceId)
      }

      return acc
    }, {})

    return turf.featureCollection(Object.values(shstIntersections))
  }

  get targetMapPathChosenMatchesFeatureCollection() {
    return turf.featureCollection(this.targetMapPathChosenMatches)
  }

}

export default {
  async createTargetMapPathVicinity(
    targetMap: TargetMaps, targetMapPathId: TargetMapPathId
  ) {
    const url = `${API_HOST}/${targetMap}/target-map-path-vicinity/${targetMapPathId}`

    const vicinity: Vicinity = await fetch(url).then(r => r.json())

    return new TargetMapPathVicinity(vicinity)
  }
}
