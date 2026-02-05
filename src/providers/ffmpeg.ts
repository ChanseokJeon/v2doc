/**
 * FFmpeg Wrapper
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { ErrorCode, Yt2PdfError, ImageQuality } from '../types/index.js';
import { logger } from '../utils/logger.js';

const execFileAsync = promisify(execFile);

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

export class FFmpegWrapper {
  private ffmpegPath: string;
  private ffprobePath: string;

  private qualityMap: Record<ImageQuality, { width: number; height: number; scale: string }> = {
    low: { width: 854, height: 480, scale: '854:480' },
    medium: { width: 1280, height: 720, scale: '1280:720' },
    high: { width: 1920, height: 1080, scale: '1920:1080' },
  };

  constructor(ffmpegPath?: string) {
    this.ffmpegPath = ffmpegPath || process.env.FFMPEG_PATH || 'ffmpeg';
    this.ffprobePath = this.ffmpegPath.replace('ffmpeg', 'ffprobe');
  }

  /**
   * FFmpeg 설치 확인
   */
  static async checkInstallation(): Promise<boolean> {
    try {
      await execFileAsync('ffmpeg', ['-version']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 스크린샷 캡처
   */
  async captureFrame(
    videoPath: string,
    timestamp: number,
    outputPath: string,
    quality: ImageQuality = 'low',
    showTimestamp = true
  ): Promise<void> {
    const { scale } = this.qualityMap[quality];
    const timeStr = this.formatTime(timestamp);
    const displayTime = this.formatDisplayTime(timestamp);

    try {
      logger.debug(`스크린샷 캡처: ${timestamp}초 -> ${outputPath}`);

      // 타임스탬프 오버레이 필터
      // FFmpeg에서 콜론을 이스케이프: ':'  -> '\\:'
      const escapedTime = displayTime.replace(/:/g, '\\:');
      const timestampFilter = showTimestamp
        ? `,drawtext=text='${escapedTime}':fontcolor=white:fontsize=24:box=1:boxcolor=black@0.6:boxborderw=8:x=20:y=h-50`
        : '';

      const vfFilter = `scale=${scale}:force_original_aspect_ratio=decrease,pad=${scale}:(ow-iw)/2:(oh-ih)/2${timestampFilter}`;

      await execFileAsync(this.ffmpegPath, [
        '-ss',
        timeStr,
        '-i',
        videoPath,
        '-vframes',
        '1',
        '-vf',
        vfFilter,
        '-q:v',
        '2',
        outputPath,
        '-y',
      ]);
    } catch (error) {
      const err = error as Error;
      throw new Yt2PdfError(ErrorCode.SCREENSHOT_FAILED, `스크린샷 캡처 실패: ${err.message}`, err);
    }
  }

  /**
   * 표시용 시간 포맷 (초 -> MM:SS 또는 HH:MM:SS)
   */
  private formatDisplayTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * 여러 스크린샷 일괄 캡처
   */
  async captureFrames(
    videoPath: string,
    timestamps: number[],
    outputDir: string,
    quality: ImageQuality = 'low'
  ): Promise<string[]> {
    const outputPaths: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const outputPath = path.join(outputDir, `screenshot_${i.toString().padStart(4, '0')}.jpg`);

      await this.captureFrame(videoPath, timestamp, outputPath, quality);
      outputPaths.push(outputPath);
    }

    return outputPaths;
  }

  /**
   * 오디오 추출
   */
  async extractAudio(videoPath: string, outputPath: string, _format = 'mp3'): Promise<void> {
    try {
      logger.debug(`오디오 추출: ${videoPath} -> ${outputPath}`);

      await execFileAsync(this.ffmpegPath, [
        '-i',
        videoPath,
        '-vn',
        '-acodec',
        'libmp3lame',
        '-q:a',
        '2',
        outputPath,
        '-y',
      ]);
    } catch (error) {
      const err = error as Error;
      throw new Yt2PdfError(
        ErrorCode.VIDEO_DOWNLOAD_FAILED,
        `오디오 추출 실패: ${err.message}`,
        err
      );
    }
  }

  /**
   * 영상 정보 조회
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    try {
      const { stdout } = await execFileAsync(this.ffprobePath, [
        '-v',
        'quiet',
        '-print_format',
        'json',
        '-show_format',
        '-show_streams',
        videoPath,
      ]);

      const data = JSON.parse(stdout) as {
        format?: { duration?: string };
        streams?: Array<{
          codec_type?: string;
          width?: number;
          height?: number;
          r_frame_rate?: string;
        }>;
      };
      const videoStream = data.streams?.find((s) => s.codec_type === 'video');

      return {
        duration: parseFloat(data.format?.duration || '0'),
        width: videoStream?.width || 0,
        height: videoStream?.height || 0,
        fps: this.parseFps(videoStream?.r_frame_rate),
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new Yt2PdfError(
        ErrorCode.VIDEO_DOWNLOAD_FAILED,
        `영상 정보 조회 실패: ${err.message}`,
        err
      );
    }
  }

  /**
   * 타임스탬프 배열 생성
   */
  generateTimestamps(duration: number, interval: number): number[] {
    const timestamps: number[] = [];
    for (let t = 0; t < duration; t += interval) {
      timestamps.push(t);
    }
    return timestamps;
  }

  /**
   * 시간 포맷 (초 -> HH:MM:SS.mmm)
   */
  private formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`;
  }

  /**
   * FPS 파싱
   */
  private parseFps(fpsString?: string): number {
    if (!fpsString) return 30;

    const [num, den] = fpsString.split('/').map(Number);
    if (den && den !== 0) {
      return num / den;
    }
    return num || 30;
  }
}

// 기본 인스턴스
export const ffmpegWrapper = new FFmpegWrapper();
