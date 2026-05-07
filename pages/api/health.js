import { supabase } from '../../lib/supabase.js';
import { getProviderConfig } from '../../lib/env.js';

export default async function handler(req, res) {
  try {
    const dbCheck = await checkDatabase();
    const deepseekCheck = checkDeepSeek();
    const dashscopeCheck = checkDashScope();

    const allHealthy = dbCheck && deepseekCheck && dashscopeCheck;

    res.status(allHealthy ? 200 : 503).json({
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: dbCheck,
        deepseek: deepseekCheck,
        dashscope: dashscopeCheck
      }
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      message: error.message,
      services: {
        database: false,
        deepseek: false,
        dashscope: false
      }
    });
  }
}

async function checkDatabase() {
  try {
    const { error } = await supabase
      .from('knowledge_base')
      .select('id')
      .limit(1);
    return !error;
  } catch {
    return false;
  }
}

function checkDeepSeek() {
  const { deepseekApiKey } = getProviderConfig();
  return Boolean(deepseekApiKey);
}

function checkDashScope() {
  const { dashscopeApiKey } = getProviderConfig();
  return Boolean(dashscopeApiKey);
}
