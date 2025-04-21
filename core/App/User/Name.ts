import * as JD from "decoders"
import { Opaque, jsonValueCreate } from "../../Data/Opaque"
import { Either, left, right, fromRight } from "../../Data/Either"
import { Maybe, throwIfNull } from "../../Data/Maybe"
import { createText100 } from "../../Data/Text"

const key: unique symbol = Symbol()
export type Name = Opaque<string, typeof key>
export type ErrorName = "INVALID_NAME"

export function createName(s: string): Maybe<Name> {
  return fromRight(createNameE(s))
}

export function createNameE(s: string): Either<ErrorName, Name> {
  const text100 = createText100(s)
  if (text100 == null) return left("INVALID_NAME")

  return right(jsonValueCreate<string, typeof key>(key)(text100.unwrap()))
}

export const nameDecoder: JD.Decoder<Name> = JD.string.transform((s) => {
  return throwIfNull(createName(s), `Invalid name: ${s}`)
})
