import { Hono } from 'hono';
import { getWorkspaceTemplateCatalog } from '../../services/workspace-template-catalog';

export const workspaceTemplatesRouter = new Hono();

workspaceTemplatesRouter.get('/', async (c) => {
  try {
    const payload = await getWorkspaceTemplateCatalog();
    return c.json(payload);
  } catch (error) {
    console.error('Error fetching workspace template catalog:', error);
    return c.json({ message: 'Failed to fetch workspace template catalog' }, 500);
  }
});
