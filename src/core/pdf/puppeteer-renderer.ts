/**
 * Puppeteer Renderer - HTML generation and Puppeteer PDF rendering
 */

import * as fs from 'fs';
import * as path from 'path';
import { PDFDocument as PDFLibDocument } from 'pdf-lib';
import { PDFContent, PDFSection, VideoMetadata, ContentSummary } from '../../types/index.js';
import { PDFConfig } from '../../types/config.js';
import {
  formatTimestamp,
  buildTimestampUrl,
  cleanSubtitleText,
  deduplicateSubtitles,
  cleanMixedLanguageText,
} from '../../utils/index.js';
import { logger } from '../../utils/logger.js';
import { normalizeTextForPDF } from '../../utils/text-normalizer.js';
import { Theme } from './themes.js';

/**
 * Video type labels for display
 */
const VIDEO_TYPE_LABELS: Record<string, string> = {
  conference_talk: '컨퍼런스 발표',
  tutorial: '튜토리얼',
  interview: '인터뷰',
  lecture: '강의',
  demo: '제품 데모',
  discussion: '토론/패널',
  unknown: '기타',
};

/**
 * Process subtitles: clean, normalize, and deduplicate
 */
function processSubtitles(subtitles: { text: string }[], forPDF: boolean = true): string[] {
  const subtitleTexts = subtitles.map((sub) => {
    const cleaned = cleanSubtitleText(sub.text);
    const mixed = cleanMixedLanguageText(cleaned, 'ko');
    return forPDF ? normalizeTextForPDF(mixed) : mixed;
  });
  return deduplicateSubtitles(subtitleTexts);
}

export default class PuppeteerRenderer {
  private config: PDFConfig;

  constructor(config: PDFConfig, _theme: Theme) {
    this.config = config;
    // theme parameter kept for consistency with PDFKitRenderer but not used
  }

