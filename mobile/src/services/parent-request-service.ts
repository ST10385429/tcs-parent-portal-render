import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
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
  createRequestNotifications,
  createRequestReplyNotifications,
} from "@/services/notification-api-service";

import type {
  AbsenceReason,
  CreateAbsenceReportInput,
  CreateGeneralQueryInput,
  CreateTeacherAppointmentInput,
  GeneralQueryCategory,
  ParentRequestActorRole,
  ParentRequestReply,
  ParentRequestStatus,
  ParentRequestType,
  ParentServiceRequest,
} from "@/types/school";

export type AvailableTeacher = {
  uid: string;
  firstName: string;
  lastName: string;
  name: string;
  subject: string;
  classId: string;
  className: string;
};

type LinkedLearner = {
  id: string;
  firstName: string;
  lastName: string;
  studentNumber: string;
  classId: string;
  className: string;
};

const validRequestTypes: ParentRequestType[] = [
  "generalQuery",
  "absenceReport",
  "teacherAppointment",
];

const validRequestStatuses: ParentRequestStatus[] = [
  "submitted",
  "inReview",
  "responded",
  "resolved",
  "acknowledged",
  "approved",
  "declined",
  "requested",
  "confirmed",
  "rescheduled",
  "completed",
  "cancelled",
];

const validQueryCategories: GeneralQueryCategory[] = [
  "academics",
  "homework",
  "attendance",
  "behaviour",
  "fees",
  "general",
];

