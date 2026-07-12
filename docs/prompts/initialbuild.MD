
Build a complete, premium, responsive web application and marketing website for a browser-first, I-assisted video-editing product.

Use the temporary working name “Vidrial”. Keep the product name, logo text, taglines and brand configuration centralised so they can be renamed globally later. Do not make trademark, customer-count, security-certification or performance claims that have not been verified.

Before implementing anything:

1. Analyse this complete specification.
2. Create an implementation plan organised into clear phases.
3. Inspect the project before modifying existing files.
4. Use focused subagents where useful for information architecture, UI consistency, accessibility and code review.
5. Build the project in logical stages rather than generating one enormous page and hoping civilisation forgives it.
6. Create and maintain the required documentation files described below.
7. After each major phase, verify routing, responsive behaviour, accessibility, empty states, loading states and errors.

## 1. Product concept

Vidrial is a project-aware AI video editor.

Users upload their own videos, audio files, images, subtitles and scripts. Vidrial analyses the media, organises it into a searchable project library and lets users describe edits through natural language.

The AI should propose a transparent edit plan, allow the user to accept or reject individual operations, and then create a fully editable timeline. Users must also be able to edit manually.

The product is intended for:

* YouTube creators
* Vloggers
* Podcasters
* Course creators
* Freelance editors
* Social-media creators
* Founders making product demos
* Small marketing teams

The primary promise is:

“Your footage. One prompt. A finished first cut.”

Supporting copy:

“Upload raw clips, audio and images. Describe the story you want. Vidrial understands your project, proposes an edit plan and builds a timeline you can still control.”

The three central product principles are:

1. Understand every asset.
2. Plan before editing.
3. Keep every result editable.

Do not position Vidrial as a fully autonomous replacement for professional editors. Position it as a fast, controllable co-editor that creates the first cut and handles repetitive work.

## 2. Scope of this build

Create a polished, functional product website and an interactive application prototype.

All routes, navigation, forms, modals, filters, dropdowns, tabs and primary interactions must work.

Where a real video-processing, storage, authentication, payment or AI backend has not been configured:

* Create a clean service abstraction.
* Use realistic local demo data and deterministic mock processing.
* Clearly distinguish demo or simulated states.
* Never pretend a real upload, payment, AI request or render succeeded when no backend handled it.
* Do not place secrets in frontend code.
* Do not hardcode provider-specific infrastructure throughout the components.
* Keep the implementation ready for later backend integration.

Include a complete seeded demo project so the user can explore the editing workspace immediately.

## 3. Visual direction

Create an original visual identity. Do not clone ChatCut, Descript, Kapwing, Captions, VEED, Linear, Notion or any other existing product.

The overall feeling should be:

* Premium
* Editorial
* Creative
* Calm
* Technically capable
* Easy for non-editors
* Modern without appearing like a generic AI landing-page template

Build light mode first and make it excellent. Structure design tokens so dark mode can be added later, but do not spend this phase implementing dark mode.

Avoid:

* Overused purple-to-blue AI gradients
* Excessive glassmorphism
* Neon cyberpunk styling
* Constant glowing borders
* Giant rounded cards everywhere
* Decorative elements that reduce readability
* Fake testimonials
* Fake company logos
* Meaningless 3D blobs
* Excessive animation
* Walls of tiny text
* Emoji as interface icons

Choose a restrained but distinctive palette.

Use:

* A warm or neutral background
* High-contrast text
* One memorable primary accent
* One secondary functional accent
* Semantic success, warning, danger and information colours
* Subtle borders and layered neutral surfaces
* Excellent typography and spacing
* Purposeful motion

Select a contemporary, highly readable font pairing. Use one display style for major marketing headlines and a neutral interface style for the application. Avoid making every word bold.

The logo can initially be a clean typographic wordmark plus a simple abstract mark inspired by a playhead, timeline cut or connected video frames.

Create a visual device that can be reused throughout the website, such as an abstract editable timeline ribbon made from frames, waveforms and transcript fragments.

## 4. Design system

Create a documented design system before duplicating UI patterns.

Define tokens for:

* Colours
* Typography
* Font sizes
* Font weights
* Line heights
* Spacing
* Grid
* Container widths
* Radii
* Borders
* Shadows
* Focus rings
* Icon sizes
* Motion durations
* Easing
* Layering and z-index
* Responsive breakpoints