  /**
   * HTML 생성
   */
  async generateHTML(content: PDFContent, outputPath: string): Promise<void> {
    // Route to minimal-neon HTML generator if layout is minimal-neon
    if (this.config.layout === 'minimal-neon') {
      return this.generateMinimalNeonHTML(content, outputPath);
    }

    const timestamp = formatTimestamp;
    const { metadata, sections } = content;

    let html = `<!DOCTYPE html>
<html lang="${this.detectLanguage(sections)}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" content="#2563eb" media="(prefers-color-scheme: light)">
  <meta name="theme-color" content="#111827" media="(prefers-color-scheme: dark)">
  <meta name="description" content="${metadata.title} - ${metadata.channel} | YouTube 영상 자막 및 스크린샷">
  <meta property="og:title" content="${metadata.title}">
  <meta property="og:description" content="${metadata.channel}의 YouTube 영상">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://youtube.com/watch?v=${metadata.id}">
  ${metadata.thumbnail ? `<meta property="og:image" content="${metadata.thumbnail}">` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${metadata.title}">
  <meta name="twitter:description" content="${metadata.channel}의 YouTube 영상 자막">
  ${metadata.thumbnail ? `<meta name="twitter:image" content="${metadata.thumbnail}">` : ''}
  <link rel="canonical" href="https://youtube.com/watch?v=${metadata.id}">
  <meta name="robots" content="noindex, nofollow">
  <meta name="generator" content="v2doc">
  <title>${metadata.title} | ${metadata.channel}</title>
  <style>
    :root {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --secondary-color: #6b7280;
      --border-color: #e5e7eb;
      --link-color: #2563eb;
      --section-bg: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-color: #111827;
        --text-color: #f3f4f6;
        --secondary-color: #9ca3af;
        --border-color: #374151;
        --link-color: #60a5fa;
        --section-bg: #1f2937;
      }
    }
    /* 수동 다크 모드 */
    :root[data-theme="dark"] {
      --bg-color: #111827;
      --text-color: #f3f4f6;
      --secondary-color: #9ca3af;
      --border-color: #374151;
      --link-color: #60a5fa;
      --section-bg: #1f2937;
    }
    :root[data-theme="light"] {
      --bg-color: #ffffff;
      --text-color: #1f2937;
      --secondary-color: #6b7280;
      --border-color: #e5e7eb;
      --link-color: #2563eb;
      --section-bg: #ffffff;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      line-height: 1.7;
      background-color: var(--bg-color);
      color: var(--text-color);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      min-height: 100vh;
    }
    h1 { color: var(--text-color); line-height: 1.3; word-wrap: break-word; overflow-wrap: break-word; max-width: 100%; margin-bottom: 15px; }
    h1 a:hover { color: var(--link-color) !important; }
    a { transition: color 0.2s; }
    .meta { color: var(--secondary-color); margin-bottom: 20px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 5px; }
    .meta a { color: var(--link-color); text-decoration: none; transition: color 0.2s; }
    .meta a:hover { text-decoration: underline; }
    .meta p { margin: 0; padding: 4px 0; }
    .section {
      margin: 35px 0;
      padding: 25px;
      border: 1px solid var(--border-color);
      border-radius: 12px;
      background-color: var(--section-bg);
      counter-increment: section;
      position: relative;
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
    }
    .section::before {
      content: counter(section);
      position: absolute;
      top: -12px;
      left: 15px;
      background: var(--link-color);
      color: white;
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: bold;
      min-width: 20px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .timestamp { font-size: 14px; color: var(--link-color); text-decoration: none; font-weight: bold; display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; background: var(--border-color); border-radius: 4px; transition: background 0.2s; }
    .timestamp:hover { text-decoration: none; background: var(--link-color); color: white; }
    .timestamp::before { content: '▶'; font-size: 10px; transition: transform 0.2s; }
    .timestamp:hover::before { transform: translateX(3px); color: white; }
    .screenshot { max-width: 100%; height: auto; aspect-ratio: 16/9; object-fit: cover; border-radius: 4px; margin: 10px 0; cursor: zoom-in; transition: transform 0.2s, box-shadow 0.2s, opacity 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); background: var(--border-color); }
    .screenshot:hover { box-shadow: 0 6px 16px rgba(0,0,0,0.18); transform: scale(1.01); }
    .screenshot.zoomed { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%) scale(1); max-width: 95vw; max-height: 95vh; z-index: 1000; cursor: zoom-out; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.6); animation: fadeIn 0.2s ease-out; }
    .overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.85); z-index: 999; backdrop-filter: blur(5px); }
    .overlay.active { display: block; }
    /* 단축키 도움말 */
    .help-modal { display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: var(--section-bg); padding: 25px 35px; border-radius: 16px; z-index: 1001; box-shadow: 0 15px 60px rgba(0,0,0,0.35); max-width: 320px; border: 1px solid var(--border-color); }
    .help-modal.active { display: block; }
    .help-modal h3 { margin: 0 0 15px 0; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
    .help-modal kbd { background: var(--border-color); padding: 4px 8px; border-radius: 5px; font-family: ui-monospace, monospace; font-size: 13px; border: 1px solid var(--secondary-color); box-shadow: 0 1px 2px rgba(0,0,0,0.1); }
    .help-modal ul { list-style: none; padding: 0; margin: 0; }
    .help-modal li { margin: 10px 0; display: flex; justify-content: space-between; align-items: center; font-size: 14px; }
    .help-modal button { margin-top: 15px; width: 100%; padding: 10px; border: none; background: var(--link-color); color: white; border-radius: 6px; cursor: pointer; font-weight: 500; transition: background 0.2s, transform 0.2s; }
    .help-modal button:hover { background: #1d4ed8; transform: scale(1.02); }
    /* 진행 표시줄 */
    .progress-bar { position: fixed; top: 0; left: 0; height: 4px; background: linear-gradient(90deg, var(--link-color), #60a5fa); z-index: 1000; transition: width 0.1s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    /* 스크롤 스냅 */
    html { scroll-behavior: smooth; }
    /* 텍스트 선택 스타일 */
    ::selection { background: var(--link-color); color: white; }
    ::-moz-selection { background: var(--link-color); color: white; }
    /* 포커스 스타일 */
    :focus-visible { outline: 2px solid var(--link-color); outline-offset: 2px; }
    .subtitle { color: var(--text-color); margin: 15px 0; counter-reset: line; padding-top: 10px; border-top: 1px dashed var(--border-color); }
    .subtitle p { position: relative; padding-left: 30px; margin: 8px 0; line-height: 1.7; }
    .subtitle p::before { counter-increment: line; content: counter(line); position: absolute; left: 0; color: var(--secondary-color); font-size: 11px; opacity: 0.5; font-family: ui-monospace, monospace; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 25px 0; opacity: 0.6; }
    /* 스크롤바 스타일 */
    ::-webkit-scrollbar { width: 8px; height: 8px; }
    ::-webkit-scrollbar-track { background: var(--bg-color); }
    ::-webkit-scrollbar-thumb { background: var(--secondary-color); border-radius: 4px; }
    ::-webkit-scrollbar-thumb:hover { background: var(--link-color); }
    /* 목차 스타일 */
    .toc { margin: 20px 0; padding: 15px 20px; background: var(--section-bg); border-radius: 10px; border: 1px solid var(--border-color); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
    .toc h2 { margin: 0 0 12px 0; font-size: 16px; cursor: pointer; user-select: none; }
    .toc h2::after { content: ' ▼'; font-size: 10px; }
    .toc.collapsed h2::after { content: ' ▶'; }
    .toc.collapsed .toc-list { display: none; }
    .toc-list { display: flex; flex-wrap: wrap; gap: 8px; list-style: none; padding: 5px 0; margin: 0; max-height: 150px; overflow-y: auto; scrollbar-width: thin; }
    .toc-list li a { display: inline-block; padding: 4px 10px; background: var(--border-color); border-radius: 4px; text-decoration: none; color: var(--link-color); font-size: 13px; transition: all 0.2s; }
    .toc-list li a:hover { background: var(--link-color); color: white; transform: scale(1.05); }
    .toc-list li a:focus { outline: 2px solid var(--link-color); outline-offset: 1px; }
    .toc-list li a.current { background: var(--link-color); color: white; }
    /* 맨 위로 버튼 */
    .back-to-top {
      position: fixed;
      bottom: 30px;
      right: 30px;
      width: 44px;
      height: 44px;
      background: var(--link-color);
      color: white;
      border: none;
      border-radius: 50%;
      cursor: pointer;
      font-size: 22px;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.25);
    }
    .back-to-top:hover { transform: scale(1.1); }
    .back-to-top:focus { outline: 2px solid var(--link-color); outline-offset: 2px; }
    .back-to-top { transition: transform 0.2s, opacity 0.2s; }
    .help-btn:hover { transform: scale(1.1); background: var(--link-color); }
    #themeToggle:hover { transform: scale(1.1); background: var(--secondary-color); }
    #copyAllBtn:hover { transform: scale(1.02); filter: brightness(1.1); }
    /* 검색 박스 */
    .search-box {
      position: sticky;
      top: 0;
      background: var(--bg-color);
      padding: 12px 0;
      z-index: 100;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: 15px;
      backdrop-filter: blur(10px);
    }
    .search-box input {
      width: 100%;
      padding: 12px 40px 12px 16px;
      border: 2px solid var(--border-color);
      border-radius: 12px;
      font-size: 14px;
      background: var(--section-bg);
      color: var(--text-color);
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .search-box input:hover { border-color: var(--secondary-color); }
    .search-box input:focus {
      outline: none;
      border-color: var(--link-color);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
    }
    .search-box input::placeholder { color: var(--secondary-color); }
    .search-count { font-size: 12px; color: var(--secondary-color); margin-top: 5px; transition: opacity 0.2s; padding: 4px 0; }
    .search-count:empty { display: none; }
    .section.hidden { display: none; }
    .section.active { border-color: var(--link-color); box-shadow: 0 0 0 3px var(--link-color), 0 4px 12px rgba(0,0,0,0.1); }
    .section:hover { border-color: var(--secondary-color); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    /* 접기 버튼 */
    .collapse-btn { background: var(--border-color); border: none; color: var(--secondary-color); cursor: pointer; font-size: 12px; padding: 4px 10px; margin-left: 10px; border-radius: 4px; transition: all 0.2s; }
    .collapse-btn:hover { background: var(--link-color); color: white; }
    .collapse-btn:active { transform: scale(0.95); }
    .subtitle.collapsed { display: none; }
    .subtitle:not(.collapsed) { animation: fadeIn 0.2s ease-out; }
    .section:target { animation: highlight 1s ease; }
    @keyframes highlight { 0%, 100% { background: var(--section-bg); } 50% { background: var(--border-color); } }
    .highlight { background-color: #fef08a; color: #1f2937; padding: 1px 2px; border-radius: 2px; transition: background-color 0.2s; }
    .highlight:hover { background-color: #facc15; }
    .highlight { animation: pulse 1.5s ease-in-out infinite; }
    @media (prefers-color-scheme: dark) {
      .highlight { background-color: #854d0e; color: #fef3c7; }
    }
    /* 모바일 반응형 */
    @media (max-width: 600px) {
      body { padding: 12px; }
      h1 { font-size: 1.4em; word-break: keep-all; }
      .meta { font-size: 14px; }
      .section { padding: 12px; margin: 20px 0; }
      .timestamp { font-size: 13px; }
      .subtitle { font-size: 15px; }
      .subtitle p { margin: 6px 0; }
      .toc { padding: 10px; }
      .toc-list { gap: 6px; }
      .toc-list li a { padding: 3px 8px; font-size: 12px; }
      .back-to-top { bottom: 15px; right: 15px; width: 36px; height: 36px; font-size: 18px; }
      .help-btn { bottom: 15px; right: 60px; width: 36px; height: 36px; font-size: 16px; }
      #themeToggle { bottom: 15px; right: 105px; width: 36px; height: 36px; font-size: 16px; }
      .section:hover { transform: none; box-shadow: none; }
      .section::before { font-size: 10px; padding: 2px 7px; }
    }
    /* 초기 로딩 애니메이션 */
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    body { animation: fadeIn 0.3s ease-out; }
    /* 인쇄 스타일 */
    @media print {
      .search-box, .back-to-top, .toc, .progress-bar, .help-modal, .overlay, .collapse-btn, .copy-btn, .help-btn, #themeToggle, .line-count { display: none !important; }
      .section { break-inside: avoid; border: none; box-shadow: none; page-break-inside: avoid; }
      .section::before { display: none; }
      body { max-width: 100%; padding: 0; }
      h1, .meta { page-break-after: avoid; }
      .screenshot { max-width: 80%; }
    }
  </style>
</head>
<body>
  <div class="progress-bar" id="progressBar"></div>
  <h1 id="top"><a href="https://youtube.com/watch?v=${metadata.id}" target="_blank" style="color:inherit;text-decoration:none;" title="YouTube에서 보기">${metadata.title}</a></h1>

  <!-- 검색 박스 -->
  <div class="search-box" style="position:relative">
    <input type="text" id="searchInput" placeholder="🔍 자막 검색... (Enter: 다음 결과)" autocomplete="off" style="padding-right:35px">
    <button id="clearSearch" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--secondary-color);cursor:pointer;font-size:18px;display:none;padding:0;line-height:1" title="검색 초기화">&times;</button>
    <div class="search-count" id="searchCount"></div>
  </div>

  <div class="meta">
    <p>👤 <strong>채널:</strong> <a href="https://youtube.com/@${encodeURIComponent(metadata.channel)}" target="_blank" style="color:var(--link-color)">${metadata.channel}</a></p>
    <p>⏱️ <strong>영상 길이:</strong> ${timestamp(metadata.duration)}</p>
    <p>📑 <strong>섹션:</strong> ${sections.length}개</p>
    <p>📖 <strong>읽기 시간:</strong> <span id="readTime"></span></p>
    <p>🔗 <strong>원본:</strong> <a href="https://youtube.com/watch?v=${metadata.id}">YouTube에서 보기</a></p>
    <p>📅 <strong>생성일:</strong> ${new Date().toISOString().split('T')[0]}</p>
    <p style="grid-column: 1 / -1"><button id="copyAllBtn" title="모든 자막을 클립보드에 복사합니다" style="padding:8px 16px;background:var(--link-color);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;transition:background 0.2s,transform 0.2s;">📋 전체 자막 복사</button></p>
  </div>
  <hr>

${
  content.summary && content.summary.summary
    ? `
  <!-- 요약 -->
  <div class="summary" style="margin:20px 0;padding:20px;background:var(--section-bg);border-radius:12px;border:1px solid var(--border-color);border-left:4px solid var(--link-color);">
    <h2 style="margin:0 0 12px 0;font-size:18px;color:var(--text-color);">📝 요약</h2>
    <p style="margin:0;line-height:1.8;color:var(--text-color);">${content.summary.summary}</p>
${
  content.summary.keyPoints && content.summary.keyPoints.length > 0
    ? `
    <h3 style="margin:15px 0 8px 0;font-size:14px;color:var(--secondary-color);">💡 핵심 포인트</h3>
    <ul style="margin:0;padding-left:20px;color:var(--text-color);">
${content.summary.keyPoints.map((point) => `      <li style="margin:5px 0">${point}</li>`).join('\n')}
    </ul>
`
    : ''
}
  </div>
  <hr>
`
    : ''
}
  <!-- 목차 -->
  <nav class="toc">
    <h2>📑 목차 <span style="font-size:12px;font-weight:normal;color:var(--secondary-color)">(${sections.length}개 섹션)</span></h2>
    <ul class="toc-list">
${sections
  .map((s) => {
    const sectionDeduped = processSubtitles(s.subtitles, false);
    const tsId = timestamp(s.timestamp).replace(/:/g, '');
    return `      <li><a href="#section-${tsId}" title="${sectionDeduped.length}줄">${timestamp(s.timestamp)}</a></li>`;
  })
  .join('\n')}
    </ul>
  </nav>
`;

    for (const section of sections) {
      const ts = timestamp(section.timestamp);
      const link = buildTimestampUrl(metadata.id, section.timestamp);
      const imgName = path.basename(section.screenshot.imagePath);

      // 자막 - 정리, 혼합 언어 정리, 중복 제거 (HTML은 PDF 정규화 불필요)
      const dedupedTexts = processSubtitles(section.subtitles, false);
      const lineCount = dedupedTexts.length;

      const sectionId = ts.replace(/:/g, '');

      // 섹션 요약 HTML
      let sectionSummaryHtml = '';
      if (section.sectionSummary && section.sectionSummary.summary) {
        sectionSummaryHtml = `
    <div class="section-summary" style="margin:10px 0;padding:12px 15px;background:linear-gradient(135deg, var(--border-color) 0%, transparent 100%);border-radius:8px;border-left:3px solid var(--link-color);">
      <div style="font-size:13px;color:var(--text-color);line-height:1.6;margin-bottom:8px;">${section.sectionSummary.summary}</div>
      ${
        section.sectionSummary.keyPoints.length > 0
          ? `
      <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--secondary-color);">
        ${section.sectionSummary.keyPoints.map((p) => `<li style="margin:3px 0">${p}</li>`).join('')}
      </ul>`
          : ''
      }
    </div>`;
      }

      // 챕터 제목 HTML
      const chapterTitleHtml = section.chapterTitle
        ? `<h3 style="margin:0 0 10px 0;font-size:16px;color:var(--text-color);">📑 ${section.chapterTitle}</h3>`
        : '';

      html += `
  <div class="section" id="section-${sectionId}" data-timestamp="${section.timestamp}" data-lines="${lineCount}">
    ${chapterTitleHtml}
    <a class="timestamp" href="${link}" target="_blank" title="YouTube에서 ${ts}부터 재생">${ts}</a>
    <span class="line-count" style="font-size:11px;color:var(--secondary-color);margin-left:8px">${lineCount}줄</span>
    <button class="collapse-btn" onclick="this.parentElement.querySelector('.subtitle').classList.toggle('collapsed');this.textContent=this.textContent==='▼'?'▶':'▼';" title="접기/펼치기">▼</button>
    <button class="collapse-btn copy-btn" title="자막 복사" aria-label="이 섹션 자막 복사">📋</button>
    <img class="screenshot" src="./images/${imgName}" alt="Screenshot at ${ts}" loading="lazy" onerror="this.outerHTML='<div style=\\'background:var(--border-color);padding:40px;text-align:center;border-radius:4px;color:var(--secondary-color)\\'>📷 이미지 로드 실패</div>'">${sectionSummaryHtml}
    <div class="subtitle">
`;
      if (dedupedTexts.length === 0) {
        html += `      <p style="color:var(--secondary-color);font-style:italic">(이 구간에 자막이 없습니다)</p>\n`;
      } else {
        for (const text of dedupedTexts) {
          // HTML 출력에서는 특수문자 이스케이프
          const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html += `      <p>${escaped}</p>\n`;
        }
      }

      html += `    </div>
  </div>
`;
    }

