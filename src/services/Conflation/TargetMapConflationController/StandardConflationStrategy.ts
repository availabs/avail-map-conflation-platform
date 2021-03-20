/* eslint-disable no-restricted-syntax */

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import SharedStreetsMatcherKnowledgeSource from '../TargetMapConflationKnowlegeSources/SharedStreets';

import createChosenMatchesIterator from './utils/createChosenMatchesIterator';
import Assigner from '../TargetMapConflationKnowlegeSources/assignMatches/Assigner';

export function createAssignedMatchesIterator(
  // @ts-ignore
  blkbrdDao: TargetMapConflationBlackboardDao,
) {
  const assigner = new Assigner(blkbrdDao);

  return assigner.makeAssignedMatchesIterator();
}

export default class StandardConflationStrategy {
  // @ts-ignore
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;

  // @ts-ignore
  constructor(blkbrdDao: TargetMapConflationBlackboardDao) {
    this.blkbrdDao = blkbrdDao;
  }

  async run() {
    if (!this.blkbrdDao.shstMatchesAreLoaded) {
      const shstMatcherKnwlSrc = new SharedStreetsMatcherKnowledgeSource(
        this.blkbrdDao,
      );
      await shstMatcherKnwlSrc.matchEntireTargetMap();
    }

    if (!this.blkbrdDao.chosenMatchesAreLoaded) {
      const chosenMatchesIter = createChosenMatchesIterator(this.blkbrdDao);

      await this.blkbrdDao.bulkLoadChosenMatches(chosenMatchesIter);
    }

    if (!this.blkbrdDao.assignedMatchesAreLoaded) {
      const assignedMatchesIter = createAssignedMatchesIterator(this.blkbrdDao);

      await this.blkbrdDao.bulkLoadAssignedMatches(assignedMatchesIter);
    }
  }
}
