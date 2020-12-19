import React from 'react';

import styled from "styled-components"

import ItemSelector from "../common/item-selector/item-selector"

const Container = styled.div`
  padding: 0px 5px;
  margin-bottom: 10px;
  .item-selector__dropdown {
    display: flex;
    justify-content: center;
  }
  .item-selector__dropdown > span {
    color: ${ props => props.theme.textColor };
    font-size: 1rem;
    text-align: center;
  }
`

export default ({ addLayer, layers }) =>
  <Container>
    <ItemSelector
      placeholder="Add A Layer"
      selectedItems={ null }
      multiSelect={ false }
      searchable={ false }
      displayOption={ d => d }
      getOptionValue={ d => d }
      onChange={ addLayer }
      options={ layers.reduce((a, c) => !c.active ? [...a, c.name] : a, []) }/>
  </Container>
