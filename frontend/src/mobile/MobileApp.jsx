// The pocket app's two stages: intake, then the session. Nothing else — the
// desktop's doors (the Foundry, the deck editor, the ML setup, the copy
// editor) are not part of the pocket version (mobile_plan.md §1.3).
//
// "Begin again" at the Coda restarts inside the session with the same pool,
// which is the honest simple answer: the images you chose are still the
// images you chose. The way back to intake is the one link on the finish
// screen, and it remounts the session so nothing survives the change.

import { useState } from 'react'
import MobileIntake from './MobileIntake.jsx'
import MobileSession from './MobileSession.jsx'

function MobileApp() {
  const [stage, setStage] = useState('intake')
  // Bumped on every entry into a session, so the session (canvas, master,
  // deck) is built fresh rather than resumed.
  const [run, setRun] = useState(0)

  if (stage === 'intake') {
    return (
      <MobileIntake
        onBegin={() => {
          setRun((n) => n + 1)
          setStage('session')
        }}
      />
    )
  }
  return <MobileSession key={run} onBackToIntake={() => setStage('intake')} />
}

export default MobileApp
