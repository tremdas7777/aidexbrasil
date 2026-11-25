# Architecture rules

- Store payment-only product names in `private_settings` and read them server-side for every new charge; keep storefront names, prices and analytics independent of gateway labels.
- Protect gateway-name administration inside each server function before loading the privileged client; the admin page itself is not an authorization boundary.
- Legacy card payments forward the SDK's opaque payinCard unchanged, never retry card POSTs, and persist orders before returning the complete pending-3DS response; this avoids invalid authentication and duplicate charges.
- Legacy webhook notifications only supply a validated ID; confirm status with the authenticated provider API before reporting a paid sale, because notifications have no signature.