    html += `
  <div class="overlay" id="overlay"></div>
  <div class="help-modal" id="helpModal">
    <h3>⌨️ 단축키</h3>
    <ul>
      <li><span><kbd>j</kbd> / <kbd>↓</kbd></span><span>다음 섹션</span></li>
      <li><span><kbd>k</kbd> / <kbd>↑</kbd></span><span>이전 섹션</span></li>
      <li><span><kbd>/</kbd></span><span>검색</span></li>
      <li><span><kbd>g</kbd></span><span>맨 위로</span></li>
      <li><span><kbd>t</kbd></span><span>테마 전환</span></li>
      <li><span><kbd>Esc</kbd></span><span>닫기</span></li>
      <li><span><kbd>?</kbd></span><span>이 도움말</span></li>
    </ul>
    <button onclick="document.getElementById('helpModal').classList.remove('active')">닫기 (Esc)</button>
  </div>

  <footer style="text-align:center;padding:40px 20px;color:var(--secondary-color);font-size:12px;border-top:1px solid var(--border-color);margin-top:40px;background:var(--section-bg);border-radius:8px 8px 0 0;">
    <p style="margin:0">🛠️ Generated by <a href="https://github.com/user/v2doc" style="color:var(--link-color);text-decoration:none;font-weight:500" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">v2doc</a></p>
    <p style="margin:5px 0 0 0;font-size:11px">⚖️ 영상 정보 및 자막의 저작권은 원 제작자에게 있습니다</p>
  </footer>

  <!-- 맨 위로 버튼 -->
  <button class="back-to-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="맨 위로 (g 키)" aria-label="맨 위로 이동">↑</button>
  <!-- 도움말 버튼 -->
  <button class="help-btn" onclick="document.getElementById('helpModal').classList.add('active')" title="단축키 도움말 (? 키)" aria-label="단축키 도움말 열기" style="position:fixed;bottom:30px;right:80px;width:44px;height:44px;background:var(--secondary-color);color:white;border:none;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 15px rgba(0,0,0,0.25);transition:transform 0.2s;">?</button>
  <!-- 다크 모드 토글 -->
  <button id="themeToggle" title="테마 전환" style="position:fixed;bottom:30px;right:130px;width:40px;height:40px;background:var(--border-color);color:var(--text-color);border:none;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,0.2);transition:transform 0.2s,background 0.2s;">🌓</button>
  <script>
    // 맨 위로 버튼 + 진행 표시줄
    const btn = document.querySelector('.back-to-top');
    const progressBar = document.getElementById('progressBar');
    window.addEventListener('scroll', () => {
      const show = window.scrollY > 300;
      btn.style.display = show ? 'flex' : 'none';
      btn.style.opacity = show ? '1' : '0';
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollHeight > 0 ? (window.scrollY / scrollHeight) * 100 : 0;
      progressBar.style.width = progress + '%';
    });

    // 자막 검색 기능
    const searchInput = document.getElementById('searchInput');
    const searchCount = document.getElementById('searchCount');
    const sections = document.querySelectorAll('.section');

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      let matchCount = 0;

      sections.forEach(section => {
        const subtitle = section.querySelector('.subtitle');
        const originalTexts = subtitle.querySelectorAll('p');
        let hasMatch = false;

        originalTexts.forEach(p => {
          const text = p.textContent || '';
          if (!query) {
            p.innerHTML = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          } else if (text.toLowerCase().includes(query)) {
            hasMatch = true;
            matchCount++;
            const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            const regex = new RegExp('(' + query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&') + ')', 'gi');
            p.innerHTML = escaped.replace(regex, '<span class="highlight">$1</span>');
          } else {
            p.innerHTML = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          }
        });

        section.classList.toggle('hidden', query && !hasMatch);
      });

      searchCount.textContent = query ? (matchCount > 0 ? matchCount + '개 섹션에서 발견' : '결과 없음') : '';
    });

    // Enter 키로 다음 검색 결과로 이동
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const visible = visibleSections();
        if (visible.length > 0) {
          currentIdx = (currentIdx + 1) % visible.length;
          visible[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          updateActiveSection();
        }
      }
    });

    // 검색 클리어 버튼
    const clearBtn = document.getElementById('clearSearch');
    searchInput.addEventListener('input', () => {
      clearBtn.style.display = searchInput.value ? 'block' : 'none';
    });
    clearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchInput.dispatchEvent(new Event('input'));
      clearBtn.style.display = 'none';
      searchInput.focus();
    });

    // 키보드 네비게이션 (j/k)
    let currentIdx = -1;
    const visibleSections = () => Array.from(sections).filter(s => !s.classList.contains('hidden'));
    document.addEventListener('keydown', (e) => {
      if (e.target === searchInput) return;
      const visible = visibleSections();
      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        currentIdx = Math.min(currentIdx + 1, visible.length - 1);
        visible[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveSection();
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        currentIdx = Math.max(currentIdx - 1, 0);
        visible[currentIdx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        updateActiveSection();
      }
    });

    function updateActiveSection() {
      const visible = visibleSections();
      visible.forEach((s, i) => s.classList.toggle('active', i === currentIdx));
    }

    // 복사 버튼
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const subtitle = btn.closest('.section').querySelector('.subtitle');
        const text = Array.from(subtitle.querySelectorAll('p')).map(p => p.textContent).join('\\n');
        try {
          await navigator.clipboard.writeText(text);
          btn.textContent = '✓';
          btn.style.color = '#22c55e';
          setTimeout(() => { btn.textContent = '📋'; btn.style.color = ''; }, 1500);
        } catch {
          btn.textContent = '✗';
          btn.style.color = '#ef4444';
          setTimeout(() => { btn.textContent = '📋'; btn.style.color = ''; }, 1500);
        }
      });
    });

    // 스크롤 위치 기억
    const storageKey = 'yt2pdf_scroll_' + '${metadata.id}';
    window.addEventListener('scroll', () => {
      localStorage.setItem(storageKey, window.scrollY.toString());
    });
    const savedScroll = localStorage.getItem(storageKey);
    if (savedScroll) {
      setTimeout(() => window.scrollTo(0, parseInt(savedScroll)), 100);
    }

    // 목차 접기 (상태 저장)
    const tocKey = 'yt2pdf_toc_collapsed';
    const toc = document.querySelector('.toc');
    if (localStorage.getItem(tocKey) === 'true') toc.classList.add('collapsed');
    document.querySelector('.toc h2')?.addEventListener('click', () => {
      toc.classList.toggle('collapsed');
      localStorage.setItem(tocKey, toc.classList.contains('collapsed'));
    });

    // 이미지 확대
    const overlay = document.getElementById('overlay');
    document.querySelectorAll('.screenshot').forEach(img => {
      img.addEventListener('click', () => {
        img.classList.toggle('zoomed');
        overlay.classList.toggle('active');
      });
    });
    overlay.addEventListener('click', closeZoom);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeZoom(); document.getElementById('helpModal').classList.remove('active'); }
      if (e.key === '?' && e.target !== searchInput) document.getElementById('helpModal').classList.toggle('active');
      if (e.key === '/' && e.target !== searchInput) { e.preventDefault(); searchInput.focus(); }
      if (e.key === 'g' && e.target !== searchInput) { window.scrollTo({top:0,behavior:'smooth'}); }
      if (e.key === 't' && e.target !== searchInput) { document.getElementById('themeToggle').click(); }
    });
    function closeZoom() {
      document.querySelector('.screenshot.zoomed')?.classList.remove('zoomed');
      overlay.classList.remove('active');
    }

    // 스크롤 스파이 (목차 하이라이트)
    const tocLinks = document.querySelectorAll('.toc-list a');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          tocLinks.forEach(link => {
            link.classList.toggle('current', link.getAttribute('href') === '#' + id);
          });
        }
      });
    }, { threshold: 0.3 });
    sections.forEach(s => observer.observe(s));

    // 전체 자막 복사
    const copyAllBtn = document.getElementById('copyAllBtn');
    copyAllBtn.addEventListener('click', async () => {
      const allText = Array.from(document.querySelectorAll('.subtitle'))
        .map(s => Array.from(s.querySelectorAll('p')).map(p => p.textContent).join('\\n'))
        .join('\\n\\n');
      try {
        await navigator.clipboard.writeText(allText);
        copyAllBtn.textContent = '✓ 복사됨!';
        copyAllBtn.style.background = '#22c55e';
        setTimeout(() => { copyAllBtn.textContent = '전체 자막 복사'; copyAllBtn.style.background = ''; }, 1500);
      } catch {
        copyAllBtn.textContent = '✗ 실패';
        copyAllBtn.style.background = '#ef4444';
        setTimeout(() => { copyAllBtn.textContent = '전체 자막 복사'; copyAllBtn.style.background = ''; }, 1500);
      }
    });

    // 읽기 시간 계산
    const allSubtitleText = Array.from(document.querySelectorAll('.subtitle p')).map(p => p.textContent).join(' ');
    const wordCount = allSubtitleText.split(/\\s+/).filter(w => w.length > 0).length;
    const readMinutes = Math.ceil(wordCount / 200); // 분당 200단어 가정
    document.getElementById('readTime').textContent = readMinutes <= 1 ? '1분 미만' : \`약 \${readMinutes}분 (\${wordCount.toLocaleString()}단어)\`;

    // 다크 모드 토글
    const themeToggle = document.getElementById('themeToggle');
    const root = document.documentElement;
    const savedTheme = localStorage.getItem('yt2pdf_theme');
    if (savedTheme) {
      root.setAttribute('data-theme', savedTheme);
      themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    }
    themeToggle.addEventListener('click', () => {
      const current = root.getAttribute('data-theme');
      const next = current === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('yt2pdf_theme', next);
      themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });
  </script>
</body>
</html>`;

