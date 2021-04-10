import React, {useState, useEffect, useRef} from 'react';

import _ from 'lodash'

import AvlMap from 'AvlMap';

import NysRisConflationFactory, { NysRisConflation } from './store/NysRisConflationFactory'
import NysRisConflationLayerFactory, { NysRisConflationLayer } from './layers/NysRisConflationLayerFactory'

export default function NysRisConflationView() {
  const [ready, setReady] = useState(false);

  const nysRisConflation: {current: NysRisConflation | null} = useRef(null);
  const nysRisConflationLayer: {current: NysRisConflationLayer | null} = useRef(null);

  useEffect(() => {
    (async () => {
      nysRisConflation.current = await NysRisConflationFactory.createNysRisConflation()

      nysRisConflationLayer.current = NysRisConflationLayerFactory
        .createTargetMapPathLayer(nysRisConflation.current)

      setReady(true)
    })();
  }, []);

  if (!ready) {
    return <div>Waiting...</div>;
  }

  return <AvlMap
    layers={[nysRisConflationLayer.current]}
    dragPan={true}
    styles={[
      {
        name: 'blank',
        style: 'mapbox://styles/mapbox/light-v10',
      },
    ]}
    sidebar={false}
    header={`NYS RIS Conflation`}
  />
}

