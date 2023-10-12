import { Effect } from "effect"
import { constVoid, dual } from "effect/Function"

interface Send<Msg> {
  (msg: Msg): void
}

export interface ReleaseSub<R> extends Effect.Effect<R, never, void> {}

export interface AcquireRelease<R, Msg> {
  (send: Send<Msg>): Effect.Effect<R, never, ReleaseSub<R>>
}

export class Sub<R, Msg> {
  static acquireRelease = <R, Msg>(
    acquire: AcquireRelease<R, Msg>
  ): Sub<R, Msg> => {
    return new Sub(acquire)
  }

  static none: Sub<never, never> = new Sub(() =>
    Effect.succeed(Effect.succeed(constVoid()))
  )

  static map = dual<
    <A, B>(f: (a: A) => B) => <R>(self: Sub<R, A>) => Sub<R, B>,
    <R, A, B>(self: Sub<R, A>, f: (a: A) => B) => Sub<R, B>
  >(2, (self, fn) => {
    return Sub.acquireRelease((send) => {
      return self.acquire((msg) => {
        send(fn(msg))
      })
    })
  })

  private constructor(public acquire: AcquireRelease<R, Msg>) {}
}
