/**
 * Zod bodies for register and login.
 *
 * Project: oldboys — goal-conditioned, sourced deep research on a person or company (Apify hackathon)
 * Module:  src/app/api/_lib/auth-body.ts
 * Deps:    zod,src/domain/organization
 * Tested:  src/app/api/_lib/__tests__/auth-body.test.ts
 *
 * Key responsibilities:
 * - RegisterBody and LoginBody; email is trimmed and lower-cased
 *
 * Design constraints:
 * - Login accepts any non-empty password so old policy never locks a user out
 */
import { z } from "zod";
import { OrganizationInput } from "@/domain/organization";

const Email = z
  .email()
  .max(254)
  .transform((e) => e.trim().toLowerCase());

export const RegisterBody = z.object({
  email: Email,
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(120),
  organization: OrganizationInput,
});
export type RegisterBody = z.infer<typeof RegisterBody>;

export const LoginBody = z.object({ email: Email, password: z.string().min(1).max(200) });
export type LoginBody = z.infer<typeof LoginBody>;
