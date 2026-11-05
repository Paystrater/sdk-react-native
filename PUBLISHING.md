# Publishing @paystrater/react-native

CI publishes every release from a version tag on `main`. No npm token lives in GitHub, and nothing goes live until a maintainer approves it twice: once in GitHub and once on npmjs.com. `@paystrater/react` follows the same steps in its own repository.

## Release in five steps

**1. Set the version on `dev`.**

For a test release, which goes to the `next` tag:

```bash
npm version 0.1.0-next.1 --no-git-tag-version
```

For a stable release, which goes to `latest`, run `npx changeset`, choose patch, minor or major and describe the change, then:

```bash
npx changeset version && npm install --package-lock-only
```

Use patch for fixes, minor for new features and major for breaking changes. The first stable release is `1.0.0`.

**2. Check it.**

```bash
nvm use                               # Node 24 from .nvmrc
npm run sync-core && npm run check
```

The core must match `@paystrater/react`'s, with `sdk-react` checked out beside this folder.

**3. Merge.** Commit, push `dev`, and merge it into `main` by pull request once CI passes. Merge `sdk-react` first whenever the shared core changes, because this repository's CI compares its copy with `main` of `sdk-react`.

```bash
git add -A
git commit -m "feat: <what changed>"
git commit -am "chore: release 0.1.0-next.1"   # the version bump from step 1, if it isn't in the first commit
git push origin dev
gh pr create --base main --head dev --fill
gh pr merge --merge                            # once sdk-react is merged and CI is green
```


**4. Tag `main`.** The tag must be `v` plus the version in `package.json`.

```bash
git checkout main && git pull && git tag v0.1.0-next.1 && git push origin v0.1.0-next.1
```

**5. Approve.** Approve the **Release** job in GitHub, wait for it to finish, then open the package's **Staged Packages** tab on npmjs.com, check the version and click **Approve**. This needs 2FA on your npm account.

**6. Point `latest` at it.** A pre-release goes to the `next` tag, but setups and the docs install with the plain `npm install @paystrater/react-native` (or `npx expo install @paystrater/react-native`), which takes `latest`. So move `latest` to every new release (a stable version goes to `latest` by itself, so skip this for one):

```bash
npm dist-tag add @paystrater/react-native@0.1.0-next.1 latest --otp=<code from your authenticator>
```

Then confirm what went out:

```bash
npm view @paystrater/react-native dist-tags
```

Before the first stable release, test a `next` version on staging with test keys: a test merchant's `pk_test_…` key and a payment created on `https://staging-api.paystrater.com`. Run the checkout end to end in a development build on iOS and Android, and in Expo Go.

## When the API changes

This package has no types script of its own. Its API types and the rest of the shared core are copied from `@paystrater/react`, so follow the API there first: run `npm run types` in `sdk-react` and merge it, then copy the result here.

```bash
npm run sync-core   # copies ../sdk-react/src/core, generated types included, into src/core
npm run check       # check:core fails while the copy differs from sdk-react
git add src/core && git commit -m "feat: follow the API's <change>"
```

## If a release fails

| What happened | What to do |
| --- | --- |
| The tag doesn't match `package.json` | Fix the version, merge, and push a new tag. Don't move a tag that has already been pushed |
| A check fails in the Release job | Fix it, merge, and release the next version number |
| npm says the version already exists | Version numbers can never be reused, so use the next one |
| npm returns a 404 or a trusted publisher error | Check the settings below. Names are case-sensitive, and npm doesn't check them when you save |
| A bad version went live | Publish a fixed version, then run `npm deprecate @paystrater/react-native@<version> "<reason>"` |

## One-time setup

1. **npm organisation.** Create `paystrater` on npmjs.com, which gives the `@paystrater` scope. Turn on 2FA for your account first, then add a second owner and require 2FA for every member.
2. **First version.** npm only offers trusted publishing for a package that already exists, so publish once by hand, with `npm publish --access public --tag next --provenance=false`. Provenance only works in CI.
3. **Trusted publisher.** On the package's page on npmjs.com, go to Settings → Trusted publishing → GitHub Actions and enter organisation `Paystrater`, repository `sdk-react-native`, workflow `release.yml` and environment `npm`. Leave direct publishing and dist-tag management off, because the workflow only stages. A new configuration expires unless it publishes within 2 days, and it can't be edited, so delete and recreate it if it has expired or is wrong.
4. **GitHub environment.** In Settings → Environments, create `npm`, add yourself as a required reviewer, and limit it to the branch `main` and the tag pattern `v*`.
5. **Protect the repository.** Add a ruleset for `main` that requires a pull request and passing CI and blocks force pushes and deletion, and one for `v*` tags that only admins can bypass. Turn on secret scanning with push protection, Dependabot alerts and private vulnerability reporting.
6. **Licence.** The packages are MIT. Change `license` and `LICENSE` if Paystrater wants another.

CI reads the public `sdk-react` repository to check the shared code against it. If `sdk-react` is ever made private, add the Actions secret `SDK_REACT_READ_TOKEN` here (read-only Contents on `Paystrater/sdk-react`). npm provenance also needs a public repository.

## Commit messages

This repository is public, so write each message for a stranger reading the history.

```
<type>: <what changed, in the imperative, under 72 characters>

Optional body explaining why, not how.
```

Types are `feat`, `fix`, `docs`, `test`, `refactor`, `ci`, `build` and `chore`. For a breaking change, write `feat!:` and describe it in the body. Give pull requests a title in the same format, because it becomes the merge's description.

- `fix: stop polling after a final payment status`
- `fix(deps): override minimatch to the patched 11.0.4`
- `ci: update actions/checkout to v7`

Keep out internal documents, customer details, keys and other companies' names.

## What CI checks

- **CI workflow** (every push and pull request): `npm ci`, `npm audit signatures` (registry signatures of every dependency), and `npm run check`, with `@paystrater/react` checked out beside it for the core check.
- **Release workflow** (a `v*` tag): the same checks, that the tag matches `package.json`, then `npm stage publish` with provenance through OIDC. Staged publishing needs npm 11.15.0 or later and Node 22.14 or later; the workflow installs npm 11.15.0 and uses Node 24 from `.nvmrc`.

## What is in the package

`dist/` only: ES modules (also served to Metro through the `react-native` field and condition) and CommonJS, TypeScript types for both, source maps. `dependencies` is empty and there is no native code. Peers: `react` 18 or later and `react-native` 0.72 or later.
