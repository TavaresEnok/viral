'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import type { CaptionTheme, ContentType, ClipStyle, RenderLayout } from '@/types/api.types';

export function useUpload() {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  async function createAndUpload(data: {
    title: string;
    language: string;
    contentType: ContentType;
    clipStyle: ClipStyle;
    preferredClipDuration?: number;
    renderLayout?: RenderLayout;
    captionTheme?: CaptionTheme;
    file: File;
  }) {
    setUploading(true);
    setProgress(0);
    try {
      const project = await api.projects.create({
        title: data.title,
        language: data.language,
        contentType: data.contentType,
        clipStyle: data.clipStyle,
        preferredClipDuration: data.preferredClipDuration ?? 45,
        renderLayout: data.renderLayout ?? 'BLURRED_BACKGROUND',
        captionTheme: data.captionTheme ?? 'CLEAN_FOOTER',
      });
      await api.projects.upload(project.id, data.file, setProgress);
      return project.id;
    } finally {
      setUploading(false);
    }
  }

  return { progress, uploading, createAndUpload };
}
