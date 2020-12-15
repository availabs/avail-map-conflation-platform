import React, {Component} from 'react';
import styled from 'styled-components';
import { Button  } from '../common/styled-components'; // StyledPanelHeader

//import * as Filters from 'components/filters';
import {
  SingleSelectFilter,
  MultiSelectFilter,
  DateFilter,
  // Switch
} from '../filters'

import SliderFilter from "./slider-filter"
// import Slider from "../slider/slider"
// import deepEqual from 'deep-equal'

import Checkbox from "./checkboxFilter"

// const sliderStyle =  {
//     width: '100%',
//     height: 24,
//     background: '#29323C',
//     outline: 'none',
//     opacity: '0.7',
//     // WebkitTransition: 'opacity .15s ease-in-out',
//     transition: 'opacity .15s ease-in-out'
// }

const StyledFilterPanel = styled.div`
  margin-bottom: 12px;
  border-radius: 1px;
  .filter-panel__filter {
    margin-top: 24px;
  }
`;

// const StyledFilterHeader = StyledPanelHeader.extend`
//   cursor: pointer;
//   padding: 10px 12px;
// `;

// const SubmitButton = styled.button`
//   background-color: ${ props => props.theme.primaryBtnBgd };
//   width: 100%
// `
// const SubmitButton = styled(Button)`
//   width: 100%
// `

const StyledFilterContent = styled.div`
  background-color: ${props => props.theme.panelBackground};
  padding: 12px;
`;


// const CheckboxContainer = styled.div`
//   margin-top: 15px;
//   margin-bottom: 10px;
//   padding: 8px 10px;
//   background-color: ${ props => props.theme.secondaryInputBgd };
// `

 class LayerFilterPanel extends Component {


  render() {

    const { layer } = this.props,
      filters = layer.filters;

    const renderFilter = (filterName, i) => {
      const filter = filters[filterName];

      const dispatchUpdateFilter = value => {
        this.props.updateFilter(layer.name, filterName, value)
      }

      const getFilter = (filter) => {
        if (filter.active === false) return null;

        switch(filter.type) {
          case 'dropdown':
          case 'single':
            return <SingleSelectFilter
              setFilter={ dispatchUpdateFilter }
              filter={ filter }
            />;
          case 'multi':
            return <MultiSelectFilter
              setFilter={ dispatchUpdateFilter }
              filter={ filter }
            />;
          case 'hidden':
            return (<span />)
          case 'fetch':
            return (
              <Button onClick={ () => dispatchUpdateFilter(null) }
                disabled={ Boolean(filter.disabled) }
                style={ { width: "100%" } }
                secondary>
                { filter.name }
              </Button>
            );
          case 'checkbox':
            return (
              <Checkbox
                label={ filter.name }
                checked={ filter.value }
                onChange={ dispatchUpdateFilter }/>
            )
          case 'slider':
            return (
              <SliderFilter { ...filter }
                onChange={ dispatchUpdateFilter }/>
            );
          case 'date':
            return (
              <DateFilter
              setFilter={ dispatchUpdateFilter }
              filter={ filter }
              />
            );
          default:
            return (<span >Invalid Filter Type { filter.type }</span>);
        }
      }

      return (
        <div key={ i }>
          {getFilter(filter)}
        </div>
      )
    }

    return (
      <StyledFilterPanel className="filter-panel">
         <StyledFilterContent className="filter-panel__content">
          { Object.keys(filters).map(renderFilter) }
         </StyledFilterContent>
      </StyledFilterPanel>
    );
  }
}

export default LayerFilterPanel