Use semantic token names rather than raw visual names.

Examples:

* surface-page
* surface-panel
* surface-raised
* text-primary
* text-secondary
* border-subtle
* action-primary
* status-success
* timeline-selected
* focus-visible

All pages and components must use design tokens. Do not scatter arbitrary colours, shadows, font sizes or spacing values through the code.

Create reusable components for:

* Buttons and button groups
* Icon buttons
* Inputs
* Text areas
* Select controls
* Comboboxes
* Search
* Checkboxes
* Radio controls
* Switches
* Tabs
* Tooltips
* Dropdown menus
* Context menus
* Dialogs
* Drawers
* Toasts
* Banners
* Cards
* Tables
* Pagination
* Breadcrumbs
* Avatars
* Badges
* Progress indicators
* Skeleton loaders
* Empty states
* Error states
* File upload
* Media cards
* Transcript segments
* Timeline clips
* Timeline tracks
* AI messages
* AI operation cards
* Usage meters
* Pricing cards

Each reusable component must have consistent variants, states and accessibility behaviour.

Create a dedicated internal route at `/design-system` showing the tokens, components, states and responsive behaviour. It may be excluded from production navigation.

## 5. Responsive behaviour

The public website must work beautifully on:

* Small phones
* Large phones
* Tablets
* Laptops
* Desktops
* Wide monitors

The application dashboard and project-management views must be fully responsive.

The editing workspace is desktop-first:

* Desktop: full editor with resizable panels and timeline.
* Tablet: simplified workspace with panels opening as drawers or tabs.
* Mobile: project overview, media review, transcript review, AI chat, comments and export monitoring.
* Do not squeeze a professional multi-track timeline into a narrow phone screen.
* On mobile, explain that detailed timeline editing is optimised for desktop while still allowing useful review and AI instructions.

Navigation, dialogs, forms and tables must not overflow horizontally.

## 6. Public sitemap

Create these public routes:

* `/`
* `/features`
* `/how-it-works`
* `/use-cases`
* `/use-cases/youtube`
* `/use-cases/podcasts`
* `/use-cases/short-form`
* `/use-cases/courses`
* `/use-cases/product-demos`
* `/pricing`
* `/security`
* `/ai-transparency`
* `/roadmap`
* `/changelog`
* `/docs`
* `/docs/getting-started`
* `/docs/uploading-media`
* `/docs/ai-editor`
* `/docs/timeline`
* `/docs/exporting`
* `/contact`
* `/login`
* `/signup`
* `/forgot-password`
* `/reset-password`
* `/verify-email`
* `/terms`
* `/privacy`
* `/cookies`
* `/acceptable-use`
* `/copyright`
* `/imprint`
* `/status`
* `/404`

Create a proper XML sitemap, robots configuration, canonical metadata, social-preview metadata and structured data where appropriate.

## 7. Application sitemap

Create these authenticated routes:

* `/app`
* `/app/projects`
* `/app/projects/new`
* `/app/projects/:projectId`
* `/app/projects/:projectId/editor`
* `/app/projects/:projectId/media`
* `/app/projects/:projectId/transcript`
* `/app/projects/:projectId/versions`
* `/app/projects/:projectId/exports`
* `/app/templates`
* `/app/uploads`
* `/app/usage`
* `/app/billing`
* `/app/settings/profile`
* `/app/settings/preferences`
* `/app/settings/notifications`
* `/app/settings/privacy`
* `/app/settings/integrations`
* `/app/help`
* `/app/feedback`

Protect authenticated routes and preserve the intended destination when redirecting users to login.

## 8. Marketing navigation

Desktop navigation:

* Logo
* Product
* Use cases
* How it works
* Pricing
* Resources
* Log in
* Start editing

Use grouped dropdowns for Product, Use cases and Resources.

Mobile navigation must use an accessible menu with focus management, clear grouping and the same destinations.

Keep the main navigation visible but unobtrusive. Apply a subtle background or border after scrolling.

## 9. Homepage

### Announcement bar

Use a restrained announcement:

“Private beta: build your first cut with AI, then edit every decision.”

Include a small link to the roadmap.

### Hero

Eyebrow:

“AI video editing that understands your project”

Headline:

