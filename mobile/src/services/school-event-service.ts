import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";

import {
  createContentNotifications,
} from "@/services/content-notification-api-service";

import type {
  SaveSchoolEventInput,
  SchoolEvent,
  SchoolEventAuthorRole,
  SchoolEventCategory,
  SchoolEventStatus,
} from "@/types/school-event";

const categories: SchoolEventCategory[] = [
  "academic",
  "sport",
  "meeting",
  "holiday",
  "other",
];

const statuses: SchoolEventStatus[] = [
  "scheduled",
  "cancelled",
];

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function readTimestamp(
  value: unknown,
): Timestamp | null {
  return value instanceof Timestamp
    ? value
    : null;
}

function readCategory(
  value: unknown,
): SchoolEventCategory {
  return categories.includes(
    value as SchoolEventCategory,
  )
    ? (value as SchoolEventCategory)
    : "other";
}

function readStatus(
  value: unknown,
): SchoolEventStatus {
  return statuses.includes(
    value as SchoolEventStatus,
  )
    ? (value as SchoolEventStatus)
    : "cancelled";
}

function mapSchoolEvent(
  snapshot:
    QueryDocumentSnapshot<DocumentData>,
): SchoolEvent {
  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    title:
      readString(
        data.title,
      ),

    description:
      readString(
        data.description,
      ),

    category:
      readCategory(
        data.category,
      ),

    location:
      readString(
        data.location,
      ),

    startAt:
      readTimestamp(
        data.startAt,
      ),

    endAt:
      readTimestamp(
        data.endAt,
      ),

    audience:
      data.audience === "class"
        ? "class"
        : "allParents",

    targetClassId:
      readString(
        data.targetClassId,
      ),

    targetClassName:
      readString(
        data.targetClassName,
      ),

    authorUid:
      readString(
        data.authorUid,
      ),

    authorName:
      readString(
        data.authorName,
      ),

    authorRole:
      data.authorRole ===
      "teacher"
        ? "teacher"
        : "admin",

    status:
      readStatus(
        data.status,
      ),

    createdAt:
      readTimestamp(
        data.createdAt,
      ),

    updatedAt:
      readTimestamp(
        data.updatedAt,
      ),
  };
}

function sortSchoolEvents(
  events: SchoolEvent[],
): SchoolEvent[] {
  return [...events].sort(
    (
      first,
      second,
    ) =>
      (
        first.startAt
          ?.toMillis() ??
        0
      ) -
      (
        second.startAt
          ?.toMillis() ??
        0
      ),
  );
}

function validateText(
  value: string,
  label: string,
  minimum: number,
  maximum: number,
): string {
  const cleanedValue =
    value.trim();

  if (
    cleanedValue.length <
      minimum ||
    cleanedValue.length >
      maximum
  ) {
    throw new Error(
      `${label} must contain between ${minimum} and ${maximum} characters.`,
    );
  }

  return cleanedValue;
}

function validateInput(
  input: SaveSchoolEventInput,
  authorRole:
    SchoolEventAuthorRole,
): SaveSchoolEventInput {
  if (
    !categories.includes(
      input.category,
    )
  ) {
    throw new Error(
      "Select a valid event category.",
    );
  }

  if (
    Number.isNaN(
      input.startAt.getTime(),
    ) ||
    Number.isNaN(
      input.endAt.getTime(),
    )
  ) {
    throw new Error(
      "Enter valid event dates and times.",
    );
  }

  if (
    input.endAt.getTime() <
    input.startAt.getTime()
  ) {
    throw new Error(
      "The event end time cannot be before its start time.",
    );
  }

  if (
    authorRole === "teacher" &&
    input.audience !== "class"
  ) {
    throw new Error(
      "Teachers may only create events for assigned classes.",
    );
  }

  if (
    input.audience === "class" &&
    !input.targetClassId.trim()
  ) {
    throw new Error(
      "Select a class for this event.",
    );
  }

  return {
    ...input,

    title:
      validateText(
        input.title,
        "The title",
        4,
        120,
      ),

    description:
      validateText(
        input.description,
        "The description",
        10,
        1000,
      ),

    location:
      validateText(
        input.location,
        "The location",
        2,
        150,
      ),

    targetClassId:
      input.audience === "class"
        ? input.targetClassId.trim()
        : "",

    targetClassName:
      input.audience === "class"
        ? input.targetClassName.trim()
        : "",
  };
}

