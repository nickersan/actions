#!/usr/bin/env bash
# Works out the next release from the conventional commits since the last v<major>.<minor>.<patch> tag, printing
# "<bump> <version>":
#
#   a breaking change (type!: or a BREAKING CHANGE footer)  major (minor while the major is 0)
#   feat                                                    minor
#   fix                                                     patch
#   anything else                                           none - nothing to release
#
# With no tag yet the bump is "initial": a -SNAPSHOT version is released as itself, less the suffix; a version without
# one is taken as already released and bumped from the whole history.
#
# Usage: next-version.sh <version the project declares>
set -euo pipefail

declared="${1:?usage: next-version.sh <declared version>}"

normalise()
{
  local major minor patch
  IFS=. read -r major minor patch <<< "$1"
  echo "$((10#${major})).$((10#${minor})).$((10#${patch}))"
}

last_tag="$(git describe --tags --abbrev=0 --match 'v[0-9]*.[0-9]*.[0-9]*' 2>/dev/null || true)"

if [[ -n "${last_tag}" ]]
then
  last="${last_tag#v}"
  range="${last_tag}..HEAD"
elif [[ "${declared}" == *-SNAPSHOT ]]
then
  echo "initial $(normalise "${declared%-SNAPSHOT}")"
  exit 0
else
  last="${declared}"
  range="HEAD"
fi

subjects="$(git log --format=%s "${range}")"
bodies="$(git log --format=%b "${range}")"
scope='(\([^)]*\))?'

if grep -Eq "^[a-z]+${scope}!:" <<< "${subjects}" || grep -Eq '^BREAKING[ -]CHANGE:' <<< "${bodies}"
then
  bump='major'
elif grep -Eq "^feat${scope}:" <<< "${subjects}"
then
  bump='minor'
elif grep -Eq "^fix${scope}:" <<< "${subjects}"
then
  bump='patch'
else
  echo "none $(normalise "${last}")"
  exit 0
fi

IFS=. read -r major minor patch <<< "$(normalise "${last}")"

[[ "${bump}" == major && "${major}" -eq 0 ]] && bump='minor'

case "${bump}" in
  major) echo "major $((major + 1)).0.0" ;;
  minor) echo "minor ${major}.$((minor + 1)).0" ;;
  patch) echo "patch ${major}.${minor}.$((patch + 1))" ;;
esac
