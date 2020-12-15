import React, {Component} from 'react';

import styled from "styled-components"

const DefaultHeader = styled.div`
  font-size: 1.5rem;
  color: ${ props => props.theme.textColorHl };
`

class SidebarHeader extends Component {
  render() {
    const { header } = this.props,
      Header = typeof header === "function" ?
        header :
        () => <DefaultHeader>{ header }</DefaultHeader>;
        
    return (
      <div style={ { padding: "20px" } }>
        <Header />
      </div>
    );
  }
}


export default SidebarHeader