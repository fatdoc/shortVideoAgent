import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { loadConfig } from '../config.js';
import { createDatabase } from '../db/client.js';
import { hashPassword } from './password.js';

const bootstrapSchema = z.object({
  PILOT_TENANT_ID: z.string().uuid(),
  PILOT_TENANT_NAME: z.string().trim().min(1).max(200),
  PILOT_ADMIN_EMAIL: z.string().trim().email().max(254),
  PILOT_ADMIN_DISPLAY_NAME: z.string().trim().min(1).max(200),
  PILOT_ADMIN_PASSWORD: z.string().min(14).max(1024),
  PILOT_REPLACE_PASSWORD: z.enum(['true', 'false']).default('false'),
});

export type BootstrapInput = z.infer<typeof bootstrapSchema>;

export function parseBootstrapInput(environment: NodeJS.ProcessEnv): BootstrapInput {
  return bootstrapSchema.parse(environment);
}

async function main(): Promise<void> {
  const config = loadConfig();
  const input = parseBootstrapInput(process.env);
  const database = createDatabase(config);

  try {
    const passwordHash = await hashPassword(input.PILOT_ADMIN_PASSWORD);
    const normalizedEmail = input.PILOT_ADMIN_EMAIL.toLowerCase();

    await database.transaction(async (transaction) => {
      await transaction('control_plane.tenants')
        .insert({
          tenant_id: input.PILOT_TENANT_ID,
          display_name: input.PILOT_TENANT_NAME,
          status: 'active',
        })
        .onConflict('tenant_id')
        .merge({ display_name: input.PILOT_TENANT_NAME, status: 'active', updated_at: transaction.fn.now() });

      const existing = await transaction('control_plane.users')
        .select('user_id')
        .whereRaw('lower(email) = lower(?)', [normalizedEmail])
        .first<{ user_id: string }>();
      const userId = existing?.user_id ?? randomUUID();
      if (existing) {
        const memberships = await transaction('control_plane.memberships')
          .distinct('tenant_id')
          .where({ user_id: userId, status: 'active' });
        if (memberships.some((membership) => membership.tenant_id !== input.PILOT_TENANT_ID)) {
          throw new Error('white-list account already belongs to another active tenant');
        }
      }
      if (!existing) {
        await transaction('control_plane.users').insert({
          user_id: userId,
          email: normalizedEmail,
          display_name: input.PILOT_ADMIN_DISPLAY_NAME,
          password_hash: passwordHash,
          status: 'active',
        });
      } else {
        const update: Record<string, unknown> = {
          display_name: input.PILOT_ADMIN_DISPLAY_NAME,
          status: 'active',
          updated_at: transaction.fn.now(),
        };
        if (input.PILOT_REPLACE_PASSWORD === 'true') update.password_hash = passwordHash;
        await transaction('control_plane.users').where({ user_id: userId }).update(update);
        if (input.PILOT_REPLACE_PASSWORD === 'true') {
          await transaction('control_plane.auth_sessions')
            .where({ user_id: userId })
            .whereNull('revoked_at')
            .update({ revoked_at: transaction.fn.now() });
        }
      }

      await transaction('control_plane.memberships')
        .insert({
          membership_id: randomUUID(),
          tenant_id: input.PILOT_TENANT_ID,
          user_id: userId,
          role_code: 'tenant_admin',
          status: 'active',
        })
        .onConflict(['tenant_id', 'user_id', 'role_code'])
        .merge({ status: 'active', updated_at: transaction.fn.now() });
    });

    console.info(JSON.stringify({ event: 'pilot_whitelist_initialized', credentialOutput: false }));
  } finally {
    await database.destroy();
  }
}

if (process.env.NODE_ENV !== 'test') {
  main().catch((error: unknown) => {
    const message = error instanceof z.ZodError
      ? '白名单初始化参数缺失或格式无效。'
      : '白名单初始化失败。';
    console.error(message);
    process.exitCode = 1;
  });
}
