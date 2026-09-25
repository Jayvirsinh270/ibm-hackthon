# X-Ray — Hackathon Strategy

## Objective

Win by clearly demonstrating four things to judges in under 6 minutes:

1. **A real technical problem** that every developer has experienced
2. **A technically impressive solution** using IBM Bob and IBM watsonx.ai
3. **Immediate visual clarity** — judges understand the product in 30 seconds
4. **Business value** — a clear "before vs. after" for a development team

---

## The Core Narrative

Do NOT present X-Ray as "AI that analyzes code."

Present it as:

> **"An X-ray machine for software. Before a surgeon operates, they take an X-ray.
> Before a developer changes software, X-Ray shows them exactly what's connected — and what could break."**

This analogy should be in the opening sentence of the presentation and in the UI itself.

---

## Judging Criteria Alignment

| Criterion | How X-Ray Addresses It |
|---|---|
| **Technical merit** | Real AST parsing, graph algorithms, AI abstraction layer, modular architecture |
| **Use of IBM technology** | IBM Bob throughout development + IBM watsonx.ai for AI layer |
| **Business value** | Reduces change risk, debugging time, and regressions for every developer |
| **Originality** | Not "AI that writes code" — a change-impact intelligence tool with graph visualization |
| **Presentation quality** | Interactive visual demo; immediate "wow" moment when graph appears |
| **Completeness** | Full working end-to-end flow: upload → graph → impact → AI explanation |

---

## What Makes X-Ray Stand Out

### 1. The Visual Moment

When the dependency graph renders for the first time, judges should have an immediate reaction:
"I can see exactly how this software is connected."

The graph must be:
- Visually clean (not a hairball)
- Color-coded so the eye immediately understands node types
- Responsive to interaction (hover, click)
- Dramatic when impact is triggered (affected nodes light up)

**This visual is the product's strongest selling point. Invest time in making it impressive.**

### 2. The Before/After Clarity

Judges respond to contrast. The demo must show clearly:

| Without X-Ray | With X-Ray |
|---|---|
| Developer guesses what might break | Developer sees exactly what's connected |
| Manual file-by-file investigation | Instant graph of all relationships |
| Hope the tests catch everything | X-Ray shows which tests are relevant |
| No migration plan | AI generates a structured change plan |
| Unclear risk | Explicit risk badge: 🔴 HIGH |

### 3. Deterministic + AI — Two Layers of Trust

The explicit distinction between deterministic analysis and AI suggestions demonstrates technical
maturity. Judges who are engineers will appreciate that X-Ray does not pretend AI knows facts it
doesn't know.

**Message:** "We're honest about what the tool can and cannot prove."

### 4. IBM Bob Integration Story

Do not just say "we used Bob." Tell the story:
- Bob helped design the architecture
- Bob generated the AST parser implementation
- Bob wrote the prompt builder
- Bob reviewed the security controls
- Bob helped write the tests

Show one real example of a Bob interaction during development (a screenshot or live demo of
Bob in the IDE). This demonstrates thoughtful, integrated use of AI tooling — not just
"we asked it to write the whole thing."

---

## Presentation Structure (10-Minute Slot)

### Slide 1 — The Problem (1 minute)

Title: **"Every developer has broken something they didn't know was connected."**

Show the example: "Replace the authentication system" → unexpected cascade of breakage.
Keep it concrete and relatable. Judges have experienced this.

### Slide 2 — The Solution (30 seconds)

One sentence. One image.

> "X-Ray analyzes your codebase and shows you exactly what will be affected before you change it."

Show a still image of the dependency graph.

### Slide 3 — Live Demo (5-6 minutes)

Follow the script from [`12-demo-scenario.md`](./12-demo-scenario.md) exactly.

Key moments to hit:
- Upload → "X-Ray is reading the actual code"
- Graph appears → pause for visual impact
- Click `auth/login.py` → impact highlights
- Risk badge → read the factors aloud
- AI explanation → "IBM watsonx.ai reasoning about the structure"

### Slide 4 — Architecture (1 minute)

Show the architecture diagram from [`05-architecture.md`](./05-architecture.md).

Highlight:
- The AI abstraction layer ("swappable, isolated")
- The modular analysis pipeline ("each component has one job")
- IBM Bob's role ("our development partner throughout")

### Slide 5 — Business Value (30 seconds)

> "Every team that ships software has experienced a breaking change they didn't anticipate.
> X-Ray reduces that risk. It doesn't eliminate bugs — it makes the unknown, known."

Close with the product name and tagline:

> **X-Ray — See what could break before you break it.**

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| watsonx.ai unavailable during demo | Mock adapter pre-loaded with a quality AI response |
| Demo machine has no internet | All analysis runs locally; only AI requires internet |
| Graph renders slowly on demo hardware | Pre-analyzed sample repo; graph loads from cache |
| App crashes during demo | Pre-prepared screenshot walkthrough as backup |
| Judge asks about unsupported languages | "Python-first MVP; designed for extensibility — adding JS is Phase 2" |
| Judge asks about accuracy of call analysis | "Call resolution is best-effort and clearly labelled; import analysis is definitive" |

---

## What NOT to Say

| Don't say | Say instead |
|---|---|
| "AI that predicts bugs" | "AI that explains detected structural connections" |
| "It finds all the bugs" | "It maps what's connected so you can make an informed decision" |
| "It can analyze any language" | "Python-first with an extensible architecture" |
| "It automatically fixes the code" | "It generates a migration plan — the developer executes it" |
| "It's 100% accurate" | "Deterministic analysis is factual; AI analysis is clearly labelled as suggestions" |

---

## IBM Bob Development Story

During the presentation, briefly show how Bob was used. Suggested talking points:

> "We used IBM Bob as our development partner throughout this project.
> Bob helped us design the modular architecture, implement the AST parser,
> build the AI abstraction layer, and review our security controls.
>
> But more importantly — building X-Ray with Bob demonstrated exactly the kind of
> partnership X-Ray is designed to support: a developer working with an AI partner to
> understand and navigate a complex system safely."

This ties the product concept to the development process in a memorable way.

---

## Final Checklist Before Demo

- [ ] Sample repository pre-uploaded and analyzed in the running app
- [ ] watsonx.ai API key configured and tested
- [ ] Mock adapter fallback ready
- [ ] Graph visual looks impressive (layout algorithm chosen, colors look good)
- [ ] Risk badge shows 🔴 HIGH for auth/login.py
- [ ] AI explanation is clear and well-structured
- [ ] "Deterministic" vs "AI-generated" labels are visible in UI
- [ ] App starts cleanly from a fresh state
- [ ] Demo machine screen resolution set for presentation
- [ ] Demo script rehearsed at least twice
- [ ] Backup screenshots ready
