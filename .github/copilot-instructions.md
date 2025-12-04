# Copilot Instructions – Coding Style

These rules guide any AI coding agent contributing to this repository. Mirror the tone and structure from `README.md`: code must read like a story that makes design intent obvious.

## Story-First Structure

- Reflect every product description directly in code structure. If a feature has three sections, expose three clearly named components or functions.
- Favor readability over brevity. Expand logic so that each step telegraphs why it exists.
- Keep parent modules high-level by composing focused helpers/components rather than embedding sprawling logic.

## Algorithms Live in Helpers

- Never inline even "small" formulas inside loops, JSX, or conditionals. Wrap them in descriptive functions such as `ApplyGammaCorrection`, `WithinDistance`, or `AverageColorRgb255`.
- When extending existing logic, introduce a new helper and call it rather than stuffing the algorithm into the current block.
- Reuse existing utilities whenever they already express the operation.

## Naming Expectations

- Use descriptive, intent-revealing identifiers. Length is not a concern; ambiguity is.
- Reserve short names (e.g., `i`, `x`, `y`) for tiny local scopes like loop indices.
- Components/classes are nouns; functions that act are verbs.

## Magic Numbers Become Constants

- Do not bury raw numbers or heuristic values. Declare named constants near the top of the file or within a dedicated config module.
- Document how a constant was derived or tuned so future readers understand its origin.

## Components and Modularity

- Each component/function/class should own a single responsibility.
- Adding a feature means creating a new component or helper, not appending JSX or logic into an existing "god" block.
- Compose the page or tool out of smaller, obviously named pieces (e.g., `ImageManipulationControls`, `ImageExportControls`).

## Error Handling Discipline

- Avoid redundant checks when callees already guard a condition.
- Let real bugs surface. Do not swallow exceptions or return arbitrary fallback values.
- Assertions are acceptable to document assumptions; generic catch-alls are not.

## Strong Typing and Validation

- Preserve strict typing. Do not cast to `any`, `unknown`, `void*`, etc., to silence errors.
- When dealing with uncertain external data, add explicit runtime validation (e.g., Zod schemas) instead of unsafe casts.

## Units, Ranges, and Intent

- Embed units in names, such as `colorRgb01`, `durationMs`, or `ampDb`.
- Helpers and props should signal the value’s domain in their names and documentation.

## Document Unusual Decisions

- If a design deviates from the obvious approach, leave a brief comment explaining why so the story stays clear.

## Change Etiquette

- When editing existing files, keep the top-level flow descriptive and offload new work into new helpers/components.
- Never introduce fresh algorithms inline within pre-existing loops or conditionals.
- Keep the codebase incremental and refactor-friendly; resist the urge to lump unrelated behavior together.
