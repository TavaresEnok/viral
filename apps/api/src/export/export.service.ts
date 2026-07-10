import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';

type ClipEntry = { id: string; title: string; start: number; end: number; duration: number; videoPath: string | null; project: { originalFilePath: string | null; title: string } };

const EXPORT_VIDEO_WIDTH = 1080;
const EXPORT_VIDEO_HEIGHT = 1920;
const EXPORT_AUDIO_SAMPLE_RATE = 44100;
const EXPORT_AUDIO_DEPTH = 16;

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  async getClips(userId: string, projectId: string): Promise<ClipEntry[]> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      select: { id: true, title: true, originalFilePath: true },
    });
    if (!project) throw new NotFoundException('Projeto não encontrado');

    const clips = await this.prisma.clip.findMany({
      where: { projectId, status: 'COMPLETED', videoPath: { not: null } },
      select: { id: true, title: true, start: true, end: true, duration: true, videoPath: true, project: { select: { originalFilePath: true, title: true } } },
      orderBy: { start: 'asc' },
    });

    return clips.map((clip) => ({
      ...clip,
      project: { originalFilePath: project.originalFilePath, title: project.title },
    }));
  }

  generatePremiereXml(clips: ClipEntry[]): string {
    const projectName = this.escapeXml(clips[0]?.project.title ?? 'Projeto');

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE xmeml>
<xmeml version="5">
<project>
  <name>${projectName}</name>
  <children>
    <sequence id="sequence-1">
      <name>${projectName} - Cortes</name>
      <duration>${Math.ceil(clips.reduce((s, c) => s + c.duration, 0) * 30)}</duration>
      <rate>
        <timebase>30</timebase>
        <ntsc>FALSE</ntsc>
      </rate>
      <media>
        <video>
          <track>
`;

    for (const [i, clip] of clips.entries()) {
      const inFrame = Math.round(clip.start * 30);
      const outFrame = Math.round(clip.end * 30);
      const durationFrames = outFrame - inFrame;
      const id = i + 1;
      const name = this.escapeXml(clip.title);

      xml += `
            <clipitem id="clip-${id}">
              <name>${name}</name>
              <duration>${durationFrames}</duration>
              <rate>
                <timebase>30</timebase>
                <ntsc>FALSE</ntsc>
              </rate>
              <in>${inFrame}</in>
              <out>${outFrame}</out>
              <start>0</start>
              <end>${durationFrames}</end>
              <file id="file-${id}">
                <name>${name}.mp4</name>
                <pathurl>${this.escapeXml(clip.videoPath ?? '')}</pathurl>
                <rate>
                  <timebase>30</timebase>
                  <ntsc>FALSE</ntsc>
                </rate>
                <duration>${durationFrames}</duration>
                <media>
                  <video>
                    <duration>${durationFrames}</duration>
                    <samplecharacteristics>
                      <width>${EXPORT_VIDEO_WIDTH}</width>
                      <height>${EXPORT_VIDEO_HEIGHT}</height>
                    </samplecharacteristics>
                  </video>
                  <audio>
                    <duration>${durationFrames}</duration>
                    <samplecharacteristics>
                      <samplerate>${EXPORT_AUDIO_SAMPLE_RATE}</samplerate>
                      <depth>${EXPORT_AUDIO_DEPTH}</depth>
                    </samplecharacteristics>
                  </audio>
                </media>
              </file>
            </clipitem>`;
    }

    xml += `
          </track>
        </video>
      </media>
    </sequence>
  </children>
</project>
</xmeml>`;

    return xml;
  }

  generateEdl(clips: ClipEntry[]): string {
    const lines: string[] = [];
    lines.push('TITLE: ' + (clips[0]?.project.title ?? 'Projeto'));
    lines.push('FCM: NON-DROP FRAME');
    lines.push('');

    for (const [i, clip] of clips.entries()) {
      const num = i + 1;
      const srcStart = this.framesToTc(Math.round(clip.start * 30), 30);
      const srcEnd = this.framesToTc(Math.round(clip.end * 30), 30);
      const name = clip.title.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);

      lines.push(`${num}  AX       V     C        ${srcStart} ${srcEnd} ${srcStart} ${srcEnd}`);
      lines.push(`* FROM CLIP NAME: ${name}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  private framesToTc(frames: number, fps: number): string {
    const totalSeconds = Math.floor(frames / fps);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const f = frames % fps;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(f).padStart(2, '0')}`;
  }

  private escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
}
