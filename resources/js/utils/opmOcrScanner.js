import { createWorker } from 'tesseract.js';

/**
 * Preprocess image on an HTML5 canvas to enhance 7-segment / LCD digits contrast
 */
function preprocessImage(imageSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      // Scale to optimal OCR dimension
      const maxDim = 1200;
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);

      // Apply Grayscale & High Contrast for LCD display
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        
        // Contrast enhancement
        const contrast = 1.35;
        const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
        const adjusted = factor * (gray - 128) + 128;
        
        const finalVal = Math.min(255, Math.max(0, adjusted));

        data[i] = finalVal;     // R
        data[i + 1] = finalVal; // G
        data[i + 2] = finalVal; // B
      }

      ctx.putImageData(imgData, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = reject;
    img.src = imageSrc;
  });
}

/**
 * Scan an OPM image to extract the optical power reading (e.g. -23.54 dBm)
 * @param {string} imageSrc - Base64 Data URL or Image URL
 * @returns {Promise<{success: boolean, dbmValue: number|null, rawText: string}>}
 */
export async function scanOpmPowerReading(imageSrc) {
  let worker = null;
  try {
    const processedImg = await preprocessImage(imageSrc);

    worker = await createWorker('eng');
    
    // Configure worker parameters for digit / technical display recognition
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789.-+dDBbmMWuUnN ',
    });

    const ret = await worker.recognize(processedImg);
    const rawText = ret.data.text || '';

    // Regex matchers for OPM values:
    // 1. Matches negative decimals like -23.54, -18.20, -24.5
    // 2. Matches numbers followed by dBm like 23.54 dBm or -23.54 dBm
    const patterns = [
      /-\s*([0-9]{1,2}[\.,][0-9]{1,2})/i,                 // e.g. -23.54, - 23.54
      /([0-9]{1,2}[\.,][0-9]{1,2})\s*dBm/i,               // e.g. 23.54 dBm
      /([0-9]{1,2}[\.,][0-9]{1,2})\s*dB/i,                // e.g. 23.54 dB
      /-\s*([0-9]{1,2})/i,                                 // e.g. -23
      /([0-9]{1,2}[\.,][0-9]{2})/i,                       // e.g. 23.54
    ];

    let extractedDbm = null;

    for (const pattern of patterns) {
      const match = rawText.match(pattern);
      if (match) {
        let numStr = match[1].replace(',', '.').replace(/\s+/g, '');
        let val = parseFloat(numStr);

        // Filter out wavelength numbers like 1310, 1490, 1550
        if (val >= 800 && val <= 1700) {
          continue;
        }

        // Standard OPM readings are typically negative in GPON/EPON distribution (-10 to -35 dBm)
        if (val > 0 && val <= 50) {
          val = -val;
        }

        if (val >= -45 && val <= 10) {
          extractedDbm = val.toFixed(2);
          break;
        }
      }
    }

    await worker.terminate();
    worker = null;

    if (extractedDbm !== null) {
      return {
        success: true,
        dbmValue: parseFloat(extractedDbm),
        rawText,
      };
    }

    return {
      success: false,
      dbmValue: null,
      rawText,
    };
  } catch (err) {
    console.warn('OCR Scan Error:', err);
    if (worker) {
      try { await worker.terminate(); } catch (e) {}
    }
    return {
      success: false,
      dbmValue: null,
      error: err.message,
    };
  }
}
