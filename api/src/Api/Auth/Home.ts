import * as API from "../../../../core/Api/Auth/Home"
import { NoBodyParams } from "../../../../core/Data/Api"
import { Either, right } from "../../../../core/Data/Either"
import { AuthUser } from "../AuthApi"

export const contract = API.contract

export async function handler(
  user: AuthUser,
  _params: NoBodyParams,
): Promise<Either<null, API.Payload>> {
  return right({ user })
}
