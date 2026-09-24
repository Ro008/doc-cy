import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGISTER_NAME_HTML_PATTERN, isValidRegisterName } from "../../lib/register-name";
import { suggestRegisterEmail } from "../../lib/register-email";
import { isStrongPassword, passwordRuleChecks } from "../../lib/password-policy";
import {
  isValidRegisterCustomSpecialty,
  isValidRegisterLicenseNumber,
} from "../../lib/register-specialty-rules";

function htmlPattern(pattern: string): RegExp {
  // How Chrome 112+ applies a `pattern` attribute.
  return new RegExp(`^(?:${pattern})$`, "v");
}

describe("register names", () => {
  it("accepts real names, accents, hyphens and apostrophes", () => {
    for (const name of ["Maria", "Anne-Marie", "O'Brien", "José", "Γιώργος", "Van der Berg"]) {
      assert.equal(isValidRegisterName(name), true, name);
      assert.equal(htmlPattern(REGISTER_NAME_HTML_PATTERN).test(name), true, name);
    }
  });

  it("rejects blanks, digits and names without letters", () => {
    for (const name of ["", "   ", "123", "Maria2", "---", "."]) {
      assert.equal(isValidRegisterName(name), false, JSON.stringify(name));
      assert.equal(htmlPattern(REGISTER_NAME_HTML_PATTERN).test(name), false, JSON.stringify(name));
    }
  });
});

describe("register email typo suggestion", () => {
  it("suggests the common provider for a near miss", () => {
    assert.equal(suggestRegisterEmail("maria@gmial.com"), "maria@gmail.com");
    assert.equal(suggestRegisterEmail("maria@gmail.con"), "maria@gmail.com");
    assert.equal(suggestRegisterEmail("maria@hotmial.com"), "maria@hotmail.com");
    assert.equal(suggestRegisterEmail("maria@outlok.com"), "maria@outlook.com");
    assert.equal(suggestRegisterEmail("Maria@Yahooo.com"), "Maria@yahoo.com");
    assert.equal(suggestRegisterEmail("maria@cytanet.com"), "maria@cytanet.com.cy");
  });

  it("stays quiet for correct or unknown domains", () => {
    assert.equal(suggestRegisterEmail("maria@gmail.com"), null);
    assert.equal(suggestRegisterEmail("maria@practice.com"), null);
    assert.equal(suggestRegisterEmail("maria@clinic-georgiou.com.cy"), null);
    assert.equal(suggestRegisterEmail("not-an-email"), null);
    assert.equal(suggestRegisterEmail(""), null);
  });
});

describe("password rule checklist", () => {
  it("reports each rule separately", () => {
    const checks = passwordRuleChecks("abc");
    assert.deepEqual(
      checks.map((check) => [check.key, check.met]),
      [
        ["length", false],
        ["upper", false],
        ["lower", true],
        ["number", false],
        ["symbol", false],
      ],
    );
  });

  it("agrees with isStrongPassword", () => {
    for (const value of ["", "password", "Password1", "Password1!", "Aa1!aaaa", "A".repeat(201)]) {
      const allMet = passwordRuleChecks(value).every((check) => check.met);
      assert.equal(allMet, isStrongPassword(value), value);
    }
  });
});

describe("register licence number", () => {
  it("needs at least 3 characters and a digit", () => {
    assert.equal(isValidRegisterLicenseNumber("1234"), true);
    assert.equal(isValidRegisterLicenseNumber("CY-12"), true);
    assert.equal(isValidRegisterLicenseNumber(" 123 "), true);
  });

  it("rejects short, digit-less or blank numbers", () => {
    assert.equal(isValidRegisterLicenseNumber("12"), false);
    assert.equal(isValidRegisterLicenseNumber(" 1 2 "), false);
    assert.equal(isValidRegisterLicenseNumber("abc"), false);
    assert.equal(isValidRegisterLicenseNumber("   "), false);
  });
});

describe("register custom specialty", () => {
  it("needs at least 3 letters", () => {
    assert.equal(isValidRegisterCustomSpecialty("Sports medicine"), true);
    assert.equal(isValidRegisterCustomSpecialty("Ψυχ"), true);
    assert.equal(isValidRegisterCustomSpecialty("ab"), false);
    assert.equal(isValidRegisterCustomSpecialty("a 1 2 3"), false);
    assert.equal(isValidRegisterCustomSpecialty("   "), false);
  });
});
