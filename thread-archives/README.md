# HomeOps Thread Archives

This directory contains all Claude conversation threads organized by sprint and stage.

## Current Status
- **Project**: HomeOps
- **Current Sprint**: 1
- **Current Stage**: 4 (Sprint Planning)
- **Last Updated**: 2025-08-24

## Archive Organization

Threads are organized by sprint and BMAD stage:
- Development sessions (Stages 4-5) per sprint
- Testing sessions (Stage 6) per sprint
- Deployment sessions (Stages 7-8) per sprint
- Retrospective sessions (Stage 9) per sprint

## File Guide

### Sprint 1 Files
- Development (Stages 4-5): sprint-1-development.md
- Testing (Stage 6): sprint-1-testing.md (to be created)
- Deployment (Stages 7-8): sprint-1-deployment.md (to be created)
- Retrospective (Stage 9): sprint-1-retrospective.md (to be created)

## Quick Copy Headers

When adding new sessions, use these headers:

### New Session Header
```
### Session N - [YYYY-MM-DD HH:MM]
[Paste thread here]
---END SESSION N---
```

### New Story Section
```
### Story US-XXX: Story Title
#### TO Analysis Session - [Date Time]
[Paste thread here]
---END TO SESSION---

#### Backend Track - [Date Time]
[Paste thread here]
---END BACKEND SESSION---

#### Frontend Track - [Date Time]
[Paste thread here]
---END FRONTEND SESSION---

#### Testing Track - [Date Time]
[Paste thread here]
---END TESTING SESSION---
```

## Usage Instructions

1. **After Each Session**: Copy the entire thread and paste into appropriate section
2. **Update Timestamps**: Replace [Date Time] with actual timestamps
3. **Mark Completions**: Update session numbers and status
4. **Regular Commits**: Commit archives to git regularly

## Archiving Best Practices

- Archive immediately after session completion
- Include full context, not just final outputs
- Preserve error messages and debugging steps
- Note any important decisions or changes
- Keep formatting consistent

## Search Tips

To find specific content:
- Use git grep for searching across all archives
- Search by story ID (US-XXX)
- Search by date (YYYY-MM-DD)
- Search by technology or component names

---

**Note**: These archives are essential for project learning and future reference. Please maintain them diligently!