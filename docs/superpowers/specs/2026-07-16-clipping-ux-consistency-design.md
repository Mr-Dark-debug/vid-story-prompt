# Clipping UX Consistency Design

## Objective

Make the clipping workflow predictable and polished by preventing tier-invalid selections, replacing raw service errors with actionable dialogs, simplifying the YouTube source presentation, making thumbnails resilient, adding safe job deletion, standardising value-selection controls, and removing the detached-card treatment from authentication pages.

## Design principles

- Prevent invalid choices before submission instead of explaining avoidable backend failures afterward.
- Preserve plan transparency: higher-tier capabilities remain visible but cannot be selected on the current tier.
- Use one accessible interaction primitive for each semantic role: Select for choosing a value, Dropdown Menu for actions, Dialog for status and guidance, and Alert Dialog for destructive confirmation.
- Keep product copy focused on user outcomes. Worker implementation details do not belong in the source-selection interface.
- Reuse Vidrial semantic tokens and the existing logo and typography rules.

## Tier-aware clip count

The new-job loader supplies the current plan and its entitlement limits to the wizard. Requested clip count becomes a Radix-based dropdown rather than a numeric input.

Options are 1, 2, 3, 4, 5, 10, 20, and 50 clips. Values up to the current plan maximum are enabled. Higher values remain visible, disabled, and labelled with the first plan that unlocks them. Free can select up to 5, Creator up to 20, and Pro up to 50.

The wizard validates source duration, requested clip count, concurrency, and known usage before submission when that information is available. Server enforcement remains authoritative. If a stale client or concurrent request still reaches a plan failure, the UI maps it to a structured, user-facing dialog.

## Reusable select system

Enhance `src/components/ui/select.tsx` to match Vidrial's semantic palette, spacing, focus treatment, and responsive portal behaviour. Add a higher-level `SelectField` component that owns the label, optional hint, trigger, content, options, disabled state, plan badge, and validation message.

Replace all native value-selection `<select>` controls across the application. Existing action dropdown menus, command palettes, and the searchable source directory retain their specialised primitives because they do not represent single-value form selection.

## Reusable status dialogs

Add a reusable status-dialog component built on the existing Radix Dialog primitives. It supports success, pending, warning, error, plan-limit, and destructive visual variants. Each variant uses a restrained tinted header glow, a circular status icon, concise title and description, and one or two explicit actions based on the supplied content.

The component never embeds product-specific copy. Callers provide the title, description, primary action, secondary action, and optional supporting detail. Destructive operations continue to use Alert Dialog semantics through a matching reusable confirmation wrapper.

The clipping wizard maps backend errors to typed presentation data:

- `plan_limit_exceeded`: explain the exact per-job source or clip constraint.
- `insufficient_usage`: show remaining monthly source time and link to usage or upgrade options.
- `concurrent_job_limit_exceeded`: explain the active-job limit and link to existing jobs.
- invalid or unavailable source failures: explain what must change without exposing internal error codes.
- unknown failures: show a safe retry message.

For a Free user requesting too many clips, the dialog offers “Use 5 clips” and “View upgrade options.” The billing route currently records upgrade interest rather than completing payment, so the copy must not claim an immediate purchase.

## Simplified YouTube source step

Keep the source picker as the single provider selector. Inside the selected YouTube section, show only:

- the YouTube URL field and loading/error feedback;
- a compact media preview containing thumbnail, title, channel, and duration;
- the existing rights confirmation required by the job workflow.

Remove the repeated provider heading, availability badge, provider description, channel automation link, metadata statistics grid, and “Ready for secure worker import” explanation.

The thumbnail component tries the official metadata URL first, then the deterministic `hqdefault.jpg` URL for the video ID, and finally a branded neutral placeholder. It exposes meaningful alternative text and does not leave a broken-image glyph.

## Job deletion

Add a server function that verifies the current session and calls the existing `request_job_deletion` RPC. The jobs dashboard presents an accessible delete action on each job row without nesting interactive controls inside a link.

Deletion opens the reusable destructive confirmation dialog. Confirmation cancels active tasks, marks the job as expiring, queues private asset deletion, refreshes the jobs list, and shows success or failure feedback. The job row becomes temporarily disabled while deletion is running.

## Authentication layout

Remove the centred rounded card, border, and heavy shadow around the shared authentication shell. Desktop remains a direct full-height two-column page: brand story on the left and the form surface on the right. Mobile collapses to a single form column with compact brand identification and no detached white panel.

Login, signup, password recovery, password reset, and email verification continue to use the shared shell so the change is consistent across every authentication route.

## Testing and release

- Unit-test entitlement option states and error-to-dialog mappings.
- Component-test the reusable select, status dialog, thumbnail fallback, and job-delete confirmation.
- Update wizard tests for tier-aware clip counts and simplified metadata.
- Test the job-deletion server wrapper and existing RPC integration behaviour.
- Run typecheck, lint, the complete application suite, worker checks, and production build.
- Run Playwright smoke tests for authentication layout, Free clip selection, plan-limit recovery, thumbnail rendering, and job deletion.
- Push normal commits to `main`, deploy Vercel and the auto-deployed Render worker as applicable, and verify production health without rewriting published history.
