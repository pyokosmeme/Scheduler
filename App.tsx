import React, { useEffect, useMemo, useState } from "react";

type DayOfWeek = "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat" | "Sun";

type SectionKind =
  | "lecture"
  | "lab"
  | "combined"
  | "seminar"
  | "onlineOnly"
  | "other";

type Modality = "On Campus" | "Online" | "Hybrid";

type RoomType = "lab" | "lecture" | "virtual" | "other";

interface MeetingBlock {
  day: DayOfWeek;
  startTime: string;
  endTime: string;
  roomId?: string;
}

interface Section {
  id: string;
  scenarioId: string;
  courseCode: string;
  courseTitle: string;
  sectionNumber: string;
  kind: SectionKind;
  modality: Modality;
  length: string;
  instructorId: string;
  meetingBlocks: MeetingBlock[];
  notes?: string;
}

interface Instructor {
  id: string;
  name: string;
}

interface Room {
  id: string;
  name: string;
  roomType: RoomType;
}

interface Pathway {
  id: string;
  name: string;
  requiredCourseCodes: string[];
}

interface Scenario {
  id: string;
  name: string;
  term: string;
  description?: string;
}

interface ExportedData {
  version: number;
  scenarios: Scenario[];
  sections: Section[];
  instructors: Instructor[];
  rooms: Room[];
  pathways: Pathway[];
  labBufferMinutes: number;
}

interface InstructorConflict {
  instructorId: string;
  instructorName: string;
  sectionA: Section;
  sectionB: Section;
  blockA: MeetingBlock;
  blockB: MeetingBlock;
}

interface RoomConflict {
  roomId: string;
  roomName: string;
  day: DayOfWeek;
  sectionA: Section;
  sectionB: Section;
  blockA: MeetingBlock;
  blockB: MeetingBlock;
}

interface LabBufferConflict {
  roomId: string;
  roomName: string;
  day: DayOfWeek;
  firstSection: Section;
  secondSection: Section;
  firstBlock: MeetingBlock;
  secondBlock: MeetingBlock;
  gapMinutes: number;
}

interface PathwayIssue {
  pathwayId: string;
  pathwayName: string;
  details: string;
}

interface ConflictSummary {
  instructorConflicts: InstructorConflict[];
  roomConflicts: RoomConflict[];
  labBufferConflicts: LabBufferConflict[];
  pathwayIssues: PathwayIssue[];
}

const DAY_SEQUENCE: DayOfWeek[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
];

const STORAGE_KEY = "department-schedule-planner-state-v1";

const SECTION_KIND_LABELS: Record<SectionKind, string> = {
  lecture: "Lecture",
  lab: "Lab",
  combined: "Combined Lecture",
  seminar: "Seminar",
  onlineOnly: "Online",
  other: "Other",
};

const SECTION_KIND_COLORS: Record<SectionKind, string> = {
  lecture: "#3b82f680",
  lab: "#f8717180",
  combined: "#8b5cf680",
  seminar: "#22c55e80",
  onlineOnly: "#94a3b880",
  other: "#facc1580",
};

const DEFAULT_SCENARIOS: Scenario[] = [
  {
    id: "fall-2024-draft-a",
    name: "Draft A",
    term: "Fall 2024",
    description: "Imported astronomy & physics schedule",
  },
];

const DEFAULT_INSTRUCTORS: Instructor[] = [
  { id: "astronomy-faculty", name: "Astronomy Faculty" },
  { id: "physics-faculty", name: "Physics Faculty" },
  { id: "tbd", name: "TBD" },
];

const DEFAULT_ROOMS: Room[] = [
  { id: "ONLINE", name: "Online / Asynchronous", roomType: "virtual" },
  { id: "TBA-LECTURE", name: "TBA Lecture Hall", roomType: "lecture" },
  { id: "SC-312", name: "Science Center 312", roomType: "lab" },
];

function makeMeetingBlocks(
  days: DayOfWeek[] | DayOfWeek,
  start: string,
  end: string,
  roomId?: string
): MeetingBlock[] {
  const dayList = Array.isArray(days) ? days : [days];
  return dayList.map((day) => ({ day, startTime: start, endTime: end, roomId }));
}

