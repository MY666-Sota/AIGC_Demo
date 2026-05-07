import { db } from '../../lib/supabase.js';
import {
  analyzePromptWithDeepSeek,
  enhancePromptWithDeepSeek,
  generateImageWithDashScope,
  generateTextVideoWithDashScope,
  generateVideoWithDashScope,
  searchTrendsWithDashScope
} from '../../lib/providers.js';

function resolveGenerationMode(config = {}) {
  if (config.mode === 'image' || config.mode === 'video' || config.mode === 'both') {
    return config.mode;
  }

  return config.generateVideo ? 'both' : 'image';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, prompt, config = {} } = req.body;
    const mode = resolveGenerationMode(config);

    if (!userId || !prompt) {
      return res.status(400).json({ error: 'Missing required fields: userId, prompt' });
    }

    if (prompt.length > 2000) {
      return res.status(400).json({ error: 'Prompt too long (max 2000 characters)' });
    }

    const generation = await db.createGeneration(userId, prompt, {
      ...config,
      mode
    });

    processGeneration(generation.id, userId, prompt, { ...config, mode }).catch((error) => {
      console.error('Generation processing error:', error);
      db.updateGeneration(generation.id, {
        status: 'failed',
        error_message: error.message
      }).catch((updateError) => {
        console.error('Failed to mark generation as failed:', updateError);
      });
    });

    res.status(200).json({
      id: generation.id,
      status: 'processing',
      message: 'Generation started',
      estimatedTime: mode === 'both' ? 180 : 90
    });
  } catch (error) {
    console.error('Generate API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

async function processGeneration(generationId, userId, prompt, config) {
  const startTime = Date.now();
  const mode = resolveGenerationMode(config);

  try {
    await db.updateGeneration(generationId, { status: 'processing' });

    const step1 = await db.addHistoryStep(generationId, 'Analyzing prompt with DeepSeek', 'PARSE');
    const parseStart = Date.now();
    const analysis = await analyzePromptWithDeepSeek(prompt);
    await db.updateHistoryStep(step1.id, 'completed', Date.now() - parseStart, { analysis });

    const step2 = await db.addHistoryStep(generationId, 'Researching visual trends with DashScope', 'SEARCH');
    const searchStart = Date.now();
    const trendQueries = analysis.needsSearch
      ? analysis.searchQueries.length
        ? analysis.searchQueries
        : analysis.keywords
      : analysis.keywords;
    const searchResults = await searchTrendsWithDashScope(trendQueries);
    await db.updateHistoryStep(step2.id, 'completed', Date.now() - searchStart, {
      queryCount: trendQueries.length,
      results: searchResults
    });

    const step3 = await db.addHistoryStep(generationId, 'Retrieving style context from Supabase knowledge base', 'RAG');
    const ragStart = Date.now();
    const ragQuery = [analysis.style, ...analysis.keywords].filter(Boolean).join(' ');
    const ragResults = await db.searchKnowledgeBase(ragQuery || prompt);
    await db.updateHistoryStep(step3.id, 'completed', Date.now() - ragStart, {
      resultsCount: ragResults.length,
      topStyle: ragResults[0]?.style_name || null
    });

    const step4 = await db.addHistoryStep(generationId, 'Enhancing prompt with DeepSeek', 'RAG');
    const enhanceStart = Date.now();
    const enhanced = await enhancePromptWithDeepSeek({
      prompt,
      analysis,
      ragResults,
      searchResults
    });
    await db.updateHistoryStep(step4.id, 'completed', Date.now() - enhanceStart, {
      enhancedPrompt: enhanced.enhancedPrompt,
      negativePrompt: enhanced.negativePrompt,
      styleTags: enhanced.styleTags
    });

    let imageResult = null;
    let videoUrl = null;
    let videoTaskId = null;

    if (mode === 'image' || mode === 'both') {
      const imageStep = await db.addHistoryStep(generationId, 'Generating image with DashScope', 'IMAGE');
      const imageStart = Date.now();
      imageResult = await generateImageWithDashScope({
        prompt: enhanced.imagePrompt,
        negativePrompt: enhanced.negativePrompt,
        aspectRatio: analysis.aspectRatio,
        styleHints: enhanced.styleTags
      });
      await db.updateHistoryStep(imageStep.id, 'completed', Date.now() - imageStart, {
        imageUrl: imageResult.url,
        taskId: imageResult.taskId
      });
    }

    if (mode === 'both') {
      const videoStep = await db.addHistoryStep(generationId, 'Generating video with DashScope', 'VIDEO');
      const videoStart = Date.now();
      const videoResult = await generateVideoWithDashScope({
        imageUrl: imageResult.url,
        prompt: enhanced.videoPrompt
      });
      videoUrl = videoResult.url;
      videoTaskId = videoResult.taskId;
      await db.updateHistoryStep(videoStep.id, 'completed', Date.now() - videoStart, {
        videoUrl,
        taskId: videoTaskId
      });
    }

    if (mode === 'video') {
      const videoStep = await db.addHistoryStep(generationId, 'Generating video with DashScope', 'VIDEO');
      const videoStart = Date.now();
      const videoResult = await generateTextVideoWithDashScope({
        prompt: enhanced.videoPrompt
      });
      videoUrl = videoResult.url;
      videoTaskId = videoResult.taskId;
      await db.updateHistoryStep(videoStep.id, 'completed', Date.now() - videoStart, {
        videoUrl,
        taskId: videoTaskId
      });
    }

    const resultUrl = mode === 'video' ? videoUrl : videoUrl || imageResult?.url || null;

    await db.updateGeneration(generationId, {
      status: 'completed',
      result_url: resultUrl,
      metadata: {
        totalDuration: Date.now() - startTime,
        mode,
        analysis,
        searchResults,
        ragResults,
        enhancedPrompt: enhanced.enhancedPrompt,
        imagePrompt: enhanced.imagePrompt,
        videoPrompt: enhanced.videoPrompt,
        negativePrompt: enhanced.negativePrompt,
        imageUrl: imageResult?.url || null,
        imageTaskId: imageResult?.taskId || null,
        videoUrl,
        videoTaskId,
        provider: {
          analysis: 'deepseek',
          search: 'dashscope',
          image: mode === 'video' ? null : 'dashscope',
          video: mode === 'image' ? null : 'dashscope'
        }
      }
    });
  } catch (error) {
    console.error('Processing error:', error);
    await db.updateGeneration(generationId, {
      status: 'failed',
      error_message: error.message
    });
    throw error;
  }
}
