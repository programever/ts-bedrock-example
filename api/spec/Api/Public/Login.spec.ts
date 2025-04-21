import { handler } from "../../../src/Api/Public/Login"
import * as AccessToken from "../../../src/App/AccessToken"
import * as RefreshTokenRow from "../../../src/Database/RefreshTokenRow"
import { emailDecoder } from "../../../../core/Data/User/Email"
import { passwordDecoder } from "../../../../core/App/User/Password"
import { toString } from "../../../../core/Data/Security/JsonWebToken"
import {
  _createUser,
  _notNull,
  _fromLeft,
  _fromRight,
  _hashPassword,
} from "../../Fixture"

describe("Api/Public/Login", () => {
  test("login success", async () => {
    const email = emailDecoder.verify("user@example.com")
    const password = passwordDecoder.verify("Valid4Good.Password")
    const hashedPassword = await _hashPassword(password.unwrap())
    await _createUser(email.unwrap(), { password: hashedPassword.unwrap() })

    const { accessToken, refreshToken, user } = await handler({
      email,
      password,
    }).then(_fromRight)
    expect(user.id.unwrap()).toEqual(user.id.unwrap())
    expect(user.email.unwrap()).toEqual(email.unwrap())
    expect(accessToken).toBeDefined()
    expect(refreshToken).toBeDefined()

    const jwtPayload = await AccessToken.verify(toString(accessToken))
      .then(_fromRight)
      .then((t) => t.unwrap())
    expect(jwtPayload.userID.unwrap()).toEqual(user.id.unwrap())

    // Ensure login creates a refreshToken in database
    const refreshTokenCount = await RefreshTokenRow.removeAllByUser(user.id)
    expect(refreshTokenCount).toBe(1)
  })

  test("login error", async () => {
    const email = emailDecoder.verify("user@example.com")
    const rightPassword = passwordDecoder.verify("Valid4Good.Password")
    const wrongPassword = passwordDecoder.verify("Wrong&Password2")

    const userNotFound = await handler({ email, password: rightPassword }).then(
      _fromLeft,
    )
    expect(userNotFound).toEqual("USER_NOT_FOUND")

    const hashedPassword = await _hashPassword(rightPassword.unwrap())
    await _createUser(email.unwrap(), { password: hashedPassword.unwrap() })
    const invalidPassword = await handler({
      email,
      password: wrongPassword,
    }).then(_fromLeft)
    expect(invalidPassword).toEqual("INVALID_PASSWORD")
  })
})
