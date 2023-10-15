import ReactDOM from "react-dom/client"
import { Effect } from "effect"
import * as App from "./App"
import "./index.css"
import { mkModelViewUpdateDomProgram } from "./Elm/Program"

const program = mkModelViewUpdateDomProgram({
  init: App.init,
  update: App.update,
  view: App.view,
  subscriptions: App.subscriptions,
  bootstrap: Effect.sync(() => {
    const rootElmt = document.getElementById("root")

    const fallbackElmt = document.createElement("div")
    fallbackElmt.setAttribute("id", "root")

    if (!rootElmt) {
      document.body.appendChild(fallbackElmt)
    }

    const reactRoot = ReactDOM.createRoot(rootElmt || fallbackElmt)

    return {
      render: (vdom: JSX.Element) => Effect.sync(() => reactRoot.render(vdom)),
      unmount: Effect.sync(() => reactRoot.unmount()),
    }
  }),
})

Effect.runPromise(program)
  .then((it) => {
    console.log("app", it)
  })
  .catch(console.error)