const DEFAULT_SECTIONS: Section[] = [
  {
    id: "ASTR109-OL1",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "OL1",
    kind: "onlineOnly",
    modality: "Online",
    length: "1st 4 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR109-OL2",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "OL2",
    kind: "onlineOnly",
    modality: "Online",
    length: "2nd 8 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR109-OL3",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "OL3",
    kind: "onlineOnly",
    modality: "Online",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR109-OL4",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "OL4",
    kind: "onlineOnly",
    modality: "Online",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR110-OL1",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 110",
    courseTitle: "Astronomy II",
    sectionNumber: "OL1",
    kind: "onlineOnly",
    modality: "Online",
    length: "1st 8 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR110-OL2",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 110",
    courseTitle: "Astronomy II",
    sectionNumber: "OL2",
    kind: "onlineOnly",
    modality: "Online",
    length: "2nd 8 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR110-OL3",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 110",
    courseTitle: "Astronomy II",
    sectionNumber: "OL3",
    kind: "onlineOnly",
    modality: "Online",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: [],
  },
  {
    id: "ASTR109-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "01",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "13:15", "14:40", "TBA-LECTURE"),
  },
  {
    id: "ASTR109-02",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 109",
    courseTitle: "Intro Astronomy",
    sectionNumber: "02",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: makeMeetingBlocks(["Tue", "Thu"], "16:25", "17:50", "TBA-LECTURE"),
  },
  {
    id: "ASTR110-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 110",
    courseTitle: "Astronomy II",
    sectionNumber: "01",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "14:50", "16:15", "TBA-LECTURE"),
  },
  {
    id: "ASTR140-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "ASTR 140",
    courseTitle: "Astronomy Lab",
    sectionNumber: "01",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "astronomy-faculty",
    meetingBlocks: makeMeetingBlocks("Tue", "19:35", "22:35", "SC-312"),
  },
  {
    id: "PHYS109-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 109",
    courseTitle: "Intro Physics",
    sectionNumber: "01",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Tue", "13:15", "16:15", "SC-312"),
  },
  {
    id: "PHYS109L-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 109L",
    courseTitle: "Intro Physics Lab",
    sectionNumber: "01",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Thu", "13:15", "16:15", "SC-312"),
  },
  {
    id: "PHYS210L-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 210L",
    courseTitle: "General Physics Lab",
    sectionNumber: "01",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Mon", "16:25", "19:25", "SC-312"),
  },
  {
    id: "PHYS210-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 210",
    courseTitle: "General Physics I",
    sectionNumber: "01",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "19:35", "21:00", "TBA-LECTURE"),
  },
  {
    id: "PHYS211-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 211",
    courseTitle: "General Physics II",
    sectionNumber: "01",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "19:35", "21:00", "TBA-LECTURE"),
  },
  {
    id: "PHYS211L-01",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 211L",
    courseTitle: "Physics II Lab",
    sectionNumber: "01",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Wed", "16:25", "19:25", "SC-312"),
  },
  {
    id: "PHYS217L-Mon",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 217L",
    courseTitle: "Modern Physics Lab",
    sectionNumber: "M1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Mon", "10:05", "13:05", "SC-312"),
  },
  {
    id: "PHYS217-Comb1",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 217",
    courseTitle: "Modern Physics",
    sectionNumber: "01",
    kind: "combined",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "08:30", "09:55", "TBA-LECTURE"),
  },
  {
    id: "PHYS217L-Wed",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 217L",
    courseTitle: "Modern Physics Lab",
    sectionNumber: "W1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Wed", "10:05", "13:05", "SC-312"),
  },
  {
    id: "PHYS227L-Tue",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 227L",
    courseTitle: "Advanced Physics Lab",
    sectionNumber: "T1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Tue", "10:05", "13:05", "SC-312"),
  },
  {
    id: "PHYS227-Comb1",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 227",
    courseTitle: "Advanced Physics",
    sectionNumber: "01",
    kind: "combined",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Tue", "Thu"], "08:30", "09:55", "TBA-LECTURE"),
  },
  {
    id: "PHYS227L-Thu",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 227L",
    courseTitle: "Advanced Physics Lab",
    sectionNumber: "Th1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Thu", "10:05", "13:05", "SC-312"),
  },
  {
    id: "PHYS237L-Mon",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 237L",
    courseTitle: "Applied Physics Lab",
    sectionNumber: "M1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Mon", "13:15", "16:15", "SC-312"),
  },
  {
    id: "PHYS237-Comb1",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 237",
    courseTitle: "Applied Physics",
    sectionNumber: "01",
    kind: "combined",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Mon", "Wed"], "16:25", "17:50", "TBA-LECTURE"),
  },
  {
    id: "PHYS237L-Wed",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 237L",
    courseTitle: "Applied Physics Lab",
    sectionNumber: "W1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Wed", "13:15", "16:15", "SC-312"),
  },
  {
    id: "PHYS217L-Tue",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 217L",
    courseTitle: "Modern Physics Lab",
    sectionNumber: "T1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Tue", "16:25", "19:25", "SC-312"),
  },
  {
    id: "PHYS217-02",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 217",
    courseTitle: "Modern Physics",
    sectionNumber: "02",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Tue", "Thu"], "19:35", "21:00", "TBA-LECTURE"),
  },
  {
    id: "PHYS227L-ThuLate",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 227L",
    courseTitle: "Advanced Physics Lab",
    sectionNumber: "Th2",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Thu", "16:25", "19:25", "SC-312"),
  },
  {
    id: "PHYS227-02",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 227",
    courseTitle: "Advanced Physics",
    sectionNumber: "02",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Tue", "Thu"], "19:35", "21:00", "TBA-LECTURE"),
  },
  {
    id: "PHYS237L-Thu",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 237L",
    courseTitle: "Applied Physics Lab",
    sectionNumber: "Th1",
    kind: "lab",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks("Thu", "19:35", "22:35", "SC-312"),
  },
  {
    id: "PHYS237-02",
    scenarioId: "fall-2024-draft-a",
    courseCode: "PHYS 237",
    courseTitle: "Applied Physics",
    sectionNumber: "02",
    kind: "lecture",
    modality: "On Campus",
    length: "16 Weeks",
    instructorId: "physics-faculty",
    meetingBlocks: makeMeetingBlocks(["Tue", "Thu"], "18:00", "19:25", "TBA-LECTURE"),
  },
];

const DEFAULT_PATHWAYS: Pathway[] = [
  {
    id: "astronomy-track",
    name: "Astronomy Cohort",
    requiredCourseCodes: ["ASTR 109", "ASTR 110", "ASTR 140"],
  },
  {
    id: "physics-major",
    name: "Physics Major Core",
    requiredCourseCodes: ["PHYS 210", "PHYS 210L", "PHYS 211", "PHYS 211L"],
  },
];

function minutesFromTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatDayList(blocks: MeetingBlock[]): string {
  const days = blocks.map((b) => b.day);
  const unique = Array.from(new Set(days));
  return unique.join("/");
}

function sectionsOverlap(a: Section, b: Section): boolean {
  if (a.meetingBlocks.length === 0 || b.meetingBlocks.length === 0) {
    return false;
  }
  for (const blockA of a.meetingBlocks) {
    for (const blockB of b.meetingBlocks) {
      if (blockA.day !== blockB.day) continue;
      if (
        minutesFromTime(blockA.startTime) < minutesFromTime(blockB.endTime) &&
        minutesFromTime(blockB.startTime) < minutesFromTime(blockA.endTime)
      ) {
        return true;
      }
    }
  }
  return false;
}

