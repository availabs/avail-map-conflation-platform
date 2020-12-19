import React from "react"

import styled from "styled-components"
import _ from "lodash"
import get from "lodash.get"

import * as d3array from "d3-array";
import { format } from "d3-format"

import { Input } from "./common/styled-components"
import ItemSelector from './common/item-selector/item-selector';
import MultiSelectFilter from './filters/multi-select-filter.js'


let FILTER_ID = 0;
const getFilterId = () => `filter-${ ++FILTER_ID }`;

const StringEqualityFilter = (key, value) => {
	value = value.toString().toLowerCase();
	function filter(data) {
		return data.filter(d => get(d, [key], "").toString().toLowerCase().includes(value));
	}
	filter.id = getFilterId();
	filter.display = `${ key } includes ${ value }`;
	return filter;
}
const NotEqualFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) !== value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } != ${ value }`;
	return filter;
}
const EqualityFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) === value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } == ${ value }`;
	return filter;
}
const NumericGreaterThanFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) > value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } > ${ value }`;
	return filter;
}
const NumericGreaterThanEqualToFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) >= value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } >= ${ value }`;
	return filter;
}
const NumericLessThanFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) < value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } < ${ value }`;
	return filter;
}
const NumericLessThanEqualToFilter = (key, value) => {
	function filter(data) {
		return data.filter(d => get(d, [key], undefined) <= value);
	}
	filter.id = getFilterId();
	filter.display = `${ key } <= ${ value }`;
	return filter;
}
const NumericRangeFilterRegex = /(\[|\()(\d+),(\d+)(\]|\))/
const NumericRangeFilter = (key, lower, value1, value2, upper) => {
	function filter(data) {
		return data.filter(d => {
			const value = get(d, [key], undefined);
			return (lower === "[" ? value >= value1 : value > value1) &&
				(upper === "]" ? value <= value2 : value < value2);
		})
	}
	filter.id = getFilterId();
	filter.display = `${ key } in range ${ lower }${ value1 }, ${ value2 }${ upper }`;
	return filter;
}

const isNum = n => (n !== null) && !isNaN(+n);

const hierSort = (data, keys, i = 0) => {
	if (i >= keys.length) return data;

	const groups = new Map();

	const keyData = keys[i];
	const keyFunc = d => d[keyData.key];

	for (const row of data) {
		const key = keyFunc(row),
			group = groups.get(key);
		if (group) {
			group.push(row);
		}
		else {
			groups.set(key, [row]);
		}
	}

	for (const [key, values] of groups) {
		groups.set(key, hierSort(values, keys, i + 1));
	}

	return Array.from(groups)
		.sort(([a], [b]) => {
			if ((a === null) || (a === undefined)) return 1;
			if ((b === null) || (b === undefined)) return -1;

			if (isNum(a) && isNum(b)) {
				return (a - b) * keyData.dir;
			}
			a = a.toString().toLowerCase();
			b = b.toString().toLowerCase();

			return (a < b ? -1 : b < a ? 1 : 0) * keyData.dir;
		})
		.reduce((a, c) => {
			a.push(...c[1])
			return a;
		}, [])
}

export default class AvlTable extends React.Component {
	static defaultProps = {
		data: [],
		keys: [],
		rowsPerPage: 10,
		pageSpread: 2,
		downloadedFileName: "data.csv",
		title: "",
		showHelp: false,
		expandable: []
	}

	state = {
		page: 0,
		filters: [],
		searchKey: null,
		searchString: "",
		sortKey: null,
		sortDirection: 1,
		sortKeys: []
	}

	setPage(page) {
		const maxPage = Math.floor(this.props.data.length / this.props.rowsPerPage);
		this.setState({ page: Math.max(0, Math.min(maxPage, page)) });
	}
	prevPage() {
		this.setState({ page: Math.max(0, this.state.page - 1) });
	}
	nextPage() {
		const maxPage = Math.floor(this.props.data.length / this.props.rowsPerPage);
		this.setState({ page: Math.min(maxPage, this.state.page + 1) });
	}

	addFilter() {
		const { searchKey, searchString } = this.state;
		let filter = false;
		if (searchString.slice(0, 2) === "::") {
			const argsString = searchString.slice(2).trim(),
				args = argsString.split(/\s+/);

			if (args[0] === "==") {
				filter = EqualityFilter(searchKey, argsString.slice(2).trim());
			}
			else if (args[0] === "!=") {
				filter = NotEqualFilter(searchKey, argsString.slice(2).trim());
			}
			else if (args[0] === ">") {
				filter = NumericGreaterThanFilter(searchKey, argsString.slice(1).trim());
			}
			else if (args[0] === ">=") {
				filter = NumericGreaterThanEqualToFilter(searchKey, argsString.slice(2).trim());
			}
			else if (args[0] === "<") {
				filter = NumericLessThanFilter(searchKey, argsString.slice(1).trim());
			}
			else if (args[0] === "<=") {
				filter = NumericLessThanEqualToFilter(searchKey, argsString.slice(2).trim());
			}
			else if ((args[0] === "range") || (args[0] === "in")) {
				const value = argsString.slice(args[0].length).replace("//g", ""),
					match = NumericRangeFilterRegex.exec(value);

				if (match) {
					filter = NumericRangeFilter(searchKey, ...match.slice(1, 5));
				}
			}
		}
		if (!filter) {
			filter = StringEqualityFilter(searchKey, searchString);
		}

		this.setState({
			filters: [
				...this.state.filters,
				filter
			],
			searchKey: null,
			searchString: ""
		})
	}
	removeFilter(id) {
		this.setState({ filters: this.state.filters.filter(f => f.id !== id) });
	}

	setSearchKey(searchKey = null) {
		const newState = { searchKey };
		if (searchKey !== this.state.searchKey) {
			newState.searchString = "";
		}
		this.setState(newState);
	}
	setSearchString(searchString) {
		this.setState({ searchString });
	}
	setSortKey(sortKey = null) {
		let sortDirection = 1;
		if (sortKey === this.state.sortKey) {
			sortDirection = this.state.sortDirection * -1;
		}
		this.setState({ sortKey, sortDirection });
	}

	toggleSortKey(sortKey) {
		let sortKeyFound = false;

		const sortKeys = this.state.sortKeys.reduce((a, { key, dir }) => {
			sortKeyFound = sortKeyFound || (key === sortKey);
			if ((key === sortKey) && (dir === 1)) {
				a.push({
					key,
					dir: -1
				})
			}
			else if (key !== sortKey) {
				a.push({ key, dir });
			}
			return a;
		}, []);

		if (!sortKeyFound) {
			sortKeys.push({ key: sortKey, dir: 1 });
		}

		this.setState({ sortKeys });
	}

	getKeys() {
		let { keys, data } = this.props;
		if (!keys.length && data.length) {
			keys = Object.keys(data[0]);
		}
		return keys;
	}

    getData() {
        let data = (this.props.isMulti) ?
						this.state.filters.length ? this.state.filters.reduce((data, filter) => {
						data.push(...filter(this.props.data));
						return data;
					}, []) : this.props.data :
			this.state.filters.reduce((data, filter) => filter(data), [...this.props.data]);
        const  {sortKeys} = this.state;

        data = hierSort(data, sortKeys);

        return data;
    }

	getKeysAndData() {
		return [this.getKeys(), this.getData()];
	}

	downloadAsCsv(filtered = true) {
		const keys = this.getKeys();

		let data = this.props.data;

		if (filtered) {
			data = this.getData();
		}

		const csvData = data.reduce((csvData, row) => {
			csvData.push(keys.map(k => row[k]).join());
			return csvData;
		}, [keys.join()]).join("\n");

		const blob = new Blob([csvData], {
			type: 'text/csv;charset=utf-8;'
		});

		const link = document.createElement('a');

		if (link.download !== undefined) {
			const url = URL.createObjectURL(blob);
			link.setAttribute('href', url);
			link.setAttribute('download', this.props.downloadedFileName);
			link.style.visibility = 'hidden';
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		}
	}

	render() {
		let [keys, data] = this.getKeysAndData();
		keys = keys.filter(key => this.props.expandable ? !this.props.expandable.includes(key) : true)
		let { page, searchKey, searchString, sortKeys } = this.state;
		const keyMap = sortKeys.reduce((a, c, i) => ({ ...a, [c.key]: { dir: c.dir, i } }), {});

		const { rowsPerPage, pageSpread } = this.props,
			maxPage = Math.max(Math.ceil(data.length / rowsPerPage) - 1, 0),
			length = data.length;

		page = Math.min(maxPage, page);

		data = data.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
// console.log("???", keys, data, this.props.expandable)
		return (
			<DivContainer>

				<NavigationBar page={ page }
					maxPage={ maxPage }
					length={ length }
					rowsPerPage={ rowsPerPage }
					pageSpread={ pageSpread }
					prevPage={ () => this.prevPage() }
					nextPage={ () => this.nextPage() }
					setPage={ p => this.setPage(p) }
					searchKeys={ keys }
					data={ this.props.data }
					isMulti={ this.props.isMulti }
					searchKey={ searchKey }
					setSearchKey={ key => this.setSearchKey(key) }
					searchString={ searchString }
					setSearchString={ str => this.setSearchString(str) }
					addFilter={ () => this.addFilter() }
					removeFilter={ id => this.removeFilter(id) }
					filters={ this.state.filters }
					downloadFiltered={ () => this.downloadAsCsv(true) }
					downloadUnfiltered={ () => this.downloadAsCsv(false) }
					title={ this.props.title }
					showHelp={ this.props.showHelp }/>

				<TableContainer>
					<table className="table table-sm">
						<thead>
							<tr>
								{
									keys.map(key =>
										<TH key={ key } onClick={ () => this.toggleSortKey(key) }
											className={ keyMap[key] ? "active" : "" }>
											{ !keyMap[key] ? null : `(${ keyMap[key].i + 1 })` } { key.replace("_", " ") }
											{ !keyMap[key] ? null :
												<span className="fa fa-lg fa-caret-down ml-1"
													style={ { transform: `rotate(${ keyMap[key].dir === 1 ? 180 : 0 }deg)` } }/>
											}
										</TH>
									)
								}
							</tr>
						</thead>
						<tbody>
							{ data.map((row, i) =>
									<React.Fragment key={ i }>
										<tr key={ `row-${ i }` } onClick={ e => {
											const el = document.getElementById(`expandable-${ i }`);
											if (el) {
												const display = el.style.display;
												el.style.display = display === "none" ? "table-row" : "none";
											}
										} }>
											{ keys.map(key => <td key={ key }>{ row[key] }</td>) }
										</tr>
										{ this.props.expandable.map(key =>
												<tr key={ key } id={`expandable-${ i }`}
													style={ {
														display: 'none',
														backgroundColor: 'rgba(0,0,0,0.06)'
													} }>
													<td colSpan={ keys.length }>
														{ row[key] }
													</td>
												</tr>
											)
										}
									</React.Fragment>
								)
							}
						</tbody>
					</table>
				</TableContainer>

			</DivContainer>
		)
	}
}

const DivContainer = styled.div`
	/*max-height: 700px;*/
