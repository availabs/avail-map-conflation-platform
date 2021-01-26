import React, {useState, useEffect, useRef} from 'react';
import {useHistory, useParams} from 'react-router-dom';

import * as turf from '@turf/turf'
import _ from 'lodash'

import SharedStreetsMatchRunner from '../pipelineProcessRunners/SharesStreetMatchRunner'

const labLoc = turf.point([-73.82182113595792, 42.67706452958626])
const labVicinity = turf.buffer(labLoc, 1, {units: 'kilometers'}) // Within 1/2 mile of the lab.

// Image from https://commons.wikimedia.org/wiki/File:Plug-in_Noun_project_4032.svg
export default function ShstMatchControl() {
  const [ready, setReady] = useState(false);
  const [targetMap, setTargetMap] = useState('nys_ris');
  const [queryPolygon, setQueryPolygon] = useState(labVicinity);
  const [searchRadius, setSearchRadius] = useState(10);
  const [currentNums, setCurrentNums] = useState({numTMEdgeIds: 0, numShstMatches: 0})
  const [runnerDone, setRunnerDone] = useState(false)
  const history = useHistory()
  const {uuid: currentMatchRunId} = useParams()

  const runner = useRef(null);

  const previousNums = useRef({prevNumTMEdgeIds: 0, prevNumShstMatches: 0})

  let {current: currentRunner} = runner

  const destroyCurrentRunner = () => {
    if (currentRunner) {
      currentRunner.destroy()
      currentRunner = null
    }

    setCurrentNums({
      numTMEdgeIds: 0,
      numShstMatches: 0,
    })

    runner.current = null

    history.push('/shst-match')
  }

  const createNewRunner = () => {
    console.log('CREATE NEW RUNNER')
    setReady(false)

    destroyCurrentRunner()

    const newRunner = new SharedStreetsMatchRunner({
      targetMap,
      flags: [`--search-radius=${searchRadius}`, '--snap-intersections'],
      queryPolygon,
      currentMatchRunId
    })

    newRunner.addShstMatcherBatchDoneListener(() => {
      setCurrentNums({
        numTMEdgeIds: newRunner.targetMapEdgeIds.length,
        numShstMatches: newRunner.shstMatches.length
      })
    })

    newRunner.addShstMatcherDoneListener(() => {
      // console.log('SHST_MATCHER_DONE')
      setRunnerDone(true)
    })

    newRunner.run().then(() => {
      if (currentMatchRunId !== newRunner.matchRunId) {
        history.push(`/shst-match/${newRunner.matchRunId}`)
      }
      setReady(true)
    })

    runner.current = newRunner


    setReady(true)
    setRunnerDone(false)
  }

  useEffect(() => {
    createNewRunner()

    return function cleanup() {
      if (runner.current !== null) {
        runner.current.destroy()
      }
    };
  }, []);

  if (!ready) {
    return <div>Waiting...</div>;
  }

  const {
    current: {
      prevNumTMEdgeIds,
      prevNumShstMatches
    }
  } = previousNums

  const {
    numTMEdgeIds,
    numShstMatches
  } = currentNums

  if (currentRunner === null) {
    if (prevNumTMEdgeIds !== 0 || prevNumShstMatches !== 0) {
      previousNums.current = {
        prevNumTMEdgeIds: 0,
        prevNumShstMatches: 0,
      }
    }

    if (numTMEdgeIds !== 0 || numShstMatches !== 0) {
      setCurrentNums({
        numTMEdgeIds: 0,
        numShstMatches: 0
      })
    }
  }

  if (currentRunner && (prevNumTMEdgeIds !== numTMEdgeIds || prevNumShstMatches !== numShstMatches)) {
    console.log({
      latestBatch: {
        targetMapEdgeIds: currentRunner.targetMapEdgeIds.slice(prevNumTMEdgeIds, numTMEdgeIds),
        shstMatches: currentRunner.shstMatches.slice(prevNumShstMatches, numShstMatches),
      }
    })

    previousNums.current = {
      prevNumTMEdgeIds: numTMEdgeIds,
      prevNumShstMatches: numShstMatches,
    }
  }

  // console.log('REFRESH')
  return (
    <div style={{position: 'absolute', top: '200px', left: '200px'}}>
      <div style={{borderStyle: 'solid'}}>
        {
          !(runnerDone || currentRunner === null) ?
            <div style={{display: 'inline-block'}}>
              <div style={{borderStyle: 'solid'}}>
                <span
                  style={{padding: '25px', cursor: 'pointer'}}
                  onClick={currentRunner.toggleLock.bind(currentRunner)}
                  title={currentRunner.locked ? 'play' : 'pause'}
                >
                  {currentRunner.locked ? '▶' : '⏸'}
                </span>
              </div>
              <div style={{borderStyle: 'solid'}}>
                <span
                  style={{padding: '15px', cursor: 'pointer'}}
                  onClick={destroyCurrentRunner}
                  title={'stop'}
                >
                  ⏹
                </span>
              </div>
            </div>
            : <span />
        }
        <div style={{borderStyle: 'solid'}}>
          <span
            style={{padding: '25px', cursor: 'pointer'}}
            onClick={createNewRunner}
            title={'restart'}
          >
            ⟳
        </span>
        </div>
      </div>
      <div>
        <span >Num Target Map Path Edges: {numTMEdgeIds}</span>
      </div>
      <div>
        <span >Num SharedStreets Matches: {numShstMatches}</span>
      </div>
    </div>
  );
}
