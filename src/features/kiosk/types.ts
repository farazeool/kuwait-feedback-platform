
export type KioskMode =
  | "active"
  | "paused"
  | "maintenance"
  | "re_enrollment_required"
  | "revoked";

export type KioskConfigurationStatus =
  | "current"
  | "pending"
  | "failed"
  | "revoked"
  | "re_enrollment_required";

export interface KioskConfiguration {
  desiredConfigVersion: number;
  appliedConfigVersion: number;
  desiredSurveyId: string | null;
  appliedSurveyId: string | null;
  desiredMode: KioskMode;
  appliedMode: KioskMode;
  configurationStatus: KioskConfigurationStatus;
  configurationUpdatedAt: string | null;
  configurationAppliedAt: string | null;
  configurationError: string | null;
}