“Your footage. One prompt. A finished first cut.”

Body:

“Upload raw clips, audio and images. Tell Vidrial what you are making. It finds the right moments, proposes the edit and builds a timeline you can still control.”

Primary CTA:

“Start a project”

Secondary CTA:

“See how it works”

Under the CTAs:

“No credit card required. Your projects are private by default.”

Create a high-quality interactive product visual showing:

* A media library
* A video preview
* An AI conversation
* A proposed edit plan
* A timeline
* A visible before-and-after duration change

The visual must resemble a functioning application rather than a decorative screenshot.

### Trust principles

Use three concise blocks:

“Understands every clip”
“Search your footage by speaker, scene, action, transcript or tag.”

“Plans before it edits”
“Review the clips, operations, duration and estimated usage before applying major changes.”

“Everything stays editable”
“Adjust the transcript, timeline, captions and audio manually at any point.”

### Workflow section

Heading:

“From an untidy folder to an editable timeline”

Four steps:

1. Add your footage
2. Let Vidrial analyse it
3. Describe the video
4. Review, edit and export

Use a visual progression instead of four generic marketing cards.

### Prompt examples

Create an interactive command composer with selectable examples:

* “Create a six-minute YouTube first cut. Keep the strongest explanations and remove repeated takes.”
* “Use the exterior shots as B-roll when I discuss arriving at the location.”
* “Remove filler words, but keep natural pauses.”
* “Turn this interview into three vertical clips with different hooks.”
* “Add clean captions and lower the music whenever someone speaks.”
* “Make the pacing calmer and restore the section about pricing.”

Changing an example should update a mock edit-plan preview.

### Feature narrative

Present features in meaningful groups:

#### Understand the project

* Transcription
* Speaker identification
* Scene detection
* Automatic tags
* Semantic search
* Audio and quality analysis

#### Create the first cut

* Natural-language requests
* Edit-plan preview
* Take selection
* Silence and filler removal
* Transcript editing
* Uploaded B-roll placement

#### Refine manually

* Multi-track timeline
* Caption editor
* Audio controls
* Reframing
* Transitions
* Version history

#### Deliver

* Aspect-ratio variants
* Export presets
* Render monitoring
* Project sharing
* Future XML export

### Uploaded-assets-first section

Headline:

“Use what you already filmed.”

Copy:

“Vidrial searches your project before suggesting stock or generated footage. Your story should look like your story.”

Show a semantic media search such as:

“sunset exterior with no people”

Return realistic asset cards with confidence, duration and tags.

### Explainable AI section

Headline:

“An editor should show its work.”

Demonstrate an operation list:

* Remove 14 long pauses
* Use take 3 instead of take 1
* Insert `station-wide.mov` from 00:12 to 00:19
* Add caption preset “Clean Editorial”
* Reduce music by 8 dB under dialogue
* Create 16:9 and 9:16 versions

Each operation must support:

* Preview
* Accept
* Reject
* Edit
* Explanation

### Manual control section

Show that transcript, timeline and AI chat modify the same project.

Copy:

“Ask for the first cut. Keep control of the final one.”

### Use cases

Show five useful workflows:

* YouTube videos
* Video podcasts
* Short-form clips
* Online lessons
* Product demos

Each should link to a dedicated page.

### Pricing preview

Show Free, Creator and Pro.

Include a clear explanation:

“Editing uses source minutes. Generated video, music and voice use separate generation credits. Vidrial shows the cost before an expensive operation.”

### Security and privacy

Include:

* Private by default
* Customer-controlled deletion
* No training on uploads by default
* Clear retention controls
* Expiring media access
* AI-generated content disclosure

Do not display certification badges unless actually verified.

### Final CTA

Headline:

“Your next edit can start with a sentence.”

Body:

“Bring the footage. Describe the story. Keep the timeline.”

CTA:

“Create your first project”

## 10. Features page

Create a detailed feature page organised by workflow rather than a giant icon grid.

Include:

* Project media intelligence
* AI edit planning
* Transcript editing
* Timeline editing
* Caption creation
* Audio cleanup
* B-roll search and placement
* Aspect-ratio adaptation
* Version history
* Export management

Each feature section should contain:

* The user problem
* What Vidrial does
* A concrete example
* A visual demonstration
* Current availability label: Available, Beta or Planned

