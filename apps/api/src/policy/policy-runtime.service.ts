import { Injectable } from "@nestjs/common";
import {
  parsePolicyDocument,
  type PolicyDecision,
  type PolicyDocument,
} from "@cortex/shared/policy";
import { PrismaService } from "../prisma/prisma.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import {
  evaluateChunkPolicy,
  evaluateQueryPolicy,
  type PolicyEvaluation,
} from "./policy-evaluator";

interface PolicyScope {
  organizationId: string;
  departmentId: string | null;
}

function deny(reasonCode: string, reason: string): PolicyEvaluation {
  const decision: PolicyDecision = {
    policyId: null,
    policyVersion: null,
    decision: "deny",
    matchedRules: [],
    reasonCode,
    reason,
  };
  return { chunks: [], decision };
}

@Injectable()
export class PolicyRuntimeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
  ) {}

  async evaluate(scope: PolicyScope, query: string): Promise<PolicyEvaluation> {
    if (!scope.departmentId) {
      return deny("POLICY_NO_DEPARTMENT", "A Primary Department is required.");
    }

    const policy = await this.prisma.policy.findFirst({
      where: {
        organizationId: scope.organizationId,
        departmentId: scope.departmentId,
        isActive: true,
      },
    });
    if (!policy) {
      return deny(
        "POLICY_NO_ACTIVE_POLICY",
        "No active Policy is configured for your Department.",
      );
    }

    let document: PolicyDocument;
    try {
      document = parsePolicyDocument(policy.rulesJson);
    } catch {
      return deny(
        "POLICY_INVALID",
        "The active Policy is invalid. Contact your Admin.",
      );
    }

    const queryDecision = evaluateQueryPolicy(policy, document, query);
    if (queryDecision) return queryDecision;

    const retrieved = await this.retrieval.search(
      query,
      scope.organizationId,
      undefined,
      document.allowedSourceIds,
    );
    const permittedChunks = retrieved.filter((chunk) =>
      document.allowedSourceIds.includes(chunk.sourceRef.sourceId),
    );
    return evaluateChunkPolicy(policy, document, permittedChunks);
  }
}
