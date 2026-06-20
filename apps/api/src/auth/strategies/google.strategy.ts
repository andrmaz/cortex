import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import {
  Strategy,
  type VerifyCallback,
  type Profile,
} from "passport-google-oauth20";
import type { AuthenticatedUser } from "../auth.types";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor() {
    super({
      clientID: process.env["GOOGLE_CLIENT_ID"] ?? "",
      clientSecret: process.env["GOOGLE_CLIENT_SECRET"] ?? "",
      callbackURL: process.env["GOOGLE_CALLBACK_URL"] ?? "/auth/google/callback",
      scope: ["email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    // Require a verified email address – unverified emails must not be used
    // for identity or domain-based org matching.
    const verifiedEmail = profile.emails?.find((e) => e.verified === true)
      ?.value;

    if (!verifiedEmail) {
      done(new Error("No verified email returned from Google"), undefined);
      return;
    }

    // Forward the raw profile to the controller for DB upsert + JWT issuance.
    const user: AuthenticatedUser & { googleSub: string } = {
      id: "",
      email: verifiedEmail,
      googleSub: profile.id,
      organizationId: "",
      role: "member",
    };

    done(null, user);
  }
}
