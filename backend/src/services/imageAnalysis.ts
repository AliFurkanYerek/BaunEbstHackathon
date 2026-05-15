import sharp from 'sharp';

export interface DamageDetection {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  damageLevel: 'minor' | 'moderate' | 'severe' | 'collapsed';
}

/**
 * Görüntü üzerinde hasar bölgelerini tahmin eder.
 * Hackathon MVP: renk/kenar analizi + grid tarama (gerçek model yerine hızlı prototip).
 */
export async function analyzeBuildingImage(
  buffer: Buffer
): Promise<{ detections: DamageDetection[]; overallScore: number }> {
  const { data, info } = await sharp(buffer)
    .resize(400, 400, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const grid = 8;
  const cellW = Math.floor(width / grid);
  const cellH = Math.floor(height / grid);
  const detections: DamageDetection[] = [];

  for (let gy = 0; gy < grid; gy++) {
    for (let gx = 0; gx < grid; gx++) {
      let sum = 0;
      let count = 0;
      let edgeSum = 0;

      const x0 = gx * cellW;
      const y0 = gy * cellH;

      for (let y = y0; y < Math.min(y0 + cellH, height); y++) {
        for (let x = x0; x < Math.min(x0 + cellW, width); x++) {
          const i = (y * width + x) * channels;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          sum += gray;
          count++;

          if (x > x0 && y > y0) {
            const pi = ((y - 1) * width + (x - 1)) * channels;
            const prev = 0.299 * data[pi] + 0.587 * data[pi + 1] + 0.114 * data[pi + 2];
            edgeSum += Math.abs(gray - prev);
          }
        }
      }

      const avgGray = sum / count;
      const edge = edgeSum / count;
      // Düşük parlaklık + yüksek kenar = enkaz/rütuş benzeri
      const debrisScore = (1 - avgGray / 255) * 0.6 + (edge / 80) * 0.4;

      if (debrisScore > 0.42) {
        const confidence = Math.min(0.95, debrisScore);
        let damageLevel: DamageDetection['damageLevel'] = 'minor';
        if (debrisScore > 0.75) damageLevel = 'collapsed';
        else if (debrisScore > 0.62) damageLevel = 'severe';
        else if (debrisScore > 0.52) damageLevel = 'moderate';

        detections.push({
          x: (gx / grid) * 100,
          y: (gy / grid) * 100,
          width: 100 / grid,
          height: 100 / grid,
          confidence: Math.round(confidence * 100) / 100,
          damageLevel,
        });
      }
    }
  }

  const overallScore =
    detections.length > 0
      ? detections.reduce((s, d) => {
          const w =
            d.damageLevel === 'collapsed'
              ? 1
              : d.damageLevel === 'severe'
                ? 0.8
                : d.damageLevel === 'moderate'
                  ? 0.5
                  : 0.2;
          return s + d.confidence * w;
        }, 0) / detections.length
      : 0.1;

  return { detections, overallScore: Math.round(overallScore * 100) / 100 };
}