    await fs.promises.writeFile(outputPath, html, 'utf-8');
    logger.success(`HTML 생성 완료: ${outputPath}`);
  }

  /**
   * Minimal Neon HTML 생성 - Layout6_Minimal_Neon_Full.html 템플릿 기반
   */
  async generateMinimalNeonHTML(content: PDFContent, outputPath: string): Promise<void> {
    const { metadata, sections, summary } = content;

    // Helper function to get tag badge class and color
    const getTagBadgeClass = (tag: string): string => {
      const tagMap: Record<string, string> = {
        INSIGHT: 'insight',
        TECHNIQUE: 'technique',
        DEFINITION: 'definition',
        METRIC: 'metric',
        TOOL: 'tool',
      };
      return tagMap[tag] || 'insight';
    };

    // Parse tag from bullet text
    const parseTaggedBullet = (bullet: string): { tag: string | null; content: string } => {
      const tagPattern = /^\[([A-Z_]+)\]\s*/;
      const match = bullet.match(tagPattern);
      if (match) {
        return { tag: match[1], content: bullet.slice(match[0].length) };
      }
      return { tag: null, content: bullet };
    };

    // Build TOC items HTML
    const tocItemsHtml = sections
      .map((section, idx) => {
        const ts = formatTimestamp(section.timestamp);
        const title =
          section.chapterTitle ||
          section.sectionSummary?.summary?.substring(0, 50) ||
          `섹션 ${idx + 1}`;
        return `                <div class="toc-item"><span class="toc-time">${ts}</span><span class="toc-title">${this.escapeHtml(title)}</span></div>`;
      })
      .join('\n');

    // Build Key Insights HTML
    let keyInsightsHtml = '';
    if (summary && summary.keyPoints && summary.keyPoints.length > 0) {
      const insightCards = summary.keyPoints
        .map((point, idx) => {
          const num = String(idx + 1).padStart(2, '0');

          let title: string;
          let description: string = point;

          // Strategy 1: Extract quoted terms with various quote styles
          // Match Korean-style quotes: '...', "...", 「...」, 『...』, '...', "..."
          const quotePatterns = [
            /[\u2018\u2019\u0027]([^\u2018\u2019\u0027]{2,25})[\u2018\u2019\u0027]/, // Single quotes: ', ', '
            /[\u201C\u201D\u0022]([^\u201C\u201D\u0022]{2,25})[\u201C\u201D\u0022]/, // Double quotes: ", ", "
            /\u300C([^\u300D]{2,25})\u300D/, // Korean bracket: 「」
            /\u300E([^\u300F]{2,25})\u300F/, // Korean double bracket: 『』
          ];

          let quotedMatch = null;
          for (const pattern of quotePatterns) {
            quotedMatch = point.match(pattern);
            if (quotedMatch) break;
          }

          if (quotedMatch) {
            title = quotedMatch[1];
          }
          // Strategy 2: Look for "X 사례" or "X 격차" patterns at the START
          else if (
            point.match(
              /^([가-힣A-Za-z0-9]+\s*(사례|격차|원칙|방식|효과|전략|모델|도입|엔지니어링))/
            )
          ) {
            const match = point.match(
              /^([가-힣A-Za-z0-9]+\s*(사례|격차|원칙|방식|효과|전략|모델|도입|엔지니어링))/
            );
            title = match![1];
          }
          // Strategy 3: Look for colon/dash pattern
          else {
            const colonMatch = point.match(/^(.{3,25}?)\s*[:：\-–—]\s*(.+)$/s);
            if (colonMatch && colonMatch[1].trim().length >= 3) {
              title = colonMatch[1].trim();
              description = colonMatch[2].trim();
            }
            // Strategy 4: Smarter fallback - strip quotes first, then extract words
            else {
              // Remove leading quotes and extract clean words
              const cleanPoint = point.replace(/^['''"""「」『』]+/, '').trim();
              const words = cleanPoint.split(/\s+/);

              // Take first 3 words, max 18 chars
              let shortTitle = '';
              for (let i = 0; i < Math.min(3, words.length); i++) {
                const nextWord = words[i].replace(/['''"""「」『』()（）]/g, ''); // Strip quotes/parens
                if ((shortTitle + ' ' + nextWord).trim().length > 18) break;
                shortTitle = shortTitle ? shortTitle + ' ' + nextWord : nextWord;
              }
              title = shortTitle || cleanPoint.substring(0, 15);
            }
          }

          // Final check: If title is too long, truncate smartly
          const MAX_TITLE_LENGTH = 12;
          if (title.length > MAX_TITLE_LENGTH) {
            // Try to cut at a natural boundary (space, slash, parenthesis)
            const naturalBreak = title.substring(0, MAX_TITLE_LENGTH).lastIndexOf(' ');
            const slashBreak = title.substring(0, MAX_TITLE_LENGTH).lastIndexOf('/');
            const parenBreak = title.substring(0, MAX_TITLE_LENGTH).lastIndexOf('(');

            const breakPoint = Math.max(naturalBreak, slashBreak, parenBreak);
            if (breakPoint > 5) {
              title = title.substring(0, breakPoint).trim();
            } else {
              title = title.substring(0, MAX_TITLE_LENGTH - 1).trim() + '…';
            }
          }

          // Remove trailing connectives (로, 은, 는, 이, 가, 을, 를, 의, 에, 서)
          title = title.replace(/[로은는이가을를의에서]$/, '').trim();

          return `                <div class="insight-card">
                    <div class="insight-num">${num}</div>
                    <div class="insight-content">
                        <h4>${this.escapeHtml(title)}</h4>
                        <p>${this.escapeHtml(description)}</p>
                    </div>
                </div>`;
        })
        .join('\n');

      keyInsightsHtml = `
        <!-- KEY INSIGHTS -->
        <section class="section">
            <div class="section-label">Key Insights</div>
            <div class="insight-grid">
${insightCards}
            </div>
        </section>
`;
    }

    // Build Detail Sections HTML
    const detailSectionsHtml = sections
      .map((section, idx) => {
        const ts = formatTimestamp(section.timestamp);
        const title =
          section.chapterTitle ||
          section.sectionSummary?.summary?.substring(0, 60) ||
          `섹션 ${idx + 1}`;
        const imgName = path.basename(section.screenshot.imagePath);
        const youtubeLink = buildTimestampUrl(metadata.id, section.timestamp);

        // Key Points HTML
        let keyPointsHtml = '';
        if (section.sectionSummary?.keyPoints && section.sectionSummary.keyPoints.length > 0) {
          const bulletItems = section.sectionSummary.keyPoints
            .map((point) => `                            <li>${this.escapeHtml(point)}</li>`)
            .join('\n');
          keyPointsHtml = `
                    <div class="detail-subsection">
                        <div class="subsection-label">Key Points</div>
                        <ul class="bullet-list">
${bulletItems}
                        </ul>
                    </div>`;
        }

        // Main Information HTML with tags
        let mainInfoHtml = '';
        if (section.sectionSummary?.mainInformation) {
          const mainInfo = section.sectionSummary.mainInformation;
          let paragraphsHtml = '';
          let bulletsHtml = '';

          if (mainInfo.paragraphs && mainInfo.paragraphs.length > 0) {
            paragraphsHtml = mainInfo.paragraphs
              .map(
                (para) =>
                  `                        <p class="text-block">${this.escapeHtml(para)}</p>`
              )
              .join('\n');
          }

          if (mainInfo.bullets && mainInfo.bullets.length > 0) {
            const taggedBullets = mainInfo.bullets
              .map((bullet) => {
                const { tag, content } = parseTaggedBullet(bullet);
                if (tag) {
                  const tagClass = getTagBadgeClass(tag);
                  return `                            <li><span class="tag-badge ${tagClass}">${tag}</span> ${this.escapeHtml(content)}</li>`;
                }
                return `                            <li>${this.escapeHtml(bullet)}</li>`;
              })
              .join('\n');

            bulletsHtml = `
                        <ul class="tag-list">
${taggedBullets}
                        </ul>`;
          }

          if (paragraphsHtml || bulletsHtml) {
            mainInfoHtml = `
                    <div class="detail-subsection">
                        <div class="subsection-label">주요 정보</div>
${paragraphsHtml}
${bulletsHtml}
                    </div>`;
          }
        }

        // Notable Quotes HTML
        let quotesHtml = '';
        if (
          section.sectionSummary?.notableQuotes &&
          section.sectionSummary.notableQuotes.length > 0
        ) {
          const quoteItems = section.sectionSummary.notableQuotes
            .map((quote) => `                        <p>"${this.escapeHtml(quote)}"</p>`)
            .join('\n');
          quotesHtml = `
                    <div class="quote">
                        <span class="quote-mark">Notable Quotes</span>
${quoteItems}
                    </div>`;
        }

        return `
            <div class="detail-section">
                <div class="detail-header">
                    <a href="${youtubeLink}" target="_blank" class="detail-time">${ts}</a>
                    <h3 class="detail-title">${this.escapeHtml(title)}</h3>
                </div>
                <div class="detail-body">
                    <div class="image-placeholder" style="background: url('./images/${imgName}') center/cover no-repeat; padding: 0; aspect-ratio: 16/9;">
                        <img src="./images/${imgName}" alt="Screenshot at ${ts}" style="width: 100%; height: auto; border-radius: 8px;" loading="lazy" onerror="this.outerHTML='<div style=\\'padding:40px;text-align:center;color:#71717a\\'>📷 이미지 로드 실패</div>'">
                    </div>
${keyPointsHtml}
${mainInfoHtml}
${quotesHtml}
                </div>
            </div>
`;
      })
      .join('\n');

    // Executive Summary HTML
    let execSummaryHtml = '';
    if (summary && summary.summary) {
      // Split summary into paragraphs
      const paragraphs = summary.summary.split(/\n\n|\n/).filter((p) => p.trim());
      const paragraphsHtml = paragraphs
        .map((para) => `            <p class="text-block">${this.escapeHtml(para)}</p>`)
        .join('\n');

      execSummaryHtml = `
        <!-- EXECUTIVE SUMMARY -->
        <section class="section">
            <div class="section-label">Executive Summary</div>
${paragraphsHtml}
        </section>
`;
    }

    const html = `<!DOCTYPE html>
<html lang="${this.detectLanguage(sections)}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="${this.escapeHtml(metadata.title)} - ${this.escapeHtml(metadata.channel)} | YouTube 영상 요약">
    <meta property="og:title" content="${this.escapeHtml(metadata.title)}">
    <meta property="og:description" content="${this.escapeHtml(metadata.channel)}의 YouTube 영상 요약">
    <meta property="og:type" content="article">
    <meta property="og:url" content="https://youtube.com/watch?v=${metadata.id}">
    ${metadata.thumbnail ? `<meta property="og:image" content="${metadata.thumbnail}">` : ''}
    <meta name="robots" content="noindex, nofollow">
    <meta name="generator" content="v2doc">
    <title>${this.escapeHtml(metadata.title)} | ${this.escapeHtml(metadata.channel)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #09090b;
            --bg-elevated: #18181b;
            --bg-subtle: #27272a;
            --neon-green: #22c55e;
            --neon-green-glow: rgba(34, 197, 94, 0.4);
            --neon-blue: #3b82f6;
            --neon-blue-glow: rgba(59, 130, 246, 0.4);
            --neon-purple: #a855f7;
            --neon-yellow: #eab308;
            --neon-cyan: #06b6d4;
            --neon-pink: #ec4899;
            --white: #fafafa;
            --gray-100: #e4e4e7;
            --gray-300: #a1a1aa;
            --gray-500: #71717a;
            --gray-700: #3f3f46;
            --border: #27272a;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans KR', 'Space Grotesk', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--white);
            line-height: 1.8;
            min-height: 100vh;
        }

        .container {
            max-width: 900px;
            margin: 0 auto;
            padding: 80px 48px;
        }

        /* Header */
        .header {
            margin-bottom: 80px;
        }

        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 48px;
            padding-bottom: 24px;
            border-bottom: 1px solid var(--border);
        }

        .tag {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            font-weight: 500;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--neon-green);
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tag::before {
            content: '';
            width: 8px;
            height: 8px;
            background: var(--neon-green);
            border-radius: 50%;
            box-shadow: 0 0 12px var(--neon-green-glow);
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }

        .date {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 12px;
            color: var(--gray-500);
        }

        .title {
            font-size: 52px;
            font-weight: 700;
            letter-spacing: -2px;
            line-height: 1.1;
            margin-bottom: 16px;
        }

        .subtitle {
            font-size: 22px;
            color: var(--gray-300);
            font-weight: 400;
            letter-spacing: -0.5px;
        }

        .meta {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 24px;
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid var(--border);
        }

        .meta-item {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .meta-label {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            color: var(--gray-500);
            text-transform: uppercase;
            letter-spacing: 1.5px;
        }

        .meta-value {
            font-size: 15px;
            font-weight: 500;
        }

        .meta-value a {
            color: var(--neon-blue);
            text-decoration: none;
        }

        .meta-value a:hover {
            text-decoration: underline;
        }

        /* Section */
        .section {
            margin-bottom: 64px;
        }

        .section-label {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 2px;
            text-transform: uppercase;
            color: var(--neon-green);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .section-label::after {
            content: '';
            flex: 1;
            height: 1px;
            background: linear-gradient(90deg, var(--neon-green) 0%, transparent 100%);
        }

        /* Content */
        .text-block {
            color: var(--gray-100);
            font-size: 16px;
            line-height: 1.9;
        }

        .text-block + .text-block {
            margin-top: 16px;
        }

        /* Insight Cards */
        .insight-grid {
            display: grid;
            gap: 1px;
            background: var(--border);
            border: 1px solid var(--border);
        }

        .insight-card {
            background: var(--bg);
            padding: 28px 32px;
            display: grid;
            grid-template-columns: 48px 1fr;
            gap: 20px;
        }

        .insight-card:hover {
            background: var(--bg-elevated);
        }

        .insight-num {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 32px;
            font-weight: 600;
            color: var(--neon-green);
            line-height: 1;
        }

        .insight-content h4 {
            font-size: 17px;
            font-weight: 600;
            margin-bottom: 8px;
            letter-spacing: -0.3px;
        }

        .insight-content p {
            color: var(--gray-300);
            font-size: 14px;
            line-height: 1.7;
        }

        /* TOC */
        .toc {
            border: 1px solid var(--border);
        }

        .toc-item {
            display: flex;
            align-items: stretch;
            border-bottom: 1px solid var(--border);
            transition: background 0.15s;
        }

        .toc-item:last-child {
            border-bottom: none;
        }

        .toc-item:hover {
            background: var(--bg-elevated);
        }

        .toc-time {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 13px;
            font-weight: 500;
            color: var(--neon-blue);
            padding: 16px 20px;
            min-width: 80px;
            border-right: 1px solid var(--border);
            display: flex;
            align-items: center;
        }

        .toc-title {
            padding: 16px 20px;
            color: var(--gray-100);
            font-size: 14px;
            display: flex;
            align-items: center;
        }

        /* Detail Section */
        .detail-section {
            border: 1px solid var(--border);
            margin-bottom: 48px;
        }

        .detail-header {
            display: flex;
            align-items: center;
            padding: 20px 28px;
            border-bottom: 1px solid var(--border);
            background: var(--bg-elevated);
        }

        .detail-time {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 14px;
            font-weight: 600;
            color: var(--bg);
            background: var(--neon-green);
            padding: 6px 12px;
            margin-right: 20px;
            text-decoration: none;
            transition: box-shadow 0.2s;
        }

        .detail-time:hover {
            box-shadow: 0 0 12px var(--neon-green-glow);
        }

        .detail-title {
            font-size: 20px;
            font-weight: 600;
            letter-spacing: -0.5px;
        }

        .detail-body {
            padding: 28px;
        }

        .detail-subsection {
            margin-bottom: 28px;
        }

        .detail-subsection:last-child {
            margin-bottom: 0;
        }

        .subsection-label {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 1.5px;
            text-transform: uppercase;
            color: var(--gray-500);
            margin-bottom: 14px;
        }

        /* Image placeholder */
        .image-placeholder {
            background: var(--bg-elevated);
            border: 1px solid var(--border);
            border-radius: 8px;
            margin-bottom: 24px;
            overflow: hidden;
        }

        .image-placeholder img {
            display: block;
            width: 100%;
            height: auto;
        }

        .bullet-list {
            list-style: none;
        }

        .bullet-list li {
            color: var(--gray-100);
            font-size: 15px;
            padding: 10px 0;
            padding-left: 20px;
            border-left: 2px solid var(--border);
            margin-left: 8px;
        }

        .bullet-list li:hover {
            border-left-color: var(--neon-green);
        }

        /* Tags */
        .tag-list {
            list-style: none;
            margin-top: 16px;
        }

        .tag-list li {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 8px 0;
            font-size: 14px;
            color: var(--gray-300);
        }

        .tag-badge {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 9px;
            font-weight: 600;
            letter-spacing: 0.5px;
            padding: 3px 8px;
            border-radius: 4px;
            flex-shrink: 0;
        }

        .tag-badge.insight { background: rgba(34, 197, 94, 0.2); color: var(--neon-green); }
        .tag-badge.technique { background: rgba(59, 130, 246, 0.2); color: var(--neon-blue); }
        .tag-badge.definition { background: rgba(168, 85, 247, 0.2); color: var(--neon-purple); }
        .tag-badge.metric { background: rgba(234, 179, 8, 0.2); color: var(--neon-yellow); }
        .tag-badge.tool { background: rgba(6, 182, 212, 0.2); color: var(--neon-cyan); }

        /* Quote */
        .quote {
            background: var(--bg-elevated);
            border-left: 3px solid var(--neon-blue);
            padding: 20px 24px;
            margin-top: 20px;
        }

        .quote p {
            font-size: 15px;
            font-style: italic;
            color: var(--white);
            line-height: 1.7;
            margin-bottom: 8px;
        }

        .quote p:last-child {
            margin-bottom: 0;
        }

        .quote-mark {
            color: var(--neon-blue);
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-bottom: 8px;
            display: block;
        }

        /* Conclusion */
        .conclusion {
            border: 2px solid var(--neon-green);
            padding: 48px;
            text-align: center;
            position: relative;
            margin-top: 64px;
        }

        .conclusion::before {
            content: 'CONCLUSION';
            position: absolute;
            top: -10px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--bg);
            padding: 0 16px;
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 2px;
            color: var(--neon-green);
        }

        .conclusion h3 {
            font-size: 26px;
            font-weight: 700;
            letter-spacing: -1px;
            margin-bottom: 20px;
        }

        .conclusion p {
            color: var(--gray-300);
            font-size: 16px;
            line-height: 1.8;
            max-width: 650px;
            margin: 0 auto 16px;
        }

        .highlight {
            color: var(--neon-green);
            font-weight: 600;
        }

        /* Footer */
        .footer {
            margin-top: 80px;
            padding-top: 32px;
            border-top: 1px solid var(--border);
            text-align: center;
        }

        .footer p {
            font-family: 'IBM Plex Mono', monospace;
            font-size: 11px;
            color: var(--gray-500);
            letter-spacing: 0.5px;
        }

        .footer p + p {
            margin-top: 4px;
        }

        .footer a {
            color: var(--neon-blue);
            text-decoration: none;
        }

        .footer a:hover {
            text-decoration: underline;
        }

        /* Page break for print */
        @media print {
            body { background: white; color: black; }
            .container { padding: 20px; }
            .detail-section, .toc, .insight-grid { border-color: #ddd; }
            .detail-header { background: #f5f5f5; }
            .page-break { page-break-before: always; }
            .tag::before { box-shadow: none; animation: none; }
        }

        .page-break {
            height: 1px;
            margin: 64px 0;
            border-top: 1px dashed var(--border);
        }

        /* Responsive */
        @media (max-width: 768px) {
            .container { padding: 40px 24px; }
            .title { font-size: 32px; }
            .subtitle { font-size: 18px; }
            .meta { grid-template-columns: repeat(2, 1fr); }
            .insight-card { grid-template-columns: 36px 1fr; padding: 20px; }
            .insight-num { font-size: 24px; }
            .detail-header { flex-direction: column; align-items: flex-start; gap: 12px; }
            .detail-time { margin-right: 0; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- HEADER -->
        <header class="header">
            <div class="header-top">
                <div class="tag">Video Summary</div>
                <div class="date">생성일: ${new Date().toISOString().split('T')[0]}</div>
            </div>
            <h1 class="title">${this.escapeHtml(metadata.title)}</h1>
            <p class="subtitle">${this.escapeHtml(this.getSubtitleFromSummary(summary, metadata.channel))}</p>
            <div class="meta">
                <div class="meta-item">
                    <span class="meta-label">Channel</span>
                    <span class="meta-value">${this.escapeHtml(metadata.channel)}</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Duration</span>
                    <span class="meta-value">${formatTimestamp(metadata.duration)} (${sections.length}개 섹션)</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Sections</span>
                    <span class="meta-value">${sections.length}개</span>
                </div>
                <div class="meta-item">
                    <span class="meta-label">Type</span>
                    <span class="meta-value">${VIDEO_TYPE_LABELS[metadata.videoType || 'unknown'] || '기타'}</span>
                </div>
            </div>
            <div class="meta" style="margin-top: 16px; padding-top: 16px;">
                <div class="meta-item" style="grid-column: span 4;">
                    <span class="meta-label">YouTube Link</span>
                    <span class="meta-value"><a href="https://youtube.com/watch?v=${metadata.id}" target="_blank">https://youtube.com/watch?v=${metadata.id}</a></span>
                </div>
            </div>
        </header>

${execSummaryHtml}
${keyInsightsHtml}
        <!-- TABLE OF CONTENTS -->
        <section class="section">
            <div class="section-label">Table of Contents</div>
            <div class="toc">
${tocItemsHtml}
            </div>
        </section>

        <div class="page-break"></div>

        <!-- DETAILED ANALYSIS -->
        <section class="section">
            <div class="section-label">Detailed Analysis</div>
${detailSectionsHtml}
        </section>

        <!-- CONCLUSION -->
        ${this.generateConclusionHtml(summary)}

        <!-- FOOTER -->
        <footer class="footer">
            <p>Generated by <a href="https://github.com/user/v2doc">v2doc</a></p>
            <p>영상 정보 및 자막의 저작권은 원 제작자에게 있습니다.</p>
        </footer>
    </div>
</body>
</html>`;

    await fs.promises.writeFile(outputPath, html, 'utf-8');
    logger.success(`Minimal Neon HTML 생성 완료: ${outputPath}`);
  }

  /**
   * Puppeteer를 사용한 PDF 생성 (minimal-neon 레이아웃용)
   * - 한글 텍스트 지원 개선
   * - CSS 스타일링 완벽 지원
   */
  async generatePDFViaPuppeteer(content: PDFContent, outputPath: string): Promise<void> {
    // Generate HTML to temp file
    const tempHtmlPath = outputPath.replace('.pdf', '-temp.html');
    const absoluteTempHtmlPath = path.resolve(tempHtmlPath);
    const absoluteOutputPath = path.resolve(outputPath);

    // Create images directory next to temp HTML for local image references
    const outputDir = path.dirname(absoluteOutputPath);
    const imagesDir = path.join(outputDir, 'images');

    // Copy screenshot images to images directory for HTML access
    if (!fs.existsSync(imagesDir)) {
      await fs.promises.mkdir(imagesDir, { recursive: true });
    }

    for (const section of content.sections) {
      if (section.screenshot.imagePath && fs.existsSync(section.screenshot.imagePath)) {
        const destPath = path.join(imagesDir, path.basename(section.screenshot.imagePath));
        if (!fs.existsSync(destPath)) {
          await fs.promises.copyFile(section.screenshot.imagePath, destPath);
        }
      }
    }

    // Generate the HTML file
    await this.generateMinimalNeonHTML(content, absoluteTempHtmlPath);

    logger.info('Puppeteer PDF 생성 시작...');

    interface PuppeteerModule {
      default: {
        launch: (options: { headless: boolean; args: string[] }) => Promise<{
          newPage: () => Promise<{
            goto: (
              url: string,
              options: { waitUntil: string; timeout: number }
            ) => Promise<unknown>;
            evaluateHandle: (expr: string) => Promise<unknown>;
            pdf: (options: {
              path: string;
              format: string;
              margin: { top: string; right: string; bottom: string; left: string };
              printBackground: boolean;
            }) => Promise<Buffer>;
          }>;
          close: () => Promise<void>;
        }>;
      };
    }

    // Dynamically import puppeteer (optional dependency)
    let puppeteerModule: PuppeteerModule;
    try {
      puppeteerModule = (await import('puppeteer')) as unknown as PuppeteerModule;
    } catch {
      throw new Error('Puppeteer is not installed. Install it with: npm install puppeteer');
    }

    // Launch Puppeteer
    const browser = await puppeteerModule.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();

      // Load HTML file with file:// protocol
      await page.goto(`file://${absoluteTempHtmlPath}`, {
        waitUntil: 'networkidle0',
        timeout: 60000,
      });

      // Wait for fonts to load
      await page.evaluateHandle('document.fonts.ready');

      // Generate PDF
      await page.pdf({
        path: absoluteOutputPath,
        format: 'A4',
        margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' },
        printBackground: true,
      });

      logger.debug('Puppeteer PDF 렌더링 완료');
    } finally {
      await browser.close();

      // Clean up temp HTML file
      await fs.promises.unlink(absoluteTempHtmlPath).catch(() => {
        /* ignore cleanup errors */
      });

      // Clean up images directory
      await fs.promises.rm(imagesDir, { recursive: true, force: true }).catch(() => {
        /* ignore cleanup errors */
      });
    }

    // Add PDF metadata using pdf-lib
    await this.addPDFMetadata(absoluteOutputPath, content.metadata);

    logger.success(`PDF 생성 완료 (Puppeteer): ${absoluteOutputPath}`);
  }

  /**
   * pdf-lib를 사용하여 PDF에 메타데이터 추가
   */
  private async addPDFMetadata(pdfPath: string, metadata: VideoMetadata): Promise<void> {
    try {
      const pdfBytes = await fs.promises.readFile(pdfPath);
      const pdfDoc = await PDFLibDocument.load(pdfBytes);

      pdfDoc.setTitle(metadata.title);
      pdfDoc.setAuthor(metadata.channel);
      pdfDoc.setSubject(`YouTube: ${metadata.id}`);
      pdfDoc.setCreator('v2doc');
      pdfDoc.setProducer('v2doc - YouTube to PDF Converter');
      pdfDoc.setKeywords(['YouTube', 'transcript', 'subtitle', 'screenshot']);
      pdfDoc.setCreationDate(new Date());

      const modifiedPdfBytes = await pdfDoc.save();
      await fs.promises.writeFile(pdfPath, modifiedPdfBytes);

      logger.debug('PDF 메타데이터 추가 완료');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(`PDF 메타데이터 추가 실패: ${errorMessage}`);
      // Don't throw - metadata is optional
    }
  }

  /**
   * Conclusion HTML 생성
   */
  private generateConclusionHtml(summary: ContentSummary | undefined): string {
    if (!summary || !summary.summary || !summary.keyPoints || summary.keyPoints.length === 0) {
      return '';
    }

    const firstKeyPoint = summary.keyPoints[0];
    // Extract key phrase from first key point (first few words or first sentence)
    const keyPhrase = firstKeyPoint.split(/[:.]/)[0].trim();

    return `
        <div class="conclusion">
            <h3>핵심 인사이트: <span class="highlight">${this.escapeHtml(keyPhrase)}</span></h3>
            <p>${this.escapeHtml(summary.summary)}</p>
        </div>
`;
  }

  /**
   * HTML 이스케이프 헬퍼
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Get subtitle from summary (first sentence) or fallback to channel name
   */
  private getSubtitleFromSummary(summary: ContentSummary | undefined, fallback: string): string {
    if (!summary?.summary) return fallback;

    // Extract first sentence
    const firstSentence = summary.summary.split(/(?<=[.!?])\s+/)[0];

    // Limit to ~60 characters with smart word boundary
    const maxLength = 60;
    if (firstSentence.length <= maxLength) {
      return firstSentence;
    }

    // Find word boundary before maxLength
    const truncated = firstSentence.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 30 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  /**
   * 자막 언어 감지
   */
  private detectLanguage(sections: PDFSection[]): string {
    const text = sections
      .flatMap((s) => s.subtitles.map((sub) => sub.text))
      .join(' ')
      .slice(0, 500);

    // 한글 포함 여부 확인
    const koreanRegex = /[\uAC00-\uD7AF]/;
    if (koreanRegex.test(text)) return 'ko';

    // 일본어 확인
    const japaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/;
    if (japaneseRegex.test(text)) return 'ja';

    // 중국어 확인
    const chineseRegex = /[\u4E00-\u9FFF]/;
    if (chineseRegex.test(text)) return 'zh';

    // 아랍어 확인
    const arabicRegex = /[\u0600-\u06FF]/;
    if (arabicRegex.test(text)) return 'ar';

    // 러시아어 (키릴 문자)
    const cyrillicRegex = /[\u0400-\u04FF]/;
    if (cyrillicRegex.test(text)) return 'ru';

    // 기본값: 영어
    return 'en';
  }
}