`
const TableContainer = styled.div`
	padding: 0px 10px;
	${ props => props.theme.scrollBar };
	overflow: auto;
	max-height: 500px;
	margin-top: 5px;
`

const TH = styled.th`
	padding-top: 2px;
	cursor: pointer;
	:hover {
		text-decoration: underline;
	}
	&.active {
		text-decoration: underline;
	}
`

const Button = styled.button`
	background-color: ${ props => props.theme.primaryBtnBgd };
	color: ${ props => props.theme.primaryBtnColor };
	border-radius: 4px;
	border: none;
	cursor: pointer;
	font-weight: 400;
	position: relative;

	:hover {
		background-color: ${ props => props.theme.primaryBtnBgdHover };
	}
	:disabled,
	:disabled:hover {
		cursor: not-allowed;
		background-color: ${ props => props.theme.primaryBtnDisabled };
	}

	&.active {
		background-color: ${ props => props.theme.primaryBtnBgdHover };
		color: ${ props => props.theme.primaryBtnActColor };
	}

	> .button-dropdown {
		display: none;
		position: absolute;
		right: 0;
		top: 100%;
		background-color: ${ props => props.theme.sidePanelHeaderBg };
		color: ${ props => props.theme.textColor };
		padding: 20px;
		z-index: 100;
	}

	:hover > .button-dropdown {
		display: block;
	}
