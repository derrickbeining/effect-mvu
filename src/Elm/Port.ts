import { Schema } from "@effect/schema"
import {
  PubSub,
  Context,
  Data,
  Layer,
  Effect,
  Stream,
  Scope,
  String,
} from "effect"
import { Simplify } from "effect/Types"

/**
 * @internal
 */
export const PortMsgSent: unique symbol = Symbol("PORT_MSG_SENT")

/**
 * @internal
 */
interface PortMsg<Name extends string, Payload>
  extends Data.Data<{ readonly _tag: Name; readonly data: Payload }> {}

/**
 *
 */
export interface PortMsgsPubSub<Name extends string, Payload>
  extends PubSub.PubSub<PortMsg<Name, Payload>> {}

/**
 *
 */
export interface Port<Name extends string, Payload> {
  readonly name: Name
  readonly send: (payload: Payload) => Effect.Effect<never, never, never>
}

/**
 * @internal
 */
type PortInstance<Name extends string, Payload> = Simplify<
  {
    readonly tag: Context.Tag<Port<Name, Payload>, Port<Name, Payload>>
    readonly layer: Layer.Layer<
      never,
      never,
      PortMsgsPubSub<Name, Payload> | Port<Name, Payload>
    >
    readonly stream: Stream.Stream<
      Scope.Scope | PortMsgsPubSub<Name, Payload>,
      never,
      Payload
    >
  } & {
    readonly [K in `${Capitalize<Name>}Port`]: Context.Tag<
      Port<Name, Payload>,
      Port<Name, Payload>
    >
  } & {
    readonly [K in `${Capitalize<Name>}PortLayer`]: Layer.Layer<
      never,
      never,
      PortMsgsPubSub<Name, Payload> | Port<Name, Payload>
    >
  } & {
    readonly [K in Name]: Stream.Stream<
      Scope.Scope | PortMsgsPubSub<Name, Payload>,
      never,
      Payload
    >
  }
>

function PortInstance<Name extends string, Payload>(
  name: Name,
  tag: Context.Tag<Port<Name, Payload>, Port<Name, Payload>>,
  layer: Layer.Layer<
    never,
    never,
    PortMsgsPubSub<Name, Payload> | Port<Name, Payload>
  >,
  stream: Stream.Stream<
    Scope.Scope | PortMsgsPubSub<Name, Payload>,
    never,
    Payload
  >
): PortInstance<Name, Payload> {
  const Name = `${name}` as const
  const Port = `${String.capitalize(Name)}Port` as `${Capitalize<Name>}Port`
  const PortLayer = `${String.capitalize(
    Name
  )}PortLayer` as `${Capitalize<Name>}PortLayer`

  return {
    tag,
    layer,
    stream,
    [Port]: tag,
    [PortLayer]: layer,
    [Name]: stream,
  } as PortInstance<Name, Payload>
}

/**
 * Constructs a port through which a stream of messages
 * can be sent to zero or more subscribers
 *
 */
export function mkPort<Name extends string, Payload>(
  name: Name,
  payloadSchema: Schema.Schema<Payload>
): PortInstance<Name, Payload> {
  const pubSubService = Context.Tag<PortMsgsPubSub<Name, Payload>>(
    `${name}PubSub`
  )
  const pubSubLayer = Layer.effect(
    pubSubService,
    PubSub.unbounded<
      Data.Data<{ readonly _tag: Name; readonly data: Payload }>
    >()
  )

  const portService = Context.Tag<Port<Name, Payload>>(`${name}Port`)
  const portLayer = Layer.effect(
    portService,
    Effect.gen(function* (_) {
      const pubSub = yield* _(pubSubService)

      return portService.of({
        name,
        send: (payload) => {
          return PubSub.publish(
            pubSub,
            Data.struct({ _tag: name, data: payload })
          ).pipe(Effect.map(() => PortMsgSent as never))
        },
      })
    })
  )

  const mainLayer = Layer.provideMerge(pubSubLayer, portLayer)

  const stream = Stream.asyncEffect<
    Scope.Scope | PortMsgsPubSub<Name, Payload>,
    never,
    Payload
  >((emit) =>
    Effect.gen(function* (_) {
      const pubSub = yield* _(pubSubService)
      const queue = yield* _(PubSub.subscribe(pubSub))
      yield* _(
        Stream.fromQueue(queue),
        Stream.filter(
          Schema.is(
            Schema.struct({ _tag: Schema.literal(name), data: payloadSchema })
          )
        ),
        Stream.runForEach((msg) => Effect.promise(() => emit.single(msg.data))),
        Effect.fork
      )
    })
  )

  return PortInstance<Name, Payload>(name, portService, mainLayer, stream)
}
