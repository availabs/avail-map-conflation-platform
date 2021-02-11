import React from 'react';

import {BrowserRouter as Router, Switch, Route} from 'react-router-dom';

import qaLayerFactory from 'layer-new/npmrd-qa.layer';
import AvlMap from './AvlMap';
import TargetMapPathVicinityView from './views/TargetMapPathVicinityView'

function App() {
  const qaLayer = qaLayerFactory({active: false});

  return (
    <div style={{height: '100vh'}}>
      <Router>
        <Switch>
          <Route exact path="/">
            <AvlMap
              layers={[qaLayer]}
              dragPan={true}
              styles={[
                {
                  name: 'blank',
                  style: 'mapbox://styles/am3081/ckdsuik5w1b2x19n5d9lkow78',
                },
              ]}
              sidebar={false}
              header="Conflation QA"
            />
          </Route>
          <Route exact path="/target-map-path-vicinity/:targetMapPathId">
            <TargetMapPathVicinityView />
          </Route>
        </Switch>
      </Router>
    </div>
  );
}

export default App;
