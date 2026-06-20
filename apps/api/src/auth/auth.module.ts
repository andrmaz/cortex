import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthService } from "./auth.service";
import { UserService } from "./user.service";
import { AuthController, MeController } from "./auth.controller";
import { GoogleStrategy } from "./strategies/google.strategy";
import { JwtStrategy } from "./strategies/jwt.strategy";

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: "jwt" }),
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env["JWT_SECRET"];
        if (!secret) {
          throw new Error("JWT_SECRET environment variable is required");
        }
        return { secret, signOptions: { expiresIn: "8h" } };
      },
    }),
  ],
  controllers: [AuthController, MeController],
  providers: [AuthService, UserService, GoogleStrategy, JwtStrategy],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
