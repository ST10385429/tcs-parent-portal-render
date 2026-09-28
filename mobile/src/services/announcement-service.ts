import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
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
  Announcement,
  AnnouncementAuthorRole,
  AnnouncementCategory,
  AnnouncementPriority,
  AnnouncementStatus,
  SaveAnnouncementInput,
} from "@/types/announcement";

import type {
  SchoolClass,
} from "@/types/school";

const categories: AnnouncementCategory[] = [
  "school",
  "class",
  "fees",
];

const priorities: AnnouncementPriority[] = [
  "normal",
  "important",
  "urgent",
];

const statuses: AnnouncementStatus[] = [
  "published",
  "archived",
];

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function readStringArray(
  value: unknown,
): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string",
      )
    : [];
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
): AnnouncementCategory {
  return categories.includes(
    value as AnnouncementCategory,
  )
    ? (value as AnnouncementCategory)
    : "school";
}

function readPriority(
  value: unknown,
): AnnouncementPriority {
  return priorities.includes(
    value as AnnouncementPriority,
  )
    ? (value as AnnouncementPriority)
    : "normal";
}

function readStatus(
  value: unknown,
): AnnouncementStatus {
  return statuses.includes(
    value as AnnouncementStatus,
  )
    ? (value as AnnouncementStatus)
    : "archived";
}

