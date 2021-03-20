/* eslint-disable no-restricted-syntax */

require('ts-node').register();

const {
  default: TargetMapConflationBlackboardDao,
} = require('../../TargetMapConflationBlackboardDao');

const {
  default: TargetMapPathVicinity,
} = require('../../TargetMapConflationHypothesesContexts/TargetMapPathVicinity');

const {
  default: searchAndSort,
} = require('../../TargetMapConflationKnowlegeSources/toposortTargetMapPathShstMatchedShstReferences');

const {
  default: divvyToposortedTargetMapPathShstReferences,
} = require('../../TargetMapConflationKnowlegeSources/divvyToposortedHypothesizedTargetMapPathShstReferences');

const daos = {};

module.exports = function chooseMatches(
  { targetMapSchema, targetMapPathId },
  cb,
) {
  try {
    daos[targetMapSchema] =
      daos[targetMapSchema] ||
      new TargetMapConflationBlackboardDao(targetMapSchema);

    const vicinity = new TargetMapPathVicinity(
      daos[targetMapSchema],
      targetMapPathId,
    );

    const sortedPaths = searchAndSort(vicinity);

    const chosenMatches = divvyToposortedTargetMapPathShstReferences(
      vicinity,
      sortedPaths,
    );

    cb(null, { targetMapPathId, chosenMatches });
  } catch (err) {
    console.error(err);
    cb(null, {
      targetMapPathId,
      chosenMatches: { forward: null, backward: null },
    });
  }
};