function generateId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function computeConflicts(
  sections: Section[],
  instructors: Instructor[],
  rooms: Room[],
  pathways: Pathway[],
  labBufferMinutes: number
): ConflictSummary {
  const instructorMap = new Map(instructors.map((inst) => [inst.id, inst]));
  const roomMap = new Map(rooms.map((room) => [room.id, room]));

  const instructorSlots: Record<string, { section: Section; block: MeetingBlock }[]> =
    {};
  const roomSlots: Record<string, { section: Section; block: MeetingBlock }[]> = {};

  sections.forEach((section) => {
    section.meetingBlocks.forEach((block) => {
      const instSlots = instructorSlots[section.instructorId] || [];
      instSlots.push({ section, block });
      instructorSlots[section.instructorId] = instSlots;

      if (!block.roomId) return;
      const roomKey = `${block.roomId}__${block.day}`;
      const slots = roomSlots[roomKey] || [];
      slots.push({ section, block });
      roomSlots[roomKey] = slots;
    });
  });

  const instructorConflicts: InstructorConflict[] = [];
  Object.entries(instructorSlots).forEach(([instructorId, slots]) => {
    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (a.block.day !== b.block.day) continue;
        if (
          minutesFromTime(a.block.startTime) < minutesFromTime(b.block.endTime) &&
          minutesFromTime(b.block.startTime) < minutesFromTime(a.block.endTime)
        ) {
          instructorConflicts.push({
            instructorId,
            instructorName: instructorMap.get(instructorId)?.name || instructorId,
            sectionA: a.section,
            sectionB: b.section,
            blockA: a.block,
            blockB: b.block,
          });
        }
      }
    }
  });

  const roomConflicts: RoomConflict[] = [];
  const labBufferConflicts: LabBufferConflict[] = [];

  Object.entries(roomSlots).forEach(([key, slots]) => {
    const [roomId, day] = key.split("__") as [string, DayOfWeek];
    const room = roomMap.get(roomId);
    slots.sort((a, b) =>
      minutesFromTime(a.block.startTime) - minutesFromTime(b.block.startTime)
    );

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i];
        const b = slots[j];
        if (
          minutesFromTime(a.block.startTime) < minutesFromTime(b.block.endTime) &&
          minutesFromTime(b.block.startTime) < minutesFromTime(a.block.endTime)
        ) {
          roomConflicts.push({
            roomId,
            roomName: room?.name || roomId,
            day,
            sectionA: a.section,
            sectionB: b.section,
            blockA: a.block,
            blockB: b.block,
          });
        }
      }
    }

    if (room?.roomType === "lab") {
      for (let i = 0; i < slots.length - 1; i++) {
        const current = slots[i];
        const next = slots[i + 1];
        const gap =
          minutesFromTime(next.block.startTime) -
          minutesFromTime(current.block.endTime);
        if (gap < labBufferMinutes) {
          labBufferConflicts.push({
            roomId,
            roomName: room.name,
            day,
            firstSection: current.section,
            secondSection: next.section,
            firstBlock: current.block,
            secondBlock: next.block,
            gapMinutes: gap,
          });
        }
      }
    }
  });

  const pathwayIssues: PathwayIssue[] = [];

  pathways.forEach((pathway) => {
    const required = pathway.requiredCourseCodes;
    required.forEach((courseCode) => {
      const matches = sections.filter((section) => section.courseCode === courseCode);
      if (matches.length === 0) {
        pathwayIssues.push({
          pathwayId: pathway.id,
          pathwayName: pathway.name,
          details: `${courseCode}: no sections offered in this scenario`,
        });
      }
    });

    for (let i = 0; i < required.length; i++) {
      for (let j = i + 1; j < required.length; j++) {
        const courseA = required[i];
        const courseB = required[j];
        const sectionsA = sections.filter((section) => section.courseCode === courseA);
        const sectionsB = sections.filter((section) => section.courseCode === courseB);
        if (sectionsA.length === 0 || sectionsB.length === 0) continue;
        const allPairsConflict = sectionsA.every((sectionA) =>
          sectionsB.every((sectionB) => sectionsOverlap(sectionA, sectionB))
        );
        if (allPairsConflict) {
          pathwayIssues.push({
            pathwayId: pathway.id,
            pathwayName: pathway.name,
            details: `${courseA} conflicts with ${courseB} for all available sections`,
          });
        }
      }
    }
  });

  return {
    instructorConflicts,
    roomConflicts,
    labBufferConflicts,
    pathwayIssues,
  };
}

interface WeeklyCalendarProps {
  sections: Section[];
  rooms: Room[];
  conflictSectionIds: Set<string>;
  filteredInstructorId?: string;
}

