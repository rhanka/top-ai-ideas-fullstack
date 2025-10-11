import { db } from '../db/client';
import { jobQueue } from '../db/schema';

async function resetQueue() {
  try {
    console.log('🔄 Resetting job queue...');
    
    // Clear all jobs
    const result = await db.delete(jobQueue).returning();
    
    console.log(`✅ Cleared ${result.length} jobs from queue`);
    console.log('🎯 Queue reset complete');
    
  } catch (error) {
    console.error('❌ Error resetting queue:', error);
    process.exit(1);
  }
}

resetQueue();
