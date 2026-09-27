CREATE TABLE `boards` (
	`day` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ocr_budget` (
	`month` text PRIMARY KEY NOT NULL,
	`spent` integer DEFAULT 0 NOT NULL,
	`reserved` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ocr_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ocr_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`month` text NOT NULL,
	`reserve` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`usage` text
);
--> statement-breakpoint
CREATE TABLE `ocr_throttle` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL
);
