/*
  ** Edit: Provide facility for editing/deleting main image records
*/

import React from 'react'
import { Section } from 'neal-react'
import InfoFields from './InfoFields'
import Confirmation from './Confirmation'

// fieldValues provide form input
let fieldValues = {
  title : null,
  description : null,
  source : null,
  taglist : null
}

// Module "globals"
let id = '',
  serverFilename = ''

// This component is something of a love child between Browse and Upload
const EditDeleteWidget = React.createClass({
  getInitialState: function() {
    return {
      isLoggedIn: this.checkSignedInWithMessage(),
      step: 1
    }
  },
  componentDidMount: function() {
    // console.log('Mounting event')
    // console.log(this.state.record)

    // Extract query part only of URL (i.e. the part after the '?')
    let queryTarget = "";
    firebase.auth().onAuthStateChanged(this.onAuthStateChanged)
    this.loadRecordsFromServer()
  },
  onAuthStateChanged: function(user) {
     if (user) {
       this.setState( {
         isLoggedIn: true,
       })
     }
     else {
       this.setState( {
         isLoggedIn: false,
       })
     }
   },
  checkSignedInWithMessage: function() {
    // Return true if the user is signed in Firebase
    return firebase.auth().currentUser;
  },
  loadRecordsFromServer: function() {
    const body = {
      query: 'query GetImage($id: ID!) { imageRec(id: $id) { _id, title, filename, description, source, taglist } }',
      variables: { id: this.props.record }
    }
    fetch('/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(function(response) {
      return response.json()
    }).then(function(json) {
      this.setState({record: json.data.imageRec})
    }.bind(this))
  },
  nextStep: function() {
    this.setState({
      step : this.state.step + 1
    })
  },
  // Now superfluous 3/4/17
  resetStep: function() {
    // See you later; when edit finishes go to Browse view
    this.context.router.push('/browse')
  },
  saveValues: function(fields) {
      fieldValues = Object.assign({}, fieldValues, fields)
      fieldValues.filename = serverFilename

      // Clear out cached data in local store
      sessionStorage.removeItem('browse')

      const body = {
        query: 'mutation UpdateImage($data: ImageRecUpdate) { updateImage(data: $data) }',
        variables: {
          data: {
            _id: id,
            title: fieldValues.title,
            description: fieldValues.description,
            filename: fieldValues.filename,
            source: fieldValues.source,
            taglist: fieldValues.taglist
          }
        }
      }
      fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function(response) {
        return response.json()
      })
  },
  deleteRecord: function() {
      // Clear out cached data in local store
      sessionStorage.removeItem('browse')

      const body = {
        query: 'mutation DeleteImage($id: ID!) { deleteImage(id: $id) }',
        variables: { id: id }
      }
      fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      }).then(function(response) {
        return response.json()
      })
  },
  render: function() {
    // console.log('rendering widget')
    switch(this.state.step) {
      case 1:
      if (this.checkSignedInWithMessage()) {
        // Only allow editing when there is a valid logged-in user
        if (!this.state.record) {
          // Data is not ready yet
          return (
            // This causes the screen to flash!!
            <div> Waiting </div>
          )
        }
        else {
          // console.log(JSON.stringify(this.state))
          // Note: async strangeness possible here . . ??
          fieldValues.title = this.state.record.title
          fieldValues.description = this.state.record.description
          fieldValues.source = this.state.record.source
          fieldValues.taglist = this.state.record.taglist
          // These next two are not subject to user editing
          id = this.state.record._id
          serverFilename = this.state.record.filename
          return (
            <div>
              <Section>
                <center>
                  <h2>
                    Edit/Delete image record values
                  </h2>
                </center>
                <InfoFields
                  fieldValues={fieldValues}
                  isCreate={false}
                  nextStep={this.nextStep}
                  saveValues={this.saveValues}
                  deleteRecord={this.deleteRecord}/>
              </Section>
            </div>
          )
        }
      } else {
        // Post message that edits are only for authorized users
        return (
          <Section>
            <div>
              <center>
                <h2>
                  You must be logged in to Edit
                </h2>
              </center>
            </div>
          </Section>
        )
      }
      case 2:
      console.log('Edit resetStep ' + this.resetStep)
      return (
        <Confirmation resetStep={this.resetStep} />
        )
    }
  }
})

// Attach the router to the widget's context so we can jump out
EditDeleteWidget.contextTypes = {
  router: React.PropTypes.object.isRequired
  }

// Render component
export default React.createClass ( {
  render() {
    // console.log('Edit props ' + JSON.stringify(this.props))
    // console.log('Edit context ' + JSON.stringify(this.context))
    return (
      <div>
        <EditDeleteWidget record={this.props.match.params.imageId}/>
      </div>
    )
  }
})
