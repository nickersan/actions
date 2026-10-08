// Renovate, self-hosted by .github/workflows/renovate.yaml, keeping the tn and okayat repos' dependencies current. One
// configuration for them all - the repos carry none of their own. Updates land the trunk-based way: a renovate/ branch,
// whose build is a check, fast-forwarded onto main when it passes, where the build releases it. A major update waits as
// a pull request instead, for a person to merge.
module.exports = {
  platform: 'github',
  repositories: [
    'nickersan/actions',
    'nickersan/tn-parent',
    'nickersan/tn-lang',
    'nickersan/tn-service',
    'nickersan/tn-data-service',
    'nickersan/tn-data-service-jdbc',
    'nickersan/tn-data-service-jpa',
    'nickersan/tn-auth-service',
    'nickersan/tn-auth-service-container',
    'nickersan/tn-user-service',
    'nickersan/tn-user-service-container',
    'nickersan/tn-notification-service',
    'nickersan/tn-notification-service-container',
    'nickersan/tn-temporary-token-service',
    'nickersan/tn-temporary-token-service-container',
    'nickersan/okayat-bff',
    'nickersan/okayat-bff-container',
    'nickersan/okayat-spot-service',
    'nickersan/okayat-spot-service-container',
    'nickersan/okayat-client',
    'nickersan/okayat-app',
    'nickersan/okayat-web',
    'nickersan/okayat-web-container',
  ],
  onboarding: false,
  requireConfig: 'optional',
  dryRun: process.env.DRY_RUN === 'true' ? 'full' : null,
  gitAuthor: 'Renovate Bot <bot@renovateapp.com>',

  // GitHub Packages needs a token even to read, for the Maven repository and the @nickersan npm scope alike
  hostRules: [
    {
      hostType: 'maven',
      matchHost: 'maven.pkg.github.com',
      username: 'nickersan',
      password: process.env.RENOVATE_TOKEN,
    },
    {
      hostType: 'npm',
      matchHost: 'npm.pkg.github.com',
      token: process.env.RENOVATE_TOKEN,
    },
  ],
  npmrc: '@nickersan:registry=https://npm.pkg.github.com\n',

  extends: ['config:recommended'],
  // its monorepo groups would take precedence over the weekly batch below
  ignorePresets: ['group:monorepos', 'group:recommended'],
  dependencyDashboard: true,
  automerge: true,
  automergeType: 'branch',

  // third-party updates come once a week, minor and patch ones in a single branch per repo, so tn-parent - and so every
  // repo built on it - releases once for the lot rather than once for each
  schedule: ['before 6am on monday'],
  timezone: 'Europe/London',

  // the commit type decides the release it makes (see nickersan/actions' README): a dependency moving on is a fix of ours,
  // and a major of something we build on, e.g. Spring Boot, a major of ours
  semanticCommits: 'enabled',
  semanticCommitScope: 'deps',
  packageRules: [
    {
      matchUpdateTypes: ['minor', 'patch', 'pin', 'digest'],
      groupName: 'third-party dependencies',
      semanticCommitType: 'fix',
    },
    {
      matchUpdateTypes: ['major'],
      commitMessagePrefix: 'feat(deps)!:',
      automerge: false,
    },

    // tn-parent pins Hibernate Envers and Spring Data Envers to the versions Spring Boot manages, so a major of one is a
    // major of them all
    {
      matchUpdateTypes: ['major'],
      matchPackageNames: ['/^org\\.springframework\\.(boot|data):/', '/^org\\.hibernate\\.orm:/'],
      groupName: 'spring boot',
    },

    // a tn or okayat release reaches every repo using it as soon as it's out, all together
    {
      matchPackageNames: ['/^com\\.(tn|okayat)[.:]/'],
      groupName: 'tn libraries',
      schedule: ['at any time'],
    },
    {
      matchPackageNames: ['@nickersan/**'],
      groupName: 'okayat libraries',
      schedule: ['at any time'],
    },

    // a container repo's pin on what it packages is moved on by that repo's own release (release/update-container)
    {
      matchRepositories: ['nickersan/*-container'],
      matchDepTypes: ['compile', 'dependencies'],
      matchPackageNames: ['/^com\\.(tn|okayat)[.:]/', '@nickersan/**'],
      enabled: false,
    },

    // the shared workflows have no build of their own to check an update against
    {
      matchRepositories: ['nickersan/actions'],
      automerge: false,
    },
  ],
};
