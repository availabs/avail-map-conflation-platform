import React from "react"

export default ({layer}: {layer: ShstLayer}) => {

  const inlineStyle_1 = {border: '1px solid #ddd', flex: 1, padding: 10}

  return (
    <div>
      <div style={{padding: 10}
      }>
        <span style={{fontSize: '2em', padding: 5}}>
          {layer.matchProperties.road_name} </span>
        <span style={{padding: 5}}> {layer.matchProperties.gis_id} - {layer.matchProperties.beg_mp} </span>
        {
          layer.matchProperties.begin_description || layer.matchProperties.end_description ?
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
              <div style={inlineStyle_1}> <strong>from <br /> </strong>  {layer.matchProperties.begin_description} </div >
              <div style={inlineStyle_1}> <strong>to <br /> </strong>  {layer.matchProperties.end_description} </div >
            </div> : ''}
        <div style={{display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap'}
        }>
          <div style={inlineStyle_1}>
            <strong>Oneway <br /> </strong>
            {layer.matchProperties.oneway}
          </div>
          <div style={inlineStyle_1}>
            <strong>Divided <br /> </strong>
            {layer.matchProperties.divided}
          </div>

          <div style={inlineStyle_1}>
            <strong>Direction <br /> </strong>
            {layer.matchProperties.direction}
          </div>
          <div style={inlineStyle_1}>
            <strong>lanes <br /> </strong>
            {layer.matchProperties.total_lanes} | {layer.matchProperties.primary_dir_lanes}
          </div>
          <div style={inlineStyle_1}>
            <strong>length(calc) <br /> </strong>
            {_.get(layer, 'matchProperties.shape_length', 0).toFixed(2)}

            ({(_.get(layer, 'matchProperties.length', 0) * 1000).toFixed(2)})
          </div>
          <div style={inlineStyle_1}>
            <strong>Type <br /> </strong>
            {layer.matchProperties.roadway_type}
          </div>
        </div>
      </div>
      <table >
        <tbody>
          {
            layer.segments.map((d: any) => <tr key={d.shst_match_id} > <td>{d.shst_match_id} </td><td>{d.shst_reference}</td > </tr>)}
        </tbody>
      </table>

    </div>
  )
}

