import * as turf from '@turf/turf'
import _ from 'lodash'

import * as TargetMapDomain from '../../../src/utils/TargetMapDatabases/domain/index'

export type TargetMapEdgeId = TargetMapDomain.TargetMapEdgeId
export type TargetMapPathId = TargetMapDomain.TargetMapPathId
export type TargetMapPathEdgeFeature = TargetMapDomain.TargetMapPathEdgeFeature;
export type TargetMapPathEdgeFeatures = TargetMapDomain.TargetMapPathEdgeFeature[];
export type TargetMapPathIntersection = turf.Feature<turf.Point> & {properties: {targetMapPathIdx: number}}
export type TargetMapPathIntersections = TargetMapPathIntersection[]

export default class TargetMapPath {
  readonly targetMapPathId: TargetMapPathId;

  readonly targetMapPathEdges: TargetMapPathEdgeFeatures;

  constructor(targetMapPathId: TargetMapPathId, targetMapPathEdges: TargetMapPathEdgeFeatures) {
    this.targetMapPathId = targetMapPathId;
    this.targetMapPathEdges = targetMapPathEdges;
  }

  getEdgeById(targetMapEdgeId: TargetMapEdgeId) {
    return this.targetMapPathEdges.find(({id}) => id === targetMapEdgeId)
  }

  getEdgeByIndex(idx: number) {
    return idx >= 0
      ? this.targetMapPathEdges[idx]
      : this.targetMapPathEdges[this.targetMapPathEdges.length + idx]
  }

  get targetMapPathIntersections(): TargetMapPathIntersections {
    return this.targetMapPathEdges.reduce((acc: TargetMapPathIntersections, edge, i) => {
      const coords = _(turf.getCoords(edge)).flattenDeep().chunk(2).value()

      if (i === 0) {
        const startPtCoord = coords[0]

        const startPt = turf.point(startPtCoord, {targetMapPathIdx: 0})

        // @ts-ignore
        acc.push(startPt)
      }

      const endPtCoord = coords[coords.length - 1]

      const endPt = turf.point(endPtCoord, {targetMapPathIdx: i + 1})

      // @ts-ignore
      acc.push(endPt)

      return acc
    }, [])
  }

  get targetMapPathEdgesFeatureCollection() {
    return turf.featureCollection(this.targetMapPathEdges)
  }

  get targetMapPathIntersectionsFeatureCollection() {
    return turf.featureCollection(this.targetMapPathIntersections)
  }
}
