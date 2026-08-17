# Barbex — Resend Integration Finalization

Before considering the Resend integration complete, we need to ensure maximum security, verify domain status against the real API, and perform a production-ready test.

## Security Hardening
- **Verify Secrets**: Confirmed `RESEND_API_KEY` is in Lovable Secrets. I will add a check for `RESEND_WEBHOOK_SECRET`.
- **RLS Refinement**: Tighten `resend_settings` so only `super_admin` can read/write global configs. Regular tenants should not have access to these global settings.
- **Webhook Validation**: Implement signature verification in the webhook handler using `RESEND_WEBHOOK_SECRET`.

## UI/UX Enhancements
- **Real Domain Validation**: Update `validateResendIntegration` to check for specific verification status (Verified/Pending/Failed) and update the local DB flag.
- **Test Email Modal**: Improve the test modal to allow custom recipient and show full result (ID, Status).
- **Super Admin View**: Ensure the integration card and configuration options are strictly restricted to Super Admins.

## Operational Readiness
- **Template Refinement**: Ensure the test template follows the requested wording.
- **Log Completeness**: Verify all requested log fields are being captured.
- **Rate Limiting**: Check if we need to add rate limiting for email-sending routes.

## Delivery Checklist
1. Inform on tables/columns created.
2. Confirm Secret storage location.
3. Apply RLS tightening.
4. Implement real domain status check.
5. Perform a real test send.
6. Verify logs and webhook processing.
