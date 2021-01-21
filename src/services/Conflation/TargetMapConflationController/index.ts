/* eslint-disable no-restricted-syntax */

import { TargetMapSchema } from '../../../utils/TargetMapDatabases/TargetMapDAO';

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import TargetMapPathVicinity from '../TargetMapConflationHypothesesContexts/TargetMapPathVicinity';

import SharedStreetsMatcherKnowledgeSource from '../TargetMapConflationKnowlegeSources/SharedStreets';

import searchAndSort from '../TargetMapConflationKnowlegeSources/toposortTargetMapPathShstMatchedShstReferences/searchAndSort';
import divvyToposortedTargetMapPathShstReferences from '../TargetMapConflationKnowlegeSources/divvyToposortedHypothesizedTargetMapPathShstReferences';

function* createChosenMatchesIterator(
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

export default class TargetMapConflationController {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;

  private readonly shstMatcherKnwlSrc: SharedStreetsMatcherKnowledgeSource;

  constructor(targetMapSchema: TargetMapSchema) {
    this.blkbrdDao = new TargetMapConflationBlackboardDao(targetMapSchema);

    this.shstMatcherKnwlSrc = new SharedStreetsMatcherKnowledgeSource(
      this.blkbrdDao,
    );
  }

  clean() {
    this.blkbrdDao.initializeTargetMapConflationBlackBoardDatabase();
    this.blkbrdDao.vacuumDatabase();
  }

  //  Pipeline's root run script SHOULD ONLY have 'conflate'
  //    As a pattern, each Input Source or SQLite DB has a run script.
  //      1. Load Raw
  //      2. Load TargetMap DB
  //      3. Conflate
  //    To support delelopment, strive for SOLID.
  //      Use test harnesses to run the isolated sub-steps.
  async conflate() {
    if (!this.blkbrdDao.shstMatchesAreLoaded) {
      await this.shstMatcherKnwlSrc.matchEntireTargetMap();
    }

    //  Iterate over TargetMapPathVicinities
    //    For each Vicinity
    //      Sequence of KnowledgeSources
    //        Ascending Levels of Abstraction
    //          Ascending Levels of Certainty
    //  Start with a hard-coded, simple Strategy based on proven patterns.
    //    Architecture should support Open/Closed Principle
    //
    //      Software entities (classes, modules, functions, etc.)
    //      should be open for extension, but closed for modification.

    const chosenShstMatchesIter = createChosenMatchesIterator(this.blkbrdDao);

    this.blkbrdDao.bulkLoadShstMatches(chosenShstMatchesIter);

    // let counter = 0;
    // for (const chosenMatches of chosenShstMatchesIter) {
    // if (++counter === 10) {
    // break;
    // }
    // console.log(JSON.stringify(chosenMatches, null, 4))
    // }
  }
}
