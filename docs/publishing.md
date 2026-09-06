# Docker Hub publishing

[Back to README](../README.md)

This section is for maintainers of the release pipeline. To run Partyfinder, use the [deployment quickstart](../README.md#deploy-with-portainer); GitHub secrets and semantic-release are not required on your homelab.

The release workflow follows [Stasher's CI → semantic-release → Docker Hub pattern](https://github.com/SeanCassiere/stasher/blob/main/.github/workflows/release.yml). After **Check** succeeds for a push to `main`, it releases the exact tested commit to:

- `seancassiere/partyfinder:<version>` (for example `1.0.0`)
- `seancassiere/partyfinder:latest`

Images target `linux/amd64` and `linux/arm64`, use GitHub Actions build caching, and include OCI version/source/revision labels. Pull requests cannot run the secret-bearing publishing job. Superseded commits are skipped so an older build cannot overwrite `latest` after a newer release.

### One-time setup

1. Create the `seancassiere/partyfinder` repository on Docker Hub and choose its visibility deliberately. Published images contain the server/client bundle, not `.env` or credentials.
2. In this GitHub repository, open **Settings → Secrets and variables → Actions**. Add `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`, using a Docker Hub access token with permission to push this image. Do not paste credentials into source files or chat. The username can differ from the namespace if it has the necessary permissions.
3. Ensure the workflow can create GitHub release tags/releases. It uses GitHub's automatic `GITHUB_TOKEN`, not a personal token; branch/tag protection rules must allow the intended release operation.
4. Merge a releasable commit, or run **Actions → Check → Run workflow** on `main` after adding the secrets. A successful manual Check run also triggers publishing.

Without Docker Hub secrets, the release workflow reports a warning and skips publishing **before** creating any release tag. A green Check run alone does not mean an image was published; inspect the `release` run and Docker Hub.

Use Conventional Commits: `feat:` creates a minor release, `fix:` a patch, and `!` / `BREAKING CHANGE:` a major release. Like Stasher, `refactor:` and `build(deps):` create patch releases; docs/chore-only changes do not normally release. The first qualifying release is `1.0.0`. Git tags and GitHub release notes are the version authority; no npm package is published or generated version-bump commit pushed. If Docker publishing fails after a tag was created, rerun the failed release job on the same current-main commit to reuse that version.
