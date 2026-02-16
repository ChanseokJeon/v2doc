/**
 * ClassificationStage - Classifies video type and generates chapters
 */

import { PipelineStage, PipelineContext } from '../types.js';
import { DEV_MODE_SETTINGS } from '../../../types/config.js';
import { logger } from '../../../utils/logger.js';

export class ClassificationStage implements PipelineStage {
  readonly name = 'classification';

  async execute(context: PipelineContext): Promise<void> {
    // Use initialChapters from context (already set by MetadataStage)
    let chapters = [...(context.chapters || [])];
    const isDevMode = context.config.dev?.enabled;
    const processedSegments = context.processedSegments || [];

    // 영상 유형 분류
    if (
      context.ai &&
      processedSegments.length > 0 &&
      !(isDevMode && DEV_MODE_SETTINGS.skipClassification)
    ) {
      context.onProgress({ currentStep: '영상 유형 분류', progress: 34 });

      try {
        const subtitleSample = processedSegments
          .slice(0, 10)
          .map((s) => s.text)
          .join(' ');
        const typeResult = await context.ai.classifyVideoType(
          {
            title: context.metadata!.title,
            description: context.metadata!.description,
            channel: context.metadata!.channel,
          },
          subtitleSample
        );
        context.metadata!.videoType = typeResult.type;
        context.metadata!.videoTypeConfidence = typeResult.confidence;
        logger.info(
          `영상 유형: ${typeResult.type} (신뢰도: ${(typeResult.confidence * 100).toFixed(0)}%)`
        );
      } catch (e) {
        logger.warn('영상 유형 분류 실패', e as Error);
      }
    } else if (isDevMode && DEV_MODE_SETTINGS.skipClassification) {
      logger.info('[DEV MODE] 영상 분류 생략');
    }

    // 챕터 자동 생성
    if (
      chapters.length === 0 &&
      context.config.chapter.autoGenerate &&
      context.ai &&
      processedSegments.length > 0 &&
      !(isDevMode && DEV_MODE_SETTINGS.skipChapterGeneration)
    ) {
      context.onProgress({ currentStep: '챕터 자동 생성', progress: 35 });
      logger.info('AI 기반 챕터 자동 생성 중...');

      try {
        const summaryLang =
          context.config.summary.language || context.config.translation.defaultLanguage;
        chapters = await context.ai.detectTopicShifts(processedSegments, {
          minChapterLength: context.config.chapter.minChapterLength,
          maxChapters: context.config.chapter.maxChapters,
          language: summaryLang,
        });
        logger.info(`AI 생성 챕터: ${chapters.length}개`);
      } catch (e) {
        logger.warn('챕터 자동 생성 실패', e as Error);
      }
    } else if (isDevMode && DEV_MODE_SETTINGS.skipChapterGeneration && chapters.length === 0) {
      logger.info('[DEV MODE] AI 챕터 생성 생략');
    }

    // 메타데이터에 챕터 추가
    if (chapters.length > 0 && !context.metadata!.chapters) {
      context.metadata!.chapters = chapters;
    }

    context.chapters = chapters;
  }
}
