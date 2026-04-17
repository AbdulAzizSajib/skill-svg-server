import z from "zod";

const createRequestSvgZodSchema = z.object({
  name: z
    .string("Name is required")
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters"),
});

export const RequestSvgValidation = {
  createRequestSvgZodSchema,
};