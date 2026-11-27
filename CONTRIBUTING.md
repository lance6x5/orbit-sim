# Contributing to Gravitas

## Reporting

Use the in-app **Feedback** menu or the [issue forms](https://github.com/lance6x5/orbit-sim/issues/new/choose) (Bug report / Feature request). Please don't include personal data.

## Triage flow

1. Every new issue is automatically labelled `triage` (plus `bug` or `enhancement`).
2. The maintainer reviews it, removes `triage`, and relabels or closes it as needed (asking for details, marking duplicates, and so on).
3. Work happens on a branch, for example `fix/123-bounce-overlap` or `feat/45-rk4`.
4. Open a pull request whose description includes `Fixes #N`, so the issue closes automatically on merge.
5. Run `npm test` and `npm run build` before opening the PR. CI runs both too.
6. Add the change to the `Unreleased` section of [CHANGELOG.md](CHANGELOG.md). On release, that section becomes the new version (see the Versioning section in the README), gets tagged `vX.Y.Z`, and is published as a GitHub release.

## Licensing of contributions

Gravitas is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE.md). By submitting a pull request,
you agree that your contribution is licensed to Silverlight DevTech under the same terms, and that Silverlight
DevTech may also offer it under its commercial licenses.
