import ReactDOM from "react-dom/client"
import { Console, Duration, Effect, Stream } from "effect"
import * as App from "./App"
import "./index.css"
import { mkModelViewUpdateDomProgram } from "./Elm/Program"

// Effect.runPromise(
//   Effect.gen(function* (_) {
//     const ticker = Stream.tick(Duration.seconds(1))
//     yield* _(
//       Effect.fork(
//         ticker.pipe(
//           Stream.map(() => new Date().toISOString()),
//           Stream.runForEach((date) =>
//             Effect.gen(function* (_) {
//               yield* _(Console.log(date))
//             })
//           )
//         )
//       )
//     )

//     yield* _(Stream.runDrain(Stream.haltAfter(ticker, Duration.seconds(3))))
//     console.log("done")
//   })
// )

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
  .then((it) => console.log("app", it))
  .catch(console.error)
