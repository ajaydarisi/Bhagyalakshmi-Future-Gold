# Follow-up: storage lockdown, leaked-password UX, design tokenization

## (a) Storage bucket listing lockdown
- [ ] migration 010: drop broad public SELECT policies on product-images & public-downloads
- [ ] apply to BFG Prod + verify policies gone, buckets still public
- [ ] update canonical storage.sql

## (b) Leaked-password protection
- [ ] signup-form: map weak_password error -> friendly localized message
- [ ] reset-password-form: same
- [ ] add i18n keys (en/te)
- [ ] (manual) user enables dashboard toggle; note admin change-password path bypasses HIBP

## (c) Design tokenization + contrast
- [ ] introduce --gold-rgb / --gold-deep-rgb tokens; replace hardcoded gold in wedding-hero(+pattern)
- [ ] raise light muted-foreground contrast (0.50 -> 0.44) for small secondary text (a11y)

## Review
(to be filled in)
</content>
