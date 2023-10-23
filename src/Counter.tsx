import { Send, mkView } from "./Elm/View"
import {
  Effect,
  Console,
  Stream,
  Schedule,
  Duration,
  pipe,
  Data,
  Tuple,
} from "effect"
import { match } from "ts-pattern"
import * as Cmd from "./Elm/Cmd"

export type Model = number

export type Msg = Data.TaggedEnum<{
  Increment: {}
  Decrement: {}
  Noop: {}
}>

const Msg = Data.taggedEnum<Msg>()

export const init: [Model, Cmd.Cmd<never, Msg>] = Tuple.tuple(0, Cmd.none)

export const update = (
  model: Model,
  msg: Msg
): [Model, Cmd.Cmd<never, Msg>] => {
  return match<Msg, [Model, Cmd.Cmd<never, Msg>]>(msg)
    .with({ _tag: "Increment" }, () =>
      Tuple.tuple(
        model + 1,
        Cmd.cmd([
          Effect.gen(function* (_) {
            yield* _(Effect.sleep(`3 seconds`))
            yield* _(Console.log("Incremented", "3s delay"))
            return Msg("Noop")()
          }),
          Effect.gen(function* (_) {
            yield* _(Console.log("Incremented", "no delay"))
            return Msg("Noop")()
          }),
          Effect.gen(function* (_) {
            yield* _(Effect.sleep(`1 seconds`))
            yield* _(Console.log("Incremented", "1s delay"))
            return Msg("Noop")()
          }),
        ])
      )
    )
    .with({ _tag: "Decrement" }, () => Tuple.tuple(model - 1, Cmd.none))
    .with({ _tag: "Noop" }, () => Tuple.tuple(model, Cmd.none))
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
  return model > 5
    ? pipe(
        interval(Duration.millis(1)),
        Stream.map(() => Msg("Increment")())
      )
    : Stream.identity()
}

export const view = mkView((send: Send<Msg>, model: Model) => {
  return (
    <div>
      <button onClick={() => send(Msg("Increment")())}>Increment</button>
      <button onClick={() => send(Msg("Decrement")())}>Decrement</button>
      <p>count is {model}</p>
    </div>
  )
})
