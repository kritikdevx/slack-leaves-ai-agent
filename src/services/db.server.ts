import { PrismaClient } from "@prisma/client";
import { singleton } from "../libs/singleton";

export const prisma = singleton("prisma", () => new PrismaClient());
