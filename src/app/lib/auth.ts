import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { bearer, emailOTP, oAuthProxy } from "better-auth/plugins";
import { prisma } from "./prisma";
import { envVars } from "../config/env";
import { Role } from "../../generated/prisma/enums";
import { sendEmail } from "../utils/email";


export const auth = betterAuth({
  baseURL: envVars.BETTER_AUTH_URL,

  secret: envVars.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  plugins: [
    oAuthProxy(),
    bearer(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      async sendVerificationOTP({ email, otp, type }) {
        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
          console.error(`User with email ${email} not found.`);
          return;
        }

        if (type === "email-verification") {
          await sendEmail({
            to: email,
            subject: "Verify Your Email - Portfolio Server",
            html: `<p>Hello ${user.name},</p><p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in 2 minutes.</p>`,
          });
        }

        if (type === "forget-password") {
          await sendEmail({
            to: email,
            subject: "Reset Your Password - Portfolio Server",
            html: `<p>Hello ${user.name},</p><p>Your password reset code is <strong>${otp}</strong>.</p><p>This code expires in 2 minutes.</p>`,
          });
        }
      },
      expiresIn: 2 * 60, // 2 minutes
      otpLength: 6,
    }),
  ],

  emailAndPassword: {
    enabled: true,
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
  },



  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: Role.ADMIN,
      },

      phone: {
        type: "string",
        required: false,
        defaultValue: "",
      },
    },
  },

  redirectURLs: {
    signIn: `${envVars.BETTER_AUTH_URL}/api/v1/auth/google/success`,
  },

  trustedOrigins: [
    process.env.BETTER_AUTH_URL || "http://localhost:5000",
    envVars.FRONTEND_URL,
  ],

  session: {
    expiresIn: 60 * 60 * 60 * 24, // 1 day in seconds
    updateAge: 60 * 60 * 60 * 24, // 1 day in seconds
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 60 * 24, // 1 day in seconds
    },
  },

  advanced: {
    useSecureCookies: false,
    cookies: {
      sessionToken: {
        attributes: {
          sameSite: "none",
          secure: true,
          httpOnly: true,
          path: "/",
        },
      },
    },
  },
});
