const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../../api/src/routes/api/settings.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports
content = content.replace(
  "  startCodexEnrollment,",
  "  startCodexEnrollment,\n  startGoogleEnrollment,\n  completeGoogleEnrollment,\n  disconnectGoogleEnrollment,"
);

// 2. Add Schemas
const schemas = `
const googleEnrollmentStartSchema = z.object({
  accountLabel: z.string().trim().max(120).optional().nullable(),
});

const googleEnrollmentCompleteSchema = z.object({
  enrollmentId: z.string().trim().min(1),
  pastedUrl: z.string().trim(),
  accountLabel: z.string().trim().max(120).optional().nullable(),
});
`;
content = content.replace("const openaiTransportModeSchema", schemas + "\nconst openaiTransportModeSchema");

// 3. Add endpoints before settingsRouter.get('/', async (c) => {
const endpoints = `
settingsRouter.post(
  '/provider-connections/google/enrollment/start',
  zValidator('json', googleEnrollmentStartSchema),
  async (c) => {
    const user = c.get('user') as { userId?: string } | undefined;
    if (!user?.userId) {
      return c.json({ message: 'Authentication required' }, 401);
    }
    const payload = c.req.valid('json');
    const provider = await startGoogleEnrollment({
      accountLabel: payload.accountLabel ?? null,
      updatedByUserId: user.userId,
    });
    return c.json({ provider });
  },
);

settingsRouter.post(
  '/provider-connections/google/enrollment/complete',
  zValidator('json', googleEnrollmentCompleteSchema),
  async (c) => {
    const user = c.get('user') as { userId?: string } | undefined;
    if (!user?.userId) {
      return c.json({ message: 'Authentication required' }, 401);
    }
    const payload = c.req.valid('json');
    try {
      const provider = await completeGoogleEnrollment({
        enrollmentId: payload.enrollmentId,
        pastedUrl: payload.pastedUrl,
        accountLabel: payload.accountLabel ?? null,
        updatedByUserId: user.userId,
      });
      return c.json({ provider });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enrollment completion failed';
      return c.json({ message }, 400);
    }
  },
);

settingsRouter.post('/provider-connections/google/enrollment/disconnect', async (c) => {
  const user = c.get('user') as { userId?: string } | undefined;
  if (!user?.userId) {
    return c.json({ message: 'Authentication required' }, 401);
  }
  const provider = await disconnectGoogleEnrollment({
    updatedByUserId: user.userId,
  });
  return c.json({ provider });
});
`;
content = content.replace("settingsRouter.get('/', async (c) => {", endpoints + "\nsettingsRouter.get('/', async (c) => {");

fs.writeFileSync(filePath, content, 'utf8');
console.log('Router patch complete.');
