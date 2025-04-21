import { handler as refreshHandler } from "../../../src/Api/Public/RefreshToken"
import { handler as loginHandler } from "../../../src/Api/Public/Login"
import { createEmail } from "../../../../core/Data/User/Email"
import {
  _createUser,
  _defaultPassword,
  _notNull,
  _fromLeft,
  _fromRight,
  _hashPassword,
} from "../../Fixture"
import { refreshTokenDecoder } from "../../../../core/Data/Security/RefreshToken"
import * as RefreshTokenRow from "../../../src/Database/RefreshTokenRow"

describe("Api/Public/RefreshToken", () => {
  test("refreshes the tokens as 1 row per session", async () => {
    const email = _notNull(createEmail("user@example.com"))
    const user = await _createUser(email.unwrap())

    const refreshTokenCount = await RefreshTokenRow.removeAllByUser(user.id)
    expect(refreshTokenCount).toBe(0)

    const { refreshToken } = await loginHandler({
      email,
      password: _defaultPassword,
    }).then(_fromRight)

    const result = await refreshHandler({ userID: user.id, refreshToken }).then(
      _fromRight,
    )
    expect(result.refreshToken.unwrap().length > 0).toBe(true)
    expect(result.refreshToken.unwrap() != refreshToken.unwrap()).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.accessToken).toBeDefined()

    const refreshTokenCount2 = await RefreshTokenRow.removeAllByUser(user.id)
    expect(refreshTokenCount2).toBe(1)
  })

  test("only last refresh token can be used again", async () => {
    const email = _notNull(createEmail("user@example.com"))
    const user = await _createUser(email.unwrap())

    const { refreshToken: firstToken } = await loginHandler({
      email,
      password: _defaultPassword,
    }).then(_fromRight)

    // Using firstToken to get once
    const { refreshToken: secondToken } = await refreshHandler({
      userID: user.id,
      refreshToken: firstToken,
    }).then(_fromRight)
    // Using firstToken to get twice
    const { refreshToken: secondToken_ } = await refreshHandler({
      userID: user.id,
      refreshToken: firstToken,
    }).then(_fromRight)
    expect(secondToken_.unwrap() != firstToken.unwrap()).toBe(true)
    expect(secondToken_.unwrap() === secondToken.unwrap()).toBe(true)

    // Using secondToken now
    await refreshHandler({
      userID: user.id,
      refreshToken: secondToken,
    }).then(_fromRight)
    // Try to use firstToken again
    const result = await refreshHandler({
      userID: user.id,
      refreshToken: firstToken,
    }).then(_fromLeft)
    expect(result).toBe("INVALID")
  })

  test("cannot refresh with different UserID", async () => {
    const email = _notNull(createEmail("david@gmail.com"))
    const email2 = _notNull(createEmail("sarah@gmail.com"))
    const [david, sarah] = await Promise.all([
      _createUser(email.unwrap()),
      _createUser(email2.unwrap()),
    ])

    const [davidLogin] = await Promise.all([
      loginHandler({ email: david.email, password: _defaultPassword }).then(
        _fromRight,
      ),
      loginHandler({ email: sarah.email, password: _defaultPassword }).then(
        _fromRight,
      ),
    ])

    const result = await refreshHandler({
      userID: sarah.id,
      refreshToken: davidLogin.refreshToken,
    }).then(_fromLeft)
    expect(result).toBe("INVALID")
  })

  test("cannot refresh with random refreshToken", async () => {
    const email = _notNull(createEmail("user@gmail.com"))
    const user = await _createUser(email.unwrap())

    const result = await refreshHandler({
      userID: user.id,
      refreshToken: refreshTokenDecoder.verify("random-refresh-token-uuid"),
    }).then(_fromLeft)
    expect(result).toBe("INVALID")
  })

  test("cannot refresh with expired refreshToken", async () => {
    const email = _notNull(createEmail("user@gmail.com"))
    const user = await _createUser(email.unwrap())
    const refreshToken = await RefreshTokenRow._createExpired(user.id)

    const result = await refreshHandler({
      userID: user.id,
      refreshToken: refreshToken,
    }).then(_fromLeft)
    expect(result).toBe("INVALID")
  })
})
