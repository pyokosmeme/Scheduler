import React, { useState, useMemo } from "react";

/**
 * Basic types for our scheduling domain
 */

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri";

interface MeetingBlock {
  day: DayOfWeek;
  startTime: string; // "13:00" 24h
  endTime: string;   // "15:00"
  roomId: string;
}

type SectionType = "lecture" | "lab";

interface Section {
  id: string; // e.g. "CHEM201-01-LEC"
  courseCode: string; // e.g. "CHEM 201"
  title: string; // e.g. "Organic Chemistry I"
  sectionNumber: string; // e.g. "01"
  sectionType: SectionType;
  instructorId: string;
  linkedParentSectionId?: string; // lab -> lecture it belongs to
  meetingBlocks: MeetingBlock[];
}

interface Instructor {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  roomType: string; // "chem_lab" | "lecture_hall" | ...
}

interface Pathway {
  id: string;
  name: string; // e.g. "Pre-Nursing Term 1"
  requiredCourseCodes: string[]; // e.g. ["CHEM 101", "BIOL 110", "BIOL 110L", "PSYC 101"]
}

/**
 * Utility helpers
 */

// timeOverlap returns true if two time ranges on the same day overlap
function timeOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  // Compare as "HH:MM" strings by converting to minutes
  const toMin = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };
  const aS = toMin(aStart);
  const aE = toMin(aEnd);
  const bS = toMin(bStart);
  const bE = toMin(bEnd);
  return aS < bE && bS < aE;
}

// minutesBetween returns bStart - aEnd in minutes (assuming same day)
function minutesBetween(aEnd: string, bStart: string): number {
  const toMin = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 60 + mm;
  };
  return toMin(bStart) - toMin(aEnd);
}

/**
 * Conflict checking logic
 *
 * - instructor conflicts
 * - room conflicts
 * - lab room buffer gaps
 * - pathway "can students take all required courses"
 */

