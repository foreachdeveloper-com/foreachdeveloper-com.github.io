# foreachdeveloper.com

Landing page for **forEach developer**, the open-source studio of [Sergio Marin](https://highercomve.github.io/).

Plain HTML, CSS and JavaScript with no build step, served by Cloudflare Pages at
[foreachdeveloper.com](https://foreachdeveloper.com).

## Develop

```sh
bun run dev
```

Opens a live-reloading server at http://localhost:3000. CSS changes are swapped in place;
anything else reloads the page.

## Deploy

Pushes to `main` deploy to Cloudflare Pages (project `foreachdeveloper`) through
`.github/workflows/deploy.yml`; pull requests get a preview URL. Only the site files are
published, not `dev.ts` or `package.json`. The workflow needs two repository secrets:

- `CLOUDFLARE_API_TOKEN`: an API token with the **Cloudflare Pages: Edit** permission
- `CLOUDFLARE_ACCOUNT_ID`: the account ID from the Cloudflare dashboard

## Layout

- `index.html`, `styles.css`, `script.js`: the page
- `game.js`: a hidden game, loaded on demand
- `assets/brand/`: logo, mark, avatar and social preview image
- `assets/favicon/`: favicons and app icons
- `assets/projects/`: project icons
