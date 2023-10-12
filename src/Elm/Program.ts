import {
  Effect,
  Chunk,
  Queue,
  ReadonlyArray as RA,
  Fiber,
  Stream,
  Option,
  SubscriptionRef,
  Equal,
  Take,
  Duration,
  FiberId,
} from "effect"

import * as Cmd from "./Cmd"
import { View } from "./View"
import { Transition } from "./Transition"

interface Send<Msg> {
  (msg: Msg): void
}

interface VDomManager<VDom> {
  render(vdom: VDom): Effect.Effect<never, never, void>
  unmount: Effect.Effect<never, never, void>
}

interface ModelViewUpdateProgram<RInit, Model, Msg, RUpdate, RView, RSub> {
  init: Transition<RInit, Model, Msg>
  update: (model: Model, msg: Msg) => Transition<RUpdate, Model, Msg>
  view: (model: Model, sendMsg: Send<Msg>) => Effect.Effect<RView, never, void>
  // subscriptions: (model: Model) => Sub<RSub, Msg>
  subscriptions: (model: Model) => Stream.Stream<RSub, never, Msg>
}

export function mkMvuCore<RInit, Model, Msg, RUpdate, RView, RSub>(
  program: ModelViewUpdateProgram<RInit, Model, Msg, RUpdate, RView, RSub>
): Effect.Effect<RInit | RUpdate | RView | RSub, never, void> {
  const { init, update, view, subscriptions } = program

  return Effect.scoped(
    Effect.gen(function* (_) {
      const stateRef = yield* _(SubscriptionRef.make(init.nextState))

      const cmdQueue = yield* _(
        Queue.unbounded<Cmd.Cmd<RInit | RUpdate, Msg>>()
      )

      yield* _(Queue.offer(cmdQueue, init.cmd))

      const msgQueue = yield* _(Queue.unbounded<Take.Take<never, Msg>>())

      function sendMsg(msg: Msg): void {
        Effect.runSync(Queue.offer(msgQueue, Take.of(msg)))
      }

      yield* _(
        Effect.forkDaemon(
          Stream.runFoldEffect(
            stateRef.changes,
            // Effect.succeed(constVoid()) as ReleaseSub<RSub>,
            [
              Fiber.unit,
              Stream.empty as Stream.Stream<RSub, never, Msg>,
            ] as const,
            ([prevDaemon, prevStream], model) => {
              // console.log("subscriptions state changed: ", model)
              const sub = subscriptions(model)
              console.log({ sub })
              return Effect.gen(function* (_) {
                // console.log("one")
                yield* _(
                  Stream.runDrain(
                    Stream.interruptAfter(prevStream, Duration.zero)
                  )
                )
                yield* _(prevDaemon.interruptAsFork(FiberId.none))
                // console.log("two")
                // yield* _(release)
                yield* _(view(model, sendMsg))
                const fiber = yield* _(
                  Effect.forkDaemon(Stream.runIntoQueue(sub, msgQueue))
                )
                // console.log("three")
                // const nextRelease = yield* _(sub.acquire(sendMsg))
                // return nextRelease
                return [fiber, sub] as const
              })
            }
          )
        )
      )

      const processCmds = Effect.forever(
        Effect.gen(function* (_) {
          const cmds = yield* _(Queue.takeBetween(cmdQueue, 1, Infinity))
          const effs = Chunk.flatMap(cmds, (it) =>
            Chunk.fromIterable(Cmd.unCmd(it))
          )
          yield* _(
            Effect.fork(
              Effect.forEach(
                effs,
                Effect.flatMap((msg) => Queue.offer(msgQueue, Take.of(msg))),
                { concurrency: "unbounded" }
              )
            )
          )
        })
      )

      const processMsgs = Effect.forever(
        Effect.gen(function* (_) {
          const state = yield* _(SubscriptionRef.get(stateRef))
          const msgs = yield* _(
            Queue.takeBetween(msgQueue, 1, Infinity),
            Effect.map(
              Chunk.filterMap((it) =>
                Take.match(it, {
                  onEnd: () => Option.none(),
                  onFailure: () => Option.none(),
                  onSuccess: (msg) => Option.some(msg),
                })
              )
            ),
            Effect.map(Chunk.flatten)
          )

          const [nextState, cmds] = RA.reduce(
            msgs,
            [state, Array<Cmd.Cmd<RUpdate, Msg>>()] as const,
            ([nextState, cmds], msg) => {
              const transition = update(nextState, msg)
              cmds.push(transition.cmd)
              return [transition.nextState, cmds] as const
            }
          )

          if (!Equal.equals(nextState, state)) {
            console.log({ state, nextState })
            yield* _(view(nextState, sendMsg))
            yield* _(SubscriptionRef.set(stateRef, nextState))
          }
          yield* _(Queue.offerAll(cmdQueue, cmds))
        })
      )

      yield* _(
        Effect.all([processCmds, processMsgs], { concurrency: "unbounded" })
      )
    })
  )
}

export function mkModelViewUpdateProgram<
  RInit,
  Model,
  Msg,
  RUpdate,
  RView,
  RSub
>(
  program: ModelViewUpdateProgram<RInit, Model, Msg, RUpdate, RView, RSub>
): Effect.Effect<
  RInit | RUpdate | RView | RSub,
  never,
  Fiber.RuntimeFiber<never, void>
> {
  return Effect.forkDaemon(mkMvuCore(program))
}

interface ModelViewUpdateDomProgram<RInit, Model, Msg, RUpdate, VDom, RSub> {
  init: Transition<RInit, Model, Msg>
  update: (model: Model, msg: Msg) => Transition<RUpdate, Model, Msg>
  view: (model: Model) => View<Msg, VDom>
  // subscriptions: (model: Model) => Sub<RSub, Msg>
  subscriptions: (model: Model) => Stream.Stream<RSub, never, Msg>
  bootstrap: Effect.Effect<never, never, VDomManager<VDom>>
}

export function mkModelViewUpdateDomProgram<
  RInit,
  Model,
  Msg,
  RUpdate,
  VDom,
  RSub
>(
  program: ModelViewUpdateDomProgram<RInit, Model, Msg, RUpdate, VDom, RSub>
): Effect.Effect<
  RInit | RUpdate | RSub,
  never,
  Fiber.RuntimeFiber<never, void>
> {
  const { init, update, view, subscriptions, bootstrap } = program

  return Effect.forkDaemon(
    Effect.gen(function* (_) {
      const vdomMgr = yield* _(bootstrap)
      yield* _(
        mkMvuCore({
          init,
          update: update,
          view: (model: Model, send: Send<Msg>) =>
            vdomMgr.render(view(model)(send)),
          subscriptions,
        }),
        Effect.ensuring(vdomMgr.unmount)
      )
    })
  )
}