Do not claim planned features are already available.

## 11. How it works page

Explain the system honestly:

1. Media is uploaded or imported.
2. Preview files and project metadata are created.
3. Speech, scenes and media contents are analysed.
4. Users provide a goal or editing instruction.
5. Vidrial proposes structured operations.
6. The user confirms or changes the plan.
7. The non-destructive timeline is updated.
8. The result can be refined manually and exported.

Include a privacy callout explaining that originals remain unchanged and projects are private by default.

## 12. Pricing page

Create three plans:

### Free

* $0
* 3 active projects
* 60 source minutes each month
* 2 GB storage
* 720p
* Watermarked exports
* One watermark-free trial export
* Core transcription and cleanup

### Creator

* $18 monthly
* $15/month when billed annually
* 600 source minutes
* 50 GB storage
* 1080p
* No watermark
* AI edit plans
* Captions
* Uploaded B-roll
* Version history
* Commercial use

Mark this as “Recommended”.

### Pro

* $39 monthly
* $32/month when billed annually
* 1,800 source minutes
* 250 GB storage
* 4K
* Multicam when available
* Brand kits
* Translation when available
* Advanced audio
* XML export when available
* Priority processing

Add:

* Monthly and annual toggle
* Exact annual total
* Comparison table
* Source-minute explanation
* Generation-credit explanation
* Top-up explanation
* Billing FAQ
* Honest availability labels
* No fake checkout if payments are not connected

When checkout is unavailable, use “Join paid-plan waitlist” or “Notify me” instead of pretending to charge.

## 13. Authentication

Create polished pages for:

* Sign up
* Log in
* Forgot password
* Reset password
* Email verification

Signup fields:

* Full name
* Email
* Password
* Confirm password
* Terms and privacy acceptance
* Optional product-update consent as a separate unchecked control

Include password visibility, strength guidance, validation and accessible errors.

After signup, present an onboarding flow:

1. Welcome
2. Main content type
3. Typical video length
4. Preferred output format
5. Editing experience
6. Create first project or explore demo

Allow users to skip non-essential onboarding.

## 14. Dashboard

The application dashboard should feel focused and professional.

Header:

* Workspace switcher
* Search
* Usage indicator
* Help
* Notifications
* Profile menu

Main content:

* Welcome and primary “New project” button
* Recent projects
* Continue editing
* Upload status
* Recent exports
* Usage overview
* Demo project for new users

Project cards must show:

* Thumbnail
* Name
* Duration
* Aspect ratio
* Last edited
* Processing state
* Export state
* Optional tags
* Context menu

Filters:

* All
* Draft
* Analysing
* Ready
* Exporting
* Completed
* Archived

Sorting:

* Last edited
* Created
* Name
* Duration

Include useful empty, loading and error states.

## 15. New-project wizard

Step 1: Project details

* Project name
* Description
* Intended output
* Aspect ratio
* Target duration
* Language

Step 2: Add media

Support:

* Drag and drop
* Multiple files
* User-selected folder upload
* Video
* Audio
* Images
* Subtitle files
* Text documents
* Future cloud imports shown as Planned only

Display supported formats and realistic limits.

Step 3: Organise

Allow:

* Automatic grouping by folder
* Manual tags
* Roles such as A-roll, B-roll, music, voiceover, image, reference and exclude
* Rename asset display names
* Add notes

Step 4: Editing brief

Ask:

* What are you creating?
* Who is it for?
* Desired duration
* Desired pace
* Important sections
* Material to avoid
* Caption preference
* Output formats

Provide a free-text instruction area and prompt examples.

Step 5: Review

Show:

* Project settings
* Files
* Estimated analysis usage
* Privacy reminder
* “Create and analyse project”

## 16. Media analysis experience

Create a trustworthy processing view.

Stages:

* Uploading
* Validating files
* Creating previews
* Extracting audio
* Transcribing speech
* Detecting scenes
* Generating tags
* Building project search
* Ready

For each stage show:

* Current state
* Progress
* Completed items
* Failed items
* Retry action
* Cancel action where safe

The interface must continue to be useful if one file fails.

Never show fake hyper-specific percentages unless the mock process actually controls them. Indeterminate operations should use an indeterminate indicator and clear status text.

## 17. Project media library