function mapAnnouncement(
  snapshot:
    QueryDocumentSnapshot<DocumentData>,
): Announcement {
  const data =
    snapshot.data();

  return {
    id:
      snapshot.id,

    title:
      readString(
        data.title,
      ),

    summary:
      readString(
        data.summary,
      ),

    body:
      readString(
        data.body,
      ),

    category:
      readCategory(
        data.category,
      ),

    priority:
      readPriority(
        data.priority,
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
      data.authorRole === "teacher"
        ? "teacher"
        : "admin",

    status:
      readStatus(
        data.status,
      ),

    readBy:
      readStringArray(
        data.readBy,
      ),

    publishedAt:
      readTimestamp(
        data.publishedAt,
      ),

    expiresAt:
      readTimestamp(
        data.expiresAt,
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

function sortAnnouncements(
  items: Announcement[],
): Announcement[] {
  return [...items].sort(
    (
      first,
      second,
    ) => {
      const firstTime =
        first.publishedAt
          ?.toMillis() ??
        0;

      const secondTime =
        second.publishedAt
          ?.toMillis() ??
        0;

      return (
        secondTime -
        firstTime
      );
    },
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
  input: SaveAnnouncementInput,
  authorRole:
    AnnouncementAuthorRole,
): SaveAnnouncementInput {
  if (
    !categories.includes(
      input.category,
    )
  ) {
    throw new Error(
      "Select a valid announcement category.",
    );
  }

  if (
    !priorities.includes(
      input.priority,
    )
  ) {
    throw new Error(
      "Select a valid priority.",
    );
  }

  if (
    authorRole === "teacher" &&
    input.audience !== "class"
  ) {
    throw new Error(
      "Teachers may only publish to an assigned class.",
    );
  }

  if (
    input.audience === "class" &&
    !input.targetClassId.trim()
  ) {
    throw new Error(
      "Select a class for this announcement.",
    );
  }

  if (
    input.expiresAt &&
    Number.isNaN(
      input.expiresAt.getTime(),
    )
  ) {
    throw new Error(
      "Select a valid expiry date.",
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

    summary:
      validateText(
        input.summary,
        "The summary",
        10,
        220,
      ),

    body:
      validateText(
        input.body,
        "The announcement",
        10,
        3000,
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

export function subscribeToParentAnnouncements(
  classIds: string[],
  onChange:
    (
      announcements:
        Announcement[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const announcementsQuery =
    query(
      collection(
        firestore,
        "announcements",
      ),
      where(
        "status",
        "==",
        "published",
      ),
    );

  return onSnapshot(
    announcementsQuery,
    (snapshot) => {
      const now =
        Date.now();

      const announcements =
        snapshot.docs
          .map(
            mapAnnouncement,
          )
          .filter(
            (
              announcement,
            ) => {
              const hasExpired =
                announcement
                  .expiresAt !==
                  null &&
                announcement
                  .expiresAt
                  .toMillis() <
                  now;

              const isRelevant =
                announcement
                  .audience ===
                  "allParents" ||
                classIds.includes(
                  announcement
                    .targetClassId,
                );

              return (
                !hasExpired &&
                isRelevant
              );
            },
          );

      onChange(
        sortAnnouncements(
          announcements,
        ),
      );
    },
    onError,
  );
}

export function subscribeToAdministratorAnnouncements(
  onChange:
    (
      announcements:
        Announcement[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      firestore,
      "announcements",
    ),
    (snapshot) =>
      onChange(
        sortAnnouncements(
          snapshot.docs.map(
            mapAnnouncement,
          ),
        ),
      ),
    onError,
  );
}

export function subscribeToTeacherAnnouncements(
  teacherUid: string,
  onChange:
    (
      announcements:
        Announcement[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const announcementsQuery =
    query(
      collection(
        firestore,
        "announcements",
      ),
      where(
        "authorUid",
        "==",
        teacherUid.trim(),
      ),
    );

  return onSnapshot(
    announcementsQuery,
    (snapshot) =>
      onChange(
        sortAnnouncements(
          snapshot.docs.map(
            mapAnnouncement,
          ),
        ),
      ),
    onError,
  );
}

export async function getActiveAnnouncementClasses():
  Promise<SchoolClass[]> {
  const snapshot =
    await getDocs(
      collection(
        firestore,
        "classes",
      ),
    );

  return snapshot.docs
    .map(
      (
        classDocument,
      ) => {
        const data =
          classDocument.data();

        return {
          id:
            classDocument.id,

          name:
            readString(
              data.name,
            ),

          gradeNumber:
            typeof data.gradeNumber ===
            "number"
              ? data.gradeNumber
              : 0,

          academicYear:
            typeof data.academicYear ===
            "number"
              ? data.academicYear
              : 0,

          status:
            readString(
              data.status,
            ),
        } satisfies SchoolClass;
      },
    )
    .filter(
      (
        schoolClass,
      ) =>
        schoolClass.status ===
        "active",
    )
    .sort(
      (
        first,
        second,
      ) =>
        first.name.localeCompare(
          second.name,
        ),
    );
}

export async function createAnnouncement(
  input: SaveAnnouncementInput,
  authorUid: string,
  authorName: string,
  authorRole:
    AnnouncementAuthorRole,
): Promise<string> {
  const cleanedAuthorUid =
    authorUid.trim();

  const cleanedAuthorName =
    authorName.trim();

  if (
    !cleanedAuthorUid ||
    !cleanedAuthorName
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
        "announcements",
      ),
    );

  await setDoc(
    reference,
    {
      ...validated,

      authorUid:
        cleanedAuthorUid,

      authorName:
        cleanedAuthorName,

      authorRole,

      status:
        "published",

      readBy: [],

      expiresAt:
        validated.expiresAt
          ? Timestamp.fromDate(
              validated.expiresAt,
            )
          : null,

      publishedAt:
        serverTimestamp(),

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
  );

  try {
    await createContentNotifications(
      "announcement",
      reference.id,
    );
  } catch (error) {
    console.error(
      "The announcement was published, but its notification could not be created:",
      error,
    );
  }

  return reference.id;
}

export async function updateAnnouncement(
  announcementId: string,
  input: SaveAnnouncementInput,
  authorRole:
    AnnouncementAuthorRole,
): Promise<void> {
  const validated =
    validateInput(
      input,
      authorRole,
    );

  await updateDoc(
    doc(
      firestore,
      "announcements",
      announcementId.trim(),
    ),
    {
      ...validated,

      expiresAt:
        validated.expiresAt
          ? Timestamp.fromDate(
              validated.expiresAt,
            )
          : null,

      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function setAnnouncementArchived(
  announcementId: string,
  archived: boolean,
): Promise<void> {
  await updateDoc(
    doc(
      firestore,
      "announcements",
      announcementId.trim(),
    ),
    {
      status:
        archived
          ? "archived"
          : "published",

      updatedAt:
        serverTimestamp(),
    },
  );
}

export async function removeAnnouncement(
  announcementId: string,
): Promise<void> {
  await deleteDoc(
    doc(
      firestore,
      "announcements",
      announcementId.trim(),
    ),
  );
}

export async function markAnnouncementRead(
  announcementId: string,
  parentUid: string,
): Promise<void> {
  await updateDoc(
    doc(
      firestore,
      "announcements",
      announcementId.trim(),
    ),
    {
      readBy:
        arrayUnion(
          parentUid.trim(),
        ),
    },
  );
}