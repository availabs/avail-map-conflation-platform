/* eslint-disable no-restricted-syntax */

import { TargetMapSchema } from '../../../utils/TargetMapDatabases/TargetMapDAO';

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';

import SharedStreetsMatcherKnowledgeSource from '../TargetMapConflationKnowlegeSources/SharedStreetsMatcherKnowledgeSource';

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

  async conflate() {
    if (!this.blkbrdDao.shstMatchesAreLoaded) {
      await this.shstMatcherKnwlSrc.matchEntireTargetMap();
    }
  }
}