function WeeklyCalendar({
  sections,
  rooms,
  conflictSectionIds,
  filteredInstructorId,
}: WeeklyCalendarProps) {
  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [
    rooms,
  ]);

  const blocks = useMemo(() => {
    return sections
      .filter((section) =>
        filteredInstructorId && filteredInstructorId !== "all"
          ? section.instructorId === filteredInstructorId
          : true
      )
      .flatMap((section) =>
        section.meetingBlocks.map((block) => ({ section, block }))
      );
  }, [sections, filteredInstructorId]);

  const hasBlocks = blocks.length > 0;
  const earliest = hasBlocks
    ? Math.min(...blocks.map((item) => minutesFromTime(item.block.startTime)))
    : 8 * 60;
  const latest = hasBlocks
    ? Math.max(...blocks.map((item) => minutesFromTime(item.block.endTime)))
    : 18 * 60;
  const span = Math.max(latest - earliest, 60);

  return (
    <div
      style={{
        border: "1px solid #d4d4d8",
        borderRadius: 8,
        overflow: "hidden",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px repeat(7, 1fr)",
          background: "#f4f4f5",
          fontSize: 12,
          fontWeight: 600,
        }}
      >
        <div style={{ padding: "8px 4px" }}>Time</div>
        {DAY_SEQUENCE.map((day) => (
          <div key={day} style={{ padding: "8px 4px", textAlign: "center" }}>
            {day}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "80px repeat(7, 1fr)",
          minHeight: 520,
          position: "relative",
        }}
      >
        <div
          style={{
            borderRight: "1px solid #e4e4e7",
            padding: "8px 4px",
            fontSize: 11,
            background: "#fff",
          }}
        >
          {Array.from({ length: Math.ceil(span / 60) + 1 }).map((_, index) => {
            const minutes = earliest + index * 60;
            const hours = Math.floor(minutes / 60)
              .toString()
              .padStart(2, "0");
            const mins = (minutes % 60).toString().padStart(2, "0");
            return (
              <div key={index} style={{ marginBottom: index === 0 ? 0 : 44 }}>
                {hours}:{mins}
              </div>
            );
          })}
        </div>
        {DAY_SEQUENCE.map((day) => (
          <div
            key={day}
            style={{
              borderLeft: "1px solid #e4e4e7",
              borderRight: "1px solid #e4e4e7",
              position: "relative",
              background: "#fff",
            }}
          >
            {blocks
              .filter((item) => item.block.day === day)
              .map(({ section, block }) => {
                const startOffset =
                  ((minutesFromTime(block.startTime) - earliest) / span) * 100;
                const height =
                  ((minutesFromTime(block.endTime) -
                    minutesFromTime(block.startTime)) /
                    span) *
                  100;
                const roomName = block.roomId
                  ? roomMap.get(block.roomId)?.name || block.roomId
                  : "TBA";
                const inConflict = conflictSectionIds.has(section.id);
                return (
                  <div
                    key={`${section.id}-${block.day}-${block.startTime}`}
                    style={{
                      position: "absolute",
                      top: `${startOffset}%`,
                      left: 8,
                      right: 8,
                      height: `${Math.max(height, 5)}%`,
                      borderRadius: 6,
                      border: inConflict ? "2px solid #ef4444" : "1px solid #94a3b8",
                      background:
                        SECTION_KIND_COLORS[section.kind] || SECTION_KIND_COLORS.other,
                      padding: 6,
                      boxSizing: "border-box",
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                      fontSize: 11,
                      color: "#0f172a",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>
                      {section.courseCode} • {section.sectionNumber}
                    </div>
                    <div>{section.courseTitle}</div>
                    <div>
                      {block.startTime} – {block.endTime} ({roomName})
                    </div>
                    <div style={{ fontStyle: "italic" }}>
                      {SECTION_KIND_LABELS[section.kind]}
                    </div>
                  </div>
                );
              })}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SectionTableProps {
  sections: Section[];
  instructors: Instructor[];
  rooms: Room[];
  onRemove: (id: string) => void;
  filterInstructorId?: string;
}

function SectionTable({
  sections,
  instructors,
  rooms,
  onRemove,
  filterInstructorId,
}: SectionTableProps) {
  const instructorMap = useMemo(
    () => new Map(instructors.map((inst) => [inst.id, inst])),
    [instructors]
  );
  const roomMap = useMemo(() => new Map(rooms.map((room) => [room.id, room])), [
    rooms,
  ]);

  const filteredSections = useMemo(() => {
    return sections.filter((section) =>
      filterInstructorId && filterInstructorId !== "all"
        ? section.instructorId === filterInstructorId
        : true
    );
  }, [sections, filterInstructorId]);

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontFamily: "system-ui, sans-serif",
          fontSize: 13,
        }}
      >
        <thead>
          <tr style={{ background: "#f4f4f5", textAlign: "left" }}>
            {[
              "Section",
              "Course",
              "#",
              "Modality",
              "Length",
              "Type",
              "Room",
              "Days",
              "Start",
              "End",
              "Instructor",
              "",
            ].map((header) => (
              <th
                key={header}
                style={{
                  padding: "8px 6px",
                  borderBottom: "1px solid #e4e4e7",
                  fontWeight: 600,
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredSections.map((section) => {
            const meeting = section.meetingBlocks;
            const firstBlock = meeting[0];
            const start = firstBlock?.startTime ?? "—";
            const end = firstBlock?.endTime ?? "—";
            const roomName = firstBlock?.roomId
              ? roomMap.get(firstBlock.roomId)?.name || firstBlock.roomId
              : section.meetingBlocks.length > 0
              ? "Multiple"
              : "—";
            return (
              <tr key={section.id} style={{ borderBottom: "1px solid #e4e4e7" }}>
                <td style={{ padding: "8px 6px", fontWeight: 600 }}>
                  {section.courseCode}
                </td>
                <td style={{ padding: "8px 6px" }}>{section.courseTitle}</td>
                <td style={{ padding: "8px 6px" }}>{section.sectionNumber}</td>
                <td style={{ padding: "8px 6px" }}>{section.modality}</td>
                <td style={{ padding: "8px 6px" }}>{section.length}</td>
                <td style={{ padding: "8px 6px" }}>
                  {SECTION_KIND_LABELS[section.kind]}
                </td>
                <td style={{ padding: "8px 6px" }}>{roomName}</td>
                <td style={{ padding: "8px 6px" }}>
                  {section.meetingBlocks.length > 0
                    ? formatDayList(section.meetingBlocks)
                    : "—"}
                </td>
                <td style={{ padding: "8px 6px" }}>{start}</td>
                <td style={{ padding: "8px 6px" }}>{end}</td>
                <td style={{ padding: "8px 6px" }}>
                  {instructorMap.get(section.instructorId)?.name || "TBD"}
                </td>
                <td style={{ padding: "8px 6px" }}>
                  <button
                    onClick={() => onRemove(section.id)}
                    style={{
                      background: "transparent",
                      border: "1px solid #ef4444",
                      color: "#ef4444",
                      borderRadius: 4,
                      padding: "4px 8px",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface SectionDraft {
  courseCode: string;
  courseTitle: string;
  sectionNumber: string;
  kind: SectionKind;
  modality: Modality;
  length: string;
  instructorName: string;
  meetingBlocks: MeetingBlock[];
  notes?: string;
}

interface SectionFormProps {
  instructors: Instructor[];
  rooms: Room[];
  onCreate: (draft: SectionDraft) => void;
}

function SectionForm({ instructors, rooms, onCreate }: SectionFormProps) {
  const [courseCode, setCourseCode] = useState("ASTR 101");
  const [courseTitle, setCourseTitle] = useState("New Course");
  const [sectionNumber, setSectionNumber] = useState("01");
  const [kind, setKind] = useState<SectionKind>("lecture");
  const [modality, setModality] = useState<Modality>("On Campus");
  const [length, setLength] = useState("16 Weeks");
  const [instructorName, setInstructorName] = useState(
    instructors[0]?.name || "TBD"
  );
  const [meetingBlocks, setMeetingBlocks] = useState<MeetingBlock[]>([
    { day: "Mon", startTime: "09:00", endTime: "10:15", roomId: rooms[1]?.id },
  ]);
  const [errors, setErrors] = useState<string[]>([]);

  function updateMeetingBlock(
    index: number,
    field: keyof MeetingBlock,
    value: string
  ) {
    setMeetingBlocks((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value } as MeetingBlock;
      return copy;
    });
  }

  function addBlock() {
    setMeetingBlocks((prev) => [
      ...prev,
      {
        day: "Tue",
        startTime: "09:00",
        endTime: "10:15",
        roomId: rooms[1]?.id,
      },
    ]);
  }

  function removeBlock(index: number) {
    setMeetingBlocks((prev) => prev.filter((_, idx) => idx !== index));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const validationErrors: string[] = [];

    if (!courseCode.trim()) validationErrors.push("Course code is required");
    if (!courseTitle.trim()) validationErrors.push("Course title is required");
    if (!sectionNumber.trim()) validationErrors.push("Section number is required");
    if (!instructorName.trim()) validationErrors.push("Instructor is required");

    meetingBlocks.forEach((block, index) => {
      if (!block.day) validationErrors.push(`Meeting ${index + 1}: day is required`);
      if (!block.startTime || !block.endTime) {
        validationErrors.push(`Meeting ${index + 1}: start and end times required`);
      } else if (minutesFromTime(block.endTime) <= minutesFromTime(block.startTime)) {
        validationErrors.push(`Meeting ${index + 1}: end time must be after start`);
      }
    });

    if (modality !== "Online" && meetingBlocks.length === 0) {
      validationErrors.push("Add at least one meeting block for on-campus sections");
    }

    setErrors(validationErrors);
    if (validationErrors.length > 0) return;

    onCreate({
      courseCode: courseCode.trim(),
      courseTitle: courseTitle.trim(),
      sectionNumber: sectionNumber.trim(),
      kind,
      modality,
      length,
      instructorName: instructorName.trim(),
      meetingBlocks: meetingBlocks.map((block) => ({ ...block })),
    });

    setCourseCode("ASTR 101");
    setCourseTitle("New Course");
    setSectionNumber("01");
    setKind("lecture");
    setModality("On Campus");
    setLength("16 Weeks");
    setInstructorName(instructors[0]?.name || "TBD");
    setMeetingBlocks([
      { day: "Mon", startTime: "09:00", endTime: "10:15", roomId: rooms[1]?.id },
    ]);
    setErrors([]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        border: "1px solid #e4e4e7",
        borderRadius: 8,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        background: "#fff",
      }}
    >
      <h3 style={{ margin: 0, fontSize: 16 }}>Add Section</h3>
      {errors.length > 0 && (
        <div
          style={{
            background: "#fee2e2",
            border: "1px solid #fca5a5",
            borderRadius: 6,
            padding: 8,
            fontSize: 12,
            color: "#991b1b",
          }}
        >
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Course code</span>
        <input
          value={courseCode}
          onChange={(event) => setCourseCode(event.target.value)}
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 14,
          }}
        />
      </label>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Course title</span>
        <input
          value={courseTitle}
          onChange={(event) => setCourseTitle(event.target.value)}
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 14,
          }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Section #</span>
          <input
            value={sectionNumber}
            onChange={(event) => setSectionNumber(event.target.value)}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Length</span>
          <input
            value={length}
            onChange={(event) => setLength(event.target.value)}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 14,
            }}
          />
        </label>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Modality</span>
          <select
            value={modality}
            onChange={(event) => setModality(event.target.value as Modality)}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 14,
            }}
          >
            <option value="On Campus">On Campus</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Type</span>
          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as SectionKind)}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 14,
            }}
          >
            {Object.entries(SECTION_KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Instructor</span>
        <input
          list="instructor-options"
          value={instructorName}
          onChange={(event) => setInstructorName(event.target.value)}
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 14,
          }}
        />
        <datalist id="instructor-options">
          {instructors.map((inst) => (
            <option key={inst.id} value={inst.name} />
          ))}
        </datalist>
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Meeting blocks</span>
        <button
          type="button"
          onClick={addBlock}
          style={{
            background: "transparent",
            border: "1px solid #2563eb",
            color: "#2563eb",
            borderRadius: 4,
            padding: "4px 8px",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          + Add block
        </button>
      </div>
      {meetingBlocks.length === 0 && (
        <p style={{ fontSize: 12, color: "#6b7280", margin: 0 }}>
          Online sections can be saved without a meeting block.
        </p>
      )}
      {meetingBlocks.map((block, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #e4e4e7",
            borderRadius: 6,
            padding: 12,
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
            gap: 8,
            alignItems: "center",
            fontSize: 13,
            background: "#f9fafb",
          }}
        >
          <select
            value={block.day}
            onChange={(event) =>
              updateMeetingBlock(index, "day", event.target.value as DayOfWeek)
            }
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
            }}
          >
            {DAY_SEQUENCE.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={block.startTime}
            onChange={(event) =>
              updateMeetingBlock(index, "startTime", event.target.value)
            }
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
            }}
          />
          <input
            type="time"
            value={block.endTime}
            onChange={(event) =>
              updateMeetingBlock(index, "endTime", event.target.value)
            }
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
            }}
          />
          <select
            value={block.roomId ?? ""}
            onChange={(event) =>
              updateMeetingBlock(index, "roomId", event.target.value)
            }
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
            }}
          >
            <option value="">— Room —</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => removeBlock(index)}
            style={{
              background: "transparent",
              border: "1px solid #ef4444",
              color: "#ef4444",
              borderRadius: 4,
              padding: "4px 6px",
              cursor: "pointer",
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="submit"
        style={{
          background: "#2563eb",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          padding: "10px 12px",
          fontSize: 14,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Save section
      </button>
    </form>
  );
}

interface QuickAddItemProps {
  label: string;
  placeholder: string;
  onAdd: (value: string) => void;
}

function QuickAddItem({ label, placeholder, onAdd }: QuickAddItemProps) {
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    onAdd(value.trim());
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8 }}>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1,
          borderRadius: 6,
          border: "1px solid #d4d4d8",
          padding: "6px 8px",
          fontSize: 13,
        }}
      />
      <button
        type="submit"
        style={{
          borderRadius: 6,
          border: "1px solid #2563eb",
          padding: "6px 10px",
          background: "#2563eb",
          color: "#fff",
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Add {label}
      </button>
    </form>
  );
}

interface ConstraintsReportProps {
  summary: ConflictSummary;
}

function ConstraintsReport({ summary }: ConstraintsReportProps) {
  return (
    <div
      style={{
        display: "grid",
        gap: 24,
        fontFamily: "system-ui, sans-serif",
        fontSize: 14,
      }}
    >
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Instructor conflicts</h2>
        {summary.instructorConflicts.length === 0 ? (
          <p style={{ color: "#4b5563", fontSize: 13 }}>No conflicts detected.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {summary.instructorConflicts.map((conflict, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <strong>{conflict.instructorName}</strong> – {conflict.sectionA.courseCode} vs
                {" "}
                {conflict.sectionB.courseCode} ({conflict.blockA.day} {" "}
                {conflict.blockA.startTime}–{conflict.blockA.endTime} overlaps {" "}
                {conflict.blockB.startTime}–{conflict.blockB.endTime})
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Room conflicts</h2>
        {summary.roomConflicts.length === 0 ? (
          <p style={{ color: "#4b5563", fontSize: 13 }}>No conflicts detected.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {summary.roomConflicts.map((conflict, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <strong>{conflict.roomName}</strong> ({conflict.day}) – {conflict.sectionA.courseCode}{" "}
                vs {conflict.sectionB.courseCode} ({conflict.blockA.startTime}–
                {conflict.blockA.endTime} overlaps {conflict.blockB.startTime}–
                {conflict.blockB.endTime})
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Lab buffer warnings</h2>
        {summary.labBufferConflicts.length === 0 ? (
          <p style={{ color: "#4b5563", fontSize: 13 }}>No lab buffer issues.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {summary.labBufferConflicts.map((conflict, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <strong>{conflict.roomName}</strong> ({conflict.day}) – {conflict.firstSection.courseCode}{" "}
                ends {conflict.firstBlock.endTime}; next block {conflict.secondSection.courseCode}{" "}
                starts {conflict.secondBlock.startTime}. Gap: {conflict.gapMinutes} min.
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Pathway issues</h2>
        {summary.pathwayIssues.length === 0 ? (
          <p style={{ color: "#4b5563", fontSize: 13 }}>All pathways are feasible.</p>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            {summary.pathwayIssues.map((issue, index) => (
              <li key={index} style={{ marginBottom: 8 }}>
                <strong>{issue.pathwayName}:</strong> {issue.details}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface PathwayManagerProps {
  pathways: Pathway[];
  onAdd: (name: string, courses: string[]) => void;
  onRemove: (id: string) => void;
}

function PathwayManager({ pathways, onAdd, onRemove }: PathwayManagerProps) {
  const [name, setName] = useState("");
  const [courses, setCourses] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Pathway name is required");
      return;
    }
    const tokens = courses
      .split(/[,\n]/)
      .map((token) => token.trim())
      .filter(Boolean);
    if (tokens.length === 0) {
      setError("List at least one course code");
      return;
    }
    onAdd(name.trim(), tokens);
    setName("");
    setCourses("");
    setError("");
  }

  return (
    <div style={{ display: "grid", gap: 16, fontFamily: "system-ui, sans-serif" }}>
      <form
        onSubmit={handleSubmit}
        style={{
          border: "1px solid #e4e4e7",
          borderRadius: 8,
          padding: 16,
          display: "grid",
          gap: 12,
          background: "#fff",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Add pathway</h2>
        {error && (
          <div
            style={{
              background: "#fee2e2",
              border: "1px solid #fca5a5",
              borderRadius: 6,
              padding: 8,
              fontSize: 12,
              color: "#991b1b",
            }}
          >
            {error}
          </div>
        )}
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Pathway name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 14,
            }}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 600 }}>Required courses</span>
          <textarea
            value={courses}
            onChange={(event) => setCourses(event.target.value)}
            placeholder="Enter course codes separated by commas or new lines"
            rows={3}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              fontSize: 13,
              resize: "vertical",
            }}
          />
        </label>
        <button
          type="submit"
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            padding: "10px 12px",
            fontSize: 14,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Save pathway
        </button>
      </form>
      <div style={{ display: "grid", gap: 12 }}>
        {pathways.map((pathway) => (
          <div
            key={pathway.id}
            style={{
              border: "1px solid #e4e4e7",
              borderRadius: 8,
              padding: 16,
              background: "#f9fafb",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>{pathway.name}</h3>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{pathway.id}</div>
              </div>
              <button
                onClick={() => onRemove(pathway.id)}
                style={{
                  background: "transparent",
                  border: "1px solid #ef4444",
                  color: "#ef4444",
                  borderRadius: 4,
                  padding: "4px 8px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Remove
              </button>
            </div>
            <div style={{ fontSize: 13 }}>
              <strong>Required:</strong> {pathway.requiredCourseCodes.join(", ")}
            </div>
          </div>
        ))}
        {pathways.length === 0 && (
          <p style={{ fontSize: 13, color: "#6b7280" }}>
            No pathways defined yet. Add one above to check pathway feasibility.
          </p>
        )}
      </div>
    </div>
  );
}

interface ImportExportPanelProps {
  onExport: () => void;
  onImport: (data: ExportedData) => void;
  onReset: () => void;
}

function ImportExportPanel({ onExport, onImport, onReset }: ImportExportPanelProps) {
  const [error, setError] = useState<string>("");

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result?.toString() || "";
        const parsed = JSON.parse(text);
        if (isImportPayload(parsed)) {
          onImport(parsed);
          setError("");
        } else {
          setError("Invalid schedule file format");
        }
      } catch (err) {
        setError("Could not parse file");
      }
    };
    reader.readAsText(file);
  }

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <button
        onClick={onExport}
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #2563eb",
          background: "#2563eb",
          color: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Export data
      </button>
      <label
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #d4d4d8",
          background: "#fff",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Import JSON
        <input
          type="file"
          accept="application/json"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>
      <button
        onClick={onReset}
        style={{
          padding: "8px 12px",
          borderRadius: 6,
          border: "1px solid #f59e0b",
          background: "#fef3c7",
          color: "#92400e",
          cursor: "pointer",
          fontWeight: 600,
        }}
      >
        Reset to sample
      </button>
      {error && <span style={{ color: "#ef4444" }}>{error}</span>}
    </div>
  );
}

function isImportPayload(value: unknown): value is ExportedData {
  if (!value || typeof value !== "object") return false;
  const payload = value as Partial<ExportedData>;
  return (
    Array.isArray(payload.scenarios) &&
    Array.isArray(payload.sections) &&
    Array.isArray(payload.instructors) &&
    Array.isArray(payload.rooms) &&
    Array.isArray(payload.pathways) &&
    typeof payload.labBufferMinutes === "number"
  );
}

interface ScenarioSelectorProps {
  scenarios: Scenario[];
  activeScenarioId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string, term: string) => void;
}

function ScenarioSelector({
  scenarios,
  activeScenarioId,
  onSelect,
  onCreate,
}: ScenarioSelectorProps) {
  const [name, setName] = useState("");
  const [term, setTerm] = useState("");

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !term.trim()) return;
    onCreate(name.trim(), term.trim());
    setName("");
    setTerm("");
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>Scenario:</span>
        <select
          value={activeScenarioId}
          onChange={(event) => onSelect(event.target.value)}
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 14,
          }}
        >
          {scenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.term} — {scenario.name}
            </option>
          ))}
        </select>
      </div>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
      >
        <span style={{ fontWeight: 600 }}>New scenario:</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name (Draft B)"
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 13,
          }}
        />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Term (Spring 2025)"
          style={{
            borderRadius: 6,
            border: "1px solid #d4d4d8",
            padding: "6px 8px",
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          style={{
            borderRadius: 6,
            border: "1px solid #16a34a",
            background: "#16a34a",
            color: "#fff",
            padding: "6px 10px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Create scenario
        </button>
      </form>
    </div>
  );
}

type TabKey = "schedule" | "constraints" | "pathways";

type ViewMode = "calendar" | "table";

const EXPORT_VERSION = 1;

export default function App() {
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [activeScenarioId, setActiveScenarioId] = useState<string>(
    DEFAULT_SCENARIOS[0].id
  );
  const [sections, setSections] = useState<Section[]>(DEFAULT_SECTIONS);
  const [instructors, setInstructors] = useState<Instructor[]>(
    DEFAULT_INSTRUCTORS
  );
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [pathways, setPathways] = useState<Pathway[]>(DEFAULT_PATHWAYS);
  const [labBufferMinutes, setLabBufferMinutes] = useState<number>(30);
  const [tab, setTab] = useState<TabKey>("schedule");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [instructorFilter, setInstructorFilter] = useState<string>("all");
  const [hydrated, setHydrated] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setHydrated(true);
        return;
      }
      const parsed = JSON.parse(raw);
      if (isImportPayload(parsed)) {
        setScenarios(parsed.scenarios);
        setSections(parsed.sections);
        setInstructors(parsed.instructors);
        setRooms(parsed.rooms);
        setPathways(parsed.pathways);
        setLabBufferMinutes(parsed.labBufferMinutes);
        if (parsed.scenarios.length > 0) {
          setActiveScenarioId(parsed.scenarios[0].id);
        }
      }
    } catch (err) {
      console.warn("Failed to load saved state", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (typeof window === "undefined") return;
    const payload: ExportedData = {
      version: EXPORT_VERSION,
      scenarios,
      sections,
      instructors,
      rooms,
      pathways,
      labBufferMinutes,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    hydrated,
    scenarios,
    sections,
    instructors,
    rooms,
    pathways,
    labBufferMinutes,
  ]);

  const activeScenario = scenarios.find((scenario) => scenario.id === activeScenarioId);
  const sectionsForScenario = useMemo(
    () => sections.filter((section) => section.scenarioId === activeScenarioId),
    [sections, activeScenarioId]
  );

  const conflicts = useMemo(
    () => computeConflicts(sectionsForScenario, instructors, rooms, pathways, labBufferMinutes),
    [sectionsForScenario, instructors, rooms, pathways, labBufferMinutes]
  );

  const conflictSectionIds = useMemo(() => {
    const ids = new Set<string>();
    conflicts.instructorConflicts.forEach((item) => {
      ids.add(item.sectionA.id);
      ids.add(item.sectionB.id);
    });
    conflicts.roomConflicts.forEach((item) => {
      ids.add(item.sectionA.id);
      ids.add(item.sectionB.id);
    });
    conflicts.labBufferConflicts.forEach((item) => {
      ids.add(item.firstSection.id);
      ids.add(item.secondSection.id);
    });
    return ids;
  }, [conflicts]);

  function ensureInstructor(name: string): string {
    const existing = instructors.find(
      (instructor) => instructor.name.toLowerCase() === name.toLowerCase()
    );
    if (existing) return existing.id;
    const newInstructor: Instructor = {
      id: generateId("inst"),
      name,
    };
    setInstructors((prev) => [...prev, newInstructor]);
    return newInstructor.id;
  }

  function handleAddSection(draft: SectionDraft) {
    const instructorId = ensureInstructor(draft.instructorName);
    const newSection: Section = {
      id: generateId("section"),
      scenarioId: activeScenarioId,
      courseCode: draft.courseCode,
      courseTitle: draft.courseTitle,
      sectionNumber: draft.sectionNumber,
      kind: draft.kind,
      modality: draft.modality,
      length: draft.length,
      instructorId,
      meetingBlocks: draft.meetingBlocks.map((block) => ({ ...block })),
    };
    setSections((prev) => [...prev, newSection]);
  }

  function handleRemoveSection(id: string) {
    setSections((prev) => prev.filter((section) => section.id !== id));
  }

  function handleAddInstructor(name: string) {
    ensureInstructor(name);
  }

  function handleAddRoom(name: string) {
    const exists = rooms.find(
      (room) => room.name.toLowerCase() === name.toLowerCase()
    );
    if (exists) return;
    const newRoom: Room = {
      id: generateId("room"),
      name,
      roomType: "lecture",
    };
    setRooms((prev) => [...prev, newRoom]);
  }

  function handleCreateScenario(name: string, term: string) {
    const newScenario: Scenario = {
      id: generateId("scenario"),
      name,
      term,
    };
    setScenarios((prev) => [...prev, newScenario]);
    setActiveScenarioId(newScenario.id);
  }

  function handleAddPathway(name: string, courses: string[]) {
    const newPathway: Pathway = {
      id: generateId("pathway"),
      name,
      requiredCourseCodes: courses,
    };
    setPathways((prev) => [...prev, newPathway]);
  }

  function handleRemovePathway(id: string) {
    setPathways((prev) => prev.filter((pathway) => pathway.id !== id));
  }

  function handleExport() {
    const payload: ExportedData = {
      version: EXPORT_VERSION,
      scenarios,
      sections,
      instructors,
      rooms,
      pathways,
      labBufferMinutes,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `department-schedule-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleImport(data: ExportedData) {
    setScenarios(data.scenarios);
    setSections(data.sections);
    setInstructors(data.instructors);
    setRooms(data.rooms);
    setPathways(data.pathways);
    setLabBufferMinutes(data.labBufferMinutes);
    if (data.scenarios.length > 0) {
      setActiveScenarioId(data.scenarios[0].id);
    }
  }

  function handleReset() {
    setScenarios(DEFAULT_SCENARIOS);
    setActiveScenarioId(DEFAULT_SCENARIOS[0].id);
    setSections(DEFAULT_SECTIONS);
    setInstructors(DEFAULT_INSTRUCTORS);
    setRooms(DEFAULT_ROOMS);
    setPathways(DEFAULT_PATHWAYS);
    setLabBufferMinutes(30);
  }

  const onlineSections = sectionsForScenario.filter(
    (section) => section.modality === "Online"
  );

  return (
    <div style={{ padding: 24, background: "#f3f4f6", minHeight: "100vh" }}>
      <header style={{ marginBottom: 24, fontFamily: "system-ui, sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28 }}>Department Schedule Planner</h1>
            <p style={{ margin: "4px 0", color: "#4b5563", fontSize: 14 }}>
              Build offerings, validate instructor/room availability, and keep student pathways
              on track. Data stays in your browser and can be exported for GitHub Pages hosting.
            </p>
          </div>
          <ImportExportPanel
            onExport={handleExport}
            onImport={handleImport}
            onReset={handleReset}
          />
        </div>
        <ScenarioSelector
          scenarios={scenarios}
          activeScenarioId={activeScenarioId}
          onSelect={setActiveScenarioId}
          onCreate={handleCreateScenario}
        />
        <div
          style={{
            marginTop: 12,
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
            fontSize: 13,
            alignItems: "center",
          }}
        >
          <span style={{ fontWeight: 600 }}>Lab buffer (minutes):</span>
          <input
            type="number"
            value={labBufferMinutes}
            min={0}
            step={5}
            onChange={(event) => setLabBufferMinutes(Number(event.target.value))}
            style={{
              borderRadius: 6,
              border: "1px solid #d4d4d8",
              padding: "6px 8px",
              width: 80,
            }}
          />
          {activeScenario && (
            <span style={{ color: "#6b7280" }}>
              Active scenario: {activeScenario.term} — {activeScenario.name}
            </span>
          )}
          <span style={{ color: "#ef4444", fontWeight: 600 }}>
            Conflicts detected: {conflictSectionIds.size}
          </span>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {(
          [
            { key: "schedule", label: "Schedule builder" },
            { key: "constraints", label: "Constraints" },
            { key: "pathways", label: "Pathways" },
          ] as { key: TabKey; label: string }[]
        ).map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            style={{
              padding: "8px 12px",
              borderRadius: 6,
              border: "1px solid #2563eb",
              background: tab === item.key ? "#2563eb" : "transparent",
              color: tab === item.key ? "#fff" : "#2563eb",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === "schedule" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                fontFamily: "system-ui, sans-serif",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600 }}>View:</span>
              <button
                onClick={() => setViewMode("calendar")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                  background: viewMode === "calendar" ? "#2563eb" : "#fff",
                  color: viewMode === "calendar" ? "#fff" : "#111827",
                  cursor: "pointer",
                }}
              >
                Calendar
              </button>
              <button
                onClick={() => setViewMode("table")}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                  background: viewMode === "table" ? "#2563eb" : "#fff",
                  color: viewMode === "table" ? "#fff" : "#111827",
                  cursor: "pointer",
                }}
              >
                Table
              </button>
              <span style={{ marginLeft: "auto", fontWeight: 600 }}>Instructor filter</span>
              <select
                value={instructorFilter}
                onChange={(event) => setInstructorFilter(event.target.value)}
                style={{
                  borderRadius: 6,
                  border: "1px solid #d4d4d8",
                  padding: "6px 8px",
                }}
              >
                <option value="all">All instructors</option>
                {instructors.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.name}
                  </option>
                ))}
              </select>
            </div>
            {viewMode === "calendar" ? (
              <WeeklyCalendar
                sections={sectionsForScenario}
                rooms={rooms}
                conflictSectionIds={conflictSectionIds}
                filteredInstructorId={instructorFilter}
              />
            ) : (
              <SectionTable
                sections={sectionsForScenario}
                instructors={instructors}
                rooms={rooms}
                onRemove={handleRemoveSection}
                filterInstructorId={instructorFilter}
              />
            )}
            {onlineSections.length > 0 && (
              <div
                style={{
                  border: "1px solid #cbd5f5",
                  borderRadius: 8,
                  background: "#eef2ff",
                  padding: 16,
                  fontFamily: "system-ui, sans-serif",
                }}
              >
                <h3 style={{ marginTop: 0 }}>Online offerings</h3>
                <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                  {onlineSections.map((section) => (
                    <li key={section.id}>
                      {section.courseCode} ({section.length}) — {section.sectionNumber}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gap: 24 }}>
            <SectionForm
              instructors={instructors}
              rooms={rooms}
              onCreate={handleAddSection}
            />
            <div
              style={{
                border: "1px solid #e4e4e7",
                borderRadius: 8,
                padding: 16,
                background: "#fff",
                display: "grid",
                gap: 12,
                fontFamily: "system-ui, sans-serif",
              }}
            >
              <h3 style={{ margin: 0 }}>Quick add resources</h3>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Instructors</div>
                <QuickAddItem
                  label="instructor"
                  placeholder="Dr. Smith"
                  onAdd={handleAddInstructor}
                />
                <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 12, color: "#6b7280" }}>
                  {instructors.map((inst) => (
                    <li key={inst.id}>{inst.name}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Rooms</div>
                <QuickAddItem
                  label="room"
                  placeholder="Science Hall 101"
                  onAdd={handleAddRoom}
                />
                <ul style={{ marginTop: 8, paddingLeft: 20, fontSize: 12, color: "#6b7280" }}>
                  {rooms.map((room) => (
                    <li key={room.id}>
                      {room.name} ({room.roomType})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "constraints" && <ConstraintsReport summary={conflicts} />}

      {tab === "pathways" && (
        <PathwayManager
          pathways={pathways}
          onAdd={handleAddPathway}
          onRemove={handleRemovePathway}
        />
      )}
    </div>
  );
}

