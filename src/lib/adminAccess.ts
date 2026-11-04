/** ShiftED trainer admin accounts use @admin.com emails with admin role in user_roles. */
export function isTrainerAdminEmail(email: string | undefined | null): boolean {
  return (email || "").trim().toLowerCase().endsWith("@admin.com");
}

/** Named trainer admins are treated as admins even before their user_roles row exists. */
export const NAMED_TRAINER_ADMINS = [
  "kara@admin.com",
  "josh@admin.com",
  "simon@admin.com",
  "louise@admin.com",
];

export function isNamedTrainerAdmin(email: string | undefined | null): boolean {
  return NAMED_TRAINER_ADMINS.includes((email || "").trim().toLowerCase());
}

export type AdminRoleRow = { role: string };

export function hasAdminRole(rows: AdminRoleRow[] | null | undefined): boolean {
  return !!rows?.some((row) => row.role === "admin");
}
