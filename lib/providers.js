import { getProviderConfig } from './env.js';

const DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com';

function buildHeaders(apiKey, extraHeaders = {}) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    ...extraHeaders
  };
}

async function safeJson(response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await safeJson(response);

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error?.message ||
      payload?.code ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

function extractJsonFromText(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```json\s*([\s\S]+?)```/i) || trimmed.match(/```\s*([\s\S]+?)```/i);
  return fenced ? fenced[1].trim() : trimmed;
}

export async function analyzePromptWithDeepSeek(prompt) {
  const { deepseekApiKey, deepseekBaseUrl, deepseekModel } = getProviderConfig();

  if (!deepseekApiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  const payload = await fetchJson(`${deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(deepseekApiKey),
    body: JSON.stringify({
      model: deepseekModel,
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are an AIGC prompt analyst. Return strict JSON with keys: style, keywords, needsSearch, searchQueries, negativePrompt, aspectRatio, reasoning, promptSummary. keywords and searchQueries must be arrays of strings.'
        },
        {
          role: 'user',
          content: `Analyze this creative prompt for image/video generation:\n${prompt}`
        }
      ]
    })
  });

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek returned an empty analysis response');
  }

  const parsed = JSON.parse(extractJsonFromText(content));

  return {
    style: parsed.style || 'general',
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
    needsSearch: Boolean(parsed.needsSearch),
    searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
    negativePrompt: parsed.negativePrompt || '',
    aspectRatio: parsed.aspectRatio || '16:9',
    reasoning: parsed.reasoning || '',
    promptSummary: parsed.promptSummary || prompt
  };
}

export async function enhancePromptWithDeepSeek({ prompt, analysis, ragResults, searchResults }) {
  const { deepseekApiKey, deepseekBaseUrl, deepseekModel } = getProviderConfig();

  if (!deepseekApiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY');
  }

  const payload = await fetchJson(`${deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(deepseekApiKey),
    body: JSON.stringify({
      model: deepseekModel,
      response_format: { type: 'json_object' },
      temperature: 0.5,
      messages: [
        {
          role: 'system',
          content:
            'You improve prompts for multimodal generation. Return strict JSON with keys: enhancedPrompt, imagePrompt, videoPrompt, styleTags, negativePrompt.'
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              prompt,
              analysis,
              ragResults,
              searchResults
            },
            null,
            2
          )
        }
      ]
    })
  });

  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('DeepSeek returned an empty prompt enhancement response');
  }

  const parsed = JSON.parse(extractJsonFromText(content));

  return {
    enhancedPrompt: parsed.enhancedPrompt || prompt,
    imagePrompt: parsed.imagePrompt || parsed.enhancedPrompt || prompt,
    videoPrompt: parsed.videoPrompt || parsed.enhancedPrompt || prompt,
    styleTags: Array.isArray(parsed.styleTags) ? parsed.styleTags : [],
    negativePrompt: parsed.negativePrompt || analysis?.negativePrompt || ''
  };
}

function normalizeSearchResult(item, index = 0) {
  return {
    title: item?.title || item?.name || `Result ${index + 1}`,
    snippet: item?.snippet || item?.text || item?.summary || '',
    url: item?.url || item?.link || '',
    source: item?.site_name || item?.source || 'dashscope'
  };
}

