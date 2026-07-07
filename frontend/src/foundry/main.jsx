import ReactDOM from 'react-dom/client'
import FoundryApp from './FoundryApp.jsx'
import '../App.css'

// StrictMode intentionally omitted, same as Deck's main.jsx — Fabric.js
// doesn't tolerate the double-effect dev behavior.
ReactDOM.createRoot(document.getElementById('root')).render(<FoundryApp />)
