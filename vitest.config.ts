import { defineConfig } from 'vitest/config';

// Run in a timezone west of UTC by default. Day keys are local dates, and the
// classic bug (toISOString() rolling over to tomorrow in the evening) is
// invisible when tests run in UTC. Override with TZ=… to test elsewhere.
process.env.TZ ??= 'America/Los_Angeles';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
