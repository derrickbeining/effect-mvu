import { dual } from "effect/Function"

export interface Send<Msg> {
  (msg: Msg): void
}

export interface Lift<Msg, VDom> {
  <SubMsg>(
    send: Send<Msg>,
    lift: (subMsg: SubMsg) => Msg,
    html: View<SubMsg, VDom>
  ): VDom
}

export const lift = dual<
  <Msg, SubMsg, VDom>(
    send: Send<Msg>,
    lift: (subMsg: SubMsg) => Msg
  ) => (html: View<SubMsg, VDom>) => VDom,
  <Msg, SubMsg, VDom>(
    send: Send<Msg>,
    lift: (subMsg: SubMsg) => Msg,
    html: View<SubMsg, VDom>
  ) => VDom
>(3, (send, lift, html) => {
  return html((subMsg) => send(lift(subMsg)))
})

export interface View<Msg, VDom> {
  (send: Send<Msg>): VDom
}

export interface Render<Msg, Args extends unknown[], VDom> {
  (send: (msg: Msg) => void, ...args: Args): VDom
}

export function mkView<Msg, Args extends unknown[], VDom>(
  render: Render<Msg, Args, VDom>
): (...args: Args) => View<Msg, VDom> {
  return (...args) =>
    (send) => {
      return render(send, ...args)
    }
}

export const map = dual<
  <A, B>(f: (a: A) => B) => <VDom>(self: View<A, VDom>) => View<B, VDom>,
  <VDom, A, B>(self: View<A, VDom>, f: (a: A) => B) => View<B, VDom>
>(2, (self, f) => (sendMsg) => self((a) => sendMsg(f(a))))
