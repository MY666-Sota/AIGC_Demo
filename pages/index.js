import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

const PHASE_LABELS = {
  PARSE: '提示词分析',
  SEARCH: '趋势检索',
  RAG: '知识增强',
  IMAGE: '图片生成',
  VIDEO: '视频生成'
};

function formatDuration(durationMs) {
  if (!durationMs) return '进行中';
  return `${(durationMs / 1000).toFixed(1)}s`;
}

function getEngineLabel(mode) {
  if (mode === 'video') return 'VIDEO ONLY';
  if (mode === 'both') return 'IMAGE + VIDEO';
  return 'IMAGE ONLY';
}

function getModeText(mode) {
  if (mode === 'video') return '仅视频';
  if (mode === 'both') return '图片 + 视频';
  return '仅图片';
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [generationId, setGenerationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [generationMode, setGenerationMode] = useState('image');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    initializeUser();
  }, []);

  const progressStats = useMemo(() => {
    const completed = history.filter((step) => step.status === 'completed').length;
    const expectedTotal = generationMode === 'both' ? 6 : 5;
    const total = Math.max(history.length, expectedTotal);

    return {
      completed,
      total,
      percent: total ? Math.min(100, Math.round((completed / total) * 100)) : 0
    };
  }, [generationMode, history]);

  async function initializeUser() {
    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (session?.user) {
        setUserId(session.user.id);
        return;
      }

      const { data, error: authError } = await supabase.auth.signInAnonymously();

      if (authError) {
        const message = authError.message || '';
        if (/anonymous/i.test(message) || /provider/i.test(message)) {
          throw new Error('匿名登录未启用，请到 Supabase 控制台的 Authentication > Providers 中开启 Anonymous Sign-Ins。');
        }
        throw authError;
      }

      if (!data?.user?.id) {
        throw new Error('匿名登录成功，但未返回用户信息。');
      }

      setUserId(data.user.id);
    } catch (err) {
      console.error('Auth error:', err);
      setError(err.message || '用户会话初始化失败');
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    if (!generationId) return undefined;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/generate/${generationId}`);
        const generation = await response.json();

        if (!response.ok) {
          throw new Error(generation.error || '获取生成状态失败');
        }

        setHistory(generation.history || []);

        if (generation.status === 'completed') {
          setResult(generation);
          setLoading(false);
          clearInterval(interval);
        } else if (generation.status === 'failed') {
          setError(generation.error_message || '生成失败');
          setLoading(false);
          clearInterval(interval);
        }
      } catch (err) {
        console.error('Error polling generation:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [generationId]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    setHistory([]);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          prompt,
          config: {
            mode: generationMode,
            generateVideo: generationMode === 'both'
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '启动生成任务失败');
      }

      setGenerationId(data.id);
    } catch (err) {
      setError(err.message || '提交失败');
      setLoading(false);
    }
  }

  const imageUrl = result?.metadata?.imageUrl || null;
  const videoUrl = result?.metadata?.videoUrl || null;
  const enhancedPrompt = result?.metadata?.enhancedPrompt || '';

  async function handleImageDownload() {
    if (!imageUrl) return;

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error('下载图片失败');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `aigc-demo-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      window.open(imageUrl, '_blank', 'noopener,noreferrer');
    }
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <main className="page">
        <section className="hero-card">
          <div className="hero-copy">
            <span className="eyebrow">AIGC PIPELINE / DEEPSEEK + DASHSCOPE</span>
            <h1>AIGC_Demo</h1>
            <p className="hero-text">
              一个具备提示词理解、趋势检索、知识增强、文生图与视频生成能力的未来感 AIGC 控制台。
            </p>
          </div>

          <div className="hero-metrics">
            <div className="metric">
              <span className="metric-label">SESSION</span>
              <strong>{userId ? `${userId.substring(0, 8)}...` : authLoading ? 'BOOTING' : 'OFFLINE'}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">STATUS</span>
              <strong>{authLoading ? 'Initializing' : error ? 'Attention' : loading ? 'Running' : 'Ready'}</strong>
            </div>
            <div className="metric">
              <span className="metric-label">ENGINE</span>
              <strong>{getEngineLabel(generationMode)}</strong>
            </div>
          </div>
        </section>

        <section className="workspace-grid">
          <section className="panel panel-form">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">PROMPT CONSOLE</span>
                <h2>生成入口</h2>
              </div>
              <div className={`status-pill ${authLoading ? 'status-wait' : userId ? 'status-ok' : 'status-error'}`}>
                {authLoading ? '初始化中' : userId ? '已连接' : '需修复'}
              </div>
            </div>

            <form onSubmit={handleSubmit} className="prompt-form">
              <label className="field-label" htmlFor="prompt">输入提示词</label>
              <textarea
                id="prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：一座漂浮在云海中的赛博东方主城，霓虹灯、体积光、电影级镜头语言"
                rows={7}
                maxLength={2000}
                required
                className="prompt-input"
              />

              <div className="form-meta">
                <span>{prompt.length} / 2000</span>
                <div className="mode-switcher" role="radiogroup" aria-label="生成模式">
                  <label className={`mode-option ${generationMode === 'image' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="generationMode"
                      value="image"
                      checked={generationMode === 'image'}
                      onChange={(e) => setGenerationMode(e.target.value)}
                    />
                    <span>仅图片</span>
                  </label>
                  <label className={`mode-option ${generationMode === 'video' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="generationMode"
                      value="video"
                      checked={generationMode === 'video'}
                      onChange={(e) => setGenerationMode(e.target.value)}
                    />
                    <span>仅视频</span>
                  </label>
                  <label className={`mode-option ${generationMode === 'both' ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="generationMode"
                      value="both"
                      checked={generationMode === 'both'}
                      onChange={(e) => setGenerationMode(e.target.value)}
                    />
                    <span>图片 + 视频</span>
                  </label>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !prompt.trim() || !userId}
                className="generate-button"
              >
                {loading ? '生成任务执行中...' : '启动生成'}
              </button>
            </form>

            {error && (
              <div className="alert-card">
                <strong>需要处理的问题</strong>
                <p>{error}</p>
              </div>
            )}
          </section>

          <section className="panel panel-side">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">PIPELINE STATUS</span>
                <h2>执行看板</h2>
              </div>
              <div className="progress-ring">
                <strong>{progressStats.percent}%</strong>
                <span>{progressStats.completed}/{progressStats.total}</span>
              </div>
            </div>

            <div className="timeline">
              {history.length === 0 ? (
                <div className="empty-state">
                  <p>提交任务后，这里会展示从分析、检索、增强到生成的完整链路。</p>
                </div>
              ) : (
                history.map((step, index) => (
                  <div key={step.id} className={`timeline-item ${step.status}`}>
                    <div className="timeline-index">{String(index + 1).padStart(2, '0')}</div>
                    <div className="timeline-body">
                      <div className="timeline-title">
                        <strong>{PHASE_LABELS[step.phase] || step.phase || step.step}</strong>
                        <span>{step.status}</span>
                      </div>
                      <p>{step.step}</p>
                      <small>{formatDuration(step.duration_ms)}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </section>

        {result && (
          <section className="panel result-panel">
            <div className="panel-head">
              <div>
                <span className="panel-kicker">OUTPUT PREVIEW</span>
                <h2>生成结果</h2>
              </div>
              <div className="status-pill status-ok">已完成</div>
            </div>

            <div className="result-grid">
              <div className="result-main">
                {imageUrl && (
                  <div className="result-block">
                    <div className="result-block-head">
                      <h3>图片结果</h3>
                      <div className="inline-actions">
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mini-link"
                        >
                          打开图片原始结果
                        </a>
                      </div>
                    </div>

                    <div className="media-shell">
                      <img
                        src={imageUrl}
                        alt="生成图片结果"
                        className="result-image"
                      />

                      <button
                        type="button"
                        onClick={handleImageDownload}
                        className="media-download"
                      >
                        下载图片
                      </button>
                    </div>
                  </div>
                )}

                {videoUrl && (
                  <div className="result-block">
                    <div className="result-block-head">
                      <h3>视频结果</h3>
                      <div className="inline-actions">
                        <a
                          href={videoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mini-link"
                        >
                          打开视频原始结果
                        </a>
                      </div>
                    </div>

                    <video
                      src={videoUrl}
                      controls
                      className="result-video"
                    />
                  </div>
                )}
              </div>

              <aside className="result-meta">
                <div className="meta-card">
                  <span>任务状态</span>
                  <strong>{result.status}</strong>
                </div>
                <div className="meta-card">
                  <span>生成模式</span>
                  <strong>{getModeText(result.metadata?.mode)}</strong>
                </div>
                <div className="meta-card">
                  <span>总耗时</span>
                  <strong>
                    {result.metadata?.totalDuration
                      ? `${(result.metadata.totalDuration / 1000).toFixed(2)}s`
                      : '--'}
                  </strong>
                </div>
                <div className="meta-card">
                  <span>增强提示词</span>
                  <p>{enhancedPrompt || '无'}</p>
                </div>

                {imageUrl && (
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-link secondary"
                  >
                    打开图片原始结果
                  </a>
                )}

                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="result-link"
                  >
                    打开视频原始结果
                  </a>
                )}
              </aside>
            </div>
          </section>
        )}
      </main>

      <style jsx global>{`
        :root {
          --bg: #06131f;
          --panel: rgba(8, 19, 31, 0.74);
          --panel-border: rgba(117, 215, 255, 0.16);
          --text: #e9f3ff;
          --muted: #8ba3bc;
          --cyan: #6de7ff;
          --violet: #8f7cff;
          --green: #3ef7b2;
          --danger: #ff8d8d;
          --shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
        }

        * {
          box-sizing: border-box;
        }

        html, body, #__next {
          min-height: 100%;
        }

        body {
          margin: 0;
          color: var(--text);
          background:
            radial-gradient(circle at top, rgba(61, 139, 255, 0.18), transparent 32%),
            radial-gradient(circle at 20% 20%, rgba(109, 231, 255, 0.12), transparent 24%),
            linear-gradient(135deg, #04101a 0%, #071828 45%, #030812 100%);
          font-family: 'Segoe UI', 'Microsoft YaHei', sans-serif;
          line-height: 1.6;
        }

        a {
          color: inherit;
        }

        .page-shell {
          position: relative;
          overflow: hidden;
          min-height: 100vh;
        }

        .ambient {
          position: absolute;
          border-radius: 999px;
          filter: blur(40px);
          opacity: 0.65;
          pointer-events: none;
        }

        .ambient-one {
          top: 80px;
          left: -60px;
          width: 260px;
          height: 260px;
          background: rgba(61, 139, 255, 0.25);
        }

        .ambient-two {
          top: 240px;
          right: -40px;
          width: 320px;
          height: 320px;
          background: rgba(143, 124, 255, 0.18);
        }

        .page {
          position: relative;
          z-index: 1;
          width: min(1280px, calc(100% - 32px));
          margin: 0 auto;
          padding: 32px 0 56px;
        }

        .hero-card,
        .panel {
          background: var(--panel);
          border: 1px solid var(--panel-border);
          border-radius: 24px;
          box-shadow: var(--shadow);
          backdrop-filter: blur(20px);
        }

        .hero-card {
          display: grid;
          grid-template-columns: 1.7fr 1fr;
          gap: 24px;
          padding: 28px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }

        .hero-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, rgba(109, 231, 255, 0.08), transparent 45%, rgba(143, 124, 255, 0.06));
          pointer-events: none;
        }

        .eyebrow,
        .panel-kicker,
        .metric-label {
          display: inline-block;
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--cyan);
        }

        .hero-copy h1 {
          margin: 10px 0 12px;
          font-size: clamp(42px, 6vw, 74px);
          line-height: 0.95;
          letter-spacing: -0.04em;
        }

        .hero-text {
          max-width: 620px;
          margin: 0;
          font-size: 18px;
          color: var(--muted);
        }

        .hero-metrics {
          display: grid;
          gap: 14px;
          align-content: center;
        }

        .metric {
          padding: 18px 20px;
          border-radius: 18px;
          border: 1px solid rgba(109, 231, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
        }

        .metric strong {
          display: block;
          margin-top: 10px;
          font-size: 20px;
        }

        .workspace-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.8fr);
          gap: 24px;
        }

        .panel {
          padding: 24px;
        }

        .panel-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }

        .panel-head h2 {
          margin: 8px 0 0;
          font-size: 28px;
        }

        .status-pill {
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          white-space: nowrap;
        }

        .status-ok {
          color: #b7ffea;
          background: rgba(62, 247, 178, 0.12);
          border-color: rgba(62, 247, 178, 0.3);
        }

        .status-error {
          color: #ffd1d1;
          background: rgba(255, 141, 141, 0.12);
          border-color: rgba(255, 141, 141, 0.3);
        }

        .status-wait {
          color: #d9e7ff;
          background: rgba(61, 139, 255, 0.12);
          border-color: rgba(61, 139, 255, 0.3);
        }

        .prompt-form {
          display: grid;
          gap: 16px;
        }

        .field-label {
          font-size: 15px;
          color: #dbe6f6;
        }

        .prompt-input {
          width: 100%;
          min-height: 190px;
          padding: 18px 20px;
          border-radius: 20px;
          border: 1px solid rgba(109, 231, 255, 0.18);
          background: rgba(2, 10, 18, 0.78);
          color: var(--text);
          font-size: 16px;
          resize: vertical;
          outline: none;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
        }

        .prompt-input:focus {
          border-color: rgba(109, 231, 255, 0.45);
          box-shadow: 0 0 0 4px rgba(109, 231, 255, 0.08);
        }

        .prompt-input::placeholder {
          color: #7190ac;
        }

        .form-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          color: var(--muted);
          font-size: 14px;
          flex-wrap: wrap;
        }

        .mode-switcher {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .mode-option {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 999px;
          border: 1px solid rgba(109, 231, 255, 0.18);
          background: rgba(255, 255, 255, 0.03);
          color: #dbebff;
          min-height: 40px;
          padding: 0 14px;
          cursor: pointer;
          transition: border-color 0.18s ease, background 0.18s ease, color 0.18s ease;
        }

        .mode-option input {
          position: absolute;
          opacity: 0;
          pointer-events: none;
        }

        .mode-option.active {
          border-color: rgba(109, 231, 255, 0.45);
          background: rgba(109, 231, 255, 0.1);
          color: #f1fbff;
        }

        .generate-button {
          border: 0;
          border-radius: 18px;
          padding: 16px 24px;
          font-size: 16px;
          font-weight: 700;
          color: #03131f;
          background: linear-gradient(135deg, var(--cyan), #b0f7ff);
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          box-shadow: 0 16px 32px rgba(109, 231, 255, 0.22);
        }

        .generate-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 36px rgba(109, 231, 255, 0.28);
        }

        .generate-button:disabled {
          cursor: not-allowed;
          opacity: 0.5;
          box-shadow: none;
        }

        .alert-card {
          margin-top: 18px;
          padding: 16px 18px;
          border-radius: 18px;
          border: 1px solid rgba(255, 141, 141, 0.28);
          background: rgba(74, 15, 20, 0.52);
          color: #ffe1e1;
        }

        .alert-card strong {
          display: block;
          margin-bottom: 6px;
        }

        .alert-card p {
          margin: 0;
          word-break: break-word;
        }

        .progress-ring {
          min-width: 92px;
          padding: 12px;
          border-radius: 18px;
          text-align: center;
          border: 1px solid rgba(109, 231, 255, 0.18);
          background: rgba(255, 255, 255, 0.03);
        }

        .progress-ring strong {
          display: block;
          font-size: 26px;
          line-height: 1;
        }

        .progress-ring span {
          display: block;
          margin-top: 6px;
          color: var(--muted);
          font-size: 12px;
        }

        .timeline {
          display: grid;
          gap: 14px;
        }

        .empty-state {
          padding: 18px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px dashed rgba(109, 231, 255, 0.12);
          color: var(--muted);
        }

        .empty-state p {
          margin: 0;
        }

        .timeline-item {
          display: grid;
          grid-template-columns: 54px 1fr;
          gap: 14px;
          padding: 16px;
          border-radius: 18px;
          border: 1px solid rgba(109, 231, 255, 0.08);
          background: rgba(255, 255, 255, 0.03);
        }

        .timeline-item.completed {
          border-color: rgba(62, 247, 178, 0.24);
          background: rgba(62, 247, 178, 0.06);
        }

        .timeline-item.processing,
        .timeline-item.pending {
          border-color: rgba(109, 231, 255, 0.18);
        }

        .timeline-index {
          display: grid;
          place-items: center;
          border-radius: 14px;
          background: rgba(109, 231, 255, 0.1);
          color: var(--cyan);
          font-weight: 700;
          min-height: 54px;
        }

        .timeline-title {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: center;
        }

        .timeline-title strong {
          font-size: 16px;
        }

        .timeline-title span {
          color: var(--cyan);
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.1em;
        }

        .timeline-body p,
        .timeline-body small {
          display: block;
          margin-top: 6px;
          color: var(--muted);
        }

        .result-panel {
          margin-top: 24px;
        }

        .result-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(280px, 0.75fr);
          gap: 24px;
        }

        .result-main,
        .result-meta {
          display: grid;
          gap: 18px;
        }

        .result-block,
        .meta-card {
          padding: 18px;
          border-radius: 18px;
          border: 1px solid rgba(109, 231, 255, 0.12);
          background: rgba(255, 255, 255, 0.03);
        }

        .result-block-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 14px;
        }

        .result-block h3 {
          margin: 0;
        }

        .inline-actions {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .mini-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 999px;
          text-decoration: none;
          font-size: 13px;
          color: #dff8ff;
          border: 1px solid rgba(109, 231, 255, 0.2);
          background: rgba(109, 231, 255, 0.08);
        }

        .media-shell {
          position: relative;
        }

        .result-image,
        .result-video {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(109, 231, 255, 0.14);
          display: block;
          background: rgba(4, 14, 24, 0.82);
        }

        .media-download {
          position: absolute;
          right: 14px;
          bottom: 14px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0 14px;
          border-radius: 999px;
          border: 0;
          font-size: 14px;
          font-weight: 700;
          color: #04131f;
          background: linear-gradient(135deg, rgba(109, 231, 255, 0.95), rgba(176, 247, 255, 0.95));
          box-shadow: 0 14px 28px rgba(109, 231, 255, 0.22);
          cursor: pointer;
        }

        .meta-card span {
          display: block;
          color: var(--muted);
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
        }

        .meta-card strong {
          font-size: 18px;
        }

        .meta-card p {
          margin: 0;
          color: #dce9f8;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .result-link {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          border-radius: 16px;
          text-decoration: none;
          background: linear-gradient(135deg, rgba(61, 139, 255, 0.82), rgba(143, 124, 255, 0.92));
          color: white;
          font-weight: 700;
          box-shadow: 0 14px 28px rgba(61, 139, 255, 0.24);
        }

        .result-link.secondary {
          background: linear-gradient(135deg, rgba(109, 231, 255, 0.16), rgba(109, 231, 255, 0.08));
          border: 1px solid rgba(109, 231, 255, 0.2);
          box-shadow: none;
        }

        @media (max-width: 980px) {
          .hero-card,
          .workspace-grid,
          .result-grid {
            grid-template-columns: 1fr;
          }

          .page {
            width: min(100% - 24px, 1280px);
            padding-top: 20px;
          }
        }

        @media (max-width: 640px) {
          .hero-card,
          .panel {
            padding: 18px;
            border-radius: 20px;
          }

          .hero-copy h1 {
            font-size: 42px;
          }

          .panel-head h2 {
            font-size: 24px;
          }

          .timeline-item {
            grid-template-columns: 44px 1fr;
          }

          .result-block-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .media-download {
            right: 10px;
            bottom: 10px;
          }
        }
      `}</style>
    </div>
  );
}