const validAbsenceReasons: AbsenceReason[] = [
  "illness",
  "medicalAppointment",
  "familyResponsibility",
  "transport",
  "other",
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

function isRequestType(
  value: unknown,
): value is ParentRequestType {
  return (
    typeof value === "string" &&
    validRequestTypes.includes(
      value as ParentRequestType,
    )
  );
}

function isRequestStatus(
  value: unknown,
): value is ParentRequestStatus {
  return (
    typeof value === "string" &&
    validRequestStatuses.includes(
      value as ParentRequestStatus,
    )
  );
}

function isQueryCategory(
  value: unknown,
): value is GeneralQueryCategory {
  return (
    typeof value === "string" &&
    validQueryCategories.includes(
      value as GeneralQueryCategory,
    )
  );
}

function isAbsenceReason(
  value: unknown,
): value is AbsenceReason {
  return (
    typeof value === "string" &&
    validAbsenceReasons.includes(
      value as AbsenceReason,
    )
  );
}

function requireUid(
  uid: string,
  roleName: string,
): string {
  const cleanedUid =
    uid.trim();

  if (!cleanedUid) {
    throw new Error(
      `A signed-in ${roleName} is required.`,
    );
  }

  return cleanedUid;
}

function validateText(
  value: string,
  label: string,
  minimumLength: number,
  maximumLength: number,
): string {
  const cleanedValue =
    value.trim();

  if (
    cleanedValue.length <
    minimumLength
  ) {
    throw new Error(
      `${label} must contain at least ${minimumLength} characters.`,
    );
  }

  if (
    cleanedValue.length >
    maximumLength
  ) {
    throw new Error(
      `${label} cannot contain more than ${maximumLength} characters.`,
    );
  }

  return cleanedValue;
}

function mapParentRequest(
  requestDocument:
    QueryDocumentSnapshot<DocumentData>,
): ParentServiceRequest {
  const data =
    requestDocument.data();

  return {
    id:
      requestDocument.id,

    referenceNumber:
      readString(
        data.referenceNumber,
      ),

    requestType:
      isRequestType(
        data.requestType,
      )
        ? data.requestType
        : "generalQuery",

    status:
      isRequestStatus(
        data.status,
      )
        ? data.status
        : "submitted",

    parentUid:
      readString(
        data.parentUid,
      ),

    learnerId:
      readString(
        data.learnerId,
      ),

    learnerFirstName:
      readString(
        data.learnerFirstName,
      ),

    learnerLastName:
      readString(
        data.learnerLastName,
      ),

    studentNumber:
      readString(
        data.studentNumber,
      ),

    classId:
      readString(
        data.classId,
      ),

    className:
      readString(
        data.className,
      ),

    subject:
      readString(
        data.subject,
      ),

    description:
      readString(
        data.description,
      ),

    category:
      isQueryCategory(
        data.category,
      )
        ? data.category
        : null,

    absenceReason:
      isAbsenceReason(
        data.absenceReason,
      )
        ? data.absenceReason
        : null,

    absenceStartDate:
      readTimestamp(
        data.absenceStartDate,
      ),

    absenceEndDate:
      readTimestamp(
        data.absenceEndDate,
      ),

    teacherUid:
      readString(
        data.teacherUid,
      ) || null,

    teacherName:
      readString(
        data.teacherName,
      ),

    teacherSubject:
      readString(
        data.teacherSubject,
      ),

    requestedAppointmentDate:
      readTimestamp(
        data.requestedAppointmentDate,
      ),

    requestedAppointmentTime:
      readString(
        data.requestedAppointmentTime,
      ),

    confirmedAppointmentDate:
      readTimestamp(
        data.confirmedAppointmentDate,
      ),

    confirmedAppointmentTime:
      readString(
        data.confirmedAppointmentTime,
      ),

    latestResponse:
      readString(
        data.latestResponse,
      ),

    latestResponseBy:
      readString(
        data.latestResponseBy,
      ) || null,

    latestResponseAt:
      readTimestamp(
        data.latestResponseAt,
      ),

    createdAt:
      readTimestamp(
        data.createdAt,
      ),

    updatedAt:
      readTimestamp(
        data.updatedAt,
      ),

    resolvedAt:
      readTimestamp(
        data.resolvedAt,
      ),
  };
}

function mapRequestReply(
  replyDocument:
    QueryDocumentSnapshot<DocumentData>,
): ParentRequestReply {
  const data =
    replyDocument.data();

  const senderRole =
    readString(
      data.senderRole,
    );

  return {
    id:
      replyDocument.id,

    requestId:
      readString(
        data.requestId,
      ),

    senderUid:
      readString(
        data.senderUid,
      ),

    senderRole:
      senderRole === "teacher" ||
      senderRole === "administrator"
        ? senderRole
        : "parent",

    senderName:
      readString(
        data.senderName,
      ),

    message:
      readString(
        data.message,
      ),

    createdAt:
      readTimestamp(
        data.createdAt,
      ),
  };
}

function sortRequests(
  requests:
    ParentServiceRequest[],
): ParentServiceRequest[] {
  return [
    ...requests,
  ].sort(
    (
      firstRequest,
      secondRequest,
    ) => {
      const firstTime =
        firstRequest
          .createdAt
          ?.toMillis() ??
        0;

      const secondTime =
        secondRequest
          .createdAt
          ?.toMillis() ??
        0;

      return (
        secondTime -
        firstTime
      );
    },
  );
}

async function getActiveParentLink(
  parentUid: string,
  learnerId: string,
): Promise<boolean> {
  const directLinkReference =
    doc(
      firestore,
      "parentLearnerLinks",
      parentUid,
      "learners",
      learnerId,
    );

  const directLinkSnapshot =
    await getDoc(
      directLinkReference,
    );

  if (
    directLinkSnapshot.exists() &&
    directLinkSnapshot.data()
      .status === "active"
  ) {
    return true;
  }

  const matchingLinksQuery =
    query(
      collection(
        firestore,
        "parentLearnerLinks",
        parentUid,
        "learners",
      ),
      where(
        "learnerId",
        "==",
        learnerId,
      ),
      limit(1),
    );

  const matchingLinksSnapshot =
    await getDocs(
      matchingLinksQuery,
    );

  return matchingLinksSnapshot.docs.some(
    (linkDocument) =>
      linkDocument.data()
        .status === "active",
  );
}

async function getLinkedLearner(
  parentUid: string,
  learnerId: string,
): Promise<LinkedLearner> {
  const cleanedParentUid =
    requireUid(
      parentUid,
      "parent",
    );

  const cleanedLearnerId =
    learnerId.trim();

  if (!cleanedLearnerId) {
    throw new Error(
      "A learner must be selected.",
    );
  }

  const hasActiveLink =
    await getActiveParentLink(
      cleanedParentUid,
      cleanedLearnerId,
    );

  if (!hasActiveLink) {
    throw new Error(
      "You do not have access to the selected learner.",
    );
  }

  const learnerSnapshot =
    await getDoc(
      doc(
        firestore,
        "learners",
        cleanedLearnerId,
      ),
    );

  if (
    !learnerSnapshot.exists() ||
    learnerSnapshot.data()
      .status !== "active"
  ) {
    throw new Error(
      "The selected learner is unavailable.",
    );
  }

  const learnerData =
    learnerSnapshot.data();

  const classId =
    readString(
      learnerData.currentClassId,
    );

  if (!classId) {
    throw new Error(
      "The selected learner does not have an assigned class.",
    );
  }

  const classSnapshot =
    await getDoc(
      doc(
        firestore,
        "classes",
        classId,
      ),
    );

  if (
    !classSnapshot.exists() ||
    classSnapshot.data()
      .status !== "active"
  ) {
    throw new Error(
      "The learner's assigned class is unavailable.",
    );
  }

  return {
    id:
      learnerSnapshot.id,

    firstName:
      readString(
        learnerData.firstName,
      ),

    lastName:
      readString(
        learnerData.lastName,
      ),

    studentNumber:
      readString(
        learnerData.studentNumber,
      ),

    classId,

    className:
      readString(
        classSnapshot.data()
          .name,
      ),
  };
}

function createReferenceNumber(
  requestType:
    ParentRequestType,
  requestId: string,
): string {
  const prefixes:
    Record<
      ParentRequestType,
      string
    > = {
      generalQuery:
        "QRY",

      absenceReport:
        "ABS",

      teacherAppointment:
        "APT",
    };

  return [
    "TCS",
    prefixes[requestType],
    new Date()
      .getFullYear(),
    requestId
      .slice(0, 6)
      .toUpperCase(),
  ].join("-");
}

async function createRequest(
  parentUid: string,
  learner: LinkedLearner,
  requestType:
    ParentRequestType,
  status:
    ParentRequestStatus,
  values:
    Record<
      string,
      unknown
    >,
): Promise<string> {
  const requestReference =
    doc(
      collection(
        firestore,
        "parentRequests",
      ),
    );

  await setDoc(
    requestReference,
    {
      referenceNumber:
        createReferenceNumber(
          requestType,
          requestReference.id,
        ),

      requestType,
      status,
      parentUid,

      learnerId:
        learner.id,

      learnerFirstName:
        learner.firstName,

      learnerLastName:
        learner.lastName,

      studentNumber:
        learner.studentNumber,

      classId:
        learner.classId,

      className:
        learner.className,

      subject: "",
      description: "",
      category: null,
      absenceReason: null,
      absenceStartDate: null,
      absenceEndDate: null,
      teacherUid: null,
      teacherName: "",
      teacherSubject: "",

      requestedAppointmentDate:
        null,

      requestedAppointmentTime:
        "",

      confirmedAppointmentDate:
        null,

      confirmedAppointmentTime:
        "",

      latestResponse: "",
      latestResponseBy: null,
      latestResponseAt: null,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),

      resolvedAt: null,

      ...values,
    },
  );

  return requestReference.id;
}

