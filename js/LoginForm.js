import React from 'react'

export default React.createClass({
  getInitialState: function() {
    return { email: '', password: '', error: null, submitting: false }
  },
  handleSubmit: function(e) {
    e.preventDefault()
    this.setState({ submitting: true, error: null })
    fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.state.email, password: this.state.password })
    })
    .then(function(res) { return res.json() }.bind(this))
    .then(function(data) {
      if (data.user) {
        this.props.onLogin(data.user)
      } else {
        this.setState({ error: data.error || 'Login failed', submitting: false })
      }
    }.bind(this))
    .catch(function() {
      this.setState({ error: 'Network error — please try again', submitting: false })
    }.bind(this))
  },
  render: function() {
    return (
      <form onSubmit={this.handleSubmit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="email"
          placeholder="Email"
          value={this.state.email}
          onChange={function(e) { this.setState({ email: e.target.value }) }.bind(this)}
          required
          style={{ padding: '4px 8px' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={this.state.password}
          onChange={function(e) { this.setState({ password: e.target.value }) }.bind(this)}
          required
          style={{ padding: '4px 8px' }}
        />
        <button type="submit" disabled={this.state.submitting} className="btn btn-sm btn-primary">
          {this.state.submitting ? 'Signing in…' : 'Login'}
        </button>
        {this.state.error && <span style={{ color: 'red', fontSize: '0.85em' }}>{this.state.error}</span>}
      </form>
    )
  }
})