function useConflicts(
  sections: Section[],
  instructors: Instructor[],
  rooms: Room[],
  pathways: Pathway[],
  requiredLabBufferMinutes: number
) {
  // Instructor conflicts
  const instructorConflicts = useMemo(() => {
    const byInstructor: Record<string, { section: Section; block: MeetingBlock }[]> = {};
    sections.forEach((sec) => {
      sec.meetingBlocks.forEach((block) => {
        const arr = byInstructor[sec.instructorId] || [];
        arr.push({ section: sec, block });
        byInstructor[sec.instructorId] = arr;
      });
    });

    const conflicts: {
      instructorName: string;
      aSectionId: string;
      bSectionId: string;
      day: DayOfWeek;
      details: string;
    }[] = [];

    Object.entries(byInstructor).forEach(([instId, slots]) => {
      // compare all pairs for that instructor
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const A = slots[i];
          const B = slots[j];
          if (A.block.day !== B.block.day) continue;
          if (
            timeOverlap(
              A.block.startTime,
              A.block.endTime,
              B.block.startTime,
              B.block.endTime
            )
          ) {
            const instName =
              instructors.find((x) => x.id === instId)?.name ?? instId;
            conflicts.push({
              instructorName: instName,
              aSectionId: A.section.id,
              bSectionId: B.section.id,
              day: A.block.day,
              details: `${A.block.startTime}-${A.block.endTime} overlaps ${B.block.startTime}-${B.block.endTime}`,
            });
          }
        }
      }
    });

    return conflicts;
  }, [sections, instructors]);

  // Room conflicts + lab buffer
  const roomConflicts = useMemo(() => {
    const byRoomDay: Record<
      string,
      { section: Section; block: MeetingBlock }[]
    > = {};
    sections.forEach((sec) => {
      sec.meetingBlocks.forEach((block) => {
        const key = `${block.roomId}__${block.day}`;
        const arr = byRoomDay[key] || [];
        arr.push({ section: sec, block });
        byRoomDay[key] = arr;
      });
    });

    const directConflicts: {
      roomId: string;
      day: DayOfWeek;
      aSectionId: string;
      bSectionId: string;
      details: string;
    }[] = [];

    const bufferWarnings: {
      roomId: string;
      day: DayOfWeek;
      firstSectionId: string;
      secondSectionId: string;
      gapMinutes: number;
      details: string;
    }[] = [];

    Object.entries(byRoomDay).forEach(([key, slots]) => {
      // sort by start time for buffer calculation
      slots.sort((A, B) =>
        A.block.startTime.localeCompare(B.block.startTime)
      );

      // check pairwise overlaps + buffer gaps
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const A = slots[i];
          const B = slots[j];

          if (
            timeOverlap(
              A.block.startTime,
              A.block.endTime,
              B.block.startTime,
              B.block.endTime
            )
          ) {
            const [roomId, day] = key.split("__") as [string, DayOfWeek];
            directConflicts.push({
              roomId,
              day,
              aSectionId: A.section.id,
              bSectionId: B.section.id,
              details: `${A.block.startTime}-${A.block.endTime} overlaps ${B.block.startTime}-${B.block.endTime}`,
            });
          }
        }
      }

      // check buffer between consecutive slots only
      for (let i = 0; i < slots.length - 1; i++) {
        const A = slots[i];
        const B = slots[i + 1];
        const gap = minutesBetween(A.block.endTime, B.block.startTime);
        if (gap < requiredLabBufferMinutes) {
          const [roomId, day] = key.split("__") as [string, DayOfWeek];
          bufferWarnings.push({
            roomId,
            day,
            firstSectionId: A.section.id,
            secondSectionId: B.section.id,
            gapMinutes: gap,
            details: `Only ${gap} min gap; required ${requiredLabBufferMinutes} min`,
          });
        }
      }
    });

    return { directConflicts, bufferWarnings };
  }, [sections, requiredLabBufferMinutes]);

  // Pathway conflicts (simplified draft):
  // For each pathway, take pairs of required courses and see if their *only* sections collide.
  // This is a first pass; later we do full combinatorics.
  const pathwayIssues = useMemo(() => {
    const issues: {
      pathwayName: string;
      courseA: string;
      courseB: string;
      details: string;
    }[] = [];

    pathways.forEach((pathway) => {
      const required = pathway.requiredCourseCodes;
      // naive pairwise check
      for (let i = 0; i < required.length; i++) {
        for (let j = i + 1; j < required.length; j++) {
          const courseA = required[i];
          const courseB = required[j];

          // pull sections that match each courseCode
          const secsA = sections.filter((s) => s.courseCode === courseA);
          const secsB = sections.filter((s) => s.courseCode === courseB);

          // if each only has 1 offered section, and those collide => bad.
          if (secsA.length === 1 && secsB.length === 1) {
            const a = secsA[0];
            const b = secsB[0];
            // compare each block A vs each block B
            let overlapFound = false;
            for (const aBlock of a.meetingBlocks) {
              for (const bBlock of b.meetingBlocks) {
                if (aBlock.day !== bBlock.day) continue;
                if (
                  timeOverlap(
                    aBlock.startTime,
                    aBlock.endTime,
                    bBlock.startTime,
                    bBlock.endTime
                  )
                ) {
                  overlapFound = true;
                }
              }
            }
            if (overlapFound) {
              issues.push({
                pathwayName: pathway.name,
                courseA,
                courseB,
                details: `The only offered ${courseA} section conflicts with the only offered ${courseB} section.`,
              });
            }
          }
        }
      }
    });

    return issues;
  }, [pathways, sections]);

  return {
    instructorConflicts,
    roomConflicts,
    pathwayIssues,
  };
}

/**
 * ScheduleGrid
 * Renders a simple Mon-Fri grid and places section blocks.
 * (This is an MVP visual, not final styling.)
 */

interface ScheduleGridProps {
  sections: Section[];
}

