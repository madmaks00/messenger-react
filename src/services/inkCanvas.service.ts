export interface ICanvasStroke {
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

export class InkCanvasService {
  public static renderStrokesToBase64(
    strokes: ICanvasStroke[],
    backgroundColor: string = '#FFFFFF',
    width: number = 400,
    height: number = 400
  ): string {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // 1. Заливка фонового цвета
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    // 2. Отрисовка всех зарегистрированных штрихов
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;

      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    // Возврат чистого Base64 (без префикса data:image/png;base64,) для соответствия PngBitmapEncoder
    const dataUrl = canvas.toDataURL('image/png');
    const commaIndex = dataUrl.indexOf(',');
    return commaIndex !== -1 ? dataUrl.substring(commaIndex + 1) : dataUrl;
  }
}