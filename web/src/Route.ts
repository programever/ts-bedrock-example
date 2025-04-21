import * as JD from "decoders"
import * as Teki from "teki"
import { UrlRecord } from "../../core/Data/UrlToken"
import { Maybe, maybeDecoder } from "../../core/Data/Maybe"
import type { Action } from "./Action"
import type { State } from "./State"

/**
 * Use `toRoute` to create a Route
 * Use `toPath` to convert a Route into a path eg. `/login?redirect=null`
 * Use `parseRoute` to convert a full url into a Route
 * Use `navigateTo` to navigate to a Route
 * Use `src/Action/Route#onUrlChange` to add effects on url change
 *
 * WARN Defining a Route:
 * - *Ensure* your route params can be serialized into JSON string
 *   otherwise we can't use it in the url
 * - URL params are always a string in the url
 *   so start decoding with a string first then transform
 * - We have a special hack for Maybe type
 *   where we handle string 'null' properly (Ref `#parseRoute`)
 *   This is to allow a better developer experience to only define
 *   decoders based on the params
 * - URL Params syntax reference:
 *   https://github.com/philipnilsson/teki
 */
export type Route =
  | { _t: "Home"; path: "/"; params: NoParams }
  | { _t: "NotFound"; path: "/not-found"; params: NoParams }
  | {
      _t: "Login"
      path: "/login?redirect=:redirect"
      params: {
        redirect: Maybe<string>
      }
    }
  | {
      _t: "Profile"
      path: "/profile"
      params: NoParams
    }

/**
 * Define your route decoder and path in this RouteTable
 *
 * router *MUST* be kept as private
 * so as to keep the logic of parsing url into routes/paths
 * in this file only
 * */
const router: RouteTable = {
  Home: {
    path: "/",
    decoder: JD.object({
      _t: JD.always("Home"),
      path: JD.always("/"),
      params: JD.object({}),
    }),
  },
  NotFound: {
    path: "/not-found",
    decoder: JD.object({
      _t: JD.always("NotFound"),
      path: JD.always("/not-found"),
      params: JD.object({}),
    }),
  },
  Login: {
    path: "/login?redirect=:redirect",
    decoder: JD.object({
      _t: JD.always("Login"),
      path: JD.always("/login?redirect=:redirect"),
      params: JD.object({
        redirect: maybeDecoder(JD.string),
      }),
    }),
  },
  Profile: {
    path: "/profile",
    decoder: JD.object({
      _t: JD.always("Profile"),
      path: JD.always("/profile"),
      params: JD.object({}),
    }),
  },
}

/**
 * Navigate to a Route
 * WARN This should be the only function used for navigation
 * If you try to use window.history.pushState directly,
 * onUrlChange will not be triggered
 */
export function navigateTo(route: Route): Action {
  return (state: State) => {
    return [
      state,
      [
        Promise.resolve().then(() => {
          // NOTE window.dispatchEvent is synchronous
          // Hence, this is wrapped in a promise
          // NOTE history.pushState does not trigger popstate event
          // so we are triggering it manually (See Subscription.ts)
          window.history.pushState(null, "", toPath(route))
          window.dispatchEvent(new PopStateEvent("popstate"))
          return null
        }),
      ],
    ]
  }
}

/**
 * history.back() will trigger onUrlChange
 */
export function goBack(): Action {
  return (state: State) => {
    return [state, [Promise.resolve(history.back()).then(() => null)]]
  }
}

/**
 * Creates a Route
 *
 * Example:
 * toRoute("Login", { redirect: null })
 * => {
 *   _t: "Login",
 *   path: "/login?redirect=null",
 *   params: { redirect: null }
 * }
 */
export function toRoute<K extends keyof RouteTable>(
  routeT: K,
  params: Extract<Route, { _t: K }>["params"],
): Route {
  const routeDef = router[routeT]
  // We can guarantee this won't throw
  // based on our type definitions
  return routeDef.decoder.verify({
    _t: routeT,
    path: routeDef.path,
    params: _serializeParams(params),
  })
}

/**
 * Converts a Route into a path
 */
export function toPath(route: Route): string {
  const routeDef = router[route._t]
  const { path } = routeDef
  const { params } = route
  // We need to convert all the param values into string
  // before we can put them into the path
  const urlParams = _serializeParams(params)
  return Teki.reverse(path)(urlParams)
}

/**
 * WARN fullUrl must be a valid full url eg. `https://example.com/login?redirect=/home`
 */
export function parseRoute(fullUrl: string): Route {
  for (const [routeT, routeDef] of Object.entries(router)) {
    const { path, decoder } = routeDef
    const parseResult = Teki.parse(path)(fullUrl)
    if (parseResult == null) {
      continue
    }

    const routeParams = _changeNullStringToNull(parseResult)
    const route = decoder.value({
      _t: routeT,
      path,
      params: routeParams,
    })

    if (route != null) {
      return route
    }
  }

  return toRoute("NotFound", {})
}

// *** Internal ***

// Teki does not expose RouteParams
// so we are coaxing it out here
type RouteParams = NonNullable<ReturnType<ReturnType<typeof Teki.parse>>>
type NoParams = Record<string, never>

// Kept as private so that developers cannot use the path directly
type RouteTable = {
  [K in Route["_t"]]: RouteDef<Extract<Route, { _t: K }>>
}

type RouteDef<R extends Route> = {
  path: R["path"]
  decoder: JD.Decoder<
    // We want a Route decoder
    // but we also want params to be type-check against path
    // This is still essentially just a Route decoder
    R & {
      _t: R["_t"]
      path: R["path"]
      params: UrlRecord<R["path"]>
    }
  >
}

/**
 * A hack to convert string 'null' to null
 * so that developers can simply write decoders for the actual route params
 * instead of writing decoders to decode from url string params
 */
function _changeNullStringToNull(urlParams: RouteParams): RouteParams {
  return Object.fromEntries(
    Object.entries(urlParams).map(([key, value]) => {
      return [key, value === "null" ? null : value]
    }),
  )
}

function _serializeParams(params: Route["params"]): RouteParams {
  return JSON.parse(JSON.stringify(params))
}

// Simple test: `ts-node src/Route.ts`
// console.log(
//   parseRoute(
//     "http://localhost" +
//       toPath(toRoute("Login", { redirect: toPath(toRoute("Home", {})) })),
//   ),
// )

// export function onUrlChange(state: State): [State, Cmd]
// export async function navigateTo(route: Route): Promise<void>
