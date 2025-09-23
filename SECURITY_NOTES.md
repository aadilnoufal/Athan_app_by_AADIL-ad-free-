Secrets and configuration

- Do not commit real API keys or credentials.
- Use .env (see .env.example) for public client keys like RevenueCat iOS key:
  - EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxx
- App reads keys from process.env first, then from app.json extra.revenuecat.
- Keep Google/Firebase plist/json files out of git; they are ignored in .gitignore.
- For CI builds with EAS, prefer setting env vars in eas.json or the EAS dashboard rather than committing values.

Audited changes

- Removed a hardcoded RevenueCat fallback key from app/_layout.tsx.
- Replaced androidApiKey in app.json with a placeholder.
- Strengthened .gitignore to exclude .env and common credential files.
