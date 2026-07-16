import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateBeforeMutation,
  requireLoginPassword,
} from "../scripts/finalize-icare-staging.js";

test("finalizer login accepts any non-empty existing password", async () => {
  let receivedPassword = null;
  let mutationToken = null;

  await authenticateBeforeMutation({
    passwordValue: "x",
    authenticate: async (password) => {
      receivedPassword = password;
      return "process-only-token";
    },
    mutate: async (token) => {
      mutationToken = token;
    },
  });

  assert.equal(receivedPassword, "x");
  assert.equal(mutationToken, "process-only-token");
});

test("finalizer login rejects an empty password before authentication", async () => {
  let authenticationAttempted = false;

  assert.throws(
    () => requireLoginPassword(""),
    /ICARE_STAGING_PASSWORD is required/,
  );

  await assert.rejects(
    authenticateBeforeMutation({
      passwordValue: "",
      authenticate: async () => {
        authenticationAttempted = true;
        return "unused-token";
      },
      mutate: async () => {},
    }),
    /ICARE_STAGING_PASSWORD is required/,
  );

  assert.equal(authenticationAttempted, false);
});

test("invalid credentials stop before any finalization mutation", async () => {
  let mutationAttempted = false;

  await assert.rejects(
    authenticateBeforeMutation({
      passwordValue: "existing-password",
      authenticate: async () => {
        throw new Error("Staging iCare login failed (HTTP 401).");
      },
      mutate: async () => {
        mutationAttempted = true;
      },
    }),
    /HTTP 401/,
  );

  assert.equal(mutationAttempted, false);
});
