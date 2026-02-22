import { Hono } from 'hono';
import { getModelCatalogPayload } from '../../services/model-catalog';

export const modelsRouter = new Hono();

modelsRouter.get('/catalog', async (c) => {
  try {
    const payload = await getModelCatalogPayload();
    return c.json(payload);
  } catch (error) {
    console.error('Error fetching model catalog:', error);
    return c.json({ message: 'Failed to fetch model catalog' }, 500);
  }
});