export function subscribeToParentSchoolEvents(
  classIds: string[],
  onChange:
    (
      events:
        SchoolEvent[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const eventsQuery =
    query(
      collection(
        firestore,
        "schoolEvents",
      ),
      where(
        "status",
        "==",
        "scheduled",
      ),
    );

  return onSnapshot(
    eventsQuery,
    (snapshot) => {
      const events =
        snapshot.docs
          .map(
            mapSchoolEvent,
          )
          .filter(
            (event) =>
              event.audience ===
                "allParents" ||
              classIds.includes(
                event.targetClassId,
              ),
          );

      onChange(
        sortSchoolEvents(
          events,
        ),
      );
    },
    onError,
  );
}

export function subscribeToAdministratorSchoolEvents(
  onChange:
    (
      events:
        SchoolEvent[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      firestore,
      "schoolEvents",
    ),
    (snapshot) =>
      onChange(
        sortSchoolEvents(
          snapshot.docs.map(
            mapSchoolEvent,
          ),
        ),
      ),
    onError,
  );
}

export function subscribeToTeacherSchoolEvents(
  teacherUid: string,
  onChange:
    (
      events:
        SchoolEvent[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const eventsQuery =
    query(
      collection(
        firestore,
        "schoolEvents",
      ),
      where(
        "authorUid",
        "==",
        teacherUid.trim(),
      ),
    );

  return onSnapshot(
    eventsQuery,
    (snapshot) =>
      onChange(
        sortSchoolEvents(
          snapshot.docs.map(
            mapSchoolEvent,
          ),
        ),
      ),
    onError,
  );
}

export async function createSchoolEvent(
  input: SaveSchoolEventInput,
  authorUid: string,
  authorName: string,
  authorRole:
    SchoolEventAuthorRole,
): Promise<string> {
  const cleanedUid =
    authorUid.trim();

  const cleanedName =
    authorName.trim();

  if (
    !cleanedUid ||
    !cleanedName
  ) {
    throw new Error(
      "A signed-in staff member is required.",
    );
  }

  const validated =
    validateInput(
      input,
      authorRole,
    );

  const reference =
    doc(
      collection(
        firestore,
        "schoolEvents",
      ),
    );

  await setDoc(
    reference,
    {
      ...validated,

      startAt:
        Timestamp.fromDate(
          validated.startAt,
        ),

      endAt:
        Timestamp.fromDate(
          validated.endAt,
        ),

      authorUid:
        cleanedUid,

      authorName:
        cleanedName,

      authorRole,

      status:
        "scheduled",

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );

  try {
    await createContentNotifications(
      "schoolEvent",
      reference.id,
    );
  } catch (error) {
    console.error(
      "The school event was created, but its notification could not be created:",
      error,
    );
  }

  return reference.id;
}

export async function updateSchoolEvent(
  eventId: string,
  input: SaveSchoolEventInput,
  authorRole:
    SchoolEventAuthorRole,
): Promise<void> {
  const validated =
    validateInput(
      input,
      authorRole,
    );

  await updateDoc(
    doc(
      firestore,
      "schoolEvents",
      eventId.trim(),
    ),
    {
      ...validated,

      startAt:
        Timestamp.fromDate(
          validated.startAt,
        ),

      endAt:
        Timestamp.fromDate(
          validated.endAt,
        ),

      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function setSchoolEventCancelled(
  eventId: string,
  cancelled: boolean,
): Promise<void> {
  await updateDoc(
    doc(
      firestore,
      "schoolEvents",
      eventId.trim(),
    ),
    {
      status:
        cancelled
          ? "cancelled"
          : "scheduled",

      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function removeSchoolEvent(
  eventId: string,
): Promise<void> {
  await deleteDoc(
    doc(
      firestore,
      "schoolEvents",
      eventId.trim(),
    ),
  );
}