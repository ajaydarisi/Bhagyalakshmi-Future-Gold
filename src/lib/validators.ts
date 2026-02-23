import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z
  .object({
    full_name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const profileUpdateSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z
    .string()
    .regex(/^[0-9]{10}$/, "Please enter a valid 10-digit phone number")
    .optional()
    .or(z.literal("")),
});

export const addressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^[0-9]{10}$/, "Please enter a valid 10-digit phone number"),
  address_line_1: z.string().min(5, "Address is required"),
  address_line_2: z.string().optional().or(z.literal("")),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  postal_code: z
    .string()
    .regex(/^[0-9]{6}$/, "Please enter a valid 6-digit postal code"),
  country: z.string().default("India"),
  is_default: z.boolean().default(false),
});

export const couponSchema = z.object({
  code: z
    .string()
    .min(3, "Code must be at least 3 characters")
    .transform((v) => v.toUpperCase()),
  description: z.string().optional(),
  discount_type: z.enum(["percentage", "fixed"]),
  discount_value: z.number().positive("Discount must be greater than 0"),
  min_order_amount: z.number().min(0).default(0),
  max_uses: z.number().int().positive().optional().nullable(),
  is_active: z.boolean().default(true),
  expires_at: z.string().optional().nullable(),
});

export const productSchema = z
  .object({
    name: z.string().min(2, "Product name is required"),
    name_telugu: z.string().optional().nullable(),
    slug: z.string().min(2, "Slug is required"),
    description: z.string().optional(),
    description_telugu: z.string().optional().nullable(),
    price: z.number().positive("Price must be greater than 0"),
    discount_price: z.number().positive().optional().nullable(),
    category_id: z.string().min(1, "Select a category").optional().nullable(),
    stock: z.number().int().min(0, "Stock cannot be negative").default(0),
    material: z.string().optional().nullable(),
    tags: z.array(z.string()).default([]),
    images: z.array(z.string()).default([]),
    is_active: z.boolean().default(true),
    featured: z.boolean().default(false),
    is_sale: z.boolean().default(true),
    is_rental: z.boolean().default(false),
    rental_price: z.number().positive().optional().nullable(),
    rental_deposit: z.number().positive().optional().nullable(),
    max_rental_days: z.number().int().positive().optional().nullable(),
  })
  .refine((data) => data.is_sale || data.is_rental, {
    message: "Product must be available for sale, rental, or both",
    path: ["is_sale"],
  });

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(6, "Password must be at least 6 characters"),
    new_password: z.string().min(6, "Password must be at least 6 characters"),
    confirm_password: z.string(),
  })
  .refine((data) => data.new_password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export const feedbackSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .email("Please enter a valid email address")
    .optional()
    .or(z.literal("")),
  rating: z.number().int().min(1, "Please select a rating").max(5),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type FeedbackInput = z.infer<typeof feedbackSchema>;
