# Amadee-Frontend

The storefront includes dedicated account pages at `/signin.html`, `/signup.html`,
`/forgot-password.html`, and `/reset-password.html`. These use Netlify Identity
for account creation, email confirmation, sessions, and password recovery.
The browser loads the pinned `@netlify/identity` 2.0.0 distribution from esm.sh;
this keeps the static site working without a bundler. The same version is recorded
in the npm lockfile.

Use `netlify dev --port 8889` for local authentication development. Plain static
hosting does not emulate Identity. Email confirmation and recovery callbacks are
handled on both the storefront and the account pages. New accounts require email
confirmation with the default Identity settings.
