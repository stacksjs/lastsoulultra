# "Mit deinem LSU-Konto anmelden"

The coaching design opens the app with one button: sign in with the LSU account a runner already has from race entry. This note says what exists, what is still missing, and how the button is switched on.

## Where the two accounts are

| Account | Lives at | Signs in with |
|---|---|---|
| LSU race account | `https://api.lastsoulultra.com/v1`, a service outside this repository | Email and password; a 6-digit email code verifies the address at sign-up and resets a password |
| LSU training account | `https://training.lsu.stacksjs.com`, the HQ installation this repository deploys | Passkey, or email and password |

They are separate databases with no shared secret. Nothing in this repository can vouch for a race account: the race site here only passes the runner's own bearer token to the race service from their browser (`resources/functions/race-api.ts`).

## What is built

HQ platform kit 1.0.4294 and later can be the OAuth client of an organization's own account service (HQ `app/Support/productAccount.ts`). When it is, the app and the training website draw **Mit deinem LSU-Konto anmelden** first, in LSU's red, above the form. The runner types their password on the race service's own page; the training host never sees it. The training account is keyed by the race account's id, so a changed email still finds the same runner.

On LSU's side everything but the client is in place:

- `enterprise/presets.json` `sign_in.account.name` is `LSU`, the name on the button.
- `config/training-cloud.ts` hands the training host `LSU_ACCOUNT_ISSUER`, `LSU_ACCOUNT_CLIENT_ID` and `LSU_ACCOUNT_CLIENT_SECRET`. All three are unset, so the button is not offered and sign-in is exactly as before.

## What is missing: the race service has to offer three endpoints

The service at `api.lastsoulultra.com` signs runners in but cannot yet sign them in *for another application*. It needs a standard OAuth 2 authorization-code flow:

| Endpoint | Contract |
|---|---|
| `GET <issuer>/authorize` | The service's own sign-in page. Accepts `response_type=code`, `client_id`, `state`, `code_challenge` with `code_challenge_method=S256`, and `redirect_uri`, which must equal `https://training.lsu.stacksjs.com/api/auth/social/account/callback` exactly. Sends the browser back there with `code` and `state`. |
| `POST <issuer>/token` | `grant_type=authorization_code`, `code`, `redirect_uri`, `code_verifier`. The client authenticates with HTTP Basic. A code works once. Answers `{ "access_token": "...", "token_type": "Bearer" }`. |
| `GET <issuer>/userinfo` | With that bearer token: `{ "sub": "<race account id>", "email": "...", "email_verified": true, "name": "..." }`. |

Two details decide whether a runner gets in:

- `email_verified` must be the JSON boolean `true`. The training host makes an account from an address, or joins an existing training account by it, only when the race service says it verified that address. The race service already verifies addresses by code at sign-up, so this is a field to expose, not new work.
- `sub` must never change for an account.

The endpoints can have other paths: set `PRODUCT_ACCOUNT_AUTHORIZE_URL`, `_TOKEN_URL` and `_USERINFO_URL` on the training host beside the issuer.

## Switching it on

1. The race service's operator registers one confidential client with the redirect above and hands over its issuer URL, client id and secret.
2. `./buddy env:set LSU_ACCOUNT_ISSUER <url>`, and the same for `LSU_ACCOUNT_CLIENT_ID` and `LSU_ACCOUNT_CLIENT_SECRET`, in the encrypted production environment.
3. Update `enterprise/legal/privacy.stx`: it says today that the race account and the training account are separate. With the button on, the training account receives the race account's id, name and email at sign-in, and nothing else.
4. Deploy. The button appears on the next start; no app build is needed, because the app asks the server which sign-ins it offers.

## If the race service cannot change

The LSU website in this repository could act as the bridge instead: its own sign-in page lets the runner sign in to the race service in their browser, as the profile page does today, then proves that session to the site's server, which issues the code. That keeps the password off every new server, but it needs the site to be public (it sits behind a preview password today) and it cannot say whether an address is verified unless the race service's `/me` does. It is not built: the choice between the two is LSU's and the race service operator's.
