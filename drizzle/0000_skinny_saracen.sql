CREATE TYPE "public"."fulfillment" AS ENUM('new', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."moderation" AS ENUM('pending', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('active', 'draft', 'archived');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('customer', 'admin');--> statement-breakpoint
CREATE TYPE "public"."ticket_status" AS ENUM('new', 'processing', 'resolved');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"data" jsonb NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid NOT NULL,
	"action" text NOT NULL,
	"target" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"name" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"user_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "cart_items_user_id_variant_id_pk" PRIMARY KEY("user_id","variant_id"),
	CONSTRAINT "valid_cart_quantity" CHECK ("cart_items"."quantity" between 1 and 99)
);
--> statement-breakpoint
CREATE TABLE "cart_merges" (
	"user_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_merges_user_id_request_id_pk" PRIMARY KEY("user_id","request_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"image" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"parent_id" text,
	"facets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "category_redirects" (
	"slug" text PRIMARY KEY NOT NULL,
	"category_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"code" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"minimum" integer DEFAULT 0 NOT NULL,
	"maximum" integer,
	"usage_limit" integer,
	"customer_limit" integer,
	"expires_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"stack" boolean DEFAULT false NOT NULL,
	"product_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"category_ids" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demo_admin_edits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"state" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"product_id" text NOT NULL,
	CONSTRAINT "favorites_user_id_product_id_pk" PRIMARY KEY("user_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" text NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"public_id" text,
	"position" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory" (
	"variant_id" text PRIMARY KEY NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"reserved" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "valid_inventory" CHECK ("inventory"."stock" >= "inventory"."reserved" and "inventory"."reserved" >= 0)
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" text NOT NULL,
	"actor_id" uuid,
	"order_id" uuid,
	"delta" integer NOT NULL,
	"reserved_delta" integer DEFAULT 0 NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscribers" (
	"email" text PRIMARY KEY NOT NULL,
	"consent_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"actor_id" uuid,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"variant" text NOT NULL,
	"sku" text NOT NULL,
	"unit_price" integer NOT NULL,
	"regular_price" integer NOT NULL,
	"tax" integer NOT NULL,
	"quantity" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sequence" serial NOT NULL,
	"request_id" uuid NOT NULL,
	"lookup_hash" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"address" jsonb NOT NULL,
	"shipping_method" text NOT NULL,
	"payment_method" text NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer NOT NULL,
	"shipping_cost" integer NOT NULL,
	"total" integer NOT NULL,
	"refunded_total" integer DEFAULT 0 NOT NULL,
	"payment" "payment_status" DEFAULT 'pending' NOT NULL,
	"fulfillment" "fulfillment" DEFAULT 'new' NOT NULL,
	"stripe_session" text,
	"stripe_intent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_sequence_unique" UNIQUE("sequence"),
	CONSTRAINT "orders_requestId_unique" UNIQUE("request_id"),
	CONSTRAINT "orders_stripeSession_unique" UNIQUE("stripe_session"),
	CONSTRAINT "orders_stripeIntent_unique" UNIQUE("stripe_intent"),
	CONSTRAINT "valid_order_totals" CHECK ("orders"."total" >= 0 and "orders"."refunded_total" between 0 and "orders"."total")
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"to" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"brand" text NOT NULL,
	"category_id" text NOT NULL,
	"summary" text NOT NULL,
	"description" text NOT NULL,
	"specifications" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"box" text DEFAULT 'Produkt, dokumentacja' NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"meta_title" text,
	"meta_description" text,
	"og_image" text,
	"tax" integer DEFAULT 23 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"until" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coupon_redemptions" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'held' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"order_id" uuid NOT NULL,
	"variant_id" text NOT NULL,
	"quantity" integer NOT NULL,
	"state" text DEFAULT 'held' NOT NULL,
	CONSTRAINT "inventory_reservations_order_id_variant_id_pk" PRIMARY KEY("order_id","variant_id")
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"return_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	CONSTRAINT "return_items_return_id_item_id_pk" PRIMARY KEY("return_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"email" text NOT NULL,
	"type" text NOT NULL,
	"body" text NOT NULL,
	"status" "ticket_status" DEFAULT 'new' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"product_id" text NOT NULL,
	"author" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"rating" integer NOT NULL,
	"status" "moderation" DEFAULT 'pending' NOT NULL,
	"sample" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_userId_productId_unique" UNIQUE("user_id","product_id"),
	CONSTRAINT "valid_rating" CHECK ("reviews"."rating" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "store_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"name" text DEFAULT 'NEXORA' NOT NULL,
	"description" text DEFAULT 'Elektronika, która dobrze pasuje do Twojej codzienności.' NOT NULL,
	"email" text DEFAULT 'kontakt@nexora.example' NOT NULL,
	"free_shipping" integer DEFAULT 19900 NOT NULL,
	"shipping_options" jsonb DEFAULT '[{"id":"pickup","price":999},{"id":"courier","price":1499},{"id":"express","price":2499}]'::jsonb NOT NULL,
	"newsletter_enabled" boolean DEFAULT true NOT NULL,
	"hero_title" text DEFAULT 'Technologia, która robi różnicę.' NOT NULL,
	"hero_text" text DEFAULT 'Odkryj sprzęt zaprojektowany z myślą o Twojej codzienności. Wyjątkowa jakość, nowoczesny design i komfort bez kompromisów.' NOT NULL,
	"seo" text
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"order_id" uuid PRIMARY KEY NOT NULL,
	"tracking" text NOT NULL,
	"shipped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" DEFAULT 'customer' NOT NULL,
	"verified_at" timestamp with time zone,
	"auth_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"name" text NOT NULL,
	"sku" text NOT NULL,
	"color" text NOT NULL,
	"connection" text NOT NULL,
	"price" integer NOT NULL,
	"sale_price" integer,
	"sale_start" timestamp with time zone,
	"sale_end" timestamp with time zone,
	"image" text,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "product_variants_sku_unique" UNIQUE("sku"),
	CONSTRAINT "valid_variant_price" CHECK ("product_variants"."price" > 0 and ("product_variants"."sale_price" is null or ("product_variants"."sale_price" > 0 and "product_variants"."sale_price" < "product_variants"."price")))
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_merges" ADD CONSTRAINT "cart_merges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_redirects" ADD CONSTRAINT "category_redirects_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_brands_name_fk" FOREIGN KEY ("brand") REFERENCES "public"."brands"("name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_code_coupons_code_fk" FOREIGN KEY ("code") REFERENCES "public"."coupons"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_item_id_order_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_id_index" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "product_images_product_id_position_index" ON "product_images" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "inventory_movements_variant_id_created_at_index" ON "inventory_movements" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "order_status_history_order_id_index" ON "order_status_history" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_index" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_product_id_index" ON "order_items" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_created_at_index" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_expires_at_index" ON "orders" USING btree ("payment","expires_at");--> statement-breakpoint
CREATE INDEX "orders_paid_at_index" ON "orders" USING btree ("paid_at");--> statement-breakpoint
CREATE INDEX "email_outbox_sent_at_next_at_index" ON "email_outbox" USING btree ("sent_at","next_at");--> statement-breakpoint
CREATE INDEX "products_category_id_status_created_at_index" ON "products" USING btree ("category_id","status","created_at");--> statement-breakpoint
CREATE INDEX "coupon_redemptions_code_email_index" ON "coupon_redemptions" USING btree ("code","email");--> statement-breakpoint
CREATE INDEX "returns_order_id_index" ON "returns" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "reviews_product_id_status_index" ON "reviews" USING btree ("product_id","status");--> statement-breakpoint
CREATE INDEX "auth_tokens_user_id_type_index" ON "auth_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_index" ON "product_variants" USING btree ("product_id");