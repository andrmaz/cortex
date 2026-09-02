import {
  Controller,
  Get,
  INestApplication,
  Module,
  UseFilters,
} from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { OrgScopeViolationError } from "db";
import { OrgScopeExceptionFilter } from "./org-scope-exception.filter";

@Controller()
class ThrowingController {
  @Get("cross-org-write")
  @UseFilters(OrgScopeExceptionFilter)
  crossOrgWrite(): never {
    throw new OrgScopeViolationError("UserDepartment", "create");
  }
}

@Module({ controllers: [ThrowingController] })
class ThrowingModule {}

describe("OrgScopeExceptionFilter", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrowingModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("maps OrgScopeViolationError to a 403 Forbidden response", async () => {
    const res = await request(app.getHttpServer())
      .get("/cross-org-write")
      .expect(403);

    expect(res.body).toEqual({ statusCode: 403, message: "Forbidden" });
  });

  it("does not leak the underlying error message to the client", async () => {
    const res = await request(app.getHttpServer())
      .get("/cross-org-write")
      .expect(403);

    expect(JSON.stringify(res.body)).not.toContain("UserDepartment");
  });
});
