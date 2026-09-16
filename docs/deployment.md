# Deployment

Repository: [Behzad1991EN/operation-room-manager](https://github.com/Behzad1991EN/operation-room-manager).

Live Pages site: [Operation Room Manager](https://behzad1991en.github.io/operation-room-manager/).

The selected project folder is its own Git repository. Its parent directory contains unrelated work and is not used as the application repository. The user's initial application commit is preserved in `main`.

## Pipeline

The GitHub Actions workflow checks out source, sets up Node 22, installs pinned packages with `npm ci`, checks syntax, runs unit/integration tests, prepares `dist`, installs Chromium, and runs browser acceptance tests. A failed test prevents artifact publication and deployment. The artifact contains only the static app and its local WASM dependency, not repository files, development dependencies, backups, or operational employee data.

Pages settings must select **GitHub Actions**. The deploy job needs `pages: write` and `id-token: write` and uses the `github-pages` environment. Code pushes target `main`; pull requests run validation without deploying.

## Local equivalent

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

The development server deliberately supports the repository subdirectory at `/operation-room-manager/`. Relative CSS, JS, favicon, module-Worker and worker-import paths are tested there. `locateFile` resolves the WASM relative to the Worker module URL, not the site root. Hash routing requires no GitHub rewrite rules.

The app has no service worker or offline cache in V1. Data is local; a fresh page load still requires its static assets. The host serves the app over HTTPS. Do not publish real employee files or backups in the repository.

The first successful tested deployment and live Worker/reload verification are recorded in [verification](verification.md).

Reference: [GitHub custom Pages workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
