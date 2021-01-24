import React, {useState, useEffect, useRef} from 'react';

import _ from 'lodash'

import SharedStreetsMatchRunner from '../pipelineProcessRunners/SharesStreetMatchRunner'

// Image from https://commons.wikimedia.org/wiki/File:Plug-in_Noun_project_4032.svg
export default function ShstMatchControl() {
  const [ready, setReady] = useState(false);
  const [currentNums, setCurrentNums] = useState({numTMEdgeIds: 0, numShstMatches: 0})

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
  }

  const createNewRunner = () => {
    console.log('CREATE NEW RUNNER')
    setReady(false)

    destroyCurrentRunner()

    const newRunner = new SharedStreetsMatchRunner('nys-ris', ['--search-radius=25'])

    newRunner.addShstMatchListener(_.debounce(() => {
      setCurrentNums({
        numTMEdgeIds: newRunner.targetMapEdgeIds.length,
        numShstMatches: newRunner.shstMatches.length
      })
    }, 500))

    newRunner.run().then(setReady)

    runner.current = newRunner

    setReady(true)
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

  return (
    <div style={{position: 'absolute', top: '200px', left: '200px'}}>
      <div style={{borderStyle: 'solid'}}>
        {
          currentRunner !== null ?
            <div>
              <span
                style={{padding: '15px', cursor: 'pointer'}}
                onClick={currentRunner.toggleLock.bind(currentRunner)}
                title={currentRunner.locked ? 'play' : 'pause'}
              >
                {currentRunner.locked ? '▶' : '⏸'}
              </span>
              <span
                style={{padding: '15px', cursor: 'pointer'}}
                onClick={destroyCurrentRunner}
                title={'stop'}
              >
                ⏹
        </span>
            </div>
            : <span />
        }
        <span
          style={{padding: '15px', cursor: 'pointer'}}
          onClick={createNewRunner}
          title={'restart'}
        >
          ⟳
        </span>
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
