import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { FfmpegService } from './ffmpeg.service.js';

const execFileAsync = promisify(execFile);

@Injectable()
export class FaceDetectionService {
  private readonly logger = new Logger(FaceDetectionService.name);
  
  constructor(private readonly ffmpeg: FfmpegService) {}

  async trackFaces(inputPath: string, start: number, duration: number, fps: number = 2) {
    this.logger.debug(`Starting native C++ face tracking: ${inputPath} (start: ${start}, duration: ${duration})`);
    
    const rootDir = process.cwd().endsWith('/apps/worker') ? resolve(process.cwd(), '../..') : process.cwd();
    const enginePath = join(rootDir, 'packages/face-engine/build/face_engine');
    const prototxt = join(rootDir, 'packages/face-engine/models/deploy.prototxt');
    const caffemodel = join(rootDir, 'packages/face-engine/models/res10_300x300_ssd_iter_140000.caffemodel');

    try {
      const { stdout } = await execFileAsync(enginePath, [
        inputPath,
        String(start),
        String(duration),
        String(fps),
        prototxt,
        caffemodel
      ], { maxBuffer: 50 * 1024 * 1024 }); // 50MB max buffer

      const result = JSON.parse(stdout.trim() || '[]');
      this.logger.debug(`Face tracking completed: found faces in ${result.length} frames`);
      return result;
    } catch (error) {
      this.logger.error('Native face tracking failed', error);
      return [];
    }
  }
}
