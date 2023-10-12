import { Effect as Eff, ReadonlyArray as RA } from "effect"
import { dual, unsafeCoerce } from "effect/Function"

declare const CmdSymbol: unique symbol

export interface Cmd<R, Msg> {
  readonly [CmdSymbol]: [R, Msg]
}

export function cmd<R, Msg>(
  effs: ReadonlyArray<Eff.Effect<R, never, Msg>>
): Cmd<R, Msg> {
  return unsafeCoerce(effs)
}

/**
 * @internal
 */
export function unCmd<R, Msg>(
  cmd: Cmd<R, Msg>
): ReadonlyArray<Eff.Effect<R, never, Msg>> {
  return unsafeCoerce(cmd)
}

export const none: Cmd<never, never> = cmd([])

export function batch<R, Msg>(cmds: ReadonlyArray<Cmd<R, Msg>>): Cmd<R, Msg> {
  return cmd(RA.flatten(RA.map(cmds, unCmd)))
}

export const map = dual<
  <A, B>(f: (a: A) => B) => <R>(self: Cmd<R, A>) => Cmd<R, B>,
  <R, A, B>(self: Cmd<R, A>, f: (a: A) => B) => Cmd<R, B>
>(2, (self, fn) => {
  return cmd(RA.map(unCmd(self), Eff.map(fn)))
})
