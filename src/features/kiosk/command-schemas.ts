import { z } from "zod";

/**
 * Whitelisted command types. These match the database check constraint
 * in the C3 migration's `issue_kiosk_command` function, and they drive
 * the action buttons in the dashboard fleet view.
 */
export const KIOSK_COMMAND_TYPES = [
  "change_survey",
  "refresh_configuration",
  "pause",
  "resume",
  "enter_maintenance",
  "exit_maintenance",
  "revoke_credential",
  "reenroll",
] as const;

export type KioskCommandType = (typeof KIOSK_COMMAND_TYPES)[number];

export const CommandTypeSchema = z.enum(KIOSK_COMMAND_TYPES);

/**
 * Payload shape for POST /api/kiosk/command.
 *
 * `command_payload` is the optional argument the dashboard passes for
 * `change_survey`. For every other command_type the server ignores it
 * and the RPC accepts null.
 *
 * `idempotency_key` is required and must be at least 8 characters. The
 * RPC enforces a database-side uniqueness check on
 * (kiosk_device_id, idempotency_key) and returns the existing command
 * row when a duplicate is submitted, so retries from the dashboard
 * never produce duplicate activity rows.
 */
export const IssueCommandBodySchema = z.object({
  kiosk_device_id: z.string().uuid(),
  command_type: CommandTypeSchema,
  command_payload: z
    .object({
      survey_id: z.string().uuid().optional(),
    })
    .nullable()
    .optional(),
  idempotency_key: z
    .string()
    .min(8, "idempotency_key must be at least 8 characters")
    .max(128),
});

export type IssueCommandBody = z.infer<typeof IssueCommandBodySchema>;

/**
 * Display labels for the command types. Used by the fleet UI to render
 * readable buttons, by the activity feed to format event labels, and
 * by the device shell to render human-readable status messages.
 */
export const KIOSK_COMMAND_LABELS: Record<KioskCommandType, string> = {
  change_survey: "Change survey",
  refresh_configuration: "Refresh configuration",
  pause: "Pause",
  resume: "Resume",
  enter_maintenance: "Enter maintenance",
  exit_maintenance: "Exit maintenance",
  revoke_credential: "Revoke credential",
  reenroll: "Re-enroll",
};

/**
 * Commands that require an extra confirmation step in the UI before
 * the action submits. Revocation and re-enrollment change the kiosk's
 * security state in ways that cannot be undone without re-pairing
 * hardware, so the dashboard should require explicit user
 * confirmation.
 */
export const DESTRUCTIVE_COMMAND_TYPES: ReadonlySet<KioskCommandType> =
  new Set(["revoke_credential", "reenroll"]);

export function isDestructiveCommand(type: KioskCommandType): boolean {
  return DESTRUCTIVE_COMMAND_TYPES.has(type);
}
