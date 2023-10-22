import { Schema } from "@effect/schema"
import { mkPort } from "./Elm/Port"

export const { TimeUpdatedPort, TimeUpdatedPortLayer, timeUpdated } = mkPort(
  "timeUpdated",
  Schema.DateFromSelf
)

export const { AlertPort, AlertPortLayer, alert } = mkPort(
  "alert",
  Schema.string
)
