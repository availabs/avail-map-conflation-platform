/* eslint-disable no-restricted-syntax, no-await-in-loop */

/* 
    NOTE:
          chooseMatches requires creating a TargetMapPathVicinity object.
            Some TargetMapPathVicinities can contain thousands of SharedStreetsReferenceFeatures.
              Querying and processing those SharedStreetsReferenceFeatures can take minutes.
            Luckily, these cases are rare, but TargetMapPathVicinities taking seconds to
              analyze are not.
            As there are more than 190,0000 TargetMapPaths for 2019 NYS RIS,
              we require concurrent processing to complete ChooseMatches
              in a reasonable amount of time.

    NOTE:
          node-gdal "did not self-register" when using https://github.com/josdejong/workerpool

          Based on this advice: https://github.com/contra/node-gdal-next#notes
            we resolved the problem using https://github.com/rvagg/node-worker-farm
*/

import EventEmitter from 'events';

import os from 'os';
import { join } from 'path';

import pEvent from 'p-event';

import workerFarm from 'worker-farm';

import TargetMapConflationBlackboardDao from '../../TargetMapConflationBlackboardDao';

import { TargetMapPathId, ChosenMatchMetadata } from '../../domain/types';

const MAX_CONCURRENT = os.cpus().length * 2;

export default async function* createChosenMatchesIterator(
  // @ts-ignore
  blkbrdDao: TargetMapConflationBlackboardDao,
): AsyncGenerator<ChosenMatchMetadata> {
  const workers = workerFarm(
    {
      maxConcurrentWorkers: MAX_CONCURRENT,
      autoStart: true,
    },
    join(__dirname, './chooseMatches.js'),
  );

  const chosenMatchesEmitter = new EventEmitter();

  let outstanding = 0;

  const choose = (targetMapPathId: TargetMapPathId) => {
    ++outstanding;

    // console.log();
    // console.log(new Date().toISOString());
    // console.log();

    console.time(`targetMapPathId: ${targetMapPathId}`);

    workers(
      { targetMapSchema: blkbrdDao.targetMapSchema, targetMapPathId },
      (
        err: Error,
        d: {
          forward: ChosenMatchMetadata[];
          backward: ChosenMatchMetadata[];
        },
      ) => {
        --outstanding;
        if (err) {
          console.error(err);
          chosenMatchesEmitter.emit('data', {
            targetMapPathId: null,
            chosenMatches: { forward: null, backward: null },
          });
        } else {
          chosenMatchesEmitter.emit('data', d);
        }
      },
    );
  };

  const chosenMatchesIter = pEvent.iterator(chosenMatchesEmitter, ['data']);

  const targetMapPathIdsIter = blkbrdDao.makeTargetMapPathIdsIterator();

  for (let i = 0; i < MAX_CONCURRENT; ++i) {
    choose(targetMapPathIdsIter.next().value);
  }

  let counter = 1;
  console.time(`next ${counter}`);
  for await (const {
    targetMapPathId: resultTMPathId,
    chosenMatches,
  } of chosenMatchesIter) {
    console.timeEnd(`targetMapPathId: ${resultTMPathId}`);
    console.timeEnd(`next ${counter}`);

    const targetMapPathId = targetMapPathIdsIter.next().value;

    if (Number.isInteger(targetMapPathId)) {
      choose(targetMapPathId);
    }

    try {
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
    } catch (err) {
      console.error(err);
    }

    if (outstanding === 0) {
      break;
    }
    console.time(`next ${++counter}`);
  }

  workerFarm.end(workers);
}
