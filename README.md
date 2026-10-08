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
4. **Publishes**: a library or service to GitHub Packages (Maven or npm); a container repo's image to
   `ghcr.io/nickersan/<image>:<version>` and `:latest`. Then creates a GitHub release with generated notes.
5. **Updates the container repo**, for a repo that has one: pins the new version in `<name>-container` and pushes it to
   `main` as `feat(deps):`, `fix(deps):` or `feat(deps)!:` to match the release, which releases the image in turn
   ([`release/update-container`](release/update-container/action.yaml)).

## Using it

Each repo carries one `.github/workflows/build.yaml` calling [`maven.yaml`](.github/workflows/maven.yaml) or
[`npm.yaml`](.github/workflows/npm.yaml):

```yaml
name: build

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: build
  cancel-in-progress: false

permissions:
  contents: read
  packages: write

jobs:
  build:
    uses: nickersan/actions/.github/workflows/maven.yaml@main
    with:
      container-repository: tn-user-service-container   # services and web UIs only
    secrets: inherit
```

The repo needs a `WORKFLOW_TOKEN` secret: a PAT with `repo` and `write:packages` scopes. It pushes the release commit
and the container repo's update (a push made with `GITHUB_TOKEN` starts no workflows), and reads and publishes packages.

A container repo is one with a `Dockerfile`. For Maven, `tn-parent`'s `docker` profile builds the image as
`${docker-image-repository}:${project.version}`; for npm, `scripts/build-image.sh` builds it as the repo's name less
`-container`, tagged with its version.

## When a release half-fails

The tag is pushed before publishing, so a failed publish leaves a tag with nothing behind it. Re-running the build
won't help (it sees `main` has moved on), so publish from the tag by hand, e.g.
`git checkout v1.2.0 && mvn deploy -DskipTests`.
