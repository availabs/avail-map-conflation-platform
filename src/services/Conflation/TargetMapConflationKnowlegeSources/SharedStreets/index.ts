/* eslint-disable no-restricted-syntax */

import { makeShstMatchesIterator } from './SharedStreetsMatcher';

import TargetMapConflationBlackboardDao from '../../TargetMapConflationBlackboardDao';

import { TargetMapEdgesGeoproximityIterator } from '../../domain/types';

async function* makeShstMatchesGenerator(
  targetMapEdgesGeoProximityIterator: TargetMapEdgesGeoproximityIterator,
  targetMapIsCenterline: boolean,
) {
  const shstMatchesIter = makeShstMatchesIterator(
    targetMapEdgesGeoProximityIterator,
    {
      centerline: targetMapIsCenterline,
    },
  );

  for await (const { matchFeature } of shstMatchesIter) {
    yield matchFeature;
  }
}

export default class SharedStreetsMatcherKnowledgeSource {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;

  constructor(blkbrdDao: TargetMapConflationBlackboardDao) {
    this.blkbrdDao = blkbrdDao;
  }

  async matchEntireTargetMap() {
    this.blkbrdDao.clearShstMatches();

    const iter = this.blkbrdDao.makeTargetMapEdgeFeaturesGeoProximityIterator();
    const isCenterline = this.blkbrdDao.targetMapIsCenterline;

    const shstMatchesIter = makeShstMatchesGenerator(iter, isCenterline);

    this.blkbrdDao.bulkLoadShstMatches(shstMatchesIter);
  }
}
