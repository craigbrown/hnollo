#!/usr/bin/env bash
set -euo pipefail

mode="${1:?Expected check or create}"
case "$mode" in
  check|create) ;;
  *) echo "Expected check or create" >&2; exit 1 ;;
esac

tag="v${RELEASE_VERSION:?Release version is required}"
commit="${GITHUB_SHA:?Release commit is required}"
if ! git check-ref-format "refs/tags/$tag"; then
  echo "Invalid release tag: $tag" >&2
  exit 1
fi

# Query both the tag object and its peeled commit to support annotated tags.
remote_tags="$(git ls-remote --tags origin "refs/tags/$tag" "refs/tags/$tag^{}")"
if [ -n "$remote_tags" ]; then
  existing_commit=""
  while read -r sha ref; do
    existing_commit="$sha"
    if [ "$ref" = "refs/tags/$tag^{}" ]; then
      break
    fi
  done <<< "$remote_tags"
  if [ "$existing_commit" != "$commit" ]; then
    echo "Tag $tag already belongs to another commit. Choose a new version." >&2
    exit 1
  fi
  echo "Tag $tag already points to this commit; keeping it unchanged."
fi

if [ "$mode" = check ]; then
  echo "Release version $RELEASE_VERSION is valid for this commit."
  exit 0
fi

repository="${GITHUB_REPOSITORY:?Release repository is required}"
if gh release view "$tag" --repo "$repository" >/dev/null 2>&1; then
  echo "GitHub Release $tag already exists; keeping it unchanged."
  exit 0
fi

# GitHub creates the tag at the deployed commit if it doesn't already exist.
gh release create "$tag" \
  --repo "$repository" \
  --target "$commit" \
  --title "$tag" \
  --generate-notes \
  --notes "Deployed build ${GITHUB_RUN_NUMBER:?Build number is required}."