const HOURS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
];

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function ScheduleGrid({ sections }: ScheduleGridProps) {
  // We’ll group meeting blocks by day for easier rendering.
  const blocksByDay: Record<DayOfWeek, { section: Section; block: MeetingBlock }[]> =
    useMemo(() => {
      const map: Record<
        DayOfWeek,
        { section: Section; block: MeetingBlock }[]
      > = {
        Mon: [],
        Tue: [],
        Wed: [],
        Thu: [],
        Fri: [],
      };
      sections.forEach((sec) => {
        sec.meetingBlocks.forEach((block) => {
          map[block.day].push({ section: sec, block });
        });
      });
      return map;
    }, [sections]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "80px repeat(5, 1fr)", border: "1px solid #ccc", fontFamily: "sans-serif", fontSize: 12 }}>
      {/* Header row */}
      <div style={{ borderBottom: "1px solid #ccc", background: "#fafafa" }}></div>
      {DAYS.map((day) => (
        <div
          key={day}
          style={{
            borderBottom: "1px solid #ccc",
            borderLeft: "1px solid #ccc",
            background: "#fafafa",
            textAlign: "center",
            fontWeight: 600,
            padding: "4px 0",
          }}
        >
          {day}
        </div>
      ))}

      {/* Time rows */}
      {HOURS.map((hour) => (
        <React.Fragment key={hour}>
          {/* Time label col */}
          <div
            style={{
              borderBottom: "1px solid #eee",
              padding: "8px 4px",
              textAlign: "right",
              fontWeight: 500,
              background: "#fff",
            }}
          >
            {hour}
          </div>
          {/* Day columns */}
          {DAYS.map((day) => (
            <div
              key={day + hour}
              style={{
                borderBottom: "1px solid #eee",
                borderLeft: "1px solid #eee",
                minHeight: "60px",
                position: "relative",
                background: "#fff",
              }}
            >
              {/* Render any blocks that START within this hour for this day.
                  Real version would do absolute positioning by minute. */}
              {blocksByDay[day]
                .filter((item) => item.block.startTime === hour)
                .map((item) => (
                  <div
                    key={item.section.id + item.block.startTime}
                    style={{
                      position: "absolute",
                      top: 2,
                      left: 2,
                      right: 2,
                      bottom: 2,
                      borderRadius: 4,
                      border: "1px solid #888",
                      background:
                        item.section.sectionType === "lab"
                          ? "rgba(255,200,200,0.6)"
                          : "rgba(200,220,255,0.6)",
                      padding: 4,
                      fontSize: 11,
                      lineHeight: 1.4,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {item.section.courseCode}-{item.section.sectionNumber}{" "}
                      {item.section.sectionType === "lab" ? "Lab" : "Lec"}
                    </div>
                    <div>{item.block.startTime}–{item.block.endTime}</div>
                    <div>{item.block.roomId}</div>
                    <div>{item.section.title}</div>
                  </div>
                ))}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * ConstraintsReport
 * Shows conflict summaries in a readable list.
 */

interface ConstraintsReportProps {
  instructorConflicts: ReturnType<typeof useConflicts>["instructorConflicts"];
  roomConflicts: ReturnType<typeof useConflicts>["roomConflicts"];
  pathwayIssues: ReturnType<typeof useConflicts>["pathwayIssues"];
}

function ConstraintsReport({
  instructorConflicts,
  roomConflicts,
  pathwayIssues,
}: ConstraintsReportProps) {
  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 14, lineHeight: 1.5 }}>
      <h2>Instructor Conflicts</h2>
      {instructorConflicts.length === 0 ? (
        <p>None found.</p>
      ) : (
        <ul>
          {instructorConflicts.map((conf, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <strong>{conf.instructorName}</strong>: {conf.aSectionId} and{" "}
              {conf.bSectionId} overlap on {conf.day} ({conf.details})
            </li>
          ))}
        </ul>
      )}

      <h2>Room Conflicts</h2>
      {roomConflicts.directConflicts.length === 0 ? (
        <p>None found.</p>
      ) : (
        <ul>
          {roomConflicts.directConflicts.map((conf, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <strong>Room {conf.roomId}</strong>: {conf.aSectionId} and{" "}
              {conf.bSectionId} overlap {conf.day} ({conf.details})
            </li>
          ))}
        </ul>
      )}

      <h2>Lab Buffer Warnings</h2>
      {roomConflicts.bufferWarnings.length === 0 ? (
        <p>No buffer issues.</p>
      ) : (
        <ul>
          {roomConflicts.bufferWarnings.map((warn, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <strong>Room {warn.roomId}</strong> {warn.day}: {warn.firstSectionId} →{" "}
              {warn.secondSectionId} gap {warn.gapMinutes} min ({warn.details})
            </li>
          ))}
        </ul>
      )}

      <h2>Pathway Issues</h2>
      {pathwayIssues.length === 0 ? (
        <p>No pathway blocking overlaps detected (under current simple logic).</p>
      ) : (
        <ul>
          {pathwayIssues.map((issue, idx) => (
            <li key={idx} style={{ marginBottom: 8 }}>
              <strong>{issue.pathwayName}</strong>: {issue.courseA} vs{" "}
              {issue.courseB} — {issue.details}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * PathwaysPanel
 * Shows pathway definitions and (later) lets you edit them.
 * For MVP we just list them.
 */

interface PathwaysPanelProps {
  pathways: Pathway[];
}

function PathwaysPanel({ pathways }: PathwaysPanelProps) {
  return (
    <div style={{ fontFamily: "sans-serif", fontSize: 14, lineHeight: 1.5 }}>
      <h2>Student Pathways</h2>
      {pathways.length === 0 ? (
        <p>No pathways defined yet.</p>
      ) : (
        pathways.map((p) => (
          <div
            key={p.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: 12,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <div style={{ fontWeight: 600 }}>{p.name}</div>
            <div style={{ fontSize: 13 }}>
              Courses commonly taken together:
            </div>
            <ul style={{ marginLeft: 20, fontSize: 13 }}>
              {p.requiredCourseCodes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        ))
      )}

      {/* TODO:
         - Add "New Pathway" form
         - Add "Import degree requirements" upload button
         - Map imported requirements to semester bundles
      */}
    </div>
  );
}

/**
 * Main App component
 * - Tabs
 * - State for sections/instructors/rooms/pathways
 */

type TabKey = "schedule" | "constraints" | "pathways";

export default function App() {
  // Placeholder instructors
  const [instructors] = useState<Instructor[]>([
    { id: "lee", name: "Dr. Lee" },
    { id: "chen", name: "Dr. Chen" },
  ]);

  // Placeholder rooms
  const [rooms] = useState<Room[]>([
    { id: "LAB315", name: "Lab 315", roomType: "chem_lab" },
    { id: "HALL200", name: "Hall 200", roomType: "lecture_hall" },
  ]);

  // Placeholder sections
  const [sections, setSections] = useState<Section[]>([
    {
      id: "CHEM201-01-LEC",
      courseCode: "CHEM 201",
      title: "Organic Chemistry I",
      sectionNumber: "01",
      sectionType: "lecture",
      instructorId: "lee",
      meetingBlocks: [
        {
          day: "Mon",
          startTime: "10:00",
          endTime: "11:15",
          roomId: "HALL200",
        },
        {
          day: "Wed",
          startTime: "10:00",
          endTime: "11:15",
          roomId: "HALL200",
        },
      ],
    },
    {
      id: "CHEM201L-A",
      courseCode: "CHEM 201L",
      title: "Organic Chem Lab I",
      sectionNumber: "A",
      sectionType: "lab",
      instructorId: "chen",
      linkedParentSectionId: "CHEM201-01-LEC",
      meetingBlocks: [
        {
          day: "Tue",
          startTime: "13:00",
          endTime: "15:00",
          roomId: "LAB315",
        },
      ],
    },
    {
      id: "BIOL110-01-LEC",
      courseCode: "BIOL 110",
      title: "Intro Biology",
      sectionNumber: "01",
      sectionType: "lecture",
      instructorId: "chen",
      meetingBlocks: [
        {
          day: "Tue",
          startTime: "13:00",
          endTime: "14:15",
          roomId: "HALL200",
        },
        {
          day: "Thu",
          startTime: "13:00",
          endTime: "14:15",
          roomId: "HALL200",
        },
      ],
    },
  ]);

  // Placeholder pathways
  const [pathways] = useState<Pathway[]>([
    {
      id: "pre-nursing-term1",
      name: "Pre-Nursing Term 1",
      requiredCourseCodes: ["CHEM 201", "BIOL 110"],
    },
  ]);

  // active tab state
  const [tab, setTab] = useState<TabKey>("schedule");

  // buffer requirement (minutes)
  const requiredLabBufferMinutes = 30;

  // conflict analysis
  const { instructorConflicts, roomConflicts, pathwayIssues } = useConflicts(
    sections,
    instructors,
    rooms,
    pathways,
    requiredLabBufferMinutes
  );

  /**
   * Minimal form to add a new section (MVP stub).
   * In practice this would be a modal/drawer with validation & day checkboxes.
   */
  const [draftCourseCode, setDraftCourseCode] = useState("NEW 100");
  const [draftStart, setDraftStart] = useState("09:00");
  const [draftEnd, setDraftEnd] = useState("10:15");
  const [draftDay, setDraftDay] = useState<DayOfWeek>("Mon");

  function addDraftSection() {
    const newSection: Section = {
      id: `${draftCourseCode}-TMP`,
      courseCode: draftCourseCode,
      title: "New Course Title",
      sectionNumber: "TBD",
      sectionType: "lecture",
      instructorId: "lee",
      meetingBlocks: [
        {
          day: draftDay,
          startTime: draftStart,
          endTime: draftEnd,
          roomId: "HALL200",
        },
      ],
    };
    setSections((prev) => [...prev, newSection]);
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", padding: 16 }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          Department Schedule Planner (Draft)
        </h1>
        <div style={{ fontSize: 13, color: "#555" }}>
          Goal: build semester offerings, catch instructor/room/lab conflicts,
          and ensure student pathway compatibility.
        </div>
      </header>

      {/* Tab selector */}
      <nav style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setTab("schedule")}
          style={{
            padding: "6px 10px",
            fontSize: 14,
            borderRadius: 4,
            border: "1px solid #888",
            background: tab === "schedule" ? "#e0e7ff" : "#fff",
            cursor: "pointer",
          }}
        >
          Schedule Builder
        </button>
        <button
          onClick={() => setTab("constraints")}
          style={{
            padding: "6px 10px",
            fontSize: 14,
            borderRadius: 4,
            border: "1px solid #888",
            background: tab === "constraints" ? "#e0e7ff" : "#fff",
            cursor: "pointer",
          }}
        >
          Constraints / Health Check
        </button>
        <button
          onClick={() => setTab("pathways")}
          style={{
            padding: "6px 10px",
            fontSize: 14,
            borderRadius: 4,
            border: "1px solid #888",
            background: tab === "pathways" ? "#e0e7ff" : "#fff",
            cursor: "pointer",
          }}
        >
          Student Pathways
        </button>
      </nav>

      {/* Tab content */}
      {tab === "schedule" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
              Weekly Grid (Draft View)
            </h2>
            <ScheduleGrid sections={sections} />
          </div>

          <aside
            style={{
              border: "1px solid #ccc",
              borderRadius: 4,
              padding: 12,
              background: "#fafafa",
              alignSelf: "flex-start",
              fontSize: 13,
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              Add a quick test section
            </h3>

            <label style={{ display: "block", marginBottom: 8 }}>
              Course Code
              <input
                style={{
                  width: "100%",
                  border: "1px solid #999",
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 13,
                }}
                value={draftCourseCode}
                onChange={(e) => setDraftCourseCode(e.target.value)}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Day
              <select
                style={{
                  width: "100%",
                  border: "1px solid #999",
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 13,
                }}
                value={draftDay}
                onChange={(e) => setDraftDay(e.target.value as DayOfWeek)}
              >
                <option value="Mon">Mon</option>
                <option value="Tue">Tue</option>
                <option value="Wed">Wed</option>
                <option value="Thu">Thu</option>
                <option value="Fri">Fri</option>
              </select>
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              Start
              <input
                type="time"
                style={{
                  width: "100%",
                  border: "1px solid #999",
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 13,
                }}
                value={draftStart}
                onChange={(e) => setDraftStart(e.target.value)}
              />
            </label>

            <label style={{ display: "block", marginBottom: 8 }}>
              End
              <input
                type="time"
                style={{
                  width: "100%",
                  border: "1px solid #999",
                  borderRadius: 4,
                  padding: "4px 6px",
                  fontSize: 13,
                }}
                value={draftEnd}
                onChange={(e) => setDraftEnd(e.target.value)}
              />
            </label>

            <button
              onClick={addDraftSection}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 4,
                border: "1px solid #444",
                background: "#fff",
                cursor: "pointer",
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              Add to Grid
            </button>

            <p style={{ fontSize: 12, color: "#555", marginTop: 12 }}>
              (Drag & drop is planned. For now, you can add test blocks here.)
            </p>
          </aside>
        </div>
      )}

      {tab === "constraints" && (
        <ConstraintsReport
          instructorConflicts={instructorConflicts}
          roomConflicts={roomConflicts}
          pathwayIssues={pathwayIssues}
        />
      )}

      {tab === "pathways" && <PathwaysPanel pathways={pathways} />}

      <footer style={{ marginTop: 24, fontSize: 12, color: "#777" }}>
        <div>
          Future:
          <ul style={{ marginLeft: 20 }}>
            <li>
              Scenario switching (Draft A vs Draft B for the same term).
            </li>
            <li>
              Import degree/track requirements, auto-generate pathways per
              semester, and analyze cross-discipline conflicts.
            </li>
            <li>
              Export a “Health Check Report” for department meetings.
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