export async function getAvailableTeachersForLearner(
  parentUid: string,
  learnerId: string,
): Promise<AvailableTeacher[]> {
  const learner =
    await getLinkedLearner(
      parentUid,
      learnerId,
    );

  const activeTeachersQuery =
    query(
      collection(
        firestore,
        "users",
      ),
      where(
        "role",
        "==",
        "teacher",
      ),
      where(
        "status",
        "==",
        "active",
      ),
    );

  const activeTeachersSnapshot =
    await getDocs(
      activeTeachersQuery,
    );

  const teacherRequests =
    activeTeachersSnapshot.docs.map(
      async (
        teacherDocument,
      ): Promise<
        AvailableTeacher | null
      > => {
        const assignmentsQuery =
          query(
            collection(
              firestore,
              "teacherAssignments",
              teacherDocument.id,
              "classes",
            ),
            where(
              "classId",
              "==",
              learner.classId,
            ),
            where(
              "status",
              "==",
              "active",
            ),
            limit(1),
          );

        const assignmentsSnapshot =
          await getDocs(
            assignmentsQuery,
          );

        const assignmentDocument =
          assignmentsSnapshot
            .docs[0];

        if (
          !assignmentDocument
        ) {
          return null;
        }

        const teacherUid =
          teacherDocument.id;

        const userData =
          teacherDocument.data();

        const firstName =
          readString(
            userData.firstName,
          );

        const lastName =
          readString(
            userData.lastName,
          );

        const name =
          `${firstName} ${lastName}`
            .trim() ||
          "Teacher";

        return {
          uid:
            teacherUid,

          firstName,

          lastName,

          name,

          subject:
            readString(
              assignmentDocument
                .data()
                .subject,
            ),

          classId:
            learner.classId,

          className:
            learner.className,
        };
      },
    );

  const teacherResults =
    await Promise.all(
      teacherRequests,
    );

  const uniqueTeachers =
    new Map<
      string,
      AvailableTeacher
    >();

  teacherResults.forEach(
    (teacher) => {
      if (!teacher) {
        return;
      }

      uniqueTeachers.set(
        `${teacher.uid}:${teacher.subject}`,
        teacher,
      );
    },
  );

  return [
    ...uniqueTeachers.values(),
  ].sort(
    (
      firstTeacher,
      secondTeacher,
    ) =>
      firstTeacher.name
        .localeCompare(
          secondTeacher.name,
        ),
  );
}