`

const StyledNavigationBar = styled.div`
	display: flex;
	flex-direction: column;
	width: 100%;

	> * {
		width: 100%;
		position: relative;

		::after {
			content: "";
			clear: both;
			display: table;
		}

		> * {
			display: inline-block;

			:last-child {
				float: right;
			}
			&.middle {
				width: 100%;
				position: absolute;
				top: 0px;
				left: 0px;
				display: flex;
				justify-content: center;
				pointer-events: none;
				> * {
					pointer-events: all;
				}
			}
			:first-child {
				float: left;
			}
		}
	}
`
const getPageSpread = (page, maxPage, pageSpread) => {
	let low = page - pageSpread,
		high = page + pageSpread;

	if (low < 0) {
		high += -low;
		low = 0;
	}
	if (high > maxPage) {
		low -= (high - maxPage);
		high = maxPage;
	}
	return d3array.range(Math.max(0, low), Math.min(maxPage, high) + 1);
}
const numberFormat = format(",d");

const StyledFilterItem = styled.div`
	padding: 2px 2px 2px 10px;
	display: flex;
	border: 2px solid ${ props => props.theme.textColor };
	border-radius: 4px;

	:hover {
		border-color: ${ props => props.theme.textColorHl };
	}

	> div:first-child {
		padding-right: 5px;
	}
