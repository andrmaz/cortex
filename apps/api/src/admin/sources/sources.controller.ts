import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Document, Source } from "db/client";
import type { AuthenticatedUser } from "../../auth/auth.types";
import { AdminRoleGuard } from "../guards/admin-role.guard";
import {
  SUPPORTED_SOURCE_TYPES,
  type CreateSourceDto,
  type DocumentResponseDto,
  type SourceResponseDto,
  type SourceType,
} from "./source.dto";
import { SourceService, type UploadFile } from "./source.service";

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]+$/;
const SUPPORTED_MIME_TYPES = new Set([
  "application/json",
  "text/csv",
  "text/markdown",
  "text/plain",
]);

interface RequestWithUser {
  user: AuthenticatedUser;
}

function toSourceResponse(source: Source): SourceResponseDto {
  return {
    id: source.id,
    name: source.name,
    type: source.type,
    organizationId: source.organizationId,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

function toDocumentResponse(
  document: Document,
  file: UploadFile,
  jobId: string,
): DocumentResponseDto {
  return {
    id: document.id,
    sourceId: document.sourceId,
    organizationId: document.organizationId,
    fileName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
    jobId,
  };
}

function isSourceType(value: unknown): value is SourceType {
  return (
    typeof value === "string" &&
    SUPPORTED_SOURCE_TYPES.some((type) => type === value)
  );
}

function decodeUtf8Buffer(buffer: Buffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException("file must be valid UTF-8");
  }
}

function assertJsonDocument(content: string): void {
  try {
    JSON.parse(content);
  } catch {
    throw new BadRequestException("file must contain valid JSON");
  }
}

function parseIdempotencyKey(value: string | undefined): string | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  if (
    value.length > MAX_IDEMPOTENCY_KEY_LENGTH ||
    !IDEMPOTENCY_KEY_PATTERN.test(value)
  ) {
    throw new BadRequestException("idempotency-key is invalid");
  }
  return value;
}

@Controller("api/admin/sources")
@UseGuards(AdminRoleGuard)
export class SourcesController {
  constructor(private readonly sourceService: SourceService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Req() req: RequestWithUser): Promise<SourceResponseDto[]> {
    const sources = await this.sourceService.findAll(req.user.organizationId);
    return sources.map(toSourceResponse);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: RequestWithUser,
    @Body() body: CreateSourceDto,
  ): Promise<SourceResponseDto> {
    if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
      throw new BadRequestException("name is required and must be a string");
    }
    if (!isSourceType(body.type)) {
      throw new BadRequestException(
        `type must be one of: ${SUPPORTED_SOURCE_TYPES.join(", ")}`,
      );
    }

    const source = await this.sourceService.create(req.user.organizationId, {
      name: body.name.trim(),
      type: body.type,
    });
    return toSourceResponse(source);
  }

  @Post(":sourceId/documents")
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor("file", {
      limits: { files: 1, fileSize: MAX_UPLOAD_SIZE },
    }),
  )
  async uploadDocument(
    @Req() req: RequestWithUser,
    @Param("sourceId") sourceId: string,
    @Headers("idempotency-key") idempotencyKeyHeader?: string,
    @UploadedFile() file?: UploadFile,
  ): Promise<DocumentResponseDto> {
    if (!file) {
      throw new BadRequestException("file is required");
    }
    if (!file.size) {
      throw new BadRequestException("file must not be empty");
    }
    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "file must be plain text, Markdown, CSV, or JSON",
      );
    }

    const content = decodeUtf8Buffer(file.buffer);
    if (file.mimetype === "application/json") {
      assertJsonDocument(content);
    }

    const result = await this.sourceService.uploadDocument(
      req.user.organizationId,
      sourceId,
      file,
      parseIdempotencyKey(idempotencyKeyHeader),
    );
    return toDocumentResponse(result.document, file, result.jobId);
  }
}
