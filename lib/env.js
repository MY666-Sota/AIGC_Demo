export function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getOptionalEnv(name, fallback = null) {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

export function getProviderConfig() {
  return {
    dashscopeApiKey: getOptionalEnv('DASHSCOPE_API_KEY'),
    deepseekApiKey: getOptionalEnv('DEEPSEEK_API_KEY'),
    deepseekBaseUrl: getOptionalEnv('DEEPSEEK_BASE_URL', 'https://api.deepseek.com'),
    deepseekModel: getOptionalEnv('DEEPSEEK_MODEL', 'deepseek-chat'),
    dashscopeTextModel: getOptionalEnv('DASHSCOPE_TEXT_MODEL', 'qwen-plus'),
    dashscopeImageModel: getOptionalEnv('DASHSCOPE_IMAGE_MODEL', 'wanx2.1-t2i-turbo'),
    dashscopeVideoModel: getOptionalEnv('DASHSCOPE_VIDEO_MODEL', 'wanx2.1-i2v-turbo'),
    dashscopeTextVideoModel: getOptionalEnv('DASHSCOPE_TEXT_VIDEO_MODEL', 'wanx2.1-t2v-turbo'),
    appBaseUrl: getOptionalEnv('APP_BASE_URL')
  };
}
