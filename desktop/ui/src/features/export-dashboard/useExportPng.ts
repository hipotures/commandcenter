import { useState } from 'react';
import type { RefObject } from 'react';

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const base64 = dataUrl.split(',')[1];
  if (!base64) {
    throw new Error('Invalid PNG data.');
  }
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
};

const isTauriAvailable = () => {
  if (typeof window === 'undefined') {
    return false;
  }
  const tauriWindow = window as typeof window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    __TAURI_IPC__?: unknown;
  };
  return Boolean(tauriWindow.__TAURI_INTERNALS__ || tauriWindow.__TAURI__ || tauriWindow.__TAURI_IPC__);
};

interface UseExportPngOptions {
  dashboardRef: RefObject<HTMLElement | null>;
}

export function useExportPng({ dashboardRef }: UseExportPngOptions) {
  const [isExporting, setIsExporting] = useState(false);

  const exportPng = async () => {
    try {
      const { toPng } = await import('html-to-image');

      if (!dashboardRef.current) {
        throw new Error('Dashboard content not ready for export.');
      }

      setIsExporting(true);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

      const backgroundColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-background')
        .trim() || '#ffffff';
      let dataUrl: string;
      try {
        dataUrl = await toPng(dashboardRef.current, {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor,
          filter: (node) => !(node instanceof Element && node.hasAttribute('data-export-exclude')),
        });
      } finally {
        setIsExporting(false);
      }

      const now = new Date();
      const pad = (value: number) => value.toString().padStart(2, '0');
      const timestamp = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate()),
      ].join('') + `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      const filename = `cc-dashboard-${timestamp}.png`;

      if (isTauriAvailable()) {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const { writeFile } = await import('@tauri-apps/plugin-fs');

        const filePath = await save({
          defaultPath: filename,
          filters: [{
            name: 'PNG Image',
            extensions: ['png'],
          }],
        });

        if (!filePath) {
          return;
        }

        const byteArray = dataUrlToBytes(dataUrl);
        await writeFile(filePath, byteArray);

        alert(`PNG report saved to:\n${filePath}`);
        return;
      }

      const byteArray = dataUrlToBytes(dataUrl);
      const blob = new Blob([byteArray.buffer as ArrayBuffer], { type: 'image/png' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download PNG:', err);
      alert('Failed to download PNG report. Check console for details.');
    }
  };

  return { isExporting, exportPng };
}
