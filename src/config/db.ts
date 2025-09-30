import mongoose from 'mongoose';
import { DB_STATE } from './constants';

export async function connectDb(uri: string): Promise<typeof mongoose.connection> {
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function dbReadyState(): number {
  return mongoose.connection.readyState;
}

export function isDbConnected(): boolean {
  return dbReadyState() === DB_STATE.connected;
}

const STATE_NAMES: Record<number, string> = Object.fromEntries(
  Object.entries(DB_STATE).map(([name, value]) => [value, name]),
);

export function dbStateName(): string {
  return STATE_NAMES[dbReadyState()] ?? 'unknown';
}
