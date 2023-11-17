import ReactDOM from "react-dom/client"
import { Duration, Effect, Stream, pipe } from "effect"
import * as App from "./App"
import "./index.css"
import { mkModelViewUpdateDomProgram } from "./Elm/Program"
import * as Ports from "./Ports"

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

const app = Effect.gen(function* (_) {
  const timeUpdated = yield* _(Ports.TimeUpdatedPort)

  const timeUpdatedPort = pipe(
    Stream.tick(Duration.days(1)),
    Stream.runForEach(() => timeUpdated.send(new Date()))
  )

  const alertPort = pipe(
    Ports.alert,
    Stream.runForEach((message) => Effect.sync(() => alert(message)))
  )

  yield* _(
    Effect.all([program, alertPort, timeUpdatedPort], {
      concurrency: "unbounded", // necessary, otherwise defaults to 2
    })
  )
})

app.pipe(
  Effect.provide(Ports.TimeUpdatedPortLayer),
  Effect.provide(Ports.AlertPortLayer),
  Effect.scoped,
  Effect.runPromise
)
