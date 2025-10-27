# Department Schedule Planner — Project Goals

## Purpose

Academic departments need to build a semester schedule that makes sense for:
- instructors (no double-booking),
- rooms and labs (no collisions, reasonable turnaround time),
- and students (no impossible combinations of required courses).

Right now this process is often done with spreadsheets, emails, institutional memory, and guesswork. The goal of this tool is to make conflicts visible early, before the schedule is sent to the registrar.

The planner is not a student-facing registration tool. It is an internal planning tool meant for department chairs, schedulers, advisors, and curriculum committees.

---

## Core Outcomes

1. **Build the department's semester schedule**
   - Create proposed offerings (lecture, lab, seminar, etc.).
   - Assign instructor, days of week, start/end time, and room.
   - Link labs to their parent lecture section.
   - View all offerings on a weekly grid.

2. **Detect problems instantly**
   - Instructor cannot be in two places at once.
   - A single room (especially a lab room) cannot host overlapping sections.
   - Labs in the same room must have a buffer/gap between them for cleanup/reset.
   - (Later) Workload balance by instructor.

3. **Protect student pathways**
   - Some groups of students (majors, pre-professional tracks, etc.) must be able to take specific courses in the same semester.
   - The tool should reveal: "We scheduled CHEM 101 and BIOL 110 at the same time, so pre-nursing students literally can't take both in their first term."
   - Long-term goal: upload or define program/degree paths and have the system check whether the proposed schedule actually supports those paths.

4. **Compare multiple drafts**
   - Department schedulers often build several schedule versions before finalizing.
   - The tool should support saving different scenarios (e.g. "Fall 2026 Draft A", "Fall 2026 Draft B") and switching between them.
   - Each scenario is a self-contained "possible semester."

---

## High-Level Feature Set

### A. Schedule Builder (Tab 1)
Interactive environment for shaping the semester.

- Add/edit a "Section":
  - Course code (e.g. CHEM 201)
  - Section number (01, 02, etc.)
  - Type: lecture / lab / seminar
  - Instructor
  - Meeting days
  - Start and end time
  - Room
  - (If lab) linked parent lecture section
- Visual weekly grid (Mon–Fri timeline)
  - Sections displayed as blocks
  - Color or tag by lecture vs lab
  - Eventually: drag-and-drop a block to a new time/day and immediately re-check for conflicts
- Filters:
  - Show only one instructor's load
  - Show only labs
  - Overlay courses from other departments for visibility

### B. Constraints / Health Check (Tab 2)
Automated validation.

- **Instructor conflicts**
  - Detect overlapping times for the same instructor.
- **Room conflicts**
  - Detect overlapping usage of the same room.
- **Lab buffer rule**
  - For lab rooms, ensure there's a configurable turnaround buffer (e.g. 30 minutes) between lab sections in the same space.
- **Pathway conflicts (summary view)**
  - Highlight cases where required courses for a given student pathway are scheduled in direct conflict.
- Exportable report
  - The goal is to be able to export this summary to share in department meetings.

### C. Student Pathways / Degree Requirements (Tab 3)
Captures what students *need* to take together.

- Define a "Pathway":
  - Name (e.g. "Pre-Nursing Term 1", "Chemistry Major Sophomore Fall")
  - List of required courses for that milestone/term
- The system compares the active schedule against these requirements to ask:
  - "Is it even possible for a student on this path to enroll in all of these at once, given the current section times?"
- Long-term: import structured degree plan data so these pathways can be generated/updated automatically rather than entered manually.

---

## Data Model (Initial Draft)

### Course
Describes the catalog-level course.
- `courseId` (e.g. "CHEM 201")
- `title`
- `credits`
- `hasLab` (boolean)
- `defaultDurationMinutes` (optional convenience)

### Section
Describes an actual scheduled offering this term.
- `sectionId` (unique, e.g. "CHEM201-01-LEC")
- `courseId`
- `sectionNumber` ("01", "A", etc.)
- `sectionType` ("lecture", "lab", etc.)
- `instructorId`
- `meetingBlocks`: array of { day, startTime, endTime, roomId }
- `linkedParentSectionId` (for labs tied to a specific lecture)
- `scenarioId` (which draft/scenario this belongs to)

### Instructor
- `instructorId`
- `name`
- (Later) preferred / unavailable times, teaching load info

### Room
- `roomId`
- `name`
- `roomType` (e.g. "chem_lab", "lecture_hall")
- (Later) capacity, equipment

### Pathway
Represents a set of courses that students in a given track are expected to take in the same semester.
- `pathwayId`
- `name` ("Pre-Nursing Term 1")
- `requiredCourseIds`: array of course IDs

### Scenario
Represents one version of the semester plan.
- `scenarioId`
- `name` ("Fall 2026 Draft A")
- `term` ("Fall 2026")
- All `Section` records are tied to a specific `scenarioId`.

---

## Conflict Logic (Planned)

1. **Instructor time collision**
   - For each instructor, compare all assigned meeting blocks.
   - If two blocks overlap in time on the same day, flag immediately.

2. **Room collision**
   - For each room, compare all meeting blocks.
   - Overlapping time on the same day is a conflict.

3. **Lab turnaround buffer**
   - For each lab room, sort all blocks on a given day by start time.
   - Ensure the gap between block A end and block B start is ≥ required buffer (e.g. 30 minutes).

4. **Pathway feasibility**
   - For each Pathway (set of required courses for a given student milestone), test whether a full non-overlapping schedule is possible.
   - If not, flag that the department is about to create an impossible semester plan for that pathway.

---

## Long-Term Direction

1. **Degree data import**
   - Ability to load structured program/degree plans from a file (e.g. CSV/JSON).
   - Example: "Biology BS, Year 2 Fall requires BIO 210 + CHEM 201 + MATH 210."
   - These imports become Pathways automatically.

2. **Cross-discipline awareness**
   - Departments often rely on other departments' courses (e.g. Nursing depends on Biology and Psychology).
   - The tool should surface when two different departments unintentionally block each other's students.

3. **What-if scenarios**
   - Copy an entire scenario to create a variant.
   - Adjust times/instructors/rooms in the variant.
   - Compare conflicts and pathway feasibility between variants.

4. **Reporting**
   - Export conflict summaries for meetings.
   - Export instructor load summaries.
   - Export lab room utilization blocks (for lab managers).

---

## Non-Goals (for now)

- Student registration / enrollment caps / waitlists.
- Room assignment optimization / auto-scheduling by algorithm.
- Faculty workload contract rules beyond simple load counts.
- Publishing directly to the registrar.

These may be added later, but they are not required for the initial usable version.

---

## Success Criteria for the First Usable Version

- I can create sections (lecture / lab) with instructor, days, time, and room.
- I can view them on a weekly grid and add test sections quickly.
- The system shows:
  - instructor double-booking,
  - room double-booking,
  - lab buffer violations.
- I can define at least one "Pathway" (a bundle of courses students must co-take) and get warned if there is a direct time clash between their only available sections.
- All of the above is scenario-specific, so I can iterate on drafts of a future term without losing older drafts.

Once that is working, the next major milestone is importing degree/track requirements and checking those automatically.
