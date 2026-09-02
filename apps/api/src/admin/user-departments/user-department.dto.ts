export interface AssignUserDepartmentsDto {
  departmentIds: string[];
  /** Must be one of departmentIds. Defaults to the existing primary (if still
   * assigned) or the first entry in departmentIds. */
  primaryDepartmentId?: string;
}

export interface UserDepartmentAssignmentDto {
  departmentId: string;
  name: string;
  isPrimary: boolean;
}

export interface UserDepartmentsResponseDto {
  userId: string;
  departments: UserDepartmentAssignmentDto[];
}
