import { handler } from "../../../src/Api/Auth/UpdateProfile"
import { handler as loginHandler } from "../../../src/Api/Public/Login"
import { emailDecoder } from "../../../../core/Data/User/Email"
import { passwordDecoder } from "../../../../core/App/User/Password"
import {
  _createUser,
  _notNull,
  _fromLeft,
  _fromRight,
  _hashPassword,
} from "../../Fixture"
import { nameDecoder } from "../../../../core/App/User/Name"

describe("Api/Auth/UpdateProfile", () => {
  test("update profile success", async () => {
    const currentPassword = passwordDecoder.verify("Valid4Good.Password")
    const hashedPassword = await _hashPassword(currentPassword.unwrap())
    const user = await _createUser("user@example.com", {
      password: hashedPassword.unwrap(),
    })

    const name = nameDecoder.verify("New")
    const email = emailDecoder.verify("new@example.com")
    const newPassword = passwordDecoder.verify("NewPassword123#")

    const { user: updatedUser } = await handler(user, {
      name,
      email,
      currentPassword,
      newPassword,
    }).then(_fromRight)
    expect(updatedUser.id.unwrap()).toEqual(user.id.unwrap())
    expect(updatedUser.email.unwrap()).toEqual(email.unwrap())
    expect(updatedUser.name.unwrap()).toEqual(name.unwrap())

    const { user: loginUser } = await loginHandler({
      email,
      password: newPassword,
    }).then(_fromRight)
    expect(loginUser.id.unwrap()).toEqual(user.id.unwrap())
  })

  test("update profile error", async () => {
    const currentPassword = passwordDecoder.verify("Valid4Good.Password")
    const hashedPassword = await _hashPassword(currentPassword.unwrap())
    const user = await _createUser("user@example.com", {
      password: hashedPassword.unwrap(),
    })

    const name = nameDecoder.verify("New")
    const email = emailDecoder.verify("new@example.com")
    const newPassword = passwordDecoder.verify("NewPassword123#")

    const invalidPassword = await handler(user, {
      name,
      email,
      currentPassword: newPassword,
      newPassword,
    }).then(_fromLeft)
    expect(invalidPassword).toEqual("INVALID_PASSWORD")

    await _createUser("new@example.com", {
      password: hashedPassword.unwrap(),
    })
    const emailExisted = await handler(user, {
      name,
      email,
      currentPassword,
      newPassword,
    }).then(_fromLeft)
    expect(emailExisted).toEqual("EMAIL_ALREADY_EXISTS")
  })
})
