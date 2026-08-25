---
name: notion-kanban-triage
description: Inspect Notion project documents and a task database, choose the next actionable work, and update Kanban order, status, or assignee when the user asks. Use for Notion-backed backlog triage and work selection; do not use for local-only TODO lists.
---

# Notion Kanban Triage

Turn the live Notion project state into a short, executable work queue. Preserve existing cards and database conventions.

## Determine the requested mode

- **Recommend**: read the project and Kanban, then report the best next task and why. Do not mutate Notion.
- **Organize**: create or update an ordered queue or view when the user asks to list, sequence, or prepare work on the board.
- **Assign/start**: update assignee or status when the user explicitly asks to assign or begin work.

A request to decide what to work on does not authorize assignment or status changes. A request to assign, list on the Kanban, or make the board ready does authorize the corresponding Notion updates.

## Inspect live context

1. Use Notion search with one literal query per call and `filters: {}`. Search separately for the project/spec and task/Kanban database.
2. Fetch every candidate before choosing it. If several plausible project or task databases remain, ask which one to use.
3. Fetch the database before querying or updating it. Record its `collection://` data source ID, exact property names, valid options, views, and relation fields.
4. Query the live task rows needed for the decision. Include title, status, priority, phase or milestone, type, assignee, blockers, parent, and source when those fields exist.
5. Fetch `self` when “저”, “나”, “me”, or the current user should be assigned. Store the returned user ID; do not infer a person from a display name.

If the Notion tools are unavailable, stop and ask the user to connect the Notion app. If read access succeeds and write access fails, report the recommendation and the unapplied mutations separately.

## Select the next task

Consider the following evidence in order:

1. Existing `In Progress` work assigned to the target person should usually be finished first.
2. A `Ready` task with no unresolved blocker is actionable.
3. Follow explicit priority and phase ordering from the database.
4. Prefer work that unlocks several downstream tasks or proves the product's critical user flow.
5. Prefer a task that can be completed and verified independently in roughly one or two working days.
6. Use source specs and acceptance criteria to break ties.

Treat missing dependency data as uncertainty. Do not claim a task is unblocked merely because its status says `Ready` when its blocker relation points to unfinished work. Keep priority and dependency reasoning separate.

Return one primary recommendation. Mention at most two follow-up tasks when that helps the user continue without another triage pass.

## Organize the Kanban

- Update existing cards instead of creating duplicates. Match by stable page URL first and normalized title second.
- Preserve the database's property names, status vocabulary, phase names, and current view conventions.
- Use an existing order, sequence, or rank property when available.
- If no sortable order property exists and the user asks for a visible work sequence, add a compact prefix such as `FE-01 ·` while preserving the original title. Do not prefix epics or feature containers unless they are part of the requested queue.
- Set a phase, source, assignee, or blocker relation only when supported by evidence.
- Keep future tasks in their current status unless the user asked to change workflow state. Mark only the selected actionable task `In Progress` when the user explicitly asks to start it.
- Create a filtered board or table view only when it materially helps the requested queue. Filter to the requested scope, show decision-relevant fields, and sort by the explicit order.

When creating new cards is necessary, size each card to a single testable deliverable. Include an objective and concrete acceptance criteria derived from the source document. Link the source spec when the schema supports it.

## Apply changes safely

- Send database page updates with exact schema property names and supported option values.
- Use arrays of page URLs or IDs for relations and arrays of stable user IDs for people properties.
- Do not overwrite unrelated properties or page content.
- Avoid assigning another person when the user has not named them or authorized a team-wide allocation.
- Do not create invented work when source documents or board data are insufficient. Record the missing decision as a recommendation or clarification.

## Verify and report

Query the affected rows after all writes and confirm the title/order, status, phase, assignee, source, and blockers that were changed. Fetch or inspect a newly created view to confirm its filter, grouping, visible properties, and sort.

Report:

- the selected next task and the reason;
- the final ordered queue;
- the exact Notion database or view changed;
- assignments and statuses applied;
- blockers or assumptions that remain.

Use clickable Notion links for the board and selected task when available.