Provide grid and list views.

Asset information:

* Thumbnail
* Filename
* Display name
* Type
* Duration
* Resolution
* Frame rate
* File size
* Speakers
* Tags
* Analysis status
* Usage on timeline
* Notes

Filters:

* Media type
* Speaker
* Role
* Tag
* Used or unused
* Quality warning
* Date
* Duration

Search should support natural-language examples such as:

* “outdoor clips at sunset”
* “Prashant explaining the problem”
* “quiet room tone”
* “shots with the shopping cart”
* “clips not yet used”

Asset detail drawer:

* Preview
* Transcript
* Technical metadata
* Tags
* Detected scenes
* Notes
* Timeline occurrences
* Set in and out points
* Add to timeline
* Exclude from AI
* Delete

Include bulk tagging and bulk role assignment.

## 18. Editing workspace

Create a professional desktop layout.

### Top bar

* Back to projects
* Editable project name
* Save state
* Undo
* Redo
* Version history
* Aspect ratio
* Preview quality
* Share
* Export

### Left panel

Tabs:

* Media
* Transcript
* Captions
* Audio
* Brand
* Templates

The left panel should be resizable and collapsible.

### Centre

* Video preview
* Playback controls
* Current time
* Duration
* Zoom
* Fit
* Safe-area guides
* Caption preview
* Full-screen preview

### Right panel

Tabs:

* AI editor
* Properties
* Inspector

The AI editor is the default.

### Bottom

Multi-track timeline with:

* Video tracks
* Audio tracks
* Caption track
* Playhead
* Time ruler
* Clip thumbnails
* Audio waveforms
* Selection
* Snapping
* Zoom
* Track mute
* Track lock
* Track visibility
* Add track
* Split
* Delete
* Ripple delete

Panels must be resizable. Provide sensible minimum sizes and keyboard access.

## 19. AI editor

The AI editor must feel like an editing tool, not a general chatbot.

Welcome state:

“What would you like to change?”

Suggested commands:

* Create a first cut
* Remove pauses and retakes
* Find the strongest hook
* Add relevant B-roll
* Create captions
* Improve dialogue audio
* Make a vertical version
* Shorten the selected section

The agent must understand:

* Whole project
* Selected clips
* Selected time range
* Current transcript section
* Current timeline version
* User’s editing brief

Each user instruction can produce one of three responses:

1. Direct answer with no edit
2. Small reversible action
3. Proposed multi-step edit plan requiring confirmation

For multi-step plans, show:

* Summary
* Expected new duration
* Operations
* Assets used
* Generated assets, if any
* Estimated source-minute or generation-credit usage
* Warnings
* Accept all
* Accept selected
* Edit plan
* Cancel

Each operation card must include:

* Operation type
* Timeline range
* Reason
* Preview
* Accept or reject
* Modify

After applying a plan:

* Create a named version
* Show a concise change summary
* Allow “Undo all”
* Allow individual operation reversal
* Offer useful next actions

Do not make the AI verbose or conversational for its own amusement. Responses should focus on editing decisions.

## 20. Transcript editor

Provide:

* Word-level timestamps
* Speaker labels
* Search
* Filler-word highlighting
* Silence markers
* Retake suggestions
* Low-confidence transcript highlighting
* Correct transcript text
* Split paragraph
* Merge paragraph
* Rename speaker
* Exclude text from timeline
* Restore excluded text

Deleting or excluding words should create non-destructive timeline cuts.

Clearly distinguish:

* Transcript correction, which changes text only
* Timeline removal, which changes the edit

Include a confirmation explanation the first time a user performs each action.

## 21. Timeline interactions

Implement a credible interactive timeline prototype.

Support:

* Select clips
* Drag clips
* Trim clip edges
* Split at playhead
* Delete
* Ripple delete
* Move clips between compatible tracks
* Zoom timeline
* Scroll
* Snap
* Multi-select
* Undo and redo
* Playhead seeking
* Clip context menu
* Track controls

Use a central timeline state model. Do not make the transcript, AI editor and timeline maintain separate contradictory versions of the project.

Keep the timeline implementation modular. Separate:

* Timeline state
* Coordinate and time calculations
* Selection
* Clip rendering
* Track rendering
* Playback synchronisation
* Commands and history

## 22. Captions

