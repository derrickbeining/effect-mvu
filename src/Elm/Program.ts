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
} from "effect"

import * as Cmd from "./Cmd"
import { View } from "./View"
import { PortMsgSent } from "./Port"

interface Send<Msg> {
  (msg: Msg): void
}

interface VDomManager<VDom> {
  render(vdom: VDom): Effect.Effect<never, never, void>
  unmount: Effect.Effect<never, never, void>
}

interface ModelViewUpdateProgram<RInit, Model, Msg, RUpdate, RView, RSub> {
  init: [Model, Cmd.Cmd<RInit, Msg>]
  update: (model: Model, msg: Msg) => [Model, Cmd.Cmd<RUpdate, Msg>]
  view: (model: Model, sendMsg: Send<Msg>) => Effect.Effect<RView, never, void>
  subscriptions: (model: Model) => Stream.Stream<RSub, never, Msg>
}

export function mkMvuCore<RInit, Model, Msg, RUpdate, RView, RSub>(
  program: ModelViewUpdateProgram<RInit, Model, Msg, RUpdate, RView, RSub>
): Effect.Effect<RInit | RUpdate | RView | RSub, never, void> {
  const {
    init: [initModel, initCmd],
    update,
    view,
    subscriptions,
  } = program

  return Effect.gen(function* (_) {
    const stateRef = yield* _(SubscriptionRef.make(initModel))

    const cmdQueue = yield* _(Queue.unbounded<Cmd.Cmd<RInit | RUpdate, Msg>>())

    yield* _(Queue.offer(cmdQueue, initCmd))

    const msgQueue = yield* _(Queue.unbounded<Take.Take<never, Msg>>())

    function sendMsg(msg: Msg): void {
      Effect.runSync(Queue.offer(msgQueue, Take.of(msg)))
    }

    const processStateChanges = Stream.runFoldEffect(
      stateRef.changes,
      Fiber.unit,
      (prevDaemon, model) => {
        // console.log("state changed: ", model)
        const sub = subscriptions(model)
        return Effect.gen(function* (_) {
          yield* _(Fiber.interrupt(prevDaemon))

          yield* _(view(model, sendMsg))

          const fiber = yield* _(
            Stream.runIntoQueue(sub, msgQueue),
            Effect.fork
          )

          return fiber
        })
      }
    )

    const processCmds = Effect.forever(
      Effect.gen(function* (_) {
        const cmds = yield* _(Queue.takeBetween(cmdQueue, 1, Infinity))
        const effs = cmds.pipe(
          Chunk.flatMap((it) => Chunk.fromIterable(Cmd.unCmd(it)))
        )
        yield* _(
          Effect.fork(
            Effect.forEach(
              effs,
              Effect.flatMap((msg) =>
                msg === PortMsgSent
                  ? Effect.succeed(true)
                  : Queue.offer(msgQueue, Take.of(msg))
              ),
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
          ([prevModel, cmds], msg) => {
            const [nextModel, cmd] = update(prevModel, msg)
            cmds.push(cmd)
            return [nextModel, cmds] as const
          }
        )
        // console.log(RA.fromIterable(msgs), { state, nextState })
        if (Equal.equals(nextState, state)) {
          console.log("states are equal; skipping update")
        } else {
          yield* _(SubscriptionRef.set(stateRef, nextState))
        }
        yield* _(Queue.offerAll(cmdQueue, cmds))
      })
    )

    yield* _(
      Effect.all([processStateChanges, processCmds, processMsgs], {
        concurrency: "unbounded",
      })
    )
  })
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
  init: [Model, Cmd.Cmd<RInit, Msg>]
  update: (model: Model, msg: Msg) => [Model, Cmd.Cmd<RUpdate, Msg>]
  view: (model: Model) => View<Msg, VDom>
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
