# Copilot Instructions

## Core Mindset

- **Careful over fast.** Speed is not the goal — correctness and stability are.
- Always keep the end user in mind. Consider how every change impacts their experience.
- Write code that is functional, efficient, readable, and maintainable.
- If a task or requirement is ambiguous, **ask clarifying questions before proceeding** — never silently guess(also in that case try to ask as many questions in one go and not elogate by asking one question at time, if required you may ask only one question at a time but prefer asking multiple questions in one go).

## File & Deletion Safety

- **Never delete files directly.** Always move them to the trash/recycle folder instead.

## Step-by-Step Workflow

For every step you take:

1. **Before:** Briefly explain what you are about to do (command, code change, or decision).
2. **Execute** the step.
3. **After:** Explain what was done and what the expected outcome is.
4. **Verify** nothing is broken before moving to the next step.

## Testing Requirements

- Write and run tests after every few steps to catch regressions early.
- At the end of any feature or fix, design and run a **comprehensive test suite** covering all edge cases.
- Ensure tests cover: happy paths, edge cases, error states, and boundary conditions.

## Code Quality Standards

- Keep code clean, well-organized, and consistently formatted.
- Add comments where logic is non-obvious; follow existing project coding standards.
- Avoid over-engineering — prefer simple, readable solutions over clever ones.
- Never leave dead code, debug statements, or TODO comments without a tracking issue.

## Security

- Never hardcode secrets, API keys, passwords, or credentials.
- Validate and sanitize all user inputs.
- Flag any security concerns found during implementation, even if outside scope.

## Architecture & Documentation

- If a **major architectural change** is made:
  - Document it in the architecture document.
  - Update the architecture diagram if applicable.
- For **new features**:
  - Update the `README` with a description and usage examples.
  - Update the `CHANGELOG` with a clear entry for the change.
- Keep all documentation in sync with the code — outdated docs are worse than no docs.

### Mandatory Documentation Update Policy

For **every non-trivial change** (feature, fix, refactor, route/page changes):

1. Update `README.md` if behavior, setup, routes, or usage changed.
2. Update `docs/ARCHITECTURE.md` if module structure, data flow, or responsibilities changed.
3. Add an entry to `CHANGELOG.md` under the correct date/version.

Do not consider a task complete until the above docs are reviewed and updated when applicable.

## Commit Standards

- Write clear, descriptive commit messages (conventional commits format preferred, e.g. `feat:`, `fix:`, `docs:`, `refactor:`).
- Each commit should represent one logical change.

## Long-Term Thinking

- Write code that is **scalable and maintainable** for future developers.
- Prefer solutions that reduce future complexity, not increase it.
- When in doubt, choose the approach that is easiest to understand and change later.

## learings in lessons.md
-if you make a mistake note that mistake down and how not to cause it again in a lessons.md file and also note down the solution you implemented to fix it in the same file, this will help you to avoid making the same mistake again and also will help you to solve similar problems in the future.
- Write comprehensive tests covering edge cases, and error states.