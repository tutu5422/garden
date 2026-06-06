'use client'

import { Component, type ReactNode } from 'react'

interface State {
  hasError: boolean
  error: string
}

export default class ErrorCatcher extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false, error: '' }

  componentDidCatch(error: Error) {
    this.setState({ hasError: true, error: error.message + '\n' + error.stack?.slice(0, 500) })
    if (typeof document === 'undefined') return
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:#dc2626;color:#fff;padding:16px;font-size:14px;white-space:pre-wrap;max-height:50vh;overflow:auto'
    el.textContent = 'React Error: ' + error.message + '\n' + (error.stack || '')
    document.body.appendChild(el)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#dc2626', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap' }}>
          <h3>React 渲染错误</h3>
          <p>{this.state.error}</p>
        </div>
      )
    }
    return this.props.children
  }
}
