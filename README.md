# Solar Doc Manager — Mobile App (Customer / Staff)

Front-end only — talks to the **shared backend** over the network, so it
must be deployed alongside (not instead of) the backend package.

## Setup
1. Deploy the **backend** package first (see its README) and copy its URL.
2. Open `public/config.js` and set:
   ```js
   window.API_BASE = "https://your-backend-url.com";
   ```
3. Deploy this `public/` folder to any static host (Vercel, Netlify, Firebase
   Hosting, GitHub Pages — all free, all give HTTPS automatically).

## Run locally (for testing before you deploy)
Terminal 1 — start the backend:
```
cd ../backend
node server.js
```
Terminal 2 — start this app:
```
node server.js
```
Open **http://localhost:3001/** — `config.js` already points at
`http://localhost:3000` by default, matching the backend's local port, so
local testing works with no edits.

## Install on a phone (after deploying to a live HTTPS URL)
- **Android (Chrome):** ⋮ menu → "Add to Home screen" / "Install app"
- **iPhone (Safari):** Share icon → "Add to Home Screen"

It'll sit on the home screen with its own icon and open full-screen, like a
real app. (Install prompts need HTTPS — most free static hosts give you
that automatically.)

## Demo logins
| Role  | Mobile      | Password  |
|-------|-------------|-----------|
| Admin | 9000000001  | admin123  |
| Staff | 9000000002  | staff123  |

## Keeping in sync with the website
Both this app and the admin website package must have their `config.js`
pointed at the **same** backend URL. As long as they are, any update made
in either one shows up in the other immediately — they're really just two
different front doors onto the same data.
