import {
  collection,
  getDocs,
  type Timestamp,
} from "firebase/firestore";

import { firestore } from "@/lib/firebase";
import {
  getFeeAccount,
} from "@/services/fee-service";

import type {
  FeeAccount,
  FeeStructure,
  FeeStructureStatus,
  Learner,
  SchoolClass,
  SiblingDiscountType,
} from "@/types/school";

export type AdminLearnerFeeOverview = {
  learner: Learner;
  feeAccount: FeeAccount | null;
};

function readString(
  value: unknown,
  fallback = "",
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function readNumber(
  value: unknown,
  fallback = 0,
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function readBoolean(
  value: unknown,
  fallback = false,
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function readStringArray(
  value: unknown,
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is string =>
      typeof item === "string",
  );
}

function readTimestamp(
  value: unknown,
): Timestamp | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    "toMillis" in value
  ) {
    return value as Timestamp;
  }

  return null;
}

function readFeeStructureStatus(
  value: unknown,
): FeeStructureStatus {
  return value === "inactive"
    ? "inactive"
    : "active";
}

function readSiblingDiscountType(
  value: unknown,
): SiblingDiscountType {
  if (
    value === "percentage" ||
    value === "fixed"
  ) {
    return value;
  }

  return "manual";
}

function mapFeeStructure(
  id: string,
  data: Record<string, unknown>,
): FeeStructure {
  return {
    id,
    academicYear: readNumber(
      data.academicYear,
    ),
    name: readString(data.name),
    gradeBand: readString(
      data.gradeBand,
    ),
    gradeCodes: readStringArray(
      data.gradeCodes,
    ),
    registrationFee: readNumber(
      data.registrationFee,
    ),
    monthlyTuition: readNumber(
      data.monthlyTuition,
    ),
    tuitionMonths: readNumber(
      data.tuitionMonths,
    ),
    annualTuitionTotal: readNumber(
      data.annualTuitionTotal,
    ),
    annualTotal: readNumber(
      data.annualTotal,
    ),
    paymentDueDay: readNumber(
      data.paymentDueDay,
      3,
    ),
    currency: "ZAR",
    status: readFeeStructureStatus(
      data.status,
    ),
    siblingDiscountEnabled:
      readBoolean(
        data.siblingDiscountEnabled,
      ),
    siblingDiscountType:
      readSiblingDiscountType(
        data.siblingDiscountType,
      ),
    siblingDiscountValue: readNumber(
      data.siblingDiscountValue,
    ),
    siblingDiscountNote: readString(
      data.siblingDiscountNote,
    ),
    paymentNote: readString(
      data.paymentNote,
    ),
    excludedExpenses: readStringArray(
      data.excludedExpenses,
    ),
    terminationNoticeMonths:
      readNumber(
        data.terminationNoticeMonths,
        1,
      ),
    terminationNote: readString(
      data.terminationNote,
    ),
    createdBy: readString(
      data.createdBy,
    ),
    createdAt: readTimestamp(
      data.createdAt,
    ),
    updatedAt: readTimestamp(
      data.updatedAt,
    ),
  };
}

function mapSchoolClass(
  id: string,
  data: Record<string, unknown>,
): SchoolClass {
  return {
    id,
    name: readString(data.name),
    gradeNumber: readNumber(
      data.gradeNumber,
    ),
    academicYear: readNumber(
      data.academicYear,
    ),
    status: readString(
      data.status,
      "active",
    ),
  };
}

export async function getFeeStructures(): Promise<
  FeeStructure[]
> {
  const structuresSnapshot =
    await getDocs(
      collection(
        firestore,
        "feeStructures",
      ),
    );

  return structuresSnapshot.docs
    .map((structureDocument) =>
      mapFeeStructure(
        structureDocument.id,
        structureDocument.data() as Record<
          string,
          unknown
        >,
      ),
    )
    .sort((first, second) => {
      if (
        first.academicYear !==
        second.academicYear
      ) {
        return (
          second.academicYear -
          first.academicYear
        );
      }

      return first.gradeBand.localeCompare(
        second.gradeBand,
      );
    });
}

export async function getAdminLearnerFeeOverviews(): Promise<
  AdminLearnerFeeOverview[]
> {
  const [
    learnersSnapshot,
    classesSnapshot,
  ] = await Promise.all([
    getDocs(
      collection(
        firestore,
        "learners",
      ),
    ),
    getDocs(
      collection(
        firestore,
        "classes",
      ),
    ),
  ]);

  const classesById = new Map<
    string,
    SchoolClass
  >();

  classesSnapshot.docs.forEach(
    (classDocument) => {
      classesById.set(
        classDocument.id,
        mapSchoolClass(
          classDocument.id,
          classDocument.data() as Record<
            string,
            unknown
          >,
        ),
      );
    },
  );

  const activeLearners = learnersSnapshot.docs
    .map((learnerDocument): Learner => {
      const data =
        learnerDocument.data();

      const currentClassId =
        readString(
          data.currentClassId,
        );

      return {
        id: learnerDocument.id,
        firstName: readString(
          data.firstName,
        ),
        lastName: readString(
          data.lastName,
        ),
        studentNumber: readString(
          data.studentNumber,
        ),
        status: readString(
          data.status,
          "active",
        ),
        currentClassId,
        currentGradeNumber:
          readNumber(
            data.currentGradeNumber,
          ),
        schoolClass:
          classesById.get(
            currentClassId,
          ) ?? null,
        relationship: "",
      };
    })
    .filter(
      (learner) =>
        learner.status === "active",
    );

  const overviews = await Promise.all(
    activeLearners.map(
      async (
        learner,
      ): Promise<AdminLearnerFeeOverview> => ({
        learner,
        feeAccount:
          await getFeeAccount(
            learner.id,
          ),
      }),
    ),
  );

  return overviews.sort(
    (first, second) => {
      const firstName =
        `${first.learner.firstName} ${first.learner.lastName}`;

      const secondName =
        `${second.learner.firstName} ${second.learner.lastName}`;

      return firstName.localeCompare(
        secondName,
      );
    },
  );
}