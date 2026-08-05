import { z } from 'zod';

export const BANNER_LINK_TYPES = ['NONE', 'CATEGORY', 'PRODUCT', 'SEARCH'] as const;
export type BannerLinkType = (typeof BANNER_LINK_TYPES)[number];

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like #0B3D2E');

export const saveBannerSchema = z
  .object({
    title: z.string().trim().min(1).max(60),
    subtitle: z.string().trim().max(90).optional().or(z.literal('')),
    /**
     * Either an absolute URL (artwork hosted elsewhere) or a relative path we
     * issued ourselves from the upload endpoint, e.g. `/uploads/banners/x.webp`.
     * Relative is preferred: the same row has to resolve for the admin panel on
     * localhost, a phone on the LAN, and a production domain.
     */
    imageUrl: z
      .string()
      .max(500)
      .refine((v) => v === '' || v.startsWith('/uploads/') || /^https?:\/\//.test(v), {
        message: 'Must be an uploaded image or an http(s) URL',
      })
      .optional()
      .or(z.literal('')),
    bgColor: hexColor.default('#0B3D2E'),
    ctaLabel: z.string().trim().max(24).optional().or(z.literal('')),
    linkType: z.enum(BANNER_LINK_TYPES).default('NONE'),
    linkValue: z.string().trim().max(120).optional().or(z.literal('')),
    sortOrder: z.number().int().min(0).max(999).default(0),
    isActive: z.boolean().default(true),
    startsAt: z.string().datetime().optional().or(z.literal('')),
    endsAt: z.string().datetime().optional().or(z.literal('')),
  })
  // A link that goes nowhere is a dead tap — catch it at the boundary.
  .refine((b) => b.linkType === 'NONE' || Boolean(b.linkValue), {
    message: 'Pick what this banner should open',
    path: ['linkValue'],
  })
  .refine((b) => !b.startsAt || !b.endsAt || new Date(b.startsAt) < new Date(b.endsAt), {
    message: 'End date must be after the start date',
    path: ['endsAt'],
  });

export type SaveBannerInput = z.infer<typeof saveBannerSchema>;
