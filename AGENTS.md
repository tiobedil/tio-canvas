# Agent instructions

## Change log

The in-app Change log (More menu → Change log) reads `client/changelog.js`.

- Any change a person using the canvas would notice must add an item in the same
  change: something new, something that works differently, a fix, or a speed-up.
- Add the item to the `unreleased` entry on top. Never write a version or date by
  hand: `scripts/stamp-changelog.mjs` runs in the release (semantic-release) and
  turns it into a real version and date, then adds a fresh empty `unreleased`.
- `type` is `new`, `improved`, `fixed` or `faster` (performance).
- One short sentence, written from the user's side. Say what they get, not what
  the code did ("Zoom stays smooth with 100+ screens", not "refactor render loop").
- Never add build, CI, release, refactor, test or docs work. If the user cannot
  see or feel it, it does not belong.

## Commit messages

Every commit that lands on `main` publishes a new npm version (see
`.releaserc.json`: patch by default, `feat:` minor, `feat!:` or a
`BREAKING CHANGE` footer major).

- Never write the phrase `[skip ci]` (or `[ci skip]`, `[skip actions]`) anywhere in
  a commit message, subject or body, not even to describe it. GitHub then skips
  the whole workflow and nothing is released. Only the release commit that
  semantic-release makes itself carries it. Write "the skip marker" instead.
- Do not push to `main` unless a release is intended.
