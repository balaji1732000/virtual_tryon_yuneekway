# Email OTP setup (Supabase)

This app uses Supabase Auth with **email OTP (8-digit code)**.

## 1) Enable signups + Email auth

In Supabase Dashboard:

- **Authentication → Providers → Email**
  - Make sure Email is enabled
  - Make sure **Signups** are enabled (do not disable signups)

## 2) Change the email template to send a 8-digit code

By default, Supabase sends a **Magic Link** (click-to-login).

To send a 6-digit OTP instead:

- Go to **Authentication → Email Templates**
- Edit the **Magic Link** template and include `{{ .Token }}` (the 8-digit code)

Example template body:

```html
<h2>Your login code</h2>
<p>Please enter this code in the app:</p>
<p style="font-size: 24px; font-weight: 700; letter-spacing: 3px;">{{ .Token }}</p>
```

## 3) (Recommended) Keep magic link working as fallback

This repo includes an `/auth/confirm` route that can exchange `token_hash` for a session.

If you want your email to include a login button as a fallback, add a link like:

```html
<p>Or click to sign in:</p>
<p>
  <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app">
    Sign in
  </a>
</p>
```

## Troubleshooting

- **I still receive only magic links**: your email template likely doesn’t include `{{ .Token }}` yet.
- **Clicking the link returns me to /login**: ensure the link points to `/auth/confirm` as shown above and your Supabase Site URL / Redirect URLs are set correctly.

Please do not paste raw URLs or secrets in templates; use Supabase variables (`{{ .SiteURL }}`, `{{ .TokenHash }}`) as shown.

