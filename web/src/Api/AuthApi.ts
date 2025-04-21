import * as JD from "decoders"
import * as Teki from "teki"
import * as Logger from "../Logger"
import { HttpStatus, Method } from "../../../core/Data/Api"
import { AuthApi, AuthResponseJson } from "../../../core/Data/Api/Auth"
import { toStringRecord, UrlRecord } from "../../../core/Data/UrlToken"
import { fetchE, FetchResult } from "../Data/Fetch"
import { left, right } from "../../../core/Data/Either"
import { Maybe } from "../../../core/Data/Maybe"
import { requestNewAccessToken } from "../Api/Public/RefreshToken"
import {
  ApiResponse,
  decodeFetchResult,
  isNoBodyMethod,
  jsonHeaders,
  makePath,
} from "../Api"
import { sleep } from "../../../core/Data/Timer"

// Convenience
export type { ApiResponse, ApiError } from "../Api"
export { apiErrorString } from "../Api"

export async function authApi<
  M extends Method,
  Route extends string,
  UrlParams extends UrlRecord<Route>,
  RequestBody,
  ErrorCode,
  Payload,
>(
  contract: AuthApi<M, Route, UrlParams, RequestBody, ErrorCode, Payload>,
  urlData: UrlParams,
  bodyData: RequestBody,
): Promise<ApiResponse<ErrorCode, Payload>> {
  const { method, route, responseDecoder } = contract
  const path = Teki.reverse(route)(toStringRecord(urlData))
  const authHeader = await authHeaders(new Headers())
  if (authHeader == null) {
    return left("UNAUTHORISED")
  }

  return fetchE(makePath(path), {
    method,
    headers: jsonHeaders(authHeader),
    body: isNoBodyMethod(method) ? undefined : JSON.stringify(bodyData),
  }).then(handleAuthRequest(responseDecoder))
}

function handleAuthRequest<E, D>(
  responseDecoder: (status: HttpStatus) => JD.Decoder<AuthResponseJson<E, D>>,
) {
  return function (result: FetchResult): ApiResponse<E, D> {
    const payloadM = decodeFetchResult(responseDecoder, result)
    if (payloadM._t === "Left") {
      return left(payloadM.error)
    }

    switch (payloadM.value._t) {
      case "AuthOk":
        return right(payloadM.value.data)
      case "AuthErr":
        return left(payloadM.value.code)
      case "AuthServerError":
        Logger.error(payloadM.value.errorID)
        return left("SERVER_ERROR")
    }
  }
}

/** WARN We will recurse infinitely
 * if there is no network or if the server is down
 */
async function authHeaders(headers: Headers): Promise<Maybe<Headers>> {
  const authTokenM = await requestNewAccessToken()
  if (authTokenM._t === "Left") {
    switch (authTokenM.error) {
      case "INVALID":
      case "MISSING_AUTH_TOKEN":
        return null
      case "NETWORK_ERROR":
      case "SERVER_ERROR":
        return sleep(1000).then(() => authHeaders(headers))
    }
  }

  const { accessToken } = authTokenM.value
  headers.append("Authorization", `Bearer ${accessToken.toJSON()}`)
  return headers
}
