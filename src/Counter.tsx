import { Send, mkView } from "./Elm/View"
import { Effect, Console, Stream, Schedule, Duration, pipe } from "effect"
import { match } from "ts-pattern"
import { Transition } from "./Elm/Transition"
import * as Cmd from "./Elm/Cmd"

export type Model = number

export type Msg =
  | { readonly tag: "Increment" }
  | { readonly tag: "Decrement" }
  | { readonly tag: "Noop" }

export const init: Transition<never, Model, Msg> = Transition({
  nextState: 0,
  cmd: Cmd.cmd([
    Effect.gen(function* (_) {
      yield* _(Console.log("init"))
      return { tag: "Noop" }
    }),
  ]),
})

export const update = (
  model: Model,
  msg: Msg
): Transition<never, Model, Msg> => {
  return match<Msg, Transition<never, Model, Msg>>(msg)
    .with({ tag: "Increment" }, () =>
      Transition({
        nextState: model + 1,
        cmd: Cmd.cmd([
          Effect.gen(function* (_) {
            yield* _(Effect.sleep(`3 seconds`))
            yield* _(Console.log("Incremented", "3s delay"))
            return { tag: "Noop" }
          }),
          Effect.gen(function* (_) {
            yield* _(Console.log("Incremented", "no delay"))
            return { tag: "Noop" }
          }),
          Effect.gen(function* (_) {
            yield* _(Effect.sleep(`1 seconds`))
            yield* _(Console.log("Incremented", "1s delay"))
            return { tag: "Noop" }
          }),
        ]),
      })
    )
    .with({ tag: "Decrement" }, () =>
      Transition({
        nextState: model - 1,
        cmd: Cmd.none,
      })
    )
    .with({ tag: "Noop" }, () =>
      Transition({
        nextState: model,
        cmd: Cmd.none,
      })
    )
    .exhaustive()
}

function interval(interval: Duration.DurationInput) {
  return Stream.schedule(
    Stream.repeatEffect(Effect.unit),
    Schedule.delayed(Schedule.spaced(interval), () => interval)
  )
}

export const subscriptions = (
  model: Model
): Stream.Stream<never, never, Msg> => {
  Effect.whenEffect
  return model > 5
    ? pipe(
        interval(Duration.millis(500)),
        Stream.map(() => ({ tag: "Increment" }))
      )
    : Stream.identity()
}

export const view = mkView((send: Send<Msg>, model: Model) => {
  return (
    <div>
      <button onClick={() => send({ tag: "Increment" })}>Increment</button>
      <button onClick={() => send({ tag: "Decrement" })}>Decrement</button>
      <p>count is {model}</p>
    </div>
  )
})