export async function searchTrendsWithDashScope(queries) {
  const { dashscopeApiKey, dashscopeTextModel } = getProviderConfig();

  if (!dashscopeApiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  const joinedQuery = Array.isArray(queries) ? queries.filter(Boolean).join(' ; ') : String(queries || '').trim();

  if (!joinedQuery) {
    return [];
  }

  const payload = await fetchJson(`${DASHSCOPE_BASE_URL}/compatible-mode/v1/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(dashscopeApiKey),
    body: JSON.stringify({
      model: dashscopeTextModel,
      temperature: 0.3,
      web_search_options: {
        enable: true
      },
      messages: [
        {
          role: 'system',
          content:
            'You are a trend research assistant for AIGC prompt creation. Summarize relevant visual trends and cite concise sources when available.'
        },
        {
          role: 'user',
          content: `Find recent visual trends related to: ${joinedQuery}`
        }
      ]
    })
  });

  const message = payload?.choices?.[0]?.message || {};
  const searchInfo = payload?.search_info || message?.search_info || {};
  const sources = Array.isArray(searchInfo?.results)
    ? searchInfo.results.map(normalizeSearchResult)
    : [];

  const assistantSummary = message?.content
    ? [{ title: 'Trend summary', snippet: String(message.content), url: '', source: 'dashscope-summary' }]
    : [];

  return [...assistantSummary, ...sources].slice(0, 8);
}

function mapAspectRatio(aspectRatio) {
  const ratioMap = {
    '1:1': '1024*1024',
    '4:3': '1152*864',
    '3:4': '864*1152',
    '16:9': '1280*720',
    '9:16': '720*1280'
  };

  return ratioMap[aspectRatio] || '1280*720';
}

async function pollDashScopeTask(taskId, apiKey, maxAttempts = 60, intervalMs = 5000) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const task = await fetchJson(`${DASHSCOPE_BASE_URL}/api/v1/tasks/${taskId}`, {
      method: 'GET',
      headers: buildHeaders(apiKey)
    });

    const status = task?.output?.task_status;
    if (status === 'SUCCEEDED') {
      return task;
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      const message = task?.output?.message || task?.message || 'DashScope task failed';
      throw new Error(message);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('DashScope task polling timed out');
}

function extractImageUrl(taskPayload) {
  const results = taskPayload?.output?.results || [];
  const first = results[0] || {};

  return first.url || first.image_url || first.image?.url || null;
}

function extractVideoUrl(taskPayload) {
  const videoUrl =
    taskPayload?.output?.video_url ||
    taskPayload?.output?.video?.url ||
    taskPayload?.output?.results?.[0]?.video_url ||
    taskPayload?.output?.results?.[0]?.url;

  return videoUrl || null;
}

export async function generateImageWithDashScope({ prompt, negativePrompt, aspectRatio, styleHints }) {
  const { dashscopeApiKey, dashscopeImageModel } = getProviderConfig();

  if (!dashscopeApiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  const submitPayload = await fetchJson(`${DASHSCOPE_BASE_URL}/api/v1/services/aigc/text2image/image-synthesis`, {
    method: 'POST',
    headers: buildHeaders(dashscopeApiKey, {
      'X-DashScope-Async': 'enable'
    }),
    body: JSON.stringify({
      model: dashscopeImageModel,
      input: {
        prompt,
        negative_prompt: negativePrompt || undefined
      },
      parameters: {
        size: mapAspectRatio(aspectRatio),
        n: 1,
        style: Array.isArray(styleHints) && styleHints.length ? styleHints.join(', ') : undefined
      }
    })
  });

  const taskId = submitPayload?.output?.task_id;
  if (!taskId) {
    throw new Error('DashScope image generation did not return a task id');
  }

  const taskPayload = await pollDashScopeTask(taskId, dashscopeApiKey);
  const imageUrl = extractImageUrl(taskPayload);

  if (!imageUrl) {
    throw new Error('DashScope image generation did not return an image URL');
  }

  return {
    taskId,
    url: imageUrl,
    raw: taskPayload
  };
}

export async function generateVideoWithDashScope({ imageUrl, prompt }) {
  const { dashscopeApiKey, dashscopeVideoModel } = getProviderConfig();

  if (!dashscopeApiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  const submitPayload = await fetchJson(`${DASHSCOPE_BASE_URL}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: buildHeaders(dashscopeApiKey, {
      'X-DashScope-Async': 'enable'
    }),
    body: JSON.stringify({
      model: dashscopeVideoModel,
      input: {
        img_url: imageUrl,
        prompt
      },
      parameters: {
        resolution: '720P',
        prompt_extend: true
      }
    })
  });

  const taskId = submitPayload?.output?.task_id;
  if (!taskId) {
    throw new Error('DashScope video generation did not return a task id');
  }

  const taskPayload = await pollDashScopeTask(taskId, dashscopeApiKey, 90, 8000);
  const videoUrl = extractVideoUrl(taskPayload);

  if (!videoUrl) {
    throw new Error('DashScope video generation did not return a video URL');
  }

  return {
    taskId,
    url: videoUrl,
    raw: taskPayload
  };
}

export async function generateTextVideoWithDashScope({ prompt }) {
  const { dashscopeApiKey, dashscopeTextVideoModel } = getProviderConfig();

  if (!dashscopeApiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  const submitPayload = await fetchJson(`${DASHSCOPE_BASE_URL}/api/v1/services/aigc/video-generation/video-synthesis`, {
    method: 'POST',
    headers: buildHeaders(dashscopeApiKey, {
      'X-DashScope-Async': 'enable'
    }),
    body: JSON.stringify({
      model: dashscopeTextVideoModel,
      input: {
        prompt
      },
      parameters: {
        size: '832*480',
        prompt_extend: true
      }
    })
  });

  const taskId = submitPayload?.output?.task_id;
  if (!taskId) {
    throw new Error('DashScope text-to-video generation did not return a task id');
  }

  const taskPayload = await pollDashScopeTask(taskId, dashscopeApiKey, 90, 8000);
  const videoUrl = extractVideoUrl(taskPayload);

  if (!videoUrl) {
    throw new Error('DashScope text-to-video generation did not return a video URL');
  }

  return {
    taskId,
    url: videoUrl,
    raw: taskPayload
  };
}