export async function createGeneralQuery(
  parentUid: string,
  input: CreateGeneralQueryInput,
): Promise<string> {
  const cleanedParentUid =
    requireUid(
      parentUid,
      "parent",
    );

  const learner =
    await getLinkedLearner(
      cleanedParentUid,
      input.learnerId,
    );

  const subject =
    validateText(
      input.subject,
      "The subject",
      3,
      100,
    );

  const description =
    validateText(
      input.description,
      "The query description",
      10,
      1000,
    );

  if (
    !validQueryCategories.includes(
      input.category,
    )
  ) {
    throw new Error(
      "Select a valid query category.",
    );
  }

  const requestId =
    await createRequest(
      cleanedParentUid,
      learner,
      "generalQuery",
      "submitted",
      {
        subject,
        description,
        category:
          input.category,
      },
    );

  try {
    await createRequestNotifications(
      requestId,
    );
  } catch (error) {
    console.error(
      "General query was created, but its notification could not be created:",
      error,
    );
  }

  return requestId;
}

export async function createAbsenceReport(
  parentUid: string,
  input: CreateAbsenceReportInput,
): Promise<string> {
  const cleanedParentUid =
    requireUid(
      parentUid,
      "parent",
    );

  const learner =
    await getLinkedLearner(
      cleanedParentUid,
      input.learnerId,
    );

  const description =
    validateText(
      input.description,
      "The absence note",
      5,
      500,
    );

  if (
    !validAbsenceReasons.includes(
      input.absenceReason,
    )
  ) {
    throw new Error(
      "Select a valid absence reason.",
    );
  }

  if (
    Number.isNaN(
      input.startDate.getTime(),
    ) ||
    Number.isNaN(
      input.endDate.getTime(),
    )
  ) {
    throw new Error(
      "Select valid absence dates.",
    );
  }

  if (
    input.endDate.getTime() <
    input.startDate.getTime()
  ) {
    throw new Error(
      "The end date cannot be before the start date.",
    );
  }

  const requestId =
    await createRequest(
      cleanedParentUid,
      learner,
      "absenceReport",
      "submitted",
      {
        subject:
          "Learner absence report",

        description,

        absenceReason:
          input.absenceReason,

        absenceStartDate:
          Timestamp.fromDate(
            input.startDate,
          ),

        absenceEndDate:
          Timestamp.fromDate(
            input.endDate,
          ),
      },
    );

  try {
    await createRequestNotifications(
      requestId,
    );
  } catch (error) {
    console.error(
      "Absence report was created, but its notification could not be created:",
      error,
    );
  }

  return requestId;
}

