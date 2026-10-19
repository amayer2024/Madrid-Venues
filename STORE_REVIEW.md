# App Store / Play review notes

## Payment (Apple 3.1.3(e))

LineSkip sells line-skip and cover **passes redeemed at a physical venue door**. The good is consumed outside the app (entry to a Madrid nightlife venue). Under App Store Review Guideline **3.1.3(e) Goods and Services Outside of the App**, we **must** collect payment with a method other than Apple IAP (card / Apple Pay via Stripe). There is no digital unlock, subscription, or in-app currency.

Reviewer notes to paste:

> This app sells physical-access passes (line skip / cover) redeemed at a nightclub door. Payment is processed with Stripe. We do not use In-App Purchase because guideline 3.1.3(e) requires a non-IAP method for goods and services consumed outside the app.

Same rationale on Google Play for real-world services.

## Demo accounts (password `LineSkip1!`)

- Customer: `customer@lineskip.app`
- Door staff: `door@lineskip.app`
- Venue admin (web `/admin`): `venue@lineskip.app`
- Superadmin (web `/admin`): `admin@lineskip.app`

## Required store items

- Age rating 17+ / nightlife and alcohol context
- Privacy policy: `/privacy`
- Terms: `/terms`
- In-app account deletion: Account → Eliminar cuenta
- Camera permission: door QR scan only
- Sign in with Apple: add before using any other social login
