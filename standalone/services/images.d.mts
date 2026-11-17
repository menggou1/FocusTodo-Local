export function createImageConverter(capabilities: {
    createImage(): HTMLImageElement; createCanvas(): HTMLCanvasElement;
    createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void;
    setTimeout(callback: () => void, delay: number): unknown; clearTimeout(handle: unknown): void;
}): (blob: Blob, options?: {thumbnailFromCompressed?: boolean}) => Promise<{dataUrl: string; thumbnail: string}>;
