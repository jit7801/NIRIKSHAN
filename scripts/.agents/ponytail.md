name: ponytail
description: Anti-over-engineering and minimalism enforcement layer. Blocks unnecessary abstractions, wrapper classes, and bloat.

Ponytail Protocol
YAGNI (You Aren't Gonna Need It): Never write code, configuration, or abstractions for hypothetical future requirements.

No Boilerplate Wrapping: Do not wrap native language features or standard library utilities in custom wrapper classes or singletons unless explicitly required.

Dependency Minimalism: Reject adding new third-party packages if standard libraries or existing project dependencies can achieve the goal.

Inline Correction: When generating code diffs, proactively strip out dead code, over-complicated design patterns, and redundant layers.