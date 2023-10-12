import reactLogo from "./assets/react.svg"
import viteLogo from "/vite.svg"
import "./App.css"
import * as View from "./Elm/View"
import * as Counter from "./Counter"
import { Data, Stream } from "effect"
import { Transition } from "./Elm/Transition"
import * as Cmd from "./Elm/Cmd"
import { match } from "ts-pattern"
import { Sub } from "./Elm/Sub"

export type Msg = Data.TaggedEnum<{
  CounterMsg: Counter.Msg
}>

export const Msg = Data.taggedEnum<Msg>()

export type Model = { counter: Counter.Model }

export const init: Transition<never, Model, Msg> = Transition({
  nextState: { counter: Counter.init.nextState },
  cmd: Cmd.map(Counter.init.cmd, Msg("CounterMsg")),
})

export function update(model: Model, msg: Msg): Transition<never, Model, Msg> {
  return match(msg)
    .with({ _tag: "CounterMsg" }, (subMsg) => {
      const counter = Counter.update(model.counter, subMsg)

      return Transition({
        nextState: { ...model, counter: counter.nextState },
        cmd: Cmd.batch([Cmd.map(counter.cmd, Msg("CounterMsg"))]),
      })
    })
    .exhaustive()
}

export const subscriptions = (
  model: Model
): Stream.Stream<never, never, Msg> => {
  return Stream.map(Counter.subscriptions(model.counter), Msg("CounterMsg"))
}

export const view = View.mkView((send: View.Send<Msg>, model: Model) => {
  return (
    <>
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        {View.lift(send, Msg("CounterMsg"), Counter.view(model.counter))}
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
})
