import { z } from "zod";

export const IntegritySchema = z.string().regex(/^sha256-[A-Za-z0-9+/]+=*$/);
