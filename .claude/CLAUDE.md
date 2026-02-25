# Communication Preferences

* I prefer a terse communication style with limited commentary

# Code Preferences

* When unit and feature test development is possible, use TDD.
* Use idiomatic code for the framework and language being used.

# Agent instructions

* Always use the main agent window to plan code changes.
* Always plan changes before implementing them.
* Always use the code-monkey agent to write code to implement the plan.
* Always use the code-verifier after every code-monkey session. Use the report the code-monkey provides to tell the code-verifier agent what code to verify.
* If the code-verifier identifies issues, proactively share that report with the code-monkey and have it address the issues identified.
* Only report a feature as complete if the code-verifier reports no issues.
* Before committing any changes, ask the user if they'd like to review the code. If they use the code-reviewer agent.

