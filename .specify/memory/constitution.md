<!--
Sync Impact Report
==================
Version change: (template/placeholder) → 1.0.0
Modified principles: N/A (initial adoption from template)
Added sections: Core Principles (3), How Principles Guide Technical Decisions,
  Quality Gates & Agent Requirements, Governance
Removed sections: Template placeholders PRINCIPLE_4, PRINCIPLE_5 (user requested
  three principle areas only)
Templates:
  .specify/templates/plan-template.md ✅ Constitution Check wording aligned
  .specify/templates/spec-template.md ✅ No mandatory section changes required
  .specify/templates/tasks-template.md ✅ Task types align (testing discipline)
  .cursor/commands/*.md ✅ No outdated agent-specific references; constitution path correct
Follow-up TODOs: RATIFICATION_DATE set to today (no prior adoption); add npm scripts
  (format, lint, typecheck) to package.json when project adopts them.
-->

# VideoRenderer Constitution

## Core Principles

### I. Code Quality

Code MUST be formatted, lint-clean, and type-checked before consideration complete.
When the repository defines npm scripts `format`, `lint`, and `typecheck`, agents and
contributors MUST run this quality gate after any code modification. Consistency in
style and types reduces defects and keeps the codebase maintainable.

**Rationale**: Automated checks are the baseline for merge readiness; human review
focuses on design and intent when machines enforce consistency.

### II. Testing Standards

Agents MUST follow a test-first (TDD) process: tests are written or selected,
approved where applicable, then implementation follows. Tests MUST be meaningful:
avoid writing unit tests that only assert non–business-logic behavior (e.g., trivial
getters or framework glue). Prefer fewer, high-value tests over many low-value ones;
a single end-to-end (E2E) test that validates a user-facing outcome can be more
meaningful than many unit tests that do not. Focus unit and integration tests on
business logic, contracts, and critical paths.

**Rationale**: TDD drives design and safety; test meaning prevents illusion of
coverage and keeps suites fast and maintainable.

### III. User Experience Consistency

User-facing behavior, APIs, and documentation MUST be consistent across the product.
Patterns for naming, error handling, and interaction flows MUST be applied uniformly
unless a documented exception exists. Changes that affect public API or documented
behavior require explicit consideration of backward compatibility and user impact.

**Rationale**: Consistency reduces cognitive load, prevents integration surprises,
and makes the system predictable for users and dependents.

## How Principles Guide Technical Decisions

These principles are binding for technical and implementation choices:

- **Code Quality** guides tooling (formatters, linters, type systems), CI gates, and
  local workflow. Any new code path or dependency MUST satisfy the quality gate.
- **Testing Standards** guide what to test first, what to test at all, and the
  balance between unit, integration, and E2E tests. When in doubt, prefer tests
  that assert observable outcomes over implementation details.
- **User Experience Consistency** guides API design, error messages, and
  documentation. Divergence from established patterns MUST be justified and
  documented.

Violations or exceptions MUST be documented (e.g., in plan Complexity Tracking or
ADR) and reviewed. The constitution supersedes ad-hoc preferences.

## Quality Gates & Agent Requirements

- **After code modification**, agents MUST run the code quality gate when the
  project provides it: `npm run format`, `npm run lint`, `npm run typecheck` (or
  equivalent). Fix any failures before marking the change complete.
- **Test-first**: For feature work, tests (unit, integration, or E2E as appropriate)
  MUST be added or updated first where the constitution and spec require tests;
  avoid meaningless unit tests for non–business-logic code; prefer meaningful E2E
  tests when they better capture requirements.
- **Compliance**: Plans, specs, and task lists MUST align with these principles.
  Constitution Check in implementation plans MUST reference this document and
  verify gates and testing discipline.

## Governance

- **Authority**: This constitution supersedes conflicting local or informal
  practices. When spec, plan, or tasks conflict with a principle, the principle
  wins unless the constitution is amended.
- **Amendments**: Changes require updating this file, incrementing the version
  per semantic versioning (MAJOR: incompatible removals/redefinitions; MINOR: new
  principles or material guidance; PATCH: clarifications, typos), and updating
  the Sync Impact Report. Dependent templates and commands MUST be reviewed for
  alignment.
- **Compliance**: All PRs and implementation work MUST verify compliance with
  principles and quality gates. Analysis and review processes (e.g. speckit.analyze)
  treat constitution violations as CRITICAL.

**Version**: 1.0.0 | **Ratified**: 2025-02-05 | **Last Amended**: 2025-02-05
