import React, {Component} from 'react';
import { ResponsiveLine } from '@nivo/line'

// make sure parent container have a defined height when using responsive component,
// otherwise height will be 0 and no chart will be rendered.
// website examples showcase many properties, you'll often use just a few of them.

export default class SimpleLine extends Component {

    render () {
        let theData = this.props.data || testData
        return (  
            <ResponsiveLine
                data={theData}
                margin={{
                    "top": 10,
                    "right": 20,
                    "bottom": 30,
                    "left": 10
                }}
                minY="0"
                curve="linear"
                axisBottom={{
                    "orient": "bottom",
                    "tickSize": 2,
                    "tickPadding": 5,
                    "tickRotation": 45,
                    
                }}
                axisLeft={{
                    "orient": "left",
                    "tickSize": 0,
                    "tickPadding": 30,
                    "tickRotation": 0,
                    "legend": "count",
                    "legendOffset": -40,
                    "legendPosition": "center"
                }}
                dotSize={0}
                dotColor="inherit:darker(0.3)"
                dotBorderWidth={2}
                dotBorderColor="#ffffff"
                enableDotLabel={false}
                dotLabel="y"
                dotLabelYOffset={-12}
                enableGridX={false}
                enableGridY={false}
                enableArea={true}
                animate={true}
                motionStiffness={90}
                
                motionDamping={15}
                theme={{
                  axis: {
                    textColor: 'rgba(0, 0, 0, 0.4)',
                    fontSize: '10px',
                    tickColor: 'rgba(0, 0, 0, 0.4)',
                  },
                 
                }}
                legends={[
                    {
                        "anchor": "bottom-right",
                        "direction": "column",
                        "translateX": 100,
                        "itemWidth": 80,
                        "itemHeight": 20,
                        "symbolSize": 12,
                        "symbolShape": "circle"
                    }
                ]}
            />
        )
    }
}


const testData = [
  {
    "id": "whisky",
    "color": "hsl(10, 70%, 50%)",
    "data": [
      {
        "color": "hsl(336, 70%, 50%)",
        "x": "PR",
        "y": 4
      },
      {
        "color": "hsl(128, 70%, 50%)",
        "x": "UA",
        "y": 49
      },
      {
        "color": "hsl(298, 70%, 50%)",
        "x": "CD",
        "y": 1
      },
      {
        "color": "hsl(153, 70%, 50%)",
        "x": "MK",
        "y": 49
      },
      {
        "color": "hsl(336, 70%, 50%)",
        "x": "KN",
        "y": 27
      },
      {
        "color": "hsl(239, 70%, 50%)",
        "x": "NZ",
        "y": 39
      },
      {
        "color": "hsl(161, 70%, 50%)",
        "x": "BL",
        "y": 28
      },
      {
        "color": "hsl(26, 70%, 50%)",
        "x": "HT",
        "y": 4
      },
      {
        "color": "hsl(166, 70%, 50%)",
        "x": "AR",
        "y": 38
      }
    ]
  }
]