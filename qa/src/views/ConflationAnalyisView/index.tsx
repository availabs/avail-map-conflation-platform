import React, {useState, useEffect, useRef} from 'react';
import {useParams} from 'react-router-dom';

import _ from 'lodash'

import AvlMap from 'AvlMap';

import ConflationAnalysisFactory, { ConflationAnalysis } from './store/ConflationAnalysisFactory'
import ConflationLayerFactory, { ConflationAnalysisLayer } from './layers/ConflationLayerFactory'

// import ConflationMatchingStatsTable from './components/ConflationMatchingStats'

export default function ConflationAnalysisView() {
  const [ready, setPageReady] = useState(false);
  const [mapReady, setMapReady] = useState(false)

  // @ts-ignore
  const {targetMap} = useParams()

  const conflationAnalysis: {current: ConflationAnalysis | null} = useRef(null);
  const conflationAnalysisLayer: {current: ConflationAnalysisLayer | null} = useRef(null);

  useEffect(() => {
    (async () => {
      conflationAnalysis.current = await ConflationAnalysisFactory.createConflationAnalysis(targetMap)

      console.time('getStats')
      console.table(conflationAnalysis.current.matchingStats)
      console.timeEnd('getStats')

      const notifyMapReady = () => setMapReady(true)

      conflationAnalysisLayer.current = ConflationLayerFactory
        .createConflationAnalysisLayer(conflationAnalysis.current, notifyMapReady)

      setPageReady(true)
    })();
  }, []);

  useEffect(() => {
    if (mapReady) {
      // @ts-ignore
      conflationAnalysisLayer.current.showTargetMapMatchedSegmentsInLengthDifferenceRange(0.005);
    }
  }, [mapReady])

  if (!ready) {
    return <div>Waiting...</div>;
  }

  // const statsTable = <ConflationMatchingStatsTable conflationAnalysis={conflationAnalysis.current}/>

  return <AvlMap
    layers={[conflationAnalysisLayer.current]}
    dragPan={true}
    styles={[
      {
        name: 'blank',
        style: 'mapbox://styles/mapbox/light-v10',
      },
    ]}
    sidebar={false}
    header={`${targetMap} Conflation Analysis`}
  />
}

