/* eslint-disable no-restricted-syntax */

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import SharedStreetsMatcherKnowledgeSource from '../TargetMapConflationKnowlegeSources/SharedStreets';
import TargetMapPathVicinity from '../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import searchAndSort from '../TargetMapConflationKnowlegeSources/toposortTargetMapPathShstMatchedShstReferences';
import divvyToposortedTargetMapPathShstReferences from '../TargetMapConflationKnowlegeSources/divvyToposortedHypothesizedTargetMapPathShstReferences';
import Assigner from '../TargetMapConflationKnowlegeSources/assignMatches/Assigner';

export function* createChosenMatchesIterator(
  blkbrdDao: TargetMapConflationBlackboardDao,
) {
  const targetMapPathIdsIter = blkbrdDao.makeTargetMapPathIdsIterator();

  for (const targetMapPathId of targetMapPathIdsIter) {
    const vicinity = new TargetMapPathVicinity(blkbrdDao, targetMapPathId);

    console.log('targetMapPath:', vicinity.targetMapPathId);

    const sortedPaths = searchAndSort(vicinity);

    const chosenMatches = divvyToposortedTargetMapPathShstReferences(
      vicinity,
      sortedPaths,
    );

    if (chosenMatches.forward) {
      for (let i = 0; i < chosenMatches.forward.length; ++i) {
        yield chosenMatches.forward[i];
      }
    }

    if (chosenMatches.backward) {
      for (let i = 0; i < chosenMatches.backward.length; ++i) {
        yield chosenMatches.backward[i];
      }
    }
  }
}

export function createAssignedMatchesIterator(
  blkbrdDao: TargetMapConflationBlackboardDao,
) {
  const assigner = new Assigner(blkbrdDao);

  return assigner.makeAssignedMatchesIterator();
}

export default class StandardConflationStrategy {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;

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
