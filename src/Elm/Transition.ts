import * as Cmd from "./Cmd"

export interface Transition<R, Model, Msg> {
  nextState: Model
  cmd: Cmd.Cmd<R, Msg>
}

export function Transition<R, Model, Msg>(
  it: Transition<R, Model, Msg>
): Transition<R, Model, Msg> {
  return it
}
