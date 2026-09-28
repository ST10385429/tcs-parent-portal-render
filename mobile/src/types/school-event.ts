import type { Timestamp } from "firebase/firestore";

export type SchoolEventCategory =
  | "academic"
  | "sport"
  | "meeting"
  | "holiday"
  | "other";

export type SchoolEventAudience = "allParents" | "class";

export type SchoolEventStatus = "scheduled" | "cancelled";

export type SchoolEventAuthorRole = "admin" | "teacher";

export type SchoolEvent = {
  id: string;
  title: string;
  description: string;
  category: SchoolEventCategory;
  location: string;
  startAt: Timestamp | null;
  endAt: Timestamp | null;
  audience: SchoolEventAudience;
  targetClassId: string;
  targetClassName: string;
  authorUid: string;
  authorName: string;
  authorRole: SchoolEventAuthorRole;
  status: SchoolEventStatus;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type SaveSchoolEventInput = {
  title: string;
  description: string;
  category: SchoolEventCategory;
  location: string;
  startAt: Date;
  endAt: Date;
  audience: SchoolEventAudience;
  targetClassId: string;
  targetClassName: string;
};
