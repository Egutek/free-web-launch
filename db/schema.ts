import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const boards=sqliteTable('boards',{day:text('day').primaryKey(),revision:integer('revision').notNull().default(0),data:text('data').notNull()});
export const config=sqliteTable('config',{key:text('key').primaryKey(),value:text('value').notNull()});
export const imports=sqliteTable('ocr_imports',{id:text('id').primaryKey(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
export const budget=sqliteTable('ocr_budget',{month:text('month').primaryKey(),spent:integer('spent').notNull().default(0),reserved:integer('reserved').notNull().default(0)});
export const jobs=sqliteTable('ocr_jobs',{id:text('id').primaryKey(),month:text('month').notNull(),reserve:integer('reserve').notNull(),status:text('status').notNull(),createdAt:text('created_at').notNull(),usage:text('usage')});
export const throttle=sqliteTable('ocr_throttle',{key:text('key').primaryKey(),count:integer('count').notNull()});
export const revisions=sqliteTable('board_revisions',{id:text('id').primaryKey(),day:text('day').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull()});
