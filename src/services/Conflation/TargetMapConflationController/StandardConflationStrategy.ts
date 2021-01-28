/* eslint-disable no-restricted-syntax */

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import SharedStreetsMatcherKnowledgeSource from '../TargetMapConflationKnowlegeSources/SharedStreets';
import TargetMapPathVicinity from '../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import searchAndSort from '../TargetMapConflationKnowlegeSources/toposortTargetMapPathShstMatchedShstReferences/searchAndSort';
import divvyToposortedTargetMapPathShstReferences from '../TargetMapConflationKnowlegeSources/divvyToposortedHypothesizedTargetMapPathShstReferences';

export function* createChosenMatchesIterator(
  blkbrdDao: TargetMapConflationBlackboardDao,
) {
  const targetMapPathIdsIter = blkbrdDao.makeTargetMapPathIdsIterator();

  for (const targetMapPathId of targetMapPathIdsIter) {
    const vicinity = new TargetMapPathVicinity(blkbrdDao, targetMapPathId);

    console.log('targetMapPath:', vicinity.targetMapPathId);

    const sortedPaths = searchAndSort(vicinity);

    const chosenShstMatches = divvyToposortedTargetMapPathShstReferences(
      vicinity,
      sortedPaths,
    );

    if (chosenShstMatches.forward) {
      for (let i = 0; i < chosenShstMatches.forward.length; ++i) {
        yield chosenShstMatches.forward[i];
      }
    }

    if (chosenShstMatches.backward) {
      for (let i = 0; i < chosenShstMatches.backward.length; ++i) {
        yield chosenShstMatches.backward[i];
      }
    }
  }
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

    const chosenShstMatchesIter = createChosenMatchesIterator(this.blkbrdDao);

    this.blkbrdDao.beginWriteTransaction();
    await this.blkbrdDao.bulkLoadChosenShstMatches(chosenShstMatchesIter);
    this.blkbrdDao.commitWriteTransaction();
  }
}
