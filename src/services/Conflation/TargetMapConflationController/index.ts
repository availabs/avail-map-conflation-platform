import { TargetMapSchema } from '../../../utils/TargetMapDatabases/TargetMapDAO';

import TargetMapConflationBlackboardDao from '../TargetMapConflationBlackboardDao';
import StandardConflationStrategy from './StandardConflationStrategy';

export default class TargetMapConflationController {
  private readonly blkbrdDao: TargetMapConflationBlackboardDao;

  private readonly strategy: StandardConflationStrategy;

  constructor(targetMapSchema: TargetMapSchema) {
    this.blkbrdDao = new TargetMapConflationBlackboardDao(targetMapSchema);

    this.strategy = new StandardConflationStrategy(this.blkbrdDao);
  }

  async conflate() {
    this.strategy.run();
  }
}
