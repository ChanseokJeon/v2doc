/**
 * MetadataStage - Fetches video metadata and extracts chapters
 */

import { PipelineStage, PipelineContext } from '../types.js';
import { Chapter } from '../../../types/index.js';
import { logger } from '../../../utils/logger.js';
import { buildVideoUrl } from '../../../utils/url.js';

export class MetadataStage implements PipelineStage {
  readonly name = 'metadata';

  async execute(context: PipelineContext): Promise<void> {
    context.onProgress({ status: 'fetching', currentStep: '영상 정보 가져오기', progress: 5 });
    const metadata = await context.youtube.getMetadata(buildVideoUrl(context.videoId));

    if (metadata.duration > context.config.processing.maxDuration) {
      logger.warn(
        `영상 길이(${metadata.duration}초)가 제한(${context.config.processing.maxDuration}초)을 초과합니다.`
      );
    }

    let chapters: Chapter[] = [];
    if (
      context.config.chapter.useYouTubeChapters &&
      metadata.chapters &&
      metadata.chapters.length > 0
    ) {
      chapters = metadata.chapters;
      logger.info(`YouTube 챕터 발견: ${chapters.length}개`);
    }

    context.metadata = metadata;
    context.chapters = chapters;
  }
}