Create:

* Automatic caption generation
* Caption transcript editor
* Style presets
* Font controls
* Size
* Position
* Alignment
* Line length
* Background
* Highlight style
* Safe areas
* Per-word emphasis
* Export subtitle file

Provide refined default presets. Avoid loud social-caption styling as the only option.

## 23. Audio controls

Include:

* Dialogue enhancement control
* Noise-reduction control
* Gain
* Fade in and out
* Music ducking
* Mute
* Solo
* Basic waveform
* Loudness warning

Label destructive or quality-sensitive actions clearly.

## 24. Version history

Every meaningful AI operation should create a version.

Version entries:

* Name
* Timestamp
* Author
* Source: manual or AI
* Prompt summary
* Duration
* Number of operations
* Restore
* Duplicate
* Compare

Comparison view:

* Previous duration
* New duration
* Added clips
* Removed clips
* Moved clips
* Caption changes
* Audio changes

Restoring a version must preserve later history rather than deleting it silently.

## 25. Export experience

Export dialog:

* Filename
* Format
* Resolution
* Frame rate
* Quality
* Aspect ratio
* Captions burned in or separate
* Audio-only option
* Watermark status
* Estimated file size
* Estimated usage
* AI-content disclosure option
* Start export

Export-job page:

* Queued
* Preparing
* Rendering
* Uploading
* Complete
* Failed
* Cancelled

Include:

* Progress
* Settings
* Created time
* Download action
* Copy share link
* Retry
* Delete
* Expiry information

The demo must simulate these states honestly.

## 26. Usage and billing

Usage dashboard:

* Source minutes used
* Source minutes remaining
* Storage
* Generation credits
* Active projects
* Export resolution
* Current billing period
* Usage history

Explain each unit plainly.

Show an estimated cost before generation-heavy actions.

Do not process payments until a real payment integration is configured. The billing page can show plans and a waitlist state.

## 27. Security and privacy experience

Projects are private by default.

Settings should include:

* Download personal data
* Delete individual projects
* Delete account
* Media-retention controls
* Product analytics consent
* Marketing consent
* Model-improvement consent, disabled by default
* Active sessions
* Connected integrations
* Revoke access

Add clear copy:

“Your uploaded media is not used to train shared models unless you explicitly opt in.”

Only display this promise if the implementation and eventual infrastructure will honour it.

Use expiring access patterns in the future backend contract. Never expose permanent public media URLs.

## 28. AI transparency

Create a dedicated public policy page and product controls covering:

* When AI is used
* What project data the AI receives
* What operations are automated
* Difference between editing and generation
* Generated-media labelling
* Human review
* Known limitations
* Reporting harmful output
* Metadata or disclosure options for AI-generated media

For generated or materially manipulated media, prepare the product model for:

* Visible disclosure
* Machine-readable provenance or metadata
* User confirmation before export
* Audit record of generation source

Do not label normal silence removal or colour adjustment as synthetic generation.

## 29. Legal pages

Create well-structured placeholder pages for:

* Terms
* Privacy
* Cookies
* Acceptable Use
* Copyright and takedown
* AI Transparency
* Imprint

Use clearly marked placeholders for legal identity, company address, contact details, governing law, subprocessors and retention periods.

Do not invent legal identity information.

The acceptable-use rules should prohibit:

* Illegal content
* Non-consensual intimate content
* Sexual exploitation
* Harassment
* Impersonation and fraud
* Malicious deepfakes
* Copyright infringement
* Uploading media without required rights
* Attempts to attack or misuse the service

The upload flow should require users to confirm that they possess the necessary rights and permissions.

Implement a cookie banner that:

* Distinguishes necessary and optional categories
* Rejects optional cookies as easily as accepting them
* Remembers consent
* Links to settings
* Does not block essential product use

## 30. Status, errors and system feedback

Create complete states for:

* Initial loading
* Route loading
* Skeleton loading
* Empty data
* Upload progress
* Analysis progress
* AI thinking
* AI plan ready
* Plan applying
* Autosaving
* Saved
* Offline
* Reconnecting
* Permission denied
* Quota exceeded
* Unsupported format
* Corrupt file
* Processing failed
* Export failed
* Session expired
* 404
* 500
* Maintenance

Use specific, useful messages.

Bad:

