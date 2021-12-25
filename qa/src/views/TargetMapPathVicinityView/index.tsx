import React, {useState, useEffect, useRef} from 'react';
import {useParams} from 'react-router-dom';

import _ from 'lodash'

import AvlMap from 'AvlMap';

import TargetMapPathVicinityFactory, { TargetMapPathVicinity } from './store/TargetMapPathVicinityFactory'
import TargetMapPathVicinityLayerFactory, { TargetMapPathVicinityLayer } from './layers/TargetMapPathVicinityLayerFactory'

import TargetMaps from '../../domain/TargetMaps'


export default function TargetMapPathView() {
  const [ready, setReady] = useState(false);
  const [targetMap/*, setTargetMap*/] = useState(TargetMaps.NYS_RIS);

  const {targetMapPathId} = useParams()

  const targetMapPathVicinity: {current: TargetMapPathVicinity | null} = useRef(null);
  const targetMapPathVicinityLayer: {current: TargetMapPathVicinityLayer | null} = useRef(null);

  useEffect(() => {
    (async () => {
      targetMapPathVicinity.current = await TargetMapPathVicinityFactory
        .createTargetMapPathVicinity(targetMap, targetMapPathId)

      targetMapPathVicinityLayer.current = TargetMapPathVicinityLayerFactory.createTargetMapPathLayer(targetMapPathVicinity.current)

      setReady(true)
    })();
  }, []);

  if (!ready) {
    return <div>Waiting...</div>;
  }

  return <AvlMap
    layers={[targetMapPathVicinityLayer.current]}
    dragPan={true}
    styles={[
      {
        name: 'blank',
        style: 'mapbox://styles/mapbox/light-v10',
      },
    ]}
    sidebar={false}
    header={`TargetMapPath ${targetMapPathId}`}
  />
}

