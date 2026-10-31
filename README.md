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

The storefront also includes `/wishlist.html`, `/account.html`, `/size-guide.html`,
`/help.html`, a custom 404 page and a form thank-you page. The cart continues to
send order requests through WhatsApp; no online payment is collected.

Contact and collection-update requests are stored through Netlify Forms. These
capture submissions; they do not send newsletter campaigns. Review submissions
are stored in Netlify Database and stay private until approved. A signed-in user
with the `admin` role in Identity's **app metadata** can publish or reject pending
reviews on `/account.html`. Assign that role through trusted Identity
administration, never user-editable profile metadata. No administrator is created
or promoted by this code. Review requests have a per-IP/domain rate limit and a
honeypot; public submissions cannot approve themselves.

Carts and wishlists use separate essential browser cookies and Netlify Database.
They are independent of account sign-in and do not synchronize across devices.
The wishlist imports valid selections from the earlier browser-only store when
available. The new migration adds wishlist and review tables; the existing cart
migration is unchanged. Netlify applies migrations during deployment.

The help and policy pages describe the current site behavior. The shop still
needs to supply its legal business details, retention periods and confirmed
alteration, cancellation, return and refund terms; the site does not invent these.

Run `npm test` for regression checks covering authentication forms, form
submission feedback, review authorization and validation, and wishlist persistence
and failed-save handling with mocked services. Run `npm run typecheck` for server
and database TypeScript checks. These checks do not send real emails or form
submissions, apply migrations, or test external service delivery.