“Something went wrong.”

Better:

“We could not analyse `camera-03.mov` because its audio stream is unsupported. The remaining six files are ready. Convert or replace this file, then retry.”

Every recoverable error should provide a recovery action.

## 31. Motion and loaders

Motion must explain state or hierarchy.

Use:

* Short fades
* Panel transitions
* Timeline selection transitions
* Upload progress
* Skeletons
* Subtle waveform movement
* Smooth plan expansion
* Respect for reduced-motion preferences

Do not use a full-screen spinner for ordinary page navigation.

For long media operations, show staged progress and let the user navigate elsewhere.

Create a branded loader using the timeline/playhead visual language, but keep it restrained.

## 32. Accessibility

Target WCAG 2.2 AA.

Requirements:

* Full keyboard access
* Visible focus states
* Semantic elements
* Accessible names
* Form labels
* Error descriptions
* Logical heading structure
* Contrast compliance
* Reduced motion
* Screen-reader announcements for upload and processing states
* Focus trapping and restoration in dialogs
* Accessible tooltips
* Captions for demonstration videos
* Do not depend on colour alone
* Minimum practical touch targets

The editor needs documented shortcuts and a shortcut-reference dialog.

## 33. Performance

Optimise for:

* Fast public-page loading
* Lazy-loaded heavy editor modules
* Lazy-loaded media thumbnails
* Virtualised long media lists
* Virtualised transcripts
* Efficient timeline rendering
* Debounced search
* Cancellation of obsolete requests
* No repeated full-project re-renders
* Responsive interaction during simulated processing

Do not load the entire editor bundle on the landing page.

Provide sensible image sizing, modern formats and font loading.

## 34. SEO and content quality

Create unique metadata for every public page.

Use clear page titles and descriptions.

Create structured data where appropriate for:

* Software application
* FAQ
* Breadcrumbs
* Articles or changelog entries

Use meaningful internal links.

Do not keyword-stuff “AI video editor” into every paragraph.

Do not use fake numerical claims such as:

* “10x faster”
* “Trusted by 50,000 creators”
* “99.9% accuracy”
* “Enterprise-grade security”

Use product demonstrations instead of invented statistics.

## 35. Data model

Create clear frontend types and backend-ready interfaces for:

* User
* Workspace
* Membership
* Project
* ProjectSettings
* MediaAsset
* AssetAnalysis
* Transcript
* TranscriptSegment
* Speaker
* Tag
* Timeline
* Track
* TimelineClip
* CaptionCue
* EditCommand
* EditPlan
* EditOperation
* Version
* ExportJob
* UsageRecord
* Subscription
* Notification
* ConsentRecord
* AuditEvent

Use stable identifiers.

Keep raw media metadata separate from timeline occurrences. The same asset may appear multiple times on the timeline.

Use explicit operation types and validation rather than unrestricted arbitrary objects.

## 36. State architecture

Separate:

* Remote or persisted data
* Local editor state
* UI state
* Form state
* Playback state
* Timeline command history

Create service boundaries for:

* Authentication
* Project storage
* Media upload
* Media analysis
* Transcription
* AI planning
* Timeline operations
* Exporting
* Billing
* Analytics

Mock implementations should conform to the same interfaces expected from real services.

## 37. Required project files

Create these root-level files:

### `AGENTS.md`

This file must be treated as mandatory instructions for every future AI agent working on the repository.

Include:

* Product mission
* User promise
* MVP scope
* Non-goals
* Architecture overview
* Route map
* Folder structure
* Naming conventions
* Component conventions
* State-management rules
* Design-token rules
* Accessibility requirements
* Privacy and security rules
* Testing expectations
* Error-handling rules
* Documentation requirements
* Definition of done
* Code-review checklist
* Instructions to inspect existing components before creating new ones
* Instructions not to silently change unrelated code
* Instructions not to hardcode secrets
* Instructions not to fabricate backend success
* Instructions not to bypass typing or validation
* Instructions not to duplicate components or styles
* Instructions to update documentation when architecture or behaviour changes

### `DESIGN_SYSTEM.md`

Document:

* Brand principles
* Palette
* Typography
* Spacing
* Grid
* Components
* Variants
* Interaction states
* Motion
* Responsive rules
* Accessibility
* Usage examples
* Anti-patterns

