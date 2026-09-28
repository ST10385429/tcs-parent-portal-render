export type UserRole =
  | "parent"
  | "teacher"
  | "admin";

export type UserStatus =
  | "active"
  | "inactive"
  | "suspended";

export type AppUser = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  mustChangePassword: boolean;
};

export type CreateAppUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  temporaryPassword: string;
};

export type UpdateAppUserInput = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
};

export type AdminUserActionResult = {
  message: string;
  user?: AppUser;
};