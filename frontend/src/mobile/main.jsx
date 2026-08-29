// The pocket entry (mobile.html → here). A second Vite entry over the same
// shared core: deck.js, masterRaster, brushCore, the card registry and
// Card.jsx are the desktop's, byte for byte (mobile_plan.md §5).
//
// The two seams Wave 1 cut are installed here, before anything mounts, so no
// component below ever learns where images come from or where a piece goes.
//
// StrictMode is omitted for the same reason the desktop omits it: Fabric
// mutates the canvas element during init/dispose and can't take the
// double-effect dev behavior (CLAUDE.md §3).

import ReactDOM from 'react-dom/client'
import MobileApp from './MobileApp.jsx'
import { installMobileImageSource } from './imageSources.js'
import { installMobileExportSink } from './mobileExport.js'
import '../tokens.css'
import '../App.css'
import '../editor/editor.css'
import './mobile.css'

installMobileImageSource()
installMobileExportSink()

ReactDOM.createRoot(document.getElementById('root')).render(<MobileApp />)
