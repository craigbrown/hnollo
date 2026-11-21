# Contributing to this project

These conventions apply to all contributors, including coding agents.

## Coding principles

- After correctness, the most important factor your code will be judged on is readability. Your change should be written in such a way that when the diff is reviewed by a human, the time for the reviewer to understand the change is as minimal as possible.
- Prefer code that is simple for a human to reason about. Use several explicit steps when combining them would make the logic harder to follow.
- Keep the complexity of a change proportional to its importance and scope. A minor feature or bug fix should not require a large architectural change. The effort needed to understand, review and maintain the code should stay in line with the value it provides.
- Consider whether a pocket of complexity can be contained inside its own method or class, so that it can be reviewed and understood separately.
- Keep classes focused on a single responsibility as far as practical.
- When complexity is unavoidable, explain the requirement or tradeoff that justifies it.
- When changing existing code, avoid changing unrelated parts of nearby classes and methods unless those changes are essential to the task. A reviewer will use the git diff to check your changes, so minor unrelated changes could cause confusion.
- Use terminology appropriate to the layer: application concepts should not appear in lower-level APIs unless those APIs genuinely need them.
- Give each component only the information it needs.
- Expose only what callers need. Keep implementation details private.
- Group small, closely related declarations when reading them together makes their contract easier to understand. Split files by responsibility or when their size obstructs understanding; do not require one file per type.

## Documentation conventions

- Write doc comments when adding public types or members. Documentation should communicate the purpose of a type or member. 
- Avoid including implementation details in method documentation, unless that detail is likely to be important to callers and you want to guarantee that it will never change. You may also wish to mention an implementation detail if it is likely to be important to callers, but should not be depended upon.
- Never include information about where a type or member is currently used.
- Avoid adding or modifying comments to explain some minor change you have made, unless it would naturally be mentioned were the code being written for the first time.

## Commit conventions

Each commit should represent one atomic change. Atomic does not mean one file: changes across several files can belong to one task, while unrelated changes in the same file may need separate commits. Include the tests and documentation needed to understand and verify that change.

Ideally, finish implementing and validating the complete change before deciding how to divide it into commits. The commit history presented for review need not reflect the order in which the code was written.

Do not split work into multiple commits just for the sake of it. Each split should provide a concrete benefit: clearer understanding, less review noise, or easier reverting or cherry-picking of an independent change. A single cohesive commit is appropriate when further subdivision would add no such value. Commit count and small diff size are not goals in themselves.

- Order commits so each builds on what came before it. Check intermediate states where needed to ensure they do not depend on changes introduced later.
- Separate noisy mechanical changes, such as renaming a class, when doing so makes the functional changes easier to review.
- Keep optional additions separate so reviewers can revert or cherry-pick them without also taking unrelated work.
- Avoid arbitrary file-by-file commits or a single commit containing several independent changes. Use judgment about what is easiest to understand.

Write clear, descriptive commit messages:

- Use a concise subject, ideally 50 characters or fewer, but this is not a hard limit.
- Use the imperative mood: “Fix library updates”, rather than “Fixed library updates” or “Fixes library updates”.
- This project does not use the Conventional Commits specification; do not add prefixes such as `feat:`, `fix:` or `chore:`.
- Usually include a commit description, except for very simple, self-explanatory commits where reading a longer description would add nothing useful and just waste the reviewer's time.
- Consider using the following format for commit descriptions: explain the previous behaviour in the present tense, and why it was a problem. After a new paragraph, explain the new behaviour (or behaviours using bullet points) in the imperative tense, and why the change fixes the issue (if necessary).
- Do not manually wrap commit messages at a fixed character count.
- Write for future developers who will not have other context, such as a conversation or review thread, available. Treat the message as documentation of the change.
- AI agents should not claim any authorship over a change - do not add "Co-authored by" messages, or use an AI's identity in the author or committer fields.

## Review and validation

When receiving review comments on a PR, assess those comments before changing code. Check the reported behaviour against the implementation and reproduce it where practical. Explain any finding that is not valid and push back when appropriate.

When preparing the branch for re-review, fold corrections into the commits that introduced the problems using fixups - do not, for example, add a new "Fix comments" commit. Keep independent new functionality in its own commit. After rearranging history, verify that the intended final contents are preserved and that the resulting commit sequence remains coherent.
