import React from 'react';

import {BrowserRouter as Router, Switch, Route, Link} from 'react-router-dom';

import qaLayerFactory from 'layer/npmrd-qs.layer';
import AvlMap from './AvlMap';
import ShstMatchControl from './ShstMatchControl';

function App() {
  const qaLayer = qaLayerFactory({active: true});

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
          <Route exact path="/shst-match">
            <ShstMatchControl />
          </Route>
          <Route exact path="/shst-match/:uuid">
            <ShstMatchControl />
          </Route>
        </Switch>
      </Router>
    </div>
  );
}

export default App;
