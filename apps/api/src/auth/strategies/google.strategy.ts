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
    const email = profile.emails?.[0]?.value;

    if (!email) {
      done(new Error("No email returned from Google"), undefined);
      return;
    }

    // The actual user lookup / provisioning happens in the controller after
    // the strategy succeeds.  We forward the raw profile so the controller
    // can call the DB and issue a JWT.
    const user: AuthenticatedUser & { googleSub: string } = {
      id: "",
      email,
      googleSub: profile.id,
      organizationId: "",
      role: "member",
    };

    done(null, user);
  }
}
