export type SchoolCode = 'cczu' | 'jou';

export const DEFAULT_SCHOOL_CODE: SchoolCode = 'cczu';

export function isSchoolCode(value: unknown): value is SchoolCode {
  return value === 'cczu' || value === 'jou';
}