`

const StyledMultiSelectFilter = styled.div`

	/*padding: 2px 2px 2px 10px;*/
	margin: 0px !important;
	display: flex;
	border: 2px /*solid*/ ${props => props.theme.textColor};
	border-radius: 4px;

	:hover {
		border-color: ${props => props.theme.textColorHl};
	}

	> div:first-child {
		padding-right: 0px;
	}
	>div {
		width: 100%;
	}
`
const FilterItem = ({display, remove}) =>
    <StyledFilterItem>
        <div>{display}</div>
        <Button onClick={remove}>
            <span className="fa fa-times"/>
        </Button>
    </StyledFilterItem>

const NavigationBar = ({
                           prevPage,
                           nextPage,
                           page,
                           maxPage,
                           setPage,
                           length,
                           searchKeys,
                           searchKey,
                           data,
                           setSearchKey,
                           setSearchString,
                           searchString,
                           rowsPerPage,
                           pageSpread,
                           addFilter,
                           removeFilter,
                           filters,
                           downloadFiltered,
                           downloadUnfiltered,
                           title,
                           showHelp,
						   isMulti,
                       }) =>
    <StyledNavigationBar>

		<div>
			<div style={ { fontSize: "1rem", fontWeight: "bold", lineHeight: "23px" } }>
				{ title }
			</div>
			<div>
				<Button onClick={ downloadFiltered }>
					Download Filtered Data
				</Button>
				<Button onClick={ downloadUnfiltered } style={ { marginLeft: "5px" } }>
					Download Unfiltered Data
				</Button>
				{ !showHelp ? null :
					<Button style={ { marginLeft: "5px" } }>
						<span className="fa fa-question"/>
						<TableHelp />
					</Button>
				}
			</div>
		</div>

        <div style={{marginTop: "5px", height: '40px'}}>
            <form style={{display: "flex", width: "100%"}}
                  onSubmit={e => {
                      e.preventDefault();
                      searchKey && searchString && addFilter()
                  }}>
                <div style={{width: "40%"}}>
                    <ItemSelector
                        placeholder="Select a filter key..."
                        selectedItems={searchKey}
                        multiSelect={false}
                        searchable={false}
                        displayOption={d => d}
                        getOptionValue={d => d}
                        onChange={setSearchKey}
                        options={searchKeys}/>
                </div>
                <div style={{width: "40%"}}>
                    {(isMulti) ?
                        <StyledMultiSelectFilter>
                            <MultiSelectFilter
                                filter={{
                                    domain: searchKey ? _.uniqBy(data, searchKey).map(d => d[searchKey]).filter(f => f) : [],
                                    value: searchString ? searchString.split(';') : []//this.props.state[this.props.title] ? this.props.state[this.props.title] : this.props.defaultValue ? this.props.defaultValue : []
                                }}
                                setFilter={(e) => {
                                    setSearchString(e.join(';'));
                                }}
                            />
                        </StyledMultiSelectFilter> :
                        <Input type="text" value={searchString}
                               disabled={!Boolean(searchKey)}
                               onChange={({target: {value}}) => setSearchString(value)}
                               placeholder="filter..."/>
                    }
                </div>
                <div style={{width: "20%", display: "flex", paddingBottom: '13px'}}>
                    <Button onClick={addFilter} style={{ width: "100%"}}
                            disabled={!searchKey || !searchString}>
                        Add Filter
                    </Button>
                </div>
            </form>
        </div>

		{ !filters.length ? null :
			<div style={ { display: "flex" } }>
				{ filters.map((f, i) =>
						<FilterItem key={ f.id }
							display={ f.display }
							remove={ () => removeFilter(f.id) }/>
					)
				}
			</div>
		}

		<div style={ { marginTop: "5px" } }>
			<div>Displaying: { numberFormat(Math.min(page * rowsPerPage + 1, length)) } - { numberFormat(Math.min(page * rowsPerPage + rowsPerPage, length)) } of { numberFormat(length) }</div>
			<div>Page: { numberFormat(page + 1) } of { numberFormat(maxPage + 1) }</div>
		</div>

		<div>
			<div>
				<Button onClick={ () => setPage(0) }
					disabled={ page === 0 }>
					<span className="fa fa-chevron-left"/>
					<span className="fa fa-chevron-left"/>
				</Button>
				<Button onClick={ prevPage }
					disabled={ page === 0 }>
					<span className="fa fa-chevron-left"/>
				</Button>
			</div>
			<div className="middle">
				{
					getPageSpread(page, maxPage, pageSpread)
						.map(p =>
							<Button key={ p }
								disabled={ p === page }
								className={ p === page ? "active" : "" }
								onClick={ () => setPage(p) }>
								{ numberFormat(p + 1) }
							</Button>
						)
				}
			</div>
			<div>
				<Button onClick={ nextPage }
					disabled={ page === maxPage }>
					<span className="fa fa-chevron-right"/>
				</Button>
				<Button onClick={ () => setPage(maxPage) }
					disabled={ page === maxPage }>
					<span className="fa fa-chevron-right"/>
					<span className="fa fa-chevron-right"/>
				</Button>
			</div>
		</div>

    </StyledNavigationBar>

const TableHelp = () =>
	<div className="button-dropdown">
		<div style={ { fontSize: "1rem" } }>Search Commands</div>
		<div>All search commands must adhere to the following pattern:</div>
		<div>{ ':: command value' }</div>
		<div>Where command is one of the following:</div>
		<TableHelpTable>
			<thead>
				<tr>
					<th>Command</th>
					<th>Description</th>
					<th>Value</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>{ ':: ==' }</td>
					<td>(equal to)</td>
					<td>Number / String</td>
				</tr>
					<tr>
						<td>{ ':: !=' }</td>
						<td>(not equal to)</td>
						<td>Number / String</td>
					</tr>
				<tr>
					<td>{ ':: >' }</td>
					<td>(greater than)</td>
					<td>Number / String</td>
				</tr>
				<tr>
					<td>{ ':: >=' }</td>
					<td>(greater than or equal to)</td>
					<td>Number</td>
				</tr>
				<tr>
					<td>{ ':: <' }</td>
					<td>(less than)</td>
					<td>Number / String</td>
				</tr>
				<tr>
					<td>{ ':: <=' }</td>
					<td>(less than or equal to)</td>
					<td>Number</td>
				</tr>
				<tr>
					<td>{ ':: in' }</td>
					<td>(value bounds)</td>
					<td>{ '[( Number, Number )]' }</td>
				</tr>
			</tbody>
		</TableHelpTable>
		<div style={ { fontSize: "1rem", marginTop: "5px" } }>Examples:</div>
		<TableHelpTable>
			<thead>
				<tr>
					<th>Command</th>
					<th>Result</th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td>{ ':: == 60' }</td>
					<td>All data with selected key that has a value equal to 60</td>
				</tr>
				<tr>
					<td>{ ':: > 70' }</td>
					<td>All data with selected key that has a value greated than 70</td>
				</tr>
				<tr>
					<td>{ ':: <= 90' }</td>
					<td>All data with selected key that has a value less than or equal to 90</td>
				</tr>
				<tr>
					<td>{ ':: in [50, 80]' }</td>
					<td>
						<div>All data with selected key that has a value greater than or equal to 50</div>
						<div>and all data with selected key that has a value less than or equal to 80</div>
					</td>
				</tr>
				<tr>
					<td>{ ':: in (50, 80)' }</td>
					<td>
						<div>All data with selected key that has a value greater than 50</div>
						<div>and all data with selected key that has a value less than 80</div>
					</td>
				</tr>
				<tr>
					<td>{ ':: in [50, 80)' }</td>
					<td>
						<div>All data with selected key that has a value greater than or equal to 50</div>
						<div>and all data with selected key that has a value less than 80</div>
					</td>
				</tr>
			</tbody>
		</TableHelpTable>
	</div>

const TableHelpTable = styled.table`
	white-space: nowrap;

	th, td {
		padding-right: 10px;
	}
	th:last-child, td:last-child {
		padding-right: 0px;
	}
`
