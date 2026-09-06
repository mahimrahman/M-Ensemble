import { MongoMemoryServer } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

let mongod: MongoMemoryServer | undefined;

/**
 * One in-memory mongod for the whole run. CI has no Mongo service container,
 * and the suite must never reach the real Atlas cluster.
 */
export async function setup(project: TestProject): Promise<void> {
  mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri());
}

export async function teardown(): Promise<void> {
  await mongod?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
