import type { Timestamp } from "firebase/firestore";

export type AnnouncementCategory = "school" | "class" | "fees";

export type AnnouncementPriority = "normal" | "important" | "urgent";

export type AnnouncementAudience = "allParents" | "class";

export type AnnouncementStatus = "published" | "archived";

export type AnnouncementAuthorRole = "admin" | "teacher";

export type Announcement = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  targetClassId: string;
  targetClassName: string;
  authorUid: string;
  authorName: string;
  authorRole: AnnouncementAuthorRole;
  status: AnnouncementStatus;
  readBy: string[];
  publishedAt: Timestamp | null;
  expiresAt: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
};

export type SaveAnnouncementInput = {
  title: string;
  summary: string;
  body: string;
  category: AnnouncementCategory;
  priority: AnnouncementPriority;
  audience: AnnouncementAudience;
  targetClassId: string;
  targetClassName: string;
  expiresAt: Date | null;
};
