# specs.md

Rule: slices that ship against a spec re-read it before they call themselves done.

- When `specs/` exists, each slice has one spec in it (see `specs/README.md`). Write the first test cases from its `## Acceptance` list, one test per item.
- Re-read the spec in refactor step 1, after green and before cleanup. Compare contract, invariants and acceptance with what the code and tests do.
- Spec drift is fixed in the spec and in the code in the same commit. Never leave the spec describing behaviour the code no longer has, or the reverse.
- A changed spec keeps its acceptance items 1:1 with tests: add, rename or remove the test with the item.
- Binding decisions stay in `plans/`; a spec that needs to contradict a plan stops the slice and goes to the owner.