export async function createTeacherAppointment(
  parentUid: string,
  input: CreateTeacherAppointmentInput,
): Promise<string> {
  const cleanedParentUid =
    requireUid(
      parentUid,
      "parent",
    );

  const learner =
    await getLinkedLearner(
      cleanedParentUid,
      input.learnerId,
    );

  const description =
    validateText(
      input.description,
      "The appointment reason",
      10,
      500,
    );

  const requestedTime =
    input.requestedTime.trim();

  if (
    Number.isNaN(
      input.requestedDate.getTime(),
    )
  ) {
    throw new Error(
      "Select a valid appointment date.",
    );
  }

  if (!requestedTime) {
    throw new Error(
      "Select a preferred appointment time.",
    );
  }

  const availableTeachers =
    await getAvailableTeachersForLearner(
      cleanedParentUid,
      learner.id,
    );

  const selectedTeacher =
    availableTeachers.find(
      (teacher) =>
        teacher.uid ===
          input.teacherUid.trim() &&
        teacher.subject ===
          input.teacherSubject.trim(),
    );

  if (!selectedTeacher) {
    throw new Error(
      "The selected teacher is not assigned to this learner's class.",
    );
  }

  const requestId =
    await createRequest(
      cleanedParentUid,
      learner,
      "teacherAppointment",
      "requested",
      {
        subject:
          `Appointment with ${selectedTeacher.name}`,

        description,

        teacherUid:
          selectedTeacher.uid,

        teacherName:
          selectedTeacher.name,

        teacherSubject:
          selectedTeacher.subject,

        requestedAppointmentDate:
          Timestamp.fromDate(
            input.requestedDate,
          ),

        requestedAppointmentTime:
          requestedTime,
      },
    );

  try {
    await createRequestNotifications(
      requestId,
    );
  } catch (error) {
    console.error(
      "Teacher appointment request was created, but its notification could not be created:",
      error,
    );
  }

  return requestId;
}

export function subscribeToParentRequests(
  parentUid: string,
  onChange:
    (
      requests:
        ParentServiceRequest[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const cleanedParentUid =
    requireUid(
      parentUid,
      "parent",
    );

  const requestsQuery =
    query(
      collection(
        firestore,
        "parentRequests",
      ),
      where(
        "parentUid",
        "==",
        cleanedParentUid,
      ),
    );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      onChange(
        sortRequests(
          snapshot.docs.map(
            mapParentRequest,
          ),
        ),
      );
    },
    onError,
  );
}

