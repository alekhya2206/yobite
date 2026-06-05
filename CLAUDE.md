# YoBite

A mobile-web PWA: scan/paste a local restaurant's menu, pick your goal + what you ate
today, get a ranked "order this" with reasons. A ranker, not a calorie calculator.
Built for the local restaurant where the diner is actually confused, not the chain they
already know.

## Design System
Always read DESIGN.md before making any visual or UI decision.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
North star: "The menu should not flesh in my mind" — fast, calm, decisive; presence over engagement.
In QA or review, flag any code that doesn't match DESIGN.md.

## Skill routing
When the user's request matches an available skill, invoke it via the Skill tool. When in doubt, invoke the skill.
- Product ideas/brainstorming → /office-hours
- Strategy/scope → /plan-ceo-review
- Architecture → /plan-eng-review
- Design system/plan review → /design-consultation or /plan-design-review
- Visual polish → /design-review
- Bugs/errors → /investigate
- QA/testing → /qa or /qa-only
- Ship/deploy/PR → /ship or /land-and-deploy
