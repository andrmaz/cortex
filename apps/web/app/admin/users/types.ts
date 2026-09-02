export interface AdminUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
  createdAt: string;
}

export interface UserDepartmentAssignment {
  departmentId: string;
  name: string;
  isPrimary: boolean;
}

export interface UserDepartmentsResponse {
  userId: string;
  departments: UserDepartmentAssignment[];
}
