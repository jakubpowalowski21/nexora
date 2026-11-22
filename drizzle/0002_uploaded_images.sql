CREATE TABLE "uploaded_images" (
	"digest" text PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uploaded_image_size" CHECK (octet_length("uploaded_images"."bytes") between 1 and 3000000)
);
