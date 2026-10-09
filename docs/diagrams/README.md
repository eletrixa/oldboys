# Diagrams

Architecture diagrams of Radar, made with archify. Each diagram has three kinds of files here:

- `<name>.json`: the diagram source. This is the source of truth; edit it, not the HTML.
- `<name>.html`: the standalone page archify renders from the JSON (fonts from Google Fonts; it still renders without them).
- `<name>.visual-check.*`: archify's visual check of the render (screenshots at several sizes and the result).

The app serves four of them on the public `/architecture` page:

| Diagram | Source | Served at |
|---|---|---|
| User journey | `user-journey.json` | `/diagrams/user-journey.html` |
| Research data flow | `data-flow.json` | `/diagrams/data-flow.html` |
| D1 database | `database.json` | `/diagrams/database.html` |
| High-level architecture | `high-level.json` | `/diagrams/high-level.html` |

`docs/` is not served. The served copies live in `public/diagrams/` and are byte-for-byte copies of the HTML here. When you re-render one of these four, copy the new `.html` to `public/diagrams/` in the same commit, for example:

```sh
cp docs/diagrams/data-flow.html public/diagrams/
```

`run-sequence.*` is a sequence diagram of one research run (as of 9 Oct): seed, search pool, lineup, collect pool, extract, verify, synthesize. It is not served.
