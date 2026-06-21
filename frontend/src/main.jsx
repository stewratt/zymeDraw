import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './App.css'

// StrictMode is intentionally omitted: it runs every effect twice in dev,
// which doesn't play well with Fabric.js (it mutates the canvas DOM element
// during init/dispose). This is the standard practice for Fabric + React.
ReactDOM.createRoot(document.getElementById('root')).render(<App />)
