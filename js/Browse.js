/*
  ** Browse: Search image database; allow for various viewing options
    This will be the user's primary portal into the content
 */

import React from 'react'
import { NavLink } from 'react-router-dom'
import { Section } from 'neal-react'

import Griddle, {RowDefinition, ColumnDefinition, plugins} from 'griddle-react'
import { connect } from 'react-redux'

// CUSTOMIZATION NOTE:
// We are using a modified version of this repo yet to be merged
// See https://github.com/moimael/react-search-bar.git (update-dependencies branch)
import SearchBar from 'react-search-bar'

// Hey ios/old Explorer, here's the polyfill for fetch()
import 'whatwg-fetch'

const FIELDS = '_id, title, filename, description, source, taglist'
const ALL_IMAGES_QUERY = `query { imageRecs { ${FIELDS} } }`
const KEYWORD_SEARCH_QUERY = `query Lookup($keywords: String!) { lookup(keywords: $keywords) { ${FIELDS} } }`

// Working to figure out griddle-react 1.0 components
// Thank God for https://griddlegriddle.github.io/Griddle/examples/getDataFromRowIntoCell/

// Get all the data for this row
const rowDataSelector = (state, { griddleKey }) => {
  return state
    .get('data')
    .find(rowMap => rowMap.get('griddleKey') === griddleKey)
    .toJSON();
};

// Actually put it into the rowData object
const enhancedWithRowData = connect((state, props) => {
  return {
    // rowData will be available into AssetLinkComponent
    rowData: rowDataSelector(state, props)
  };
});

// Use rowData _id in title column
function AssetLinkComponent({ value, griddleKey, rowData }) {
  const renderBase = "/asset/"
  let target = rowData._id
  let renderPath = renderBase + target;

    return <NavLink to={ renderPath } >
        { value }
      </NavLink>
  }

// Generate pencil icon link to edit
const EditLinkComponent = function({ value }) {
  let target = { value }
  const renderBase = "/edit/"
  target = target.value
  let renderPath = renderBase + target

  // Only an icon!
  return <NavLink to={renderPath}>
    <span className="fa fa-pencil-square-o"></span>
  </NavLink>
}

// We also do not want a filter--it messes with the search function
const NewLayout = ({ Table, Pagination, Filter, SettingsWrapper }) => (
  <div>
    <SettingsWrapper />
    <Table />
    <Pagination />
  </div>
)
/* ** End of Griddle-related code ** */

// Wrap an HTML button into a component
const buttonStyle = {
  margin: '10px 10px 10px 0'
}
const Button = React.createClass({
  render: function () {
    return (
      <button
        className="btn btn-default"
        style={buttonStyle}
        onClick={this.props.handleClick}>{this.props.label}</button>
    )
  }
})

// InfoTable wraps Griddle, SearchBar, and Button components
const InfoTable = React.createClass({
  loadRecordsFromServer: function() {
    const body = this.state.searchKeywords
      ? { query: KEYWORD_SEARCH_QUERY, variables: { keywords: this.state.searchKeywords } }
      : { query: ALL_IMAGES_QUERY }

    fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(response) {
      return response.json()
    }).then(function(json) {
      if (json.data.imageRecs)
        this.setState({records: json.data.imageRecs})
      else
        this.setState({records: json.data.lookup})

      json.data = undefined
      sessionStorage.setItem('browse', JSON.stringify(this.state))
    }.bind(this))
  },
  getInitialState: function() {
    let initValues = {
      records: [],
      searchKeywords: null,
      currentPage: 1,
    }

    // Pre-load records[] object array from sessionStorage
    if (sessionStorage.getItem('browse') != null) {
      initValues = JSON.parse(sessionStorage.getItem('browse'))
      }
    return initValues;
  },
  componentDidMount: function() {
    if ((this.state.records == null) || this.state.records.length == 0)
      this.loadRecordsFromServer()
    },
  componentWillUnmount: function () {
    // Need to remember which page we're on before leaving
    sessionStorage.setItem('browse', JSON.stringify(this.state))
  },
  onSearchChange(input, resolve) {
    // Hook for "suggestions"
    },
  onSearch(input) {
    if (!input) return
    this.setState({searchKeywords: input}, function(){
        this.loadRecordsFromServer()
        sessionStorage.setItem('browse', JSON.stringify(this.state))
        }.bind(this))
    },
    // This is the very heavy moment we switch to a new view
    handleCustomSlideshowClick() {
      const viewSet = this.state.searchKeywords
        ? encodeURIComponent(this.state.searchKeywords)
        : '_all'
      this.props.history.push('/slides/' + viewSet)
    },
    clearStore() {
      sessionStorage.removeItem('browse')
      this.setState({searchKeywords: null}, function() {
        this.loadRecordsFromServer()
      }.bind(this))
    },
    // Functions to remember current page across mounts
    _onNext: function() {
      let thisPage = this.state.currentPage + 1
      this.setState( { currentPage: thisPage} )
      },
    _onPrevious: function() {
      let thisPage = this.state.currentPage
      // This protection shouldn't be necessary . . .
      thisPage = (thisPage == 1)?1:--thisPage
      this.setState( { currentPage: thisPage})
      },
    render: function() {
      return (
        <Section>
          <center>
            <h2>
              Current image data
            </h2>
          </center>
          <SearchBar
            autoFocus={false}
            placeholder={"Search image database"}
            onChange={this.onSearchChange}
            onSearch={this.onSearch} />
          <div>
            <Button
              label="Slideshow of this imageset"
              handleClick={this.handleCustomSlideshowClick}
              />
            <Button
              label="Reset search"
              handleClick={this.clearStore}
              />
          </div>
          <Griddle
            data={this.state.records}
            plugins={[plugins.LocalPlugin]}
            events={{
              onNext: this._onNext,
              onPrevious: this._onPrevious,
                }}
            components={{
              Layout: NewLayout
                }}
            pageProperties={{
              currentPage: this.state.currentPage,
              pageSize: 15,
            }} >
            <RowDefinition>
              <ColumnDefinition id="_id" title="*" customComponent={ EditLinkComponent } />
              <ColumnDefinition id="title" title="Title" customComponent={ enhancedWithRowData(AssetLinkComponent) }/>
              <ColumnDefinition id="description" title="Description" />
            </RowDefinition>
          </Griddle>
        </Section>
      )}
  })


// Here is the key to allowing a click to cause a view change
// I do not understand it well
InfoTable.contextTypes = {
  router: React.PropTypes.object.isRequired
  }


// Render composite component
export default React.createClass ( {
  contextTypes: {
   router: React.PropTypes.func.isRequired
  },
  render() {
    // console.log('Browse props entry: ' + JSON.stringify(this.props))
    // console.log('Browse context: ' + JSON.stringify(this.context))
    return (
      <div>
        <InfoTable
          history = { this.props.history }
          />
      </div>
    )
  }
})