export function subscribeToAdministratorRequests(
  onChange:
    (
      requests:
        ParentServiceRequest[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(
      firestore,
      "parentRequests",
    ),
    (snapshot) => {
      onChange(
        sortRequests(
          snapshot.docs.map(
            mapParentRequest,
          ),
        ),
      );
    },
    onError,
  );
}

export function subscribeToTeacherAppointments(
  teacherUid: string,
  onChange:
    (
      requests:
        ParentServiceRequest[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const cleanedTeacherUid =
    requireUid(
      teacherUid,
      "teacher",
    );

  const appointmentsQuery =
    query(
      collection(
        firestore,
        "parentRequests",
      ),
      where(
        "teacherUid",
        "==",
        cleanedTeacherUid,
      ),
      where(
        "requestType",
        "==",
        "teacherAppointment",
      ),
    );

  return onSnapshot(
    appointmentsQuery,
    (snapshot) => {
      const appointments =
        snapshot.docs.map(
          mapParentRequest,
        );

      onChange(
        sortRequests(
          appointments,
        ),
      );
    },
    onError,
  );
}

export function subscribeToRequestReplies(
  requestId: string,
  onChange:
    (
      replies:
        ParentRequestReply[],
    ) => void,
  onError:
    (error: Error) => void,
): Unsubscribe {
  const cleanedRequestId =
    requestId.trim();

  if (!cleanedRequestId) {
    throw new Error(
      "A request must be selected.",
    );
  }

  const repliesQuery =
    query(
      collection(
        firestore,
        "parentRequests",
        cleanedRequestId,
        "replies",
      ),
      orderBy(
        "createdAt",
        "asc",
      ),
    );

  return onSnapshot(
    repliesQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map(
          mapRequestReply,
        ),
      );
    },
    onError,
  );
}

export async function addRequestReply(
  requestId: string,
  senderUid: string,
  senderRole:
    ParentRequestActorRole,
  senderName: string,
  message: string,
): Promise<string> {
  const cleanedRequestId =
    requestId.trim();

  const cleanedSenderUid =
    requireUid(
      senderUid,
      senderRole,
    );

  const cleanedSenderName =
    validateText(
      senderName,
      "The sender name",
      2,
      100,
    );

  const cleanedMessage =
    validateText(
      message,
      "The reply",
      1,
      1000,
    );

  if (!cleanedRequestId) {
    throw new Error(
      "A request must be selected.",
    );
  }

  const requestReference =
    doc(
      firestore,
      "parentRequests",
      cleanedRequestId,
    );

  const replyReference =
    doc(
      collection(
        requestReference,
        "replies",
      ),
    );

  await runTransaction(
    firestore,
    async (transaction) => {
      const requestSnapshot =
        await transaction.get(
          requestReference,
        );

      if (
        !requestSnapshot.exists()
      ) {
        throw new Error(
          "The selected request could not be found.",
        );
      }

      transaction.set(
        replyReference,
        {
          requestId:
            cleanedRequestId,

          senderUid:
            cleanedSenderUid,

          senderRole,

          senderName:
            cleanedSenderName,

          message:
            cleanedMessage,

          createdAt:
            serverTimestamp(),
        },
      );

      transaction.update(
        requestReference,
        {
          latestResponse:
            cleanedMessage,

          latestResponseBy:
            cleanedSenderUid,

          latestResponseAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
      );
    },
  );

  /*
   * The reply has already been
   * successfully stored. A
   * notification failure must not
   * cause the reply itself to fail.
   */
  try {
    await createRequestReplyNotifications(
      cleanedRequestId,
      replyReference.id,
    );
  } catch (error) {
    console.error(
      "The request reply was created, but its notification could not be created:",
      error,
    );
  }

  return replyReference.id;
}

export async function updateParentRequestStatus(
  requestId: string,
  status:
    ParentRequestStatus,
): Promise<void> {
  const cleanedRequestId =
    requestId.trim();

  if (!cleanedRequestId) {
    throw new Error(
      "A request must be selected.",
    );
  }

  if (
    !validRequestStatuses.includes(
      status,
    )
  ) {
    throw new Error(
      "Select a valid request status.",
    );
  }

  const isClosedStatus =
    status === "resolved" ||
    status === "completed" ||
    status === "cancelled";

  await updateDoc(
    doc(
      firestore,
      "parentRequests",
      cleanedRequestId,
    ),
    {
      status,

      updatedAt:
        serverTimestamp(),

      resolvedAt:
        isClosedStatus
          ? serverTimestamp()
          : null,
    },
  );
}

export async function updateTeacherAppointmentSchedule(
  requestId: string,
  status:
    | "confirmed"
    | "rescheduled",
  confirmedDate: Date,
  confirmedTime: string,
): Promise<void> {
  const cleanedRequestId =
    requestId.trim();

  const cleanedTime =
    confirmedTime.trim();

  if (!cleanedRequestId) {
    throw new Error(
      "An appointment request must be selected.",
    );
  }

  if (
    Number.isNaN(
      confirmedDate.getTime(),
    )
  ) {
    throw new Error(
      "Select a valid appointment date.",
    );
  }

  if (!cleanedTime) {
    throw new Error(
      "Enter a confirmed appointment time.",
    );
  }

  await updateDoc(
    doc(
      firestore,
      "parentRequests",
      cleanedRequestId,
    ),
    {
      status,

      confirmedAppointmentDate:
        Timestamp.fromDate(
          confirmedDate,
        ),

      confirmedAppointmentTime:
        cleanedTime,

      updatedAt:
        serverTimestamp(),

      resolvedAt:
        null,
    },
  );
}