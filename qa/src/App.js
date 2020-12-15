import React from "react";

import AvlMap from "./AvlMap"
// import TransitLayerFactory from './layers/TransitLayer'
import qaLayerFactory from 'layer/npmrd-qs.layer'

function App() {
  const qaLayer = qaLayerFactory({active: true});
  return (
    <div style={{ height: "100vh" }}>
      <AvlMap
        layers={[qaLayer]}
        dragPan={true}
        styles={[{
          name:'blank', 
          style:'mapbox://styles/am3081/ckdsuik5w1b2x19n5d9lkow78'
        }]}
        sidebar={false}
        header="Conflation QA"/>
    </div>
    
  );
}

export default App;
