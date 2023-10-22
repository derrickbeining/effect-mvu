import reactLogo from "./assets/react.svg"
import viteLogo from "/vite.svg"
import "./App.css"
import * as View from "./Elm/View"
import * as Counter from "./Counter"
import { Data, Effect, Stream } from "effect"
import { Transition } from "./Elm/Transition"
import * as Cmd from "./Elm/Cmd"
import { match } from "ts-pattern"
import * as Ports from "./Ports"
import { Port } from "./Elm/Port"

export type Msg = Data.TaggedEnum<{
  CounterMsg: { msg: Counter.Msg }
  GotTime: { time: Date }
  SendAlert: { message: string }
  Noop: {}
}>

export const Msg = Data.taggedEnum<Msg>()

export type Model = { counter: Counter.Model; time: Date }

export const init = Transition<never, Model, Msg>({
  nextState: { counter: Counter.init.nextState, time: new Date() },
  cmd: Cmd.batch<never, Msg>([
    Cmd.map(Counter.init.cmd, (msg) => Msg("CounterMsg")({ msg })),
  ]),
})

export function update(
  model: Model,
  msg: Msg
): Transition<Port<"alert", string>, Model, Msg> {
  return match(msg)
    .with({ _tag: "SendAlert" }, ({ message }) => {
      console.log("send alert")
      return Transition({
        nextState: { ...model, time: new Date() },
        cmd: Cmd.cmd([
          Effect.gen(function* (_) {
            const alert = yield* _(Ports.AlertPort)
            yield* _(alert.send(message))
            return Msg("Noop")()
          }),
        ]),
      })
    })
    .with({ _tag: "CounterMsg" }, (counterMsg) => {
      const counter = Counter.update(model.counter, counterMsg.msg)

      return Transition({
        nextState: { ...model, counter: counter.nextState },
        cmd: Cmd.batch([
          Cmd.map(counter.cmd, (msg) => Msg("CounterMsg")({ msg })),
        ]),
      })
    })
    .with({ _tag: "GotTime" }, ({ time }) => {
      return Transition({
        nextState: { ...model, time },
        cmd: Cmd.none,
      })
    })
    .with({ _tag: "Noop" }, () =>
      Transition({ nextState: model, cmd: Cmd.none })
    )
    .exhaustive()
}

export const subscriptions = (model: Model) => {
  return Stream.mergeAll(
    [
      Stream.map(
        Counter.subscriptions(model.counter),
        (msg) => Msg("CounterMsg")({ msg }) as Msg
      ),
      Stream.map(Ports.timeUpdated, (time) => Msg("GotTime")({ time }) as Msg),
    ],
    { concurrency: "unbounded" }
  )
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
        {View.lift(
          send,
          (msg) => Msg("CounterMsg")({ msg }),
          Counter.view(model.counter)
        )}
      </div>
      <p className="read-the-docs">Time: {model.time.toISOString()}</p>
      <button
        onClick={() => send(Msg("SendAlert")({ message: "This is an alert" }))}
      >
        Alert
      </button>
    </>
  )
})
