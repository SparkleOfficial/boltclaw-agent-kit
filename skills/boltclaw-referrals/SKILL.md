---
name: boltclaw-referrals
description: "Install Bolt Claw referral tracking in a product's own code: capture referral codes, report signups and sales from the server, and test it end to end. Use when the person runs a Bolt Claw referral program and asks you to connect their product."
license: MIT
metadata:
  source: "https://boltclaw.ai/docs/referrals/install.md"
  api-version: "1.22.0"
---

# Install Bolt Claw referrals (for coding agents)

Version 1.22.0. You are working in a merchant's own code. They run a referral program on
Bolt Claw and asked you to connect their product to it. The prompt that sent you here gave you the
program's id and the stack they use. It did not give you an API key, and you must not ask for one
in the conversation.

## The rules

1. **Never print, log, commit or ask for the API key.** The person creates it themselves under
   Settings, Developers in the dashboard, with the **Referral tracking** preset (the single scope
   `conversions:write`), and puts it in the server environment as `BOLTCLAW_API_KEY`. You write code
   that reads `process.env.BOLTCLAW_API_KEY` (or the stack's equivalent) and add the name, never
   the value, to `.env.example`.
2. **Server only.** The key never goes into a browser bundle, a mobile app, a page or a client
   component. Report conversions from server code.
3. **Do not connect the billing system yourself.** Connecting Stripe, Paddle, Shopify or any of
   the twelve needs a credential pasted or shown once, in the dashboard (Setup, Billing). Tell the
   person which card to open; do not ask them to paste a secret into the conversation.
4. **Use the merchant's own user id** as `customer.id`, never an email address, and the same id
   for the signup and the sales.
5. **`event_id` is the idempotency key.** Make it stable per real event (`signup-<user id>`, the
   payment's id), so a retry changes nothing.
6. **Test with test data.** Send your checks with `"test": true`. Never invent a real sale.

## 1. Find the stack

| If the repository has | Follow |
|---|---|
| `next` in package.json, an `app/` directory | Next.js: https://boltclaw.ai/docs/referral-quickstart-nextjs.md |
| `express` in package.json | Express: https://boltclaw.ai/docs/referral-quickstart-express.md |
| `supabase-js` and calls to `supabase.auth.signUp` | Supabase Auth: https://boltclaw.ai/docs/referral-quickstart-supabase.md |
| `firebase` or `firebase-admin`, `createUserWithEmailAndPassword` | Firebase Authentication: https://boltclaw.ai/docs/referral-quickstart-firebase.md |
| a Clerk package and `<ClerkProvider>` | Clerk: https://boltclaw.ai/docs/referral-quickstart-clerk.md |
| `next-auth`, or an Auth.js adapter package | Auth.js: https://boltclaw.ai/docs/referral-quickstart-authjs.md |
| `better-auth` in package.json | Better Auth: https://boltclaw.ai/docs/referral-quickstart-better-auth.md |
| `manage.py`, `settings.py` | Django: https://boltclaw.ai/docs/referral-quickstart-django.md |
| `Gemfile` with `rails` | Rails: https://boltclaw.ai/docs/referral-quickstart-rails.md |
| `artisan`, `composer.json` with `laravel/framework` | Laravel: https://boltclaw.ai/docs/referral-quickstart-laravel.md |
| no code repository: Webflow, Framer, Bubble | a no-code site: https://boltclaw.ai/docs/referral-quickstart-nocode.md |

Read that quickstart; it has the exact code for each step below.

## 2. Add the tag to every page

In the root layout or base template:

```html
<script src="https://boltclaw.ai/referrals/v2.js" defer data-payment-links="auto"></script>
```

It keeps a partner's code from `?via=<code>` in a first-party cookie, `bc_ref`, on the merchant's
own domain, and gives the browser `BoltClawReferral.code()`. Add `data-welcome="auto"` only if the
merchant asked for the friend's welcome. If the site has its own server, also set `bc_ref` from
the server (not HttpOnly) when a request carries `?via=`: Safari deletes a cookie a script created
after 7 days of browsing without a visit, and does not cap one the site's own server sets.

## 3. Report each signup as a lead

Where the product creates an account, on the server:

```bash
curl -X POST https://api.boltclaw.ai/v1/referrals/conversions \
  -H "Authorization: Bearer $BOLTCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"program_id":"<program id>","event":"lead","event_id":"signup-<user id>","customer":{"id":"<user id>"},"referral":{"code":"<bc_ref cookie>"}}'
```

Leave `referral` out when there is no `bc_ref` cookie. If the product only takes sign-ups at
checkout, skip this step.

## 4. Carry the referral to checkout

Pass the code (and the user's id as `boltclaw_customer_id`) in the field the billing system keeps:

| Billing system | Where the code goes | Guide |
|---|---|---|
| Stripe | Put the code in the Checkout Session's client_reference_id or metadata.boltclaw_ref, and for a subscription in subscription_data.metadata.boltclaw_ref too. | https://boltclaw.ai/docs/referral-billing-stripe.md |
| Paddle Billing | Pass customData with boltclaw_ref to Paddle.Checkout.open (or data-custom-data): Paddle copies it to the subscription and every renewal. | https://boltclaw.ai/docs/referral-billing-paddle.md |
| Polar | Set metadata.boltclaw_ref on the checkout link or session: link metadata reaches the order and the subscription. | https://boltclaw.ai/docs/referral-billing-polar.md |
| Whop | Set metadata.boltclaw_ref when you create the checkout configuration. | https://boltclaw.ai/docs/referral-billing-whop.md |
| RevenueCat | Set the subscriber attribute boltclaw_ref with Purchases.setAttributes before the purchase. | https://boltclaw.ai/docs/referral-billing-revenuecat.md |
| WooCommerce | Save boltclaw_ref in the order's meta from the hidden checkout field the tag adds (BoltClawReferral.attach), or let a partner's coupon carry the referral. | https://boltclaw.ai/docs/referral-billing-woocommerce.md |
| FastSpring | Add tags with boltclaw_ref to the session (fastspring.builder.tag or the session API). | https://boltclaw.ai/docs/referral-billing-fastspring.md |
| Lemon Squeezy | Add checkout[custom][boltclaw_ref] to the checkout URL, or checkout_data.custom through the API. | https://boltclaw.ai/docs/referral-billing-lemonsqueezy.md |
| Shopify | Nothing to add: a partner link's ?via= stays in the order's landing site. A cart attribute boltclaw_ref or a partner's discount code also works. | https://boltclaw.ai/docs/referral-billing-shopify.md |
| Chargebee | Set meta_data.boltclaw_ref on the subscription from your server, or add a custom field cf_boltclaw_ref to the drop-in checkout. | https://boltclaw.ai/docs/referral-billing-chargebee.md |
| Recurly | Set a subscription custom field named boltclaw_ref (define it under Configuration, Custom Fields first). | https://boltclaw.ai/docs/referral-billing-recurly.md |
| Gumroad | Link to your product with ?ref=<code>: Gumroad keeps it in the sale's url_params. | https://boltclaw.ai/docs/referral-billing-gumroad.md |

Not one of these: report each sale from the server with `event: "sale"`, the payment's id as
`event_id`, the user's id, `amount` in minor units and `currency`; and each refund with
`event: "refund"` and `refund_of` set to the sale's `event_id`.

## 5. Check it

Once the person has set the key, send one test lead with it:

```bash
curl -X POST https://api.boltclaw.ai/v1/referrals/conversions \
  -H "Authorization: Bearer $BOLTCLAW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"program_id":"<program id>","event":"lead","event_id":"install-check-1","customer":{"id":"install-check"},"test":true}'
```

A `201` (or `200` on a repeat) with `"test": true` means the wiring and the key work. Test data is
never paid or counted, and the person can delete it with Clear test data. Then tell the person to
open the program's Setup tab: the setup status shows each part (the tag, billing, signups, sales,
codes) turning green as live events arrive, and Send a test sale runs the whole path. With a key
that has `referrals:read`, `GET https://api.boltclaw.ai/v1/referrals/programs/{id}/integration-status` reads the same
status.

## 6. Hand back

Tell the person, in plain words: which files you changed, the environment variable to set
(`BOLTCLAW_API_KEY`, and `BOLTCLAW_PROGRAM_ID` if you used one), which billing card to open on the
Setup tab, and that the setup status will confirm each part.

## More

- https://boltclaw.ai/docs/referral-setup.md - every billing system, the setup status, test data
- https://boltclaw.ai/docs/api/referrals.md - the referral operations
- https://boltclaw.ai/skill.md - the rules for an assistant holding a Bolt Claw key
- https://boltclaw.ai/llms.txt - everything else
