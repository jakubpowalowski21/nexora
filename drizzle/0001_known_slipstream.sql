DROP TABLE "demo_admin_edits" CASCADE;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD COLUMN "target_email" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
UPDATE "product_variants" SET "image" = '/media/studio-white.webp' WHERE "id" = 'studio-pro-wireless-bialy' AND "image" = '/media/audio.webp';
--> statement-breakpoint
UPDATE "product_variants" SET "image" = '/media/studio-violet.webp' WHERE "id" = 'studio-pro-wireless-fioletowy' AND "image" = '/media/audio.webp';
