import React, {useState, useEffect, useRef} from 'react';
import {useParams} from 'react-router-dom';

import _ from 'lodash'

import AvlMap from 'AvlMap';

import ConflationAnalysisFactory, { ConflationAnalysis } from './store/ConflationAnalysisFactory'
import ConflationLayerFactory, { ConflationAnalysisLayer } from './layers/ConflationLayerFactory'

export default function ConflationAnalysisView() {
  const [ready, setPageReady] = useState(false);

  // @ts-ignore
  const {targetMap} = useParams()

  const conflationAnalysis: {current: ConflationAnalysis | null} = useRef(null);
  const conflationAnalysisLayer: {current: ConflationAnalysisLayer | null} = useRef(null);

  useEffect(() => {
    (async () => {
      conflationAnalysis.current = await ConflationAnalysisFactory.createConflationAnalysis(targetMap)

      console.table(conflationAnalysis.current.matchingStats)

      conflationAnalysisLayer.current = ConflationLayerFactory
        .createConflationAnalysisLayer(conflationAnalysis.current)

      // So we can manipulate the map from the console.
      //   E.G.: conflationAnalysisLayer.selectTargetMapId('120+25135')
      // @ts-ignore
      window.conflationAnalysisLayer = conflationAnalysisLayer.current

      setPageReady(true)

      return () => {
        // @ts-ignore
        window.conflationAnalysisLayer = undefined
      }
    })();
  }, []);

  if (!ready) {
    return <div>Waiting...</div>;
  }

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
