import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './tokens.css'
import './App.css'

// The dev BG EXPERIMENT switcher (bottom-left panel) is parked, not deleted:
// its settled choices are now hard-coded — base/texture/blend/opacity in
// tokens.css, the two fonts as @font-face in App.css. To audition again,
// restore the import + the <BgTextureSwitcher /> mount below; the panel, its
// font catalog, and the audition library are all still on disk.
// import BgTextureSwitcher from './BgTextureSwitcher.jsx'

// StrictMode is intentionally omitted: it runs every effect twice in dev,
// which doesn't play well with Fabric.js (it mutates the canvas DOM element
// during init/dispose). This is the standard practice for Fabric + React.
ReactDOM.createRoot(document.getElementById('root')).render(
  <>
    <App />
    {/* <BgTextureSwitcher /> — parked; see note above */}
  </>,
)
