import { expo } from "@better-auth/expo";
import { prisma } from "@lineskip/db";
import {
  isAtLeastAge,
  MAX_PASSWORD_LENGTH,
  MIN_PASSWORD_LENGTH,
} from "@lineskip/shared";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: MIN_PASSWORD_LENGTH,
    maxPasswordLength: MAX_PASSWORD_LENGTH,
  },
  plugins: [expo()],
  trustedOrigins: [
    process.env.BETTER_AUTH_URL ?? "http://localhost:8000",
    "lineskip://",
    "exp://",
  ],
  user: {
    additionalFields: {
      platformRole: {
        type: "string",
        defaultValue: "customer",
        input: false,
      },
      dateOfBirth: {
        type: "string",
        required: true,
      },
      locale: {
        type: "string",
        defaultValue: "es",
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const dob = (user as { dateOfBirth?: string }).dateOfBirth;
          if (!dob || !isAtLeastAge(new Date(dob))) {
            throw new Error("You must be 18 or older.");
          }
          return { data: user };
        },
      },
    },
  },
});
