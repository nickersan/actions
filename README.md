# actions

The build and release every tn and okayat repo shares. `main` is the only branch (trunk-based), and each push to it
builds the repo and, when there's something to release, releases it.

## What a push to main does

1. **Works out the next version** from the [conventional commits](https://www.conventionalcommits.org) since the last
   `v<major>.<minor>.<patch>` tag ([`version/next`](version/next/next-version.sh)):

   | Commits since the last release                                   | Bump                               |
   |------------------------------------------------------------------|------------------------------------|
   | a breaking change (`feat!:`, a `BREAKING CHANGE:` footer)        | major - minor while the major is 0 |
   | `feat:`                                                          | minor                              |
   | `fix:`                                                           | patch                              |
   | anything else (`chore:`, `docs:`, `refactor:`, `test:`, `ci:` ...) | none - build only                  |

   A repo with no tag yet releases the version it declares, less `-SNAPSHOT`.
2. **Sets that version** in `pom.xml` or `package.json` and builds, running every test.
3. **Commits and tags it** - `chore(release): <version> [skip ci]` and `v<version>`, pushed together
   ([`release/push`](release/push/action.yaml)). So `main` always declares the last release. If `main` moved on during
   the build nothing is pushed, and the build queued behind releases both.
4. **Publishes**: a library or service to GitHub Packages (Maven or npm), and the image of a repo with a `Dockerfile` to
   `ghcr.io/nickersan/<image>:<version>` and `:latest`, labelled with its source repo
   ([`image/push`](image/push/action.yaml)). Then creates a GitHub release with generated notes.

A push to any other branch - Renovate's `renovate/**` ones - only builds, as a check: nothing is versioned or published.

## Renovate

[`renovate.yaml`](.github/workflows/renovate.yaml) runs [Renovate](https://docs.renovatebot.com) every three hours over the repos
[`renovate/config.js`](renovate/config.js) lists - they carry no Renovate config of their own. An update is a
`renovate/` branch; when its build passes, Renovate fast-forwards it onto `main`, whose build releases it.

- **Not** our own libraries (`com.tn*`, `com.okayat*`, `@nickersan/*`): whoever releases one bumps its consumers (the
  push step of `complete-change`), so they move with the change that needs them. `tn-parent` is the exception: it carries
  the third-party versions every repo builds on, so it moves with the weekly batch.
- **Third-party minor and patch updates** once a week, Monday morning, all of a repo's in one branch.
- **Majors** wait as pull requests for a person, committed as `feat(deps)!:` - a major of something we build on is a
  major of ours. Every other update is `fix(deps):`.

Run it by hand from the Actions tab, with *dry-run* to see what it would do without doing it. The Dependency Dashboard
issue in each repo lists what's pending.

## Using it

Each repo carries one `.github/workflows/build.yaml` calling [`maven.yaml`](.github/workflows/maven.yaml) or
[`npm.yaml`](.github/workflows/npm.yaml):

```yaml
name: build

on:
  push:
    branches:
      - main
      - 'renovate/**'
  workflow_dispatch:

concurrency:
  group: build-${{ github.ref }}
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

jobs:
  build:
    uses: nickersan/actions/.github/workflows/maven.yaml@main
    secrets: inherit
```

The repo needs a `WORKFLOW_TOKEN` secret: a PAT with `repo` and `write:packages` scopes. It pushes the release commit
(a push made with `GITHUB_TOKEN` starts no workflows), and reads and publishes packages.
This repo needs it too, for Renovate.

A repo with a `Dockerfile` also pushes its image in the same release, tagged with that release's version. For Maven,
`tn-parent`'s `docker` profile builds it as `${docker-image-repository}:${project.version}` and the jar is deployed too;
for npm, `scripts/build-image.sh` builds it as the repo's name. (The separate `<name>-container` repos are archived: every
service and web app builds its own image.)

For npm, what `package.json` declares decides: a `verify` script runs first; a `Dockerfile` pushes the image; `"private": true`
publishes nothing to GitHub Packages and attaches no `.tgz` (a workspace root is private by npm's rule, so there each workspace
decides). A web app (`verify`, `Dockerfile`, `private`) verifies, builds its image from its own build and pushes it in one release.

## When a release half-fails

The tag is pushed before publishing, so a failed publish leaves a tag with nothing behind it. Re-running the build
won't help (it sees `main` has moved on), so publish from the tag by hand, e.g.
`git checkout v1.2.0 && mvn deploy -DskipTests`.
