CREATE TABLE "reviews" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"rating" integer NOT NULL,
	"message" text NOT NULL,
	"approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" text PRIMARY KEY,
	"items" jsonb DEFAULT '[]' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
