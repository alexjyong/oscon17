/*
  ** Common "Navbar" header used by all views
*/

import React from "react"
import { Navbar, NavItem } from "neal-react"
import { NavLink } from 'react-router-dom'
import LoginForm from './LoginForm'

const brandName = "Scene:History"
const brand = <span>{brandName}</span>

const nameStyle = {
  fontWeight: 'bold',
  color: 'maroon',
}

const SubscribeBtn = React.createClass({
  getInitialState: function() {
    return {
      label: 'Subscribe',
      subscribeDisabled: false,
      isSubscribed: false
    }
  },
  updateBtn() {
    this.setState({ isSubscribed: !(this.state.isSubscribed) }, function() {
      let text = (this.state.isSubscribed ? 'Unsubscribe' : 'Subscribe')
      this.setState({ label: text })
    })
  },
  render: function() {
    return (
      <button
        className="btn btn-primary js-push-btn mdl-button mdl-js-button mdl-button--raised mdl-js-ripple-effect"
        onClick={this.updateBtn}>{this.state.label}</button>
    )
  }
})

const NavHeader = React.createClass({
  getInitialState: function() {
    return {
      isLoggedIn: false,
      userName: '',
      loading: true
    }
  },
  componentDidMount: function() {
    fetch('/api/me')
      .then(function(res) { return res.json() })
      .then(function(data) {
        if (data.user) {
          this.setState({ isLoggedIn: true, userName: data.user.displayName, loading: false })
        } else {
          this.setState({ isLoggedIn: false, loading: false })
        }
      }.bind(this))
      .catch(function() {
        this.setState({ loading: false })
      }.bind(this))
  },
  handleLogin: function(user) {
    this.setState({ isLoggedIn: true, userName: user.displayName })
  },
  handleLogout: function() {
    fetch('/logout', { method: 'POST' })
      .then(function() {
        this.setState({ isLoggedIn: false, userName: '' })
      }.bind(this))
  },
  render: function() {
    const authSection = this.state.isLoggedIn
      ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span style={nameStyle}>{this.state.userName}</span>
          <a onClick={this.handleLogout} style={{ cursor: 'pointer' }} className="btn btn-sm btn-default">Logout</a>
        </span>
      : <LoginForm onLogin={this.handleLogin} />

    return (
      <div>
        <Navbar brand={brand}>
          <NavItem><NavLink to="/home" className="nav-link">Home</NavLink></NavItem>
          <NavItem><NavLink to="/browse" className="nav-link">Browse</NavLink></NavItem>
          <NavItem><NavLink to="/upload" className="nav-link">Upload</NavLink></NavItem>
          <NavItem><NavLink to="/subscribe" className="nav-link">Notifications</NavLink></NavItem>
          <NavItem>{authSection}</NavItem>
        </Navbar>
      </div>
    )
  }
})

export default class extends React.Component {
  constructor(props) {
    super(props)
  }
  render() {
    return <NavHeader />
  }
}
