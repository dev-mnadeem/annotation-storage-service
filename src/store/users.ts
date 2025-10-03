import { createHash, randomBytes } from 'crypto';
import { API_KEY_BYTES } from '../config/constants';
import { User, type IUser, type UserRole } from '../models/User';

/**
 * API keys are stored as SHA-256 digests. A key is high-entropy random rather than a
 * user-chosen secret, so a fast digest is the right tool here — there is nothing to
 * brute-force offline the way there would be with a password.
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

export function generateApiKey(): string {
  return randomBytes(API_KEY_BYTES).toString('base64url');
}

export async function createUser(input: {
  name: string;
  email: string;
  role: UserRole;
}): Promise<{ user: IUser; apiKey: string }> {
  const apiKey = generateApiKey();
  const user = await User.create({ ...input, apiKeyHash: hashApiKey(apiKey) });
  return { user, apiKey };
}

export function findByApiKey(key: string): Promise<IUser | null> {
  return User.findOne({ apiKeyHash: hashApiKey(key) }).exec();
}

export function findManyByIds(ids: unknown[]): Promise<IUser[]> {
  if (!ids.length) return Promise.resolve([]);
  return User.find({ _id: { $in: ids } })
    .select('name email role')
    .exec();
}