### `PRODUCT_SPEC.md`

Document:

* Problem
* Target audience
* Jobs to be done
* Product promise
* MVP
* Later phases
* Core workflows
* Functional requirements
* Non-functional requirements
* Success metrics
* Risks
* Open decisions

### `ROUTES.md`

Document every public and authenticated route, purpose, access requirement and primary action.

### `ARCHITECTURE.md`

Document:

* Major modules
* Data flow
* State ownership
* Service interfaces
* Timeline command architecture
* Mock-versus-real boundaries
* Future processing pipeline

### `PRIVACY_MODEL.md`

Document:

* Data categories
* Purpose
* Retention
* Deletion
* Consent
* Sharing
* Generated-media records
* Security assumptions
* Items requiring legal review

### `CHANGELOG.md`

Track meaningful implementation changes.

## 38. Code-quality rules for `AGENTS.md`

Include these enforceable rules:

1. Prefer small, focused modules with a clear responsibility.
2. Do not create page components containing the entire application.
3. Extract reusable behaviour only when reuse or complexity justifies it.
4. Search for an existing component before creating a new one.
5. Use design tokens, never arbitrary duplicate style values.
6. Keep business logic out of presentational components.
7. Keep timeline calculations in dedicated utilities or domain modules.
8. Validate all data entering service boundaries.
9. Represent loading, empty, success and error states explicitly.
10. Never swallow errors silently.
11. Do not use unsafe type escapes to make errors disappear.
12. Do not expose secrets or privileged operations in client code.
13. Do not claim backend actions succeeded when they were simulated.
14. Keep accessibility behaviour part of component implementation.
15. Add tests for critical transformations, timeline commands and state transitions.
16. Preserve backwards compatibility for persisted project data or provide migrations.
17. Keep user-facing copy centralised where practical.
18. Do not alter unrelated files without a documented reason.
19. Update relevant documentation with architectural changes.
20. Run formatting, static checks, tests and a production build before declaring work complete.

## 39. Testing and verification

Add tests appropriate to the implementation for:

* Navigation
* Authentication guards
* Form validation
* New-project wizard
* Upload-state handling
* Media filtering
* AI edit-plan acceptance
* Partial plan rejection
* Timeline commands
* Undo and redo
* Version restore
* Export-state transitions
* Consent persistence
* Responsive navigation
* Accessibility of dialogs and forms

Verify manually:

* All routes
* No broken links
* No overflowing layouts
* Keyboard navigation
* Mobile menu
* Tablet editor behaviour
* Empty dashboard
* Failed upload
* Failed analysis
* AI plan review
* Timeline modification
* Export simulation
* Account deletion flow
* Cookie preferences
* 404 page

Run a production build and resolve warnings that indicate genuine defects.

## 40. Delivery order

Build in this order:

Phase 1:

* Project foundations
* Documentation
* Design system
* Shared components
* Routing and layouts

Phase 2:

* Public website
* Authentication
* Legal pages
* Responsive navigation
* SEO

Phase 3:

* Dashboard
* New-project wizard
* Media library
* Upload and analysis simulation

Phase 4:

* Editor shell
* Preview
* AI editor
* Transcript
* Basic interactive timeline

Phase 5:

* Versions
* Exports
* Usage
* Settings
* Privacy controls

Phase 6:

* Accessibility audit
* Responsive audit
* Performance review
* Code-quality review
* Production-build verification

Do not stop after making the homepage. Complete the complete route structure and core application experience described above.

## 41. Final acceptance criteria

The result is acceptable only when:

* The website feels original and premium.
* Light mode is visually complete.
* Public and application navigation work.
* Every required route exists.
* The dashboard and editor use coherent demo data.
* The core project flow can be completed.
* AI edit plans can be reviewed and selectively applied.
* Timeline actions are reflected in the project state.
* Undo and version history work in the prototype.
* All forms validate properly.
* Loading, empty and error states exist.
* Responsive behaviour is intentional.
* Accessibility fundamentals are implemented.
* Legal placeholders are clearly marked.
* No fake backend, payment or security claims appear.
* `AGENTS.md` and all requested documentation files exist.
* Components and styles are reusable.
* Static checks, tests and the production build pass.

Begin by producing the implementation plan and file architecture. Then build the application phase by phase.
